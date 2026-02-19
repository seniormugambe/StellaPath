/**
 * Configuration module exports
 */

export {
  EmailConfig,
  getEmailConfig,
  createEmailTransporter,
  sendEmail,
  SendEmailOptions,
  SendEmailResult,
} from './email';

export {
  NotificationTemplate,
  TemplateData,
  interpolateTemplate,
  getNotificationTemplate,
  getAllNotificationTemplates,
  renderNotificationTemplate,
} from './notificationTemplates';

export {
  NotificationJobData,
  QueueConfig,
  NOTIFICATION_QUEUE_NAME,
  getQueueConfig,
  parseRedisUrl,
  createNotificationQueue,
  addNotificationJob,
  closeNotificationQueue,
  AddNotificationJobOptions,
} from './queue';
