# @svton/nestjs-logger

> NestJS 日志模块 - 基于 Pino 的高性能结构化日志，支持阿里云 SLS 和腾讯云 CLS

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-logger` |
| **版本** | `1.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **高性能** - 基于 Pino，JSON 序列化性能优异
2. **请求追踪** - 自动生成 requestId，贯穿整个请求链路
3. **环境适配** - 开发环境美化输出，生产环境 JSON 格式
4. **云原生** - 支持阿里云 SLS 和腾讯云 CLS 日志服务

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-logger
```

### 基础使用

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

## ☁️ 云日志服务集成

### 阿里云 SLS

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@svton/nestjs-logger';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appName: 'my-api',
        env: config.get('NODE_ENV'),
        level: config.get('LOG_LEVEL', 'info'),
        prettyPrint: config.get('NODE_ENV') !== 'production',
        cloudLogger: {
          aliyunSls: {
            endpoint: config.get('ALIYUN_SLS_ENDPOINT'), // cn-hangzhou.log.aliyuncs.com
            accessKeyId: config.get('ALIYUN_ACCESS_KEY_ID'),
            accessKeySecret: config.get('ALIYUN_ACCESS_KEY_SECRET'),
            project: config.get('ALIYUN_SLS_PROJECT'),
            logstore: config.get('ALIYUN_SLS_LOGSTORE'),
            source: 'my-api', // 可选
            topic: 'app-logs', // 可选
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### 腾讯云 CLS

```typescript
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    appName: 'my-api',
    cloudLogger: {
      tencentCls: {
        endpoint: config.get('TENCENT_CLS_ENDPOINT'), // ap-guangzhou.cls.tencentcs.com
        secretId: config.get('TENCENT_SECRET_ID'),
        secretKey: config.get('TENCENT_SECRET_KEY'),
        topicId: config.get('TENCENT_CLS_TOPIC_ID'),
        source: 'my-api', // 可选
      },
    },
  }),
});
```

### 同时使用多个云服务

```typescript
cloudLogger: {
  aliyunSls: {
    endpoint: 'cn-hangzhou.log.aliyuncs.com',
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    project: 'my-project',
    logstore: 'my-logstore',
  },
  tencentCls: {
    endpoint: 'ap-guangzhou.cls.tencentcs.com',
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    topicId: 'xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  },
}
```

**特性**：
- ✅ 批量发送（100条/批次，3秒间隔）
- ✅ 自动重试和错误处理
- ✅ 同时输出到控制台和云服务
- ✅ 零性能影响（异步发送）

---

## ⚙️ 配置选项

### 基础配置

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
| `cloudLogger` | `CloudLoggerConfig` | - | 云日志服务配置 |

### 云日志服务配置

#### 阿里云 SLS (`cloudLogger.aliyunSls`)

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `endpoint` | `string` | 是 | SLS endpoint (例如: cn-hangzhou.log.aliyuncs.com) |
| `accessKeyId` | `string` | 是 | 访问密钥 ID |
| `accessKeySecret` | `string` | 是 | 访问密钥 Secret |
| `project` | `string` | 是 | 项目名称 |
| `logstore` | `string` | 是 | 日志库名称 |
| `source` | `string` | 否 | 日志来源 |
| `topic` | `string` | 否 | 日志主题 |

#### 腾讯云 CLS (`cloudLogger.tencentCls`)

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `endpoint` | `string` | 是 | CLS endpoint (例如: ap-guangzhou.cls.tencentcs.com) |
| `secretId` | `string` | 是 | 密钥 ID |
| `secretKey` | `string` | 是 | 密钥 Key |
| `topicId` | `string` | 是 | 日志主题 ID |
| `source` | `string` | 否 | 日志来源 |

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

## 🌍 环境变量配置

```env
# 应用配置
NODE_ENV=production
LOG_LEVEL=info

# 阿里云 SLS
ALIYUN_SLS_ENDPOINT=cn-hangzhou.log.aliyuncs.com
ALIYUN_ACCESS_KEY_ID=your-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_SLS_PROJECT=my-project
ALIYUN_SLS_LOGSTORE=my-logstore

# 腾讯云 CLS
TENCENT_CLS_ENDPOINT=ap-guangzhou.cls.tencentcs.com
TENCENT_SECRET_ID=your-secret-id
TENCENT_SECRET_KEY=your-secret-key
TENCENT_CLS_TOPIC_ID=xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
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

5. **云日志服务仅在生产环境启用**
   ```typescript
   cloudLogger: process.env.NODE_ENV === 'production' ? {
     aliyunSls: { /* ... */ }
   } : undefined
   ```

---

## 🎯 特性总结

- ✅ 基于 pino 高性能日志
- ✅ 自动 requestId/traceId 追踪
- ✅ 支持阿里云 SLS
- ✅ 支持腾讯云 CLS
- ✅ 批量发送优化（100条/批次，3秒间隔）
- ✅ 开发环境美化输出
- ✅ 生产环境 JSON 格式
- ✅ 路由过滤
- ✅ 自定义字段
- ✅ 多目标同时输出

---

**相关文档**: [@svton/nestjs-http](./nestjs-http.md) | [环境配置](../framework/deployment/environment.md)
