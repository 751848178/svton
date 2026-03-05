# @svton/nestjs-rate-limit

> NestJS 限流模块 - 基于 Redis 的多算法限流

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-rate-limit` |
| **版本** | `2.0.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **多算法支持** - 滑动窗口、固定窗口、令牌桶
2. **装饰器驱动** - 通过装饰器声明式配置限流规则
3. **灵活配置** - 支持全局配置和路由级别覆盖

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-rate-limit
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { RateLimitModule } from '@svton/nestjs-rate-limit';
import { RedisModule } from '@svton/nestjs-redis';

@Module({
  imports: [
    RedisModule.forRoot({ /* Redis 配置 */ }),
    RateLimitModule.forRoot({
      windowSec: 60,        // 时间窗口 60 秒
      limit: 100,           // 每窗口最多 100 次请求
      algorithm: 'sliding-window',
      prefix: 'ratelimit',
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
RateLimitModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    windowSec: config.get('RATE_LIMIT_WINDOW', 60),
    limit: config.get('RATE_LIMIT_MAX', 100),
    algorithm: 'sliding-window',
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `algorithm` | `'sliding-window' \| 'fixed-window' \| 'token-bucket'` | `'sliding-window'` | 限流算法 |
| `windowSec` | `number` | `60` | 时间窗口（秒） |
| `limit` | `number` | `100` | 窗口内最大请求数 |
| `prefix` | `string` | `'ratelimit'` | Redis Key 前缀 |
| `keyGenerator` | `(context) => string` | - | 自定义 Key 生成器 |
| `global` | `boolean` | `true` | 是否全局启用 |
| `skip` | `(context) => boolean` | - | 跳过限流的条件 |
| `message` | `string` | `'Too Many Requests'` | 限流错误消息 |
| `statusCode` | `number` | `429` | HTTP 状态码 |

---

## 🔧 使用方法

### @RateLimit 装饰器

为特定路由设置限流规则：

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { RateLimit, SkipRateLimit } from '@svton/nestjs-rate-limit';

@Controller('api')
export class ApiController {
  // 使用全局配置
  @Get('data')
  getData() {
    return { data: 'ok' };
  }

  // 自定义限流规则：每分钟最多 10 次
  @RateLimit({ windowSec: 60, limit: 10 })
  @Post('submit')
  submit() {
    return { success: true };
  }

  // 更严格的限流：每分钟最多 5 次
  @RateLimit({ windowSec: 60, limit: 5, message: '提交过于频繁' })
  @Post('sensitive')
  sensitiveAction() {
    return { success: true };
  }

  // 自定义 Key（按用户限流）
  @RateLimit({ windowSec: 60, limit: 100, key: 'user-action' })
  @Get('user-data')
  getUserData() {
    return { data: 'user' };
  }
}
```

### @SkipRateLimit 装饰器

跳过限流检查：

```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipRateLimit } from '@svton/nestjs-rate-limit';

@Controller()
export class AppController {
  // 健康检查不限流
  @SkipRateLimit()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
```

### 类级别装饰器

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { RateLimit, SkipRateLimit } from '@svton/nestjs-rate-limit';

@Controller('admin')
@RateLimit({ windowSec: 60, limit: 30 })  // 整个控制器限流
export class AdminController {
  @Get('dashboard')
  dashboard() {}

  @Get('stats')
  stats() {}

  @SkipRateLimit()  // 覆盖类级别设置
  @Get('health')
  health() {}
}
```

---

## 📊 限流算法

### 滑动窗口（默认）

最精确的限流算法，平滑处理请求：

```typescript
RateLimitModule.forRoot({
  algorithm: 'sliding-window',
  windowSec: 60,
  limit: 100,
});
```

### 固定窗口

简单高效，但在窗口边界可能出现突发：

```typescript
RateLimitModule.forRoot({
  algorithm: 'fixed-window',
  windowSec: 60,
  limit: 100,
});
```

### 令牌桶

允许一定程度的突发流量：

```typescript
RateLimitModule.forRoot({
  algorithm: 'token-bucket',
  windowSec: 60,  // 令牌补充周期
  limit: 100,     // 桶容量
});
```

---

## 🔑 自定义 Key 生成

### 按用户限流

```typescript
RateLimitModule.forRoot({
  keyGenerator: (context) => {
    const request = context.switchToHttp().getRequest();
    return request.user?.id || request.ip;
  },
});
```

### 按 API Key 限流

```typescript
RateLimitModule.forRoot({
  keyGenerator: (context) => {
    const request = context.switchToHttp().getRequest();
    return request.headers['x-api-key'] || 'anonymous';
  },
});
```

---

## 📋 响应头

限流信息会自动添加到响应头：

| 响应头 | 说明 |
|--------|------|
| `X-RateLimit-Limit` | 窗口内最大请求数 |
| `X-RateLimit-Remaining` | 剩余请求数 |
| `X-RateLimit-Reset` | 重置时间（Unix 时间戳） |

---

## 🛡️ 跳过条件

```typescript
RateLimitModule.forRoot({
  skip: async (context) => {
    const request = context.switchToHttp().getRequest();
    // 内部 IP 不限流
    if (request.ip?.startsWith('10.')) return true;
    // 管理员不限流
    if (request.user?.role === 'admin') return true;
    return false;
  },
});
```

---

## ✅ 最佳实践

1. **分层限流**
   ```typescript
   // 全局：宽松限制
   RateLimitModule.forRoot({ limit: 1000 });
   
   // 敏感接口：严格限制
   @RateLimit({ limit: 10 })
   @Post('login')
   ```

2. **按用户而非 IP 限流**
   ```typescript
   keyGenerator: (ctx) => ctx.switchToHttp().getRequest().user?.id
   ```

3. **白名单机制**
   ```typescript
   skip: (ctx) => isWhitelisted(ctx.switchToHttp().getRequest())
   ```

4. **监控限流情况**
   ```typescript
   // 记录被限流的请求
   message: '请求过于频繁，请稍后再试',
   ```

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [@svton/nestjs-cache](./nestjs-cache.md)
