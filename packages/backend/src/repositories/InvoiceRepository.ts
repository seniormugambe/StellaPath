import { PrismaClient } from '@prisma/client';
import { 
  InvoiceRecord, 
  CreateInvoiceRequest, 
  UpdateInvoiceStatusRequest,
  InvoiceFilters,
  PaginationOptions,
  PaginatedResponse,
  InvoiceStatus,
  PublicInvoice
} from '../types/database';

export class InvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateInvoiceRequest): Promise<InvoiceRecord> {
    const invoice = await this.prisma.invoiceRecord.create({
      data: {
        creatorId: data.creatorId,
        clientEmail: data.clientEmail,
        amount: data.amount,
        description: data.description,
        dueDate: data.dueDate,
        metadata: data.metadata || {}
      },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return this.mapToInvoice(invoice);
  }

  async findById(id: string): Promise<InvoiceRecord | null> {
    const invoice = await this.prisma.invoiceRecord.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return invoice ? this.mapToInvoice(invoice) : null;
  }

  async findByApprovalToken(approvalToken: string): Promise<InvoiceRecord | null> {
    const invoice = await this.prisma.invoiceRecord.findUnique({
      where: { approvalToken },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return invoice ? this.mapToInvoice(invoice) : null;
  }

  async findByCreatorId(
    creatorId: string,
    filters?: InvoiceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<InvoiceRecord>> {
    const where: any = { creatorId };

    // Apply filters
    if (filters) {
      if (filters.status) where.status = filters.status;
      if (filters.clientEmail) where.clientEmail = { contains: filters.clientEmail, mode: 'insensitive' };
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
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
      orderBy.createdAt = 'desc';
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoiceRecord.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          creator: {
            select: {
              id: true,
              walletAddress: true,
              displayName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.invoiceRecord.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: invoices.map(invoice => this.mapToInvoice(invoice)),
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

  async updateStatus(id: string, data: UpdateInvoiceStatusRequest): Promise<InvoiceRecord> {
    const updateData: any = {
      status: data.status
    };

    if (data.approvedAt) updateData.approvedAt = data.approvedAt;
    if (data.executedAt) updateData.executedAt = data.executedAt;
    if (data.txHash) updateData.txHash = data.txHash;
    if (data.metadata) {
      // Merge with existing metadata
      const existing = await this.prisma.invoiceRecord.findUnique({
        where: { id },
        select: { metadata: true }
      });
      
      updateData.metadata = {
        ...(existing?.metadata as object || {}),
        ...data.metadata
      };
    }

    const invoice = await this.prisma.invoiceRecord.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return this.mapToInvoice(invoice);
  }

  async findExpiredInvoices(): Promise<InvoiceRecord[]> {
    const now = new Date();
    const invoices = await this.prisma.invoiceRecord.findMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.APPROVED] },
        dueDate: { lt: now }
      },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return invoices.map(invoice => this.mapToInvoice(invoice));
  }

  async markExpiredInvoices(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.invoiceRecord.updateMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.APPROVED] },
        dueDate: { lt: now }
      },
      data: {
        status: InvoiceStatus.EXPIRED
      }
    });

    return result.count;
  }

  async getPublicInvoice(approvalToken: string): Promise<PublicInvoice | null> {
    const invoice = await this.prisma.invoiceRecord.findUnique({
      where: { approvalToken },
      include: {
        creator: {
          select: {
            displayName: true
          }
        }
      }
    });

    if (!invoice) return null;

    return {
      id: invoice.id,
      amount: Number(invoice.amount),
      description: invoice.description,
      creatorName: invoice.creator.displayName || 'Anonymous',
      dueDate: invoice.dueDate,
      status: invoice.status
    };
  }

  async getInvoiceStats(creatorId?: string): Promise<{
    total: number;
    byStatus: Record<InvoiceStatus, number>;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
  }> {
    const where = creatorId ? { creatorId } : {};

    const [total, byStatus, amounts] = await Promise.all([
      this.prisma.invoiceRecord.count({ where }),
      this.prisma.invoiceRecord.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.prisma.invoiceRecord.aggregate({
        where,
        _sum: { amount: true }
      })
    ]);

    const [paidAmountResult, pendingAmountResult] = await Promise.all([
      this.prisma.invoiceRecord.aggregate({
        where: { ...where, status: InvoiceStatus.EXECUTED },
        _sum: { amount: true }
      }),
      this.prisma.invoiceRecord.aggregate({
        where: { ...where, status: { in: [InvoiceStatus.SENT, InvoiceStatus.APPROVED] } },
        _sum: { amount: true }
      })
    ]);

    const statusStats = Object.values(InvoiceStatus).reduce((acc, status) => {
      acc[status] = byStatus.find(item => item.status === status)?._count.status || 0;
      return acc;
    }, {} as Record<InvoiceStatus, number>);

    return {
      total,
      byStatus: statusStats,
      totalAmount: Number(amounts._sum.amount || 0),
      paidAmount: Number(paidAmountResult._sum.amount || 0),
      pendingAmount: Number(pendingAmountResult._sum.amount || 0)
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invoiceRecord.delete({
      where: { id }
    });
  }

  private mapToInvoice(invoice: any): InvoiceRecord {
    return {
      ...invoice,
      amount: Number(invoice.amount),
      metadata: typeof invoice.metadata === 'string' 
        ? JSON.parse(invoice.metadata) 
        : invoice.metadata
    };
  }
}