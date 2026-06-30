# 域：认证与团队

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

提供 devpilot 控制平面的身份认证、会话管理与团队（多租户）隔离能力。

## 功能清单

- 登录 / 注册（`(auth)/login`、`(auth)/register`）
- 会话恢复（hydrate）+ SSR 路由保护（middleware.ts）
- 团队 CRUD + 成员管理（`(dashboard)/teams`、`teams/[id]`）
- 团队切换器（`components/team-switcher`）

## 架构与数据流

```
login/register 页
  → auth.service.login/register(input)
  → apiAsync('POST:/auth/login')
  → commit(token, user) → writePersistedAuth (localStorage + cookie)
  → middleware SSR 路由保护读 cookie('token')

team 操作
  → team.service.fetchTeams/createTeam/...
  → apiAsync('GET:/teams', ...) + X-Team-Id 头
```

## 关键文件

- `store/services/auth.service.ts` — 认证状态机 + 持久化
- `store/services/team.service.ts` — 团队与成员 CRUD
- `lib/auth/token-storage.ts` — localStorage + cookie 同步
- `components/providers/auth-provider.tsx` — 挂载 ServiceProviders + hydrate
- `types/api-registry.ts` — AUTH_ROUTES / TEAM_ROUTES 类型增强

## 当前进度

| 项 | 状态 |
|---|---|
| auth.service（@svton/service） | ✅ |
| team.service（@svton/service） | ✅ |
| token 持久化 + cookie 同步 | ✅ |
| AUTH/TEAM 路由类型登记 | ✅ |
| login/register 页签名适配 | ✅ |
| teams / teams[id] 页端到端拆分 | ⏳ 待迁移（页 <200 行拆分） |
| team-switcher 组件化 | ⏳ 待迁移 |

## 遗留项

- teams/teams[id] 页仍是原 zustand 风格的大文件，需按 backups 范式拆分。
- 团队切换时的 SWR 缓存失效策略（mutate team 相关 key）待补。
