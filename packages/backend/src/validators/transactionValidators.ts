/**
 * Transaction Validation Schemas
 */

import { z } from 'zod';
import { TransactionType, TransactionStatus } from '../types/database';

export const createTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType, {
    errorMap: () => ({ message: 'Invalid transaction type' })
  }),
  txHash: z.string().length(64, 'Transaction hash must be 64 characters'),
  amount: z.number().positive('Amount must be positive'),
  sender: z.string().length(56, 'Invalid sender address format'),
  recipient: z.string().length(56, 'Invalid recipient address format'),
  fees: z.number().min(0, 'Fees cannot be negative').optional(),
  metadata: z.record(z.any()).optional()
});

export const updateTransactionStatusSchema = z.object({
  status: z.nativeEnum(TransactionStatus, {
    errorMap: () => ({ message: 'Invalid transaction status' })
  }),
  blockHeight: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional()
});

export const transactionIdParamSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID format')
});

export const txHashParamSchema = z.object({
  txHash: z.string().length(64, 'Transaction hash must be 64 characters')
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionStatusInput = z.infer<typeof updateTransactionStatusSchema>;
