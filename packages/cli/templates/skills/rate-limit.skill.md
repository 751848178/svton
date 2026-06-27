# 限流功能使用指南

本项目已集成 `@svton/nestjs-rate-limit` 限流模块，基于 Redis 实现。

## 已安装的包

- `@svton/nestjs-rate-limit` - 限流模块
- `@svton/nestjs-redis` - Redis 连接模块

## 配置文件

- `src/config/rate-limit.config.ts` - 限流配置
- `.env` - 环境变量配置

## 示例代码位置

查看 `src/examples/rate-limit/` 目录获取完整示例。

## 核心装饰器

### @RateLimit - 接口限流

```typescript
@RateLimit({ ttl: 60, limit: 10 })
@Get('api')
async api() {
  return { message: 'Success' };
}
```

### 全局限流

在 `app.module.ts` 中配置全局限流规则。

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-rate-limit
- 示例代码：`src/examples/rate-limit/`
