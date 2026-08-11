# Release Experience Zero-learning Redesign

## Goal

以已合入 `master` 的 F665-F673 代码与当前 Docker 运行态为唯一事实来源，重新验证项目创建、环境配置、前置检查、构建、预发、生产发布、环境版本与恢复链路；保留历史迁移样本并用任务自有的新项目验证干净路径，随后将已确认能力重构为接近零学习成本、逐步显露复杂度的发布体验。

## Scope

- In scope: 新旧项目数据策略；项目创建到 Production 的全链路 Browser/API/DB 验证；原始问题逐项回归；页面信息架构、交互、视觉、响应式与可访问性；真实截图驱动的三套设计方向与完整交互画板；选定方案的 Web/API 最小必要实现；Draft MR、独立 CR、架构复核、提交与推送。
- Out of scope: 外部公网 DNS/TLS 与未配置云 Provider 的真实生产签收；删除非本任务创建的数据；与本链路无关的全站视觉改版。

## Confirmed Constraints

- 基线：`master@3e5cc991`，F665-F673 已合入并已重建 Docker；本任务在 `codex/f674-release-ux-redesign` 独立 worktree 内进行。
- 旧项目在调研结论前不得删除；默认将其作为 legacy/migration 回归样本，只清理本任务创建且已经完成证据留存的可回收数据。
- 视觉设计必须基于当前运行态截图与现有 design tokens/components，不从文字猜测产品样式。
- 实现遵循 invest -> 单 writer impl -> Draft MR -> 独立 product/frontend/backend/test CR -> architect -> 修复 -> commit/push。

## Functional TODO Breakdown

| ID | Status | Atomic TODO | Evidence |
| --- | --- | --- | --- |
| F674 | in_progress | 逐项复核原始问题在 API/Web/Prisma/Provider 与当前 Docker 运行态的真实状态，并裁决旧项目保留、迁移或清理策略。 | 调用图、issue matrix、Browser/API/DB 证据 |
| F675 | pending | 完整走查新项目从创建到生产/恢复的链路，建立业务逻辑图、组织架构图、功能地图、数据流图、页面结构图与页面/状态覆盖矩阵。 | 架构文档、逐页截图、响应式/a11y 审计 |
| F676 | pending | 基于真实截图产出三套视觉/交互方向，通过对抗性设计复核选择一套并完成可交互画板。 | `visualize` 画板与选择记录 |
| F677 | completed | 由唯一 impl writer 按选定方案实施，保持单一职责、依赖无环、源文件不超过 200 行。 | S1-S6 原子 diff；`/tmp/codex-tool-runs/svton/f674-impl-*` focused tests/type-check |
| F678 | pending | 创建 Draft MR，完成 product/frontend/backend/test 独立 CR 与架构师裁决，修复后执行全量、Docker、Browser、API/DB 验证并 commit/push。 | MR、CR ledger、日志、最终截图 |

## Acceptance Rules

- 原始问题每项只能标为 `verified_fixed`、`partially_fixed`、`not_fixed` 或 `not_applicable`，且必须给出当前源码与运行证据。
- 新旧项目必须分别覆盖 legacy compatibility 与 clean creation；不以删除旧数据掩盖迁移问题。
- UI 必须默认回答“当前在哪一步、为何阻断、下一步做什么、执行后发生什么”，高级证据按需展开。
- 桌面与 390px 主链均无信息溢出、不可见操作、仅颜色表达状态或小于 44px 的主交互目标。

## Change Log

- 2026-08-11: 创建 F674-F678；完成 master/Docker 基线确认并开始三路只读 invest 与当前运行态截图审计。
- 2026-08-11: F677 实施完成：服务端 checkpoint/两阶段 Build/Production post+promote、双基线组件身份、统一变量与路由要求、readiness v2，以及方向 A 的 blocker-first/渐进披露 UI；外部 Provider 缺口继续 fail-closed，转入 F678 独立 CR 与运行态验收。
