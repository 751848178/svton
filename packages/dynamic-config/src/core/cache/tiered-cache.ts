import type { CacheStrategy } from './types';

/**
 * 分层缓存实现
 * Redis 优先，内存兜底
 */
export class TieredCache implements CacheStrategy {
  constructor(
    private primary: CacheStrategy, // Redis
    private fallback: CacheStrategy, // Memory
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    // 1. 先查 primary (Redis)
    let value = await this.primary.get<T>(key);
    if (value !== undefined) {
      // 同步到 fallback
      await this.fallback.set(key, value);
      return value;
    }

    // 2. primary 没有，查 fallback (Memory)
    value = await this.fallback.get<T>(key);
    if (value !== undefined) {
      // 回写到 primary
      await this.primary.set(key, value).catch(() => {
        // Redis 写入失败不影响返回
      });
    }

    return value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // 同时写入两层
    await Promise.all([
      this.primary.set(key, value, ttl).catch(() => {
        // Redis 写入失败不影响内存缓存
      }),
      this.fallback.set(key, value, ttl),
    ]);
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      this.primary.delete(key).catch(() => {}),
      this.fallback.delete(key),
    ]);
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.primary.clear().catch(() => {}),
      this.fallback.clear(),
    ]);
  }

  async has(key: string): Promise<boolean> {
    const inPrimary = await this.primary.has(key).catch(() => false);
    if (inPrimary) return true;
    return this.fallback.has(key);
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    // 先从 primary 批量获取
    const primaryResults = await this.primary.mget<T>(keys).catch(() => 
      new Array(keys.length).fill(undefined)
    );

    // 找出 primary 中没有的 keys
    const missingIndices: number[] = [];
    const missingKeys: string[] = [];

    primaryResults.forEach((value, index) => {
      if (value === undefined) {
        missingIndices.push(index);
        missingKeys.push(keys[index]);
      }
    });

    // 从 fallback 获取缺失的
    if (missingKeys.length > 0) {
      const fallbackResults = await this.fallback.mget<T>(missingKeys);

      // 合并结果
      missingIndices.forEach((originalIndex, i) => {
        primaryResults[originalIndex] = fallbackResults[i];
      });

      // 回写到 primary
      const toWriteBack = missingIndices
        .map((originalIndex, i) => ({
          key: keys[originalIndex],
          value: fallbackResults[i],
        }))
        .filter((item) => item.value !== undefined) as Array<{ key: string; value: T }>;

      if (toWriteBack.length > 0) {
        await this.primary.mset(toWriteBack).catch(() => {});
      }
    }

    return primaryResults;
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    await Promise.all([
      this.primary.mset(entries).catch(() => {}),
      this.fallback.mset(entries),
    ]);
  }
}
