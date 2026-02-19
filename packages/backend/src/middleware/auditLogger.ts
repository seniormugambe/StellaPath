/**
 * Audit Logging Middleware
 *
 * Logs all transaction-related API attempts (successful and failed)
 * for security auditing purposes while protecting user privacy.
 * Satisfies Requirements 5.5 and 8.5.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { AuthRequest } from './auth';

const logger = createLogger();

/**
 * Route patterns that represent transaction-related operations
 * and should be audit-logged.
 */
const AUDITED_PATTERNS = [
  /^\/api\/transactions/,
  /^\/api\/escrows/,
  /^\/api\/invoices/,
];

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Middleware that logs mutation requests on audited routes.
 * Captures method, path, user id (if authenticated), status code,
 * and duration — but never logs request bodies or sensitive data.
 */
export const auditLogger = (req: Request, res: Response, next: NextFunction): void => {
  const isAudited = MUTATION_METHODS.has(req.method) &&
    AUDITED_PATTERNS.some(p => p.test(req.originalUrl || req.url));

  if (!isAudited) {
    next();
    return;
  }

  const startTime = Date.now();
  const authReq = req as AuthRequest;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const entry = {
      audit: true,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: authReq.user?.id || 'anonymous',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    if (res.statusCode >= 400) {
      logger.warn('Audit: failed transaction attempt', entry);
    } else {
      logger.info('Audit: transaction operation', entry);
    }
  });

  next();
};
