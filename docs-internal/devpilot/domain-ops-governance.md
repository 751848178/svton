# 域：运维治理

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

提供可观测性（监控/日志/审计）、执行治理（审批/策略）与应用部署治理。

## 功能清单

- 监控大盘（`monitoring`，2598 行）
- 日志中心（`logs`，2001 行，含 SSE 实时流）
- 审计事件（`audit-events`）
- 执行治理（`execution-governance`、`execution-policies`）
- 操作审批（`operation-approvals`）
- 应用管理（`applications`，847 行）
- 站点管理（`sites`，1910 行）
- Git 集成（`git`）

## 架构与数据流

```
audit-events 页（已迁移样板）
  → useAuditEvents hook（按 category/status/risk 筛选）
  → api.get('/audit-events', { params })
  → EventTable + StatusTag(risk/status) 渲染

git 页（已迁移样板）
  → useGit hook（连接/仓库管理）
  → ConnectGitModal（@svton/ui Modal）

logs 页
  → api.stream('/logs/streams/:id/events')（信封外，SSE）
  → 2001 行，需拆 stream-reader hook + 多面板组件
```

## 关键文件

- `(dashboard)/audit-events/` — ✅ 已迁移（types/constants/utils/hooks/components）
- `(dashboard)/git/` — ✅ 已迁移（含 Modal 封装）
- SSE 端点已在后端 excludePaths 排除信封（`/api/logs/streams/:id/events`）

## 当前进度

| 项 | 状态 |
|---|---|
| audit-events 页端到端拆分 | ✅ |
| git 页端到端拆分（Modal） | ✅ |
| logs（2001 行，SSE） | ⏳ 待拆分（高优先，保留 stream 直连） |
| monitoring（2598 行） | ⏳ 待拆分（高优先） |
| sites（1910 行） | ⏳ 待拆分 |
| execution-governance（1302 行） | ⏳ 待拆分 |
| applications（847 行） | ⏳ 待拆分 |
| operation-approvals / execution-policies | ⏳ 待迁移 |

## 遗留项

- logs 的 SSE 流必须保持 `api.stream()` 直连（不进信封），迁移时不得改用 apiAsync。
- monitoring/sites 均为超长文件，需按面板/模块拆 service。
