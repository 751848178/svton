# F385 发布链路完全可用性整改

## Goal

把现有真实发布编排能力从“主流程可运行”提升为“危险动作安全、审批职责隔离、失败可恢复、状态一致、内容可决策、界面可理解”的完整发布链路。

## Scope

- In scope: 发布计划历史、新建/预览、审批、执行、取消、重试、跳过、阶段证据、部署结果关联、失败恢复入口，以及这些页面的内容和交互。
- Out of scope: 非发布业务、真实云厂商签收、生产数据恢复演练、无关工作区改动。

## Clarifications And Assumptions

- Confirmed: 用户要求先产出方案并直接落地 2026-07-31 发布链路评审中的问题。
- Confirmed: 当前工作区包含其他未提交改动，必须保留；本切片只增量修改发布相关路径。
- Assumption: 回滚继续复用既有 Deployment/Application 能力，本切片负责把入口和上下文接回发布失败路径，不重写回滚执行器。
- Assumption: 机器诊断信息继续保留，但默认收进技术详情，不从系统中删除。

## Workflow Routing

`routing: todo-plan + codegraph + noisy-tools; 跨 API、审批、发布与部署多文件，需调用链核对、分层实现和隔离验证。`

## Functional TODO Breakdown

### F385.1 危险动作与审批安全

Purpose: 防止误重试、重复重试和申请人自批，确保每个高风险动作都有明确意图和服务端门禁。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
| --- | --- | --- | --- | --- |
| F385.1.1 | done | 为失败阶段重试增加后果说明与二次确认。 | 发布阶段动作与独立确认组件。 | `release-retry-dialog.component.tsx`，重试按钮改为先打开确认。 |
| F385.1.2 | done | 重试排队/运行时关闭重复入口，并在动作后刷新计划详情。 | 阶段动作推导、发布请求 hook。 | `deriveStageActions` 检查活动 attempt；请求成功沿用 `reload()`。 |
| F385.1.3 | done | 服务端禁止申请人审批自己的审批单。 | OperationApprovalService 与单测。 | `OperationApprovalService.review()` fail-closed；新增服务单测。 |
| F385.1.4 | done | 批准和拒绝都要求填写审批意见并二次确认。 | 审批卡与审批确认组件。 | DTO/服务端非空校验；审批卡统一意见弹窗。 |

### F385.2 发布状态与内容正确性

Purpose: 让状态、时间、环境和风险摘要与真实业务含义一致。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
| --- | --- | --- | --- | --- |
| F385.2.1 | done | 发布默认名称使用本地时间并明确环境。 | 发布向导字段模型。 | `buildReleaseDefaultName` + 浏览器默认值 `release-2026-07-31-1757`。 |
| F385.2.2 | done | 统一计划、尝试、审批和部署状态中文标签。 | 发布标签纯函数与展示组件。 | 历史、计划头、审批关联、部署详情均使用映射。 |
| F385.2.3 | done | 移除“生产 bootstrap”硬编码，按阶段语义展示。 | 发布阶段标签。 | 新计划持久化“初始化数据”；历史计划展示兼容转换。 |
| F385.2.4 | done | 展示真实副作用内容，不再笼统声称数据/结构变更。 | 发布预览与执行确认。 | 预览/确认逐项列出 `sideEffects`。 |
| F385.2.5 | done | 长时间运行、项目异常与服务活跃的差异给出明确解释。 | 发布结论与部署页面提示。 | 15 分钟停滞提示；部署页解释运行状态与部署结果差异。 |

### F385.3 决策信息与技术详情分层

Purpose: 主界面先回答“发布什么、影响什么、现在怎么办”，内部字段只在诊断时展开。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
| --- | --- | --- | --- | --- |
| F385.3.1 | done | planHash、执行器、内部 ID、输入 JSON 收进技术详情。 | 预览、阶段卡、尝试详情。 | 计划指纹、输入快照、输出和日志默认折叠。 |
| F385.3.2 | done | 审批卡补充发布、提交、目标、到期时间和输入指纹等可用上下文。 | 审批类型、元数据展示。 | 发布深链、指纹、有效期/陈旧警告、缺失 diff 警告。 |
| F385.3.3 | done | 终态隐藏无效执行按钮，推荐动作改为可点击入口。 | 计划结论头。 | 浏览器失败终态无“开始执行”，恢复入口可点击。 |
| F385.3.4 | done | 发布历史补充可访问名称、中文状态、时间和筛选。 | 发布历史工具栏。 | 搜索、状态筛选、明确 label、中文状态与本地时间。 |

### F385.4 失败恢复与结果闭环

Purpose: 从失败发布直接进入日志、审批、部署结果和回滚，而不是让用户跨页面寻找。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
| --- | --- | --- | --- | --- |
| F385.4.1 | done | 失败结论展示统一恢复动作：查看失败阶段、部署结果、审批和应用回滚。 | 发布恢复动作组件。 | `ReleaseNextActions`；浏览器确认四个失败恢复入口。 |
| F385.4.2 | done | 发布与 DeploymentRun 建立双向可见关联。 | 部署运行 DTO/列表展示。 | API include 发布计划回链，部署列表显示关联发布。 |
| F385.4.3 | done | 成功/失败摘要补充总耗时、目标和发布后验证证据。 | 发布计划摘要纯函数与 UI。 | `ReleaseOutcomeSummary` 汇总阶段、部署、健康检查、环境和耗时。 |

### F385.5 验证与文档闭环

Purpose: 用单测、类型检查和浏览器回归证明关键安全与交互路径。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
| --- | --- | --- | --- | --- |
| F385.5.1 | done | 增加审批隔离、重试门禁和展示纯函数测试。 | API/Web 聚焦测试。 | API 3 tests；Web 6 focused tests passed。 |
| F385.5.2 | done | 运行 API/Web 聚焦测试、类型检查和构建。 | 高噪声输出隔离到 `/tmp/codex-tool-runs/svton/`。 | API 35 + 30 tests；Web 29 tests；API/Web type-check、API/Web build 均通过。 |
| F385.5.3 | done | 浏览器回归新建、历史、失败恢复、审批和部署结果页面。 | 本地 Devpilot 运行时，只读或确认前停止。 | 隔离端口验证创建前门禁、重试确认、自批禁用、失败恢复、结果摘要与状态解释。 |
| F385.5.4 | done | 同步 TODO、进度索引与发布整改证据。 | 本文及 Devpilot 索引。 | TODO 索引与 Devpilot 进度索引已同步。 |

## Verification Plan

- API：OperationApprovalService 自批拒绝；发布重试并发/活动尝试门禁。
- Web：标签、时间、结论、动作推导和审批上下文纯函数测试。
- 静态：Devpilot API/Web type-check，受影响文件不超过 200 行。
- 构建：Devpilot Web production build。
- 浏览器：确认重试必须先弹窗；申请人审批不可用；终态不再显示执行按钮；失败页出现恢复入口；技术字段默认折叠。

## Change Log

- 2026-07-31 17:40: 建立 F385 方案；CodeGraph 已同步，确认入口覆盖 ReleasesTab、ReleaseStageActions、OperationApprovalService、ApprovalCard、DeploymentRunDetails。
- 2026-07-31 17:50: 完成 F385.1 安全门禁；开始状态与内容正确性整改。
- 2026-07-31 17:58: F385.2-F385.4 实现完成；隔离端口浏览器确认重试确认、申请人自批禁用、本地时间、终态恢复入口和部署状态解释。
- 2026-07-31 18:05: F385 验证闭环完成；Web 8 suites / 29 tests、API 重点回归 3 suites / 35 tests 与阶段构造 2 suites / 30 tests、双端类型检查和生产构建均通过；本次新增组件/工具与阶段工厂均不超过 200 行，既有 `deployment.service.ts` 仍为 2445 行遗留结构债，本切片只抽出统一关联查询常量。
