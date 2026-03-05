# @svton/logger

> 前端日志与错误追踪 - 支持插件扩展的日志库

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/logger` |
| **版本** | `0.5.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **轻量级** - 零依赖，体积小
2. **可扩展** - 插件系统支持自定义行为
3. **全面捕获** - 错误、性能、用户行为

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/logger
```

### 基本使用

```typescript
import { createLogger } from '@svton/logger';

const logger = createLogger({
  appName: 'my-app',
  appVersion: '1.0.0',
  env: 'production',
  level: 'info',
  reportUrl: 'https://api.example.com/logs',
});

// 记录日志
logger.debug('Debug message', { detail: 'value' });
logger.info('User logged in', { userId: 123 });
logger.warn('API response slow', { duration: 2000 });
logger.error('Request failed', { error: new Error('Network error') });
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | `string` | `'app'` | 应用名称 |
| `appVersion` | `string` | `'1.0.0'` | 应用版本 |
| `env` | `string` | `'development'` | 环境标识 |
| `enabled` | `boolean` | `true` | 是否启用 |
| `level` | `LogLevel` | `'info'` | 最小日志级别 |
| `stackLevel` | `StackLevel` | `'error'` | 堆栈追踪级别 |
| `reportUrl` | `string` | - | 上报端点 |
| `reportStrategy` | `'immediate' \| 'batch'` | `'batch'` | 上报策略 |
| `batchSize` | `number` | `10` | 批量上报大小 |
| `batchInterval` | `number` | `5000` | 批量上报间隔（ms） |
| `console` | `boolean` | `true` | 是否控制台输出 |
| `captureGlobalErrors` | `boolean` | `true` | 捕获全局错误 |
| `captureUnhandledRejections` | `boolean` | `true` | 捕获 Promise 错误 |
| `capturePerformance` | `boolean` | `false` | 捕获性能指标 |
| `plugins` | `LoggerPlugin[]` | `[]` | 插件列表 |

### 日志级别

| 级别 | 说明 |
|------|------|
| `debug` | 调试信息 |
| `info` | 一般信息 |
| `warn` | 警告信息 |
| `error` | 错误信息 |

### 堆栈追踪级别

| 级别 | 说明 |
|------|------|
| `none` | 不追踪 |
| `error` | 仅 error 级别 |
| `warn` | warn 及以上 |
| `all` | 所有级别 |

---

## 🔧 API

### 日志方法

```typescript
// Debug 日志
logger.debug(message: string, data?: Record<string, unknown>): void

// Info 日志
logger.info(message: string, data?: Record<string, unknown>): void

// Warn 日志
logger.warn(message: string, data?: Record<string, unknown>): void

// Error 日志
logger.error(message: string, data?: Record<string, unknown> | Error): void
```

### 配置方法

```typescript
// 设置配置
logger.setConfig(config: Partial<LoggerConfig>): void

// 获取配置
logger.getConfig(): LoggerConfig

// 设置用户信息
logger.setUser(user: UserInfo | undefined): void

// 获取用户信息
logger.getUser(): UserInfo | undefined

// 启用日志
logger.enable(): void

// 禁用日志
logger.disable(): void

// 设置日志级别
logger.setLevel(level: LogLevel): void

// 设置堆栈追踪级别
logger.setStackLevel(stackLevel: StackLevel): void

// 手动上报
logger.flush(): Promise<void>

// 销毁实例
logger.destroy(): void
```

### 插件管理

```typescript
// 添加插件
logger.addPlugin(plugin: LoggerPlugin): void

// 移除插件
logger.removePlugin(name: string): void
```

---

## 🔌 插件系统

### 插件接口

```typescript
interface LoggerPlugin {
  name: string;
  hooks: {
    beforeLog?: (event: LogEvent) => LogEvent | null;
    afterLog?: (event: LogEvent) => void;
    beforeReport?: (events: LogEvent[]) => LogEvent[];
    afterReport?: (events: LogEvent[], success: boolean) => void;
    onInit?: (config: LoggerConfig) => void;
    onDestroy?: () => void;
  };
}
```

### 自定义插件示例

```typescript
// 敏感信息过滤插件
const sensitiveFilterPlugin: LoggerPlugin = {
  name: 'sensitive-filter',
  hooks: {
    beforeLog: (event) => {
      if (event.data) {
        const filtered = { ...event.data };
        if (filtered.password) filtered.password = '***';
        if (filtered.token) filtered.token = '***';
        return { ...event, data: filtered };
      }
      return event;
    },
  },
};

// 采样插件
const samplingPlugin: LoggerPlugin = {
  name: 'sampling',
  hooks: {
    beforeLog: (event) => {
      // 只上报 10% 的 debug 日志
      if (event.level === 'debug' && Math.random() > 0.1) {
        return null; // 阻止日志
      }
      return event;
    },
  },
};

// 使用插件
const logger = createLogger({
  plugins: [sensitiveFilterPlugin, samplingPlugin],
});
```

---

## 📊 性能监控

### 启用性能监控

```typescript
import { createLogger, setupPerformanceMonitor, getPerformanceMetrics } from '@svton/logger';

const logger = createLogger({
  capturePerformance: true,
});

// 手动设置性能监控
setupPerformanceMonitor({
  onMetrics: (metrics) => {
    logger.info('Performance metrics', metrics);
  },
});

// 获取性能指标
const metrics = getPerformanceMetrics();
console.log(metrics);
// {
//   fcp: 1200,    // First Contentful Paint
//   lcp: 2500,    // Largest Contentful Paint
//   fid: 50,      // First Input Delay
//   cls: 0.1,     // Cumulative Layout Shift
//   ttfb: 200,    // Time to First Byte
//   domContentLoaded: 1500,
//   load: 3000,
// }
```

---

## 🛡️ 错误捕获

### 自动捕获

```typescript
const logger = createLogger({
  captureGlobalErrors: true,
  captureUnhandledRejections: true,
});

// 自动捕获以下错误：
// - window.onerror
// - unhandledrejection
```

### 手动捕获

```typescript
import { setupErrorCapture, wrapWithErrorCapture } from '@svton/logger';

// 设置错误捕获
setupErrorCapture({
  onError: (error, context) => {
    logger.error('Caught error', { error, context });
  },
});

// 包装函数
const safeFunction = wrapWithErrorCapture(async () => {
  // 可能抛出错误的代码
}, { context: 'myFunction' });
```

---

## 📋 日志事件结构

```typescript
interface LogEvent {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: Error;
  stack?: string;
  tags?: string[];
  user?: UserInfo;
  page?: PageInfo;
  device?: DeviceInfo;
}

interface UserInfo {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface PageInfo {
  url: string;
  title?: string;
  referrer?: string;
}

interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
}
```

---

## 📋 常用场景

### 用户行为追踪

```typescript
// 设置用户信息
logger.setUser({
  id: user.id,
  name: user.name,
  email: user.email,
});

// 记录用户行为
logger.info('Button clicked', { button: 'submit', page: 'checkout' });
logger.info('Page viewed', { page: '/products', duration: 5000 });
```

### API 请求日志

```typescript
// 请求拦截器
axios.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  return config;
});

// 响应拦截器
axios.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    logger.info('API request', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      duration,
    });
    return response;
  },
  (error) => {
    logger.error('API error', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    });
    return Promise.reject(error);
  }
);
```

### 错误边界

```typescript
// React 错误边界
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React error boundary', {
      error,
      componentStack: errorInfo.componentStack,
    });
  }
}
```

---

## ✅ 最佳实践

1. **生产环境配置**
   ```typescript
   const logger = createLogger({
     env: process.env.NODE_ENV,
     level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
     console: process.env.NODE_ENV !== 'production',
     reportUrl: process.env.LOG_REPORT_URL,
   });
   ```

2. **敏感信息过滤**
   ```typescript
   // 不要记录敏感信息
   logger.info('User login', { userId: user.id }); // ✅
   logger.info('User login', { password: user.password }); // ❌
   ```

3. **结构化日志**
   ```typescript
   // 使用结构化数据
   logger.info('Order created', {
     orderId: order.id,
     amount: order.amount,
     items: order.items.length,
   });
   ```

4. **合理使用日志级别**
   ```typescript
   logger.debug('Cache hit', { key }); // 调试信息
   logger.info('User registered', { userId }); // 业务事件
   logger.warn('Rate limit approaching', { current, limit }); // 警告
   logger.error('Payment failed', { error }); // 错误
   ```

---

**相关文档**: [@svton/hooks](./hooks.md) | [@svton/service](./service.md)
