# 权限控制示例

本示例展示如何使用 `@svton/nestjs-authz` 模块实现 RBAC 权限管理。

## 文件说明

- `user.controller.ts` - 用户控制器，展示权限控制
- `roles.guard.ts` - 角色守卫，验证用户权限

## 核心装饰器

### @Roles - 角色权限

限制只有特定角色才能访问：

```typescript
@Roles('admin')
@Get('admin')
async adminOnly() {
  return { message: 'Admin only' };
}
```

支持多个角色（满足其一即可）：

```typescript
@Roles('admin', 'manager')
@Get('list')
async list() {
  return { message: 'Admin or Manager' };
}
```

### @Permissions - 细粒度权限

基于权限点的访问控制：

```typescript
@Permissions('user:delete')
@Delete(':id')
async delete(@Param('id') id: string) {
  return { message: 'User deleted' };
}
```

支持多个权限（需要全部满足）：

```typescript
@Permissions('user:update', 'user:sensitive')
@Put(':id/sensitive')
async updateSensitive() {
  return { message: 'Updated' };
}
```

### 组合使用

同时检查角色和权限：

```typescript
@Roles('admin')
@Permissions('user:delete')
@Delete(':id')
async delete() {
  // 需要 admin 角色且有 user:delete 权限
}
```

## 权限模型

### 角色（Roles）

- `admin` - 管理员，拥有所有权限
- `manager` - 管理者，拥有部分管理权限
- `user` - 普通用户，基础权限
- `guest` - 访客，只读权限

### 权限点（Permissions）

- `user:create` - 创建用户
- `user:read` - 查看用户
- `user:update` - 更新用户
- `user:delete` - 删除用户
- `user:batch-delete` - 批量删除用户
- `user:reset-password` - 重置密码

## 测试接口

### 查看用户列表（需要 admin 或 manager）

```bash
curl http://localhost:3000/examples/users
```

### 查看用户详情（所有用户）

```bash
curl http://localhost:3000/examples/users/1
```

### 创建用户（需要 admin）

```bash
curl -X POST http://localhost:3000/examples/users \
  -H "Content-Type: application/json" \
  -d '{"name":"New User","email":"user@example.com"}'
```

### 更新用户（需要 user:update 权限）

```bash
curl -X PUT http://localhost:3000/examples/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'
```

### 删除用户（需要 admin 角色和 user:delete 权限）

```bash
curl -X DELETE http://localhost:3000/examples/users/1
```

## 权限配置

在 `src/config/authz.config.ts` 中配置：

```typescript
export const useAuthzConfig = (configService: ConfigService) => ({
  roles: ['admin', 'manager', 'user', 'guest'],
  defaultRole: 'guest',
  rolePermissions: {
    admin: ['*'], // 所有权限
    manager: [
      'user:read',
      'user:update',
      'user:reset-password',
    ],
    user: [
      'user:read',
    ],
    guest: [],
  },
});
```

## 实现原理

### 1. 定义守卫

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get('roles', context.getHandler());
    const user = context.switchToHttp().getRequest().user;
    
    return requiredRoles.some(role => user.role === role);
  }
}
```

### 2. 应用守卫

```typescript
@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
  // 所有接口都会应用权限检查
}
```

### 3. 使用装饰器

```typescript
@Roles('admin')
@Get('admin')
async adminOnly() { }
```

## 最佳实践

1. **最小权限原则**：只授予必要的权限
2. **角色分层**：设计合理的角色层级
3. **权限粒度**：根据业务需求设计权限点
4. **动态权限**：支持运行时动态调整权限
5. **权限缓存**：缓存用户权限，提高性能

## 常见场景

### 用户管理

```typescript
@Roles('admin')
@Get('users')
async getUsers() { }  // 只有管理员可以查看用户列表

@Permissions('user:update')
@Put('users/:id')
async updateUser() { }  // 需要更新权限
```

### 内容管理

```typescript
@Roles('admin', 'editor')
@Post('articles')
async createArticle() { }  // 管理员和编辑可以创建文章

@Permissions('article:publish')
@Post('articles/:id/publish')
async publishArticle() { }  // 需要发布权限
```

### 数据导出

```typescript
@Roles('admin', 'manager')
@Get('export')
async export() { }  // 管理员和管理者可以导出数据
```

## 高级用法

### 动态权限检查

```typescript
@Get(':id')
async findOne(@Param('id') id: string, @Req() req) {
  const user = req.user;
  
  // 用户只能查看自己的数据，管理员可以查看所有
  if (user.role !== 'admin' && user.id !== parseInt(id)) {
    throw new ForbiddenException('Access denied');
  }
  
  return this.userService.findOne(id);
}
```

### 资源级权限

```typescript
@Put(':id')
async update(@Param('id') id: string, @Req() req) {
  const resource = await this.userService.findOne(id);
  
  // 检查用户是否有权限修改这个资源
  if (!this.authzService.canModify(req.user, resource)) {
    throw new ForbiddenException('Access denied');
  }
  
  return this.userService.update(id, data);
}
```

### 条件权限

```typescript
@Post('approve')
@Permissions('order:approve')
async approve(@Body() data, @Req() req) {
  // 只能审批金额小于 10000 的订单
  if (data.amount > 10000 && !req.user.permissions.includes('order:approve-large')) {
    throw new ForbiddenException('Cannot approve large orders');
  }
  
  return this.orderService.approve(data.id);
}
```

## 更多信息

查看官方文档：https://751848178.github.io/svton/packages/nestjs-authz
