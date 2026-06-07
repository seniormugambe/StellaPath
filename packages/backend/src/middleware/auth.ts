/**
 * Authentication Middleware
 * 
 * Handles JWT authentication with wallet signature verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair } from 'stellar-sdk';
import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';
import { AppError, ErrorCode } from './errorHandler';

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
export const authenticateToken = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    next(new AppError('Authentication required', 401, true, ErrorCode.AUTH_REQUIRED));
    return;
  }

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    next(new AppError('Server configuration error', 500, true, ErrorCode.CONFIG_ERROR));
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: string; walletAddress: string };
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token:', error);
    next(new AppError('Invalid or expired token', 403, true, ErrorCode.AUTH_FORBIDDEN));
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
    const signatureBuffer = Buffer.from(signature, 'base64');

    const rawMessageBuffer = Buffer.from(message, 'utf8');
    if (keypair.verify(rawMessageBuffer, signatureBuffer)) {
      return true;
    }

    const freighterMessageHash = createHash('sha256')
      .update(`Stellar Signed Message:\n${message}`, 'utf8')
      .digest();

    return keypair.verify(freighterMessageHash, signatureBuffer);
  } catch (error) {
    logger.error('Signature verification failed:', error);
    return false;
  }
};

/**
 * Generate JWT token for authenticated user
 */
export const generateToken = (userId: string, walletAddress: string): string => {
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new AppError('Server configuration error', 500, true, ErrorCode.CONFIG_ERROR);
  }

  const expiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
  
  return jwt.sign(
    { id: userId, walletAddress },
    jwtSecret as jwt.Secret,
    { expiresIn } as jwt.SignOptions
  );
};

/**
 * Optional authentication - attaches user if token is valid but doesn't require it
 */
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  const jwtSecret = process.env['JWT_SECRET'];
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
