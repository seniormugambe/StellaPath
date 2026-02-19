/**
 * InvoiceExpirationService — Automated invoice expiration checking and cleanup.
 *
 * Responsibilities:
 * - Schedules invoice expiration checks via Bull queue
 * - Checks for invoices past their due date that haven't been approved
 * - Automatically marks expired invoices with EXPIRED status
 * - Sends notifications to invoice creators when invoices expire
 * - Provides processExpiredInvoices for batch processing
 * - Provides scheduleInvoiceExpiration for scheduling individual invoice expiration checks
 * - Implements cleanup for old invoice data
 *
 * Validates: Requirements 4.6
 */

import Bull from 'bull';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { NotificationService } from './NotificationService';
import {
  InvoiceRecord,
  InvoiceStatus,
} from '../types/database';
import { logger } from '../utils/logger';
import { parseRedisUrl } from '../config/queue';

// ── Queue job data types ──────────────────────────────────────────────

export interface InvoiceExpirationJobData {
  /** The invoice ID to check for expiration */
  invoiceId: string;
  /** Whether this is a recurring batch check */
  recurring: boolean;
}

// ── Expiration result ─────────────────────────────────────────────────

export interface ExpirationResult {
  invoiceId: string;
  status: 'expired' | 'already_expired' | 'not_expired' | 'cleaned' | 'error';
  invoice?: InvoiceRecord;
  error?: string;
}

// ── Cleanup result ────────────────────────────────────────────────────

export interface CleanupResult {
  deletedCount: number;
  errors: string[];
}

// ── Service configuration ─────────────────────────────────────────────

export interface InvoiceExpirationConfig {
  /** Redis URL for the Bull queue */
  redisUrl: string;
  /** Default interval in ms between batch expiration checks (default: 300000 = 5 min) */
  defaultCheckInterval: number;
  /** Number of concurrent workers processing expiration checks (default: 3) */
  concurrency: number;
  /** Maximum number of retry attempts for failed jobs (default: 3) */
  maxRetries: number;
  /** Backoff delay in ms between retries (default: 5000) */
  backoffDelay: number;
  /** Age in days after which expired/rejected invoices are eligible for cleanup (default: 90) */
  cleanupAgeDays: number;
}

// ── Queue name ────────────────────────────────────────────────────────

export const INVOICE_EXPIRATION_QUEUE_NAME = 'invoice-expiration-queue';

// ── Default configuration ─────────────────────────────────────────────

export function getDefaultInvoiceExpirationConfig(): InvoiceExpirationConfig {
  return {
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    defaultCheckInterval: parseInt(process.env['INVOICE_EXPIRATION_CHECK_INTERVAL'] || '300000', 10),
    concurrency: parseInt(process.env['INVOICE_EXPIRATION_CONCURRENCY'] || '3', 10),
    maxRetries: parseInt(process.env['INVOICE_EXPIRATION_MAX_RETRIES'] || '3', 10),
    backoffDelay: parseInt(process.env['INVOICE_EXPIRATION_BACKOFF_DELAY'] || '5000', 10),
    cleanupAgeDays: parseInt(process.env['INVOICE_CLEANUP_AGE_DAYS'] || '90', 10),
  };
}

// ── InvoiceExpirationService class ────────────────────────────────────

export class InvoiceExpirationService {
  private queue: Bull.Queue<InvoiceExpirationJobData>;
  private config: InvoiceExpirationConfig;
  private scheduledInvoices: Set<string> = new Set();

  constructor(
    private invoiceRepository: InvoiceRepository,
    private notificationService: NotificationService,
    config?: Partial<InvoiceExpirationConfig>,
    queue?: Bull.Queue<InvoiceExpirationJobData>,
  ) {
    this.config = { ...getDefaultInvoiceExpirationConfig(), ...config };

    if (queue) {
      this.queue = queue;
    } else {
      const redisOpts = parseRedisUrl(this.config.redisUrl);
      this.queue = new Bull<InvoiceExpirationJobData>(INVOICE_EXPIRATION_QUEUE_NAME, {
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
      logger.error('Invoice expiration queue error', { error: error.message });
    });

    this.queue.on('failed', (job, error) => {
      logger.warn('Invoice expiration job failed', {
        jobId: job.id,
        invoiceId: job.data.invoiceId,
        attempt: job.attemptsMade,
        error: error.message,
      });
    });

    this.queue.on('completed', (job) => {
      logger.info('Invoice expiration job completed', {
        jobId: job.id,
        invoiceId: job.data.invoiceId,
      });
    });
  }

  // ── Queue processor registration ───────────────────────────────────

  /**
   * Registers the queue processor that handles invoice expiration jobs.
   * Call this once during application startup.
   */
  registerQueueProcessor(): void {
    this.queue.process(this.config.concurrency, async (job) => {
      return this.processExpirationJob(job.data);
    });

    logger.info('Invoice expiration queue processor registered', {
      concurrency: this.config.concurrency,
    });
  }

  // ── Schedule individual invoice expiration ──────────────────────────

  /**
   * Schedules an expiration check for a specific invoice at its due date.
   * Adds a delayed job to the queue that fires when the invoice is due.
   */
  async scheduleInvoiceExpiration(invoiceId: string, expirationDate: Date): Promise<void> {
    const now = new Date();
    const delay = Math.max(0, expirationDate.getTime() - now.getTime());

    await this.queue.add(
      { invoiceId, recurring: false },
      {
        delay,
        jobId: `invoice-expiration-${invoiceId}`,
      },
    );

    this.scheduledInvoices.add(invoiceId);

    logger.info('Scheduled invoice expiration', {
      invoiceId,
      expirationDate: expirationDate.toISOString(),
      delayMs: delay,
    });
  }

  /**
   * Cancels a scheduled expiration check for a specific invoice.
   */
  async cancelScheduledExpiration(invoiceId: string): Promise<void> {
    const jobId = `invoice-expiration-${invoiceId}`;
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }

    this.scheduledInvoices.delete(invoiceId);

    logger.info('Cancelled scheduled invoice expiration', { invoiceId });
  }

  /**
   * Returns the set of currently scheduled invoice IDs.
   */
  getScheduledInvoices(): Set<string> {
    return new Set(this.scheduledInvoices);
  }

  // ── Core processing logic ───────────────────────────────────────────

  /**
   * Processes a single invoice expiration job:
   * 1. Loads the invoice
   * 2. Checks if it's past due and in an expirable status (SENT or APPROVED)
   * 3. Marks it as EXPIRED
   * 4. Sends notification to the invoice creator
   */
  async processExpirationJob(data: InvoiceExpirationJobData): Promise<ExpirationResult> {
    const { invoiceId } = data;

    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        this.scheduledInvoices.delete(invoiceId);
        return {
          invoiceId,
          status: 'error',
          error: 'Invoice not found',
        };
      }

      // Already expired or in a terminal state — skip
      if (invoice.status === InvoiceStatus.EXPIRED) {
        this.scheduledInvoices.delete(invoiceId);
        return {
          invoiceId,
          status: 'already_expired',
          invoice,
        };
      }

      // Only expire invoices that are in SENT or APPROVED status
      if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.APPROVED) {
        this.scheduledInvoices.delete(invoiceId);
        return {
          invoiceId,
          status: 'not_expired',
          invoice,
        };
      }

      // Check if the invoice is past its due date
      const now = new Date();
      if (now < invoice.dueDate) {
        return {
          invoiceId,
          status: 'not_expired',
          invoice,
        };
      }

      // Mark as expired
      const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, {
        status: InvoiceStatus.EXPIRED,
        metadata: {
          ...invoice.metadata,
          expiredAt: new Date().toISOString(),
          expiredBy: 'system',
        },
      });

      this.scheduledInvoices.delete(invoiceId);

      // Send notification to the invoice creator
      await this.notificationService.notifyInvoiceRejection(
        invoice.creatorId,
        {
          invoiceId: invoice.id,
          clientEmail: invoice.clientEmail,
          amount: String(invoice.amount),
          currency: 'XLM',
          reason: 'Invoice expired without approval before the due date',
        },
        { invoiceId: invoice.id },
      );

      logger.info('Invoice expired', {
        invoiceId,
        creatorId: invoice.creatorId,
        dueDate: invoice.dueDate.toISOString(),
      });

      return {
        invoiceId,
        status: 'expired',
        invoice: updatedInvoice,
      };
    } catch (error) {
      logger.error('Error processing invoice expiration', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        invoiceId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Batch processing ────────────────────────────────────────────────

  /**
   * Processes all expired invoices in a batch.
   * Finds invoices past their due date in SENT or APPROVED status,
   * marks them as expired, and sends notifications.
   */
  async processExpiredInvoices(): Promise<ExpirationResult[]> {
    try {
      const expiredInvoices = await this.invoiceRepository.findExpiredInvoices();
      const results: ExpirationResult[] = [];

      for (const invoice of expiredInvoices) {
        const result = await this.processExpirationJob({
          invoiceId: invoice.id,
          recurring: false,
        });
        results.push(result);
      }

      logger.info('Batch invoice expiration check completed', {
        total: expiredInvoices.length,
        expired: results.filter((r) => r.status === 'expired').length,
        alreadyExpired: results.filter((r) => r.status === 'already_expired').length,
        notExpired: results.filter((r) => r.status === 'not_expired').length,
        errors: results.filter((r) => r.status === 'error').length,
      });

      return results;
    } catch (error) {
      logger.error('Error in batch invoice expiration check', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // ── Cleanup old invoice data ────────────────────────────────────────

  /**
   * Cleans up old invoice data that is past the configured retention period.
   * Only deletes invoices in terminal states (EXPIRED, REJECTED, EXECUTED).
   */
  async cleanupOldInvoices(olderThanDays?: number): Promise<CleanupResult> {
    const ageDays = olderThanDays ?? this.config.cleanupAgeDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ageDays);

    const errors: string[] = [];
    let deletedCount = 0;

    try {
      // Find old invoices in terminal states
      const terminalStatuses = [InvoiceStatus.EXPIRED, InvoiceStatus.REJECTED, InvoiceStatus.EXECUTED];

      for (const status of terminalStatuses) {
        try {
          const oldInvoices = await this.invoiceRepository.findByCreatorId('', {
            status,
            endDate: cutoffDate,
          });

          for (const invoice of oldInvoices.data) {
            try {
              await this.invoiceRepository.delete(invoice.id);
              deletedCount++;
            } catch (deleteError) {
              const errorMsg = `Failed to delete invoice ${invoice.id}: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`;
              errors.push(errorMsg);
              logger.error(errorMsg);
            }
          }
        } catch (findError) {
          const errorMsg = `Failed to find old invoices with status ${status}: ${findError instanceof Error ? findError.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      logger.info('Invoice cleanup completed', {
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        ageDays,
        errors: errors.length,
      });

      return { deletedCount, errors };
    } catch (error) {
      const errorMsg = `Invoice cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      return { deletedCount, errors: [errorMsg] };
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Gracefully shuts down the invoice expiration queue.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down invoice expiration service...');
    await this.queue.close();
    this.scheduledInvoices.clear();
    logger.info('Invoice expiration service shut down');
  }

  /**
   * Returns the underlying Bull queue (useful for testing).
   */
  getQueue(): Bull.Queue<InvoiceExpirationJobData> {
    return this.queue;
  }
}
