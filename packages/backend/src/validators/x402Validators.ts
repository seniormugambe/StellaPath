/**
 * X402 Validators - Request validation schemas for x402 endpoints
 */

import { z } from 'zod';

// Stellar address validation pattern
const stellarAddressPattern = /^G[A-Z2-7]{55}$/;

/**
 * Validate x402 payment request
 */
export const x402PaymentSchema = z.object({
  walletAddress: z.string()
    .regex(stellarAddressPattern, 'Invalid Stellar wallet address format'),
  
  resourceUrl: z.string()
    .min(1, 'Resource URL is required'),
  
  amount: z.number()
    .positive('Amount must be positive'),
  
  payTo: z.string()
    .regex(stellarAddressPattern, 'Invalid merchant Stellar address format'),
  
  asset: z.enum(['XLM', 'USDC', 'PYUSD', 'USDY'])
    .optional()
    .default('USDC'),
  
  memo: z.string()
    .max(28, 'Memo must be 28 characters or less')
    .optional()
});

/**
 * Validate x402 payment verification request
 */
export const x402VerifySchema = z.object({
  resourceUrl: z.string()
    .min(1, 'Resource URL is required'),
  
  requiredAmount: z.number()
    .positive('Required amount must be positive')
});

/**
 * Validate x402 session creation request
 */
export const x402SessionSchema = z.object({
  maxSpend: z.number()
    .positive('Max spend must be positive'),
  
  expiresIn: z.number()
    .int('Expires in must be an integer')
    .min(60, 'Session must be at least 60 seconds')
    .max(86400, 'Session cannot exceed 24 hours (86400 seconds)')
    .optional()
    .default(3600),
  
  allowedResources: z.array(z.string())
    .optional()
});
