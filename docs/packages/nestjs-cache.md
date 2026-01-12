# @svton/nestjs-cache

> NestJS 缓存装饰器模块 - 类 Spring Cache 的声明式缓存

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-cache` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **声明式缓存** - 通过装饰器管理缓存，无需手动操作
2. **Spring Cache 风格** - 熟悉的 @Cacheable、@CacheEvict、@CachePut
3. **自动 Key 生成** - 支持 SpEL 风格的 Key 表达式

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-cache
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@svton/nestjs-cache';
import { RedisModule } from '@svton/nestjs-redis';

@Module({
  imports: [
    RedisModule.forRoot({ /* Redis 配置 */ }),
    CacheModule.forRoot({
      ttl: 3600,           // 默认 TTL 1 小时
      prefix: 'cache',     // Key 前缀
      enabled: true,       // 是否启用
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
CacheModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    ttl: config.get('CACHE_TTL', 3600),
    prefix: config.get('CACHE_PREFIX', 'cache'),
    enabled: config.get('CACHE_ENABLED', true),
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ttl` | `number` | `3600` | 默认过期时间（秒） |
| `prefix` | `string` | `'cache'` | Key 前缀 |
| `enabled` | `boolean` | `true` | 是否启用缓存 |

---

## 🔧 装饰器

### @Cacheable

缓存方法返回值，下次调用直接返回缓存：

```typescript
import { Injectable } from '@nestjs/common';
import { Cacheable } from '@svton/nestjs-cache';

@Injectable()
export class UsersService {
  // 自动生成 Key: cache:UsersService:findOne
  @Cacheable()
  async findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // 自定义 Key: cache:user:123
  @Cacheable({ key: 'user:#id' })
  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // 自定义 TTL
  @Cacheable({ key: 'user:#0', ttl: 7200 })
  async findByIdWithTtl(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### @CacheEvict

清除缓存：

```typescript
import { Injectable } from '@nestjs/common';
import { CacheEvict } from '@svton/nestjs-cache';

@Injectable()
export class UsersService {
  // 更新后清除缓存
  @CacheEvict({ key: 'user:#id' })
  async update(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // 删除后清除缓存
  @CacheEvict({ key: 'user:#id' })
  async remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  // 清除所有匹配的缓存
  @CacheEvict({ key: 'user:*', allEntries: true })
  async clearAllUserCache() {
    // 清除所有用户缓存
  }

  // 方法执行前清除缓存
  @CacheEvict({ key: 'user:#id', beforeInvocation: true })
  async forceUpdate(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
```

### @CachePut

总是执行方法并更新缓存：

```typescript
import { Injectable } from '@nestjs/common';
import { CachePut } from '@svton/nestjs-cache';

@Injectable()
export class UsersService {
  // 更新数据并刷新缓存
  @CachePut({ key: 'user:#id' })
  async updateAndRefresh(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
```

---

## 🔑 Key 表达式

支持 SpEL 风格的 Key 表达式：

| 表达式 | 说明 | 示例 |
|--------|------|------|
| `#0`, `#1` | 位置参数 | `user:#0` → `user:123` |
| `#paramName` | 参数名 | `user:#id` → `user:123` |
| `#id` | 从 request.params 获取 | `user:#id` |
| `#body.field` | 从 request.body 获取 | `user:#body.userId` |
| `#query.field` | 从 request.query 获取 | `list:#query.page` |

### 示例

```typescript
@Injectable()
export class UsersService {
  // 使用位置参数
  @Cacheable({ key: 'user:#0' })
  async findById(id: number) {}

  // 使用参数名
  @Cacheable({ key: 'user:#userId' })
  async findByUserId(userId: number) {}

  // 组合多个参数
  @Cacheable({ key: 'users:#page:#size' })
  async findAll(page: number, size: number) {}
}
```

---

## 📋 装饰器选项

### CacheableOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `key` | `string` | 自动生成 | 缓存 Key 表达式 |
| `ttl` | `number` | 模块默认值 | 过期时间（秒） |

### CacheEvictOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `key` | `string` | 自动生成 | 要清除的 Key |
| `allEntries` | `boolean` | `false` | 是否清除所有匹配的 Key |
| `beforeInvocation` | `boolean` | `false` | 是否在方法执行前清除 |

### CachePutOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `key` | `string` | 自动生成 | 缓存 Key 表达式 |
| `ttl` | `number` | 模块默认值 | 过期时间（秒） |

---

## 📋 常用场景

### 用户信息缓存

```typescript
@Injectable()
export class UsersService {
  @Cacheable({ key: 'user:#id', ttl: 3600 })
  async findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  @CacheEvict({ key: 'user:#id' })
  async update(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }

  @CacheEvict({ key: 'user:#id' })
  async remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

### 配置缓存

```typescript
@Injectable()
export class ConfigService {
  @Cacheable({ key: 'config:#key', ttl: 86400 })
  async getConfig(key: string) {
    return this.prisma.config.findUnique({ where: { key } });
  }

  @CachePut({ key: 'config:#key', ttl: 86400 })
  async setConfig(key: string, value: string) {
    return this.prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
```

### 列表缓存

```typescript
@Injectable()
export class ArticlesService {
  @Cacheable({ key: 'articles:list:#page:#size', ttl: 300 })
  async findAll(page: number, size: number) {
    return this.prisma.article.findMany({
      skip: (page - 1) * size,
      take: size,
    });
  }

  // 创建文章后清除列表缓存
  @CacheEvict({ key: 'articles:list:*', allEntries: true })
  async create(data: CreateArticleDto) {
    return this.prisma.article.create({ data });
  }
}
```

---

## ✅ 最佳实践

1. **合理设置 TTL**
   ```typescript
   // 热点数据：较长 TTL
   @Cacheable({ key: 'config:#key', ttl: 86400 })
   
   // 频繁变化的数据：较短 TTL
   @Cacheable({ key: 'stats:#date', ttl: 300 })
   ```

2. **及时清除缓存**
   ```typescript
   // 数据更新时清除相关缓存
   @CacheEvict({ key: 'user:#id' })
   async update(id: number, data: UpdateUserDto) {}
   ```

3. **使用有意义的 Key**
   ```typescript
   // ✅ 推荐
   @Cacheable({ key: 'user:profile:#userId' })
   
   // ❌ 不推荐
   @Cacheable({ key: '#0' })
   ```

4. **开发环境禁用缓存**
   ```typescript
   CacheModule.forRoot({
     enabled: process.env.NODE_ENV === 'production',
   });
   ```

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [@svton/nestjs-rate-limit](./nestjs-rate-limit.md)
