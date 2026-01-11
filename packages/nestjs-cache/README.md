# @svton/nestjs-cache

NestJS 缓存装饰器模块，基于 Redis，提供 `@Cacheable`、`@CacheEvict`、`@CachePut` 装饰器。

## 安装

```bash
pnpm add @svton/nestjs-cache @svton/nestjs-redis
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { RedisModule } from '@svton/nestjs-redis';
import { CacheModule } from '@svton/nestjs-cache';

@Module({
  imports: [
    RedisModule.forRoot({ host: 'localhost', port: 6379 }),
    CacheModule.forRoot({
      ttl: 3600,      // 默认 TTL (秒)
      prefix: 'app',  // Key 前缀
    }),
  ],
})
export class AppModule {}
```

### @Cacheable - 缓存方法结果

```typescript
import { Cacheable } from '@svton/nestjs-cache';

@Injectable()
export class UserService {
  @Cacheable({ key: 'user:#0', ttl: 3600 })
  async getUser(id: string) {
    return this.userRepo.findById(id);
  }
}
```

### @CacheEvict - 清除缓存

```typescript
import { CacheEvict } from '@svton/nestjs-cache';

@Injectable()
export class UserService {
  @CacheEvict({ key: 'user:#0' })
  async updateUser(id: string, data: UpdateUserDto) {
    return this.userRepo.update(id, data);
  }

  @CacheEvict({ key: 'user:*', allEntries: true })
  async clearAllUserCache() {
    // 清除所有 user:* 缓存
  }
}
```

### @CachePut - 强制更新缓存

```typescript
import { CachePut } from '@svton/nestjs-cache';

@Injectable()
export class UserService {
  @CachePut({ key: 'user:#0', ttl: 3600 })
  async refreshUser(id: string) {
    return this.userRepo.findById(id);
  }
}
```

## Key 表达式

- `#0`, `#1` - 方法参数位置
- `#id`, `#userId` - 从 request.params/body/query 获取

## License

MIT
