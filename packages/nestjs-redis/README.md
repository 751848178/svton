# @svton/nestjs-redis

NestJS Redis 模块，提供连接管理和轻量级缓存服务。

## 安装

```bash
pnpm add @svton/nestjs-redis
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@svton/nestjs-redis';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get('REDIS_URL'),
        // 或者分开配置
        // host: config.get('REDIS_HOST'),
        // port: config.get('REDIS_PORT'),
        // password: config.get('REDIS_PASSWORD'),
        keyPrefix: 'myapp:',
        defaultTtl: 3600,
      }),
    }),
  ],
})
export class AppModule {}
```

### 使用 Redis 客户端

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRedis, Redis } from '@svton/nestjs-redis';

@Injectable()
export class MyService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async doSomething() {
    await this.redis.set('key', 'value');
    const value = await this.redis.get('key');
    return value;
  }
}
```

### 使用 CacheService

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '@svton/nestjs-redis';

@Injectable()
export class UserService {
  constructor(private readonly cache: CacheService) {}

  async getUser(id: string) {
    // 尝试从缓存获取
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) return cached;

    // 从数据库获取
    const user = await this.findUserFromDb(id);
    
    // 写入缓存（1小时过期）
    await this.cache.set(`user:${id}`, user, 3600);
    
    return user;
  }
}
```

## CacheService API

| 方法 | 说明 |
|------|------|
| `get<T>(key)` | 获取缓存值（自动 JSON 反序列化） |
| `set(key, value, ttl?)` | 设置缓存值（自动 JSON 序列化） |
| `del(key)` | 删除缓存 |
| `delByPattern(pattern)` | 批量删除（支持通配符） |
| `exists(key)` | 检查 key 是否存在 |
| `expire(key, ttl)` | 设置过期时间 |
| `ttl(key)` | 获取剩余过期时间 |
| `incr(key)` | 自增 |
| `decr(key)` | 自减 |

## 配置选项

| 选项 | 类型 | 说明 |
|------|------|------|
| url | string | Redis 连接 URL |
| host | string | Redis 主机 |
| port | number | Redis 端口 |
| password | string | Redis 密码 |
| db | number | 数据库索引 |
| keyPrefix | string | 缓存 key 前缀 |
| defaultTtl | number | 默认 TTL（秒） |
