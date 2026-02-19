/**
 * Unit tests for CacheService (Task 12.3)
 *
 * Tests Redis-backed caching with TTL support, namespace management,
 * cache-aside pattern, and observability stats.
 *
 * Validates: System performance and scalability requirements
 */

import {
  CacheService,
  CacheNamespace,
  DEFAULT_TTL,
  RedisClientLike,
} from '../services/CacheService';

// ── Mock Redis client ─────────────────────────────────────────────────

function createMockRedisClient(store: Map<string, string> = new Map()): RedisClientLike & {
  _store: Map<string, string>;
} {
  return {
    _store: store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, _options?: { EX?: number }) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
    keys: jest.fn(async (pattern: string) => {
      // Simple glob matching: replace * with .*
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(store.keys()).filter((k) => regex.test(k));
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('CacheService', () => {
  let redis: ReturnType<typeof createMockRedisClient>;
  let cache: CacheService;

  beforeEach(() => {
    redis = createMockRedisClient();
    cache = new CacheService(redis);
  });

  // ── buildKey ────────────────────────────────────────────────────────

  describe('buildKey', () => {
    it('should build a key with default prefix and namespace', () => {
      expect(cache.buildKey(CacheNamespace.TRANSACTIONS, 'abc')).toBe('stellar:txn:abc');
    });

    it('should build a key with custom prefix', () => {
      const custom = new CacheService(redis, { keyPrefix: 'app:' });
      expect(custom.buildKey(CacheNamespace.USERS, 'u1')).toBe('app:usr:u1');
    });

    it('should use correct namespace abbreviations', () => {
      expect(cache.buildKey(CacheNamespace.INVOICES, 'x')).toBe('stellar:inv:x');
      expect(cache.buildKey(CacheNamespace.ESCROWS, 'x')).toBe('stellar:esc:x');
      expect(cache.buildKey(CacheNamespace.GENERAL, 'x')).toBe('stellar:gen:x');
    });
  });

  // ── get / set ───────────────────────────────────────────────────────

  describe('get and set', () => {
    it('should return null on cache miss', async () => {
      const result = await cache.get(CacheNamespace.USERS, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should store and retrieve a value', async () => {
      const data = { name: 'Alice', balance: 100 };
      await cache.set(CacheNamespace.USERS, 'u1', data);

      const result = await cache.get(CacheNamespace.USERS, 'u1');
      expect(result).toEqual(data);
    });

    it('should use namespace default TTL when none is provided', async () => {
      await cache.set(CacheNamespace.USERS, 'u1', { a: 1 });

      expect(redis.set).toHaveBeenCalledWith(
        'stellar:usr:u1',
        expect.any(String),
        { EX: DEFAULT_TTL[CacheNamespace.USERS] },
      );
    });

    it('should use custom TTL when provided', async () => {
      await cache.set(CacheNamespace.USERS, 'u1', { a: 1 }, 999);

      expect(redis.set).toHaveBeenCalledWith(
        'stellar:usr:u1',
        expect.any(String),
        { EX: 999 },
      );
    });

    it('should respect TTL overrides from options', async () => {
      const custom = new CacheService(redis, { ttlOverrides: { [CacheNamespace.USERS]: 42 } });
      await custom.set(CacheNamespace.USERS, 'u1', { a: 1 });

      expect(redis.set).toHaveBeenCalledWith(
        'stellar:usr:u1',
        expect.any(String),
        { EX: 42 },
      );
    });

    it('should handle JSON serialization of complex objects', async () => {
      const complex = { arr: [1, 2], nested: { ok: true }, date: '2024-01-01' };
      await cache.set(CacheNamespace.GENERAL, 'c1', complex);

      const result = await cache.get(CacheNamespace.GENERAL, 'c1');
      expect(result).toEqual(complex);
    });

    it('should return null and not throw when redis.get fails', async () => {
      redis.get = jest.fn().mockRejectedValue(new Error('connection lost'));

      const result = await cache.get(CacheNamespace.USERS, 'u1');
      expect(result).toBeNull();
    });

    it('should return false and not throw when redis.set fails', async () => {
      redis.set = jest.fn().mockRejectedValue(new Error('connection lost'));

      const result = await cache.set(CacheNamespace.USERS, 'u1', { a: 1 });
      expect(result).toBe(false);
    });
  });

  // ── delete ──────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete an existing key and return true', async () => {
      await cache.set(CacheNamespace.INVOICES, 'i1', { amount: 50 });
      const deleted = await cache.delete(CacheNamespace.INVOICES, 'i1');

      expect(deleted).toBe(true);
      expect(await cache.get(CacheNamespace.INVOICES, 'i1')).toBeNull();
    });

    it('should return false when key does not exist', async () => {
      const deleted = await cache.delete(CacheNamespace.INVOICES, 'nope');
      expect(deleted).toBe(false);
    });

    it('should return false and not throw when redis.del fails', async () => {
      redis.del = jest.fn().mockRejectedValue(new Error('connection lost'));

      const result = await cache.delete(CacheNamespace.USERS, 'u1');
      expect(result).toBe(false);
    });
  });

  // ── invalidateNamespace ─────────────────────────────────────────────

  describe('invalidateNamespace', () => {
    it('should delete all keys in a namespace', async () => {
      await cache.set(CacheNamespace.TRANSACTIONS, 'a', 1);
      await cache.set(CacheNamespace.TRANSACTIONS, 'b', 2);
      await cache.set(CacheNamespace.USERS, 'u1', 3); // different namespace

      const deleted = await cache.invalidateNamespace(CacheNamespace.TRANSACTIONS);

      expect(deleted).toBe(2);
      expect(await cache.get(CacheNamespace.TRANSACTIONS, 'a')).toBeNull();
      expect(await cache.get(CacheNamespace.TRANSACTIONS, 'b')).toBeNull();
      // Other namespace untouched
      expect(await cache.get(CacheNamespace.USERS, 'u1')).toBe(3);
    });

    it('should return 0 when namespace is empty', async () => {
      const deleted = await cache.invalidateNamespace(CacheNamespace.ESCROWS);
      expect(deleted).toBe(0);
    });

    it('should return 0 and not throw when redis fails', async () => {
      redis.keys = jest.fn().mockRejectedValue(new Error('connection lost'));

      const result = await cache.invalidateNamespace(CacheNamespace.USERS);
      expect(result).toBe(0);
    });
  });

  // ── getOrSet (cache-aside) ──────────────────────────────────────────

  describe('getOrSet', () => {
    it('should return cached value without calling fetcher', async () => {
      await cache.set(CacheNamespace.USERS, 'u1', { name: 'Alice' });
      const fetcher = jest.fn();

      const result = await cache.getOrSet(CacheNamespace.USERS, 'u1', fetcher);

      expect(result).toEqual({ name: 'Alice' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should call fetcher on cache miss and store result', async () => {
      const fetcher = jest.fn().mockResolvedValue({ name: 'Bob' });

      const result = await cache.getOrSet(CacheNamespace.USERS, 'u2', fetcher);

      expect(result).toEqual({ name: 'Bob' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      // Verify it was cached
      const cached = await cache.get(CacheNamespace.USERS, 'u2');
      expect(cached).toEqual({ name: 'Bob' });
    });

    it('should not cache null fetcher results', async () => {
      const fetcher = jest.fn().mockResolvedValue(null);

      const result = await cache.getOrSet(CacheNamespace.USERS, 'u3', fetcher);

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should not cache undefined fetcher results', async () => {
      const fetcher = jest.fn().mockResolvedValue(undefined);

      const result = await cache.getOrSet(CacheNamespace.USERS, 'u4', fetcher);

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should pass custom TTL to set', async () => {
      const fetcher = jest.fn().mockResolvedValue({ x: 1 });

      await cache.getOrSet(CacheNamespace.GENERAL, 'k1', fetcher, 777);

      expect(redis.set).toHaveBeenCalledWith(
        'stellar:gen:k1',
        expect.any(String),
        { EX: 777 },
      );
    });
  });

  // ── Stats ───────────────────────────────────────────────────────────

  describe('getStats / resetStats', () => {
    it('should track hits and misses', async () => {
      await cache.set(CacheNamespace.USERS, 'u1', 'val');

      await cache.get(CacheNamespace.USERS, 'u1'); // hit
      await cache.get(CacheNamespace.USERS, 'u1'); // hit
      await cache.get(CacheNamespace.USERS, 'missing'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('should return 0 hitRate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should reset counters', async () => {
      await cache.get(CacheNamespace.USERS, 'x'); // miss
      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
