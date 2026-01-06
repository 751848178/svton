# @svton/nestjs-config-schema

为 `@nestjs/config` 提供 Zod schema 验证支持。

## 安装

```bash
pnpm add @svton/nestjs-config-schema zod
```

## 使用

### 定义环境变量 Schema

```typescript
// src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // 数据库
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // 七牛云
  QINIU_ACCESS_KEY: z.string().optional(),
  QINIU_SECRET_KEY: z.string().optional(),
  QINIU_BUCKET: z.string().optional(),
});

// 导出类型
export type EnvConfig = z.infer<typeof envSchema>;
```

### 在 ConfigModule 中使用

```typescript
// src/app.module.ts
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

### 类型安全的配置访问

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './config/env.schema';

@Injectable()
export class MyService {
  constructor(private config: ConfigService<EnvConfig, true>) {}

  getPort(): number {
    return this.config.get('PORT'); // 类型安全
  }
}
```

## 常用 Zod 转换

```typescript
import { z } from 'zod';

const schema = z.object({
  // 字符串转数字
  PORT: z.coerce.number(),
  
  // 字符串转布尔
  DEBUG: z.string().transform((v) => v === 'true'),
  
  // 带默认值
  NODE_ENV: z.string().default('development'),
  
  // 可选字段
  REDIS_URL: z.string().optional(),
  
  // URL 验证
  DATABASE_URL: z.string().url(),
  
  // 枚举
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
  
  // 最小长度
  JWT_SECRET: z.string().min(32),
  
  // 逗号分隔转数组
  CORS_ORIGINS: z.string().transform((v) => v.split(',')),
});
```

## 错误处理

验证失败时会抛出 `ConfigValidationError`：

```
Config validation failed:
  - DATABASE_URL: Required
  - JWT_SECRET: String must contain at least 32 character(s)
```

## 选项

```typescript
createZodValidate(schema, {
  // 验证失败时是否抛出错误（默认 true）
  throwOnError: true,
  
  // 自定义错误格式化
  formatError: (error) => `Custom error: ${error.message}`,
});
```
