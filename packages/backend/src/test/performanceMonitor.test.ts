/**
 * Unit tests for Performance Monitoring Middleware (Task 12.3)
 *
 * Tests request duration tracking, slow request logging,
 * metrics aggregation, and the /metrics endpoint handler.
 *
 * Validates: System performance and scalability requirements
 */

import { Request, Response, NextFunction } from 'express';
import {
  performanceMonitor,
  metricsHandler,
  metrics,
  resetMetrics,
  getAverageResponseTime,
  getErrorRate,
  getMetricsSummary,
} from '../middleware/performanceMonitor';

// ── Helpers ───────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/test',
    originalUrl: '/api/test',
    route: { path: '/api/test' },
    ...overrides,
  } as unknown as Request;
}

type FinishCallback = () => void;

function createMockResponse(statusCode = 200): Response & { _triggerFinish: () => void } {
  const listeners: FinishCallback[] = [];
  const res = {
    statusCode,
    on: jest.fn((event: string, cb: FinishCallback) => {
      if (event === 'finish') listeners.push(cb);
      return res;
    }),
    json: jest.fn().mockReturnThis(),
    _triggerFinish() {
      for (const cb of listeners) cb();
    },
  } as unknown as Response & { _triggerFinish: () => void };
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('performanceMonitor middleware', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('should call next() immediately', () => {
    const middleware = performanceMonitor();
    const req = createMockRequest();
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should increment totalRequests on response finish', () => {
    const middleware = performanceMonitor();
    const req = createMockRequest();
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.totalRequests).toBe(1);
  });

  it('should track duration in totalDurationMs', () => {
    const middleware = performanceMonitor();
    const req = createMockRequest();
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    middleware(req, res, next);
    res._triggerFinish();

    // Duration should be a small positive number (test runs fast)
    expect(metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should count errors for status >= 400', () => {
    const middleware = performanceMonitor();
    const req = createMockRequest();
    const res = createMockResponse(500);
    const next: NextFunction = jest.fn();

    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.totalErrors).toBe(1);
  });

  it('should not count successful responses as errors', () => {
    const middleware = performanceMonitor();
    const req = createMockRequest();
    const res = createMockResponse(200);
    const next: NextFunction = jest.fn();

    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.totalErrors).toBe(0);
  });

  it('should track per-route metrics', () => {
    const middleware = performanceMonitor();
    const next: NextFunction = jest.fn();

    // Two requests to the same route
    const req1 = createMockRequest({ method: 'GET', path: '/api/users', route: { path: '/api/users' } as any });
    const res1 = createMockResponse(200);
    middleware(req1, res1, next);
    res1._triggerFinish();

    const req2 = createMockRequest({ method: 'GET', path: '/api/users', route: { path: '/api/users' } as any });
    const res2 = createMockResponse(200);
    middleware(req2, res2, next);
    res2._triggerFinish();

    const routeData = metrics.routes.get('GET /api/users');
    expect(routeData).toBeDefined();
    expect(routeData!.count).toBe(2);
    expect(routeData!.errors).toBe(0);
  });

  it('should track route errors separately', () => {
    const middleware = performanceMonitor();
    const next: NextFunction = jest.fn();

    const req = createMockRequest({ method: 'POST', path: '/api/invoices', route: { path: '/api/invoices' } as any });
    const res = createMockResponse(422);
    middleware(req, res, next);
    res._triggerFinish();

    const routeData = metrics.routes.get('POST /api/invoices');
    expect(routeData).toBeDefined();
    expect(routeData!.errors).toBe(1);
  });

  it('should skip excluded paths', () => {
    const middleware = performanceMonitor({ excludePaths: ['/health', '/ping'] });
    const next: NextFunction = jest.fn();

    const req = createMockRequest({ path: '/health' });
    const res = createMockResponse();
    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.totalRequests).toBe(0);
    expect(next).toHaveBeenCalled();
  });

  it('should use /health as default excluded path', () => {
    const middleware = performanceMonitor();
    const next: NextFunction = jest.fn();

    const req = createMockRequest({ path: '/health' });
    const res = createMockResponse();
    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.totalRequests).toBe(0);
  });

  it('should detect slow requests with custom threshold', () => {
    // Use a threshold of 0ms so every request is "slow"
    const middleware = performanceMonitor({ slowRequestThresholdMs: 0 });
    const next: NextFunction = jest.fn();

    const req = createMockRequest();
    const res = createMockResponse();
    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.slowRequests).toBe(1);
  });

  it('should use route path from req.route when available', () => {
    const middleware = performanceMonitor();
    const next: NextFunction = jest.fn();

    const req = createMockRequest({
      method: 'GET',
      path: '/api/users/123',
      route: { path: '/api/users/:id' } as any,
    });
    const res = createMockResponse();
    middleware(req, res, next);
    res._triggerFinish();

    expect(metrics.routes.has('GET /api/users/:id')).toBe(true);
  });
});

// ── Derived metric helpers ────────────────────────────────────────────

describe('metric helpers', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('getAverageResponseTime', () => {
    it('should return 0 when no requests', () => {
      expect(getAverageResponseTime()).toBe(0);
    });

    it('should compute average', () => {
      metrics.totalRequests = 4;
      metrics.totalDurationMs = 200;
      expect(getAverageResponseTime()).toBe(50);
    });
  });

  describe('getErrorRate', () => {
    it('should return 0 when no requests', () => {
      expect(getErrorRate()).toBe(0);
    });

    it('should compute error rate', () => {
      metrics.totalRequests = 10;
      metrics.totalErrors = 3;
      expect(getErrorRate()).toBeCloseTo(0.3);
    });
  });

  describe('getMetricsSummary', () => {
    it('should return a summary object', () => {
      metrics.totalRequests = 5;
      metrics.totalErrors = 1;
      metrics.totalDurationMs = 500;
      metrics.slowRequests = 1;
      metrics.routes.set('GET /api/test', { count: 5, totalMs: 500, errors: 1 });

      const summary = getMetricsSummary();

      expect(summary['totalRequests']).toBe(5);
      expect(summary['totalErrors']).toBe(1);
      expect(summary['errorRate']).toBeCloseTo(0.2);
      expect(summary['averageResponseTimeMs']).toBe(100);
      expect(summary['slowRequests']).toBe(1);
      expect(summary['uptime']).toBeDefined();
      expect((summary['routes'] as Record<string, unknown>)['GET /api/test']).toBeDefined();
    });
  });
});

// ── metricsHandler ────────────────────────────────────────────────────

describe('metricsHandler', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('should respond with JSON metrics', () => {
    metrics.totalRequests = 10;
    metrics.totalErrors = 2;
    metrics.totalDurationMs = 1000;

    const req = {} as Request;
    const res = {
      json: jest.fn(),
    } as unknown as Response;

    metricsHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        totalRequests: 10,
        totalErrors: 2,
      }),
    });
  });
});

// ── resetMetrics ──────────────────────────────────────────────────────

describe('resetMetrics', () => {
  it('should clear all counters and routes', () => {
    metrics.totalRequests = 100;
    metrics.totalErrors = 50;
    metrics.totalDurationMs = 5000;
    metrics.slowRequests = 10;
    metrics.routes.set('GET /x', { count: 1, totalMs: 1, errors: 0 });

    resetMetrics();

    expect(metrics.totalRequests).toBe(0);
    expect(metrics.totalErrors).toBe(0);
    expect(metrics.totalDurationMs).toBe(0);
    expect(metrics.slowRequests).toBe(0);
    expect(metrics.routes.size).toBe(0);
  });
});
