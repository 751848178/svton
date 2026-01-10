import type { LogLevel, StackLevel, DeviceInfo, PageInfo } from './types';

/**
 * 日志级别优先级
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 检查日志级别是否应该输出
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * 检查是否应该包含堆栈信息
 */
export function shouldIncludeStack(level: LogLevel, stackLevel: StackLevel): boolean {
  switch (stackLevel) {
    case 'none':
      return false;
    case 'all':
      return true;
    case 'error':
      return level === 'error';
    case 'warn':
      return level === 'error' || level === 'warn';
    default:
      return false;
  }
}

/**
 * 获取堆栈信息
 */
export function getStackTrace(): string {
  const error = new Error();
  const stack = error.stack || '';
  // 移除前几行 (Error, getStackTrace, 调用者)
  const lines = stack.split('\n').slice(3);
  return lines.join('\n');
}

/**
 * 获取设备信息
 */
export function getDeviceInfo(): DeviceInfo | undefined {
  if (typeof window === 'undefined') return undefined;

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/**
 * 获取页面信息
 */
export function getPageInfo(): PageInfo | undefined {
  if (typeof window === 'undefined') return undefined;

  return {
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
  };
}

/**
 * 序列化错误对象
 */
export function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 安全的 JSON 序列化
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (value instanceof Error) {
      return serializeError(value);
    }
    return value;
  });
}
