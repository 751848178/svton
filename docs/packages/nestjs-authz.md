# @svton/nestjs-authz

> NestJS 授权模块，支持角色检查、权限检查、作用域授权，以及与现有认证系统的轻量集成。

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-authz` |
| **版本** | `1.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 核心能力

1. **声明式授权** - 使用 `@Roles()`、`@Permissions()`、`@Public()`
2. **兼容现有用户模型** - 支持 `req.user.role`、`req.user.roles`、`req.user.permissions`
3. **角色继承与作用域** - 基于 `@svton/authz` 支持 scoped grants
4. **同步/异步配置** - `forRoot()` 与 `forRootAsync()` 都可用
5. **双名称守卫导出** - 同时导出 `AuthzGuard` 和 `RolesGuard`

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-authz
```

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { AuthzModule } from '@svton/nestjs-authz';

@Module({
  imports: [
    AuthzModule.forRoot({
      userRoleField: 'roles',
      userPermissionsField: 'permissions',
      enableGlobalGuard: true,
      allowNoRoles: true,
      schema: {
        roles: {
          admin: {
            permissions: ['*'],
          },
          manager: {
            permissions: ['users:read', 'users:update'],
          },
          team_member: {
            permissions: [{ resource: 'team', action: 'read', scopeTypes: ['team'] }],
          },
          team_admin: {
            inherits: ['team_member'],
            permissions: [{ resource: 'member', action: 'invite', scopeTypes: ['team'] }],
          },
        },
      },
      getScope: (context) => {
        const request = context.switchToHttp().getRequest();
        const teamId = request.params?.teamId;
        return teamId ? { type: 'team', id: teamId } : undefined;
      },
    }),
  ],
})
export class AppModule {}
```

### 异步配置

`forRootAsync()` 也支持根据异步解析出来的 `enableGlobalGuard` 自动挂载 `APP_GUARD`：

```typescript
AuthzModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => ({
    userRoleField: config.get('AUTH_ROLE_FIELD', 'role'),
    userPermissionsField: config.get('AUTH_PERMISSIONS_FIELD', 'permissions'),
    enableGlobalGuard: config.get('AUTH_GLOBAL_GUARD', 'true') === 'true',
  }),
});
```

`getAssignments()` 和 `getScope()` 也都支持异步解析，适合把团队成员关系、项目角色之类的授权数据按请求查出来：

```typescript
AuthzModule.forRootAsync({
  imports: [PrismaModule],
  inject: [PrismaService],
  useFactory: (prisma: PrismaService) => ({
    schema: {
      roles: {
        team_member: {},
        team_admin: {
          inherits: ['team_member'],
        },
      },
    },
    getAssignments: async (context) => {
      const request = context.switchToHttp().getRequest();
      const teamId = request.headers['x-team-id'];
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId, userId: request.user.id },
        },
      });

      if (!membership) {
        return {};
      }

      return {
        roles: [
          {
            role: membership.role === 'admin' ? 'team_admin' : 'team_member',
            scope: { type: 'team', id: teamId },
          },
        ],
      };
    },
  }),
});
```

---

## 🔧 使用方法

### `@Roles()`

```typescript
import { Controller, Delete, Get } from '@nestjs/common';
import { Roles } from '@svton/nestjs-authz';

@Controller('users')
export class UsersController {
  @Roles('admin')
  @Get()
  findAll() {}

  @Roles('admin', 'moderator')
  @Delete(':id')
  remove() {}
}
```

### `@Permissions()`

```typescript
import { Controller, Get } from '@nestjs/common';
import { Permissions } from '@svton/nestjs-authz';

@Controller('users')
export class UsersController {
  @Permissions('users:read')
  @Get('report')
  report() {}
}
```

传入多个权限时，命中任一项即可通过：

```typescript
@Permissions('users:read', { resource: 'users', action: 'export' })
@Get('export')
exportUsers() {}
```

### `@Public()`

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@svton/nestjs-authz';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
```

### 手动挂守卫

如果没有启用全局守卫，可以手动使用 `AuthzGuard`：

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AuthzGuard)
export class AdminController {
  @Roles('admin')
  @Get()
  admin() {}
}
```

`RolesGuard` 仍然保留，`AuthzGuard` 只是更贴近语义的别名。

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `userRoleField` | `string` | `'role'` | 用户角色字段，支持嵌套路径 |
| `userPermissionsField` | `string` | `'permissions'` | 用户直接权限字段 |
| `enableGlobalGuard` | `boolean` | `false` | 是否全局启用守卫 |
| `allowNoRoles` | `boolean` | `true` | 未设置角色/权限要求时是否放行 |
| `schema` | `AuthzSchema` | - | 角色继承与权限模型 |
| `getAssignments` | `function` | - | 动态解析角色/权限，支持异步 |
| `getScope` | `function` | - | 为当前请求解析授权 scope，支持异步 |

默认 `userRoleField` 是 `role`。如果未显式配置且 `req.user.role` 不存在，守卫也会自动尝试读取 `req.user.roles`。

---

## 🔐 与 JWT 认证集成

```typescript
// 登录签发
const payload = {
  sub: user.id,
  email: user.email,
  roles: user.roles,
  permissions: user.permissions,
};
```

```typescript
// JwtStrategy.validate()
return {
  id: payload.sub,
  email: payload.email,
  roles: payload.roles,
  permissions: payload.permissions,
};
```

如果你仍然使用单角色字段，也可以继续返回 `role`。

---

## 🌐 作用域授权

当角色或权限只在特定资源范围内生效时，可以通过 `getScope()` 绑定当前请求：

```typescript
AuthzModule.forRoot({
  schema: {
    roles: {
      team_admin: {
        permissions: [{ resource: 'member', action: 'invite', scopeTypes: ['team'] }],
      },
    },
  },
  getScope: (context) => {
    const request = context.switchToHttp().getRequest();
    return { type: 'team', id: request.params.teamId };
  },
});

@Permissions({ resource: 'member', action: 'invite' })
@Post('teams/:teamId/members')
inviteMember() {}
```

---

## ✅ 最佳实践

1. 认证守卫放在前，授权守卫放在后
2. 角色用于粗粒度入口控制，权限用于细粒度动作控制
3. 作用域授权尽量通过 `getScope()` 集中解析
4. 直接权限适合覆盖角色默认授权，尤其适合 deny 规则

---

**相关文档**: [@svton/authz](./authz.md) | [@svton/nestjs-http](./nestjs-http.md) | [后端模块开发](../backend/modules.md)
