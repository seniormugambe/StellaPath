/**
 * TransactionStatusSyncService — Periodic Stellar network status checking and
 * automatic transaction status updates with retry logic.
 *
 * Responsibilities:
 * - Schedules periodic transaction status sync jobs via Bull queue
 * - Checks pending transactions against the Stellar network (Horizon API)
 * - Automatically updates transaction status when network confirmations occur
 * - Implements retry logic with exponential backoff for network failures
 * - Sends notifications via NotificationService when transaction status changes
 * - Provides syncAllPendingTransactions for batch processing
 * - Provides syncTransactionStatus for individual transaction sync
 * - Handles network failure recovery gracefully
 *
 * Validates: Requirements 1.4, 7.3, 8.4
 */

import Bull from 'bull';
import * as StellarSdk from 'stellar-sdk';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { NotificationService } from './NotificationService';
import {
  TransactionRecord,
  TransactionStatus,
} from '../types/database';
import { logger } from '../utils/logger';
import { parseRedisUrl } from '../config/queue';

// ── Queue job data types ──────────────────────────────────────────────

export interface TransactionSyncJobData {
  /** The transaction hash to sync (empty string for batch sync) */
  txHash: string;
  /** Whether this is a batch sync of all pending transactions */
  batch: boolean;
  /** Current retry attempt for this specific sync */
  retryCount: number;
}

// ── Sync result types ─────────────────────────────────────────────────

export interface TransactionSyncResult {
  txHash: string;
  previousStatus: TransactionStatus;
  newStatus: TransactionStatus;
  changed: boolean;
  notified: boolean;
  error?: string;
}

export interface BatchSyncResult {
  total: number;
  synced: number;
  changed: number;
  failed: number;
  results: TransactionSyncResult[];
}

// ── Service configuration ─────────────────────────────────────────────

export interface TransactionStatusSyncConfig {
  /** Redis URL for the Bull queue */
  redisUrl: string;
  /** Default interval in ms between batch sync checks (default: 30000 = 30s) */
  defaultSyncInterval: number;
  /** Number of concurrent workers processing sync jobs (default: 3) */
  concurrency: number;
  /** Maximum number of retry attempts for failed jobs (default: 5) */
  maxRetries: number;
  /** Initial backoff delay in ms between retries (default: 2000) */
  backoffDelay: number;
  /** Maximum backoff delay in ms (default: 60000 = 1 min) */
  maxBackoffDelay: number;
  /** Horizon server URL */
  horizonUrl: string;
  /** Stellar network passphrase */
  networkPassphrase: string;
}

// ── Queue name ────────────────────────────────────────────────────────

export const TRANSACTION_SYNC_QUEUE_NAME = 'transaction-status-sync-queue';

// ── Default configuration ─────────────────────────────────────────────

export function getDefaultTransactionStatusSyncConfig(): TransactionStatusSyncConfig {
  return {
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    defaultSyncInterval: parseInt(process.env['TX_SYNC_INTERVAL'] || '30000', 10),
    concurrency: parseInt(process.env['TX_SYNC_CONCURRENCY'] || '3', 10),
    maxRetries: parseInt(process.env['TX_SYNC_MAX_RETRIES'] || '5', 10),
    backoffDelay: parseInt(process.env['TX_SYNC_BACKOFF_DELAY'] || '2000', 10),
    maxBackoffDelay: parseInt(process.env['TX_SYNC_MAX_BACKOFF_DELAY'] || '60000', 10),
    horizonUrl: process.env['HORIZON_URL'] || 'https://horizon-testnet.stellar.org',
    networkPassphrase: process.env['NETWORK_PASSPHRASE'] || StellarSdk.Networks.TESTNET,
  };
}

// ── TransactionStatusSyncService class ────────────────────────────────

export class TransactionStatusSyncService {
  private queue: Bull.Queue<TransactionSyncJobData>;
  private config: TransactionStatusSyncConfig;
  private server: StellarSdk.Horizon.Server;
  private isSyncing: boolean = false;

  constructor(
    private transactionRepository: TransactionRepository,
    private notificationService: NotificationService,
    config?: Partial<TransactionStatusSyncConfig>,
    queue?: Bull.Queue<TransactionSyncJobData>,
  ) {
    this.config = { ...getDefaultTransactionStatusSyncConfig(), ...config };
    this.server = new StellarSdk.Horizon.Server(this.config.horizonUrl);

    if (queue) {
      this.queue = queue;
    } else {
      const redisOpts = parseRedisUrl(this.config.redisUrl);
      this.queue = new Bull<TransactionSyncJobData>(TRANSACTION_SYNC_QUEUE_NAME, {
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
      logger.error('Transaction sync queue error', { error: error.message });
    });

    this.queue.on('failed', (job, error) => {
      logger.warn('Transaction sync job failed', {
        jobId: job.id,
        txHash: job.data.txHash,
        batch: job.data.batch,
        attempt: job.attemptsMade,
        error: error.message,
      });
    });

    this.queue.on('completed', (job) => {
      logger.info('Transaction sync job completed', {
        jobId: job.id,
        txHash: job.data.txHash,
        batch: job.data.batch,
      });
    });
  }

  // ── Queue processor registration ───────────────────────────────────

  /**
   * Registers the queue processor that handles transaction sync jobs.
   * Call this once during application startup.
   */
  registerQueueProcessor(): void {
    this.queue.process(this.config.concurrency, async (job) => {
      if (job.data.batch) {
        return this.syncAllPendingTransactions();
      }
      return this.syncTransactionStatus(job.data.txHash);
    });

    logger.info('Transaction sync queue processor registered', {
      concurrency: this.config.concurrency,
    });
  }

  // ── Schedule periodic sync ──────────────────────────────────────────

  /**
   * Starts periodic batch sync of all pending transactions.
   * Adds a repeatable job to the queue at the configured interval.
   */
  async startPeriodicSync(interval?: number): Promise<void> {
    const syncInterval = interval || this.config.defaultSyncInterval;

    await this.queue.add(
      { txHash: '', batch: true, retryCount: 0 },
      {
        repeat: { every: syncInterval },
        jobId: 'periodic-transaction-sync',
      },
    );

    logger.info('Started periodic transaction status sync', {
      intervalMs: syncInterval,
    });
  }

  /**
   * Stops periodic batch sync.
   */
  async stopPeriodicSync(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === 'periodic-transaction-sync') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    logger.info('Stopped periodic transaction status sync');
  }

  // ── Individual transaction sync ─────────────────────────────────────

  /**
   * Syncs the status of a single transaction against the Stellar network.
   * Implements retry logic with exponential backoff for network failures.
   *
   * @param txHash - The transaction hash to sync
   * @returns The sync result with previous and new status
   */
  async syncTransactionStatus(txHash: string): Promise<TransactionSyncResult> {
    try {
      // Look up the transaction in the database
      const transaction = await this.transactionRepository.findByTxHash(txHash);
      if (!transaction) {
        return {
          txHash,
          previousStatus: TransactionStatus.PENDING,
          newStatus: TransactionStatus.PENDING,
          changed: false,
          notified: false,
          error: 'Transaction not found in database',
        };
      }

      // Skip if already in a terminal state
      if (
        transaction.status === TransactionStatus.CONFIRMED ||
        transaction.status === TransactionStatus.FAILED ||
        transaction.status === TransactionStatus.CANCELLED
      ) {
        return {
          txHash,
          previousStatus: transaction.status,
          newStatus: transaction.status,
          changed: false,
          notified: false,
        };
      }

      const previousStatus = transaction.status;

      // Query the Stellar network for the transaction status
      const networkStatus = await this.queryNetworkStatus(txHash);

      // Update the database if the status has changed
      if (networkStatus !== previousStatus) {
        await this.transactionRepository.updateStatusByTxHash(txHash, {
          status: networkStatus,
          metadata: {
            lastSyncedAt: new Date().toISOString(),
            syncSource: 'horizon',
          },
        });

        // Send notification for status change
        let notified = false;
        try {
          await this.sendStatusChangeNotification(transaction, networkStatus);
          notified = true;
        } catch (notifError) {
          logger.warn('Failed to send status change notification', {
            txHash,
            error: notifError instanceof Error ? notifError.message : 'Unknown error',
          });
        }

        logger.info('Transaction status updated', {
          txHash,
          previousStatus,
          newStatus: networkStatus,
        });

        return {
          txHash,
          previousStatus,
          newStatus: networkStatus,
          changed: true,
          notified,
        };
      }

      return {
        txHash,
        previousStatus,
        newStatus: networkStatus,
        changed: false,
        notified: false,
      };
    } catch (error) {
      logger.error('Error syncing transaction status', {
        txHash,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        txHash,
        previousStatus: TransactionStatus.PENDING,
        newStatus: TransactionStatus.PENDING,
        changed: false,
        notified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Batch sync ──────────────────────────────────────────────────────

  /**
   * Syncs the status of all pending transactions against the Stellar network.
   * Processes each transaction individually and collects results.
   */
  async syncAllPendingTransactions(): Promise<BatchSyncResult> {
    if (this.isSyncing) {
      logger.info('Batch sync already in progress, skipping');
      return {
        total: 0,
        synced: 0,
        changed: 0,
        failed: 0,
        results: [],
      };
    }

    this.isSyncing = true;

    try {
      const pendingTransactions = await this.transactionRepository.findPendingTransactions();
      const results: TransactionSyncResult[] = [];

      for (const transaction of pendingTransactions) {
        const result = await this.syncTransactionStatus(transaction.txHash);
        results.push(result);
      }

      const changed = results.filter((r) => r.changed).length;
      const failed = results.filter((r) => r.error).length;

      logger.info('Batch transaction sync completed', {
        total: pendingTransactions.length,
        synced: results.length,
        changed,
        failed,
      });

      return {
        total: pendingTransactions.length,
        synced: results.length,
        changed,
        failed,
        results,
      };
    } catch (error) {
      logger.error('Error in batch transaction sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        total: 0,
        synced: 0,
        changed: 0,
        failed: 0,
        results: [],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Enqueue individual sync ─────────────────────────────────────────

  /**
   * Enqueues a single transaction for status sync.
   * Useful for on-demand sync requests.
   */
  async enqueueSyncJob(txHash: string): Promise<void> {
    await this.queue.add(
      { txHash, batch: false, retryCount: 0 },
      {
        jobId: `sync-${txHash}-${Date.now()}`,
      },
    );

    logger.info('Transaction sync job enqueued', { txHash });
  }

  // ── Network query with retry ────────────────────────────────────────

  /**
   * Queries the Stellar Horizon API for the transaction status.
   * Implements exponential backoff retry for network failures.
   */
  async queryNetworkStatus(txHash: string): Promise<TransactionStatus> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const txResponse = await this.server.transactions().transaction(txHash).call();

        if (txResponse.successful) {
          return TransactionStatus.CONFIRMED;
        } else {
          return TransactionStatus.FAILED;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If it's a 404, the transaction hasn't been submitted or is still pending
        if (this.isNotFoundError(error)) {
          return TransactionStatus.PENDING;
        }

        // For other errors (network issues), retry with backoff
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          logger.warn('Network error querying transaction, retrying', {
            txHash,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            nextRetryMs: delay,
            error: lastError.message,
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted — throw to let Bull handle job-level retry
    logger.error('All retry attempts exhausted for transaction query', {
      txHash,
      maxRetries: this.config.maxRetries,
      error: lastError?.message,
    });

    throw lastError || new Error(`Failed to query transaction status for ${txHash}`);
  }

  // ── Notification helpers ────────────────────────────────────────────

  /**
   * Sends a notification when a transaction status changes.
   */
  private async sendStatusChangeNotification(
    transaction: TransactionRecord,
    newStatus: TransactionStatus,
  ): Promise<void> {
    if (newStatus === TransactionStatus.CONFIRMED) {
      await this.notificationService.notifyTransactionComplete(
        transaction.userId,
        {
          transactionHash: transaction.txHash,
          amount: String(transaction.amount),
          currency: 'XLM',
          recipientName: transaction.recipient,
        },
        { transactionId: transaction.id },
      );
    } else if (newStatus === TransactionStatus.FAILED) {
      await this.notificationService.sendSystemAlert(
        transaction.userId,
        {
          title: 'Transaction Failed',
          message: `Transaction ${transaction.txHash} has failed on the Stellar network.`,
          metadata: {
            txHash: transaction.txHash,
            transactionId: transaction.id,
          },
        },
      );
    }
  }

  // ── Utility methods ─────────────────────────────────────────────────

  /**
   * Calculates exponential backoff delay with jitter.
   */
  calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.backoffDelay * Math.pow(2, attempt);
    // Add jitter (±25%)
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.min(baseDelay + jitter, this.config.maxBackoffDelay);
    return Math.max(0, Math.round(delay));
  }

  /**
   * Checks if an error is a 404 Not Found error from Horizon.
   */
  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as any;
      // Stellar SDK NotFoundError
      if (err.response && err.response.status === 404) {
        return true;
      }
      // Generic status check
      if (err.status === 404 || err.statusCode === 404) {
        return true;
      }
      // Error name check
      if (err.name === 'NotFoundError') {
        return true;
      }
    }
    return false;
  }

  /**
   * Sleeps for the specified number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns whether a batch sync is currently in progress.
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Gracefully shuts down the transaction sync queue.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down transaction status sync service...');
    await this.stopPeriodicSync();
    await this.queue.close();
    logger.info('Transaction status sync service shut down');
  }

  /**
   * Returns the underlying Bull queue (useful for testing).
   */
  getQueue(): Bull.Queue<TransactionSyncJobData> {
    return this.queue;
  }
}
