import type { Logger } from '../logger';

/**
 * 错误捕获配置
 */
export interface ErrorCaptureOptions {
  /** 是否捕获 console.error */
  captureConsoleError?: boolean;
  /** 错误过滤器 */
  filter?: (error: Error) => boolean;
  /** 错误转换器 */
  transform?: (error: Error) => Record<string, unknown>;
}

/**
 * 设置错误捕获
 */
export function setupErrorCapture(logger: Logger, options: ErrorCaptureOptions = {}): () => void {
  const { captureConsoleError = false, filter, transform } = options;

  const cleanups: (() => void)[] = [];

  // 捕获 console.error
  if (captureConsoleError && typeof console !== 'undefined') {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      originalConsoleError.apply(console, args);

      const message = args
        .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
        .join(' ');

      const error = args.find((arg) => arg instanceof Error) as Error | undefined;

      if (error && filter && !filter(error)) {
        return;
      }

      const data = error && transform ? transform(error) : undefined;

      logger.error(`Console Error: ${message}`, {
        ...data,
        args: args.filter((arg) => !(arg instanceof Error)),
      });
    };

    cleanups.push(() => {
      console.error = originalConsoleError;
    });
  }

  // 返回清理函数
  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

/**
 * 包装函数以捕获错误
 */
export function wrapWithErrorCapture<T extends (...args: unknown[]) => unknown>(
  logger: Logger,
  fn: T,
  context?: string
): T {
  return ((...args: unknown[]) => {
    try {
      const result = fn(...args);

      // 处理 Promise
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          logger.error(context || 'Async Error', { error });
          throw error;
        });
      }

      return result;
    } catch (error) {
      logger.error(context || 'Sync Error', { error: error as Error });
      throw error;
    }
  }) as T;
}
