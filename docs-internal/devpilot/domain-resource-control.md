# 域：资源管控

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

统一管理受管资源（Docker/云）、备份计划、资源申请、资源池与访问策略。

## 功能清单

- 资源申请（`resource-requests`，1431 行）
- 资源控制台（`resource-control`，3520 行，含 inventory/metrics）
- 备份计划与运行（`backups`）
- 访问策略 / 密钥 / 资源池（`access-policies`、`keys`、`admin/resource-pools`）
- 资源类型管理（`admin/resource-types`）

## 架构与数据流

```
backups 页（已迁移样板）
  → useBackups hook（usePersistFn 稳定引用）
  → api.get('/backups/plans' | '/backups/runs' | '/resource-control/resources')
  → StatusTag 渲染状态 / EmptyState/LoadingState/ErrorBanner

resource-control 页
  → 多类 inventory（docker/cloud）+ metrics（docker-stats）
  → 3520 行，需拆分为 inventory/metrics/action 多组件
```

## 关键文件

- `(dashboard)/backups/` — ✅ 已迁移（types/constants/utils/hooks/components）
- `components/ui/status-tag.tsx` — 状态→色调映射（替代各页 statusClasses）
- `components/ui/metric-card.tsx` — 统计卡片（跨页复用）

## 当前进度

| 项 | 状态 |
|---|---|
| backups 页端到端拆分 | ✅ |
| StatusTag / MetricCard 领域封装 | ✅ |
| resource-requests（1431 行） | ⏳ 待拆分 |
| resource-control（3520 行） | ⏳ 待拆分（高优先） |
| access-policies / keys / admin | ⏳ 待迁移 |
| resource-instances（122 行，轻量） | ⏳ 待迁移 |

## 遗留项

- resource-control 3520 行含 inventory/metrics/action 多职责，需按职责拆 service。
- resource-requests 已有后端单测覆盖，前端拆分时保持契约不变。
