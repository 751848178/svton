# @svton/nestjs-authz

NestJS 授权模块，提供：

- `@Roles()` 角色校验
- `@Permissions()` 权限校验
- 基于 `@svton/authz` 的角色继承和作用域授权
- 与现有 `req.user.role` / `req.user.roles` 兼容的轻量接入
- `AuthzGuard` / `RolesGuard` 双名称导出

## 安装

```bash
pnpm add @svton/nestjs-authz
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { AuthzModule } from '@svton/nestjs-authz';

@Module({
  imports: [
    AuthzModule.forRoot({
      userRoleField: 'roles', // 从 req.user.roles 读取角色
      userPermissionsField: 'permissions', // 从 req.user.permissions 读取直接权限
      enableGlobalGuard: true, // 全局启用 RolesGuard
      allowNoRoles: true, // 没有设置角色要求时放行
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

`getAssignments()` 和 `getScope()` 都支持返回 `Promise`，适合按请求查库后再决定 scoped role：

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

### 使用装饰器

```typescript
import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { AuthzGuard, Permissions, Public, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, AuthzGuard) // 如果没有全局启用
export class UserController {
  // 需要 admin 或 moderator 角色
  @Roles('admin', 'moderator')
  @Get()
  findAll() {
    return [];
  }

  // 需要 users:read 权限
  @Permissions('users:read')
  @Get('report')
  report() {
    return [];
  }

  // 只需要 admin 角色
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { deleted: id };
  }

  // 公开路由，跳过角色检查
  @Public()
  @Get('public')
  publicEndpoint() {
    return { message: 'This is public' };
  }
}
```

### 与 JWT 配合使用

确保 JWT payload 中包含角色或权限信息：

```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  async login(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles, // ['admin'] | ['manager']
      permissions: user.permissions, // ['users:read']
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| userRoleField | string | 'role' | 用户角色字段（支持嵌套如 'profile.role'） |
| userPermissionsField | string | 'permissions' | 用户直接权限字段 |
| enableGlobalGuard | boolean | false | 是否全局启用 RolesGuard |
| allowNoRoles | boolean | true | 没有设置角色要求时是否放行 |
| schema | AuthzSchema | - | 角色继承与权限模型 |
| getAssignments | function | - | 自定义解析角色/权限，支持异步 |
| getScope | function | - | 为当前请求解析授权 scope，支持异步 |

默认 `userRoleField` 是 `role`。如果未显式配置且 `req.user.role` 不存在，守卫也会自动尝试读取 `req.user.roles`。

## `forRootAsync()` 与全局 Guard

异步注册时也支持在工厂返回值里设置 `enableGlobalGuard: true`，模块会自动将授权守卫接到 `APP_GUARD`。

## 多角色支持

如果用户有多个角色（数组形式），只要有一个角色匹配即可通过：

```typescript
// JWT payload
{
  sub: '123',
  roles: ['user', 'editor'] // 数组形式
}

// 配置
AuthzModule.forRoot({
  userRoleField: 'roles', // 指向数组字段
})

// 使用
@Roles('editor', 'admin') // 用户有 editor 角色，可以访问
@Get('articles')
findAll() {}
```

## 权限校验

`@Permissions()` 支持字符串权限和 `{ resource, action }` 两种形式。传入多个权限时，命中任一项即可通过：

```typescript
@Permissions('users:read', { resource: 'users', action: 'export' })
@Get('export')
exportUsers() {}
```

## 作用域授权

当角色或权限是作用域化的，比如某个用户仅是 `team_1` 的 `team_admin`，可以通过 `getScope()` 将当前请求绑定到具体作用域：

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

## 动态权限

**已支持：用户的角色/权限实时来自数据库**

通过 `getAssignments()` 在每个请求里查库，**用户被授予/撤销角色或权限时立即生效**，无需重启服务。`RolesGuard` 每次请求都会重新构建授权器，没有跨请求的缓存问题。

```typescript
AuthzModule.forRootAsync({
  inject: [PrismaService],
  useFactory: (prisma: PrismaService) => ({
    schema: { /* 静态角色定义 */ },
    getAssignments: async (context) => {
      const request = context.switchToHttp().getRequest();
      // 每个请求实时查库，DB 改了立刻生效
      const userRoles = await prisma.userRole.findMany({
        where: { userId: request.user.id },
      });
      return {
        roles: userRoles.map((r) => ({
          role: r.role,
          scope: r.teamId ? { type: 'team', id: r.teamId } : undefined,
        })),
      };
    },
  }),
});
```

**不支持（也不建议支持）：schema 热更新**

角色定义（`schema.roles`）应作为业务建模的一部分，**跟随代码版本化、review、灰度发布**。让运营人员在后台动态创建角色定义会引入难以回滚的风险——一旦误删某个关键角色的权限，整个系统可能挂掉。

如果确实需要"角色名由运营自定义"，常见做法是：
- schema 中预留通配角色（如 `custom:*`）
- 在 `getAssignments()` 里把 DB 中的自定义角色名映射到 schema 中的固定角色

更多能力边界说明参见 [`@svton/authz` README](https://www.npmjs.com/package/@svton/authz)。

