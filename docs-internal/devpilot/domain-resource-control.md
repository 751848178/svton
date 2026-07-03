# 域：资源管控

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

统一管理受管资源（Docker/云）、备份计划、资源申请、资源池与访问策略。

## 功能清单

- 资源申请（`resource-requests`，1957 行，全部源码文件 <200 行）
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
  → useResourceControl hook（resources/servers/environments/credentials/runs）
  → runAction contract（action definition/string key；默认 dry-run；live/confirmation/queue 仅转发既有 DTO 字段）
  → ResourceListPanel / ActionRunsPanel / ConnectionQueryPanel
  → resource-action-ui / scope utils

resource-requests 页
  → useResourceRequests hook（requests/resourceTypes/projects + 基础申请动作）
  → useProvisioningRunActions hook（run history / replay / provider reconcile / supervisor recovery / queue processing）
  → RequestTable / SupervisorPanel / ProvisioningRunsModal + ProvisioningRunRow
  → CreateRequestModal + CreateRequestFormFields / CompleteRequestModal + CompleteRequestFormFields
  → access-policies PolicyFormView + PolicyFormFields（project/environment scoped allow/deny）

admin/resource-types 页
  → useResourceTypes hook（resourceTypes 列表与新增/编辑/启停/删除动作）
  → ResourceTypeFormModal（formData + requestFields + deliveryFields）
  → SchemaFieldsEditor（集合增删改排序）+ SchemaFieldEditorRow（单字段属性编辑）
  → buildResourceSchema/buildPreviewSchema → POST/PUT /resource-types payload
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
| resource-control 页端到端拆分 | ✅ |
| resource-requests hook 拆分 | ✅ |
| resource-requests provisioning-runs modal 拆分 | ✅ |
| resource-requests create modal 拆分 | ✅ |
| resource-requests complete modal 拆分 | ✅ |
| access-policies 表单拆分 | ✅ |
| keys / admin resource-pools | ✅ |
| admin resource-types schema editor 拆分 | ✅ |
| admin resource-types form modal 拆分 | ✅ |
| resource-instances（122 行，轻量） | ⏳ 待迁移 |

## 遗留项

- resource-requests 页面、hooks、弹窗与字段组件均已拆到每个源码文件 <200 行；access-policies 表单字段组件也已拆到每个源码文件 <200 行；admin/resource-types 的 schema editor 已拆为集合 editor（99 行）和单字段 row component（169 行），form modal 已拆为 modal shell（62 行）、form hook（79 行）和 fields component（162 行）。
- admin/resource-types 目录当前源码文件均 <200 行，资源类型提交仍保持原 `POST/PUT /resource-types` payload contract。
