import type { CacheStrategy, CacheConfig } from './types';

interface CacheEntry<T> {
  value: T;
  expireAt?: number;
}

/**
 * 内存缓存实现
 */
export class MemoryCache implements CacheStrategy {
  private cache = new Map<string, CacheEntry<any>>();
  private prefix: string;
  private defaultTtl?: number;

  constructor(config: CacheConfig = {}) {
    this.prefix = config.prefix ?? '';
    this.defaultTtl = config.defaultTtl;
  }

  private getKey(key: string): string {
    return this.prefix + key;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.expireAt) return false;
    return Date.now() > entry.expireAt;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.getKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      return undefined;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const actualTtl = ttl ?? this.defaultTtl;

    const entry: CacheEntry<T> = {
      value,
      expireAt: actualTtl ? Date.now() + actualTtl * 1000 : undefined,
    };

    this.cache.set(fullKey, entry);
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
  }

  async clear(): Promise<void> {
    if (this.prefix) {
      // 只清除带前缀的键
      for (const key of this.cache.keys()) {
        if (key.startsWith(this.prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    await Promise.all(entries.map(({ key, value, ttl }) => this.set(key, value, ttl)));
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expireAt && now > entry.expireAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
}
