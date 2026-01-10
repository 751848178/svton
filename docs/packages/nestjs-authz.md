# @svton/nestjs-authz

> NestJS RBAC 授权模块 - 基于角色的访问控制

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-authz` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **简单易用** - 通过装饰器声明式定义角色权限
2. **灵活配置** - 支持自定义用户角色字段和全局守卫
3. **零侵入** - 与现有认证系统无缝集成

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-authz
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { AuthzModule } from '@svton/nestjs-authz';

@Module({
  imports: [
    AuthzModule.forRoot({
      userRoleField: 'role',      // 用户对象中角色字段名
      enableGlobalGuard: true,    // 全局启用角色守卫
      allowNoRoles: true,         // 未设置角色要求时是否放行
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
AuthzModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    userRoleField: config.get('AUTH_ROLE_FIELD', 'role'),
    enableGlobalGuard: true,
  }),
});
```

---

## 🔧 使用方法

### @Roles 装饰器

标记路由需要的角色：

```typescript
import { Controller, Get, Post, Delete } from '@nestjs/common';
import { Roles } from '@svton/nestjs-authz';

@Controller('users')
export class UsersController {
  // 需要 admin 角色
  @Roles('admin')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // 需要 admin 或 moderator 角色
  @Roles('admin', 'moderator')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

### @Public 装饰器

标记公开路由，跳过角色检查：

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

### 类级别装饰器

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Roles, Public } from '@svton/nestjs-authz';

@Controller('admin')
@Roles('admin')  // 整个控制器需要 admin 角色
export class AdminController {
  @Get('dashboard')
  dashboard() {}

  @Get('stats')
  stats() {}

  @Public()  // 覆盖类级别设置
  @Get('public-info')
  publicInfo() {}
}
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `userRoleField` | `string` | `'role'` | 用户对象中角色字段名，支持嵌套如 `'profile.role'` |
| `enableGlobalGuard` | `boolean` | `false` | 是否全局启用 RolesGuard |
| `allowNoRoles` | `boolean` | `true` | 未设置角色要求时是否放行 |

---

## 🔐 与 JWT 认证集成

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthzModule } from '@svton/nestjs-authz';

@Module({
  imports: [
    JwtModule.register({ secret: 'your-secret' }),
    AuthzModule.forRoot({
      userRoleField: 'role',
      enableGlobalGuard: true,
    }),
  ],
})
export class AuthModule {}
```

```typescript
// jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'your-secret',
    });
  }

  async validate(payload: { sub: number; role: string }) {
    // 返回的对象会被附加到 request.user
    return { id: payload.sub, role: payload.role };
  }
}
```

---

## 📋 多角色支持

用户可以拥有多个角色：

```typescript
// JWT payload 中的角色可以是数组
{
  "sub": 1,
  "roles": ["admin", "editor"]
}

// 配置
AuthzModule.forRoot({
  userRoleField: 'roles',  // 指向数组字段
});

// 使用 - 用户只需拥有其中一个角色即可
@Roles('admin', 'editor')
@Get('articles')
findAll() {}
```

---

## 🛡️ 手动使用 RolesGuard

如果不启用全局守卫，可以手动应用：

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)  // 先认证，再授权
export class AdminController {
  @Roles('admin')
  @Get()
  admin() {}
}
```

---

## ✅ 最佳实践

1. **认证在前，授权在后**
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   ```

2. **使用常量定义角色**
   ```typescript
   export const ROLES = {
     ADMIN: 'admin',
     USER: 'user',
     MODERATOR: 'moderator',
   } as const;

   @Roles(ROLES.ADMIN)
   ```

3. **公开路由显式标记**
   ```typescript
   @Public()
   @Get('health')
   ```

---

**相关文档**: [@svton/nestjs-http](./nestjs-http.md) | [后端模块开发](../backend/modules.md)
