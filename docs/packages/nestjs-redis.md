# @svton/nestjs-redis

> NestJS Redis 模块 - 连接管理和缓存服务

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-redis` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **简单易用** - 开箱即用的缓存服务
2. **连接管理** - 自动处理连接和断开
3. **类型安全** - 完整的 TypeScript 支持

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-redis
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '@svton/nestjs-redis';

@Module({
  imports: [
    RedisModule.forRoot({
      host: 'localhost',
      port: 6379,
      password: 'your-password',
      db: 0,
      keyPrefix: 'myapp:',
      defaultTtl: 3600,
    }),
  ],
})
export class AppModule {}
```

### 使用 URL 连接

```typescript
RedisModule.forRoot({
  url: 'redis://:password@localhost:6379/0',
  keyPrefix: 'myapp:',
});
```

### 异步配置

```typescript
RedisModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    url: config.get('REDIS_URL'),
    keyPrefix: config.get('REDIS_PREFIX', 'app:'),
    defaultTtl: config.get('REDIS_TTL', 3600),
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | `string` | - | Redis 连接 URL |
| `host` | `string` | `'localhost'` | Redis 主机 |
| `port` | `number` | `6379` | Redis 端口 |
| `password` | `string` | - | Redis 密码 |
| `db` | `number` | `0` | 数据库索引 |
| `keyPrefix` | `string` | `''` | 键前缀 |
| `defaultTtl` | `number` | `3600` | 默认过期时间（秒） |

支持所有 [ioredis 配置选项](https://github.com/redis/ioredis#connect-to-redis)。

---

## 🔧 使用方法

### CacheService

内置的缓存服务，提供常用操作：

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '@svton/nestjs-redis';

@Injectable()
export class UsersService {
  constructor(private cache: CacheService) {}

  async findOne(id: number) {
    // 尝试从缓存获取
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) return cached;

    // 从数据库获取
    const user = await this.prisma.user.findUnique({ where: { id } });
    
    // 写入缓存
    if (user) {
      await this.cache.set(`user:${id}`, user, 3600);
    }
    
    return user;
  }

  async update(id: number, data: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    
    // 删除缓存
    await this.cache.del(`user:${id}`);
    
    return user;
  }
}
```

### CacheService API

```typescript
// 获取
await cache.get<T>(key): Promise<T | null>

// 设置
await cache.set<T>(key, value, ttl?): Promise<void>

// 删除
await cache.del(key): Promise<void>

// 批量删除（支持通配符）
await cache.delByPattern('user:*'): Promise<number>

// 检查存在
await cache.exists(key): Promise<boolean>

// 设置过期时间
await cache.expire(key, ttl): Promise<boolean>

// 获取剩余过期时间
await cache.ttl(key): Promise<number>

// 自增
await cache.incr(key): Promise<number>

// 自减
await cache.decr(key): Promise<number>
```

---

## 🔌 直接使用 Redis 客户端

需要更多 Redis 功能时，直接注入客户端：

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@svton/nestjs-redis';
import type { Redis } from 'ioredis';

@Injectable()
export class SessionService {
  constructor(@InjectRedis() private redis: Redis) {}

  async setSession(sessionId: string, data: SessionData) {
    await this.redis.hset(`session:${sessionId}`, {
      userId: data.userId,
      createdAt: Date.now(),
    });
    await this.redis.expire(`session:${sessionId}`, 86400);
  }

  async getSession(sessionId: string) {
    return this.redis.hgetall(`session:${sessionId}`);
  }

  // 使用 Pipeline
  async batchGet(keys: string[]) {
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    return results?.map(([err, value]) => value);
  }

  // 使用 Lua 脚本
  async atomicIncrement(key: string, max: number) {
    const script = `
      local current = redis.call('get', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return -1
      end
      return redis.call('incr', KEYS[1])
    `;
    return this.redis.eval(script, 1, key, max);
  }
}
```

---

## 📋 常用场景

### 缓存穿透防护

```typescript
async findOne(id: number) {
  const cacheKey = `user:${id}`;
  
  // 检查缓存
  const cached = await this.cache.get<User | 'NULL'>(cacheKey);
  if (cached === 'NULL') return null;  // 空值缓存
  if (cached) return cached;

  // 查询数据库
  const user = await this.prisma.user.findUnique({ where: { id } });
  
  // 缓存结果（包括空值）
  await this.cache.set(cacheKey, user || 'NULL', user ? 3600 : 60);
  
  return user;
}
```

### 分布式锁

```typescript
async acquireLock(key: string, ttl = 10): Promise<boolean> {
  const result = await this.redis.set(
    `lock:${key}`,
    '1',
    'EX', ttl,
    'NX',
  );
  return result === 'OK';
}

async releaseLock(key: string): Promise<void> {
  await this.redis.del(`lock:${key}`);
}

// 使用
async processOrder(orderId: string) {
  const locked = await this.acquireLock(`order:${orderId}`);
  if (!locked) {
    throw new ConflictException('Order is being processed');
  }
  
  try {
    // 处理订单...
  } finally {
    await this.releaseLock(`order:${orderId}`);
  }
}
```

### 限流

```typescript
async checkRateLimit(userId: number, limit = 100): Promise<boolean> {
  const key = `ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await this.cache.incr(key);
  
  if (count === 1) {
    await this.cache.expire(key, 60);
  }
  
  return count <= limit;
}
```

### 排行榜

```typescript
async addScore(userId: number, score: number) {
  await this.redis.zadd('leaderboard', score, userId.toString());
}

async getTopUsers(count = 10) {
  return this.redis.zrevrange('leaderboard', 0, count - 1, 'WITHSCORES');
}

async getUserRank(userId: number) {
  return this.redis.zrevrank('leaderboard', userId.toString());
}
```

---

## 🔒 连接管理

模块自动处理连接生命周期：

```typescript
// 连接事件日志
// [RedisModule] Redis connected
// [RedisModule] Redis connection closed

// 应用关闭时自动断开
// [RedisModule] Closing Redis connection...
```

### 连接状态检查

```typescript
@Injectable()
export class HealthService {
  constructor(@InjectRedis() private redis: Redis) {}

  async checkRedis() {
    try {
      await this.redis.ping();
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}
```

---

## ✅ 最佳实践

1. **使用键前缀**
   ```typescript
   RedisModule.forRoot({
     keyPrefix: 'myapp:prod:',
   });
   ```

2. **合理设置 TTL**
   ```typescript
   // 热点数据：较长 TTL
   await cache.set('config', data, 3600);
   
   // 临时数据：较短 TTL
   await cache.set('otp:123', code, 300);
   ```

3. **避免大 Key**
   ```typescript
   // ❌ 不推荐
   await cache.set('all-users', hugeArray);
   
   // ✅ 推荐：分页或分片
   await cache.set('users:page:1', page1);
   ```

4. **使用 Pipeline 批量操作**
   ```typescript
   const pipeline = this.redis.pipeline();
   ids.forEach(id => pipeline.get(`user:${id}`));
   await pipeline.exec();
   ```

---

**相关文档**: [@svton/dynamic-config](./dynamic-config.md) | [环境配置](../framework/deployment/environment.md)
