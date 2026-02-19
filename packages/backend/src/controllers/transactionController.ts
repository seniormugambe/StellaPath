/**
 * Transaction Management Controller
 * 
 * Handles transaction creation, status tracking, and history
 */

import { Response } from 'express';
import { TransactionRepository } from '../repositories';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import prisma from '../utils/database';
import { 
  TransactionType, 
  TransactionStatus,
  TransactionFilters,
  PaginationOptions 
} from '../types/database';

const logger = createLogger();
const transactionRepository = new TransactionRepository(prisma);

/**
 * Create a new transaction
 * POST /api/transactions
 */
export const createTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { type, txHash, amount, sender, recipient, fees, metadata } = req.body;

  // Validate transaction type
  if (!Object.values(TransactionType).includes(type)) {
    throw new AppError('Invalid transaction type', 400);
  }

  // Validate amount
  if (amount <= 0) {
    throw new AppError('Amount must be positive', 400);
  }

  // Create transaction record
  const transaction = await transactionRepository.create({
    userId: req.user.id,
    type,
    txHash,
    amount,
    sender,
    recipient,
    fees: fees || 0,
    metadata: metadata || {}
  });

  logger.info(`Transaction created: ${transaction.id} (${type})`);

  res.status(201).json({
    success: true,
    transaction: {
      id: transaction.id,
      type: transaction.type,
      txHash: transaction.txHash,
      amount: transaction.amount,
      sender: transaction.sender,
      recipient: transaction.recipient,
      status: transaction.status,
      timestamp: transaction.timestamp,
      fees: transaction.fees,
      metadata: transaction.metadata
    }
  });
});

/**
 * Get transaction by ID
 * GET /api/transactions/:transactionId
 */
export const getTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    throw new AppError('Transaction ID is required', 400);
  }

  const transaction = await transactionRepository.findById(transactionId);
  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  // Verify user has access to this transaction
  const userId = req.user?.id;
  if (userId && transaction.userId !== userId) {
    throw new AppError('Unauthorized to access this transaction', 403);
  }

  res.json({
    success: true,
    transaction: {
      id: transaction.id,
      type: transaction.type,
      txHash: transaction.txHash,
      amount: transaction.amount,
      sender: transaction.sender,
      recipient: transaction.recipient,
      status: transaction.status,
      timestamp: transaction.timestamp,
      blockHeight: transaction.blockHeight,
      fees: transaction.fees,
      metadata: transaction.metadata
    }
  });
});

/**
 * Get transaction by hash
 * GET /api/transactions/hash/:txHash
 */
export const getTransactionByHash = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { txHash } = req.params;

  if (!txHash) {
    throw new AppError('Transaction hash is required', 400);
  }

  const transaction = await transactionRepository.findByTxHash(txHash);
  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  // Verify user has access to this transaction
  const userId = req.user?.id;
  if (userId && transaction.userId !== userId) {
    throw new AppError('Unauthorized to access this transaction', 403);
  }

  res.json({
    success: true,
    transaction: {
      id: transaction.id,
      type: transaction.type,
      txHash: transaction.txHash,
      amount: transaction.amount,
      sender: transaction.sender,
      recipient: transaction.recipient,
      status: transaction.status,
      timestamp: transaction.timestamp,
      blockHeight: transaction.blockHeight,
      fees: transaction.fees,
      metadata: transaction.metadata
    }
  });
});

/**
 * Get transaction history for authenticated user
 * GET /api/transactions
 */
export const getTransactionHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  // Parse filters from query params
  const filters: TransactionFilters = {};
  if (req.query['type']) filters.type = req.query['type'] as TransactionType;
  if (req.query['status']) filters.status = req.query['status'] as TransactionStatus;
  if (req.query['startDate']) filters.startDate = new Date(req.query['startDate'] as string);
  if (req.query['endDate']) filters.endDate = new Date(req.query['endDate'] as string);
  if (req.query['minAmount']) filters.minAmount = parseFloat(req.query['minAmount'] as string);
  if (req.query['maxAmount']) filters.maxAmount = parseFloat(req.query['maxAmount'] as string);

  // Parse pagination options
  const pagination: PaginationOptions = {
    page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
    limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20,
    sortBy: req.query['sortBy'] as string || 'timestamp',
    sortOrder: (req.query['sortOrder'] as 'asc' | 'desc') || 'desc'
  };

  const result = await transactionRepository.findByUserId(req.user.id, filters, pagination);

  res.json({
    success: true,
    transactions: result.data.map(tx => ({
      id: tx.id,
      type: tx.type,
      txHash: tx.txHash,
      amount: tx.amount,
      sender: tx.sender,
      recipient: tx.recipient,
      status: tx.status,
      timestamp: tx.timestamp,
      blockHeight: tx.blockHeight,
      fees: tx.fees,
      metadata: tx.metadata
    })),
    pagination: result.pagination
  });
});

/**
 * Update transaction status
 * PATCH /api/transactions/:transactionId/status
 */
export const updateTransactionStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { transactionId } = req.params;
  const { status, blockHeight, metadata } = req.body;

  if (!transactionId) {
    throw new AppError('Transaction ID is required', 400);
  }

  // Validate status
  if (!Object.values(TransactionStatus).includes(status)) {
    throw new AppError('Invalid transaction status', 400);
  }

  // Get existing transaction to verify ownership
  const existing = await transactionRepository.findById(transactionId);
  if (!existing) {
    throw new AppError('Transaction not found', 404);
  }

  // Verify user has access to this transaction
  const userId = req.user?.id;
  if (userId && existing.userId !== userId) {
    throw new AppError('Unauthorized to update this transaction', 403);
  }

  const transaction = await transactionRepository.updateStatus(transactionId, {
    status,
    blockHeight,
    metadata
  });

  logger.info(`Transaction status updated: ${transactionId} -> ${status}`);

  res.json({
    success: true,
    transaction: {
      id: transaction.id,
      type: transaction.type,
      txHash: transaction.txHash,
      status: transaction.status,
      blockHeight: transaction.blockHeight,
      timestamp: transaction.timestamp
    }
  });
});

/**
 * Get transaction statistics
 * GET /api/transactions/stats
 */
export const getTransactionStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const stats = await transactionRepository.getTransactionStats(req.user.id);

  res.json({
    success: true,
    stats
  });
});

/**
 * Get pending transactions
 * GET /api/transactions/pending
 */
export const getPendingTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const allPending = await transactionRepository.findPendingTransactions();
  
  // Filter to only user's transactions
  const userPending = allPending.filter(tx => tx.userId === req.user!.id);

  res.json({
    success: true,
    transactions: userPending.map(tx => ({
      id: tx.id,
      type: tx.type,
      txHash: tx.txHash,
      amount: tx.amount,
      sender: tx.sender,
      recipient: tx.recipient,
      status: tx.status,
      timestamp: tx.timestamp,
      fees: tx.fees
    }))
  });
});
