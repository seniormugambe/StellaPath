/**
 * Unit tests for InvoiceExpirationService (Task 7.2)
 *
 * Tests automated invoice expiration checking, scheduled expiration,
 * batch processing, notification delivery, and cleanup of old data.
 *
 * Validates: Requirements 4.6
 */

import { InvoiceStatus } from '../types/database';
import type { InvoiceRecord } from '../types/database';
import { InvoiceExpirationService } from '../services/InvoiceExpirationService';

// ── Mock factories ────────────────────────────────────────────────────

function createMockInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'invoice-1',
    creatorId: 'user-1',
    clientEmail: 'client@example.com',
    amount: 500,
    description: 'Test invoice',
    status: InvoiceStatus.SENT,
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    dueDate: new Date(Date.now() - 3600000), // 1 hour ago (past due)
    approvedAt: null,
    executedAt: null,
    txHash: null,
    approvalToken: 'token-abc-123',
    metadata: {},
    ...overrides,
  } as InvoiceRecord;
}

function createMockInvoiceRepository() {
  return {
    findById: jest.fn().mockResolvedValue(createMockInvoice()),
    findExpiredInvoices: jest.fn().mockResolvedValue([]),
    findByCreatorId: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } }),
    findByApprovalToken: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    updateStatus: jest.fn().mockImplementation(async (id: string, data: any) => {
      return createMockInvoice({ id, status: data.status, metadata: data.metadata || {} });
    }),
    markExpiredInvoices: jest.fn().mockResolvedValue(0),
    getPublicInvoice: jest.fn().mockResolvedValue(null),
    getInvoiceStats: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockNotificationService() {
  return {
    notifyInvoiceRejection: jest.fn().mockResolvedValue({ success: true }),
    notifyInvoiceApproval: jest.fn().mockResolvedValue({ success: true }),
    sendInvoiceToClient: jest.fn().mockResolvedValue({ success: true }),
    notifyTransactionComplete: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRelease: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRefund: jest.fn().mockResolvedValue({ success: true }),
    sendSystemAlert: jest.fn().mockResolvedValue({ success: true }),
    processNotificationJob: jest.fn(),
    registerQueueProcessor: jest.fn(),
    getNotifications: jest.fn(),
    getUnreadNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    isNotificationEnabled: jest.fn(),
    isEmailEnabled: jest.fn(),
  };
}

function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('InvoiceExpirationService', () => {
  let service: InvoiceExpirationService;
  let mockInvoiceRepo: ReturnType<typeof createMockInvoiceRepository>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoiceRepo = createMockInvoiceRepository();
    mockNotificationService = createMockNotificationService();
    mockQueue = createMockQueue();

    service = new InvoiceExpirationService(
      mockInvoiceRepo as any,
      mockNotificationService as any,
      { defaultCheckInterval: 5000, concurrency: 2, cleanupAgeDays: 90 },
      mockQueue,
    );
  });

  // ── registerQueueProcessor ──────────────────────────────────────────

  describe('registerQueueProcessor', () => {
    it('should register a processor on the queue with configured concurrency', () => {
      service.registerQueueProcessor();
      expect(mockQueue.process).toHaveBeenCalledWith(2, expect.any(Function));
    });
  });

  // ── scheduleInvoiceExpiration ───────────────────────────────────────

  describe('scheduleInvoiceExpiration', () => {
    it('should add a delayed job to the queue for the invoice', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      await service.scheduleInvoiceExpiration('invoice-1', futureDate);

      expect(mockQueue.add).toHaveBeenCalledWith(
        { invoiceId: 'invoice-1', recurring: false },
        expect.objectContaining({
          jobId: 'invoice-expiration-invoice-1',
          delay: expect.any(Number),
        }),
      );

      // Delay should be approximately 60000ms (allow some tolerance)
      const addCall = mockQueue.add.mock.calls[0]!;
      const delay = addCall[1].delay;
      expect(delay).toBeGreaterThan(50000);
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('should use delay of 0 when expiration date is in the past', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await service.scheduleInvoiceExpiration('invoice-1', pastDate);

      const addCall = mockQueue.add.mock.calls[0]!;
      expect(addCall[1].delay).toBe(0);
    });

    it('should track the invoice in the scheduled set', async () => {
      await service.scheduleInvoiceExpiration('invoice-1', new Date(Date.now() + 60000));
      expect(service.getScheduledInvoices().has('invoice-1')).toBe(true);
    });
  });

  // ── cancelScheduledExpiration ───────────────────────────────────────

  describe('cancelScheduledExpiration', () => {
    it('should remove the job and untrack the invoice', async () => {
      const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
      mockQueue.getJob.mockResolvedValue(mockJob);

      // First schedule it
      await service.scheduleInvoiceExpiration('invoice-1', new Date(Date.now() + 60000));
      expect(service.getScheduledInvoices().has('invoice-1')).toBe(true);

      await service.cancelScheduledExpiration('invoice-1');

      expect(mockQueue.getJob).toHaveBeenCalledWith('invoice-expiration-invoice-1');
      expect(mockJob.remove).toHaveBeenCalled();
      expect(service.getScheduledInvoices().has('invoice-1')).toBe(false);
    });

    it('should handle case where job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await service.cancelScheduledExpiration('invoice-1');

      expect(mockQueue.getJob).toHaveBeenCalledWith('invoice-expiration-invoice-1');
      // Should not throw
    });
  });

  // ── processExpirationJob ────────────────────────────────────────────

  describe('processExpirationJob', () => {
    it('should expire an invoice that is past its due date and in SENT status', async () => {
      const invoice = createMockInvoice({
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 3600000), // 1 hour ago
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      const result = await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(result.status).toBe('expired');
      expect(result.invoiceId).toBe('invoice-1');
      expect(mockInvoiceRepo.updateStatus).toHaveBeenCalledWith('invoice-1', {
        status: InvoiceStatus.EXPIRED,
        metadata: expect.objectContaining({
          expiredAt: expect.any(String),
          expiredBy: 'system',
        }),
      });
    });

    it('should expire an invoice that is past its due date and in APPROVED status', async () => {
      const invoice = createMockInvoice({
        status: InvoiceStatus.APPROVED,
        dueDate: new Date(Date.now() - 3600000),
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      const result = await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(result.status).toBe('expired');
      expect(mockInvoiceRepo.updateStatus).toHaveBeenCalledWith('invoice-1', expect.objectContaining({
        status: InvoiceStatus.EXPIRED,
      }));
    });

    it('should send notification to invoice creator when invoice expires', async () => {
      const invoice = createMockInvoice({
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 3600000),
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(mockNotificationService.notifyInvoiceRejection).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          invoiceId: 'invoice-1',
          clientEmail: 'client@example.com',
          amount: '500',
          reason: expect.stringContaining('expired'),
        }),
        expect.objectContaining({ invoiceId: 'invoice-1' }),
      );
    });

    it('should return not_expired when invoice is not past due date', async () => {
      const invoice = createMockInvoice({
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() + 86400000), // 1 day from now
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      const result = await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(result.status).toBe('not_expired');
      expect(mockInvoiceRepo.updateStatus).not.toHaveBeenCalled();
      expect(mockNotificationService.notifyInvoiceRejection).not.toHaveBeenCalled();
    });

    it('should return already_expired when invoice is already expired', async () => {
      const invoice = createMockInvoice({
        status: InvoiceStatus.EXPIRED,
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      const result = await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(result.status).toBe('already_expired');
      expect(mockInvoiceRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should return not_expired for invoices in non-expirable statuses (DRAFT, EXECUTED, REJECTED)', async () => {
      for (const status of [InvoiceStatus.DRAFT, InvoiceStatus.EXECUTED, InvoiceStatus.REJECTED]) {
        mockInvoiceRepo.findById.mockResolvedValue(createMockInvoice({ status }));

        const result = await service.processExpirationJob({
          invoiceId: 'invoice-1',
          recurring: false,
        });

        expect(result.status).toBe('not_expired');
      }
    });

    it('should return error when invoice is not found', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(null);

      const result = await service.processExpirationJob({
        invoiceId: 'nonexistent',
        recurring: false,
      });

      expect(result.status).toBe('error');
      expect(result.error).toBe('Invoice not found');
    });

    it('should return error when repository throws', async () => {
      mockInvoiceRepo.findById.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(result.status).toBe('error');
      expect(result.error).toBe('DB connection failed');
    });

    it('should remove invoice from scheduled set after processing', async () => {
      // Schedule first
      await service.scheduleInvoiceExpiration('invoice-1', new Date(Date.now() + 60000));
      expect(service.getScheduledInvoices().has('invoice-1')).toBe(true);

      const invoice = createMockInvoice({
        status: InvoiceStatus.SENT,
        dueDate: new Date(Date.now() - 3600000),
      });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      await service.processExpirationJob({
        invoiceId: 'invoice-1',
        recurring: false,
      });

      expect(service.getScheduledInvoices().has('invoice-1')).toBe(false);
    });
  });

  // ── processExpiredInvoices (batch) ──────────────────────────────────

  describe('processExpiredInvoices', () => {
    it('should process all expired invoices found by the repository', async () => {
      const expiredInvoices = [
        createMockInvoice({ id: 'inv-1', status: InvoiceStatus.SENT, dueDate: new Date(Date.now() - 3600000) }),
        createMockInvoice({ id: 'inv-2', status: InvoiceStatus.APPROVED, dueDate: new Date(Date.now() - 7200000) }),
      ];
      mockInvoiceRepo.findExpiredInvoices.mockResolvedValue(expiredInvoices);
      mockInvoiceRepo.findById.mockImplementation(async (id: string) => {
        return expiredInvoices.find((inv) => inv.id === id) || null;
      });

      const results = await service.processExpiredInvoices();

      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe('expired');
      expect(results[1]!.status).toBe('expired');
      expect(mockInvoiceRepo.updateStatus).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.notifyInvoiceRejection).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no expired invoices exist', async () => {
      mockInvoiceRepo.findExpiredInvoices.mockResolvedValue([]);

      const results = await service.processExpiredInvoices();

      expect(results).toHaveLength(0);
    });

    it('should handle errors gracefully and return empty array', async () => {
      mockInvoiceRepo.findExpiredInvoices.mockRejectedValue(new Error('DB error'));

      const results = await service.processExpiredInvoices();

      expect(results).toHaveLength(0);
    });

    it('should handle mixed results (some already expired, some newly expired)', async () => {
      const invoices = [
        createMockInvoice({ id: 'inv-1', status: InvoiceStatus.SENT, dueDate: new Date(Date.now() - 3600000) }),
        createMockInvoice({ id: 'inv-2', status: InvoiceStatus.EXPIRED, dueDate: new Date(Date.now() - 7200000) }),
      ];
      mockInvoiceRepo.findExpiredInvoices.mockResolvedValue(invoices);
      mockInvoiceRepo.findById.mockImplementation(async (id: string) => {
        return invoices.find((inv) => inv.id === id) || null;
      });

      const results = await service.processExpiredInvoices();

      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe('expired');
      expect(results[1]!.status).toBe('already_expired');
    });
  });

  // ── cleanupOldInvoices ──────────────────────────────────────────────

  describe('cleanupOldInvoices', () => {
    it('should delete old invoices in terminal states', async () => {
      const oldInvoices = [
        createMockInvoice({ id: 'old-1', status: InvoiceStatus.EXPIRED }),
        createMockInvoice({ id: 'old-2', status: InvoiceStatus.EXPIRED }),
      ];
      mockInvoiceRepo.findByCreatorId.mockResolvedValue({
        data: oldInvoices,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      });

      const result = await service.cleanupOldInvoices(90);

      expect(result.deletedCount).toBeGreaterThan(0);
      expect(mockInvoiceRepo.delete).toHaveBeenCalled();
    });

    it('should use default cleanup age when not specified', async () => {
      mockInvoiceRepo.findByCreatorId.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });

      const result = await service.cleanupOldInvoices();

      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle delete errors gracefully and continue', async () => {
      const oldInvoices = [
        createMockInvoice({ id: 'old-1', status: InvoiceStatus.EXPIRED }),
      ];
      mockInvoiceRepo.findByCreatorId.mockResolvedValue({
        data: oldInvoices,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
      // First call fails, subsequent calls succeed
      mockInvoiceRepo.delete
        .mockRejectedValueOnce(new Error('FK constraint'))
        .mockResolvedValue(undefined);

      const result = await service.cleanupOldInvoices(90);

      // 3 terminal statuses × 1 invoice each = 3 total, 1 fails, 2 succeed
      expect(result.deletedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('FK constraint');
    });

    it('should handle repository find errors gracefully', async () => {
      mockInvoiceRepo.findByCreatorId.mockRejectedValue(new Error('DB error'));

      const result = await service.cleanupOldInvoices(90);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ── shutdown ────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should close the queue and clear scheduled invoices', async () => {
      await service.scheduleInvoiceExpiration('invoice-1', new Date(Date.now() + 60000));
      expect(service.getScheduledInvoices().size).toBe(1);

      await service.shutdown();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(service.getScheduledInvoices().size).toBe(0);
    });
  });

  // ── getQueue ────────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('should return the underlying Bull queue', () => {
      expect(service.getQueue()).toBe(mockQueue);
    });
  });
});
