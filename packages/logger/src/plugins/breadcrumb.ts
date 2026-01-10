import type { LoggerPlugin, Breadcrumb, BreadcrumbType, LogEvent } from '../types';

/**
 * 面包屑插件配置
 */
export interface BreadcrumbPluginOptions {
  /** 最大面包屑数量 */
  maxBreadcrumbs?: number;
  /** 是否捕获点击事件 */
  captureClicks?: boolean;
  /** 是否捕获导航事件 */
  captureNavigation?: boolean;
  /** 是否捕获 XHR 请求 */
  captureXhr?: boolean;
  /** 是否捕获 Fetch 请求 */
  captureFetch?: boolean;
  /** 是否捕获 console */
  captureConsole?: boolean;
}

/**
 * 面包屑管理器
 */
class BreadcrumbManager {
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number;

  constructor(maxBreadcrumbs: number) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  add(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    });

    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  getAll(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clear(): void {
    this.breadcrumbs = [];
  }
}

/**
 * 创建面包屑插件
 */
export function createBreadcrumbPlugin(options: BreadcrumbPluginOptions = {}): LoggerPlugin & {
  addBreadcrumb: (type: BreadcrumbType, category: string, message: string, data?: Record<string, unknown>) => void;
  getBreadcrumbs: () => Breadcrumb[];
  clearBreadcrumbs: () => void;
} {
  const {
    maxBreadcrumbs = 50,
    captureClicks = true,
    captureNavigation = true,
    captureXhr = true,
    captureFetch = true,
    captureConsole = false,
  } = options;

  const manager = new BreadcrumbManager(maxBreadcrumbs);
  const cleanups: (() => void)[] = [];

  const plugin: LoggerPlugin & {
    addBreadcrumb: (type: BreadcrumbType, category: string, message: string, data?: Record<string, unknown>) => void;
    getBreadcrumbs: () => Breadcrumb[];
    clearBreadcrumbs: () => void;
  } = {
    name: 'breadcrumb',

    addBreadcrumb(type: BreadcrumbType, category: string, message: string, data?: Record<string, unknown>) {
      manager.add({ type, category, message, data });
    },

    getBreadcrumbs() {
      return manager.getAll();
    },

    clearBreadcrumbs() {
      manager.clear();
    },

    hooks: {
      onInit() {
        if (typeof window === 'undefined') return;

        // 捕获点击事件
        if (captureClicks) {
          const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const tagName = target.tagName?.toLowerCase();
            const id = target.id ? `#${target.id}` : '';
            const className = target.className ? `.${target.className.split(' ').join('.')}` : '';
            const text = target.textContent?.slice(0, 50) || '';

            manager.add({
              type: 'click',
              category: 'ui',
              message: `Click on ${tagName}${id}${className}`,
              data: { text },
            });
          };

          document.addEventListener('click', handleClick, true);
          cleanups.push(() => document.removeEventListener('click', handleClick, true));
        }

        // 捕获导航事件
        if (captureNavigation) {
          const handlePopState = () => {
            manager.add({
              type: 'navigation',
              category: 'navigation',
              message: `Navigate to ${window.location.href}`,
            });
          };

          window.addEventListener('popstate', handlePopState);
          cleanups.push(() => window.removeEventListener('popstate', handlePopState));

          // 拦截 pushState 和 replaceState
          const originalPushState = history.pushState;
          const originalReplaceState = history.replaceState;

          history.pushState = function (...args) {
            manager.add({
              type: 'navigation',
              category: 'navigation',
              message: `Push state to ${args[2] || window.location.href}`,
            });
            return originalPushState.apply(this, args);
          };

          history.replaceState = function (...args) {
            manager.add({
              type: 'navigation',
              category: 'navigation',
              message: `Replace state to ${args[2] || window.location.href}`,
            });
            return originalReplaceState.apply(this, args);
          };

          cleanups.push(() => {
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
          });
        }

        // 捕获 XHR 请求
        if (captureXhr && typeof XMLHttpRequest !== 'undefined') {
          const originalOpen = XMLHttpRequest.prototype.open;
          const originalSend = XMLHttpRequest.prototype.send;

          XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
            (this as XMLHttpRequest & { _breadcrumb: { method: string; url: string } })._breadcrumb = {
              method,
              url: url.toString(),
            };
            return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>);
          };

          XMLHttpRequest.prototype.send = function () {
            const xhr = this as XMLHttpRequest & { _breadcrumb?: { method: string; url: string } };
            const breadcrumbData = xhr._breadcrumb;

            if (breadcrumbData) {
              xhr.addEventListener('loadend', () => {
                manager.add({
                  type: 'xhr',
                  category: 'http',
                  message: `${breadcrumbData.method} ${breadcrumbData.url}`,
                  data: { status: xhr.status },
                });
              });
            }

            return originalSend.apply(this, arguments as unknown as Parameters<typeof originalSend>);
          };

          cleanups.push(() => {
            XMLHttpRequest.prototype.open = originalOpen;
            XMLHttpRequest.prototype.send = originalSend;
          });
        }

        // 捕获 Fetch 请求
        if (captureFetch && typeof fetch !== 'undefined') {
          const originalFetch = window.fetch;

          window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = init?.method || 'GET';

            try {
              const response = await originalFetch.apply(this, [input, init]);

              manager.add({
                type: 'fetch',
                category: 'http',
                message: `${method} ${url}`,
                data: { status: response.status },
              });

              return response;
            } catch (error) {
              manager.add({
                type: 'fetch',
                category: 'http',
                message: `${method} ${url}`,
                data: { error: (error as Error).message },
              });
              throw error;
            }
          };

          cleanups.push(() => {
            window.fetch = originalFetch;
          });
        }

        // 捕获 console
        if (captureConsole) {
          const levels = ['log', 'info', 'warn', 'error'] as const;
          const originals: Record<string, (...args: unknown[]) => void> = {};

          levels.forEach((level) => {
            originals[level] = console[level];
            console[level] = (...args: unknown[]) => {
              manager.add({
                type: 'console',
                category: 'console',
                message: args.map((arg) => String(arg)).join(' '),
                data: { level },
              });
              originals[level].apply(console, args);
            };
          });

          cleanups.push(() => {
            levels.forEach((level) => {
              console[level] = originals[level];
            });
          });
        }
      },

      beforeLog(event: LogEvent) {
        // 在 error 级别日志中附加面包屑
        if (event.level === 'error') {
          return {
            ...event,
            data: {
              ...event.data,
              breadcrumbs: manager.getAll(),
            },
          };
        }
        return event;
      },

      onDestroy() {
        cleanups.forEach((cleanup) => cleanup());
        manager.clear();
      },
    },
  };

  return plugin;
}
