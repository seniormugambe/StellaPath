/**
 * P2P Payment Validation Schemas
 */

import { z } from 'zod';

// Stellar address validation pattern
const stellarAddressPattern = /^G[A-Z2-7]{55}$/;

export const p2pPaymentSchema = z.object({
  sender: z.string()
    .regex(stellarAddressPattern, 'Sender must be a valid Stellar address'),
  
  recipient: z.string()
    .regex(stellarAddressPattern, 'Recipient must be a valid Stellar address'),
  
  amount: z.number()
    .positive('Amount must be positive'),
  
  memo: z.string()
    .max(28, 'Memo cannot exceed 28 characters')
    .optional()
});

export const recipientValidationSchema = z.object({
  walletAddress: z.string()
    .regex(stellarAddressPattern, 'Wallet address must be a valid Stellar address')
});

export const p2pFeesQuerySchema = z.object({
  amount: z.string()
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val > 0, 'Amount must be a positive number')
});