import type {
  LogLevel,
  LogEvent,
  LoggerConfig,
  LoggerPlugin,
  UserInfo,
  StackLevel,
} from './types';
import {
  shouldLog,
  shouldIncludeStack,
  getStackTrace,
  getDeviceInfo,
  getPageInfo,
  safeStringify,
} from './utils';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<LoggerConfig, 'reportUrl' | 'user' | 'headers' | 'plugins'>> & {
  reportUrl?: string;
  user?: UserInfo;
  headers?: Record<string, string>;
  plugins: LoggerPlugin[];
} = {
  appName: 'app',
  appVersion: '1.0.0',
  env: 'development',
  enabled: true,
  level: 'info',
  stackLevel: 'error',
  reportUrl: undefined,
  reportStrategy: 'batch',
  batchSize: 10,
  batchInterval: 5000,
  user: undefined,
  headers: undefined,
  captureGlobalErrors: true,
  captureUnhandledRejections: true,
  capturePerformance: false,
  console: true,
  plugins: [],
};

/**
 * Logger 类
 */
export class Logger {
  private config: typeof DEFAULT_CONFIG;
  private queue: LogEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private destroyed = false;

  constructor(config: LoggerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.init();
  }

  /**
   * 初始化
   */
  private init(): void {
    if (this.initialized || this.destroyed) return;
    this.initialized = true;

    // 调用插件 onInit
    this.config.plugins.forEach((plugin) => {
      plugin.hooks.onInit?.(this.config);
    });

    // 捕获全局错误
    if (this.config.captureGlobalErrors && typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError);
    }

    // 捕获 Promise 错误
    if (this.config.captureUnhandledRejections && typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    // 启动批量上报定时器
    if (this.config.reportStrategy === 'batch' && this.config.reportUrl) {
      this.startBatchTimer();
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // 移除事件监听
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.handleGlobalError);
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    // 停止定时器
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // 上报剩余日志
    this.flush();

    // 调用插件 onDestroy
    this.config.plugins.forEach((plugin) => {
      plugin.hooks.onDestroy?.();
    });
  }

  /**
   * 处理全局错误
   */
  private handleGlobalError = (event: ErrorEvent): void => {
    this.error('Uncaught Error', {
      error: event.error,
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  /**
   * 处理未捕获的 Promise 错误
   */
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.error('Unhandled Promise Rejection', {
      reason: event.reason,
    });
  };

  /**
   * 启动批量上报定时器
   */
  private startBatchTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.config.batchInterval);
  }

  /**
   * 创建日志事件
   */
  private createEvent(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEvent {
    const event: LogEvent = {
      level,
      message,
      timestamp: Date.now(),
      data,
      error,
      user: this.config.user,
      page: getPageInfo(),
      device: getDeviceInfo(),
    };

    // 添加堆栈信息
    if (shouldIncludeStack(level, this.config.stackLevel as StackLevel)) {
      event.stack = error?.stack || getStackTrace();
    }

    return event;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.config.enabled || this.destroyed) return;
    if (!shouldLog(level, this.config.level as LogLevel)) return;

    let event = this.createEvent(level, message, data, error);

    // 调用插件 beforeLog
    for (const plugin of this.config.plugins) {
      const result = plugin.hooks.beforeLog?.(event);
      if (result === null) return; // 插件阻止日志
      if (result) event = result;
    }

    // 控制台输出
    if (this.config.console) {
      this.consoleLog(event);
    }

    // 调用插件 afterLog
    this.config.plugins.forEach((plugin) => {
      plugin.hooks.afterLog?.(event);
    });

    // 添加到队列
    if (this.config.reportUrl) {
      this.queue.push(event);

      // 立即上报或批量上报
      if (this.config.reportStrategy === 'immediate') {
        this.flush();
      } else if (this.queue.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  /**
   * 控制台输出
   */
  private consoleLog(event: LogEvent): void {
    const prefix = `[${this.config.appName}]`;
    const args: unknown[] = [prefix, event.message];

    if (event.data) {
      args.push(event.data);
    }

    if (event.error) {
      args.push(event.error);
    }

    switch (event.level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  /**
   * 上报日志
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.config.reportUrl) return;

    let events = [...this.queue];
    this.queue = [];

    // 调用插件 beforeReport
    for (const plugin of this.config.plugins) {
      events = plugin.hooks.beforeReport?.(events) || events;
    }

    if (events.length === 0) return;

    try {
      const response = await fetch(this.config.reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: safeStringify({
          appName: this.config.appName,
          appVersion: this.config.appVersion,
          env: this.config.env,
          events,
        }),
      });

      const success = response.ok;

      // 调用插件 afterReport
      this.config.plugins.forEach((plugin) => {
        plugin.hooks.afterReport?.(events, success);
      });

      if (!success) {
        // 上报失败，重新加入队列
        this.queue.unshift(...events);
      }
    } catch {
      // 上报失败，重新加入队列
      this.queue.unshift(...events);
    }
  }

  // ============ 公共 API ============

  /**
   * Debug 日志
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Info 日志
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Warn 日志
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Error 日志
   */
  error(message: string, data?: Record<string, unknown> | Error): void {
    if (data instanceof Error) {
      this.log('error', message, undefined, data);
    } else {
      this.log('error', message, data, data?.error as Error | undefined);
    }
  }

  // ============ 动态配置 API ============

  /**
   * 设置配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 设置用户信息
   */
  setUser(user: UserInfo | undefined): void {
    this.config.user = user;
  }

  /**
   * 获取用户信息
   */
  getUser(): UserInfo | undefined {
    return this.config.user;
  }

  /**
   * 启用日志
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * 禁用日志
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 设置堆栈追踪级别
   */
  setStackLevel(stackLevel: StackLevel): void {
    this.config.stackLevel = stackLevel;
  }

  /**
   * 添加插件
   */
  addPlugin(plugin: LoggerPlugin): void {
    this.config.plugins.push(plugin);
    plugin.hooks.onInit?.(this.config);
  }

  /**
   * 移除插件
   */
  removePlugin(name: string): void {
    const index = this.config.plugins.findIndex((p) => p.name === name);
    if (index !== -1) {
      const plugin = this.config.plugins[index];
      plugin.hooks.onDestroy?.();
      this.config.plugins.splice(index, 1);
    }
  }
}

/**
 * 创建 Logger 实例
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}
