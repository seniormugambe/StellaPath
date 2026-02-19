import { PrismaClient, Prisma } from '@prisma/client';
import { 
  EscrowRecord, 
  CreateEscrowRequest, 
  UpdateEscrowStatusRequest,
  EscrowStatus,
  ConditionStatus
} from '../types/database';

export class EscrowRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateEscrowRequest): Promise<EscrowRecord> {
    const escrow = await this.prisma.escrowRecord.create({
      data: {
        contractId: data.contractId,
        creatorId: data.creatorId,
        recipientId: data.recipientId ?? null,
        amount: data.amount,
        conditions: data.conditions as unknown as Prisma.InputJsonValue,
        expiresAt: data.expiresAt
      },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToEscrow(escrow);
  }

  async findById(id: string): Promise<EscrowRecord | null> {
    const escrow = await this.prisma.escrowRecord.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return escrow ? this.mapToEscrow(escrow) : null;
  }

  async findByContractId(contractId: string): Promise<EscrowRecord | null> {
    const escrow = await this.prisma.escrowRecord.findUnique({
      where: { contractId },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return escrow ? this.mapToEscrow(escrow) : null;
  }

  async findByCreatorId(creatorId: string): Promise<EscrowRecord[]> {
    const escrows = await this.prisma.escrowRecord.findMany({
      where: { creatorId },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return escrows.map(escrow => this.mapToEscrow(escrow));
  }

  async findByRecipientId(recipientId: string): Promise<EscrowRecord[]> {
    const escrows = await this.prisma.escrowRecord.findMany({
      where: { recipientId },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return escrows.map(escrow => this.mapToEscrow(escrow));
  }

  async findActiveEscrows(): Promise<EscrowRecord[]> {
    const now = new Date();
    const escrows = await this.prisma.escrowRecord.findMany({
      where: {
        status: EscrowStatus.ACTIVE,
        expiresAt: { gt: now }
      },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return escrows.map(escrow => this.mapToEscrow(escrow));
  }

  async findExpiredEscrows(): Promise<EscrowRecord[]> {
    const now = new Date();
    const escrows = await this.prisma.escrowRecord.findMany({
      where: {
        status: EscrowStatus.ACTIVE,
        expiresAt: { lte: now }
      },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return escrows.map(escrow => this.mapToEscrow(escrow));
  }

  async updateStatus(id: string, data: UpdateEscrowStatusRequest): Promise<EscrowRecord> {
    const updateData: any = {
      status: data.status
    };

    if (data.releasedAt) updateData.releasedAt = data.releasedAt;
    if (data.txHash) updateData.txHash = data.txHash;

    const escrow = await this.prisma.escrowRecord.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToEscrow(escrow);
  }

  async updateStatusByContractId(contractId: string, data: UpdateEscrowStatusRequest): Promise<EscrowRecord> {
    const updateData: any = {
      status: data.status
    };

    if (data.releasedAt) updateData.releasedAt = data.releasedAt;
    if (data.txHash) updateData.txHash = data.txHash;

    const escrow = await this.prisma.escrowRecord.update({
      where: { contractId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToEscrow(escrow);
  }

  async markExpiredEscrows(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.escrowRecord.updateMany({
      where: {
        status: EscrowStatus.ACTIVE,
        expiresAt: { lte: now }
      },
      data: {
        status: EscrowStatus.EXPIRED
      }
    });

    return result.count;
  }

  async setRecipient(id: string, recipientId: string): Promise<EscrowRecord> {
    const escrow = await this.prisma.escrowRecord.update({
      where: { id },
      data: { recipientId },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true
          }
        }
      }
    });

    return this.mapToEscrow(escrow);
  }

  async getEscrowStats(userId?: string): Promise<{
    total: number;
    byStatus: Record<EscrowStatus, number>;
    totalAmount: number;
    activeAmount: number;
    releasedAmount: number;
  }> {
    const where = userId ? { creatorId: userId } : {};

    const [total, byStatus, amounts] = await Promise.all([
      this.prisma.escrowRecord.count({ where }),
      this.prisma.escrowRecord.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.prisma.escrowRecord.aggregate({
        where,
        _sum: { amount: true }
      })
    ]);

    const [activeAmountResult, releasedAmountResult] = await Promise.all([
      this.prisma.escrowRecord.aggregate({
        where: { ...where, status: EscrowStatus.ACTIVE },
        _sum: { amount: true }
      }),
      this.prisma.escrowRecord.aggregate({
        where: { ...where, status: EscrowStatus.RELEASED },
        _sum: { amount: true }
      })
    ]);

    const statusStats = Object.values(EscrowStatus).reduce((acc, status) => {
      acc[status] = byStatus.find(item => item.status === status)?._count.status || 0;
      return acc;
    }, {} as Record<EscrowStatus, number>);

    return {
      total,
      byStatus: statusStats,
      totalAmount: Number(amounts._sum.amount || 0),
      activeAmount: Number(activeAmountResult._sum.amount || 0),
      releasedAmount: Number(releasedAmountResult._sum.amount || 0)
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.escrowRecord.delete({
      where: { id }
    });
  }

  // Helper methods for condition management
  async checkConditions(escrowId: string): Promise<ConditionStatus[]> {
    const escrow = await this.findById(escrowId);
    if (!escrow) throw new Error('Escrow not found');

    // This would integrate with actual condition checking logic
    // For now, return mock condition statuses
    return escrow.conditions.map((condition): ConditionStatus => ({
      condition,
      met: false, // This would be determined by actual condition checking
      checkedAt: new Date()
    }));
  }

  async updateConditionStatus(escrowId: string, conditionIndex: number, met: boolean, _evidence?: string): Promise<void> {
    // This would update condition status in a separate conditions table
    // For now, this is a placeholder for the actual implementation
    console.log(`Condition ${conditionIndex} for escrow ${escrowId} is ${met ? 'met' : 'not met'}`);
  }

  private mapToEscrow(escrow: any): EscrowRecord {
    return {
      ...escrow,
      amount: Number(escrow.amount),
      conditions: typeof escrow.conditions === 'string' 
        ? JSON.parse(escrow.conditions) 
        : escrow.conditions
    };
  }
}