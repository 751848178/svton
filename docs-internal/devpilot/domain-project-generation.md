# 域：项目生成

> 功能域目标与进度文档。基于实际代码梳理。

## 域目标

提供项目脚手架生成能力：多步向导配置、配置预设管理、项目导入与生成产物下载。

## 功能清单

- 项目列表 / 新建 / 导入（`projects`、`projects/new`、`projects/import`）
- 项目向导（`components/project-wizard/*`：基本信息/子项目/资源/预览等步骤）
- 配置预设（`presets`：保存/加载/导入/导出）
- 生成产物下载（`projects/[id]` 的 `api.download`）

## 架构与数据流

```
向导页
  → project-config.service（多步状态机，localStorage 持久化）
  → 完成时 apiAsync('POST:/generator/generate')

presets 页
  → usePresets hook → api.get/post/delete('/presets')

projects/[id] 下载
  → api.download('/generator/:id/download')（信封外，二进制）
```

## 关键文件

- `store/services/project-config.service.ts` — 向导配置状态机
- `store/services/project-config.types.ts` — 配置类型 + 默认值
- `(dashboard)/presets/` — 已迁移（hook + 组件拆分）

## 当前进度

| 项 | 状态 |
|---|---|
| project-config.service（@svton/service） | ✅ |
| presets 页端到端拆分 | ✅ |
| projects / projects/new 页 | ⏳ 待迁移（<200 行，轻量） |
| project-wizard 组件（已有部分 @svton/ui） | ⏳ 待统一 hooks 优化 |
| projects/[id]（4804 行，最大文件） | ⏳ 待拆分（高优先） |
| projects/import（447 行） | ⏳ 待拆分 |

## 遗留项

- `projects/[id]` 4804 行是全仓最大文件，需重点拆分为多组件 + hooks + service。
- 生成产物下载端点已在后端 excludePaths 排除信封。
