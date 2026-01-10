import type { CacheStrategy, CacheConfig, RedisClientInterface } from './types';

/**
 * Redis 缓存实现
 */
export class RedisCache implements CacheStrategy {
  private prefix: string;
  private defaultTtl: number;

  constructor(
    private redis: RedisClientInterface,
    config: CacheConfig = {},
  ) {
    this.prefix = config.prefix ?? 'config:';
    this.defaultTtl = config.defaultTtl ?? 3600;
  }

  private getKey(key: string): string {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.redis.get(this.getKey(key));
      if (value === null) return undefined;
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const actualTtl = ttl ?? this.defaultTtl;
    const serialized = JSON.stringify(value);

    await this.redis.setex(fullKey, actualTtl, serialized);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(this.prefix + '*');
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.redis.get(this.getKey(key));
    return value !== null;
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    if (keys.length === 0) return [];

    const fullKeys = keys.map((k) => this.getKey(k));
    const values = await this.redis.mget(...fullKeys);

    return values.map((v) => {
      if (v === null) return undefined;
      try {
        return JSON.parse(v) as T;
      } catch {
        return undefined;
      }
    });
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const { key, value, ttl } of entries) {
      const fullKey = this.getKey(key);
      const actualTtl = ttl ?? this.defaultTtl;
      const serialized = JSON.stringify(value);
      pipeline.setex(fullKey, actualTtl, serialized);
    }

    await pipeline.exec();
  }
}
