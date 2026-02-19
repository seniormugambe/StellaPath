/**
 * NotificationService — Handles notification delivery for all event types.
 *
 * Responsibilities:
 * - Persists in-app notifications via NotificationRepository
 * - Sends email notifications via the configured email transporter
 * - Enqueues notifications through the Bull queue for async processing
 * - Processes notification jobs from the queue (worker/processor)
 * - Checks user notification preferences before sending
 *
 * Validates: Requirements 3.3, 4.2, 4.4
 */

import Bull from 'bull';
import nodemailer from 'nodemailer';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  NotificationType,
  NotificationRecord,
  NotificationSettings,
  User,
} from '../types/database';
import {
  renderNotificationTemplate,
  TemplateData,
} from '../config/notificationTemplates';
import {
  sendEmail,
  SendEmailResult,
  EmailConfig,
  getEmailConfig,
} from '../config/email';
import {
  NotificationJobData,
  addNotificationJob,
  AddNotificationJobOptions,
} from '../config/queue';
import { logger } from '../utils/logger';

// ── Public result type ────────────────────────────────────────────────

export interface NotificationResult {
  success: boolean;
  notificationId?: string | undefined;
  emailResult?: SendEmailResult | undefined;
  error?: string | undefined;
}

// ── System alert payload ──────────────────────────────────────────────

export interface SystemAlert {
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ── Service configuration ─────────────────────────────────────────────

export interface NotificationServiceConfig {
  /** Email config override (defaults to env-based config) */
  emailConfig?: EmailConfig;
}

// ── Mapping from NotificationType to NotificationSettings key ─────────

const NOTIFICATION_TYPE_TO_SETTING: Record<NotificationType, keyof NotificationSettings> = {
  [NotificationType.INVOICE_RECEIVED]: 'invoiceUpdates',
  [NotificationType.INVOICE_APPROVED]: 'invoiceUpdates',
  [NotificationType.INVOICE_REJECTED]: 'invoiceUpdates',
  [NotificationType.TRANSACTION_CONFIRMED]: 'transactionConfirmations',
  [NotificationType.ESCROW_RELEASED]: 'escrowUpdates',
  [NotificationType.ESCROW_REFUNDED]: 'escrowUpdates',
  [NotificationType.SYSTEM_ALERT]: 'systemAlerts',
};

// ── NotificationService class ─────────────────────────────────────────

export class NotificationService {
  private emailConfig: EmailConfig;

  constructor(
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository,
    private emailTransporter: nodemailer.Transporter,
    private notificationQueue: Bull.Queue<NotificationJobData>,
    config?: NotificationServiceConfig
  ) {
    this.emailConfig = config?.emailConfig || getEmailConfig();
  }

  // ── Queue worker registration ───────────────────────────────────────

  /**
   * Registers the queue processor that handles notification jobs.
   * Call this once during application startup.
   */
  registerQueueProcessor(concurrency = 5): void {
    this.notificationQueue.process(concurrency, async (job) => {
      return this.processNotificationJob(job.data);
    });

    logger.info('Notification queue processor registered', { concurrency });
  }

  // ── Core processing logic ───────────────────────────────────────────

  /**
   * Processes a single notification job:
   * 1. Checks user preferences
   * 2. Persists in-app notification
   * 3. Sends email if the user has an email and preferences allow it
   */
  async processNotificationJob(data: NotificationJobData): Promise<NotificationResult> {
    try {
      // Look up user
      const user = await this.userRepository.findById(data.userId);
      if (!user) {
        logger.warn('User not found for notification', { userId: data.userId });
        return { success: false, error: 'User not found' };
      }

      // Check preferences
      if (!this.isNotificationEnabled(user, data.type)) {
        logger.info('Notification skipped due to user preferences', {
          userId: data.userId,
          type: data.type,
        });
        return { success: true };
      }

      // Render template
      const rendered = renderNotificationTemplate(data.type, data.templateData);

      // Persist in-app notification
      const notifCreateData: any = {
        userId: data.userId,
        type: data.type,
        title: rendered.title,
        message: rendered.message,
        metadata: (data.metadata as Record<string, any>) || {},
      };
      if (data.actionUrl) {
        notifCreateData.actionUrl = data.actionUrl;
      }
      const notification = await this.notificationRepository.create(notifCreateData);

      // Send email if applicable
      let emailResult: SendEmailResult | undefined;
      const recipientEmail = data.email || user.email;

      if (recipientEmail && this.isEmailEnabled(user)) {
        emailResult = await sendEmail(
          this.emailTransporter,
          {
            to: recipientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          },
          this.emailConfig
        );
      }

      logger.info('Notification processed', {
        notificationId: notification.id,
        type: data.type,
        userId: data.userId,
        emailSent: emailResult?.success ?? false,
      });

      const result: NotificationResult = {
        success: true,
        notificationId: notification.id,
      };
      if (emailResult) {
        result.emailResult = emailResult;
      }
      return result;
    } catch (error) {
      logger.error('Error processing notification job', {
        userId: data.userId,
        type: data.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Public notification methods (enqueue) ───────────────────────────

  /**
   * Sends an invoice-received notification to the client.
   */
  async sendInvoiceToClient(
    userId: string,
    clientEmail: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId,
      type: NotificationType.INVOICE_RECEIVED,
      email: clientEmail,
      templateData,
    };
    if (templateData.approvalUrl) {
      jobData.actionUrl = templateData.approvalUrl;
    }
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Notifies the invoice creator that their invoice was approved.
   */
  async notifyInvoiceApproval(
    creatorId: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId: creatorId,
      type: NotificationType.INVOICE_APPROVED,
      templateData,
    };
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Notifies the invoice creator that their invoice was rejected.
   */
  async notifyInvoiceRejection(
    creatorId: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId: creatorId,
      type: NotificationType.INVOICE_REJECTED,
      templateData,
    };
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Notifies a user that their transaction has been confirmed.
   */
  async notifyTransactionComplete(
    userId: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId,
      type: NotificationType.TRANSACTION_CONFIRMED,
      templateData,
    };
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Notifies a user that escrow funds have been released.
   */
  async notifyEscrowRelease(
    userId: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId,
      type: NotificationType.ESCROW_RELEASED,
      templateData,
    };
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Notifies a user that escrow funds have been refunded.
   */
  async notifyEscrowRefund(
    userId: string,
    templateData: TemplateData,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId,
      type: NotificationType.ESCROW_REFUNDED,
      templateData,
    };
    if (metadata) {
      jobData.metadata = metadata;
    }
    return this.enqueueNotification(jobData);
  }

  /**
   * Sends a system alert notification to a user.
   */
  async sendSystemAlert(
    userId: string,
    alert: SystemAlert
  ): Promise<NotificationResult> {
    const jobData: NotificationJobData = {
      userId,
      type: NotificationType.SYSTEM_ALERT,
      templateData: {
        alertTitle: alert.title,
        alertMessage: alert.message,
      },
    };
    if (alert.metadata) {
      jobData.metadata = alert.metadata;
    }
    return this.enqueueNotification(jobData);
  }

  // ── Read helpers (delegate to repository) ───────────────────────────

  /**
   * Returns notifications for a user.
   */
  async getNotifications(userId: string, page = 1, limit = 20) {
    return this.notificationRepository.findByUserId(userId, { page, limit });
  }

  /**
   * Returns unread notifications for a user.
   */
  async getUnreadNotifications(userId: string): Promise<NotificationRecord[]> {
    return this.notificationRepository.findUnreadByUserId(userId);
  }

  /**
   * Returns the count of unread notifications.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string): Promise<NotificationRecord> {
    return this.notificationRepository.markAsRead(notificationId);
  }

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.notificationRepository.markAllAsRead(userId);
  }

  // ── Preference helpers ──────────────────────────────────────────────

  /**
   * Checks whether a specific notification type is enabled for the user.
   */
  isNotificationEnabled(user: User, type: NotificationType): boolean {
    const settingKey = NOTIFICATION_TYPE_TO_SETTING[type];
    if (!settingKey) return true; // unknown type → allow
    return user.notificationSettings?.[settingKey] ?? true;
  }

  /**
   * Checks whether the user has email notifications enabled.
   */
  isEmailEnabled(user: User): boolean {
    return user.preferences?.emailNotifications ?? true;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Enqueues a notification job on the Bull queue.
   * Returns immediately with a result indicating the job was queued.
   */
  private async enqueueNotification(
    data: NotificationJobData,
    options?: AddNotificationJobOptions
  ): Promise<NotificationResult> {
    try {
      const job = await addNotificationJob(this.notificationQueue, data, options);

      logger.info('Notification enqueued', {
        jobId: job.id,
        type: data.type,
        userId: data.userId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to enqueue notification', {
        type: data.type,
        userId: data.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enqueue notification',
      };
    }
  }
}
