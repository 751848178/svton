# @svton/authz

> RBAC Core - 角色、权限、作用域三层授权原语

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/authz` |
| **版本** | `0.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计目标

1. **框架无关** - 不依赖 NestJS、React 或数据库层
2. **作用域清晰** - 支持全局角色与 `team` / `project` 等 scoped grants
3. **组合授权** - 角色授权和直接权限授权可以混用
4. **冲突可判定** - `deny` 优先于 `allow`

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/authz
```

### 创建 Authorizer

```typescript
import { createAuthorizer } from '@svton/authz';

const authz = createAuthorizer({
  roles: {
    admin: {
      permissions: ['*'],
    },
    team_member: {
      permissions: [
        { resource: 'team', action: 'read', scopeTypes: ['team'] },
      ],
    },
    team_admin: {
      inherits: ['team_member'],
      permissions: [
        { resource: 'team', action: 'manage', scopeTypes: ['team'] },
        { resource: 'member', action: 'invite', scopeTypes: ['team'] },
      ],
    },
  },
});
```

### 权限检查

```typescript
const decision = authz.can({
  subject: {
    roles: [
      {
        role: 'team_admin',
        scope: { type: 'team', id: 'team_1' },
      },
    ],
  },
  permission: { resource: 'member', action: 'invite' },
  scope: { type: 'team', id: 'team_1' },
});

console.log(decision.allowed); // true
console.log(decision.reason); // 'allowed'
```

### 角色检查

```typescript
const decision = authz.hasRole({
  subject: {
    roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
  },
  roles: ['team_member'],
  scope: { type: 'team', id: 'team_1' },
});
```

---

## 🧱 核心概念

### AuthzScope

```typescript
interface AuthzScope {
  type: string;
  id?: string;
}
```

- `type` 用来描述作用域类型，例如 `team`、`project`
- `id` 用来描述某个具体实体，例如 `team_1`

### AuthzSubject

```typescript
interface AuthzSubject {
  roles?: AuthzRoleAssignment[];
  permissions?: AuthzPermissionGrant[];
}
```

用户、服务账号、机器人账号都可以抽象成 subject。

### Permission 输入格式

```typescript
type AuthzPermissionInput =
  | string
  | readonly [resource: string, action: string]
  | { permission: string; scopeTypes?: string[]; effect?: 'allow' | 'deny' }
  | { resource: string; action: string; scopeTypes?: string[]; effect?: 'allow' | 'deny' };
```

支持下面几种写法：

```typescript
'user:read'
['user', 'read']
{ permission: 'project:update', scopeTypes: ['project'] }
{ resource: 'member', action: 'invite', effect: 'deny' }
```

---

## ✅ 决策行为

- 字符串权限 `team` 会被视为 `team:*`
- `*` 或 `*:*` 表示全量资源和动作
- `scopeTypes` 为空时，权限不限制作用域类型
- 直接权限中的 `deny` 会覆盖匹配到的 `allow`
- scoped 角色不会自动扩散成全局角色

---

## 📤 导出内容

```typescript
import {
  createAuthorizer,
  normalizePermission,
  normalizePermissionGrants,
  normalizeRoleAssignments,
} from '@svton/authz';
```

同时导出 `AuthzSchema`、`AuthzSubject`、`AuthzDecision`、`AuthzRoleAssignment` 等完整类型。

---

## 与 NestJS 集成

需要 NestJS Guard、Decorator 和模块封装时，使用 [`@svton/nestjs-authz`](./nestjs-authz.md)。

`@svton/authz` 负责：

- 角色继承
- 权限归一化
- 作用域匹配
- allow / deny 决策

`@svton/nestjs-authz` 负责：

- 路由元数据装饰器
- HTTP 请求上下文提取
- Guard 执行与全局注册

---

## 相关文档

- [@svton/nestjs-authz](./nestjs-authz.md)
- [后端模块开发](../backend/modules.md)
