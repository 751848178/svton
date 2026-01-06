# @svton/nestjs-authz

NestJS RBAC 权限模块，提供 `@Roles()` 装饰器和 `RolesGuard`。

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
      userRoleField: 'role', // 从 req.user.role 读取角色
      enableGlobalGuard: true, // 全局启用 RolesGuard
      allowNoRoles: true, // 没有设置角色要求时放行
    }),
  ],
})
export class AppModule {}
```

### 使用装饰器

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles, Public, RolesGuard } from '@svton/nestjs-authz';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // 如果没有全局启用
export class UserController {
  // 需要 admin 或 moderator 角色
  @Roles('admin', 'moderator')
  @Get()
  findAll() {
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

确保 JWT payload 中包含角色信息：

```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  async login(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // 'admin' | 'user' | 'moderator'
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
      role: payload.role, // 角色会被附加到 req.user
    };
  }
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| userRoleField | string | 'role' | 用户角色字段（支持嵌套如 'profile.role'） |
| enableGlobalGuard | boolean | false | 是否全局启用 RolesGuard |
| allowNoRoles | boolean | true | 没有设置角色要求时是否放行 |

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
