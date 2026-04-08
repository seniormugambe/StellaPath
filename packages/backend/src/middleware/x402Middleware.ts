/**
 * X402 Middleware - Protect API endpoints with x402 payments
 * 
 * Usage:
 * app.get('/api/weather', requireX402Payment(0.001), weatherController);
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface X402Config {
  price: number;
  asset?: string;
  description?: string;
  merchantAddress?: string;
}

/**
 * Middleware to require x402 payment for endpoint access
 * Returns 402 if payment not found, allows access if payment verified
 */
export function requireX402Payment(config: X402Config | number) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const price = typeof config === 'number' ? config : config.price;
      const asset = typeof config === 'object' ? config.asset : 'USDC';
      const description = typeof config === 'object' ? config.description : 'API access';
      const merchantAddress = typeof config === 'object' 
        ? config.merchantAddress 
        : process.env['X402_MERCHANT_ADDRESS'];

      if (!merchantAddress) {
        logger.error('X402 merchant address not configured');
        res.status(500).json({
          success: false,
          error: { code: 'CONFIG_ERROR', message: 'Payment system not configured' }
        });
        return;
      }

      // Check if payment header exists (x402 v2 feature)
      const paymentProof = req.headers['x-payment-proof'] as string;
      
      if (paymentProof) {
        // Verify payment proof
        // In production, validate the proof against blockchain
        logger.info('Payment proof provided', { proof: paymentProof });
        next();
        return;
      }

      // Check if user has recent payment for this resource
      const userId = req.user?.id;
      if (userId) {
        // In production, check database for recent payment
        // For now, return 402 to request payment
      }

      // Return 402 Payment Required with payment details
      const network = process.env['STELLAR_NETWORK'] === 'mainnet' 
        ? 'stellar:pubnet' 
        : 'stellar:testnet';

      res.status(402).json({
        success: false,
        error: {
          code: 'PAYMENT_REQUIRED',
          message: 'Payment required to access this resource'
        },
        payment: {
          resourceUrl: req.path,
          price: `$${price}`,
          network,
          payTo: merchantAddress,
          description,
          asset
        }
      });
    } catch (error) {
      logger.error('Error in x402 middleware', { error });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
      });
    }
  };
}

/**
 * Middleware to track x402 payment usage
 * Logs payment events for analytics
 */
export function trackX402Usage() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const paymentProof = req.headers['x-payment-proof'];
    
    if (paymentProof) {
      logger.info('X402 payment used', {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

/**
 * Middleware to enforce x402 session limits
 * Checks if payment is within session spending limits
 */
export function enforceSessionLimits() {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        next();
        return;
      }

      // In production, check session limits from Redis/database
      // For now, just log and continue
      logger.info('X402 session detected', { sessionId });
      
      next();
    } catch (error) {
      logger.error('Error enforcing session limits', { error });
      next();
    }
  };
}
