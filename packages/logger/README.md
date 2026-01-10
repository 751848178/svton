# @svton/logger

前端日志上报与错误追踪库，支持插件系统和动态配置。

## 特性

- 🎯 多级别日志 (debug, info, warn, error)
- 📦 批量/即时上报策略
- 🔌 插件系统
- 🔧 动态配置修改
- 🐛 全局错误捕获
- 📊 性能监控 (Web Vitals)
- 🔒 敏感信息过滤
- 🍞 面包屑追踪

## 安装

```bash
pnpm add @svton/logger
```

## 快速开始

```typescript
import { createLogger } from '@svton/logger';

const logger = createLogger({
  appName: 'my-app',
  appVersion: '1.0.0',
  env: 'production',
  reportUrl: 'https://api.example.com/logs',
});

// 记录日志
logger.debug('Debug message', { key: 'value' });
logger.info('User logged in', { userId: '123' });
logger.warn('API response slow', { duration: 3000 });
logger.error('Failed to fetch data', { error: new Error('Network error') });
```

## 配置选项

```typescript
interface LoggerConfig {
  appName?: string;           // 应用名称
  appVersion?: string;        // 应用版本
  env?: string;               // 环境 (development/production)
  enabled?: boolean;          // 是否启用
  level?: LogLevel;           // 最小日志级别
  stackLevel?: StackLevel;    // 堆栈追踪级别 ('error' | 'warn' | 'all' | 'none')
  reportUrl?: string;         // 上报端点
  reportStrategy?: 'immediate' | 'batch';  // 上报策略
  batchSize?: number;         // 批量上报大小
  batchInterval?: number;     // 批量上报间隔 (ms)
  user?: UserInfo;            // 用户信息
  headers?: Record<string, string>;  // 自定义请求头
  captureGlobalErrors?: boolean;     // 捕获全局错误
  captureUnhandledRejections?: boolean;  // 捕获 Promise 错误
  console?: boolean;          // 控制台输出
  plugins?: LoggerPlugin[];   // 插件列表
}
```

## 动态配置

```typescript
// 设置用户信息
logger.setUser({ id: '123', name: 'John' });

// 修改日志级别
logger.setLevel('warn');

// 修改堆栈追踪级别
logger.setStackLevel('all');

// 启用/禁用
logger.enable();
logger.disable();

// 修改任意配置
logger.setConfig({ reportStrategy: 'immediate' });
```

## 插件系统

### 内置插件

#### 敏感信息过滤

```typescript
import { createLogger } from '@svton/logger';
import { createSensitiveFilterPlugin } from '@svton/logger/plugins';

const logger = createLogger({
  plugins: [
    createSensitiveFilterPlugin({
      sensitiveFields: ['password', 'token', 'creditCard'],
      replacement: '[FILTERED]',
    }),
  ],
});

logger.info('User data', { password: '123456' });
// 输出: { password: '[FILTERED]' }
```

#### 面包屑追踪

```typescript
import { createLogger } from '@svton/logger';
import { createBreadcrumbPlugin } from '@svton/logger/plugins';

const breadcrumbPlugin = createBreadcrumbPlugin({
  maxBreadcrumbs: 50,
  captureClicks: true,
  captureNavigation: true,
  captureXhr: true,
  captureFetch: true,
});

const logger = createLogger({
  plugins: [breadcrumbPlugin],
});

// 手动添加面包屑
breadcrumbPlugin.addBreadcrumb('custom', 'user', 'User clicked button');

// 获取所有面包屑
const breadcrumbs = breadcrumbPlugin.getBreadcrumbs();
```

### 自定义插件

```typescript
import type { LoggerPlugin } from '@svton/logger';

const myPlugin: LoggerPlugin = {
  name: 'my-plugin',
  hooks: {
    onInit(config) {
      console.log('Logger initialized', config);
    },
    beforeLog(event) {
      // 修改或过滤日志
      return { ...event, data: { ...event.data, custom: true } };
    },
    afterLog(event) {
      // 日志记录后的处理
    },
    beforeReport(events) {
      // 上报前处理
      return events;
    },
    afterReport(events, success) {
      // 上报后处理
    },
    onDestroy() {
      // 清理资源
    },
  },
};
```

## 性能监控

```typescript
import { createLogger, setupPerformanceMonitor } from '@svton/logger';

const logger = createLogger({ appName: 'my-app' });

// 设置性能监控
const cleanup = setupPerformanceMonitor(logger, {
  webVitals: true,      // FCP, LCP, FID, CLS, TTFB
  resources: true,      // 资源加载监控
  longTasks: true,      // 长任务监控
  longTaskThreshold: 50,
});

// 清理
cleanup();
```

## 错误捕获

```typescript
import { createLogger, setupErrorCapture, wrapWithErrorCapture } from '@svton/logger';

const logger = createLogger({ appName: 'my-app' });

// 设置错误捕获
setupErrorCapture(logger, {
  captureConsoleError: true,
  filter: (error) => !error.message.includes('ignore'),
});

// 包装函数
const safeFetch = wrapWithErrorCapture(logger, async (url: string) => {
  const response = await fetch(url);
  return response.json();
}, 'API Request');
```

## 堆栈追踪

默认情况下，`error` 级别的日志会包含堆栈信息。可以通过 `stackLevel` 配置：

```typescript
const logger = createLogger({
  stackLevel: 'error',  // 默认: 只有 error 级别包含堆栈
  // stackLevel: 'warn',   // error 和 warn 级别包含堆栈
  // stackLevel: 'all',    // 所有级别包含堆栈
  // stackLevel: 'none',   // 不包含堆栈
});
```

## 销毁

```typescript
// 销毁 logger，上报剩余日志并清理资源
logger.destroy();
```

## License

MIT
