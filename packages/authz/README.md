# @svton/authz

轻量级 RBAC Core，支持：

- 角色继承
- 作用域授权（如 `team` / `project`）
- 通配权限（如 `team:*` 或 `*`）
- 直接权限与角色权限混用
- `allow` / `deny` 两种效果，且 `deny` 优先

## 安装

```bash
pnpm add @svton/authz
```

## 快速开始

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
```

## 角色检查

```typescript
authz.hasRole({
  subject: {
    roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
  },
  roles: ['team_member'],
  scope: { type: 'team', id: 'team_1' },
});
```

## 设计说明

- 角色继承使用 `inherits`
- 权限既支持字符串形式（如 `user:read`），也支持 `{ resource, action }`
- 作用域通过 `{ type, id }` 表示
- 作用域角色不会自动扩散为全局权限
