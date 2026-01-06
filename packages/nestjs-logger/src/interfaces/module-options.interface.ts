import { ModuleMetadata, Type } from '@nestjs/common';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Logger 模块配置选项
 */
export interface LoggerModuleOptions {
  /** 应用名称 */
  appName?: string;
  /** 环境 */
  env?: string;
  /** 日志级别 */
  level?: LogLevel;
  /** 是否启用 pretty print（开发环境） */
  prettyPrint?: boolean;
  /** 排除的路由（不记录日志） */
  excludeRoutes?: string[];
  /** 是否自动生成 requestId */
  autoRequestId?: boolean;
  /** requestId header 名称 */
  requestIdHeader?: string;
  /** 自定义日志字段 */
  customProps?: (req: unknown) => Record<string, unknown>;
  /** 是否记录请求体 */
  logRequestBody?: boolean;
  /** 是否记录响应体 */
  logResponseBody?: boolean;
}

/**
 * 异步配置选项工厂接口
 */
export interface LoggerOptionsFactory {
  createLoggerOptions(): Promise<LoggerModuleOptions> | LoggerModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface LoggerModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<LoggerOptionsFactory>;
  useClass?: Type<LoggerOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
  inject?: unknown[];
}
