# @svton/nestjs-logger

NestJS 日志模块，基于 pino，支持 requestId/traceId 追踪，支持阿里云 SLS 和腾讯云 CLS。

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

## 云日志服务集成

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
            endpoint: config.get('ALIYUN_SLS_ENDPOINT'), // 例如: cn-hangzhou.log.aliyuncs.com
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
          tencentCls: {
            endpoint: config.get('TENCENT_CLS_ENDPOINT'), // 例如: ap-guangzhou.cls.tencentcs.com
            secretId: config.get('TENCENT_SECRET_ID'),
            secretKey: config.get('TENCENT_SECRET_KEY'),
            topicId: config.get('TENCENT_CLS_TOPIC_ID'),
            source: 'my-api', // 可选
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### 同时使用多个云日志服务

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
| cloudLogger | object | - | 云日志服务配置 |

### 云日志服务配置

#### 阿里云 SLS (cloudLogger.aliyunSls)

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| endpoint | string | 是 | SLS endpoint |
| accessKeyId | string | 是 | 访问密钥 ID |
| accessKeySecret | string | 是 | 访问密钥 Secret |
| project | string | 是 | 项目名称 |
| logstore | string | 是 | 日志库名称 |
| source | string | 否 | 日志来源 |
| topic | string | 否 | 日志主题 |

#### 腾讯云 CLS (cloudLogger.tencentCls)

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| endpoint | string | 是 | CLS endpoint |
| secretId | string | 是 | 密钥 ID |
| secretKey | string | 是 | 密钥 Key |
| topicId | string | 是 | 日志主题 ID |
| source | string | 否 | 日志来源 |

## 特性

- ✅ 基于 pino 高性能日志
- ✅ 自动 requestId/traceId 追踪
- ✅ 支持阿里云 SLS
- ✅ 支持腾讯云 CLS
- ✅ 批量发送优化（100条/批次，3秒间隔）
- ✅ 开发环境美化输出
- ✅ 生产环境 JSON 格式
- ✅ 路由过滤
- ✅ 自定义字段
