/**
 * Unit tests for NotificationService (Task 6.2)
 *
 * Tests notification delivery, preference handling, queue processing,
 * and all notification type methods.
 *
 * Validates: Requirements 3.3, 4.2, 4.4
 */

import { NotificationType } from '../types/database';
import type { User, NotificationRecord } from '../types/database';
import { NotificationService } from '../services/NotificationService';

// ── Mock factories ────────────────────────────────────────────────────

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      currency: 'XLM',
      timezone: 'UTC',
      language: 'en',
      emailNotifications: true,
      pushNotifications: true,
    },
    notificationSettings: {
      invoiceUpdates: true,
      transactionConfirmations: true,
      escrowUpdates: true,
      systemAlerts: true,
    },
    ...overrides,
  };
}

function createMockNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: NotificationType.INVOICE_RECEIVED,
    title: 'Test Notification',
    message: 'Test message',
    read: false,
    createdAt: new Date(),
    actionUrl: null,
    metadata: {},
    ...overrides,
  };
}

// ── Mock dependencies ─────────────────────────────────────────────────

function createMockNotificationRepository() {
  return {
    create: jest.fn().mockResolvedValue(createMockNotification()),
    findById: jest.fn().mockResolvedValue(createMockNotification()),
    findByUserId: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } }),
    findUnreadByUserId: jest.fn().mockResolvedValue([]),
    markAsRead: jest.fn().mockResolvedValue(createMockNotification({ read: true })),
    markAllAsRead: jest.fn().mockResolvedValue(3),
    getUnreadCount: jest.fn().mockResolvedValue(5),
    findByType: jest.fn(),
    markAsUnread: jest.fn(),
    deleteOldNotifications: jest.fn(),
    getNotificationStats: jest.fn(),
    delete: jest.fn(),
    deleteByUserId: jest.fn(),
    createBulk: jest.fn(),
  };
}

function createMockUserRepository() {
  return {
    findById: jest.fn().mockResolvedValue(createMockUser()),
    findByWalletAddress: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
    getUserProfile: jest.fn(),
  };
}

function createMockTransporter() {
  return {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-001' }),
  } as any;
}

function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;
  let mockNotifRepo: ReturnType<typeof createMockNotificationRepository>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockTransporter: ReturnType<typeof createMockTransporter>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  const emailConfig = {
    provider: 'smtp' as const,
    from: 'test@stellar-dapp.com',
    fromName: 'Stellar DApp',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifRepo = createMockNotificationRepository();
    mockUserRepo = createMockUserRepository();
    mockTransporter = createMockTransporter();
    mockQueue = createMockQueue();

    service = new NotificationService(
      mockNotifRepo as any,
      mockUserRepo as any,
      mockTransporter,
      mockQueue,
      { emailConfig }
    );
  });

  // ── registerQueueProcessor ──────────────────────────────────────────

  describe('registerQueueProcessor', () => {
    it('should register a processor on the queue', () => {
      service.registerQueueProcessor(3);
      expect(mockQueue.process).toHaveBeenCalledWith(3, expect.any(Function));
    });

    it('should use default concurrency of 5', () => {
      service.registerQueueProcessor();
      expect(mockQueue.process).toHaveBeenCalledWith(5, expect.any(Function));
    });
  });

  // ── processNotificationJob ──────────────────────────────────────────

  describe('processNotificationJob', () => {
    const jobData = {
      userId: 'user-1',
      type: NotificationType.INVOICE_RECEIVED,
      email: 'client@example.com',
      templateData: {
        recipientName: 'Alice',
        senderName: 'Bob',
        amount: '100',
        currency: 'XLM',
        invoiceId: 'INV-001',
        invoiceDescription: 'Services',
        approvalUrl: 'https://app.example.com/approve/token',
        dueDate: '2025-12-31',
      },
      metadata: { invoiceId: 'INV-001' },
    };

    it('should persist an in-app notification and send email', async () => {
      const result = await service.processNotificationJob(jobData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-1');
      expect(mockNotifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.INVOICE_RECEIVED,
        })
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
        })
      );
      expect(result.emailResult).toBeDefined();
      expect(result.emailResult!.success).toBe(true);
    });

    it('should use user email when job email is not provided', async () => {
      const { email: _removed, ...rest } = jobData;
      const dataWithoutEmail = { ...rest };
      await service.processNotificationJob(dataWithoutEmail);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
        })
      );
    });

    it('should skip email when user has no email and job has no email', async () => {
      const userWithoutEmail = createMockUser();
      delete (userWithoutEmail as any).email;
      mockUserRepo.findById.mockResolvedValue(userWithoutEmail);
      const { email: _removed, ...rest } = jobData;
      const dataWithoutEmail = { ...rest };

      const result = await service.processNotificationJob(dataWithoutEmail);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(result.emailResult).toBeUndefined();
    });

    it('should return error when user is not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const result = await service.processNotificationJob(jobData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(mockNotifRepo.create).not.toHaveBeenCalled();
    });

    it('should skip notification when user preferences disable the type', async () => {
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({
          notificationSettings: {
            invoiceUpdates: false,
            transactionConfirmations: true,
            escrowUpdates: true,
            systemAlerts: true,
          },
        })
      );

      const result = await service.processNotificationJob(jobData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeUndefined();
      expect(mockNotifRepo.create).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should skip email when user has emailNotifications disabled', async () => {
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({
          preferences: {
            currency: 'XLM',
            timezone: 'UTC',
            language: 'en',
            emailNotifications: false,
            pushNotifications: true,
          },
        })
      );

      const result = await service.processNotificationJob(jobData);

      expect(result.success).toBe(true);
      // In-app notification should still be created
      expect(mockNotifRepo.create).toHaveBeenCalled();
      // But email should not be sent
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      mockNotifRepo.create.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.processNotificationJob(jobData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection failed');
    });

    it('should still succeed when email sending fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.processNotificationJob(jobData);

      // The notification is persisted, but email fails
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-1');
      expect(result.emailResult).toBeDefined();
      expect(result.emailResult!.success).toBe(false);
    });
  });

  // ── Notification type methods (enqueue) ─────────────────────────────

  describe('sendInvoiceToClient', () => {
    it('should enqueue an INVOICE_RECEIVED notification', async () => {
      const result = await service.sendInvoiceToClient(
        'user-1',
        'client@example.com',
        { recipientName: 'Client', amount: '50', currency: 'XLM', invoiceId: 'INV-002', approvalUrl: 'https://app.example.com/approve/t1' },
        { invoiceId: 'INV-002' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.INVOICE_RECEIVED,
          email: 'client@example.com',
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyInvoiceApproval', () => {
    it('should enqueue an INVOICE_APPROVED notification', async () => {
      const result = await service.notifyInvoiceApproval(
        'creator-1',
        { recipientName: 'Creator', amount: '100', currency: 'XLM', invoiceId: 'INV-003' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'creator-1',
          type: NotificationType.INVOICE_APPROVED,
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyInvoiceRejection', () => {
    it('should enqueue an INVOICE_REJECTED notification', async () => {
      const result = await service.notifyInvoiceRejection(
        'creator-1',
        { recipientName: 'Creator', invoiceId: 'INV-004', reason: 'Too expensive' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'creator-1',
          type: NotificationType.INVOICE_REJECTED,
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyTransactionComplete', () => {
    it('should enqueue a TRANSACTION_CONFIRMED notification', async () => {
      const result = await service.notifyTransactionComplete(
        'user-1',
        { recipientName: 'Alice', amount: '500', currency: 'XLM', transactionHash: 'tx_abc123' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.TRANSACTION_CONFIRMED,
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyEscrowRelease', () => {
    it('should enqueue an ESCROW_RELEASED notification', async () => {
      const result = await service.notifyEscrowRelease(
        'user-1',
        { recipientName: 'Alice', amount: '200', currency: 'XLM', escrowId: 'ESC-001', transactionHash: 'tx_rel' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.ESCROW_RELEASED,
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyEscrowRefund', () => {
    it('should enqueue an ESCROW_REFUNDED notification', async () => {
      const result = await service.notifyEscrowRefund(
        'user-1',
        { recipientName: 'Alice', amount: '200', currency: 'XLM', escrowId: 'ESC-002', reason: 'Timeout' }
      );

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.ESCROW_REFUNDED,
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendSystemAlert', () => {
    it('should enqueue a SYSTEM_ALERT notification', async () => {
      const result = await service.sendSystemAlert('user-1', {
        title: 'Maintenance',
        message: 'Scheduled downtime tonight.',
        metadata: { severity: 'info' },
      });

      expect(result.success).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.SYSTEM_ALERT,
          templateData: {
            alertTitle: 'Maintenance',
            alertMessage: 'Scheduled downtime tonight.',
          },
        }),
        expect.any(Object)
      );
    });
  });

  // ── Enqueue error handling ──────────────────────────────────────────

  describe('enqueue error handling', () => {
    it('should return error when queue add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.sendSystemAlert('user-1', {
        title: 'Test',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis unavailable');
    });
  });

  // ── Read helpers ────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('should delegate to repository with pagination', async () => {
      await service.getNotifications('user-1', 2, 10);
      expect(mockNotifRepo.findByUserId).toHaveBeenCalledWith('user-1', { page: 2, limit: 10 });
    });

    it('should use default pagination', async () => {
      await service.getNotifications('user-1');
      expect(mockNotifRepo.findByUserId).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 });
    });
  });

  describe('getUnreadNotifications', () => {
    it('should delegate to repository', async () => {
      await service.getUnreadNotifications('user-1');
      expect(mockNotifRepo.findUnreadByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count from repository', async () => {
      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(5);
      expect(mockNotifRepo.getUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('should delegate to repository', async () => {
      const result = await service.markAsRead('notif-1');
      expect(result.read).toBe(true);
      expect(mockNotifRepo.markAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  describe('markAllAsRead', () => {
    it('should delegate to repository and return count', async () => {
      const count = await service.markAllAsRead('user-1');
      expect(count).toBe(3);
      expect(mockNotifRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  // ── Preference helpers ──────────────────────────────────────────────

  describe('isNotificationEnabled', () => {
    it('should return true when the notification type is enabled', () => {
      const user = createMockUser();
      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_RECEIVED)).toBe(true);
      expect(service.isNotificationEnabled(user, NotificationType.TRANSACTION_CONFIRMED)).toBe(true);
      expect(service.isNotificationEnabled(user, NotificationType.ESCROW_RELEASED)).toBe(true);
      expect(service.isNotificationEnabled(user, NotificationType.SYSTEM_ALERT)).toBe(true);
    });

    it('should return false when the notification type is disabled', () => {
      const user = createMockUser({
        notificationSettings: {
          invoiceUpdates: false,
          transactionConfirmations: false,
          escrowUpdates: false,
          systemAlerts: false,
        },
      });

      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_RECEIVED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_APPROVED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_REJECTED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.TRANSACTION_CONFIRMED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.ESCROW_RELEASED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.ESCROW_REFUNDED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.SYSTEM_ALERT)).toBe(false);
    });

    it('should map invoice types to invoiceUpdates setting', () => {
      const user = createMockUser({
        notificationSettings: {
          invoiceUpdates: false,
          transactionConfirmations: true,
          escrowUpdates: true,
          systemAlerts: true,
        },
      });

      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_RECEIVED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_APPROVED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.INVOICE_REJECTED)).toBe(false);
    });

    it('should map escrow types to escrowUpdates setting', () => {
      const user = createMockUser({
        notificationSettings: {
          invoiceUpdates: true,
          transactionConfirmations: true,
          escrowUpdates: false,
          systemAlerts: true,
        },
      });

      expect(service.isNotificationEnabled(user, NotificationType.ESCROW_RELEASED)).toBe(false);
      expect(service.isNotificationEnabled(user, NotificationType.ESCROW_REFUNDED)).toBe(false);
    });
  });

  describe('isEmailEnabled', () => {
    it('should return true when emailNotifications is enabled', () => {
      const user = createMockUser();
      expect(service.isEmailEnabled(user)).toBe(true);
    });

    it('should return false when emailNotifications is disabled', () => {
      const user = createMockUser({
        preferences: {
          currency: 'XLM',
          timezone: 'UTC',
          language: 'en',
          emailNotifications: false,
          pushNotifications: true,
        },
      });
      expect(service.isEmailEnabled(user)).toBe(false);
    });
  });
});
