/**
 * Escrow Validation Schemas
 */

import { z } from 'zod';
import { EscrowStatus } from '../types/database';

const conditionSchema = z.object({
  type: z.enum(['time_based', 'oracle_based', 'manual_approval'], {
    errorMap: () => ({ message: 'Invalid condition type' })
  }),
  parameters: z.record(z.any()),
  validator: z.string().min(1, 'Validator is required')
});

export const createEscrowSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID format').optional(),
  amount: z.number().positive('Amount must be positive'),
  conditions: z.array(conditionSchema).min(1, 'At least one condition is required'),
  expiresAt: z.string().datetime().or(z.date()).refine(
    (date) => new Date(date) > new Date(),
    'Expiration date must be in the future'
  )
});

export const releaseEscrowSchema = z.object({
  txHash: z.string().length(64, 'Transaction hash must be 64 characters')
});

export const refundEscrowSchema = z.object({
  txHash: z.string().length(64, 'Transaction hash must be 64 characters')
});

export const updateEscrowStatusSchema = z.object({
  status: z.nativeEnum(EscrowStatus, {
    errorMap: () => ({ message: 'Invalid escrow status' })
  }),
  txHash: z.string().length(64, 'Transaction hash must be 64 characters').optional()
});

export const escrowIdParamSchema = z.object({
  escrowId: z.string().uuid('Invalid escrow ID format')
});

export const contractIdParamSchema = z.object({
  contractId: z.string().min(1, 'Contract ID is required')
});

export type CreateEscrowInput = z.infer<typeof createEscrowSchema>;
export type ReleaseEscrowInput = z.infer<typeof releaseEscrowSchema>;
export type RefundEscrowInput = z.infer<typeof refundEscrowSchema>;
export type UpdateEscrowStatusInput = z.infer<typeof updateEscrowStatusSchema>;
