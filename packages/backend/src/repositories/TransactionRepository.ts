import { PrismaClient } from '@prisma/client';
import { 
  TransactionRecord, 
  CreateTransactionRequest, 
  UpdateTransactionStatusRequest,
  TransactionFilters,
  PaginationOptions,
  PaginatedResponse,
  TransactionStatus,
  TransactionType
} from '../types/database';

export class TransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTransactionRequest): Promise<TransactionRecord> {
    const transaction = await this.prisma.transactionRecord.create({
      data: {
        userId: data.userId,
        type: data.type,
        txHash: data.txHash,
        amount: data.amount,
        sender: data.sender,
        recipient: data.recipient,
        fees: data.fees || 0,
        metadata: data.metadata || {}
      }
    });

    return this.mapToTransaction(transaction);
  }

  async findById(id: string): Promise<TransactionRecord | null> {
    const transaction = await this.prisma.transactionRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return transaction ? this.mapToTransaction(transaction) : null;
  }

  async findByTxHash(txHash: string): Promise<TransactionRecord | null> {
    const transaction = await this.prisma.transactionRecord.findUnique({
      where: { txHash },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return transaction ? this.mapToTransaction(transaction) : null;
  }

  async findByUserId(
    userId: string, 
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<TransactionRecord>> {
    const where: any = { userId };

    // Apply filters
    if (filters) {
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }
      if (filters.minAmount || filters.maxAmount) {
        where.amount = {};
        if (filters.minAmount) where.amount.gte = filters.minAmount;
        if (filters.maxAmount) where.amount.lte = filters.maxAmount;
      }
    }

    // Pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    // Sorting
    const orderBy: any = {};
    if (pagination?.sortBy) {
      orderBy[pagination.sortBy] = pagination.sortOrder || 'desc';
    } else {
      orderBy.timestamp = 'desc';
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transactionRecord.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
              displayName: true
            }
          }
        }
      }),
      this.prisma.transactionRecord.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: transactions.map(tx => this.mapToTransaction(tx)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async updateStatus(id: string, data: UpdateTransactionStatusRequest): Promise<TransactionRecord> {
    const updateData: any = {
      status: data.status
    };

    if (data.blockHeight) updateData.blockHeight = data.blockHeight;
    if (data.metadata) {
      // Merge with existing metadata
      const existing = await this.prisma.transactionRecord.findUnique({
        where: { id },
        select: { metadata: true }
      });
      
      updateData.metadata = {
        ...(existing?.metadata as object || {}),
        ...data.metadata
      };
    }

    const transaction = await this.prisma.transactionRecord.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToTransaction(transaction);
  }

  async updateStatusByTxHash(txHash: string, data: UpdateTransactionStatusRequest): Promise<TransactionRecord> {
    const updateData: any = {
      status: data.status
    };

    if (data.blockHeight) updateData.blockHeight = data.blockHeight;
    if (data.metadata) {
      // Merge with existing metadata
      const existing = await this.prisma.transactionRecord.findUnique({
        where: { txHash },
        select: { metadata: true }
      });
      
      updateData.metadata = {
        ...(existing?.metadata as object || {}),
        ...data.metadata
      };
    }

    const transaction = await this.prisma.transactionRecord.update({
      where: { txHash },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToTransaction(transaction);
  }

  async findPendingTransactions(): Promise<TransactionRecord[]> {
    const transactions = await this.prisma.transactionRecord.findMany({
      where: { status: TransactionStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return transactions.map(tx => this.mapToTransaction(tx));
  }

  async getTransactionStats(userId?: string): Promise<{
    total: number;
    byType: Record<TransactionType, number>;
    byStatus: Record<TransactionStatus, number>;
    totalVolume: number;
  }> {
    const where = userId ? { userId } : {};

    const [total, byType, byStatus, volumeResult] = await Promise.all([
      this.prisma.transactionRecord.count({ where }),
      this.prisma.transactionRecord.groupBy({
        by: ['type'],
        where,
        _count: { type: true }
      }),
      this.prisma.transactionRecord.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.prisma.transactionRecord.aggregate({
        where: { ...where, status: TransactionStatus.CONFIRMED },
        _sum: { amount: true }
      })
    ]);

    const typeStats = Object.values(TransactionType).reduce((acc, type) => {
      acc[type] = byType.find(item => item.type === type)?._count.type || 0;
      return acc;
    }, {} as Record<TransactionType, number>);

    const statusStats = Object.values(TransactionStatus).reduce((acc, status) => {
      acc[status] = byStatus.find(item => item.status === status)?._count.status || 0;
      return acc;
    }, {} as Record<TransactionStatus, number>);

    return {
      total,
      byType: typeStats,
      byStatus: statusStats,
      totalVolume: Number(volumeResult._sum.amount || 0)
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transactionRecord.delete({
      where: { id }
    });
  }

  private mapToTransaction(transaction: any): TransactionRecord {
    return {
      ...transaction,
      metadata: typeof transaction.metadata === 'string' 
        ? JSON.parse(transaction.metadata) 
        : transaction.metadata
    };
  }
}