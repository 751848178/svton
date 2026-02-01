# 权限控制使用指南

本项目已集成 `@svton/nestjs-authz` 权限控制模块，实现 RBAC 权限管理。

## 已安装的包

- `@svton/nestjs-authz` - 权限控制模块

## 配置文件

- `src/config/authz.config.ts` - 权限配置

## 示例代码位置

查看 `src/examples/authz/` 目录获取完整示例。

## 核心装饰器

### @Roles - 角色权限

```typescript
@Roles('admin')
@Get('admin')
async adminOnly() {
  return { message: 'Admin only' };
}
```

### @Permissions - 细粒度权限

```typescript
@Permissions('user:delete')
@Delete(':id')
async delete(@Param('id') id: string) {
  // 删除用户
}
```

## 文档链接

- 官方文档：https://751848178.github.io/svton/packages/nestjs-authz
- 示例代码：`src/examples/authz/`
