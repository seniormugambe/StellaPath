import { PrismaClient } from '@prisma/client';
import { UserRepository, TransactionRepository, InvoiceRepository, EscrowRepository, NotificationRepository } from '../repositories';
import { TransactionType, TransactionStatus, InvoiceStatus, EscrowStatus, NotificationType } from '../types/database';

// Mock Prisma Client for testing
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  transactionRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn()
  },
  invoiceRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn()
  },
  escrowRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn()
  },
  notificationRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  }
} as unknown as PrismaClient;

describe('Database Schema and ORM', () => {
  let userRepo: UserRepository;
  let transactionRepo: TransactionRepository;
  let invoiceRepo: InvoiceRepository;
  let escrowRepo: EscrowRepository;
  let notificationRepo: NotificationRepository;

  beforeEach(() => {
    userRepo = new UserRepository(mockPrisma);
    transactionRepo = new TransactionRepository(mockPrisma);
    invoiceRepo = new InvoiceRepository(mockPrisma);
    escrowRepo = new EscrowRepository(mockPrisma);
    notificationRepo = new NotificationRepository(mockPrisma);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('UserRepository', () => {
    it('should create a user with default preferences', async () => {
      const mockUser = {
        id: 'user1',
        walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH',
        email: 'test@example.com',
        displayName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          currency: 'XLM',
          timezone: 'UTC',
          language: 'en',
          emailNotifications: true,
          pushNotifications: true
        },
        notificationSettings: {
          invoiceUpdates: true,
          transactionConfirmations: true,
          escrowUpdates: true,
          systemAlerts: true
        }
      };

      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepo.create({
        walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH',
        email: 'test@example.com',
        displayName: 'Test User'
      });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH',
          email: 'test@example.com',
          displayName: 'Test User'
        })
      });
    });

    it('should find user by wallet address', async () => {
      const mockUser = {
        id: 'user1',
        walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH',
        preferences: '{}',
        notificationSettings: '{}'
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepo.findByWalletAddress('GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH');

      expect(result).toBeDefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH' }
      });
    });
  });

  describe('TransactionRepository', () => {
    it('should create a transaction record', async () => {
      const mockTransaction = {
        id: 'tx1',
        userId: 'user1',
        type: TransactionType.BASIC,
        txHash: 'hash123',
        status: TransactionStatus.PENDING,
        amount: 100,
        sender: 'sender_address',
        recipient: 'recipient_address',
        timestamp: new Date(),
        fees: 0.00001,
        metadata: {}
      };

      (mockPrisma.transactionRecord.create as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await transactionRepo.create({
        userId: 'user1',
        type: TransactionType.BASIC,
        txHash: 'hash123',
        amount: 100,
        sender: 'sender_address',
        recipient: 'recipient_address'
      });

      expect(result).toEqual(mockTransaction);
      expect(mockPrisma.transactionRecord.create).toHaveBeenCalled();
    });

    it('should find transaction by hash', async () => {
      const mockTransaction = {
        id: 'tx1',
        txHash: 'hash123',
        metadata: '{}',
        user: { id: 'user1', walletAddress: 'address', displayName: 'User' }
      };

      (mockPrisma.transactionRecord.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await transactionRepo.findByTxHash('hash123');

      expect(result).toBeDefined();
      expect(mockPrisma.transactionRecord.findUnique).toHaveBeenCalledWith({
        where: { txHash: 'hash123' },
        include: expect.any(Object)
      });
    });
  });

  describe('InvoiceRepository', () => {
    it('should create an invoice record', async () => {
      const mockInvoice = {
        id: 'inv1',
        creatorId: 'user1',
        clientEmail: 'client@example.com',
        amount: 250.75,
        description: 'Test invoice',
        status: InvoiceStatus.DRAFT,
        dueDate: new Date(),
        approvalToken: 'token123',
        metadata: {},
        creator: { id: 'user1', walletAddress: 'address', displayName: 'Creator' }
      };

      (mockPrisma.invoiceRecord.create as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await invoiceRepo.create({
        creatorId: 'user1',
        clientEmail: 'client@example.com',
        amount: 250.75,
        description: 'Test invoice',
        dueDate: new Date()
      });

      expect(result).toEqual(mockInvoice);
      expect(mockPrisma.invoiceRecord.create).toHaveBeenCalled();
    });

    it('should find invoice by approval token', async () => {
      const mockInvoice = {
        id: 'inv1',
        approvalToken: 'token123',
        metadata: '{}',
        creator: { displayName: 'Creator' }
      };

      (mockPrisma.invoiceRecord.findUnique as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await invoiceRepo.findByApprovalToken('token123');

      expect(result).toBeDefined();
      expect(mockPrisma.invoiceRecord.findUnique).toHaveBeenCalledWith({
        where: { approvalToken: 'token123' },
        include: expect.any(Object)
      });
    });
  });

  describe('EscrowRepository', () => {
    it('should create an escrow record', async () => {
      const mockEscrow = {
        id: 'escrow1',
        contractId: 'contract123',
        creatorId: 'user1',
        amount: 500,
        status: EscrowStatus.ACTIVE,
        conditions: [],
        expiresAt: new Date(),
        creator: { id: 'user1', walletAddress: 'address', displayName: 'Creator' }
      };

      (mockPrisma.escrowRecord.create as jest.Mock).mockResolvedValue(mockEscrow);

      const result = await escrowRepo.create({
        contractId: 'contract123',
        creatorId: 'user1',
        amount: 500,
        conditions: [],
        expiresAt: new Date()
      });

      expect(result).toEqual(mockEscrow);
      expect(mockPrisma.escrowRecord.create).toHaveBeenCalled();
    });

    it('should find escrow by contract ID', async () => {
      const mockEscrow = {
        id: 'escrow1',
        contractId: 'contract123',
        conditions: '[]',
        creator: { id: 'user1', walletAddress: 'address', displayName: 'Creator' }
      };

      (mockPrisma.escrowRecord.findUnique as jest.Mock).mockResolvedValue(mockEscrow);

      const result = await escrowRepo.findByContractId('contract123');

      expect(result).toBeDefined();
      expect(mockPrisma.escrowRecord.findUnique).toHaveBeenCalledWith({
        where: { contractId: 'contract123' },
        include: expect.any(Object)
      });
    });
  });

  describe('NotificationRepository', () => {
    it('should create a notification record', async () => {
      const mockNotification = {
        id: 'notif1',
        userId: 'user1',
        type: NotificationType.TRANSACTION_CONFIRMED,
        title: 'Transaction Confirmed',
        message: 'Your transaction has been confirmed',
        read: false,
        createdAt: new Date(),
        metadata: {},
        user: { id: 'user1', walletAddress: 'address', displayName: 'User' }
      };

      (mockPrisma.notificationRecord.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await notificationRepo.create({
        userId: 'user1',
        type: NotificationType.TRANSACTION_CONFIRMED,
        title: 'Transaction Confirmed',
        message: 'Your transaction has been confirmed'
      });

      expect(result).toEqual(mockNotification);
      expect(mockPrisma.notificationRecord.create).toHaveBeenCalled();
    });

    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notif1',
        read: true,
        metadata: '{}',
        user: { id: 'user1', walletAddress: 'address', displayName: 'User' }
      };

      (mockPrisma.notificationRecord.update as jest.Mock).mockResolvedValue(mockNotification);

      const result = await notificationRepo.markAsRead('notif1');

      expect(result.read).toBe(true);
      expect(mockPrisma.notificationRecord.update).toHaveBeenCalledWith({
        where: { id: 'notif1' },
        data: { read: true },
        include: expect.any(Object)
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct enum values', () => {
      expect(Object.values(TransactionType)).toContain('BASIC');
      expect(Object.values(TransactionType)).toContain('ESCROW');
      expect(Object.values(TransactionType)).toContain('P2P');
      expect(Object.values(TransactionType)).toContain('INVOICE');

      expect(Object.values(TransactionStatus)).toContain('PENDING');
      expect(Object.values(TransactionStatus)).toContain('CONFIRMED');
      expect(Object.values(TransactionStatus)).toContain('FAILED');
      expect(Object.values(TransactionStatus)).toContain('CANCELLED');

      expect(Object.values(InvoiceStatus)).toContain('DRAFT');
      expect(Object.values(InvoiceStatus)).toContain('SENT');
      expect(Object.values(InvoiceStatus)).toContain('APPROVED');
      expect(Object.values(InvoiceStatus)).toContain('EXECUTED');
      expect(Object.values(InvoiceStatus)).toContain('REJECTED');
      expect(Object.values(InvoiceStatus)).toContain('EXPIRED');

      expect(Object.values(EscrowStatus)).toContain('ACTIVE');
      expect(Object.values(EscrowStatus)).toContain('CONDITIONS_MET');
      expect(Object.values(EscrowStatus)).toContain('RELEASED');
      expect(Object.values(EscrowStatus)).toContain('REFUNDED');
      expect(Object.values(EscrowStatus)).toContain('EXPIRED');

      expect(Object.values(NotificationType)).toContain('INVOICE_RECEIVED');
      expect(Object.values(NotificationType)).toContain('TRANSACTION_CONFIRMED');
      expect(Object.values(NotificationType)).toContain('ESCROW_RELEASED');
    });
  });
});