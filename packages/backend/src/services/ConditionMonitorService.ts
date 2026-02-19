/**
 * ConditionMonitorService — Automated escrow condition monitoring and evaluation.
 *
 * Responsibilities:
 * - Schedules periodic condition checks for active escrows via Bull queue
 * - Evaluates escrow conditions (time_based, oracle_based, manual_approval)
 * - Automatically releases escrow when all conditions are met
 * - Automatically refunds escrow when timeout expires
 * - Sends notifications via NotificationService on status changes
 * - Provides start/stop monitoring for individual escrows
 * - Batch-processes all active escrows via checkAllActiveConditions
 *
 * Validates: Requirements 2.2, 2.3, 2.6
 */

import Bull from 'bull';
import { EscrowRepository } from '../repositories/EscrowRepository';
import { EscrowService } from './EscrowService';
import { NotificationService } from './NotificationService';
import {
  EscrowRecord,
  EscrowStatus,
  Condition,
  ConditionStatus,
} from '../types/database';
import { logger } from '../utils/logger';
import { parseRedisUrl } from '../config/queue';

// ── Queue job data types ──────────────────────────────────────────────

export interface ConditionCheckJobData {
  /** The escrow ID to check conditions for */
  escrowId: string;
  /** Whether this is a recurring check (repeatable job) */
  recurring: boolean;
}

// ── Condition check result ────────────────────────────────────────────

export interface ConditionCheckResult {
  escrowId: string;
  conditionStatuses: ConditionStatus[];
  allMet: boolean;
  isExpired: boolean;
  action: 'released' | 'refunded' | 'pending' | 'error';
  error?: string;
}

// ── Service configuration ─────────────────────────────────────────────

export interface ConditionMonitorConfig {
  /** Redis URL for the Bull queue */
  redisUrl: string;
  /** Default interval in ms between condition checks (default: 60000 = 1 min) */
  defaultCheckInterval: number;
  /** Number of concurrent workers processing condition checks (default: 3) */
  concurrency: number;
  /** Maximum number of retry attempts for failed jobs (default: 3) */
  maxRetries: number;
  /** Backoff delay in ms between retries (default: 5000) */
  backoffDelay: number;
}

// ── Queue name ────────────────────────────────────────────────────────

export const CONDITION_CHECK_QUEUE_NAME = 'condition-check-queue';

// ── Default configuration ─────────────────────────────────────────────

export function getDefaultConditionMonitorConfig(): ConditionMonitorConfig {
  return {
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    defaultCheckInterval: parseInt(process.env['CONDITION_CHECK_INTERVAL'] || '60000', 10),
    concurrency: parseInt(process.env['CONDITION_CHECK_CONCURRENCY'] || '3', 10),
    maxRetries: parseInt(process.env['CONDITION_CHECK_MAX_RETRIES'] || '3', 10),
    backoffDelay: parseInt(process.env['CONDITION_CHECK_BACKOFF_DELAY'] || '5000', 10),
  };
}

// ── ConditionMonitorService class ─────────────────────────────────────

export class ConditionMonitorService {
  private queue: Bull.Queue<ConditionCheckJobData>;
  private config: ConditionMonitorConfig;
  private monitoredEscrows: Set<string> = new Set();

  constructor(
    private escrowRepository: EscrowRepository,
    private escrowService: EscrowService,
    private notificationService: NotificationService,
    config?: Partial<ConditionMonitorConfig>,
    queue?: Bull.Queue<ConditionCheckJobData>
  ) {
    this.config = { ...getDefaultConditionMonitorConfig(), ...config };

    if (queue) {
      this.queue = queue;
    } else {
      const redisOpts = parseRedisUrl(this.config.redisUrl);
      this.queue = new Bull<ConditionCheckJobData>(CONDITION_CHECK_QUEUE_NAME, {
        redis: redisOpts,
        defaultJobOptions: {
          attempts: this.config.maxRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.backoffDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });
    }

    this.setupQueueEventListeners();
  }

  // ── Queue event listeners ───────────────────────────────────────────

  private setupQueueEventListeners(): void {
    this.queue.on('error', (error) => {
      logger.error('Condition check queue error', { error: error.message });
    });

    this.queue.on('failed', (job, error) => {
      logger.warn('Condition check job failed', {
        jobId: job.id,
        escrowId: job.data.escrowId,
        attempt: job.attemptsMade,
        error: error.message,
      });
    });

    this.queue.on('completed', (job) => {
      logger.info('Condition check job completed', {
        jobId: job.id,
        escrowId: job.data.escrowId,
      });
    });
  }

  // ── Queue processor registration ───────────────────────────────────

  /**
   * Registers the queue processor that handles condition check jobs.
   * Call this once during application startup.
   */
  registerQueueProcessor(): void {
    this.queue.process(this.config.concurrency, async (job) => {
      return this.processConditionCheckJob(job.data);
    });

    logger.info('Condition check queue processor registered', {
      concurrency: this.config.concurrency,
    });
  }

  // ── Start/Stop monitoring ───────────────────────────────────────────

  /**
   * Starts monitoring conditions for a specific escrow.
   * Adds a repeatable job to the queue that checks conditions at the configured interval.
   */
  async startMonitoring(escrowId: string, checkInterval?: number): Promise<void> {
    const interval = checkInterval || this.config.defaultCheckInterval;

    // Verify escrow exists and is active
    const escrow = await this.escrowRepository.findById(escrowId);
    if (!escrow) {
      throw new Error(`Escrow not found: ${escrowId}`);
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new Error(`Escrow is not active: ${escrowId} (status: ${escrow.status})`);
    }

    // Add a repeatable job for this escrow
    await this.queue.add(
      { escrowId, recurring: true },
      {
        repeat: { every: interval },
        jobId: `condition-monitor-${escrowId}`,
      }
    );

    this.monitoredEscrows.add(escrowId);

    logger.info('Started condition monitoring', {
      escrowId,
      checkInterval: interval,
    });
  }

  /**
   * Stops monitoring conditions for a specific escrow.
   * Removes the repeatable job from the queue.
   */
  async stopMonitoring(escrowId: string): Promise<void> {
    // Remove repeatable jobs for this escrow
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `condition-monitor-${escrowId}`) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    this.monitoredEscrows.delete(escrowId);

    logger.info('Stopped condition monitoring', { escrowId });
  }

  /**
   * Returns the set of currently monitored escrow IDs.
   */
  getMonitoredEscrows(): Set<string> {
    return new Set(this.monitoredEscrows);
  }

  // ── Core processing logic ───────────────────────────────────────────

  /**
   * Processes a single condition check job:
   * 1. Loads the escrow
   * 2. Checks if expired → refund
   * 3. Evaluates all conditions
   * 4. If all met → release
   * 5. Sends notifications on status changes
   */
  async processConditionCheckJob(data: ConditionCheckJobData): Promise<ConditionCheckResult> {
    const { escrowId } = data;

    try {
      const escrow = await this.escrowRepository.findById(escrowId);
      if (!escrow) {
        await this.stopMonitoring(escrowId);
        return {
          escrowId,
          conditionStatuses: [],
          allMet: false,
          isExpired: false,
          action: 'error',
          error: 'Escrow not found',
        };
      }

      // Skip if escrow is no longer active
      if (escrow.status !== EscrowStatus.ACTIVE) {
        await this.stopMonitoring(escrowId);
        return {
          escrowId,
          conditionStatuses: [],
          allMet: false,
          isExpired: false,
          action: 'pending',
        };
      }

      // Check if expired → refund
      const now = new Date();
      if (now >= escrow.expiresAt) {
        return this.handleExpiredEscrow(escrow);
      }

      // Evaluate all conditions
      const conditionStatuses = await this.evaluateAllConditions(escrow);
      const allMet = conditionStatuses.length > 0 && conditionStatuses.every((cs) => cs.met);

      if (allMet) {
        return this.handleConditionsMet(escrow, conditionStatuses);
      }

      logger.info('Conditions not yet met', {
        escrowId,
        met: conditionStatuses.filter((cs) => cs.met).length,
        total: conditionStatuses.length,
      });

      return {
        escrowId,
        conditionStatuses,
        allMet: false,
        isExpired: false,
        action: 'pending',
      };
    } catch (error) {
      logger.error('Error processing condition check', {
        escrowId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        escrowId,
        conditionStatuses: [],
        allMet: false,
        isExpired: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Batch processing ────────────────────────────────────────────────

  /**
   * Checks conditions for all active escrows.
   * Useful for batch processing or cron-style invocation.
   */
  async checkAllActiveConditions(): Promise<ConditionCheckResult[]> {
    try {
      const activeEscrows = await this.escrowRepository.findActiveEscrows();
      const expiredEscrows = await this.escrowRepository.findExpiredEscrows();

      const allEscrows = [...activeEscrows, ...expiredEscrows];
      const results: ConditionCheckResult[] = [];

      for (const escrow of allEscrows) {
        const result = await this.processConditionCheckJob({
          escrowId: escrow.id,
          recurring: false,
        });
        results.push(result);
      }

      logger.info('Batch condition check completed', {
        total: allEscrows.length,
        released: results.filter((r) => r.action === 'released').length,
        refunded: results.filter((r) => r.action === 'refunded').length,
        pending: results.filter((r) => r.action === 'pending').length,
        errors: results.filter((r) => r.action === 'error').length,
      });

      return results;
    } catch (error) {
      logger.error('Error in batch condition check', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // ── Condition evaluation ────────────────────────────────────────────

  /**
   * Evaluates all conditions for an escrow and returns their statuses.
   */
  async evaluateAllConditions(escrow: EscrowRecord): Promise<ConditionStatus[]> {
    const conditionStatuses: ConditionStatus[] = [];

    for (const condition of escrow.conditions) {
      const met = await this.evaluateCondition(condition, escrow);
      conditionStatuses.push({
        condition,
        met,
        checkedAt: new Date(),
        evidence: met ? `Condition '${condition.type}' satisfied` : `Condition '${condition.type}' not yet satisfied`,
      });
    }

    return conditionStatuses;
  }

  /**
   * Evaluates a single condition based on its type.
   */
  async evaluateCondition(condition: Condition, escrow: EscrowRecord): Promise<boolean> {
    switch (condition.type) {
      case 'time_based':
        return this.evaluateTimeBased(condition);
      case 'oracle_based':
        return this.evaluateOracleBased(condition, escrow);
      case 'manual_approval':
        return this.evaluateManualApproval(condition);
      default:
        logger.warn('Unknown condition type', { type: condition.type });
        return false;
    }
  }

  /**
   * Evaluates a time-based condition.
   * Returns true if the current time is past the target time.
   */
  private evaluateTimeBased(condition: Condition): boolean {
    const targetTime = condition.parameters['targetTime'];
    if (!targetTime) {
      logger.warn('Time-based condition missing targetTime parameter');
      return false;
    }
    const target = new Date(targetTime);
    return new Date() >= target;
  }

  /**
   * Evaluates an oracle-based condition.
   * Checks if the oracle endpoint returns a truthy value, or falls back to
   * the 'verified' parameter for manual oracle verification.
   */
  private async evaluateOracleBased(condition: Condition, _escrow: EscrowRecord): Promise<boolean> {
    // Check if oracle has been manually verified
    if (condition.parameters['verified'] === true) {
      return true;
    }

    // In a production system, this would call an external oracle endpoint
    // For now, check the 'value' parameter against the 'threshold'
    const value = condition.parameters['value'];
    const threshold = condition.parameters['threshold'];

    if (value !== undefined && threshold !== undefined) {
      return Number(value) >= Number(threshold);
    }

    logger.info('Oracle-based condition awaiting verification', {
      validator: condition.validator,
    });
    return false;
  }

  /**
   * Evaluates a manual approval condition.
   * Returns true if the 'approved' parameter is set to true.
   */
  private evaluateManualApproval(condition: Condition): boolean {
    return condition.parameters['approved'] === true;
  }

  // ── Escrow action handlers ──────────────────────────────────────────

  /**
   * Handles an expired escrow by refunding it and sending notifications.
   */
  private async handleExpiredEscrow(escrow: EscrowRecord): Promise<ConditionCheckResult> {
    logger.info('Escrow expired, initiating refund', { escrowId: escrow.id });

    const refundResult = await this.escrowService.refundEscrow(escrow.id);

    if (refundResult.success) {
      await this.stopMonitoring(escrow.id);

      // Send refund notification to the escrow creator
      await this.notificationService.notifyEscrowRefund(
        escrow.creatorId,
        {
          recipientName: escrow.creatorId,
          amount: String(escrow.amount),
          currency: 'XLM',
          escrowId: escrow.id,
          reason: 'Escrow conditions were not met within the timeout period',
        },
        { escrowId: escrow.id }
      );

      return {
        escrowId: escrow.id,
        conditionStatuses: [],
        allMet: false,
        isExpired: true,
        action: 'refunded',
      };
    }

    // Refund failed — the escrow may have already been refunded or is not active
    return {
      escrowId: escrow.id,
      conditionStatuses: [],
      allMet: false,
      isExpired: true,
      action: 'error',
      error: refundResult.error || 'Refund failed',
    };
  }

  /**
   * Handles an escrow where all conditions are met by releasing it and sending notifications.
   */
  private async handleConditionsMet(
    escrow: EscrowRecord,
    conditionStatuses: ConditionStatus[]
  ): Promise<ConditionCheckResult> {
    logger.info('All conditions met, initiating release', { escrowId: escrow.id });

    const releaseResult = await this.escrowService.releaseEscrow(escrow.id);

    if (releaseResult.success) {
      await this.stopMonitoring(escrow.id);

      // Send release notification to the escrow creator
      await this.notificationService.notifyEscrowRelease(
        escrow.creatorId,
        {
          recipientName: escrow.creatorId,
          amount: String(escrow.amount),
          currency: 'XLM',
          escrowId: escrow.id,
          transactionHash: releaseResult.escrow?.txHash || '',
        },
        { escrowId: escrow.id }
      );

      return {
        escrowId: escrow.id,
        conditionStatuses,
        allMet: true,
        isExpired: false,
        action: 'released',
      };
    }

    // Release failed
    return {
      escrowId: escrow.id,
      conditionStatuses,
      allMet: true,
      isExpired: false,
      action: 'error',
      error: releaseResult.error || 'Release failed',
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Gracefully shuts down the condition monitor queue.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down condition monitor...');
    await this.queue.close();
    this.monitoredEscrows.clear();
    logger.info('Condition monitor shut down');
  }

  /**
   * Returns the underlying Bull queue (useful for testing).
   */
  getQueue(): Bull.Queue<ConditionCheckJobData> {
    return this.queue;
  }
}
