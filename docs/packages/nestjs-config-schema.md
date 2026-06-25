# @svton/nestjs-config-schema

> NestJS 配置验证模块 - 使用 Zod 进行环境变量类型安全验证

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-config-schema` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **类型安全** - 使用 Zod Schema 定义环境变量类型
2. **启动时验证** - 应用启动时立即发现配置错误
3. **友好错误** - 清晰的错误信息，快速定位问题

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-config-schema zod
```

### 定义 Schema

```typescript
// config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  // 环境
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // 服务器
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  
  // 数据库
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // 存储
  STORAGE_TYPE: z.enum(['local', 'qiniu', 'cos', 's3']).default('local'),
});

export type EnvConfig = z.infer<typeof envSchema>;
```

### 使用验证

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createZodValidate } from '@svton/nestjs-config-schema';
import { envSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: createZodValidate(envSchema),
    }),
  ],
})
export class AppModule {}
```

---

## 🔧 API

### createZodValidate

创建 Zod 验证函数，用于 `@nestjs/config` 的 `validate` 选项。

```typescript
function createZodValidate<T>(
  schema: ZodSchema<T>,
  options?: ZodValidateOptions,
): (config: Record<string, unknown>) => T;
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `schema` | `ZodSchema<T>` | Zod Schema 定义 |
| `options.throwOnError` | `boolean` | 验证失败时是否抛出错误（默认 `true`） |
| `options.formatError` | `(error: ZodError) => string` | 自定义错误格式化函数 |

### ConfigValidationError

配置验证错误类：

```typescript
class ConfigValidationError extends Error {
  errors: Array<{ path: string; message: string }>;
}
```

---

## 📝 Schema 示例

### 基础类型

```typescript
const schema = z.object({
  // 字符串
  APP_NAME: z.string(),
  
  // 数字（自动转换）
  PORT: z.coerce.number(),
  
  // 布尔值
  DEBUG: z.coerce.boolean().default(false),
  
  // 枚举
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
});
```

### 可选与默认值

```typescript
const schema = z.object({
  // 可选
  REDIS_URL: z.string().optional(),
  
  // 带默认值
  PORT: z.coerce.number().default(3000),
  
  // 可选带默认值
  CACHE_TTL: z.coerce.number().optional().default(3600),
});
```

### URL 验证

```typescript
const schema = z.object({
  DATABASE_URL: z.string().url(),
  API_BASE_URL: z.string().url().startsWith('https://'),
});
```

### 复杂验证

```typescript
const schema = z.object({
  // 最小长度
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  // 正则匹配
  API_KEY: z.string().regex(/^sk-[a-zA-Z0-9]{32}$/),
  
  // 自定义验证
  PORT: z.coerce.number().refine(
    (port) => port >= 1024 && port <= 65535,
    'Port must be between 1024 and 65535',
  ),
});
```

### 条件验证

```typescript
const schema = z.object({
  STORAGE_TYPE: z.enum(['local', 'qiniu']),
  
  // 当 STORAGE_TYPE 为 qiniu 时必填
  QINIU_ACCESS_KEY: z.string().optional(),
  QINIU_SECRET_KEY: z.string().optional(),
}).refine(
  (data) => {
    if (data.STORAGE_TYPE === 'qiniu') {
      return !!data.QINIU_ACCESS_KEY && !!data.QINIU_SECRET_KEY;
    }
    return true;
  },
  { message: 'Qiniu credentials required when STORAGE_TYPE is qiniu' },
);
```

---

## 🔐 类型安全的 ConfigService

```typescript
// config/config.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './env.schema';

@Injectable()
export class TypedConfigService {
  constructor(private config: ConfigService<EnvConfig, true>) {}

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get isProduction(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }
}
```

---

## ❌ 错误处理

验证失败时的错误输出：

```
ConfigValidationError: Config validation failed:
  - DATABASE_URL: Required
  - JWT_SECRET: String must contain at least 32 character(s)
  - PORT: Expected number, received nan
```

### 自定义错误格式

```typescript
createZodValidate(envSchema, {
  formatError: (error) => {
    const issues = error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return `Environment validation failed:\n${issues.join('\n')}`;
  },
});
```

### 不抛出错误（仅警告）

```typescript
createZodValidate(envSchema, {
  throwOnError: false,  // 仅打印警告，不阻止启动
});
```

---

## ✅ 最佳实践

1. **集中管理 Schema**
   ```
   src/
   └── config/
       ├── env.schema.ts    # Schema 定义
       └── index.ts         # 导出
   ```

2. **使用 `.env.example` 文档化**
   ```env
   # .env.example
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=mysql://user:pass@localhost:3306/db
   JWT_SECRET=your-32-character-secret-key-here
   ```

3. **开发环境提供默认值**
   ```typescript
   PORT: z.coerce.number().default(3000),
   ```

4. **生产环境必填敏感配置**
   ```typescript
   JWT_SECRET: z.string().min(32),  // 无默认值，必须配置
   ```

---

**相关文档**: [@svton/nestjs-logger](./nestjs-logger.md) | [环境配置](../framework/deployment/environment.md)
