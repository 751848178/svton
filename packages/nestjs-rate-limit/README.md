# @svton/nestjs-rate-limit

NestJS 限流模块，基于 Redis，支持滑动窗口、固定窗口、令牌桶算法。

## 安装

```bash
pnpm add @svton/nestjs-rate-limit @svton/nestjs-redis
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { RedisModule } from '@svton/nestjs-redis';
import { RateLimitModule } from '@svton/nestjs-rate-limit';

@Module({
  imports: [
    RedisModule.forRoot({ host: 'localhost', port: 6379 }),
    RateLimitModule.forRoot({
      algorithm: 'sliding-window', // 'sliding-window' | 'fixed-window' | 'token-bucket'
      windowSec: 60,               // 时间窗口 (秒)
      limit: 100,                  // 窗口内最大请求数
      prefix: 'ratelimit',         // Key 前缀
    }),
  ],
})
export class AppModule {}
```

### @RateLimit - 自定义限流

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { RateLimit, SkipRateLimit } from '@svton/nestjs-rate-limit';

@Controller('api')
export class ApiController {
  @RateLimit({ limit: 10, windowSec: 60 })
  @Get('data')
  async getData() {}

  @RateLimit({ limit: 5, windowSec: 60, key: 'login' })
  @Post('login')
  async login() {}

  @SkipRateLimit()
  @Get('health')
  async health() {}
}
```

### 响应头

限流信息会自动添加到响应头：

- `X-RateLimit-Limit` - 总限制数
- `X-RateLimit-Remaining` - 剩余请求数
- `X-RateLimit-Reset` - 重置时间 (Unix timestamp)

## 算法说明

| 算法 | 说明 |
|------|------|
| `sliding-window` | 滑动窗口，平滑限流，推荐使用 |
| `fixed-window` | 固定窗口，简单高效，可能有边界突发 |
| `token-bucket` | 令牌桶，允许一定程度的突发流量 |

## License

MIT
