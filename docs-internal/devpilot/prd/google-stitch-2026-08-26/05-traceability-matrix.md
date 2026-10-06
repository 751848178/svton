# Devpilot PRD 能力追踪矩阵

## 1. 标记说明

| 标记 | 含义 | 设计处理 |
| --- | --- | --- |
| `LIVE` | 当前前端已有真实入口并连接现有数据流 | 必须覆盖当前能力及关键状态 |
| `API` | 后端 API/领域能力存在，前端入口可能不完整 | 可以设计目标 UI，但实现前需复核权限和契约 |
| `DESIGN` | 已有获批 V2 屏幕或主视觉参考 | Stitch 必须延续，不重新发明视觉语言 |
| `BACKEND` | 后端已有能力，但当前页面不应假装已经可操作 | 只在有明确交互契约的目标 Frame 中出现 |
| `LEGACY` | 兼容路径，不是新信息架构的主入口 | 保留回归与迁移说明 |
| `DEFER` | 缺少真实 Provider/状态闭环 | 不生成可执行控件 |

## 2. 后台 Shell 与导航

| 能力 | 当前来源 | API / 状态来源 | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 顶栏、团队、语言、用户菜单 | `apps/devpilot-web/src/components/layout/header.tsx`、`apps/devpilot-web/src/components/layout/team-switcher.tsx` | 会话与团队上下文 | SHELL-03/05/06 | `LIVE` |
| 分组导航与权限 | `apps/devpilot-web/src/components/layout/navigation-items.ts`、`apps/devpilot-web/src/components/layout/sidebar/sidebar.tsx` | 角色与 admin 判定 | SHELL-05/06 | `LIVE` |
| 路由面包屑与对象名 | `apps/devpilot-web/src/components/layout/breadcrumbs.tsx` | project/release 查询 | 所有项目页 | `LIVE` |
| 工作台摘要 | `apps/devpilot-web/src/app/(dashboard)/dashboard/page.tsx` | 现有 dashboard 查询 | SHELL-03/04 | `LIVE` |
| 全局搜索框 | Sidebar 当前交互 | 当前以导航筛选为主 | SHELL-05/06 | `LIVE` |
| 统一跨实体命令中心 | 无完整跨实体执行闭环 | 待统一搜索/动作 API | 不作为本轮主能力 | `DEFER` |

完整后台路由分组以 [`01-platform-shell-prd.md`](./01-platform-shell-prd.md) 第 5 节为准；本矩阵重点追踪项目工作流。

## 3. 项目目录与接入

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 项目目录、搜索、状态、环境列 | `apps/devpilot-web/src/app/(dashboard)/projects/components/project-directory-panel.tsx` 及同目录模型 | `GET /projects` | PROJ-01/02/03 | `LIVE` `DESIGN V2-01` |
| 创建项目基础信息 | `apps/devpilot-web/src/app/(dashboard)/projects/create/page.tsx` | `POST /projects` | PROJ-04 | `LIVE` |
| 公共/私有仓库与凭据策略 | project intake 表单与 credential 组件 | project intake / git credentials | PROJ-04/05 | `LIVE` |
| 启动、轮询、取消仓库分析 | repository analysis hooks/components | `/projects/:id/repository-analysis/*` | PROJ-06/07 | `LIVE` |
| 确认或拒绝分析结果 | project intake 分析确认步骤 | project intake analysis accept/reject | PROJ-08 | `LIVE` |
| 测试/生产基线和组件确认 | project intake 最终步骤 | project intake finalize | PROJ-09 | `LIVE` |

## 4. 项目工作台

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 项目总览与下一动作 | project detail overview/route host | project、environment、release 聚合查询 | WORK-01/02 | `LIVE` `DESIGN V2-04` |
| 项目信息 | `/projects/:id` 当前项目信息视图 | `GET /projects/:id` | INFO-01 | `LIVE` |
| 仓库分析详情与重新分析 | repository analysis components | `/projects/:id/repository-analysis/*` | INFO-02 | `LIVE` |
| 五个用户任务入口 | project route host、repo workbench contract | 对应 release/config/site/deployment API | 项目内导航 | `DESIGN` |
| 旧 `?view=` 深链重定向 | project route host | release/deployment 定位 | COMPAT-01 | `LEGACY` |

五个任务入口为：项目信息、发布、项目配置、域名与入口、部署记录。实现可继续使用嵌套路由或抽屉，但 Stitch 中必须让用户可直接识别这五类任务。

## 5. 发布单与 Gate

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 发布单列表、筛选、详情 | project releases 页面与 release components | `GET /projects/:id/delivery/releases` | REL-01 | `LIVE` `DESIGN V2-05` |
| 创建发布单 | release create dialog/form | `POST /projects/:id/delivery/releases` | REL-02 | `LIVE` |
| 发布前检查与刷新 | release preflight/gates components | release detail / preflight refresh | REL-03/04 | `LIVE` `DESIGN V2-03` |
| Gate 状态与阶段 | release gate 类型/映射 | release gates endpoint | REL-05 | `LIVE` |
| 撤回发布单 | release detail action | release withdraw endpoint | REL-18 | `LIVE` |
| 兼容状态映射 | release model/status helpers | draft/active/succeeded/failed/canceled | REL-01 至 REL-18 | `LIVE` |

必须保留的领域状态：

- UI 生命周期：`draft`、`building`、`staging`、`awaiting_approval`、`production`、`succeeded`、`failed`、`withdrawn`。
- Gate：`checked`、`unchecked`、`blocked`、`warning`、`manual`、`unavailable`。
- 持久化 Gate：`pending`、`passed`、`warning`、`failed`、`unavailable`、`needs_human`。
- Gate 阶段：`commit`、`build`、`deploy`、`promote`。

## 6. 构建、部署、审批与证据

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 多轮构建、日志、取消、重试 | release build components/drawers | release build endpoints | REL-06/07/08 | `LIVE` |
| Manifest 与构建证据 | release detail/evidence components | build/evidence endpoints | REL-08/17 | `LIVE` |
| 测试环境部署 | staging deployment components | release staging endpoint | REL-09/10/11 | `LIVE` `DESIGN V2-06` |
| 生产复核与输入哈希 | production preview/review components | production preview endpoint | REL-12 | `LIVE` `DESIGN V2-07` |
| 操作审批 | approval components、治理模块 | operation approvals list/review | REL-13 | `LIVE` `DESIGN V2-08` |
| 生产部署 | production deployment components | release production endpoint | REL-14/15/16 | `LIVE` |
| 发布证据聚合 | release evidence drawer | release evidence endpoint | REL-17 | `LIVE` `DESIGN V2-10` |
| 部署运行列表与详情 | deployment drawers/list components | deployment runs list/detail | DEP-01/02/03 | `LIVE` |
| 部署重试、回滚、Smoke Test | deployment run actions | deployment retry/rollback/smoke | DEP-03/04/05 | `LIVE`/`API` |
| 环境版本写入 | environment version UI/model | environment versions endpoints | REL-15、CFG-01/02 | `LIVE` |
| 恢复创建新运行/版本 | recovery workflow | environment recovery endpoints | REL-16、CFG-05、DEP-04 | `LIVE`/`API` |

关键不变量：生产必须使用已通过测试部署的同一 Manifest；审批必须绑定生产复核的 `inputHash`；恢复通过新增 DeploymentRun 和 EnvironmentVersion 留痕，不改写历史记录。

## 7. 项目配置

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 环境选择与六页签 | project settings 页面与环境配置组件 | project environments | CFG-01 至 CFG-13 | `LIVE` |
| 环境版本列表与详情 | environment version components | environment versions | CFG-01/02 | `LIVE` `DESIGN V2-02` |
| 版本切换、升级与恢复预览 | version actions/models | switch/upgrade/recovery endpoints | CFG-03/04/05 | `API` |
| 部署目标列表与编辑 | environment target components | target CRUD / readiness | CFG-06/07 | `LIVE` |
| 目标就绪问题 | target readiness mapping | target validation | CFG-06/07 | `LIVE` |
| 资源配置 | environment resource components | environment config revisions | CFG-08 | `LIVE` |
| 变量与密钥 | environment variable/secret components | environment config revisions | CFG-09 | `LIVE` |
| 访问控制 | project/environment access components | access policy endpoints | CFG-10 | `LIVE` |
| 验证规则 | verification components | environment config revisions | CFG-11 | `LIVE` |
| 不可变修订历史 | config revision model | environment config revisions | CFG-12 | `API` |
| 复制、同步、归档 | environment actions | copy/sync/archive endpoints | CFG-13 | `API` |

部署目标就绪状态必须逐字映射真实问题：`ready`、`missing`、`duplicated`、`provider_mismatch`、`ssh_root_invalid`、`ssh_connection_invalid`。

## 8. 域名与入口

| 能力 | 前端/领域来源 | API | 目标 Frame | 标记 |
| --- | --- | --- | --- | --- |
| 项目范围站点/域名列表 | project domains 页面与 site components | sites CRUD | DOM-01/02 | `LIVE` |
| 新增、编辑、删除域名 | site form/actions | sites CRUD | DOM-03 | `LIVE` |
| 生产域名发布 Gate | release/site readiness | sites + release gates | DOM-02、REL-04 | `LIVE` |
| 站点配置预览 | site config preview modal | site plan/config endpoint | DOM-04 | `LIVE` |
| 诊断、探测与同步回滚 | site diagnostics/actions | diagnostics/probes/sync rollback | DOM-05 | `API` |

## 9. 权限、安全与审计

| 规则 | 当前来源 | 设计要求 |
| --- | --- | --- |
| 团队上下文隔离 | Header/TeamSwitcher 与后端 team scope | 切换团队后刷新对象范围；禁止跨团队 ID 泄漏 |
| 管理入口权限 | navigation admin predicate | 非管理员不显示资源池/资源类型入口；直接访问给出无权限页 |
| 审批人与执行人分工 | operation approvals / release policy | 无权限角色看到只读状态，不显示伪可用主按钮 |
| 密钥保护 | credentials / secrets 表单 | 默认遮罩，不在表格、日志、证据中回显明文 |
| 破坏性动作确认 | delete/withdraw/cancel/rollback actions | 明确对象、范围、后果；恢复不描述为改写历史 |
| 审计关联 | audit events / evidence | 发布单、Manifest、运行、审批和配置修订 ID 可追踪 |

## 10. 兼容与延期矩阵

| 能力 | 当前事实 | 本轮结论 | Stitch 处理 |
| --- | --- | --- | --- |
| 旧 `/projects/:id/publish` 向导 | 仍有兼容路由和 release detail 子路径 | 保留兼容，不作为目标主入口 | 只出 COMPAT-01 迁移说明 |
| 旧 `?view=releases/deployments` | route host 会重定向到新路由/抽屉 | 保留深链兼容 | 不复刻旧 Tab IA |
| 灰度/蓝绿流量切换 | 无真实流量 Provider 闭环 | 延期 | 不画可执行控件 |
| candidate/stable 编排 | 无完整运行态/持久化闭环 | 延期 | 不伪造版本泳道 |
| 指标驱动暂停/终止 | 无真实监控策略执行闭环 | 延期 | 不画自动策略开关 |
| 自动回滚 Provider | 当前以显式恢复运行保证审计 | 延期自动化，保留人工恢复 | 使用“创建恢复运行” |
| 变更窗口/冻结 Provider | 缺少真实数据源 | 延期 | 不显示为通过/失败 Gate |
| 旧运行的完整历史证据 | 部分历史对象可能缺新证据字段 | 明确数据限制 | 显示 unavailable，不编造数据 |

## 11. 实现交接检查

Stitch 设计进入开发前，逐项确认：

1. 每个可点击动作都能映射到本矩阵中的现有路由/API，或被明确记录为待实现的 `API/BACKEND` 工作。
2. 每个状态都来自真实枚举或文档中的显式目标态，没有视觉稿自创状态。
3. 项目、环境、发布单、Manifest、运行、审批与配置修订的 ID 关系在原型数据中一致。
4. `DEFER` 项没有被设计成已可用；旧路径没有重新成为主信息架构。
5. 视觉与组件验收回到 [`DESIGN.md`](./DESIGN.md) 和获批 V2 参考；功能验收回到 [`02-project-module-prd.md`](./02-project-module-prd.md)。
