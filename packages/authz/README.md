# @svton/authz

轻量级、框架无关的 RBAC 核心，支持：

- 角色继承（含循环检测）
- 作用域授权（如 `team` / `project`）
- 通配权限（如 `team:*` 或 `*`）
- 直接权限与角色权限混用
- `allow` / `deny` 两种效果，且 `deny` 优先
- 缓存的角色展开与权限计算

## 适用场景与能力边界

**适合：**

- 中后台、SaaS、协作工具的标准 RBAC（admin / member / viewer 这类固定角色）
- 多团队/多项目/多租户场景下的作用域授权（`team_1` 的 admin ≠ `team_2` 的 admin）
- 用户的角色和权限来自数据库，每个请求实时查库（由上层框架处理，如 `@svton/nestjs-authz` 的 `getAssignments()`）
- 需要细粒度的 `allow` / `deny` 组合（`deny` 优先，适合合规场景）
- 需要 `AuthzDecision` 决策对象用于审计日志

**不适合（需要 Casbin / OPA / 自研策略引擎）：**

- ABAC（基于用户/资源属性的规则表达式，如"只能编辑自己创建的且 status=draft 的文章"）
- 资源所有权检查（需要查资源本身的字段，如 `owner_id === user.id`）—— 这部分应在业务层处理，把结果转成 `AuthzPermissionGrant` 再传进来
- 运行时由运营人员动态定义新角色 schema —— 角色定义应作为业务建模的一部分，跟随代码版本化、review、灰度发布；后台热改角色定义会引入难以回滚的风险
- 多策略组合算法（如"必须同时持有 role A 和 role B 才放行"）

**关于"动态权限"：**

很多人把"动态权限"等同于"schema 热更新"，但绝大多数企业项目的真实需求其实是 **"用户的角色/权限来自 DB，变更后下次请求生效"** —— 这种场景已原生支持，由上层框架（如 NestJS 的 `getAssignments()`）每次请求重新查库即可。Schema（角色定义）本身应视为代码资产，通过部署变更。

## 安装

```bash
pnpm add @svton/authz
# 或
npm install @svton/authz
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

## API

### `createAuthorizer(schema)`

创建一个授权器实例。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| schema | `AuthzSchema` | `{}` | 角色与权限模型 |

返回：`AuthzAuthorizer`

### `authz.can(input)`

检查主体是否具有某个权限。同时考虑直接权限 (`subject.permissions`) 和角色权限 (`subject.roles`)。`deny` 优先于 `allow`。

```typescript
const decision = authz.can({
  subject: {
    roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
    permissions: [{ permission: 'billing:read' }], // 直接授予，不依赖角色
  },
  permission: { resource: 'member', action: 'invite' },
  scope: { type: 'team', id: 'team_1' },
});
```

### `authz.hasRole(input)`

检查主体是否持有指定角色（考虑继承）。命中任一即通过。

```typescript
authz.hasRole({
  subject: {
    roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
  },
  roles: ['team_member'],
  scope: { type: 'team', id: 'team_1' },
});
// team_admin 继承了 team_member → allowed: true
```

### `authz.expandRoles(role)`

返回一个角色及其所有（递归）继承的角色列表。结果会缓存，循环引用会被自动切断。

```typescript
authz.expandRoles('team_admin');
// ['team_admin', 'team_member']
```

适用场景：
- 审计日志：记录"该用户实际生效的角色集合"
- UI 渲染：在管理后台展示某角色隐含的全部角色
- 测试断言：验证角色继承图符合预期

### `authz.getRolePermissions(role)`

返回某角色及其继承链上的全部权限（已规范化）。结果会缓存。

```typescript
authz.getRolePermissions('team_admin');
// [
//   { key: 'team:read',   resource: 'team',   action: 'read',   scopeTypes: ['team'], effect: 'allow' },
//   { key: 'team:manage', resource: 'team',   action: 'manage', scopeTypes: ['team'], effect: 'allow' },
//   { key: 'member:invite', resource: 'member', action: 'invite', scopeTypes: ['team'], effect: 'allow' },
// ]
```

适用场景：
- 管理后台展示"某角色具体能做什么"
- 与数据库中的角色权限做对账
- 在前端预渲染权限决策树

## AuthzDecision 字段表

`authz.can()` 和 `authz.hasRole()` 都返回一个 `AuthzDecision` 对象，可用于审计日志和调试：

| 字段 | 类型 | 说明 |
|------|------|------|
| `allowed` | `boolean` | 最终决策：是否放行 |
| `reason` | `'allowed' \| 'denied' \| 'missing_permission' \| 'missing_role'` | 决策原因 |
| `scope` | `AuthzScope \| undefined` | 命中的作用域（如 `{ type: 'team', id: 'team_1' }`） |
| `matchedRole` | `string \| undefined` | 命中的角色（通过角色权限或角色检查通过时） |
| `matchedPermission` | `AuthzNormalizedPermission \| undefined` | 命中的具体权限规则 |

`reason` 枚举的含义：

| reason | 触发条件 |
|--------|----------|
| `allowed` | 显式 allow 命中 |
| `denied` | 显式 deny 命中（优先级最高） |
| `missing_permission` | `can()` 没有任何 allow/deny 命中 |
| `missing_role` | `hasRole()` 没有任何角色匹配 |

## 使用场景决策树

```
你要做什么？
│
├─ 只关心"用户是不是某角色"
│   → 用 hasRole()
│   例：只有 admin 才能访问 /settings
│
├─ 关心"用户能否做某操作"（更细粒度）
│   → 用 can()
│   例：能否 invite member 到 team_1
│
├─ 权限来自数据库而非静态 schema？
│   → 在 can() 的 subject.permissions 里传入动态授予的权限
│   → 或在 NestJS 层用 getAssignments()（见 @svton/nestjs-authz）
│
├─ 想知道"这个角色有哪些权限"（用于 UI / 审计）
│   → 用 getRolePermissions()
│
├─ 想知道"这个角色隐含了哪些角色"（用于展示继承关系）
│   → 用 expandRoles()
│
└─ 想知道"为什么允许/拒绝了"
    → 看 AuthzDecision 的 reason / matchedRole / matchedPermission
```

## 完整 TS 类型参考

```typescript
// 效果：allow 放行，deny 拒绝（优先级最高）
type AuthzEffect = 'allow' | 'deny';

// 作用域：用于团队/项目级授权
interface AuthzScope {
  type: string;
  id?: string;
}

// 权限的多种输入形式（任选其一）
type AuthzPermissionInput =
  | string                                  // 'user:read' 或 '*'
  | readonly [resource: string, action: string]  // ['user', 'read']
  | AuthzNamedPermissionInput               // { permission, scopeTypes?, effect? }
  | AuthzPermissionDescriptor;              // { resource, action, scopeTypes?, effect? }

interface AuthzNamedPermissionInput {
  permission: string;
  scopeTypes?: string[];
  effect?: AuthzEffect;
}

interface AuthzPermissionDescriptor {
  resource: string;
  action: string;
  scopeTypes?: string[];
  effect?: AuthzEffect;
}

// 规范化后的权限（内部使用）
interface AuthzNormalizedPermission {
  key: string;        // `${resource}:${action}`
  resource: string;
  action: string;
  scopeTypes: string[];
  effect: AuthzEffect;
}

// 角色定义（在 schema 里）
interface AuthzRoleDefinition {
  inherits?: string[];              // 继承的其他角色
  permissions?: AuthzPermissionInput[];
}

interface AuthzSchema {
  roles?: Record<string, AuthzRoleDefinition>;
}

// 主体上的角色赋值（可带 scope）
interface AuthzRoleAssignment {
  role: string;
  scope?: AuthzScope;
}

// 主体上的直接权限授予（可带 scope）
interface AuthzPermissionGrant {
  permission: AuthzPermissionInput;
  scope?: AuthzScope;
}

type AuthzPermissionGrantInput = AuthzPermissionInput | AuthzPermissionGrant;

// 被授权的主体
interface AuthzSubject {
  roles?: AuthzRoleAssignment[];
  permissions?: AuthzPermissionGrant[];
}

// 决策结果
type AuthzDecisionReason = 'allowed' | 'denied' | 'missing_permission' | 'missing_role';

interface AuthzDecision {
  allowed: boolean;
  reason: AuthzDecisionReason;
  scope?: AuthzScope;
  matchedRole?: string;
  matchedPermission?: AuthzNormalizedPermission;
}

// 输入参数
interface AuthzRoleCheckInput {
  subject: AuthzSubject;
  roles: string[];
  scope?: AuthzScope;
}

interface AuthzPermissionCheckInput {
  subject: AuthzSubject;
  permission: AuthzPermissionInput;
  scope?: AuthzScope;
}

// 授权器接口
interface AuthzAuthorizer {
  can(input: AuthzPermissionCheckInput): AuthzDecision;
  hasRole(input: AuthzRoleCheckInput): AuthzDecision;
  expandRoles(role: string): string[];
  getRolePermissions(role: string): AuthzNormalizedPermission[];
}
```

## 设计说明

- 角色继承使用 `inherits`，循环引用会被自动检测并切断
- 权限既支持字符串形式（如 `user:read`），也支持 `{ resource, action }` 对象形式
- 作用域通过 `{ type, id }` 表示，支持 `*` 通配
- 作用域角色不会自动扩散为全局权限
- `deny` 优先于 `allow`：只要任一决策为 deny，整体即 deny
- `expandRoles()` / `getRolePermissions()` 的结果会被缓存以提升性能

## License

MIT
