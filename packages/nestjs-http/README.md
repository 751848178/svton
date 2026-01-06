# @svton/nestjs-http

NestJS HTTP 响应/异常规范化模块。

## 功能

- 统一响应格式 `{ code, message, data, traceId, timestamp }`
- 全局异常处理
- Prisma 错误自动映射
- 可配置的 traceId 获取

## 安装

```bash
pnpm add @svton/nestjs-http
```

## 使用

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@svton/nestjs-http';

@Module({
  imports: [
    HttpModule.forRoot({
      successCode: 0,
      successMessage: 'success',
      includeTimestamp: true,
      excludePaths: ['/health', '/metrics'],
    }),
  ],
})
export class AppModule {}
```

## 响应格式

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "traceId": "abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误响应

```json
{
  "code": 404,
  "message": "Record not found",
  "data": null,
  "traceId": "abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Prisma 错误映射

| Prisma Code | HTTP Status | 说明 |
|-------------|-------------|------|
| P2002 | 409 Conflict | 唯一约束冲突 |
| P2001/P2025 | 404 Not Found | 记录不存在 |
| P2003 | 400 Bad Request | 外键约束失败 |
| P2011 | 400 Bad Request | 必填字段缺失 |
| P1001-P1003 | 503 Service Unavailable | 数据库连接错误 |

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enableExceptionFilter | boolean | true | 启用全局异常过滤器 |
| enableResponseInterceptor | boolean | true | 启用全局响应拦截器 |
| successCode | number | 0 | 成功响应 code |
| successMessage | string | 'success' | 成功响应消息 |
| includeTimestamp | boolean | true | 包含时间戳 |
| getTraceId | function | - | 自定义 traceId 获取 |
| excludePaths | (string\|RegExp)[] | - | 排除响应包装的路径 |
