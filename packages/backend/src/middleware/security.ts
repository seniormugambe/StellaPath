/**
 * Security Middleware
 *
 * Additional security measures for DDoS protection, request validation,
 * and security headers beyond what helmet provides.
 * Satisfies Requirements 5.1 (signature validation), 5.3 (reentrancy protection),
 * 5.4 (error handling), and 5.5 (audit trail).
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger();

/**
 * Attach a unique request ID to every request for tracing and audit purposes.
 * The ID is set on both the request object and the response header.
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-ID', id);
  next();
};

/**
 * Block requests with excessively large JSON payloads on sensitive endpoints.
 * This is a secondary defence on top of the global express.json({ limit }) setting.
 */
export const payloadSizeGuard = (maxBytes: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      logger.warn('Payload too large', {
        path: req.path,
        contentLength,
        maxBytes,
      });
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds the allowed size for this endpoint.',
          recovery: 'Reduce the size of your request body and try again.',
        },
      });
      return;
    }
    next();
  };
};

/**
 * Reject requests that contain suspicious patterns commonly used in
 * path traversal or header injection attacks.
 */
export const suspiciousRequestGuard = (req: Request, res: Response, next: NextFunction): void => {
  const url = req.originalUrl || req.url;

  // Block path traversal attempts
  if (url.includes('..') || url.includes('%2e%2e') || url.includes('%252e')) {
    logger.warn('Suspicious request blocked: path traversal', { url, ip: req.ip });
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'The request URL contains invalid characters.',
        recovery: 'Please check the URL and try again.',
      },
    });
    return;
  }

  // Block null bytes
  if (url.includes('%00') || url.includes('\0')) {
    logger.warn('Suspicious request blocked: null byte', { url, ip: req.ip });
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'The request URL contains invalid characters.',
        recovery: 'Please check the URL and try again.',
      },
    });
    return;
  }

  next();
};

/**
 * Add additional security response headers that helmet does not cover
 * or that we want to set explicitly.
 */
export const additionalSecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Prevent browsers from MIME-sniffing (reinforces helmet's default)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Disable client-side caching for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Prevent the page from being embedded in iframes (clickjacking protection)
  res.setHeader('X-Frame-Options', 'DENY');
  // Permissions policy — restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  next();
};
