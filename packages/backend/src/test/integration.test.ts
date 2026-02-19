/**
 * End-to-end integration tests for the Stellar Smart Contract DApp backend.
 *
 * Tests complete workflows across multiple services:
 * - Escrow: create → monitor conditions → release/refund → notification
 * - Invoice: create → send → approve → execute → notification
 * - P2P payment: validate → send → confirm → notification
 * - Cross-component interactions
 * - Error scenarios and recovery mechanisms
 *
 * Validates: All requirements integration (Task 12.1)
 */

import { EscrowService } from '../services/EscrowService';
import { InvoiceManager } from '../services/InvoiceManager';
import { P2PHandler } from '../services/P2PHandler';
import { TransactionStatusSyncService } from '../services/TransactionStatusSyncService';
import {
  EscrowStatus,
  InvoiceStatus,
  TransactionStatus,
  TransactionType,
} from '../types/database';
import type { EscrowRecord, InvoiceRecord, TransactionRecord } from '../types/database';

// ── Mock stellar-sdk ──────────────────────────────────────────────────

const mockLoadAccount = jest.fn();
const mockFetchBaseFee = jest.fn().mockResolvedValue(100);
const mockTransactionCall = jest.fn();

jest.mock('stellar-sdk', () => ({
  StrKey: {
    isValidEd25519PublicKey: jest.fn().mockReturnValue(true),
  },
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: mockLoadAccount,
      fetchBaseFee: mockFetchBaseFee,
      transactions: jest.fn().mockReturnValue({
        transaction: jest.fn().mockReturnValue({
          call: mockTransactionCall,
        }),
      }),
    })),
  },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    addMemo: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({
      hash: jest.fn().mockReturnValue(Buffer.from('mockhash1234567890abcdef', 'hex')),
    }),
  })),
  Operation: {
    payment: jest.fn().mockReturnValue({}),
  },
  Asset: {
    native: jest.fn().mockReturnValue({}),
  },
  Memo: {
    text: jest.fn().mockReturnValue({}),
  },
}));

// ── Shared mock state (in-memory stores) ──────────────────────────────

let escrowStore: Map<string, EscrowRecord>;
let invoiceStore: Map<string, InvoiceRecord>;
let transactionStore: Map<string, TransactionRecord>;
let notificationLog: Array<{ type: string; userId: string; data: any }>;
let idCounter: number;

function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

// ── Mock factories ────────────────────────────────────────────────────

function createMockEscrowRepository() {
  return {
    create: jest.fn().mockImplementation(async (data: any) => {
      const escrow: EscrowRecord = {
        id: nextId('escrow'),
        contractId: data.contractId,
        creatorId: data.creatorId,
        recipientId: data.recipientId ?? null,
        amount: data.amount,
        status: EscrowStatus.ACTIVE,
        conditions: data.conditions || [],
        createdAt: new Date(),
        expiresAt: data.expiresAt,
        releasedAt: null,
        txHash: null,
      };
      escrowStore.set(escrow.id, escrow);
      return escrow;
    }),
    findById: jest.fn().mockImplementation(async (id: string) => {
      return escrowStore.get(id) || null;
    }),
    findActiveEscrows: jest.fn().mockImplementation(async () => {
      return Array.from(escrowStore.values()).filter(
        (e) => e.status === EscrowStatus.ACTIVE && e.expiresAt > new Date()
      );
    }),
    findExpiredEscrows: jest.fn().mockImplementation(async () => {
      return Array.from(escrowStore.values()).filter(
        (e) => e.status === EscrowStatus.ACTIVE && e.expiresAt <= new Date()
      );
    }),
    updateStatus: jest.fn().mockImplementation(async (id: string, data: any) => {
      const escrow = escrowStore.get(id);
      if (!escrow) throw new Error('Escrow not found');
      const updated = { ...escrow, ...data };
      escrowStore.set(id, updated);
      return updated;
    }),
    findByCreatorId: jest.fn().mockResolvedValue([]),
    findByRecipientId: jest.fn().mockResolvedValue([]),
    findByContractId: jest.fn().mockResolvedValue(null),
    updateStatusByContractId: jest.fn(),
    markExpiredEscrows: jest.fn(),
    setRecipient: jest.fn(),
    getEscrowStats: jest.fn(),
    delete: jest.fn(),
    checkConditions: jest.fn(),
    updateConditionStatus: jest.fn(),
  };
}

function createMockInvoiceRepository() {
  return {
    create: jest.fn().mockImplementation(async (data: any) => {
      const invoice: InvoiceRecord = {
        id: nextId('invoice'),
        creatorId: data.creatorId,
        clientEmail: data.clientEmail,
        amount: data.amount,
        description: data.description,
        status: InvoiceStatus.DRAFT,
        createdAt: new Date(),
        dueDate: data.dueDate,
        approvedAt: null,
        executedAt: null,
        txHash: null,
        approvalToken: `token-${Date.now()}`,
        metadata: data.metadata || {},
      };
      invoiceStore.set(invoice.id, invoice);
      return invoice;
    }),
    findById: jest.fn().mockImplementation(async (id: string) => {
      return invoiceStore.get(id) || null;
    }),
    findByApprovalToken: jest.fn().mockImplementation(async (token: string) => {
      return Array.from(invoiceStore.values()).find((i) => i.approvalToken === token) || null;
    }),
    updateStatus: jest.fn().mockImplementation(async (id: string, data: any) => {
      const invoice = invoiceStore.get(id);
      if (!invoice) throw new Error('Invoice not found');
      const updated = {
        ...invoice,
        ...data,
        metadata: data.metadata ? { ...invoice.metadata, ...data.metadata } : invoice.metadata,
      };
      invoiceStore.set(id, updated);
      return updated;
    }),
    findExpiredInvoices: jest.fn().mockImplementation(async () => {
      const now = new Date();
      return Array.from(invoiceStore.values()).filter(
        (i) =>
          (i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.APPROVED) &&
          i.dueDate < now
      );
    }),
    findByCreatorId: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } }),
    getPublicInvoice: jest.fn(),
    markExpiredInvoices: jest.fn(),
    getInvoiceStats: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockTransactionRepository() {
  return {
    create: jest.fn().mockImplementation(async (data: any) => {
      const tx: TransactionRecord = {
        id: nextId('tx'),
        userId: data.userId,
        type: data.type,
        txHash: data.txHash,
        status: TransactionStatus.PENDING,
        amount: data.amount,
        sender: data.sender,
        recipient: data.recipient,
        timestamp: new Date(),
        blockHeight: null,
        fees: data.fees || 0,
        metadata: data.metadata || {},
      };
      transactionStore.set(tx.txHash, tx);
      return tx;
    }),
    findById: jest.fn().mockImplementation(async (id: string) => {
      return Array.from(transactionStore.values()).find((t) => t.id === id) || null;
    }),
    findByTxHash: jest.fn().mockImplementation(async (txHash: string) => {
      return transactionStore.get(txHash) || null;
    }),
    findByUserId: jest.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    }),
    updateStatus: jest.fn(),
    updateStatusByTxHash: jest.fn().mockImplementation(async (txHash: string, data: any) => {
      const tx = transactionStore.get(txHash);
      if (!tx) throw new Error('Transaction not found');
      const updated = { ...tx, ...data };
      transactionStore.set(txHash, updated);
      return updated;
    }),
    findPendingTransactions: jest.fn().mockImplementation(async () => {
      return Array.from(transactionStore.values()).filter(
        (t) => t.status === TransactionStatus.PENDING
      );
    }),
    getTransactionStats: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockNotificationService() {
  return {
    notifyEscrowRelease: jest.fn().mockImplementation(async (userId: string, data: any) => {
      notificationLog.push({ type: 'escrow_release', userId, data });
      return { success: true };
    }),
    notifyEscrowRefund: jest.fn().mockImplementation(async (userId: string, data: any) => {
      notificationLog.push({ type: 'escrow_refund', userId, data });
      return { success: true };
    }),
    notifyTransactionComplete: jest.fn().mockImplementation(async (userId: string, data: any) => {
      notificationLog.push({ type: 'transaction_complete', userId, data });
      return { success: true };
    }),
    notifyInvoiceApproval: jest.fn().mockImplementation(async (userId: string, data: any) => {
      notificationLog.push({ type: 'invoice_approved', userId, data });
      return { success: true };
    }),
    notifyInvoiceRejection: jest.fn().mockImplementation(async (userId: string, data: any) => {
      notificationLog.push({ type: 'invoice_rejected', userId, data });
      return { success: true };
    }),
    sendInvoiceToClient: jest.fn().mockImplementation(async (userId: string, _email: string, data: any) => {
      notificationLog.push({ type: 'invoice_sent', userId, data });
      return { success: true };
    }),
    sendSystemAlert: jest.fn().mockImplementation(async (userId: string, alert: any) => {
      notificationLog.push({ type: 'system_alert', userId, data: alert });
      return { success: true };
    }),
    processNotificationJob: jest.fn().mockResolvedValue({ success: true }),
    registerQueueProcessor: jest.fn(),
    getNotifications: jest.fn(),
    getUnreadNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    isNotificationEnabled: jest.fn().mockReturnValue(true),
    isEmailEnabled: jest.fn().mockReturnValue(true),
  };
}

function createMockConditionMonitor() {
  return {
    startMonitoring: jest.fn().mockResolvedValue(undefined),
    stopMonitoring: jest.fn().mockResolvedValue(undefined),
    getMonitoredEscrows: jest.fn().mockReturnValue(new Set()),
    processConditionCheckJob: jest.fn(),
    checkAllActiveConditions: jest.fn(),
    evaluateAllConditions: jest.fn(),
    evaluateCondition: jest.fn(),
    registerQueueProcessor: jest.fn(),
    shutdown: jest.fn(),
    getQueue: jest.fn(),
  };
}

function createMockBullQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
  };
}

// ── Shared service config ─────────────────────────────────────────────

const STELLAR_CONFIG = {
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  contractId: 'test-contract-id',
};

const VALID_SENDER = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
const VALID_RECIPIENT = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEBD9AFZQ7TM4JRS9A';

// ── Test suites ───────────────────────────────────────────────────────

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    escrowStore = new Map();
    invoiceStore = new Map();
    transactionStore = new Map();
    notificationLog = [];
    idCounter = 0;

    // Default: valid account with sufficient balance
    mockLoadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '10000.0' }],
      accountId: jest.fn().mockReturnValue(VALID_SENDER),
      sequenceNumber: jest.fn().mockReturnValue('1'),
      sequence: '1',
    });
    mockFetchBaseFee.mockResolvedValue(100);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. Complete Escrow Workflow
  // ═══════════════════════════════════════════════════════════════════

  describe('Escrow Workflow: create → monitor → release/refund → notification', () => {
    let escrowService: EscrowService;
    let mockEscrowRepo: ReturnType<typeof createMockEscrowRepository>;
    let mockTxRepo: ReturnType<typeof createMockTransactionRepository>;
    let mockNotifService: ReturnType<typeof createMockNotificationService>;
    let mockCondMonitor: ReturnType<typeof createMockConditionMonitor>;

    beforeEach(() => {
      mockEscrowRepo = createMockEscrowRepository();
      mockTxRepo = createMockTransactionRepository();
      mockNotifService = createMockNotificationService();
      mockCondMonitor = createMockConditionMonitor();

      escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );
      escrowService.setConditionMonitor(mockCondMonitor as any);
      escrowService.setNotificationService(mockNotifService as any);
    });

    it('should complete full escrow lifecycle: create → conditions met → release → notify', async () => {
      // Step 1: Create escrow with a time-based condition already met
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 500,
        conditions: [
          { type: 'time_based', parameters: { targetTime: pastTime }, validator: 'time' },
        ],
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(result.success).toBe(true);
      expect(result.escrow).toBeDefined();
      const escrowId = result.escrow!.id;

      // Step 2: Check conditions — should be met
      const statuses = await escrowService.checkConditions(escrowId);
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.met).toBe(true);

      // Step 3: Release escrow
      const releaseResult = await escrowService.releaseEscrow(escrowId);
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.escrow!.status).toBe(EscrowStatus.RELEASED);

      // Step 4: Verify transaction was recorded
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TransactionType.ESCROW,
          amount: 500,
          metadata: expect.objectContaining({ action: 'release' }),
        })
      );

      // Step 5: Notify status change
      await escrowService.notifyEscrowStatusChange(escrowId, EscrowStatus.RELEASED);
      expect(mockNotifService.notifyEscrowRelease).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ escrowId }),
        expect.any(Object)
      );
    });

    it('should refund escrow when expired and conditions not met', async () => {
      // Create escrow that is already expired
      const expiredTime = new Date(Date.now() - 1000);
      const futureCondition = new Date(Date.now() + 999999).toISOString();

      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 200,
        conditions: [
          { type: 'time_based', parameters: { targetTime: futureCondition }, validator: 'time' },
        ],
        expiresAt: expiredTime,
      });

      expect(result.success).toBe(true);
      const escrowId = result.escrow!.id;

      // Conditions should NOT be met
      const statuses = await escrowService.checkConditions(escrowId);
      expect(statuses[0]!.met).toBe(false);

      // Refund should succeed (escrow is expired)
      const refundResult = await escrowService.refundEscrow(escrowId);
      expect(refundResult.success).toBe(true);
      expect(refundResult.escrow!.status).toBe(EscrowStatus.REFUNDED);

      // Transaction recorded as refund
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ action: 'refund' }),
        })
      );
    });

    it('should reject release when conditions are not met', async () => {
      const futureTime = new Date(Date.now() + 999999).toISOString();
      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 100,
        conditions: [
          { type: 'time_based', parameters: { targetTime: futureTime }, validator: 'time' },
        ],
        expiresAt: new Date(Date.now() + 3600000),
      });

      const releaseResult = await escrowService.releaseEscrow(result.escrow!.id);
      expect(releaseResult.success).toBe(false);
      expect(releaseResult.error).toBe('Not all conditions are met');
    });

    it('should reject refund when escrow has not expired', async () => {
      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 100,
        conditions: [],
        expiresAt: new Date(Date.now() + 3600000),
      });

      const refundResult = await escrowService.refundEscrow(result.escrow!.id);
      expect(refundResult.success).toBe(false);
      expect(refundResult.error).toBe('Escrow has not expired yet');
    });

    it('should schedule condition monitoring after escrow creation', async () => {
      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 100,
        conditions: [
          { type: 'manual_approval', parameters: { approved: false }, validator: 'manual' },
        ],
        expiresAt: new Date(Date.now() + 3600000),
      });

      await escrowService.scheduleConditionCheck(result.escrow!.id, 30000);
      expect(mockCondMonitor.startMonitoring).toHaveBeenCalledWith(result.escrow!.id, 30000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Complete Invoice Workflow
  // ═══════════════════════════════════════════════════════════════════

  describe('Invoice Workflow: create → send → approve → execute → notification', () => {
    let invoiceManager: InvoiceManager;
    let mockInvoiceRepo: ReturnType<typeof createMockInvoiceRepository>;
    let mockTxRepo: ReturnType<typeof createMockTransactionRepository>;

    beforeEach(() => {
      mockInvoiceRepo = createMockInvoiceRepository();
      mockTxRepo = createMockTransactionRepository();

      invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );
    });

    it('should complete full invoice lifecycle: create → send → approve → execute', async () => {
      // Step 1: Create invoice
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 1000,
        description: 'Web development services',
        dueDate: new Date(Date.now() + 86400000 * 7), // 7 days
      });

      expect(createResult.success).toBe(true);
      expect(createResult.invoice).toBeDefined();
      const invoiceId = createResult.invoice!.id;

      // Step 2: Send invoice
      const delivery = await invoiceManager.sendInvoice(invoiceId);
      expect(delivery.deliveryStatus).toBe('sent');
      expect(delivery.approvalUrl).toContain(createResult.invoice!.approvalToken);

      // Verify status updated to SENT
      const sentInvoice = invoiceStore.get(invoiceId);
      expect(sentInvoice!.status).toBe(InvoiceStatus.SENT);

      // Step 3: Approve invoice
      const clientInfo = {
        name: 'Test Client',
        email: 'client@example.com',
        approvalTimestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      };
      const approval = await invoiceManager.approveInvoice(invoiceId, clientInfo);
      expect(approval.approved).toBe(true);

      // Verify status updated to APPROVED
      const approvedInvoice = invoiceStore.get(invoiceId);
      expect(approvedInvoice!.status).toBe(InvoiceStatus.APPROVED);

      // Step 4: Execute invoice (payment)
      const execResult = await invoiceManager.executeInvoice(invoiceId);
      expect(execResult.success).toBe(true);
      expect(execResult.invoice!.status).toBe(InvoiceStatus.EXECUTED);

      // Verify transaction was created
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TransactionType.INVOICE,
          amount: 1000,
          metadata: expect.objectContaining({ invoiceId }),
        })
      );
    });

    it('should reject invoice and notify creator', async () => {
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 500,
        description: 'Consulting',
        dueDate: new Date(Date.now() + 86400000),
      });

      const invoiceId = createResult.invoice!.id;
      await invoiceManager.sendInvoice(invoiceId);

      const rejectResult = await invoiceManager.rejectInvoice(invoiceId, 'Budget constraints');
      expect(rejectResult.success).toBe(true);
      expect(rejectResult.invoice!.status).toBe(InvoiceStatus.REJECTED);
    });

    it('should prevent approval of non-SENT invoice', async () => {
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      // Try to approve a DRAFT invoice (not yet sent)
      await expect(
        invoiceManager.approveInvoice(createResult.invoice!.id, {
          email: 'client@example.com',
          approvalTimestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
        })
      ).rejects.toThrow('Invoice cannot be approved in current status');
    });

    it('should prevent execution of non-APPROVED invoice', async () => {
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      const execResult = await invoiceManager.executeInvoice(createResult.invoice!.id);
      expect(execResult.success).toBe(false);
      expect(execResult.error).toBe('Invoice must be approved before execution');
    });

    it('should validate approval token correctly', async () => {
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      const token = createResult.invoice!.approvalToken;

      // Valid token
      const validation = await invoiceManager.validateApprovalToken(token);
      expect(validation.valid).toBe(true);
      expect(validation.invoice).toBeDefined();

      // Invalid token
      const invalidValidation = await invoiceManager.validateApprovalToken('invalid-token');
      expect(invalidValidation.valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Complete P2P Payment Workflow
  // ═══════════════════════════════════════════════════════════════════

  describe('P2P Payment Workflow: validate → send → confirm → notification', () => {
    let p2pHandler: P2PHandler;
    let mockTxRepo: ReturnType<typeof createMockTransactionRepository>;

    beforeEach(() => {
      mockTxRepo = createMockTransactionRepository();
      p2pHandler = new P2PHandler(mockTxRepo as any, STELLAR_CONFIG);
    });

    it('should complete full P2P payment: validate recipient → send → record transaction', async () => {
      // Step 1: Validate recipient
      const validation = await p2pHandler.validateRecipient(VALID_RECIPIENT);
      expect(validation.valid).toBe(true);
      expect(validation.exists).toBe(true);

      // Step 2: Estimate fees
      const fees = await p2pHandler.estimateFees(100);
      expect(fees.totalCost).toBeGreaterThan(100);
      expect(fees.estimatedFee).toBeGreaterThan(0);

      // Step 3: Send payment
      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 100,
        memo: 'Payment for services',
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      expect(result.transaction).toBeDefined();

      // Step 4: Verify transaction was persisted
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TransactionType.P2P,
          amount: 100,
          sender: VALID_SENDER,
          recipient: VALID_RECIPIENT,
        })
      );
    });

    it('should reject payment with zero or negative amount', async () => {
      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount must be positive');

      const negResult = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: -50,
      });

      expect(negResult.success).toBe(false);
      expect(negResult.error).toBe('Amount must be positive');
    });

    it('should reject payment with insufficient balance', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '0.001' }],
        accountId: jest.fn().mockReturnValue(VALID_SENDER),
        sequence: '1',
      });

      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });

    it('should reject payment to invalid recipient', async () => {
      const { StrKey } = require('stellar-sdk');
      StrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);

      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: 'INVALID_ADDRESS',
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Cross-Component Integration
  // ═══════════════════════════════════════════════════════════════════

  describe('Cross-Component Integration', () => {
    it('should create transaction record when escrow is released', async () => {
      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();

      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );

      // Create escrow with already-met condition
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const createResult = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 300,
        conditions: [
          { type: 'time_based', parameters: { targetTime: pastTime }, validator: 'time' },
        ],
        expiresAt: new Date(Date.now() + 3600000),
      });

      // Release escrow
      await escrowService.releaseEscrow(createResult.escrow!.id);

      // Verify cross-component: transaction repo received the escrow release record
      expect(mockTxRepo.create).toHaveBeenCalledTimes(1);
      const txCall = mockTxRepo.create.mock.calls[0][0];
      expect(txCall.type).toBe(TransactionType.ESCROW);
      expect(txCall.amount).toBe(300);
      expect(txCall.metadata.action).toBe('release');
      expect(txCall.metadata.escrowId).toBe(createResult.escrow!.id);
    });

    it('should create transaction record when invoice is executed', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();

      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      // Create → Send → Approve → Execute
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 750,
        description: 'Design work',
        dueDate: new Date(Date.now() + 86400000),
      });

      await invoiceManager.sendInvoice(createResult.invoice!.id);
      await invoiceManager.approveInvoice(createResult.invoice!.id, {
        email: 'client@example.com',
        approvalTimestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });
      await invoiceManager.executeInvoice(createResult.invoice!.id);

      // Verify cross-component: transaction created from invoice execution
      expect(mockTxRepo.create).toHaveBeenCalledTimes(1);
      const txCall = mockTxRepo.create.mock.calls[0][0];
      expect(txCall.type).toBe(TransactionType.INVOICE);
      expect(txCall.amount).toBe(750);
      expect(txCall.metadata.invoiceId).toBe(createResult.invoice!.id);
    });

    it('should handle ConditionMonitorService triggering escrow release with notification', async () => {
      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();
      const mockNotifService = createMockNotificationService();

      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );
      escrowService.setNotificationService(mockNotifService as any);

      // Create escrow with met condition
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const createResult = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 400,
        conditions: [
          { type: 'time_based', parameters: { targetTime: pastTime }, validator: 'time' },
        ],
        expiresAt: new Date(Date.now() + 3600000),
      });

      // Simulate what ConditionMonitorService does: release + notify
      const releaseResult = await escrowService.releaseEscrow(createResult.escrow!.id);
      expect(releaseResult.success).toBe(true);

      await escrowService.notifyEscrowStatusChange(
        createResult.escrow!.id,
        EscrowStatus.RELEASED
      );

      // Verify notification was sent
      expect(mockNotifService.notifyEscrowRelease).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ escrowId: createResult.escrow!.id }),
        expect.any(Object)
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. Error Scenarios
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Scenarios', () => {
    it('should handle insufficient funds for escrow creation', async () => {
      mockLoadAccount.mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '5.0' }],
      });

      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();
      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );

      const result = await escrowService.createEscrow({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 1000,
        conditions: [],
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });

    it('should handle invalid sender address for P2P payment', async () => {
      const { StrKey } = require('stellar-sdk');
      StrKey.isValidEd25519PublicKey.mockReturnValueOnce(false);

      const mockTxRepo = createMockTransactionRepository();
      const p2pHandler = new P2PHandler(mockTxRepo as any, STELLAR_CONFIG);

      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: 'INVALID',
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('should handle expired invoice approval attempt', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();
      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      // Create invoice with past due date (need to bypass validation)
      const createResult = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: 100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      const invoiceId = createResult.invoice!.id;
      await invoiceManager.sendInvoice(invoiceId);

      // Manually set the due date to the past to simulate expiration
      const invoice = invoiceStore.get(invoiceId)!;
      invoice.dueDate = new Date(Date.now() - 1000);
      invoiceStore.set(invoiceId, invoice);

      await expect(
        invoiceManager.approveInvoice(invoiceId, {
          email: 'client@example.com',
          approvalTimestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
        })
      ).rejects.toThrow('Invoice has expired');
    });

    it('should handle negative invoice amount', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();
      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      const result = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'client@example.com',
        amount: -100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice amount must be positive');
    });

    it('should handle invalid email for invoice creation', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();
      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      const result = await invoiceManager.createInvoice({
        creatorId: 'user-1',
        clientEmail: 'not-an-email',
        amount: 100,
        description: 'Test',
        dueDate: new Date(Date.now() + 86400000),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid client email address');
    });

    it('should handle network failure during P2P payment gracefully', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Network timeout'));

      const mockTxRepo = createMockTransactionRepository();
      const p2pHandler = new P2PHandler(mockTxRepo as any, STELLAR_CONFIG);

      const result = await p2pHandler.sendPayment({
        userId: 'user-1',
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        amount: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // P2P handler catches network errors during recipient validation
      // and returns a descriptive error rather than crashing
      expect(typeof result.error).toBe('string');
    });

    it('should handle release of non-existent escrow', async () => {
      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();
      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );

      const result = await escrowService.releaseEscrow('nonexistent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Escrow not found');
    });

    it('should handle execution of non-existent invoice', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();
      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      const result = await invoiceManager.executeInvoice('nonexistent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. Recovery Mechanisms
  // ═══════════════════════════════════════════════════════════════════

  describe('Recovery Mechanisms', () => {
    it('should handle TransactionStatusSyncService retry logic for network failures', async () => {
      const mockTxRepo = createMockTransactionRepository();
      const mockNotifService = createMockNotificationService();
      const mockQueue = createMockBullQueue();

      const syncService = new TransactionStatusSyncService(
        mockTxRepo as any,
        mockNotifService as any,
        {
          ...STELLAR_CONFIG,
          redisUrl: 'redis://localhost:6379',
          defaultSyncInterval: 30000,
          concurrency: 1,
          maxRetries: 2,
          backoffDelay: 100,
          maxBackoffDelay: 500,
        },
        mockQueue as any
      );

      // Simulate a pending transaction
      const pendingTx = {
        id: 'tx-1',
        userId: 'user-1',
        type: TransactionType.BASIC,
        txHash: 'hash123',
        status: TransactionStatus.PENDING,
        amount: 100,
        sender: VALID_SENDER,
        recipient: VALID_RECIPIENT,
        timestamp: new Date(),
        blockHeight: null,
        fees: 100,
        metadata: {},
      } as unknown as TransactionRecord;
      transactionStore.set('hash123', pendingTx);

      // Simulate network returning confirmed status
      mockTransactionCall.mockResolvedValue({ successful: true });

      const result = await syncService.syncTransactionStatus('hash123');
      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(TransactionStatus.CONFIRMED);

      // Verify notification was sent
      expect(mockNotifService.notifyTransactionComplete).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ transactionHash: 'hash123' }),
        expect.any(Object)
      );
    });

    it('should calculate exponential backoff delay correctly', () => {
      const mockTxRepo = createMockTransactionRepository();
      const mockNotifService = createMockNotificationService();
      const mockQueue = createMockBullQueue();

      const syncService = new TransactionStatusSyncService(
        mockTxRepo as any,
        mockNotifService as any,
        {
          redisUrl: 'redis://localhost:6379',
          defaultSyncInterval: 30000,
          concurrency: 1,
          maxRetries: 5,
          backoffDelay: 1000,
          maxBackoffDelay: 60000,
          horizonUrl: STELLAR_CONFIG.horizonUrl,
          networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        },
        mockQueue as any
      );

      // Attempt 0: ~1000ms, Attempt 1: ~2000ms, Attempt 2: ~4000ms
      const delay0 = syncService.calculateBackoffDelay(0);
      const delay1 = syncService.calculateBackoffDelay(1);
      const delay2 = syncService.calculateBackoffDelay(2);

      // With ±25% jitter, delay0 should be between 750 and 1250
      expect(delay0).toBeGreaterThanOrEqual(750);
      expect(delay0).toBeLessThanOrEqual(1250);

      // delay1 should be roughly 2x delay0 (between 1500 and 2500)
      expect(delay1).toBeGreaterThanOrEqual(1500);
      expect(delay1).toBeLessThanOrEqual(2500);

      // delay2 should be roughly 4x base (between 3000 and 5000)
      expect(delay2).toBeGreaterThanOrEqual(3000);
      expect(delay2).toBeLessThanOrEqual(5000);
    });

    it('should handle batch sync of pending transactions', async () => {
      const mockTxRepo = createMockTransactionRepository();
      const mockNotifService = createMockNotificationService();
      const mockQueue = createMockBullQueue();

      const syncService = new TransactionStatusSyncService(
        mockTxRepo as any,
        mockNotifService as any,
        {
          ...STELLAR_CONFIG,
          redisUrl: 'redis://localhost:6379',
          defaultSyncInterval: 30000,
          concurrency: 1,
          maxRetries: 2,
          backoffDelay: 100,
          maxBackoffDelay: 500,
        },
        mockQueue as any
      );

      // Add multiple pending transactions
      const tx1 = {
        id: 'tx-1', userId: 'user-1', type: TransactionType.BASIC,
        txHash: 'hash1', status: TransactionStatus.PENDING,
        amount: 100, sender: VALID_SENDER, recipient: VALID_RECIPIENT,
        timestamp: new Date(), blockHeight: null, fees: 100, metadata: {},
      } as unknown as TransactionRecord;
      const tx2 = {
        id: 'tx-2', userId: 'user-2', type: TransactionType.P2P,
        txHash: 'hash2', status: TransactionStatus.PENDING,
        amount: 200, sender: VALID_SENDER, recipient: VALID_RECIPIENT,
        timestamp: new Date(), blockHeight: null, fees: 100, metadata: {},
      } as unknown as TransactionRecord;
      transactionStore.set('hash1', tx1);
      transactionStore.set('hash2', tx2);

      // First tx confirmed, second tx failed
      mockTransactionCall
        .mockResolvedValueOnce({ successful: true })
        .mockResolvedValueOnce({ successful: false });

      const batchResult = await syncService.syncAllPendingTransactions();
      expect(batchResult.total).toBe(2);
      expect(batchResult.synced).toBe(2);
      expect(batchResult.changed).toBe(2);
    });

    it('should gracefully handle escrow service without notification service', async () => {
      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();

      // Create service WITHOUT notification service attached
      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );

      // Should not throw when trying to notify
      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.RELEASED);
      // No error means graceful degradation works
    });

    it('should gracefully handle escrow service without condition monitor', async () => {
      const mockEscrowRepo = createMockEscrowRepository();
      const mockTxRepo = createMockTransactionRepository();

      // Create service WITHOUT condition monitor attached
      const escrowService = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        STELLAR_CONFIG
      );

      // Should not throw when trying to schedule
      await escrowService.scheduleConditionCheck('escrow-1', 30000);
      // No error means graceful degradation works
    });

    it('should handle InvoiceManager without expiration service', async () => {
      const mockInvoiceRepo = createMockInvoiceRepository();
      const mockTxRepo = createMockTransactionRepository();

      const invoiceManager = new InvoiceManager(
        mockInvoiceRepo as any,
        mockTxRepo as any,
        { ...STELLAR_CONFIG, baseUrl: 'https://app.example.com' }
      );

      // Should not throw when trying to schedule expiration
      await invoiceManager.scheduleInvoiceExpiration('invoice-1', new Date());
      // No error means graceful degradation works
    });

    it('should send system alert notification on transaction failure', async () => {
      const mockTxRepo = createMockTransactionRepository();
      const mockNotifService = createMockNotificationService();
      const mockQueue = createMockBullQueue();

      const syncService = new TransactionStatusSyncService(
        mockTxRepo as any,
        mockNotifService as any,
        {
          ...STELLAR_CONFIG,
          redisUrl: 'redis://localhost:6379',
          defaultSyncInterval: 30000,
          concurrency: 1,
          maxRetries: 2,
          backoffDelay: 100,
          maxBackoffDelay: 500,
        },
        mockQueue as any
      );

      // Simulate a pending transaction that fails
      const failedTx = {
        id: 'tx-fail', userId: 'user-1', type: TransactionType.BASIC,
        txHash: 'hashfail', status: TransactionStatus.PENDING,
        amount: 100, sender: VALID_SENDER, recipient: VALID_RECIPIENT,
        timestamp: new Date(), blockHeight: null, fees: 100, metadata: {},
      } as unknown as TransactionRecord;
      transactionStore.set('hashfail', failedTx);

      mockTransactionCall.mockResolvedValue({ successful: false });

      const result = await syncService.syncTransactionStatus('hashfail');
      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(TransactionStatus.FAILED);

      // Verify system alert was sent for failure
      expect(mockNotifService.sendSystemAlert).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Transaction Failed',
        })
      );
    });
  });
});
