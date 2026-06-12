# 权限控制示例

本示例展示如何使用 `@svton/nestjs-authz` 实现角色与权限授权。

## 文件说明

- `user.controller.ts` - 展示 `@Roles()`、`@Permissions()`、`AuthzGuard`
- `README.md` - 当前说明文档

守卫由 `@svton/nestjs-authz` 包直接提供，不需要在示例目录里再维护一个本地 `roles.guard.ts`。

## 核心装饰器

### `@Roles()`

```typescript
@Roles('admin', 'manager')
@Get()
findAll() {
  return { message: 'Admin or Manager' };
}
```

### `@Permissions()`

```typescript
@Permissions('users:delete')
@Delete(':id')
delete(@Param('id') id: string) {
  return { message: 'User deleted', id };
}
```

传入多个权限时，命中任一项即可通过：

```typescript
@Permissions('users:update', 'users:reset-password')
@Post(':id/ops')
runUserOperation() {}
```

### 组合使用

```typescript
@Roles('admin')
@Permissions('users:delete')
@Delete(':id')
delete() {
  // 需要 admin 角色，并且满足 users:delete 权限
}
```

## 当前示例的权限点

- `users:read`
- `users:create`
- `users:update`
- `users:delete`
- `users:export`
- `users:reset-password`

## 守卫接线

```typescript
import { AuthzGuard, Permissions, Roles } from '@svton/nestjs-authz';

@Controller('examples/users')
@UseGuards(AuthzGuard)
export class UserController {}
```

`RolesGuard` 依然可用；`AuthzGuard` 是语义更直接的别名。

## 配置示例

在 `src/config/authz.config.ts` 中可以这样配置：

```typescript
export const useAuthzConfig = (configService: ConfigService) => ({
  userRoleField: 'role',
  userPermissionsField: 'permissions',
  enableGlobalGuard: false,
  schema: {
    roles: {
      admin: {
        permissions: ['*'],
      },
      manager: {
        permissions: [
          'users:read',
          'users:create',
          'users:update',
          'users:export',
          'users:reset-password',
        ],
      },
    },
  },
});
```

如果你的用户对象使用 `req.user.roles`，也可以直接把 `userRoleField` 配成 `'roles'`；不显式配置时，默认也会在 `role` 不存在时自动回退尝试 `roles`。

## 测试接口

### 查看用户列表

```bash
curl http://localhost:3000/examples/users
```

### 创建用户

```bash
curl -X POST http://localhost:3000/examples/users \
  -H "Content-Type: application/json" \
  -d '{"name":"New User","email":"user@example.com"}'
```

### 更新用户

```bash
curl -X PUT http://localhost:3000/examples/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'
```

### 删除用户

```bash
curl -X DELETE http://localhost:3000/examples/users/1
```

## 最佳实践

1. 认证守卫放前面，授权守卫放后面
2. 角色用于入口控制，权限用于动作控制
3. 把角色继承和 deny 规则集中放在 `schema` 中
4. 有资源范围时，优先通过 `getScope()` 做统一解析

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-authz
