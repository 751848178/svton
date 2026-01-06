import { Injectable, Inject, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_OPTIONS } from './constants';
import type { RedisModuleOptions } from './interfaces';

/**
 * 轻量级缓存服务
 * 提供 get/set/del + JSON 序列化 + TTL
 */
@Injectable()
export class CacheService {
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() @Inject(REDIS_OPTIONS) private readonly options?: RedisModuleOptions,
  ) {
    this.defaultTtl = options?.defaultTtl ?? 3600;
    this.keyPrefix = options?.keyPrefix ?? '';
  }

  private buildKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }

  /**
   * 获取缓存值
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.redis.get(this.buildKey(key));
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * 设置缓存值
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const expireTime = ttl ?? this.defaultTtl;

    if (expireTime > 0) {
      await this.redis.setex(this.buildKey(key), expireTime, serialized);
    } else {
      await this.redis.set(this.buildKey(key), serialized);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    await this.redis.del(this.buildKey(key));
  }

  /**
   * 批量删除缓存（支持通配符）
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(this.buildKey(pattern));
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  /**
   * 检查 key 是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.buildKey(key));
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.redis.expire(this.buildKey(key), ttl);
    return result === 1;
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(this.buildKey(key));
  }

  /**
   * 自增
   */
  async incr(key: string): Promise<number> {
    return this.redis.incr(this.buildKey(key));
  }

  /**
   * 自减
   */
  async decr(key: string): Promise<number> {
    return this.redis.decr(this.buildKey(key));
  }
}
