import type { ModuleMetadata, Type } from '@nestjs/common';

/**
 * 统一响应结构
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}

/**
 * 分页响应数据
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 分页响应
 */
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/**
 * HTTP 模块配置选项
 */
export interface HttpModuleOptions {
  enableExceptionFilter?: boolean;
  enableResponseInterceptor?: boolean;
  successCode?: number;
  successMessage?: string;
  includeTimestamp?: boolean;
  getTraceId?: (request: unknown) => string | undefined;
  excludePaths?: (string | RegExp)[];
}

/**
 * 异步配置选项工厂接口
 */
export interface HttpOptionsFactory {
  createHttpOptions(): Promise<HttpModuleOptions> | HttpModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface HttpModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<HttpOptionsFactory>;
  useClass?: Type<HttpOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<HttpModuleOptions> | HttpModuleOptions;
  inject?: unknown[];
}
