# @svton/nestjs-logger

NestJS 日志模块，基于 pino，支持 requestId/traceId 追踪。

## 安装

```bash
pnpm add @svton/nestjs-logger
```

## 使用

### 模块注册

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
        excludeRoutes: ['/health', '/metrics'],
      }),
    }),
  ],
})
export class AppModule {}
```

### 在 main.ts 中使用

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
bootstrap();
```

### 在服务中使用

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class UserService {
  constructor(
    @InjectPinoLogger(UserService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findUser(id: string) {
    this.logger.info({ userId: id }, 'Finding user');
    // ...
  }
}
```

## 日志输出示例

### 开发环境（pretty print）

```
[2024-01-01 12:00:00.000] INFO (my-api): Request completed
    req: {
      "id": "abc-123",
      "method": "GET",
      "url": "/api/users/1"
    }
    res: {
      "statusCode": 200
    }
    responseTime: 15
```

### 生产环境（JSON）

```json
{
  "level": 30,
  "time": 1704067200000,
  "app": "my-api",
  "env": "production",
  "req": { "id": "abc-123", "method": "GET", "url": "/api/users/1" },
  "res": { "statusCode": 200 },
  "responseTime": 15,
  "msg": "Request completed"
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| appName | string | 'app' | 应用名称 |
| env | string | NODE_ENV | 环境标识 |
| level | string | 'info' | 日志级别 |
| prettyPrint | boolean | dev: true | 是否美化输出 |
| excludeRoutes | string[] | ['/health'] | 排除的路由 |
| autoRequestId | boolean | true | 自动生成 requestId |
| requestIdHeader | string | 'x-request-id' | requestId header |
| customProps | function | - | 自定义日志字段 |
| logRequestBody | boolean | false | 记录请求体 |
| logResponseBody | boolean | false | 记录响应体 |
