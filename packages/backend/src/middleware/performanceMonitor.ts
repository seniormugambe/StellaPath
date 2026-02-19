/**
 * Performance Monitoring Middleware
 *
 * Tracks request duration, response size, logs slow requests,
 * and exposes a /metrics endpoint for basic observability.
 *
 * Validates: System performance and scalability requirements (Task 12.3)
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger();

// ── Configuration ─────────────────────────────────────────────────────

export interface PerformanceMonitorOptions {
  /** Requests slower than this (ms) are logged as warnings. Default: 1000 */
  slowRequestThresholdMs?: number;
  /** Paths to exclude from tracking (e.g. health checks). Default: ['/health'] */
  excludePaths?: string[];
}

// ── Metrics store ─────────────────────────────────────────────────────

export interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  totalDurationMs: number;
  slowRequests: number;
  /** Per-route summary (method:path → count, totalMs) */
  routes: Map<string, { count: number; totalMs: number; errors: number }>;
  /** Timestamp when metrics collection started */
  startedAt: Date;
}

/**
 * In-memory metrics singleton.
 * Exported so tests and the /metrics handler can read it.
 */
export const metrics: RequestMetrics = createFreshMetrics();

export function createFreshMetrics(): RequestMetrics {
  return {
    totalRequests: 0,
    totalErrors: 0,
    totalDurationMs: 0,
    slowRequests: 0,
    routes: new Map(),
    startedAt: new Date(),
  };
}

/** Reset metrics (useful for tests). */
export function resetMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.totalDurationMs = 0;
  metrics.slowRequests = 0;
  metrics.routes.clear();
  metrics.startedAt = new Date();
}

// ── Derived helpers ───────────────────────────────────────────────────

export function getAverageResponseTime(): number {
  if (metrics.totalRequests === 0) return 0;
  return metrics.totalDurationMs / metrics.totalRequests;
}

export function getErrorRate(): number {
  if (metrics.totalRequests === 0) return 0;
  return metrics.totalErrors / metrics.totalRequests;
}

export function getMetricsSummary(): Record<string, unknown> {
  const uptimeMs = Date.now() - metrics.startedAt.getTime();

  const routeSummary: Record<string, { count: number; avgMs: number; errors: number }> = {};
  for (const [route, data] of metrics.routes.entries()) {
    routeSummary[route] = {
      count: data.count,
      avgMs: data.count === 0 ? 0 : Math.round(data.totalMs / data.count),
      errors: data.errors,
    };
  }

  return {
    uptime: `${Math.round(uptimeMs / 1000)}s`,
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    errorRate: Math.round(getErrorRate() * 10000) / 10000,
    averageResponseTimeMs: Math.round(getAverageResponseTime() * 100) / 100,
    slowRequests: metrics.slowRequests,
    routes: routeSummary,
  };
}

// ── Middleware factory ────────────────────────────────────────────────

/**
 * Creates the performance monitoring middleware.
 */
export function performanceMonitor(options?: PerformanceMonitorOptions) {
  const threshold = options?.slowRequestThresholdMs ?? 1000;
  const excludePaths = new Set(options?.excludePaths ?? ['/health']);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    if (excludePaths.has(req.path)) {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();

    // Hook into response finish event
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Update global metrics
      metrics.totalRequests++;
      metrics.totalDurationMs += durationMs;

      if (res.statusCode >= 400) {
        metrics.totalErrors++;
      }

      // Update per-route metrics
      const routeKey = `${req.method} ${req.route?.path ?? req.path}`;
      const existing = metrics.routes.get(routeKey);
      if (existing) {
        existing.count++;
        existing.totalMs += durationMs;
        if (res.statusCode >= 400) existing.errors++;
      } else {
        metrics.routes.set(routeKey, {
          count: 1,
          totalMs: durationMs,
          errors: res.statusCode >= 400 ? 1 : 0,
        });
      }

      // Log slow requests
      if (durationMs > threshold) {
        metrics.slowRequests++;
        logger.warn('Slow request detected', {
          method: req.method,
          url: req.originalUrl,
          durationMs: Math.round(durationMs),
          statusCode: res.statusCode,
          threshold,
        });
      }
    });

    next();
  };
}

// ── /metrics route handler ────────────────────────────────────────────

/**
 * Express route handler that returns the current metrics summary as JSON.
 * Mount on your app: `app.get('/metrics', metricsHandler)`
 */
export function metricsHandler(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: getMetricsSummary(),
  });
}
