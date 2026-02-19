/**
 * Unit tests for notification infrastructure (Task 6.1)
 * 
 * Tests email configuration, notification templates, and queue setup.
 * Validates: Requirements 3.3, 4.2, 4.4
 */

import { NotificationType } from '../types/database';
import {
  interpolateTemplate,
  getNotificationTemplate,
  getAllNotificationTemplates,
  renderNotificationTemplate,
  TemplateData,
} from '../config/notificationTemplates';
import {
  getEmailConfig,
  createEmailTransporter,
  sendEmail,
  EmailConfig,
} from '../config/email';
import {
  getQueueConfig,
  parseRedisUrl,
  NOTIFICATION_QUEUE_NAME,
  NotificationJobData,
} from '../config/queue';

// ── Template Tests ────────────────────────────────────────────────────

describe('Notification Templates', () => {
  describe('interpolateTemplate', () => {
    it('should replace placeholders with provided data', () => {
      const data: TemplateData = { recipientName: 'Alice', amount: '100' };
      const result = interpolateTemplate('Hello {{recipientName}}, your amount is {{amount}}', data);
      expect(result).toBe('Hello Alice, your amount is 100');
    });

    it('should replace missing placeholders with empty string', () => {
      const template = 'Hello {{recipientName}}, reason: {{reason}}';
      const data: TemplateData = { recipientName: 'Bob' };
      const result = interpolateTemplate(template, data);
      expect(result).toBe('Hello Bob, reason: ');
    });

    it('should handle template with no placeholders', () => {
      const template = 'No placeholders here';
      const result = interpolateTemplate(template, {});
      expect(result).toBe('No placeholders here');
    });

    it('should handle empty template', () => {
      const result = interpolateTemplate('', { recipientName: 'Alice' });
      expect(result).toBe('');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      const template = '{{recipientName}} sent to {{recipientName}}';
      const result = interpolateTemplate(template, { recipientName: 'Alice' });
      expect(result).toBe('Alice sent to Alice');
    });
  });

  describe('getNotificationTemplate', () => {
    it('should return a template for INVOICE_RECEIVED', () => {
      const template = getNotificationTemplate(NotificationType.INVOICE_RECEIVED);
      expect(template.type).toBe(NotificationType.INVOICE_RECEIVED);
      expect(template.subject).toBeDefined();
      expect(template.title).toBeDefined();
      expect(template.html).toBeDefined();
      expect(template.text).toBeDefined();
      expect(template.message).toBeDefined();
    });

    it('should return a template for INVOICE_APPROVED', () => {
      const template = getNotificationTemplate(NotificationType.INVOICE_APPROVED);
      expect(template.type).toBe(NotificationType.INVOICE_APPROVED);
      expect(template.subject).toContain('Approved');
    });

    it('should return a template for INVOICE_REJECTED', () => {
      const template = getNotificationTemplate(NotificationType.INVOICE_REJECTED);
      expect(template.type).toBe(NotificationType.INVOICE_REJECTED);
      expect(template.subject).toContain('Rejected');
    });

    it('should return a template for TRANSACTION_CONFIRMED', () => {
      const template = getNotificationTemplate(NotificationType.TRANSACTION_CONFIRMED);
      expect(template.type).toBe(NotificationType.TRANSACTION_CONFIRMED);
      expect(template.subject).toContain('Confirmed');
    });

    it('should return a template for ESCROW_RELEASED', () => {
      const template = getNotificationTemplate(NotificationType.ESCROW_RELEASED);
      expect(template.type).toBe(NotificationType.ESCROW_RELEASED);
      expect(template.subject).toContain('Released');
    });

    it('should return a template for ESCROW_REFUNDED', () => {
      const template = getNotificationTemplate(NotificationType.ESCROW_REFUNDED);
      expect(template.type).toBe(NotificationType.ESCROW_REFUNDED);
      expect(template.subject).toContain('Refunded');
    });

    it('should return a template for SYSTEM_ALERT', () => {
      const template = getNotificationTemplate(NotificationType.SYSTEM_ALERT);
      expect(template.type).toBe(NotificationType.SYSTEM_ALERT);
      expect(template.subject).toContain('Alert');
    });
  });

  describe('getAllNotificationTemplates', () => {
    it('should return templates for all notification types', () => {
      const templates = getAllNotificationTemplates();
      const allTypes = Object.values(NotificationType);
      expect(templates).toHaveLength(allTypes.length);

      for (const type of allTypes) {
        const found = templates.find(t => t.type === type);
        expect(found).toBeDefined();
      }
    });

    it('should return templates with all required fields', () => {
      const templates = getAllNotificationTemplates();
      for (const template of templates) {
        expect(template.type).toBeDefined();
        expect(template.subject).toBeTruthy();
        expect(template.title).toBeTruthy();
        expect(template.html).toBeTruthy();
        expect(template.text).toBeTruthy();
        expect(template.message).toBeTruthy();
      }
    });
  });

  describe('renderNotificationTemplate', () => {
    it('should render INVOICE_RECEIVED template with data', () => {
      const data: TemplateData = {
        recipientName: 'Alice',
        senderName: 'Bob',
        amount: '500',
        currency: 'XLM',
        invoiceId: 'INV-001',
        invoiceDescription: 'Web development services',
        approvalUrl: 'https://app.example.com/approve/token123',
        dueDate: '2024-12-31',
      };

      const rendered = renderNotificationTemplate(NotificationType.INVOICE_RECEIVED, data);

      expect(rendered.subject).toBe('New Invoice Received - 500 XLM');
      expect(rendered.html).toContain('Alice');
      expect(rendered.html).toContain('Bob');
      expect(rendered.html).toContain('500');
      expect(rendered.html).toContain('XLM');
      expect(rendered.html).toContain('INV-001');
      expect(rendered.html).toContain('Web development services');
      expect(rendered.html).toContain('https://app.example.com/approve/token123');
      expect(rendered.text).toContain('Alice');
      expect(rendered.text).toContain('500');
      expect(rendered.message).toContain('500');
      expect(rendered.message).toContain('XLM');
    });

    it('should render TRANSACTION_CONFIRMED template with data', () => {
      const data: TemplateData = {
        recipientName: 'Charlie',
        amount: '1000',
        currency: 'XLM',
        transactionHash: 'abc123def456',
      };

      const rendered = renderNotificationTemplate(NotificationType.TRANSACTION_CONFIRMED, data);

      expect(rendered.subject).toContain('abc123def456');
      expect(rendered.html).toContain('Charlie');
      expect(rendered.html).toContain('1000');
      expect(rendered.html).toContain('abc123def456');
    });

    it('should render ESCROW_RELEASED template with data', () => {
      const data: TemplateData = {
        recipientName: 'Dave',
        amount: '250',
        currency: 'XLM',
        escrowId: 'ESC-001',
        transactionHash: 'tx_hash_123',
      };

      const rendered = renderNotificationTemplate(NotificationType.ESCROW_RELEASED, data);

      expect(rendered.subject).toContain('ESC-001');
      expect(rendered.html).toContain('Dave');
      expect(rendered.html).toContain('250');
      expect(rendered.html).toContain('ESC-001');
    });

    it('should render SYSTEM_ALERT template with data', () => {
      const data: TemplateData = {
        recipientName: 'Admin',
        alertTitle: 'Network Maintenance',
        alertMessage: 'Scheduled downtime at midnight.',
      };

      const rendered = renderNotificationTemplate(NotificationType.SYSTEM_ALERT, data);

      expect(rendered.subject).toContain('Network Maintenance');
      expect(rendered.html).toContain('Network Maintenance');
      expect(rendered.html).toContain('Scheduled downtime at midnight.');
    });

    it('should handle missing template data gracefully', () => {
      const rendered = renderNotificationTemplate(NotificationType.INVOICE_RECEIVED, {});

      // Should not throw, placeholders replaced with empty strings
      expect(rendered.subject).toBe('New Invoice Received -  ');
      expect(rendered.html).toBeDefined();
      expect(rendered.text).toBeDefined();
    });
  });
});

// ── Email Config Tests ────────────────────────────────────────────────

describe('Email Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getEmailConfig', () => {
    it('should return default config when no env vars are set', () => {
      delete process.env['EMAIL_PROVIDER'];
      delete process.env['EMAIL_FROM'];
      delete process.env['EMAIL_FROM_NAME'];

      const config = getEmailConfig();

      expect(config.provider).toBe('smtp');
      expect(config.from).toBe('noreply@stellar-dapp.com');
      expect(config.fromName).toBe('Stellar DApp');
      expect(config.smtpHost).toBe('localhost');
      expect(config.smtpPort).toBe(587);
    });

    it('should use env vars when set', () => {
      process.env['EMAIL_PROVIDER'] = 'sendgrid';
      process.env['EMAIL_FROM'] = 'test@example.com';
      process.env['EMAIL_FROM_NAME'] = 'Test App';
      process.env['SENDGRID_API_KEY'] = 'SG.test-key';

      const config = getEmailConfig();

      expect(config.provider).toBe('sendgrid');
      expect(config.from).toBe('test@example.com');
      expect(config.fromName).toBe('Test App');
      expect(config.sendgridApiKey).toBe('SG.test-key');
    });

    it('should parse SMTP port correctly', () => {
      process.env['SMTP_PORT'] = '465';
      process.env['SMTP_SECURE'] = 'true';

      const config = getEmailConfig();

      expect(config.smtpPort).toBe(465);
      expect(config.smtpSecure).toBe(true);
    });
  });

  describe('createEmailTransporter', () => {
    it('should create a SendGrid transporter when configured', () => {
      const config: EmailConfig = {
        provider: 'sendgrid',
        from: 'test@example.com',
        fromName: 'Test',
        sendgridApiKey: 'SG.test-key',
      };

      const transporter = createEmailTransporter(config);
      expect(transporter).toBeDefined();
      expect(transporter.transporter).toBeDefined();
    });

    it('should create an SMTP transporter when configured', () => {
      const config: EmailConfig = {
        provider: 'smtp',
        from: 'test@example.com',
        fromName: 'Test',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'user',
        smtpPass: 'pass',
      };

      const transporter = createEmailTransporter(config);
      expect(transporter).toBeDefined();
    });

    it('should create SMTP transporter without auth when no user provided', () => {
      const config: EmailConfig = {
        provider: 'smtp',
        from: 'test@example.com',
        fromName: 'Test',
        smtpHost: 'localhost',
        smtpPort: 25,
      };

      const transporter = createEmailTransporter(config);
      expect(transporter).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('should return success when email is sent', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
      } as any;

      const config: EmailConfig = {
        provider: 'smtp',
        from: 'test@example.com',
        fromName: 'Test',
      };

      const result = await sendEmail(
        mockTransporter,
        {
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
        },
        config
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Test" <test@example.com>',
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
        })
      );
    });

    it('should return error when email sending fails', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection failed')),
      } as any;

      const config: EmailConfig = {
        provider: 'smtp',
        from: 'test@example.com',
        fromName: 'Test',
      };

      const result = await sendEmail(
        mockTransporter,
        {
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>',
        },
        config
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });
  });
});

// ── Queue Config Tests ────────────────────────────────────────────────

describe('Queue Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getQueueConfig', () => {
    it('should return default config when no env vars are set', () => {
      delete process.env['REDIS_URL'];
      delete process.env['QUEUE_DEFAULT_ATTEMPTS'];
      delete process.env['QUEUE_BACKOFF_DELAY'];
      delete process.env['QUEUE_CONCURRENCY'];

      const config = getQueueConfig();

      expect(config.redisUrl).toBe('redis://localhost:6379');
      expect(config.defaultAttempts).toBe(3);
      expect(config.backoffDelay).toBe(5000);
      expect(config.concurrency).toBe(5);
    });

    it('should use env vars when set', () => {
      process.env['REDIS_URL'] = 'redis://custom-host:6380/2';
      process.env['QUEUE_DEFAULT_ATTEMPTS'] = '5';
      process.env['QUEUE_BACKOFF_DELAY'] = '10000';
      process.env['QUEUE_CONCURRENCY'] = '10';

      const config = getQueueConfig();

      expect(config.redisUrl).toBe('redis://custom-host:6380/2');
      expect(config.defaultAttempts).toBe(5);
      expect(config.backoffDelay).toBe(10000);
      expect(config.concurrency).toBe(10);
    });
  });

  describe('parseRedisUrl', () => {
    it('should parse a simple Redis URL', () => {
      const result = parseRedisUrl('redis://localhost:6379');
      expect(result).toEqual({ host: 'localhost', port: 6379, db: 0 });
    });

    it('should parse a Redis URL with password', () => {
      const result = parseRedisUrl('redis://:mypassword@redis-host:6380');
      expect(result).toEqual({
        host: 'redis-host',
        port: 6380,
        password: 'mypassword',
        db: 0,
      });
    });

    it('should parse a Redis URL with database number', () => {
      const result = parseRedisUrl('redis://localhost:6379/3');
      expect(result).toEqual({ host: 'localhost', port: 6379, db: 3 });
    });

    it('should parse a Redis URL with password and database', () => {
      const result = parseRedisUrl('redis://:secret@host:6380/5');
      expect(result).toEqual({
        host: 'host',
        port: 6380,
        password: 'secret',
        db: 5,
      });
    });

    it('should return defaults for invalid URL', () => {
      const result = parseRedisUrl('not-a-url');
      expect(result).toEqual({ host: 'localhost', port: 6379 });
    });
  });

  describe('NOTIFICATION_QUEUE_NAME', () => {
    it('should be defined', () => {
      expect(NOTIFICATION_QUEUE_NAME).toBe('notification-queue');
    });
  });

  describe('NotificationJobData type', () => {
    it('should accept valid job data', () => {
      const jobData: NotificationJobData = {
        userId: 'user-123',
        type: NotificationType.INVOICE_RECEIVED,
        email: 'test@example.com',
        templateData: {
          recipientName: 'Alice',
          amount: '100',
          currency: 'XLM',
        },
        metadata: { invoiceId: 'inv-001' },
      };

      expect(jobData.userId).toBe('user-123');
      expect(jobData.type).toBe(NotificationType.INVOICE_RECEIVED);
      expect(jobData.email).toBe('test@example.com');
      expect(jobData.templateData.recipientName).toBe('Alice');
    });

    it('should accept job data without optional fields', () => {
      const jobData: NotificationJobData = {
        userId: 'user-456',
        type: NotificationType.SYSTEM_ALERT,
        templateData: {
          alertTitle: 'Test Alert',
          alertMessage: 'This is a test',
        },
      };

      expect(jobData.userId).toBe('user-456');
      expect(jobData.email).toBeUndefined();
      expect(jobData.metadata).toBeUndefined();
    });
  });
});
