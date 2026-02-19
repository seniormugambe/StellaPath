/**
 * Unit tests for ConditionMonitorService (Task 7.1)
 *
 * Tests automated escrow condition checking, scheduled monitoring,
 * condition evaluation, automatic release/refund, and notifications.
 *
 * Validates: Requirements 2.2, 2.3, 2.6
 */

import { EscrowStatus } from '../types/database';
import type { EscrowRecord, Condition } from '../types/database';
import { ConditionMonitorService } from '../services/ConditionMonitorService';

// ── Mock factories ────────────────────────────────────────────────────

function createMockEscrow(overrides: Partial<EscrowRecord> = {}): EscrowRecord {
  return {
    id: 'escrow-1',
    contractId: 'escrow_contract_1',
    creatorId: 'user-1',
    recipientId: 'user-2',
    amount: 100,
    status: EscrowStatus.ACTIVE,
    conditions: [
      {
        type: 'time_based',
        parameters: { targetTime: new Date(Date.now() - 60000).toISOString() }, // past
        validator: 'time_validator',
      },
    ],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
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
    findByCreatorId: jest.fn().mockResolvedValue([]),
    findByRecipientId: jest.fn().mockResolvedValue([]),
    findByContractId: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    updateStatus: jest.fn(),
    updateStatusByContractId: jest.fn(),
    markExpiredEscrows: jest.fn(),
    setRecipient: jest.fn(),
    getEscrowStats: jest.fn(),
    delete: jest.fn(),
    checkConditions: jest.fn(),
    updateConditionStatus: jest.fn(),
  };
}

function createMockEscrowService() {
  return {
    releaseEscrow: jest.fn().mockResolvedValue({
      success: true,
      escrow: createMockEscrow({ status: EscrowStatus.RELEASED, txHash: 'tx_release_123' }),
    }),
    refundEscrow: jest.fn().mockResolvedValue({
      success: true,
      escrow: createMockEscrow({ status: EscrowStatus.REFUNDED, txHash: 'tx_refund_123' }),
    }),
    checkConditions: jest.fn(),
    createEscrow: jest.fn(),
    getEscrowDetails: jest.fn(),
    scheduleConditionCheck: jest.fn(),
    notifyEscrowStatusChange: jest.fn(),
    processExpiredEscrows: jest.fn(),
    setConditionMonitor: jest.fn(),
    setNotificationService: jest.fn(),
  };
}

function createMockNotificationService() {
  return {
    notifyEscrowRelease: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRefund: jest.fn().mockResolvedValue({ success: true }),
    notifyTransactionComplete: jest.fn().mockResolvedValue({ success: true }),
    sendSystemAlert: jest.fn().mockResolvedValue({ success: true }),
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

function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('ConditionMonitorService', () => {
  let service: ConditionMonitorService;
  let mockEscrowRepo: ReturnType<typeof createMockEscrowRepository>;
  let mockEscrowService: ReturnType<typeof createMockEscrowService>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEscrowRepo = createMockEscrowRepository();
    mockEscrowService = createMockEscrowService();
    mockNotificationService = createMockNotificationService();
    mockQueue = createMockQueue();

    service = new ConditionMonitorService(
      mockEscrowRepo as any,
      mockEscrowService as any,
      mockNotificationService as any,
      { defaultCheckInterval: 5000, concurrency: 2 },
      mockQueue
    );
  });

  // ── registerQueueProcessor ──────────────────────────────────────────

  describe('registerQueueProcessor', () => {
    it('should register a processor on the queue with configured concurrency', () => {
      service.registerQueueProcessor();
      expect(mockQueue.process).toHaveBeenCalledWith(2, expect.any(Function));
    });
  });

  // ── startMonitoring ─────────────────────────────────────────────────

  describe('startMonitoring', () => {
    it('should add a repeatable job to the queue for an active escrow', async () => {
      await service.startMonitoring('escrow-1', 10000);

      expect(mockEscrowRepo.findById).toHaveBeenCalledWith('escrow-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        { escrowId: 'escrow-1', recurring: true },
        expect.objectContaining({
          repeat: { every: 10000 },
          jobId: 'condition-monitor-escrow-1',
        })
      );
    });

    it('should use default check interval when none is provided', async () => {
      await service.startMonitoring('escrow-1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        { escrowId: 'escrow-1', recurring: true },
        expect.objectContaining({
          repeat: { every: 5000 },
        })
      );
    });

    it('should track the escrow in the monitored set', async () => {
      await service.startMonitoring('escrow-1');
      expect(service.getMonitoredEscrows().has('escrow-1')).toBe(true);
    });

    it('should throw if escrow is not found', async () => {
      mockEscrowRepo.findById.mockResolvedValue(null);

      await expect(service.startMonitoring('nonexistent')).rejects.toThrow(
        'Escrow not found: nonexistent'
      );
    });

    it('should throw if escrow is not active', async () => {
      mockEscrowRepo.findById.mockResolvedValue(
        createMockEscrow({ status: EscrowStatus.RELEASED })
      );

      await expect(service.startMonitoring('escrow-1')).rejects.toThrow(
        'Escrow is not active'
      );
    });
  });

  // ── stopMonitoring ──────────────────────────────────────────────────

  describe('stopMonitoring', () => {
    it('should remove repeatable jobs and untrack the escrow', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'condition-monitor-escrow-1', key: 'key-1' },
        { id: 'condition-monitor-escrow-2', key: 'key-2' },
      ]);

      // First start monitoring so it's tracked
      await service.startMonitoring('escrow-1');
      expect(service.getMonitoredEscrows().has('escrow-1')).toBe(true);

      await service.stopMonitoring('escrow-1');

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('key-1');
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalledWith('key-2');
      expect(service.getMonitoredEscrows().has('escrow-1')).toBe(false);
    });

    it('should handle case where no repeatable jobs exist', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.stopMonitoring('escrow-1');

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  // ── evaluateCondition ───────────────────────────────────────────────

  describe('evaluateCondition', () => {
    const escrow = createMockEscrow();

    it('should evaluate time_based condition as met when target time is in the past', async () => {
      const condition: Condition = {
        type: 'time_based',
        parameters: { targetTime: new Date(Date.now() - 60000).toISOString() },
        validator: 'time_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(true);
    });

    it('should evaluate time_based condition as not met when target time is in the future', async () => {
      const condition: Condition = {
        type: 'time_based',
        parameters: { targetTime: new Date(Date.now() + 3600000).toISOString() },
        validator: 'time_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should evaluate time_based condition as false when targetTime is missing', async () => {
      const condition: Condition = {
        type: 'time_based',
        parameters: {},
        validator: 'time_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should evaluate manual_approval as met when approved is true', async () => {
      const condition: Condition = {
        type: 'manual_approval',
        parameters: { approved: true },
        validator: 'manual_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(true);
    });

    it('should evaluate manual_approval as not met when approved is false', async () => {
      const condition: Condition = {
        type: 'manual_approval',
        parameters: { approved: false },
        validator: 'manual_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should evaluate manual_approval as not met when approved is missing', async () => {
      const condition: Condition = {
        type: 'manual_approval',
        parameters: {},
        validator: 'manual_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should evaluate oracle_based as met when verified is true', async () => {
      const condition: Condition = {
        type: 'oracle_based',
        parameters: { verified: true },
        validator: 'oracle_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(true);
    });

    it('should evaluate oracle_based using value/threshold comparison', async () => {
      const condition: Condition = {
        type: 'oracle_based',
        parameters: { value: 150, threshold: 100 },
        validator: 'oracle_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(true);
    });

    it('should evaluate oracle_based as not met when value is below threshold', async () => {
      const condition: Condition = {
        type: 'oracle_based',
        parameters: { value: 50, threshold: 100 },
        validator: 'oracle_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should evaluate oracle_based as not met when no parameters match', async () => {
      const condition: Condition = {
        type: 'oracle_based',
        parameters: {},
        validator: 'oracle_validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });

    it('should return false for unknown condition types', async () => {
      const condition = {
        type: 'unknown_type' as any,
        parameters: {},
        validator: 'validator',
      };

      const result = await service.evaluateCondition(condition, escrow);
      expect(result).toBe(false);
    });
  });

  // ── evaluateAllConditions ───────────────────────────────────────────

  describe('evaluateAllConditions', () => {
    it('should evaluate all conditions and return statuses', async () => {
      const escrow = createMockEscrow({
        conditions: [
          {
            type: 'time_based',
            parameters: { targetTime: new Date(Date.now() - 60000).toISOString() },
            validator: 'time_validator',
          },
          {
            type: 'manual_approval',
            parameters: { approved: true },
            validator: 'manual_validator',
          },
        ],
      });

      const statuses = await service.evaluateAllConditions(escrow);

      expect(statuses).toHaveLength(2);
      expect(statuses[0]!.met).toBe(true);
      expect(statuses[1]!.met).toBe(true);
      expect(statuses[0]!.evidence).toContain('satisfied');
      expect(statuses[1]!.evidence).toContain('satisfied');
    });

    it('should return mixed statuses when some conditions are not met', async () => {
      const escrow = createMockEscrow({
        conditions: [
          {
            type: 'time_based',
            parameters: { targetTime: new Date(Date.now() - 60000).toISOString() },
            validator: 'time_validator',
          },
          {
            type: 'manual_approval',
            parameters: { approved: false },
            validator: 'manual_validator',
          },
        ],
      });

      const statuses = await service.evaluateAllConditions(escrow);

      expect(statuses).toHaveLength(2);
      expect(statuses[0]!.met).toBe(true);
      expect(statuses[1]!.met).toBe(false);
    });

    it('should return empty array for escrow with no conditions', async () => {
      const escrow = createMockEscrow({ conditions: [] });

      const statuses = await service.evaluateAllConditions(escrow);

      expect(statuses).toHaveLength(0);
    });
  });

  // ── processConditionCheckJob ────────────────────────────────────────

  describe('processConditionCheckJob', () => {
    it('should release escrow when all conditions are met', async () => {
      const escrow = createMockEscrow({
        conditions: [
          {
            type: 'time_based',
            parameters: { targetTime: new Date(Date.now() - 60000).toISOString() },
            validator: 'time_validator',
          },
          {
            type: 'manual_approval',
            parameters: { approved: true },
            validator: 'manual_validator',
          },
        ],
      });
      mockEscrowRepo.findById.mockResolvedValue(escrow);

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('released');
      expect(result.allMet).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(mockEscrowService.releaseEscrow).toHaveBeenCalledWith('escrow-1');
      expect(mockNotificationService.notifyEscrowRelease).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          escrowId: 'escrow-1',
          amount: '100',
        }),
        expect.objectContaining({ escrowId: 'escrow-1' })
      );
    });

    it('should refund escrow when it has expired', async () => {
      const escrow = createMockEscrow({
        expiresAt: new Date(Date.now() - 60000), // expired
      });
      mockEscrowRepo.findById.mockResolvedValue(escrow);

      // Override refundEscrow to succeed (the default mock already does this)
      // but we need to make sure the escrow's expiresAt check in refundEscrow passes
      mockEscrowService.refundEscrow.mockResolvedValue({
        success: true,
        escrow: createMockEscrow({ status: EscrowStatus.REFUNDED }),
      });

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('refunded');
      expect(result.isExpired).toBe(true);
      expect(mockEscrowService.refundEscrow).toHaveBeenCalledWith('escrow-1');
      expect(mockNotificationService.notifyEscrowRefund).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          escrowId: 'escrow-1',
          reason: expect.stringContaining('timeout'),
        }),
        expect.objectContaining({ escrowId: 'escrow-1' })
      );
    });

    it('should return pending when conditions are not all met', async () => {
      const escrow = createMockEscrow({
        conditions: [
          {
            type: 'manual_approval',
            parameters: { approved: false },
            validator: 'manual_validator',
          },
        ],
      });
      mockEscrowRepo.findById.mockResolvedValue(escrow);

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('pending');
      expect(result.allMet).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(mockEscrowService.releaseEscrow).not.toHaveBeenCalled();
      expect(mockEscrowService.refundEscrow).not.toHaveBeenCalled();
    });

    it('should return error and stop monitoring when escrow is not found', async () => {
      mockEscrowRepo.findById.mockResolvedValue(null);

      const result = await service.processConditionCheckJob({
        escrowId: 'nonexistent',
        recurring: true,
      });

      expect(result.action).toBe('error');
      expect(result.error).toBe('Escrow not found');
    });

    it('should stop monitoring and return pending when escrow is no longer active', async () => {
      mockEscrowRepo.findById.mockResolvedValue(
        createMockEscrow({ status: EscrowStatus.RELEASED })
      );

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('pending');
      expect(mockEscrowService.releaseEscrow).not.toHaveBeenCalled();
    });

    it('should return error when release fails', async () => {
      const escrow = createMockEscrow({
        conditions: [
          {
            type: 'manual_approval',
            parameters: { approved: true },
            validator: 'manual_validator',
          },
        ],
      });
      mockEscrowRepo.findById.mockResolvedValue(escrow);
      mockEscrowService.releaseEscrow.mockResolvedValue({
        success: false,
        error: 'Release failed due to network error',
      });

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('error');
      expect(result.error).toBe('Release failed due to network error');
      expect(result.allMet).toBe(true);
    });

    it('should return error when refund fails for expired escrow', async () => {
      const escrow = createMockEscrow({
        expiresAt: new Date(Date.now() - 60000),
      });
      mockEscrowRepo.findById.mockResolvedValue(escrow);
      mockEscrowService.refundEscrow.mockResolvedValue({
        success: false,
        error: 'Escrow is not active',
      });

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      expect(result.action).toBe('error');
      expect(result.isExpired).toBe(true);
      expect(result.error).toBe('Escrow is not active');
    });

    it('should handle escrow with no conditions as pending (not all met)', async () => {
      const escrow = createMockEscrow({ conditions: [] });
      mockEscrowRepo.findById.mockResolvedValue(escrow);

      const result = await service.processConditionCheckJob({
        escrowId: 'escrow-1',
        recurring: true,
      });

      // Empty conditions array → allMet is false (conditionStatuses.length === 0)
      expect(result.action).toBe('pending');
      expect(result.allMet).toBe(false);
    });
  });

  // ── checkAllActiveConditions ────────────────────────────────────────

  describe('checkAllActiveConditions', () => {
    it('should process all active and expired escrows', async () => {
      const activeEscrow = createMockEscrow({
        id: 'active-1',
        conditions: [
          {
            type: 'manual_approval',
            parameters: { approved: true },
            validator: 'manual_validator',
          },
        ],
      });
      const expiredEscrow = createMockEscrow({
        id: 'expired-1',
        expiresAt: new Date(Date.now() - 60000),
      });

      mockEscrowRepo.findActiveEscrows.mockResolvedValue([activeEscrow]);
      mockEscrowRepo.findExpiredEscrows.mockResolvedValue([expiredEscrow]);

      // findById needs to return the right escrow based on the ID
      mockEscrowRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'active-1') return activeEscrow;
        if (id === 'expired-1') return expiredEscrow;
        return null;
      });

      const results = await service.checkAllActiveConditions();

      expect(results).toHaveLength(2);
      expect(results[0]!.escrowId).toBe('active-1');
      expect(results[0]!.action).toBe('released');
      expect(results[1]!.escrowId).toBe('expired-1');
      expect(results[1]!.action).toBe('refunded');
    });

    it('should return empty array when no active or expired escrows exist', async () => {
      mockEscrowRepo.findActiveEscrows.mockResolvedValue([]);
      mockEscrowRepo.findExpiredEscrows.mockResolvedValue([]);

      const results = await service.checkAllActiveConditions();

      expect(results).toHaveLength(0);
    });

    it('should handle errors gracefully and return empty array', async () => {
      mockEscrowRepo.findActiveEscrows.mockRejectedValue(new Error('DB error'));

      const results = await service.checkAllActiveConditions();

      expect(results).toHaveLength(0);
    });
  });

  // ── shutdown ────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should close the queue and clear monitored escrows', async () => {
      // Start monitoring first
      await service.startMonitoring('escrow-1');
      expect(service.getMonitoredEscrows().size).toBe(1);

      await service.shutdown();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(service.getMonitoredEscrows().size).toBe(0);
    });
  });

  // ── getQueue ────────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('should return the underlying Bull queue', () => {
      expect(service.getQueue()).toBe(mockQueue);
    });
  });
});
