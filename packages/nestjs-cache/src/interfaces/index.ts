import type { ModuleMetadata, Type } from '@nestjs/common';

export interface CacheModuleOptions {
  /** 默认 TTL (秒) */
  ttl?: number;
  /** Key 前缀 */
  prefix?: string;
  /** 是否启用缓存 (可用于开发环境禁用) */
  enabled?: boolean;
}

export interface CacheOptionsFactory {
  createCacheOptions(): Promise<CacheModuleOptions> | CacheModuleOptions;
}

export interface CacheModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<CacheOptionsFactory>;
  useClass?: Type<CacheOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<CacheModuleOptions> | CacheModuleOptions;
  inject?: unknown[];
}

export interface CacheableOptions {
  /** 缓存 key，支持 SpEL 风格表达式如 #id, #user.id */
  key?: string;
  /** TTL (秒) */
  ttl?: number;
  /** 条件表达式，返回 false 则不缓存 */
  condition?: string;
}

export interface CacheEvictOptions {
  /** 要清除的 key */
  key?: string;
  /** 是否清除所有匹配前缀的 key */
  allEntries?: boolean;
  /** 是否在方法执行前清除 */
  beforeInvocation?: boolean;
}

export interface CachePutOptions {
  /** 缓存 key */
  key?: string;
  /** TTL (秒) */
  ttl?: number;
}
