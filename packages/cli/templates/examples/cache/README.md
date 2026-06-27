# 缓存功能示例

本示例展示如何使用 `@svton/nestjs-cache` 模块进行声明式缓存。

## 文件说明

- `user.service.ts` - 使用缓存装饰器的 Service 层
- `user.controller.ts` - 对应的 Controller 层

## 核心装饰器

### @Cacheable - 缓存查询结果

```typescript
@Cacheable({ key: 'user:#id', ttl: 3600 })
async findOne(id: number) {
  // 首次调用会执行方法并缓存结果
  // 后续调用直接返回缓存数据
}
```

### @CacheEvict - 清除缓存

```typescript
@CacheEvict({ key: 'user:#id' })
async update(id: number, data: any) {
  // 方法执行后会清除对应的缓存
}
```

### @CachePut - 更新缓存

```typescript
@CachePut({ key: 'user:#id' })
async updateAndRefresh(id: number, data: any) {
  // 方法执行后会用返回值更新缓存
}
```

## Key 表达式

- `#id` - 从 request.params 获取
- `#0`, `#1` - 位置参数
- `#paramName` - 参数名
- `#body.field` - 从 request.body 获取
- `user:*` - 通配符模式（需要 pattern: true）

## 测试接口

启动项目后，可以通过以下接口测试：

```bash
# 查询用户（首次会查询数据库，后续返回缓存）
curl http://localhost:3000/examples/users/1

# 查询用户列表
curl http://localhost:3000/examples/users?page=1&pageSize=10

# 更新用户（会清除缓存）
curl -X PUT http://localhost:3000/examples/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# 更新用户并刷新缓存
curl -X PUT http://localhost:3000/examples/users/1/refresh \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# 清除所有用户缓存
curl -X DELETE http://localhost:3000/examples/users/cache
```

## 最佳实践

1. **合理设置 TTL**：根据数据更新频率设置过期时间
2. **及时清除缓存**：更新/删除操作使用 @CacheEvict
3. **避免缓存穿透**：对空结果也进行缓存
4. **使用命名空间**：key 前缀区分不同业务

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-cache
