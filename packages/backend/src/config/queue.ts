/**
 * Bull Queue configuration for notification processing.
 * 
 * Uses Redis as the backing store for reliable job processing
 * with retry logic, delayed jobs, and job prioritization.
 * 
 * Validates: Requirements 3.3, 4.2, 4.4
 */

import Bull from 'bull';
import { logger } from '../utils/logger';
import { NotificationType } from '../types/database';
import { TemplateData } from './notificationTemplates';

// ── Queue job data types ──────────────────────────────────────────────

export interface NotificationJobData {
  /** Unique notification ID (for idempotency) */
  notificationId?: string;
  /** Target user ID for in-app notification */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Email address to send to (if email notification) */
  email?: string;
  /** Template interpolation data */
  templateData: TemplateData;
  /** Optional action URL for in-app notification */
  actionUrl?: string;
  /** Optional metadata to store with the notification record */
  metadata?: Record<string, unknown>;
}

export interface QueueConfig {
  redisUrl: string;
  /** Default number of retry attempts for failed jobs */
  defaultAttempts: number;
  /** Backoff delay in ms between retries */
  backoffDelay: number;
  /** Maximum number of concurrent workers */
  concurrency: number;
}

// ── Queue names ───────────────────────────────────────────────────────

export const NOTIFICATION_QUEUE_NAME = 'notification-queue';

// ── Configuration ─────────────────────────────────────────────────────

export function getQueueConfig(): QueueConfig {
  return {
    redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379',
    defaultAttempts: parseInt(process.env['QUEUE_DEFAULT_ATTEMPTS'] || '3', 10),
    backoffDelay: parseInt(process.env['QUEUE_BACKOFF_DELAY'] || '5000', 10),
    concurrency: parseInt(process.env['QUEUE_CONCURRENCY'] || '5', 10),
  };
}

/**
 * Parses a Redis URL into Bull-compatible Redis options.
 */
export function parseRedisUrl(url: string): Bull.QueueOptions['redis'] {
  try {
    const parsed = new URL(url);
    const opts: { host: string; port: number; password?: string; db: number } = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    };
    if (parsed.password) {
      opts.password = parsed.password;
    }
    return opts;
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

// ── Queue factory ─────────────────────────────────────────────────────

/**
 * Creates and configures the notification Bull queue.
 */
export function createNotificationQueue(config?: QueueConfig): Bull.Queue<NotificationJobData> {
  const queueConfig = config || getQueueConfig();
  const redisOpts = parseRedisUrl(queueConfig.redisUrl);

  const queue = new Bull<NotificationJobData>(NOTIFICATION_QUEUE_NAME, {
    redis: redisOpts,
    defaultJobOptions: {
      attempts: queueConfig.defaultAttempts,
      backoff: {
        type: 'exponential',
        delay: queueConfig.backoffDelay,
      },
      removeOnComplete: 100, // keep last 100 completed jobs
      removeOnFail: 200,     // keep last 200 failed jobs
    },
  });

  // ── Queue event listeners ─────────────────────────────────────────

  queue.on('error', (error) => {
    logger.error('Notification queue error', { error: error.message });
  });

  queue.on('failed', (job, error) => {
    logger.warn('Notification job failed', {
      jobId: job.id,
      type: job.data.type,
      userId: job.data.userId,
      attempt: job.attemptsMade,
      error: error.message,
    });
  });

  queue.on('completed', (job) => {
    logger.info('Notification job completed', {
      jobId: job.id,
      type: job.data.type,
      userId: job.data.userId,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn('Notification job stalled', { jobId: job.id });
  });

  logger.info('Notification queue created', {
    name: NOTIFICATION_QUEUE_NAME,
    concurrency: queueConfig.concurrency,
    defaultAttempts: queueConfig.defaultAttempts,
  });

  return queue;
}

// ── Helper to add jobs ────────────────────────────────────────────────

export interface AddNotificationJobOptions {
  /** Job priority (lower = higher priority). Default: normal (10) */
  priority?: number;
  /** Delay in ms before the job is processed */
  delay?: number;
  /** Override the default number of attempts */
  attempts?: number;
}

/**
 * Adds a notification job to the queue.
 */
export async function addNotificationJob(
  queue: Bull.Queue<NotificationJobData>,
  data: NotificationJobData,
  options?: AddNotificationJobOptions
): Promise<Bull.Job<NotificationJobData>> {
  const jobOptions: Bull.JobOptions = {};

  if (options?.priority !== undefined) {
    jobOptions.priority = options.priority;
  }
  if (options?.delay !== undefined) {
    jobOptions.delay = options.delay;
  }
  if (options?.attempts !== undefined) {
    jobOptions.attempts = options.attempts;
  }

  // Use notificationId as job ID for idempotency if provided
  if (data.notificationId) {
    jobOptions.jobId = data.notificationId;
  }

  const job = await queue.add(data, jobOptions);

  logger.info('Notification job added to queue', {
    jobId: job.id,
    type: data.type,
    userId: data.userId,
    email: data.email,
    priority: options?.priority,
    delay: options?.delay,
  });

  return job;
}

/**
 * Gracefully shuts down the notification queue.
 */
export async function closeNotificationQueue(
  queue: Bull.Queue<NotificationJobData>
): Promise<void> {
  logger.info('Closing notification queue...');
  await queue.close();
  logger.info('Notification queue closed');
}
