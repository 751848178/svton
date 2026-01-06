import type { ModuleMetadata, Type } from '@nestjs/common';
import type { RedisOptions } from 'ioredis';

/**
 * Redis 模块配置选项
 */
export interface RedisModuleOptions extends RedisOptions {
  url?: string;
  enableCacheService?: boolean;
  defaultTtl?: number;
  keyPrefix?: string;
}

/**
 * 异步配置选项工厂接口
 */
export interface RedisOptionsFactory {
  createRedisOptions(): Promise<RedisModuleOptions> | RedisModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface RedisModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<RedisOptionsFactory>;
  useClass?: Type<RedisOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<RedisModuleOptions> | RedisModuleOptions;
  inject?: unknown[];
}
