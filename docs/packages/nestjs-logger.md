# @svton/nestjs-logger

> NestJS 日志模块 - 基于 Pino 的高性能结构化日志

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-logger` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **高性能** - 基于 Pino，JSON 序列化性能优异
2. **请求追踪** - 自动生成 requestId，贯穿整个请求链路
3. **环境适配** - 开发环境美化输出，生产环境 JSON 格式

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-logger
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from '@svton/nestjs-logger';

@Module({
  imports: [
    LoggerModule.forRoot({
      appName: 'my-api',
      level: 'info',
      prettyPrint: process.env.NODE_ENV !== 'production',
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    appName: config.get('APP_NAME'),
    env: config.get('NODE_ENV'),
    level: config.get('LOG_LEVEL', 'info'),
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `appName` | `string` | `'app'` | 应用名称 |
| `env` | `string` | `NODE_ENV` | 环境标识 |
| `level` | `LogLevel` | `'debug'`/`'info'` | 日志级别 |
| `prettyPrint` | `boolean` | 非生产环境 | 是否美化输出 |
| `excludeRoutes` | `string[]` | `['/health', '/metrics']` | 排除的路由 |
| `autoRequestId` | `boolean` | `true` | 自动生成 requestId |
| `requestIdHeader` | `string` | `'x-request-id'` | requestId header 名称 |
| `customProps` | `(req) => object` | - | 自定义日志字段 |
| `logRequestBody` | `boolean` | `false` | 是否记录请求体 |
| `logResponseBody` | `boolean` | `false` | 是否记录响应体 |

### 日志级别

```typescript
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
```

---

## 🔧 使用方法

### 注入 Logger

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from '@svton/nestjs-logger';

@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findOne(id: number) {
    this.logger.info({ userId: id }, 'Finding user');
    
    const user = await this.prisma.user.findUnique({ where: { id } });
    
    if (!user) {
      this.logger.warn({ userId: id }, 'User not found');
    }
    
    return user;
  }
}
```

### 使用 NestJS Logger

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async create(dto: CreateUserDto) {
    this.logger.log('Creating user');
    this.logger.debug({ dto }, 'User data');
    this.logger.warn('Something might be wrong');
    this.logger.error('Something went wrong', error.stack);
  }
}
```

---

## 📋 日志输出

### 开发环境（Pretty Print）

```
[2024-01-01 12:00:00.000] INFO (my-api): Finding user
    userId: 1
    req: {
      "id": "abc-123",
      "method": "GET",
      "url": "/users/1"
    }
```

### 生产环境（JSON）

```json
{
  "level": 30,
  "time": 1704067200000,
  "pid": 12345,
  "hostname": "server-1",
  "app": "my-api",
  "env": "production",
  "req": {
    "id": "abc-123",
    "method": "GET",
    "url": "/users/1"
  },
  "userId": 1,
  "msg": "Finding user"
}
```

---

## 🔗 请求追踪

### 自动 RequestId

每个请求自动生成唯一 ID：

```typescript
// 请求头传入
curl -H "x-request-id: my-trace-id" http://localhost:3000/users

// 或自动生成 UUID
// req.id = "550e8400-e29b-41d4-a716-446655440000"
```

### 在响应中返回

配合 `@svton/nestjs-http` 使用：

```typescript
// HttpModule 配置
HttpModule.forRoot({
  getTraceId: (req) => req.id,
});

// 响应
{
  "code": 0,
  "data": {...},
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🚫 排除路由

健康检查等路由不记录日志：

```typescript
LoggerModule.forRoot({
  excludeRoutes: [
    '/health',
    '/metrics',
    '/favicon.ico',
    '/api/internal',
  ],
});
```

---

## 📝 自定义字段

添加全局日志字段：

```typescript
LoggerModule.forRoot({
  customProps: (req) => ({
    userId: req.user?.id,
    tenantId: req.headers['x-tenant-id'],
    version: process.env.APP_VERSION,
  }),
});
```

输出：

```json
{
  "msg": "Request completed",
  "userId": 123,
  "tenantId": "tenant-1",
  "version": "1.0.0"
}
```

---

## 🔒 敏感信息处理

### 不记录请求体

```typescript
LoggerModule.forRoot({
  logRequestBody: false,  // 默认
  logResponseBody: false, // 默认
});
```

### 自定义序列化

```typescript
LoggerModule.forRoot({
  // 通过 customProps 过滤敏感字段
  customProps: (req) => {
    const body = { ...req.body };
    delete body.password;
    delete body.creditCard;
    return { sanitizedBody: body };
  },
});
```

---

## 📊 日志聚合

### 与 ELK 集成

生产环境 JSON 格式可直接被 Filebeat 采集：

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/app/*.log
    json.keys_under_root: true
    json.add_error_key: true
```

### 与 Loki 集成

```yaml
# promtail.yml
scrape_configs:
  - job_name: nestjs
    static_configs:
      - targets:
          - localhost
        labels:
          job: nestjs
          __path__: /var/log/app/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            app: app
```

---

## ✅ 最佳实践

1. **使用结构化日志**
   ```typescript
   // ✅ 推荐
   this.logger.info({ userId, action: 'login' }, 'User logged in');
   
   // ❌ 不推荐
   this.logger.info(`User ${userId} logged in`);
   ```

2. **合理设置日志级别**
   ```typescript
   // 开发环境
   level: 'debug'
   
   // 生产环境
   level: 'info'
   ```

3. **错误日志包含堆栈**
   ```typescript
   try {
     // ...
   } catch (error) {
     this.logger.error({ err: error }, 'Operation failed');
   }
   ```

4. **避免记录敏感信息**
   ```typescript
   // ❌ 不要记录密码、token 等
   this.logger.info({ password }, 'User data');
   ```

---

**相关文档**: [@svton/nestjs-http](./nestjs-http.md) | [环境配置](../deployment/environment.md)
