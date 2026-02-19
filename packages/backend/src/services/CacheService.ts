/**
 * CacheService — Redis-backed caching for API responses and frequently accessed data.
 *
 * Provides get/set/delete/invalidate methods with TTL support,
 * cache key namespacing for different data types, and cache-aside
 * pattern helpers for common operations.
 *
 * Validates: System performance and scalability requirements (Task 12.3)
 */

import { createLogger } from '../utils/logger';

const logger = createLogger();

// ── Cache namespaces ──────────────────────────────────────────────────

export enum CacheNamespace {
  TRANSACTIONS = 'txn',
  INVOICES = 'inv',
  ESCROWS = 'esc',
  USERS = 'usr',
  GENERAL = 'gen',
}

// ── Default TTLs (seconds) ────────────────────────────────────────────

export const DEFAULT_TTL: Record<CacheNamespace, number> = {
  [CacheNamespace.TRANSACTIONS]: 60,      // 1 minute — transactions change frequently
  [CacheNamespace.INVOICES]: 120,         // 2 minutes
  [CacheNamespace.ESCROWS]: 120,          // 2 minutes
  [CacheNamespace.USERS]: 300,            // 5 minutes — user profiles change rarely
  [CacheNamespace.GENERAL]: 60,           // 1 minute
};

// ── Redis client interface (subset used by CacheService) ──────────────

export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<string | null>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  isOpen?: boolean;
}

// ── CacheService options ──────────────────────────────────────────────

export interface CacheServiceOptions {
  /** Global key prefix (e.g. "stellar:") */
  keyPrefix?: string;
  /** Override default TTLs per namespace */
  ttlOverrides?: Partial<Record<CacheNamespace, number>>;
}

// ── CacheService ──────────────────────────────────────────────────────

export class CacheService {
  private readonly client: RedisClientLike;
  private readonly keyPrefix: string;
  private readonly ttls: Record<CacheNamespace, number>;

  // Simple hit/miss counters for observability
  private _hits = 0;
  private _misses = 0;

  constructor(client: RedisClientLike, options?: CacheServiceOptions) {
    this.client = client;
    this.keyPrefix = options?.keyPrefix ?? 'stellar:';
    this.ttls = { ...DEFAULT_TTL, ...options?.ttlOverrides };
  }

  // ── Key helpers ───────────────────────────────────────────────────

  /**
   * Build a fully-qualified cache key.
   * Format: `{prefix}{namespace}:{key}`
   */
  buildKey(namespace: CacheNamespace, key: string): string {
    return `${this.keyPrefix}${namespace}:${key}`;
  }

  // ── Core CRUD ─────────────────────────────────────────────────────

  /**
   * Retrieve a cached value. Returns `null` on miss.
   */
  async get<T = unknown>(namespace: CacheNamespace, key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(namespace, key);
      const raw = await this.client.get(fullKey);

      if (raw === null) {
        this._misses++;
        return null;
      }

      this._hits++;
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn('CacheService.get failed', { namespace, key, error: (error as Error).message });
      this._misses++;
      return null;
    }
  }

  /**
   * Store a value in the cache with an optional TTL override.
   * If `ttl` is not provided the namespace default is used.
   */
  async set<T = unknown>(
    namespace: CacheNamespace,
    key: string,
    value: T,
    ttl?: number,
  ): Promise<boolean> {
    try {
      const fullKey = this.buildKey(namespace, key);
      const serialized = JSON.stringify(value);
      const expiry = ttl ?? this.ttls[namespace];

      await this.client.set(fullKey, serialized, { EX: expiry });
      return true;
    } catch (error) {
      logger.warn('CacheService.set failed', { namespace, key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Delete a single cache entry.
   */
  async delete(namespace: CacheNamespace, key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(namespace, key);
      const deleted = await this.client.del(fullKey);
      return deleted > 0;
    } catch (error) {
      logger.warn('CacheService.delete failed', { namespace, key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Invalidate all keys in a namespace (pattern-based deletion).
   * Returns the number of keys deleted.
   */
  async invalidateNamespace(namespace: CacheNamespace): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}${namespace}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) return 0;

      const deleted = await this.client.del(keys);
      logger.info('CacheService.invalidateNamespace', { namespace, keysDeleted: deleted });
      return deleted;
    } catch (error) {
      logger.warn('CacheService.invalidateNamespace failed', {
        namespace,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  // ── Cache-aside pattern helper ────────────────────────────────────

  /**
   * Cache-aside (read-through) helper.
   *
   * 1. Try to read from cache.
   * 2. On miss, call `fetcher()` to get the value.
   * 3. Store the result in cache and return it.
   *
   * If the fetcher returns `null` or `undefined` the value is **not** cached
   * to avoid caching negative lookups.
   */
  async getOrSet<T>(
    namespace: CacheNamespace,
    key: string,
    fetcher: () => Promise<T | null | undefined>,
    ttl?: number,
  ): Promise<T | null> {
    // 1. Try cache
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    // 2. Fetch from source
    const value = await fetcher();
    if (value === null || value === undefined) {
      return null;
    }

    // 3. Store in cache
    await this.set(namespace, key, value, ttl);
    return value;
  }

  // ── Observability ─────────────────────────────────────────────────

  /** Return simple hit/miss statistics. */
  getStats(): { hits: number; misses: number; hitRate: number } {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: total === 0 ? 0 : this._hits / total,
    };
  }

  /** Reset hit/miss counters. */
  resetStats(): void {
    this._hits = 0;
    this._misses = 0;
  }
}
