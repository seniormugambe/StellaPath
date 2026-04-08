/**
 * X402 Controller - HTTP endpoints for x402 protocol
 * Handles AI agent payments and micropayments on Stellar
 */

import { Request, Response } from 'express';
import { X402Service } from '../services/X402Service';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { prisma } from '../utils/database';

const logger = createLogger();

// Initialize X402 service
const transactionRepository = new TransactionRepository(prisma);
const userRepository = new UserRepository(prisma);

const x402Service = new X402Service(
  transactionRepository,
  userRepository,
  {
    networkPassphrase: process.env['STELLAR_PASSPHRASE'] || 'Test SDF Network ; September 2015',
    horizonUrl: process.env['STELLAR_HORIZON_URL'] || 'https://horizon-testnet.stellar.org',
    facilitatorUrl: process.env['X402_FACILITATOR_URL'],
    defaultAsset: {
      code: process.env['X402_DEFAULT_ASSET_CODE'] || 'USDC',
      issuer: process.env['X402_DEFAULT_ASSET_ISSUER'] || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    }
  }
);

/**
 * Process x402 payment authorization
 * POST /api/x402/pay
 */
export async function processX402Payment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { walletAddress, resourceUrl, amount, payTo, asset, memo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const result = await x402Service.processPayment({
      userId,
      walletAddress,
      resourceUrl,
      amount: parseFloat(amount),
      payTo,
      asset,
      memo
    });

    if (result.success) {
      res.status(result.statusCode || 200).json({
        success: true,
        data: {
          txHash: result.txHash,
          transaction: result.transaction
        }
      });
    } else {
      res.status(result.statusCode || 400).json({
        success: false,
        error: { 
          code: 'PAYMENT_FAILED', 
          message: result.error || 'Payment failed' 
        }
      });
    }
  } catch (error) {
    logger.error('Error in processX402Payment:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Generate x402 payment request (returns 402 with payment details)
 * GET /api/x402/resource/:resourceId
 */
export async function requestX402Resource(req: Request, res: Response): Promise<void> {
  try {
    const { resourceId } = req.params;

    // Example resource configuration
    // In production, fetch from database or configuration
    const resourceConfig = {
      path: `/api/x402/resource/${resourceId}`,
      price: '$0.001',
      description: `Access to resource ${resourceId}`,
      payTo: process.env['X402_MERCHANT_ADDRESS'] || '',
      network: process.env['STELLAR_NETWORK'] === 'mainnet' ? 'stellar:pubnet' : 'stellar:testnet'
    };

    const paymentRequest = x402Service.generatePaymentRequest(resourceConfig);

    // Return 402 Payment Required with payment details
    res.status(402).json({
      success: false,
      error: {
        code: 'PAYMENT_REQUIRED',
        message: 'Payment required to access this resource'
      },
      payment: paymentRequest
    });
  } catch (error) {
    logger.error('Error in requestX402Resource:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Verify x402 payment and grant access to resource
 * POST /api/x402/verify
 */
export async function verifyX402Payment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { resourceUrl, requiredAmount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const isValid = await x402Service.verifyPayment(
      userId,
      resourceUrl,
      parseFloat(requiredAmount)
    );

    if (isValid) {
      res.json({
        success: true,
        data: {
          verified: true,
          message: 'Payment verified, access granted'
        }
      });
    } else {
      res.status(402).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_VERIFIED',
          message: 'No valid payment found for this resource'
        }
      });
    }
  } catch (error) {
    logger.error('Error in verifyX402Payment:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Create x402 session for reusable payments
 * POST /api/x402/session
 */
export async function createX402Session(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { maxSpend, expiresIn, allowedResources } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const sessionId = `x402_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);

    const result = await x402Service.createSession({
      sessionId,
      userId,
      maxSpend: parseFloat(maxSpend),
      expiresAt,
      allowedResources
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          sessionId: result.sessionId,
          expiresAt,
          maxSpend: parseFloat(maxSpend)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_CREATION_FAILED',
          message: result.error || 'Failed to create session'
        }
      });
    }
  } catch (error) {
    logger.error('Error in createX402Session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Get x402 payment history
 * GET /api/x402/history
 */
export async function getX402History(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const history = await x402Service.getPaymentHistory(userId, { page, limit });

    res.json({
      success: true,
      data: {
        payments: history,
        page,
        limit,
        total: history.length
      }
    });
  } catch (error) {
    logger.error('Error in getX402History:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}

/**
 * Estimate x402 payment cost
 * GET /api/x402/estimate
 */
export async function estimateX402Cost(req: Request, res: Response): Promise<void> {
  try {
    const amount = parseFloat(req.query['amount'] as string);

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' }
      });
      return;
    }

    const estimate = await x402Service.estimateCost(amount);

    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    logger.error('Error in estimateX402Cost:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
}
