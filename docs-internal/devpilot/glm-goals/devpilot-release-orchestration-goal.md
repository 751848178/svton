# GLM Goal：完成 Devpilot 项目级发布编排（F383）

以下内容可原样复制到一个全新的 GLM 对话中：

```text
/goal

你现在负责一个完整的长任务：在 Devpilot 中实现“数据任务与应用部署执行分离、
但通过项目级发布 DAG 统一编排”的生产可用能力。不要只给方案，不要在脚手架或
半成品处停止；持续实现、验证、修复、回归并更新任务台账，直到本提示词的完成定义
全部满足，或遇到无法通过源码、文档、本地运行和安全替代环境解决的真实外部阻塞。

工作目录：
/Users/zhaoxingbo/Workspace/ai-driven/svton

仓库与协作规则：
1. 当前分支应为 master。F383 设计前的代码基线为 c5c320aa；启动时以当前
   master HEAD 为准，先确认它包含本提示词和 F383 架构/TODO 文档。
2. 这是 Devpilot 单仓任务。不要修改
   /Users/zhaoxingbo/Workspace/ai-driven/picshare；Picshare 只作为参考发布图。
3. 你是此 checkout 的唯一写者。不要创建递归 goal、不要把剩余工作再交给
   新的长任务。你可以在内部用只读调研/验证 worker，但任何时候只能有一个代码写者。
4. 先检查 git status。保留启动时已有的用户改动；若出现与本任务重叠的未知改动，
   先用源码和 git 事实判断，不能覆盖或丢弃。
5. 所有非平凡代码遵守仓库 AGENTS.md 和结构规范：单文件原则上不超过 200 行，
   controller/service/repository/dto/types/utils/component/hooks 分责，禁止继续膨胀
   DeploymentService，禁止机械切碎和循环依赖。
6. 使用 CodeGraph CLI 先画清调用关系和影响面；大搜索、test、type-check、
   lint、build、Docker 日志放到 /tmp/codex-tool-runs/svton/，主上下文只保留摘要。
7. 不要询问可以从源码、Prisma、Git、运行状态或临时环境确认的问题。正常技术选择
   自主完成。不得对真实生产数据库、云资源、域名或用户执行破坏性动作。
8. 每完成一个可验证切片就更新 F383 TODO 状态和证据。实现结束后提交所有本任务
   改动，提交信息清晰；不要 push，除非用户另行要求。

开始前必须完整阅读：
- AGENTS.md
- docs-internal/todos/INDEX.md
- docs-internal/todos/2026-07-27-release-orchestration.md
- docs-internal/devpilot/release-orchestration-architecture.md
- docs-internal/devpilot/requirements-and-progress.md 中 F381/F382 段落
- apps/devpilot-api/prisma/schema.prisma 中 ApplicationService、
  ApplicationServiceInitialization、DeploymentRun、ServerExecutionJob、
  OperationApproval 相关模型
- apps/devpilot-api/src/deployment/deployment.module.ts
- apps/devpilot-api/src/deployment/deployment.controller.ts
- apps/devpilot-api/src/deployment/deployment.service.ts
- apps/devpilot-api/src/deployment/deployment-command-builders.utils.ts
- apps/devpilot-api/src/deployment/deployment-initialization-checkpoint.service.ts
- apps/devpilot-api/src/server-executor/server-executor.service.ts 及 queue/lease/恢复链路
- apps/devpilot-api/src/operation-approval/operation-approval.service.ts
- apps/devpilot-web/src/app/(dashboard)/applications 下部署配置与 deploy wizard
- apps/devpilot-web/src/app/(dashboard)/projects/[id] 下 deployment panel、types 和 hooks

产品目标：
A. schema migration、生产 bootstrap、数据 backfill、应用部署和健康检查是不同
   执行单元，各自有权限、审批、幂等、重试、日志、输出和失败边界。
B. 一次项目发布用持久化 DAG 编排这些单元。依赖不满足时后继阶段绝不运行。
C. 新手页面始终给出当前结论、一个推荐下一步动作、阻塞原因和完整证据。
D. 命令阶段复用 ServerExecutorService；应用部署复用 DeploymentRun；审批和审计
   复用现有模块。禁止重造 SSH/Agent/queue。
E. 现有 POST /deployments/projects/:projectId/runs 及 F382 串行行为保持兼容；
   新发布能力由 DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false 默认关闭。

必须按以下切片持续推进：

切片 1：事实图和实施计划
- 用 CodeGraph 和源码确认 controller/service/repository/module/UI/API 影响面。
- 将结论与任何必要调整写回
  docs-internal/todos/2026-07-27-release-orchestration.md。
- 不重新发明架构；权威目标是 release-orchestration-architecture.md。

切片 2：持久化模型与迁移
- 增加 ReleasePlan、ReleaseStage、ReleaseStageDependency、
  ReleaseStageAttempt、ReleaseEvent（名称只有在发现明确仓库冲突时才可等价调整）。
- 落实架构文档中的字段、状态、唯一键、索引、租约和关联关系。
- Prisma schema、迁移、repository 和响应类型分责。
- 迁移必须在一次性 MySQL 上验证；不得操作真实生产数据。

切片 3：纯 DAG、依赖和状态机
- 实现纯函数 key/edge 校验、拓扑排序、环检测、依赖条件解释、ready/blocked
  推导和合法状态转换。
- output_match 只能解释白名单比较，禁止 eval 或任意脚本表达式。
- 覆盖分支、汇合、缺失引用、重复 key、自依赖、环、optional skip 和非法跳转测试。

切片 4：计划构建与预览
- 从真实项目、环境、应用服务、资源绑定和 F382 配置生成不可变计划快照。
- 明确生成 precheck、schema_migration、bootstrap、data_backfill、
  application_deploy、health_check、manual_gate 节点的条件；未配置不猜测。
- 计算稳定 planHash/configHash/idempotencyKey/concurrencyKey。
- dry-run 只解析、校验、显示副作用/风险/审批，不创建远程任务、不消费审批。

切片 5：协调器、租约和恢复
- 建立独立 release-orchestration 模块；不要把逻辑塞进 DeploymentService。
- 原子认领 ready 阶段，一个阶段只能有一个 active attempt。
- 支持 leaseOwner、leaseExpiresAt、heartbeatAt、过期恢复和可重复推进。
- 恢复时从关联 ServerExecutionJob/DeploymentRun 回读事实，禁止重复执行已经成功的
  schema/bootstrap/backfill。
- 实现架构文档规定的并发键。

切片 6：阶段适配器与兼容桥
- server_command 适配器调用现有 ServerExecutorService。
- deployment_run 适配器通过内部 service 调用创建 DeploymentRun，不允许 HTTP
  自调用。
- 为内部调用引入 legacy_inline 与 release_application_only 等价边界：
  公开旧部署仍跑 F382 前置阶段；发布计划已拆出的 migration/bootstrap 不得在应用
  部署阶段重复运行。内部开关不能成为普通用户绕过门禁的公共 DTO。
- 独立 health stage 必须基于真实检查结果，不以进程启动或 HTTP 请求发出作为成功。
- shell 阶段按架构文档的哨兵、64 KiB、schemaVersion、JSON schema、白名单路径和
  脱敏规则解析结构化输出。

切片 7：审批、权限、安全和审计
- 复用 ControlAccessPolicy、OperationApproval 和 AuditEvent。
- 审批绑定 plan/stage/environment/input hash；配置变化后旧审批失效。
- 必需阶段禁止跳过；optional 阶段跳过需要权限、确认文本、原因和审计。
- 任何计划快照、日志、output、event、API 和页面都不能泄漏密码、token、连接串、
  私钥或可重放 env 明文。
- 团队、项目和环境读写权限都要验证。

切片 8：API
- 实现并测试：
  POST /release-plans/projects/:projectId/preview
  POST /release-plans/projects/:projectId
  GET /release-plans
  GET /release-plans/:planId
  POST /release-plans/:planId/execute
  POST /release-plans/:planId/cancel
  POST /release-plans/:planId/stages/:stageId/retry
  POST /release-plans/:planId/stages/:stageId/skip
- 返回下一步动作、阻塞原因、阶段、依赖、attempt、审批、关联运行、脱敏日志、
  output、错误和全部时间字段。
- 使用稳定错误码和正确 HTTP 状态，不能用 200 包装失败。

切片 9：新手发布 UI
- 项目详情新增“发布”入口和创建/预览向导：环境、分支/提交、应用服务、解析出的
  数据/应用阶段、副作用、依赖、审批、dry-run/live。
- 发布控制中心顶部只保留当前结论、一个推荐动作、阻塞原因、版本、环境、操作者。
- 主视图用按依赖排序的阶段卡片；高级视图可展示 DAG。
- 每阶段展示输入、依赖、目标、状态、耗时、审批、attempt、输出、日志、错误、
  DeploymentRun/ServerExecutionJob 关联和真实可执行动作。
- URL 可恢复：?tab=releases&releasePlanId=<id>&stageId=<id>。
- 所有按钮必须连接真实 API。暂不可用必须 disabled 并解释；API 失败不能成功 Toast；
  “审批中、已排队、执行中、成功”必须严格区分。
- 复用现有设计 tokens、Card/Button/StatusTag 和中文优先文案，响应式和键盘操作可用。

切片 10：兼容上线
- feature flag 默认 false。关闭时旧 API、页面和部署测试完全不变。
- 启用时允许对单项目预览/执行；旧配置只翻译为计划快照，不回写。
- 关闭开关不删除历史；明确在途任务如何完成/取消。
- 写启用、禁用、恢复、租约回收、失败修复和回滚手册。

必须实现并真实验证这个参考 DAG（用 Devpilot 自身 fixture 或安全的模拟服务，
不要修改 Picshare 仓库）：
config-check
→ database-schema-migration
→ production-bootstrap
→ legacy-photo-backfill（optional + high risk approval）
→ backend-deploy
→ backend-readiness
→ admin-deploy
→ admin-readiness

故障和恢复验收：
1. DAG 有环时预览失败并指出环。
2. dry-run 不创建执行任务或数据写入。
3. migration 失败时后续全部 blocked。
4. bootstrap 重复推进只执行一次。
5. backfill 无候选数据时用结构化输出说明 0，并合法 skipped。
6. Backend readiness 失败时 Admin 不部署。
7. 并发推进同一阶段只产生一个 active attempt。
8. API 进程中断后可从关联任务恢复，不重复成功阶段。
9. 配置变化产生新 hash，旧审批失效。
10. 无权限用户不能读取计划或关联 ID。
11. 日志故意包含测试 secret 时，数据库/API/UI 全部脱敏。
12. flag 关闭时所有既有部署回归通过。

验证要求：
- 先写纯逻辑和定向测试，再逐层集成。
- 运行 API/Web 相关 Jest、type-check、build、focused lint、Prisma validate/generate。
- 使用一次性 MySQL 验证真实迁移、约束、并发认领、恢复和数据库回读。
- 更新本地 Devpilot 3120/3121 实例，显式开启 feature flag。
- 使用真实浏览器在 http://localhost:3120 完成：创建预览、提交、审批/门禁、
  执行、失败诊断、重试、刷新恢复、日志与输出查看。保留截图。
- 浏览器结论必须与 API、数据库、执行任务和审计事件回读一致。
- 所有大输出保存到 /tmp/codex-tool-runs/svton/，最终报告只引用关键行和路径。
- 检查所有新增/修改 TS/TSX 文件职责和行数，修复超长或混杂文件。

完成定义：
- F383 TODO 中所有 pending-glm 项改为 done，并附真实证据；
- 架构、API、数据库、协调器、阶段适配、治理、UI、操作手册和最终报告齐全；
- 自动化验证通过，真实浏览器参考流程通过；
- 旧部署入口兼容，feature flag 默认关闭；
- 不存在假按钮、假成功、重复数据阶段和 secret 泄漏；
- git diff 已审查，工作区只包含本任务改动；
- 将全部改动提交到当前分支，报告提交 ID、验证命令、证据路径和仅剩的外部生产
  验收风险。不要把“需要真实生产权限才能验证”伪装成已完成。
```
