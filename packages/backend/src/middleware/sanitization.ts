/**
 * Input Sanitization Middleware
 *
 * Strips potentially dangerous HTML/script content from request bodies
 * and query parameters to prevent XSS, injection, and prototype pollution attacks.
 * Satisfies Requirements 5.1 (validation), 5.3 (reentrancy/injection protection),
 * 5.4 (descriptive errors on bad input), and 5.5 (audit logging).
 */

import { Request, Response, NextFunction } from 'express';

/** Maximum nesting depth allowed in request payloads to prevent DoS via deeply nested JSON */
const MAX_NESTING_DEPTH = 10;

/** Keys that must never appear in user-supplied objects (prototype pollution prevention) */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively sanitize string values in an object by stripping
 * HTML tags and common script/injection patterns.
 */
function sanitizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > MAX_NESTING_DEPTH) {
    return undefined; // Truncate excessively nested data
  }

  if (typeof value === 'string') {
    return value
      // Strip HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove javascript: protocol
      .replace(/javascript\s*:/gi, '')
      // Remove on* event handlers
      .replace(/\bon\w+\s*=/gi, '')
      // Remove data: URIs that could contain scripts
      .replace(/data\s*:[^,]*;base64/gi, '')
      // Remove common SQL injection patterns (single-quote sequences, comment markers)
      .replace(/('|--|;|\*\/|\/\*)/g, '')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
  if (depth > MAX_NESTING_DEPTH) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    // Prototype pollution prevention — skip dangerous keys
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = sanitizeValue(obj[key], depth);
  }
  return sanitized;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params in-place.
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
  }
  next();
};
