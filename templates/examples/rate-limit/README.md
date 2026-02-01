# 限流功能示例

本示例展示如何使用 `@svton/nestjs-rate-limit` 模块实现接口限流。

## 文件说明

- `api.controller.ts` - API 控制器，展示不同的限流策略

## 核心装饰器

### @RateLimit - 接口限流

```typescript
@RateLimit({ ttl: 60, limit: 10 })
@Get('api')
async api() {
  return { message: 'Success' };
}
```

参数说明：
- `ttl`：时间窗口（秒）
- `limit`：时间窗口内最大请求数

### @UseGuards(RateLimitGuard) - 启用限流

```typescript
@Controller('api')
@UseGuards(RateLimitGuard)
export class ApiController {
  // 所有接口都会应用限流
}
```

## 限流策略

### 1. 普通接口限流

适用于一般 API 接口：

```typescript
@RateLimit({ ttl: 60, limit: 10 })  // 每分钟 10 次
```

### 2. 严格限流

适用于敏感操作：

```typescript
@RateLimit({ ttl: 60, limit: 3 })  // 每分钟 3 次
```

### 3. 防暴力破解

适用于登录、注册等接口：

```typescript
@RateLimit({ ttl: 60, limit: 5 })  // 每分钟 5 次
```

### 4. 验证码限流

防止验证码被刷：

```typescript
@RateLimit({ ttl: 60, limit: 1 })  // 每分钟 1 次
```

### 5. 搜索接口限流

高频接口：

```typescript
@RateLimit({ ttl: 1, limit: 10 })  // 每秒 10 次
```

## 测试接口

### 普通限流（每分钟 10 次）

```bash
# 快速请求 15 次，第 11 次开始会被限流
for i in {1..15}; do
  curl http://localhost:3000/examples/api/normal
  echo ""
done
```

### 严格限流（每分钟 3 次）

```bash
# 快速请求 5 次，第 4 次开始会被限流
for i in {1..5}; do
  curl http://localhost:3000/examples/api/strict
  echo ""
done
```

### 验证码限流（每分钟 1 次）

```bash
# 请求 2 次，第 2 次会被限流
curl -X POST http://localhost:3000/examples/api/send-code
curl -X POST http://localhost:3000/examples/api/send-code
```

## 限流响应

当请求被限流时，会返回 429 状态码：

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "Rate limit exceeded"
}
```

响应头会包含限流信息：

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890
```

## 环境变量配置

在 `.env` 文件中配置：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## 全局限流配置

在 `app.module.ts` 中配置全局限流：

```typescript
RateLimitModule.forRoot({
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
  },
  global: {
    ttl: 60,
    limit: 100,
  },
});
```

## 自定义限流 Key

默认使用 IP 地址作为限流 key，可以自定义：

```typescript
@RateLimit({
  ttl: 60,
  limit: 10,
  keyGenerator: (req) => {
    // 使用用户 ID 作为 key
    return req.user?.id || req.ip;
  },
})
```

## 最佳实践

1. **合理设置限流**：根据接口特点设置不同的限流策略
2. **分级限流**：普通用户和 VIP 用户使用不同的限流规则
3. **白名单机制**：内部服务或管理员不受限流限制
4. **友好提示**：返回清晰的错误信息和重试时间
5. **监控告警**：监控限流触发情况，及时发现异常

## 常见场景

### 登录接口

```typescript
@Post('login')
@RateLimit({ ttl: 60, limit: 5 })  // 防暴力破解
async login() { }
```

### 注册接口

```typescript
@Post('register')
@RateLimit({ ttl: 3600, limit: 3 })  // 每小时 3 次
async register() { }
```

### 发送验证码

```typescript
@Post('send-code')
@RateLimit({ ttl: 60, limit: 1 })  // 每分钟 1 次
async sendCode() { }
```

### 搜索接口

```typescript
@Get('search')
@RateLimit({ ttl: 1, limit: 10 })  // 每秒 10 次
async search() { }
```

### 文件上传

```typescript
@Post('upload')
@RateLimit({ ttl: 60, limit: 5 })  // 每分钟 5 次
async upload() { }
```

## 高级用法

### 动态限流

根据用户等级动态调整限流：

```typescript
@RateLimit({
  ttl: 60,
  limit: (req) => {
    const user = req.user;
    if (user?.vip) return 100;  // VIP 用户
    return 10;  // 普通用户
  },
})
```

### 组合限流

同时应用多个限流规则：

```typescript
@RateLimit({ ttl: 1, limit: 10 })    // 每秒 10 次
@RateLimit({ ttl: 60, limit: 100 })  // 每分钟 100 次
@Get('api')
async api() { }
```

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-rate-limit
