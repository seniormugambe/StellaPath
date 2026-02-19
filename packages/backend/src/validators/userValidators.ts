/**
 * User Management Validation Schemas
 */

import { z } from 'zod';

// Stellar address validation regex
const stellarAddressRegex = /^G[A-Z0-9]{55}$/;

export const createUserSchema = z.object({
  walletAddress: z.string()
    .regex(stellarAddressRegex, 'Invalid Stellar wallet address'),
  email: z.string().email('Invalid email address').optional(),
  displayName: z.string().min(1).max(100).optional(),
});

export const updateUserProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  displayName: z.string().min(1).max(100).optional(),
  preferences: z.object({
    currency: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
  }).optional(),
  notificationSettings: z.object({
    invoiceUpdates: z.boolean().optional(),
    transactionConfirmations: z.boolean().optional(),
    escrowUpdates: z.boolean().optional(),
    systemAlerts: z.boolean().optional(),
  }).optional(),
});

export const walletAuthSchema = z.object({
  walletAddress: z.string()
    .regex(stellarAddressRegex, 'Invalid Stellar wallet address'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required'),
});

export const userIdParamSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type WalletAuthInput = z.infer<typeof walletAuthSchema>;
