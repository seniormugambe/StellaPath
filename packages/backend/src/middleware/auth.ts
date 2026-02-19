/**
 * Authentication Middleware
 * 
 * Handles JWT authentication with wallet signature verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair } from 'stellar-sdk';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
  };
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Authentication required', message: 'No token provided' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; walletAddress: string };
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Verify wallet signature for authentication
 */
export const verifyWalletSignature = (
  publicKey: string,
  signature: string,
  message: string
): boolean => {
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    const messageBuffer = Buffer.from(message, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');
    
    return keypair.verify(messageBuffer, signatureBuffer);
  } catch (error) {
    logger.error('Signature verification failed:', error);
    return false;
  }
};

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (userId: string, walletAddress: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(
    { id: userId, walletAddress },
    jwtSecret,
    { expiresIn }
  );
};

/**
 * Optional authentication - attaches user if token is valid but doesn't require it
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; walletAddress: string };
    req.user = decoded;
  } catch (error) {
    // Token invalid but we don't fail the request
    logger.debug('Optional auth: Invalid token');
  }
  
  next();
};
