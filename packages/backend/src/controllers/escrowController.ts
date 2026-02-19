/**
 * Escrow Management Controller
 * 
 * Handles escrow creation, monitoring, and condition checking
 */

import { Response } from 'express';
import { EscrowRepository } from '../repositories';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import prisma from '../utils/database';
import { randomBytes } from 'crypto';
import { EscrowStatus } from '../types/database';

const logger = createLogger();
const escrowRepository = new EscrowRepository(prisma);

/**
 * Generate a unique contract ID
 */
function generateContractId(): string {
  return `escrow_${randomBytes(16).toString('hex')}`;
}

/**
 * Create a new escrow
 * POST /api/escrows
 */
export const createEscrow = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { recipientId, amount, conditions, expiresAt } = req.body;

  // Validate amount
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400);
  }

  // Validate expiration date
  const expirationDate = new Date(expiresAt);
  if (expirationDate <= new Date()) {
    throw new AppError('Expiration date must be in the future', 400);
  }

  // Validate conditions
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    throw new AppError('At least one condition is required', 400);
  }

  // Generate unique contract ID
  const contractId = generateContractId();

  // Create escrow
  const escrow = await escrowRepository.create({
    contractId,
    creatorId: req.user.id,
    recipientId,
    amount,
    conditions,
    expiresAt: expirationDate
  });

  logger.info(`Escrow created: ${escrow.id} (${contractId})`);

  res.status(201).json({
    success: true,
    escrow: {
      id: escrow.id,
      contractId: escrow.contractId,
      amount: escrow.amount,
      recipientId: escrow.recipientId,
      conditions: escrow.conditions,
      status: escrow.status,
      expiresAt: escrow.expiresAt,
      createdAt: escrow.createdAt
    }
  });
});

/**
 * Get escrow by ID
 * GET /api/escrows/:escrowId
 */
export const getEscrow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { escrowId } = req.params;

  const escrow = await escrowRepository.findById(escrowId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user has access to this escrow
  const userId = req.user?.id;
  if (userId && escrow.creatorId !== userId && escrow.recipientId !== userId) {
    throw new AppError('Unauthorized to access this escrow', 403);
  }

  res.json({
    success: true,
    escrow: {
      id: escrow.id,
      contractId: escrow.contractId,
      amount: escrow.amount,
      recipientId: escrow.recipientId,
      conditions: escrow.conditions,
      status: escrow.status,
      expiresAt: escrow.expiresAt,
      createdAt: escrow.createdAt,
      releasedAt: escrow.releasedAt,
      txHash: escrow.txHash
    }
  });
});

/**
 * Get escrow by contract ID
 * GET /api/escrows/contract/:contractId
 */
export const getEscrowByContractId = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { contractId } = req.params;

  const escrow = await escrowRepository.findByContractId(contractId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user has access to this escrow
  const userId = req.user?.id;
  if (userId && escrow.creatorId !== userId && escrow.recipientId !== userId) {
    throw new AppError('Unauthorized to access this escrow', 403);
  }

  res.json({
    success: true,
    escrow: {
      id: escrow.id,
      contractId: escrow.contractId,
      amount: escrow.amount,
      recipientId: escrow.recipientId,
      conditions: escrow.conditions,
      status: escrow.status,
      expiresAt: escrow.expiresAt,
      createdAt: escrow.createdAt,
      releasedAt: escrow.releasedAt,
      txHash: escrow.txHash
    }
  });
});

/**
 * Get escrows for authenticated user
 * GET /api/escrows
 */
export const getEscrows = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const role = req.query['role'] as string;
  
  let escrows;
  if (role === 'recipient') {
    escrows = await escrowRepository.findByRecipientId(req.user.id);
  } else {
    // Default to creator role
    escrows = await escrowRepository.findByCreatorId(req.user.id);
  }

  res.json({
    success: true,
    escrows: escrows.map(escrow => ({
      id: escrow.id,
      contractId: escrow.contractId,
      amount: escrow.amount,
      recipientId: escrow.recipientId,
      status: escrow.status,
      expiresAt: escrow.expiresAt,
      createdAt: escrow.createdAt,
      releasedAt: escrow.releasedAt,
      conditionCount: escrow.conditions.length
    }))
  });
});

/**
 * Get active escrows
 * GET /api/escrows/active
 */
export const getActiveEscrows = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const allActive = await escrowRepository.findActiveEscrows();
  
  // Filter to only user's escrows (as creator or recipient)
  const userEscrows = allActive.filter(
    escrow => escrow.creatorId === req.user!.id || escrow.recipientId === req.user!.id
  );

  res.json({
    success: true,
    escrows: userEscrows.map(escrow => ({
      id: escrow.id,
      contractId: escrow.contractId,
      amount: escrow.amount,
      recipientId: escrow.recipientId,
      status: escrow.status,
      expiresAt: escrow.expiresAt,
      createdAt: escrow.createdAt,
      conditionCount: escrow.conditions.length
    }))
  });
});

/**
 * Check escrow conditions
 * GET /api/escrows/:escrowId/conditions
 */
export const checkEscrowConditions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { escrowId } = req.params;

  const escrow = await escrowRepository.findById(escrowId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user has access to this escrow
  const userId = req.user?.id;
  if (userId && escrow.creatorId !== userId && escrow.recipientId !== userId) {
    throw new AppError('Unauthorized to access this escrow', 403);
  }

  // Check conditions
  const conditionStatuses = await escrowRepository.checkConditions(escrowId);

  res.json({
    success: true,
    escrowId: escrow.id,
    contractId: escrow.contractId,
    status: escrow.status,
    conditions: conditionStatuses,
    allConditionsMet: conditionStatuses.every(cs => cs.met)
  });
});

/**
 * Release escrow funds
 * POST /api/escrows/:escrowId/release
 */
export const releaseEscrow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { escrowId } = req.params;
  const { txHash } = req.body;

  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const escrow = await escrowRepository.findById(escrowId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user is the creator
  if (escrow.creatorId !== req.user.id) {
    throw new AppError('Only the escrow creator can release funds', 403);
  }

  // Check if escrow is in active state
  if (escrow.status !== EscrowStatus.ACTIVE && escrow.status !== EscrowStatus.CONDITIONS_MET) {
    throw new AppError(`Escrow cannot be released (current status: ${escrow.status})`, 400);
  }

  // Update escrow status to released
  const updatedEscrow = await escrowRepository.updateStatus(escrowId, {
    status: EscrowStatus.RELEASED,
    releasedAt: new Date(),
    txHash
  });

  logger.info(`Escrow released: ${escrowId} with txHash: ${txHash}`);

  res.json({
    success: true,
    message: 'Escrow funds released successfully',
    escrow: {
      id: updatedEscrow.id,
      contractId: updatedEscrow.contractId,
      status: updatedEscrow.status,
      releasedAt: updatedEscrow.releasedAt,
      txHash: updatedEscrow.txHash
    }
  });
});

/**
 * Refund escrow funds
 * POST /api/escrows/:escrowId/refund
 */
export const refundEscrow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { escrowId } = req.params;
  const { txHash } = req.body;

  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const escrow = await escrowRepository.findById(escrowId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user is the creator
  if (escrow.creatorId !== req.user.id) {
    throw new AppError('Only the escrow creator can request refund', 403);
  }

  // Check if escrow can be refunded (expired or active)
  if (escrow.status !== EscrowStatus.ACTIVE && escrow.status !== EscrowStatus.EXPIRED) {
    throw new AppError(`Escrow cannot be refunded (current status: ${escrow.status})`, 400);
  }

  // Check if escrow is expired
  const isExpired = new Date() > escrow.expiresAt;
  if (!isExpired && escrow.status === EscrowStatus.ACTIVE) {
    throw new AppError('Escrow can only be refunded after expiration', 400);
  }

  // Update escrow status to refunded
  const updatedEscrow = await escrowRepository.updateStatus(escrowId, {
    status: EscrowStatus.REFUNDED,
    releasedAt: new Date(),
    txHash
  });

  logger.info(`Escrow refunded: ${escrowId} with txHash: ${txHash}`);

  res.json({
    success: true,
    message: 'Escrow funds refunded successfully',
    escrow: {
      id: updatedEscrow.id,
      contractId: updatedEscrow.contractId,
      status: updatedEscrow.status,
      releasedAt: updatedEscrow.releasedAt,
      txHash: updatedEscrow.txHash
    }
  });
});

/**
 * Update escrow status
 * PATCH /api/escrows/:escrowId/status
 */
export const updateEscrowStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { escrowId } = req.params;
  const { status, txHash } = req.body;

  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  // Validate status
  if (!Object.values(EscrowStatus).includes(status)) {
    throw new AppError('Invalid escrow status', 400);
  }

  const escrow = await escrowRepository.findById(escrowId);
  if (!escrow) {
    throw new AppError('Escrow not found', 404);
  }

  // Verify user is the creator
  if (escrow.creatorId !== req.user.id) {
    throw new AppError('Only the escrow creator can update status', 403);
  }

  const updateData: any = { status };
  
  if (status === EscrowStatus.RELEASED || status === EscrowStatus.REFUNDED) {
    updateData.releasedAt = new Date();
    if (txHash) updateData.txHash = txHash;
  }

  const updatedEscrow = await escrowRepository.updateStatus(escrowId, updateData);

  logger.info(`Escrow status updated: ${escrowId} -> ${status}`);

  res.json({
    success: true,
    escrow: {
      id: updatedEscrow.id,
      contractId: updatedEscrow.contractId,
      status: updatedEscrow.status,
      releasedAt: updatedEscrow.releasedAt,
      txHash: updatedEscrow.txHash
    }
  });
});

/**
 * Get escrow statistics
 * GET /api/escrows/stats
 */
export const getEscrowStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const stats = await escrowRepository.getEscrowStats(req.user.id);

  res.json({
    success: true,
    stats
  });
});
