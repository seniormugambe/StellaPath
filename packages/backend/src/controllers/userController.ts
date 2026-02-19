/**
 * User Management Controller
 * 
 * Handles user registration, profile management, and wallet authentication
 */

import { Response } from 'express';
import { UserRepository } from '../repositories';
import { AuthRequest, generateToken, verifyWalletSignature } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { CreateUserInput, UpdateUserProfileInput, WalletAuthInput } from '../validators/userValidators';
import { createLogger } from '../utils/logger';
import prisma from '../utils/database';

const logger = createLogger();
const userRepository = new UserRepository(prisma);

/**
 * Authenticate user with wallet signature
 * POST /api/users/auth
 */
export const authenticateWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { walletAddress, signature, message } = req.body as WalletAuthInput;

  // Verify wallet signature
  const isValid = verifyWalletSignature(walletAddress, signature, message);
  if (!isValid) {
    throw new AppError('Invalid wallet signature', 401);
  }

  // Find or create user
  let user = await userRepository.findByWalletAddress(walletAddress);
  
  if (!user) {
    // Create new user if doesn't exist
    user = await userRepository.create({
      walletAddress,
    });
    logger.info(`New user created: ${user.id}`);
  }

  // Generate JWT token
  const token = generateToken(user.id, user.walletAddress);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
  });
});

/**
 * Create a new user
 * POST /api/users
 */
export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = req.body as CreateUserInput;

  // Check if user already exists
  const existingUser = await userRepository.findByWalletAddress(data.walletAddress);
  if (existingUser) {
    throw new AppError('User with this wallet address already exists', 409);
  }

  // Create user
  const user = await userRepository.create(data);
  logger.info(`User created: ${user.id}`);

  res.status(201).json({
    success: true,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
  });
});

/**
 * Get user profile
 * GET /api/users/:userId
 */
export const getUserProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify user is accessing their own profile or is admin
  if (req.user?.id !== userId) {
    throw new AppError('Unauthorized to access this profile', 403);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      preferences: user.preferences,
      notificationSettings: user.notificationSettings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * Get current authenticated user profile
 * GET /api/users/me
 */
export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const user = await userRepository.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      preferences: user.preferences,
      notificationSettings: user.notificationSettings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * Update user profile
 * PATCH /api/users/:userId
 */
export const updateUserProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const data = req.body as UpdateUserProfileInput;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify user is updating their own profile
  if (req.user?.id !== userId) {
    throw new AppError('Unauthorized to update this profile', 403);
  }

  const user = await userRepository.update(userId, data);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  logger.info(`User profile updated: ${userId}`);

  res.json({
    success: true,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      preferences: user.preferences,
      notificationSettings: user.notificationSettings,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * Delete user account
 * DELETE /api/users/:userId
 */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  // Verify user is deleting their own account
  if (req.user?.id !== userId) {
    throw new AppError('Unauthorized to delete this account', 403);
  }

  await userRepository.delete(userId);
  logger.info(`User deleted: ${userId}`);

  res.json({
    success: true,
    message: 'User account deleted successfully',
  });
});
