/**
 * Unit tests for EscrowService integration with ConditionMonitorService (Task 7.1)
 *
 * Tests the updated EscrowService methods that now integrate with
 * ConditionMonitorService and NotificationService (replacing stubs).
 *
 * Validates: Requirements 2.2, 2.3, 2.6
 */

import { EscrowStatus } from '../types/database';
import type { EscrowRecord } from '../types/database';
import { EscrowService } from '../services/EscrowService';

// ── Mock stellar-sdk ──────────────────────────────────────────────────

jest.mock('stellar-sdk', () => ({
  StrKey: {
    isValidEd25519PublicKey: jest.fn().mockReturnValue(true),
  },
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn().mockResolvedValue({
        balances: [{ asset_type: 'native', balance: '1000.0' }],
      }),
    })),
  },
}));

// ── Mock factories ────────────────────────────────────────────────────

function createMockEscrow(overrides: Partial<EscrowRecord> = {}): EscrowRecord {
  return {
    id: 'escrow-1',
    contractId: 'escrow_contract_1',
    creatorId: 'user-1',
    recipientId: 'user-2',
    amount: 100,
    status: EscrowStatus.ACTIVE,
    conditions: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    releasedAt: null,
    txHash: null,
    ...overrides,
  } as EscrowRecord;
}

function createMockEscrowRepository() {
  return {
    findById: jest.fn().mockResolvedValue(createMockEscrow()),
    findActiveEscrows: jest.fn().mockResolvedValue([]),
    findExpiredEscrows: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(createMockEscrow()),
    updateStatus: jest.fn().mockResolvedValue(createMockEscrow({ status: EscrowStatus.RELEASED })),
    findByCreatorId: jest.fn(),
    findByRecipientId: jest.fn(),
    findByContractId: jest.fn(),
    updateStatusByContractId: jest.fn(),
    markExpiredEscrows: jest.fn(),
    setRecipient: jest.fn(),
    getEscrowStats: jest.fn(),
    delete: jest.fn(),
    checkConditions: jest.fn(),
    updateConditionStatus: jest.fn(),
  };
}

function createMockTransactionRepository() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTxHash: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
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

function createMockNotificationService() {
  return {
    notifyEscrowRelease: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRefund: jest.fn().mockResolvedValue({ success: true }),
    notifyTransactionComplete: jest.fn(),
    sendSystemAlert: jest.fn(),
    sendInvoiceToClient: jest.fn(),
    notifyInvoiceApproval: jest.fn(),
    notifyInvoiceRejection: jest.fn(),
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

// ── Tests ─────────────────────────────────────────────────────────────

describe('EscrowService integration', () => {
  let escrowService: EscrowService;
  let mockEscrowRepo: ReturnType<typeof createMockEscrowRepository>;
  let mockTxRepo: ReturnType<typeof createMockTransactionRepository>;
  let mockConditionMonitor: ReturnType<typeof createMockConditionMonitor>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;

  const config = {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    contractId: 'test-contract-id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEscrowRepo = createMockEscrowRepository();
    mockTxRepo = createMockTransactionRepository();
    mockConditionMonitor = createMockConditionMonitor();
    mockNotificationService = createMockNotificationService();

    escrowService = new EscrowService(
      mockEscrowRepo as any,
      mockTxRepo as any,
      config
    );
    escrowService.setConditionMonitor(mockConditionMonitor as any);
    escrowService.setNotificationService(mockNotificationService as any);
  });

  // ── scheduleConditionCheck ──────────────────────────────────────────

  describe('scheduleConditionCheck', () => {
    it('should delegate to ConditionMonitorService.startMonitoring', async () => {
      await escrowService.scheduleConditionCheck('escrow-1', 30000);

      expect(mockConditionMonitor.startMonitoring).toHaveBeenCalledWith('escrow-1', 30000);
    });

    it('should not throw when ConditionMonitorService is not attached', async () => {
      const serviceWithoutMonitor = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        config
      );

      // Should not throw
      await serviceWithoutMonitor.scheduleConditionCheck('escrow-1', 30000);
      expect(mockConditionMonitor.startMonitoring).not.toHaveBeenCalled();
    });
  });

  // ── notifyEscrowStatusChange ────────────────────────────────────────

  describe('notifyEscrowStatusChange', () => {
    it('should send release notification when status is RELEASED', async () => {
      const escrow = createMockEscrow({ txHash: 'tx_release_abc' });
      mockEscrowRepo.findById.mockResolvedValue(escrow);

      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.RELEASED);

      expect(mockNotificationService.notifyEscrowRelease).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          escrowId: 'escrow-1',
          amount: '100',
          transactionHash: 'tx_release_abc',
        }),
        expect.objectContaining({ escrowId: 'escrow-1' })
      );
    });

    it('should send refund notification when status is REFUNDED', async () => {
      mockEscrowRepo.findById.mockResolvedValue(createMockEscrow());

      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.REFUNDED);

      expect(mockNotificationService.notifyEscrowRefund).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          escrowId: 'escrow-1',
          amount: '100',
        }),
        expect.objectContaining({ escrowId: 'escrow-1' })
      );
    });

    it('should send refund notification when status is EXPIRED', async () => {
      mockEscrowRepo.findById.mockResolvedValue(createMockEscrow());

      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.EXPIRED);

      expect(mockNotificationService.notifyEscrowRefund).toHaveBeenCalled();
    });

    it('should not send notification for ACTIVE status', async () => {
      mockEscrowRepo.findById.mockResolvedValue(createMockEscrow());

      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.ACTIVE);

      expect(mockNotificationService.notifyEscrowRelease).not.toHaveBeenCalled();
      expect(mockNotificationService.notifyEscrowRefund).not.toHaveBeenCalled();
    });

    it('should not throw when NotificationService is not attached', async () => {
      const serviceWithoutNotif = new EscrowService(
        mockEscrowRepo as any,
        mockTxRepo as any,
        config
      );

      // Should not throw
      await serviceWithoutNotif.notifyEscrowStatusChange('escrow-1', EscrowStatus.RELEASED);
    });

    it('should handle escrow not found gracefully', async () => {
      mockEscrowRepo.findById.mockResolvedValue(null);

      // Should not throw
      await escrowService.notifyEscrowStatusChange('nonexistent', EscrowStatus.RELEASED);

      expect(mockNotificationService.notifyEscrowRelease).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      mockEscrowRepo.findById.mockResolvedValue(createMockEscrow());
      mockNotificationService.notifyEscrowRelease.mockRejectedValue(new Error('Notification failed'));

      // Should not throw
      await escrowService.notifyEscrowStatusChange('escrow-1', EscrowStatus.RELEASED);
    });
  });
});
