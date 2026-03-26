import { PrismaClient } from '@prisma/client';
import {
  InvoiceLineItem,
  CreateInvoiceLineItemRequest,
  UpdateInvoiceLineItemRequest
} from '../types/database';

export class InvoiceLineItemRepository {
  constructor(private prisma: PrismaClient) {}

  async create(invoiceId: string, data: CreateInvoiceLineItemRequest): Promise<InvoiceLineItem> {
    const total = Number(data.quantity) * Number(data.unitPrice);

    return await this.prisma.invoiceLineItem.create({
      data: {
        invoiceId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total
      }
    });
  }

  async createMany(invoiceId: string, items: CreateInvoiceLineItemRequest[]): Promise<InvoiceLineItem[]> {
    const lineItems = items.map((item, index) => ({
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: Number(item.quantity) * Number(item.unitPrice),
      sortOrder: index
    }));

    await this.prisma.invoiceLineItem.createMany({
      data: lineItems
    });

    // Return the created items
    return await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async findById(id: string): Promise<InvoiceLineItem | null> {
    return await this.prisma.invoiceLineItem.findUnique({
      where: { id }
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async update(id: string, data: UpdateInvoiceLineItemRequest): Promise<InvoiceLineItem> {
    const updateData: any = { ...data };

    // Recalculate total if quantity or unitPrice changed
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const currentItem = await this.findById(id);
      if (currentItem) {
        const quantity = Number(data.quantity ?? currentItem.quantity);
        const unitPrice = Number(data.unitPrice ?? currentItem.unitPrice);
        updateData.total = quantity * unitPrice;
      }
    }

    return await this.prisma.invoiceLineItem.update({
      where: { id },
      data: updateData
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invoiceLineItem.delete({
      where: { id }
    });
  }

  async deleteByInvoiceId(invoiceId: string): Promise<void> {
    await this.prisma.invoiceLineItem.deleteMany({
      where: { invoiceId }
    });
  }

  async reorder(_invoiceId: string, itemIds: string[]): Promise<void> {
    const updates = itemIds.map((id, index) =>
      this.prisma.invoiceLineItem.update({
        where: { id },
        data: { sortOrder: index }
      })
    );

    await this.prisma.$transaction(updates);
  }

  async calculateTotal(invoiceId: string): Promise<number> {
    const result = await this.prisma.invoiceLineItem.aggregate({
      where: { invoiceId },
      _sum: { total: true }
    });

    return Number(result._sum.total) || 0;
  }
}