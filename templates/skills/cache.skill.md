# 缓存功能使用指南

本项目已集成 `@svton/nestjs-cache` 缓存模块，提供声明式缓存能力。

## 已安装的包

- `@svton/nestjs-cache` - 缓存装饰器模块
- `@svton/nestjs-redis` - Redis 连接模块

## 配置文件

- `src/config/cache.config.ts` - 缓存配置
- `.env` - 环境变量配置（REDIS_HOST, REDIS_PORT, REDIS_PASSWORD）

## 示例代码位置

查看 `src/examples/cache/` 目录获取完整示例：
- `user.service.ts` - Service 层缓存使用
- `user.controller.ts` - Controller 层使用
- `README.md` - 详细说明文档

## 核心装饰器

### @Cacheable - 缓存查询结果

```typescript
@Cacheable({ key: 'user:#id', ttl: 3600 })
async findOne(id: number) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

### @CacheEvict - 清除缓存

```typescript
@CacheEvict({ key: 'user:#id' })
async update(id: number, data: UpdateUserDto) {
  return this.prisma.user.update({ where: { id }, data });
}
```

### @CachePut - 更新缓存

```typescript
@CachePut({ key: 'user:#id' })
async updateAndRefresh(id: number, data: UpdateUserDto) {
  return this.prisma.user.update({ where: { id }, data });
}
```

## Key 表达式规则

- `#id` - 从 request.params 获取
- `#0`, `#1` - 位置参数
- `#paramName` - 参数名
- `#body.field` - 从 request.body 获取

## 最佳实践

1. **合理设置 TTL**：根据数据更新频率设置过期时间
2. **及时清除缓存**：更新/删除操作使用 @CacheEvict
3. **避免缓存穿透**：对空结果也进行缓存
4. **使用命名空间**：key 前缀区分不同业务

## 常见场景

### 用户信息缓存
```typescript
@Cacheable({ key: 'user:#id', ttl: 3600 })
async getUserById(id: number) { }
```

### 列表查询缓存
```typescript
@Cacheable({ key: 'users:list:#page:#pageSize', ttl: 300 })
async getUsers(page: number, pageSize: number) { }
```

### 批量清除缓存
```typescript
@CacheEvict({ key: 'users:*', pattern: true })
async clearAllUserCache() { }
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-cache
- 示例代码：`src/examples/cache/`
