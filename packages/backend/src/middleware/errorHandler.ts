/**
 * Error Handling Middleware
 * 
 * Centralized error handling for the Express application.
 * Provides standardized error response format with error codes,
 * recovery suggestions, and privacy-safe logging (Req 8.1, 8.2, 8.3, 8.5).
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger();

/**
 * Standardized error codes for the application
 */
export enum ErrorCode {
  // Authentication / Authorization
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',

  // Validation
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resource
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Transaction / Blockchain
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

/**
 * Map of error codes to user-friendly recovery suggestions
 */
const recoverySuggestions: Record<string, string> = {
  [ErrorCode.AUTH_REQUIRED]: 'Please connect your wallet and sign in to continue.',
  [ErrorCode.AUTH_INVALID_TOKEN]: 'Your session has expired. Please reconnect your wallet.',
  [ErrorCode.AUTH_FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.VALIDATION_FAILED]: 'Please check your input and correct the highlighted fields.',
  [ErrorCode.INVALID_INPUT]: 'One or more fields contain invalid data. Please review and try again.',
  [ErrorCode.NOT_FOUND]: 'The requested resource could not be found. It may have been removed or the link is incorrect.',
  [ErrorCode.CONFLICT]: 'This resource already exists. Please use a different identifier.',
  [ErrorCode.INSUFFICIENT_FUNDS]: 'Your account does not have enough funds for this transaction. Please add funds and try again.',
  [ErrorCode.INVALID_ADDRESS]: 'The Stellar address provided is not valid. Please verify the address and try again.',
  [ErrorCode.TRANSACTION_FAILED]: 'The transaction could not be completed. Please check the details and try again.',
  [ErrorCode.CONTRACT_ERROR]: 'The smart contract returned an error. Please verify the transaction parameters.',
  [ErrorCode.NETWORK_ERROR]: 'Unable to reach the Stellar network. Please check your connection and try again shortly.',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment before trying again.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again in a few minutes.',
  [ErrorCode.CONFIG_ERROR]: 'A server configuration issue was detected. Please contact support.',
};

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: ErrorCode;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: ErrorCode
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code || statusCodeToErrorCode(statusCode);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Derive a default ErrorCode from an HTTP status code
 */
function statusCodeToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400: return ErrorCode.VALIDATION_FAILED;
    case 401: return ErrorCode.AUTH_REQUIRED;
    case 403: return ErrorCode.AUTH_FORBIDDEN;
    case 404: return ErrorCode.NOT_FOUND;
    case 409: return ErrorCode.CONFLICT;
    case 429: return ErrorCode.RATE_LIMITED;
    default: return ErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Build a standardized error response body
 */
function buildErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown,
  includeDebug?: boolean,
  stack?: string
) {
  const response: Record<string, unknown> = {
    success: false,
    error: {
      code,
      message,
      recovery: recoverySuggestions[code] || recoverySuggestions[ErrorCode.INTERNAL_ERROR],
    },
  };

  if (details) {
    (response.error as Record<string, unknown>).details = details;
  }

  if (includeDebug && stack) {
    (response.error as Record<string, unknown>).stack = stack;
  }

  return response;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDev = process.env.NODE_ENV === 'development';

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    logger.warn('Validation error', {
      url: req.url,
      method: req.method,
      fields: details.map(d => d.field),
    });

    res.status(400).json(
      buildErrorResponse(ErrorCode.VALIDATION_FAILED, 'Validation failed', 400, details, isDev, err.stack)
    );
    return;
  }

  // Handle AppError
  if (err instanceof AppError) {
    const logMeta = {
      code: err.code,
      url: req.url,
      method: req.method,
      statusCode: err.statusCode,
    };

    if (err.statusCode >= 500) {
      // Log full stack for server errors, but strip PII from the message
      logger.error('Server error', { ...logMeta, stack: err.stack });
    } else {
      logger.warn('Client error', logMeta);
    }

    res.status(err.statusCode).json(
      buildErrorResponse(err.code, err.message, err.statusCode, undefined, isDev, err.stack)
    );
    return;
  }

  // Handle unknown errors — never leak internals to the client
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json(
    buildErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      isDev ? err.message : 'An unexpected error occurred',
      500,
      undefined,
      isDev,
      err.stack
    )
  );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(
    buildErrorResponse(ErrorCode.NOT_FOUND, 'Route not found', 404, {
      path: req.url,
      method: req.method,
    })
  );
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
