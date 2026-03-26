/**
 * Invoice Validation Schemas
 */

import { z } from 'zod';
import { InvoiceStatus } from '../types/database';

export const createInvoiceSchema = z.object({
  clientEmail: z.string().email('Invalid email format'),
  description: z.string().min(1, 'Description cannot be empty').max(1000, 'Description must be less than 1000 characters'),
  dueDate: z.string().datetime().or(z.date()).refine(
    (date) => new Date(date) > new Date(),
    'Due date must be in the future'
  ),
  metadata: z.record(z.any()).optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Line item description cannot be empty'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().min(0, 'Unit price cannot be negative')
  })).optional()
});

export const updateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus, {
    errorMap: () => ({ message: 'Invalid invoice status' })
  }),
  txHash: z.string().length(64, 'Transaction hash must be 64 characters').optional(),
  metadata: z.record(z.any()).optional()
});

export const approveInvoiceSchema = z.object({
  approvalToken: z.string().min(1, 'Approval token is required'),
  clientInfo: z.object({
    name: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    walletAddress: z.string().optional()
  }).optional()
});

export const rejectInvoiceSchema = z.object({
  approvalToken: z.string().min(1, 'Approval token is required'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
  clientInfo: z.object({
    name: z.string().optional(),
    email: z.string().email('Invalid email format')
  }).optional()
});

export const executeInvoiceSchema = z.object({
  txHash: z.string().length(64, 'Transaction hash must be 64 characters')
});

export const validateTokenSchema = z.object({
  approvalToken: z.string().min(1, 'Approval token is required')
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID format')
});

export const approvalTokenParamSchema = z.object({
  approvalToken: z.string().min(1, 'Approval token is required')
});

export const lineItemIdParamSchema = z.object({
  itemId: z.string().uuid('Invalid line item ID format')
});

export const createLineItemSchema = z.object({
  description: z.string().min(1, 'Description cannot be empty'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative')
});

export const updateLineItemSchema = z.object({
  description: z.string().min(1, 'Description cannot be empty').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
  sortOrder: z.number().int().min(0).optional()
});

export const reorderLineItemsSchema = z.object({
  itemIds: z.array(z.string().uuid('Invalid item ID format'))
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type ApproveInvoiceInput = z.infer<typeof approveInvoiceSchema>;
export type RejectInvoiceInput = z.infer<typeof rejectInvoiceSchema>;
export type CreateLineItemInput = z.infer<typeof createLineItemSchema>;
export type UpdateLineItemInput = z.infer<typeof updateLineItemSchema>;
export type ReorderLineItemsInput = z.infer<typeof reorderLineItemsSchema>;
