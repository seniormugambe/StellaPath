/**
 * P2P Payment Controller
 */

import { Request, Response } from 'express';
import { P2PHandler } from '../services/P2PHandler';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { AuthRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// Initialize P2P handler
import { prisma } from '../utils/database';

const transactionRepository = new TransactionRepository(prisma);
const p2pHandler = new P2PHandler(transactionRepository, {
  networkPassphrase: process.env['STELLAR_PASSPHRASE'] || 'Test SDF Network ; September 2015',
  horizonUrl: process.env['STELLAR_HORIZON_URL'] || 'https://horizon-testnet.stellar.org'
});

/**
 * Send P2P payment
 */
export async function sendP2PPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sender, recipient, amount, memo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const result = await p2pHandler.sendPayment({
      userId,
      sender,
      recipient,
      amount: parseFloat(amount),
      memo
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          txHash: result.txHash,
          transaction: result.transaction
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_FAILED', message: result.error || 'Payment failed' }
      });
    }
  } catch (error) {
    logger.error('Error in sendP2PPayment:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Get P2P transaction history for a wallet address
 */
export async function getP2PHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 10;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const result = await p2pHandler.getPaymentHistory(userId, { page, limit });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error in getP2PHistory:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Validate recipient wallet address
 */
export async function validateRecipient(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_ADDRESS', message: 'Wallet address is required' }
      });
      return;
    }

    const validation = await p2pHandler.validateRecipient(walletAddress);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error('Error in validateRecipient:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Estimate P2P payment fees
 */
export async function estimateP2PFees(req: Request, res: Response): Promise<void> {
  try {
    const amount = parseFloat(req.query['amount'] as string);

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' }
      });
      return;
    }

    const fees = await p2pHandler.estimateFees(amount);

    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    logger.error('Error in estimateP2PFees:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}