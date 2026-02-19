/**
 * Unit tests for TransactionStatusSyncService (Task 7.3)
 *
 * Tests periodic Stellar network status checking, automatic transaction
 * status updates, retry logic with exponential backoff, and notification
 * delivery on status changes.
 *
 * Validates: Requirements 1.4, 7.3, 8.4
 */

import { TransactionStatus, TransactionType } from '../types/database';
import type { TransactionRecord } from '../types/database';
import { TransactionStatusSyncService } from '../services/TransactionStatusSyncService';

// ── Mock factories ────────────────────────────────────────────────────

function createMockTransaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: 'tx-1',
    userId: 'user-1',
    type: TransactionType.BASIC,
    txHash: 'abc123hash',
    status: TransactionStatus.PENDING,
    amount: 100,
    sender: 'GABCDEF',
    recipient: 'GHIJKLM',
    timestamp: new Date(),
    blockHeight: null,
    fees: 100,
    metadata: { memo: 'test' },
    ...overrides,
  } as TransactionRecord;
}

function createMockTransactionRepository() {
  return {
    findByTxHash: jest.fn().mockResolvedValue(createMockTransaction()),
    findPendingTransactions: jest.fn().mockResolvedValue([]),
    updateStatusByTxHash: jest.fn().mockResolvedValue(createMockTransaction()),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    getTransactionStats: jest.fn(),
    delete: jest.fn(),
  };
}

function createMockNotificationService() {
  return {
    notifyTransactionComplete: jest.fn().mockResolvedValue({ success: true }),
    sendSystemAlert: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRelease: jest.fn().mockResolvedValue({ success: true }),
    notifyEscrowRefund: jest.fn().mockResolvedValue({ success: true }),
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
    getJob: jest.fn().mockResolvedValue(null),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('TransactionStatusSyncService', () => {
  let service: TransactionStatusSyncService;
  let mockTxRepo: ReturnType<typeof createMockTransactionRepository>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTxRepo = createMockTransactionRepository();
    mockNotificationService = createMockNotificationService();
    mockQueue = createMockQueue();

    service = new TransactionStatusSyncService(
      mockTxRepo as any,
      mockNotificationService as any,
      {
        concurrency: 2,
        maxRetries: 3,
        backoffDelay: 100,
        maxBackoffDelay: 1000,
        horizonUrl: 'https://horizon-testnet.stellar.org',
      },
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

  // ── startPeriodicSync / stopPeriodicSync ────────────────────────────

  describe('startPeriodicSync', () => {
    it('should add a repeatable batch job to the queue', async () => {
      await service.startPeriodicSync(15000);

      expect(mockQueue.add).toHaveBeenCalledWith(
        { txHash: '', batch: true, retryCount: 0 },
        expect.objectContaining({
          repeat: { every: 15000 },
          jobId: 'periodic-transaction-sync',
        }),
      );
    });

    it('should use default sync interval when none is provided', async () => {
      await service.startPeriodicSync();

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          repeat: { every: 30000 },
        }),
      );
    });
  });

  describe('stopPeriodicSync', () => {
    it('should remove the repeatable periodic sync job', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'periodic-transaction-sync', key: 'sync-key-1' },
        { id: 'other-job', key: 'other-key' },
      ]);

      await service.stopPeriodicSync();

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('sync-key-1');
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalledWith('other-key');
    });

    it('should handle case where no repeatable jobs exist', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.stopPeriodicSync();

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  // ── syncTransactionStatus ───────────────────────────────────────────

  describe('syncTransactionStatus', () => {
    it('should return unchanged result when transaction is not found in database', async () => {
      mockTxRepo.findByTxHash.mockResolvedValue(null);

      const result = await service.syncTransactionStatus('unknown-hash');

      expect(result.changed).toBe(false);
      expect(result.error).toBe('Transaction not found in database');
    });

    it('should skip sync for already confirmed transactions', async () => {
      mockTxRepo.findByTxHash.mockResolvedValue(
        createMockTransaction({ status: TransactionStatus.CONFIRMED }),
      );

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(false);
      expect(result.previousStatus).toBe(TransactionStatus.CONFIRMED);
      expect(result.newStatus).toBe(TransactionStatus.CONFIRMED);
    });

    it('should skip sync for already failed transactions', async () => {
      mockTxRepo.findByTxHash.mockResolvedValue(
        createMockTransaction({ status: TransactionStatus.FAILED }),
      );

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(false);
      expect(result.previousStatus).toBe(TransactionStatus.FAILED);
    });

    it('should skip sync for cancelled transactions', async () => {
      mockTxRepo.findByTxHash.mockResolvedValue(
        createMockTransaction({ status: TransactionStatus.CANCELLED }),
      );

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(false);
      expect(result.previousStatus).toBe(TransactionStatus.CANCELLED);
    });

    it('should update status and notify when network confirms transaction', async () => {
      const pendingTx = createMockTransaction({ status: TransactionStatus.PENDING });
      mockTxRepo.findByTxHash.mockResolvedValue(pendingTx);

      // Mock queryNetworkStatus to return CONFIRMED
      jest.spyOn(service, 'queryNetworkStatus').mockResolvedValue(TransactionStatus.CONFIRMED);

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(true);
      expect(result.previousStatus).toBe(TransactionStatus.PENDING);
      expect(result.newStatus).toBe(TransactionStatus.CONFIRMED);
      expect(result.notified).toBe(true);

      expect(mockTxRepo.updateStatusByTxHash).toHaveBeenCalledWith('abc123hash', {
        status: TransactionStatus.CONFIRMED,
        metadata: expect.objectContaining({
          lastSyncedAt: expect.any(String),
          syncSource: 'horizon',
        }),
      });

      expect(mockNotificationService.notifyTransactionComplete).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          transactionHash: 'abc123hash',
          amount: '100',
          currency: 'XLM',
        }),
        expect.objectContaining({ transactionId: 'tx-1' }),
      );
    });

    it('should send system alert when transaction fails on network', async () => {
      const pendingTx = createMockTransaction({ status: TransactionStatus.PENDING });
      mockTxRepo.findByTxHash.mockResolvedValue(pendingTx);

      jest.spyOn(service, 'queryNetworkStatus').mockResolvedValue(TransactionStatus.FAILED);

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(TransactionStatus.FAILED);
      expect(result.notified).toBe(true);

      expect(mockNotificationService.sendSystemAlert).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          title: 'Transaction Failed',
          message: expect.stringContaining('abc123hash'),
        }),
      );
    });

    it('should return unchanged when network status matches current status', async () => {
      const pendingTx = createMockTransaction({ status: TransactionStatus.PENDING });
      mockTxRepo.findByTxHash.mockResolvedValue(pendingTx);

      jest.spyOn(service, 'queryNetworkStatus').mockResolvedValue(TransactionStatus.PENDING);

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(false);
      expect(result.notified).toBe(false);
      expect(mockTxRepo.updateStatusByTxHash).not.toHaveBeenCalled();
    });

    it('should handle notification failure gracefully', async () => {
      const pendingTx = createMockTransaction({ status: TransactionStatus.PENDING });
      mockTxRepo.findByTxHash.mockResolvedValue(pendingTx);

      jest.spyOn(service, 'queryNetworkStatus').mockResolvedValue(TransactionStatus.CONFIRMED);
      mockNotificationService.notifyTransactionComplete.mockRejectedValue(
        new Error('Notification service down'),
      );

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(true);
      expect(result.notified).toBe(false);
      // Status should still be updated even if notification fails
      expect(mockTxRepo.updateStatusByTxHash).toHaveBeenCalled();
    });

    it('should handle network query errors gracefully', async () => {
      const pendingTx = createMockTransaction({ status: TransactionStatus.PENDING });
      mockTxRepo.findByTxHash.mockResolvedValue(pendingTx);

      jest.spyOn(service, 'queryNetworkStatus').mockRejectedValue(
        new Error('Network timeout'),
      );

      const result = await service.syncTransactionStatus('abc123hash');

      expect(result.changed).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  // ── syncAllPendingTransactions ──────────────────────────────────────

  describe('syncAllPendingTransactions', () => {
    it('should sync all pending transactions and return batch result', async () => {
      const tx1 = createMockTransaction({ id: 'tx-1', txHash: 'hash1' });
      const tx2 = createMockTransaction({ id: 'tx-2', txHash: 'hash2' });
      mockTxRepo.findPendingTransactions.mockResolvedValue([tx1, tx2]);

      // Mock individual sync
      jest.spyOn(service, 'syncTransactionStatus')
        .mockResolvedValueOnce({
          txHash: 'hash1',
          previousStatus: TransactionStatus.PENDING,
          newStatus: TransactionStatus.CONFIRMED,
          changed: true,
          notified: true,
        })
        .mockResolvedValueOnce({
          txHash: 'hash2',
          previousStatus: TransactionStatus.PENDING,
          newStatus: TransactionStatus.PENDING,
          changed: false,
          notified: false,
        });

      const result = await service.syncAllPendingTransactions();

      expect(result.total).toBe(2);
      expect(result.synced).toBe(2);
      expect(result.changed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should return empty result when no pending transactions exist', async () => {
      mockTxRepo.findPendingTransactions.mockResolvedValue([]);

      const result = await service.syncAllPendingTransactions();

      expect(result.total).toBe(0);
      expect(result.synced).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should count failed syncs correctly', async () => {
      const tx1 = createMockTransaction({ id: 'tx-1', txHash: 'hash1' });
      mockTxRepo.findPendingTransactions.mockResolvedValue([tx1]);

      jest.spyOn(service, 'syncTransactionStatus').mockResolvedValue({
        txHash: 'hash1',
        previousStatus: TransactionStatus.PENDING,
        newStatus: TransactionStatus.PENDING,
        changed: false,
        notified: false,
        error: 'Network error',
      });

      const result = await service.syncAllPendingTransactions();

      expect(result.failed).toBe(1);
    });

    it('should prevent concurrent batch syncs', async () => {
      const tx1 = createMockTransaction({ id: 'tx-1', txHash: 'hash1' });
      mockTxRepo.findPendingTransactions.mockResolvedValue([tx1]);

      // Make the sync take some time
      jest.spyOn(service, 'syncTransactionStatus').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          txHash: 'hash1',
          previousStatus: TransactionStatus.PENDING,
          newStatus: TransactionStatus.CONFIRMED,
          changed: true,
          notified: true,
        }), 50)),
      );

      // Start two concurrent syncs
      const [result1, result2] = await Promise.all([
        service.syncAllPendingTransactions(),
        service.syncAllPendingTransactions(),
      ]);

      // One should have processed, the other should have been skipped
      const totalProcessed = result1.total + result2.total;
      expect(totalProcessed).toBe(1); // Only one should have processed
    });

    it('should handle repository errors gracefully', async () => {
      mockTxRepo.findPendingTransactions.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.syncAllPendingTransactions();

      expect(result.total).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should reset isSyncing flag after completion', async () => {
      mockTxRepo.findPendingTransactions.mockResolvedValue([]);

      await service.syncAllPendingTransactions();

      expect(service.getIsSyncing()).toBe(false);
    });

    it('should reset isSyncing flag even after error', async () => {
      mockTxRepo.findPendingTransactions.mockRejectedValue(new Error('DB error'));

      await service.syncAllPendingTransactions();

      expect(service.getIsSyncing()).toBe(false);
    });
  });

  // ── enqueueSyncJob ──────────────────────────────────────────────────

  describe('enqueueSyncJob', () => {
    it('should add a single sync job to the queue', async () => {
      await service.enqueueSyncJob('hash123');

      expect(mockQueue.add).toHaveBeenCalledWith(
        { txHash: 'hash123', batch: false, retryCount: 0 },
        expect.objectContaining({
          jobId: expect.stringContaining('sync-hash123-'),
        }),
      );
    });
  });

  // ── queryNetworkStatus ──────────────────────────────────────────────

  describe('queryNetworkStatus', () => {
    it('should return CONFIRMED for successful transactions', async () => {
      // Mock the Horizon server response
      const mockCall = jest.fn().mockResolvedValue({ successful: true });
      const mockTransaction = jest.fn().mockReturnValue({ call: mockCall });
      const mockTransactions = jest.fn().mockReturnValue({ transaction: mockTransaction });
      (service as any).server = { transactions: mockTransactions };

      const status = await service.queryNetworkStatus('hash123');

      expect(status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should return FAILED for unsuccessful transactions', async () => {
      const mockCall = jest.fn().mockResolvedValue({ successful: false });
      const mockTransaction = jest.fn().mockReturnValue({ call: mockCall });
      const mockTransactions = jest.fn().mockReturnValue({ transaction: mockTransaction });
      (service as any).server = { transactions: mockTransactions };

      const status = await service.queryNetworkStatus('hash123');

      expect(status).toBe(TransactionStatus.FAILED);
    });

    it('should return PENDING for 404 Not Found errors', async () => {
      const notFoundError = { response: { status: 404 }, name: 'NotFoundError' };
      const mockCall = jest.fn().mockRejectedValue(notFoundError);
      const mockTransaction = jest.fn().mockReturnValue({ call: mockCall });
      const mockTransactions = jest.fn().mockReturnValue({ transaction: mockTransaction });
      (service as any).server = { transactions: mockTransactions };

      const status = await service.queryNetworkStatus('hash123');

      expect(status).toBe(TransactionStatus.PENDING);
    });

    it('should retry on network errors with exponential backoff', async () => {
      const networkError = new Error('ECONNREFUSED');
      let callCount = 0;

      const mockCall = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(networkError);
        }
        return Promise.resolve({ successful: true });
      });
      const mockTransaction = jest.fn().mockReturnValue({ call: mockCall });
      const mockTransactions = jest.fn().mockReturnValue({ transaction: mockTransaction });
      (service as any).server = { transactions: mockTransactions };

      const status = await service.queryNetworkStatus('hash123');

      expect(status).toBe(TransactionStatus.CONFIRMED);
      expect(callCount).toBe(3); // 2 failures + 1 success
    });

    it('should throw after exhausting all retries', async () => {
      const networkError = new Error('ECONNREFUSED');
      const mockCall = jest.fn().mockRejectedValue(networkError);
      const mockTransaction = jest.fn().mockReturnValue({ call: mockCall });
      const mockTransactions = jest.fn().mockReturnValue({ transaction: mockTransaction });
      (service as any).server = { transactions: mockTransactions };

      await expect(service.queryNetworkStatus('hash123')).rejects.toThrow('ECONNREFUSED');

      // Should have tried maxRetries + 1 times (initial + retries)
      expect(mockCall).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // ── calculateBackoffDelay ───────────────────────────────────────────

  describe('calculateBackoffDelay', () => {
    it('should increase delay exponentially with each attempt', () => {
      // With backoffDelay=100, attempt 0 → ~100, attempt 1 → ~200, attempt 2 → ~400
      const delay0 = service.calculateBackoffDelay(0);
      const delay1 = service.calculateBackoffDelay(1);
      const delay2 = service.calculateBackoffDelay(2);

      // Allow for jitter (±25%)
      expect(delay0).toBeGreaterThanOrEqual(75);
      expect(delay0).toBeLessThanOrEqual(125);
      expect(delay1).toBeGreaterThanOrEqual(150);
      expect(delay1).toBeLessThanOrEqual(250);
      expect(delay2).toBeGreaterThanOrEqual(300);
      expect(delay2).toBeLessThanOrEqual(500);
    });

    it('should cap delay at maxBackoffDelay', () => {
      // With maxBackoffDelay=1000, a very high attempt should be capped
      const delay = service.calculateBackoffDelay(20);
      expect(delay).toBeLessThanOrEqual(1000);
    });

    it('should never return a negative delay', () => {
      for (let i = 0; i < 10; i++) {
        const delay = service.calculateBackoffDelay(i);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── shutdown ────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should stop periodic sync and close the queue', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'periodic-transaction-sync', key: 'sync-key' },
      ]);

      await service.shutdown();

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('sync-key');
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  // ── getQueue ────────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('should return the underlying Bull queue', () => {
      expect(service.getQueue()).toBe(mockQueue);
    });
  });

  // ── getIsSyncing ────────────────────────────────────────────────────

  describe('getIsSyncing', () => {
    it('should return false initially', () => {
      expect(service.getIsSyncing()).toBe(false);
    });
  });
});
