/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 堆栈追踪级别配置
 */
export type StackLevel = 'error' | 'warn' | 'all' | 'none';

/**
 * 日志事件
 */
export interface LogEvent {
  /** 日志级别 */
  level: LogLevel;
  /** 日志消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
  /** 额外数据 */
  data?: Record<string, unknown>;
  /** 错误对象 */
  error?: Error;
  /** 堆栈信息 */
  stack?: string;
  /** 标签 */
  tags?: string[];
  /** 用户信息 */
  user?: UserInfo;
  /** 页面信息 */
  page?: PageInfo;
  /** 设备信息 */
  device?: DeviceInfo;
}

/**
 * 用户信息
 */
export interface UserInfo {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * 页面信息
 */
export interface PageInfo {
  url: string;
  title?: string;
  referrer?: string;
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
}

/**
 * 上报策略
 */
export type ReportStrategy = 'immediate' | 'batch';

/**
 * Logger 配置
 */
export interface LoggerConfig {
  /** 应用名称 */
  appName?: string;
  /** 应用版本 */
  appVersion?: string;
  /** 环境 */
  env?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 最小日志级别 */
  level?: LogLevel;
  /** 堆栈追踪级别 (默认 'error') */
  stackLevel?: StackLevel;
  /** 上报端点 */
  reportUrl?: string;
  /** 上报策略 */
  reportStrategy?: ReportStrategy;
  /** 批量上报大小 */
  batchSize?: number;
  /** 批量上报间隔 (ms) */
  batchInterval?: number;
  /** 用户信息 */
  user?: UserInfo;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 是否捕获全局错误 */
  captureGlobalErrors?: boolean;
  /** 是否捕获 Promise 错误 */
  captureUnhandledRejections?: boolean;
  /** 是否捕获性能指标 */
  capturePerformance?: boolean;
  /** 是否在控制台输出 */
  console?: boolean;
  /** 插件列表 */
  plugins?: LoggerPlugin[];
}

/**
 * 插件钩子
 */
export interface PluginHooks {
  /** 日志事件创建前 */
  beforeLog?: (event: LogEvent) => LogEvent | null;
  /** 日志事件创建后 */
  afterLog?: (event: LogEvent) => void;
  /** 上报前 */
  beforeReport?: (events: LogEvent[]) => LogEvent[];
  /** 上报后 */
  afterReport?: (events: LogEvent[], success: boolean) => void;
  /** Logger 初始化 */
  onInit?: (config: LoggerConfig) => void;
  /** Logger 销毁 */
  onDestroy?: () => void;
}

/**
 * 插件接口
 */
export interface LoggerPlugin {
  /** 插件名称 */
  name: string;
  /** 插件钩子 */
  hooks: PluginHooks;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** First Contentful Paint */
  fcp?: number;
  /** Largest Contentful Paint */
  lcp?: number;
  /** First Input Delay */
  fid?: number;
  /** Cumulative Layout Shift */
  cls?: number;
  /** Time to First Byte */
  ttfb?: number;
  /** DOM Content Loaded */
  domContentLoaded?: number;
  /** Load */
  load?: number;
}

/**
 * 面包屑类型
 */
export type BreadcrumbType = 'navigation' | 'click' | 'xhr' | 'fetch' | 'console' | 'custom';

/**
 * 面包屑
 */
export interface Breadcrumb {
  type: BreadcrumbType;
  category: string;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
