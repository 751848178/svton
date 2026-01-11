import type { ModuleMetadata, Type, ExecutionContext } from '@nestjs/common';

export type RateLimitAlgorithm = 'sliding-window' | 'token-bucket' | 'fixed-window';

export interface RateLimitModuleOptions {
  /** 限流算法，默认 sliding-window */
  algorithm?: RateLimitAlgorithm;
  /** 时间窗口 (秒)，默认 60 */
  windowSec?: number;
  /** 窗口内最大请求数，默认 100 */
  limit?: number;
  /** Key 前缀 */
  prefix?: string;
  /** 自定义 key 生成器 */
  keyGenerator?: (context: ExecutionContext) => string;
  /** 是否全局启用 */
  global?: boolean;
  /** 跳过限流的条件 */
  skip?: (context: ExecutionContext) => boolean | Promise<boolean>;
  /** 限流后的错误消息 */
  message?: string;
  /** HTTP 状态码，默认 429 */
  statusCode?: number;
}

export interface RateLimitOptionsFactory {
  createRateLimitOptions(): Promise<RateLimitModuleOptions> | RateLimitModuleOptions;
}

export interface RateLimitModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<RateLimitOptionsFactory>;
  useClass?: Type<RateLimitOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<RateLimitModuleOptions> | RateLimitModuleOptions;
  inject?: unknown[];
}

export interface RateLimitConfig {
  /** 时间窗口 (秒) */
  windowSec?: number;
  /** 窗口内最大请求数 */
  limit?: number;
  /** 自定义 key 后缀 */
  key?: string;
  /** 错误消息 */
  message?: string;
}

export interface RateLimitInfo {
  /** 剩余请求数 */
  remaining: number;
  /** 总限制数 */
  limit: number;
  /** 重置时间 (Unix timestamp) */
  resetTime: number;
  /** 是否被限流 */
  blocked: boolean;
}
