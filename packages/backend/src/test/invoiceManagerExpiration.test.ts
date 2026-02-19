/**
 * Unit tests for InvoiceManager integration with InvoiceExpirationService (Task 7.2)
 *
 * Tests that the InvoiceManager properly delegates to the InvoiceExpirationService
 * for scheduling, cancellation, and batch processing of expired invoices.
 *
 * Validates: Requirements 4.6
 */

import { InvoiceStatus } from '../types/database';
import type { InvoiceRecord } from '../types/database';
import { InvoiceManager } from '../services/InvoiceManager';

// ── Mock factories ────────────────────────────────────────────────────

function createMockInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'invoice-1',
    creatorId: 'user-1',
    clientEmail: 'client@example.com',
    amount: 500,
    description: 'Test invoice',
    status: InvoiceStatus.SENT,
    createdAt: new Date(Date.now() - 86400000),
    dueDate: new Date(Date.now() + 86400000), // 1 day from now
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
    findByCreatorId: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    findByApprovalToken: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(createMockInvoice()),
    updateStatus: jest.fn().mockImplementation(async (id: string, data: any) => {
      return createMockInvoice({ id, status: data.status });
    }),
    markExpiredInvoices: jest.fn().mockResolvedValue(0),
    getPublicInvoice: jest.fn().mockResolvedValue(null),
    getInvoiceStats: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockTransactionRepository() {
  return {
    create: jest.fn().mockResolvedValue({}),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockExpirationService() {
  return {
    scheduleInvoiceExpiration: jest.fn().mockResolvedValue(undefined),
    cancelScheduledExpiration: jest.fn().mockResolvedValue(undefined),
    processExpiredInvoices: jest.fn().mockResolvedValue([]),
    processExpirationJob: jest.fn(),
    cleanupOldInvoices: jest.fn(),
    registerQueueProcessor: jest.fn(),
    getScheduledInvoices: jest.fn().mockReturnValue(new Set()),
    shutdown: jest.fn(),
    getQueue: jest.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('InvoiceManager — Expiration Integration', () => {
  let invoiceManager: InvoiceManager;
  let mockInvoiceRepo: ReturnType<typeof createMockInvoiceRepository>;
  let mockTransactionRepo: ReturnType<typeof createMockTransactionRepository>;
  let mockExpirationService: ReturnType<typeof createMockExpirationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoiceRepo = createMockInvoiceRepository();
    mockTransactionRepo = createMockTransactionRepository();
    mockExpirationService = createMockExpirationService();

    invoiceManager = new InvoiceManager(
      mockInvoiceRepo as any,
      mockTransactionRepo as any,
      {
        networkPassphrase: 'Test SDF Network ; September 2015',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        baseUrl: 'http://localhost:3000',
      },
    );

    invoiceManager.setExpirationService(mockExpirationService as any);
  });

  // ── scheduleInvoiceExpiration ───────────────────────────────────────

  describe('scheduleInvoiceExpiration', () => {
    it('should delegate to the expiration service', async () => {
      const expirationDate = new Date(Date.now() + 86400000);
      await invoiceManager.scheduleInvoiceExpiration('invoice-1', expirationDate);

      expect(mockExpirationService.scheduleInvoiceExpiration).toHaveBeenCalledWith(
        'invoice-1',
        expirationDate,
      );
    });

    it('should not throw when expiration service is not set', async () => {
      const manager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTransactionRepo as any,
        {
          networkPassphrase: 'Test SDF Network ; September 2015',
          horizonUrl: 'https://horizon-testnet.stellar.org',
          baseUrl: 'http://localhost:3000',
        },
      );

      // Should not throw
      await manager.scheduleInvoiceExpiration('invoice-1', new Date());
    });
  });

  // ── notifyInvoiceStatusChange ───────────────────────────────────────

  describe('notifyInvoiceStatusChange', () => {
    it('should schedule expiration when invoice status changes to SENT', async () => {
      const invoice = createMockInvoice({ dueDate: new Date(Date.now() + 86400000) });
      mockInvoiceRepo.findById.mockResolvedValue(invoice);

      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.SENT);

      expect(mockExpirationService.scheduleInvoiceExpiration).toHaveBeenCalledWith(
        'invoice-1',
        invoice.dueDate,
      );
    });

    it('should cancel scheduled expiration when invoice is approved', async () => {
      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.APPROVED);

      expect(mockExpirationService.cancelScheduledExpiration).toHaveBeenCalledWith('invoice-1');
    });

    it('should cancel scheduled expiration when invoice is executed', async () => {
      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.EXECUTED);

      expect(mockExpirationService.cancelScheduledExpiration).toHaveBeenCalledWith('invoice-1');
    });

    it('should cancel scheduled expiration when invoice is rejected', async () => {
      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.REJECTED);

      expect(mockExpirationService.cancelScheduledExpiration).toHaveBeenCalledWith('invoice-1');
    });

    it('should cancel scheduled expiration when invoice is expired', async () => {
      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.EXPIRED);

      expect(mockExpirationService.cancelScheduledExpiration).toHaveBeenCalledWith('invoice-1');
    });

    it('should not schedule expiration for DRAFT status', async () => {
      await invoiceManager.notifyInvoiceStatusChange('invoice-1', InvoiceStatus.DRAFT);

      expect(mockExpirationService.scheduleInvoiceExpiration).not.toHaveBeenCalled();
      expect(mockExpirationService.cancelScheduledExpiration).not.toHaveBeenCalled();
    });
  });

  // ── processExpiredInvoices ──────────────────────────────────────────

  describe('processExpiredInvoices', () => {
    it('should delegate to the expiration service and map results', async () => {
      mockExpirationService.processExpiredInvoices.mockResolvedValue([
        { invoiceId: 'inv-1', status: 'expired', invoice: createMockInvoice({ id: 'inv-1', status: InvoiceStatus.EXPIRED }) },
        { invoiceId: 'inv-2', status: 'already_expired', invoice: createMockInvoice({ id: 'inv-2', status: InvoiceStatus.EXPIRED }) },
      ]);

      const results = await invoiceManager.processExpiredInvoices();

      expect(results).toHaveLength(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
    });

    it('should map error results correctly', async () => {
      mockExpirationService.processExpiredInvoices.mockResolvedValue([
        { invoiceId: 'inv-1', status: 'error', error: 'DB error' },
      ]);

      const results = await invoiceManager.processExpiredInvoices();

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toBe('DB error');
    });

    it('should fall back to direct processing when expiration service is not set', async () => {
      const manager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTransactionRepo as any,
        {
          networkPassphrase: 'Test SDF Network ; September 2015',
          horizonUrl: 'https://horizon-testnet.stellar.org',
          baseUrl: 'http://localhost:3000',
        },
      );

      const expiredInvoices = [
        createMockInvoice({ id: 'inv-1', status: InvoiceStatus.SENT, dueDate: new Date(Date.now() - 3600000) }),
      ];
      mockInvoiceRepo.findExpiredInvoices.mockResolvedValue(expiredInvoices);

      const results = await manager.processExpiredInvoices();

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(true);
      expect(mockInvoiceRepo.updateStatus).toHaveBeenCalledWith('inv-1', {
        status: InvoiceStatus.EXPIRED,
      });
    });
  });
});
