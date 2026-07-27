# F383 Release Orchestration

> 文档类型：Devpilot 长任务事实台账与 GLM 实施路由
> 创建时间：2026-07-27（Asia/Shanghai）
> 设计者：OpenAI Codex（GPT-5 系列）
> 使用工具：Git、CodeGraph CLI、受限源码读取、Prisma 模型检查、既有运行证据
> 当前状态：**后端主链修复并经真实验证（done）；浏览器 GUI 全流程仍为进行中（blocked-by-infra）**。
> 修复轮次：2026-07-27 第二轮（独立审计揭示主链断点后返工，分支 `fix/f383-release-orchestration-mainchain`）。
> 最终报告：`docs-internal/devpilot/release-orchestration-final-report.md`
> 运维手册：`docs-internal/devpilot/release-orchestration-runbook.md`

## 实现证据索引（done 项）

> 第二轮返工后所有 P0 主链断点已修复并由真实 MySQL 集成测试证明。修复切片 1-8b + CR 修复
> 共 10 个提交（`7db15f82` → `f95f9a47`），证据日志保存在 `/tmp/codex-tool-runs/svton/f383-fix/`。

- 持久化与迁移：`20260727100000_release_orchestration`（5 表 + OperationApproval.inputHash）
  + `20260727120000_release_concurrency_lease`（并发租约唯一约束）均 prisma validate + 一次性 MySQL 8 deploy 成功。
- 纯 DAG/状态机/依赖/输出/脱敏/哈希：`utils/` specs，含 `failed→running`/`pending→queued` 合法转换、
  Date→ISO 修复、64KiB 解码长度上限、readOutputPath 白名单、artifacts 脱敏。
- 计划构建器：cross-service DAG（Picshare `health_check:backend → application_deploy:admin`）、
  optional-backfill 出边 `completed`、branch/commitSha/gitRepo 透传、idempotencyKey 在 persist 时重算。
- 协调器集成（真实 MySQL :3399，22 用例全过，`cr-fixes/integration-tests.log`）：
  原子认领（pending 在 CAS 集合）、并发同 concurrencyKey 只一胜、CAS-lost 无孤儿、
  pending-with-active 恢复、幂等（findSucceededByStage）、租约释放、SEJ 完成回调推进后继、
  finalizeAndAdvance 幂等、scheduler runOnce、retry 重开 failed 计划+attempt#2+并发 retry 409、
  cancel 取消真实 SEJ+原子翻表+并发 cancel 409、health 路由+curl 完成、
  **真实 DB 审批流（pending→approved→claim→succeed+consume）**、stale-lease CAS 抢占、
  finalize-vs-cancel 一致、retry-vs-cancel 一致。
- 审批链路：ensureStageApproval 在 readiness 之前按 stage 创建 pending（绑定 inputHash），
  approved-latest 复用（不再每 tick 重建 pending），denied→blocked，expired→新 pending，
  re-request-approval 路由（awaiting_approval 在 CLAIMABLE_FROM）。
- 健康检查：type-first 路由 HealthCheckStageAdapter；URL 解析+协议白名单+单引号 shell 转义
  构造安全 curl（命令注入防御有专门单测）；2xx+sentinel 成功。
- 环境一致性：controller + builder 双门校验 service/team/project/environment；DTO 不再携带 shell 命令。
- preview↔create 强绑定：expectedPlanHash 必填；不一致 409 RELEASE_PLAN_STALE。
- Git 版本：resolveGitRef（git ls-remote + `--` 分隔 + 格式白名单 + leading-dash 拒绝）。
- feature flag：主 compose 默认 false；`docker-compose.devpilot-app.release.yml` override 开启。
- 错误分类：后端 GlobalExceptionFilter 保留业务 string code；前端 classifyReleaseError 读 envelope code。
- API + Web + nestjs-http type-check / lint / build 全过（`cr-fixes/`）。
- 兼容桥：`releaseApplicationOnly` opt-out + controller 剥离；旧部署回归不变。

## Goal

把 F382 的“单次部署内串行前置命令”升级为项目级发布编排：

1. 数据库结构迁移、生产 bootstrap、历史数据回填和应用部署保持职责分离；
2. 它们通过可验证的有向无环图（DAG）组成一次发布；
3. 依赖未满足时不执行，失败后不产生“应用在线即发布成功”的假象；
4. 新手只需看当前阻塞、下一步动作、每个阶段的完整证据；
5. 继续复用现有审批、审计、`DeploymentRun` 和 `ServerExecutionJob`。

权威架构与验收标准：
`docs-internal/devpilot/release-orchestration-architecture.md`。

GLM 长任务提示词：
`docs-internal/devpilot/glm-goals/devpilot-release-orchestration-goal.md`。

## Confirmed Current State

- `DeploymentRun` 已覆盖项目、环境、应用、服务、服务器、审批、执行任务、
  命令计划、日志、结果、错误和时间字段。
- `ServerExecutionJob` 已具备排队、尝试次数、租约、心跳、取消、恢复、
  目标解析、命令策略和 SSH/Server Agent 适配器。
- `OperationApproval` 已具备访问策略、风险、审核、消费和审计链路。
- F382 已把 `preStartCheckCommand`、`migrationCommand` 和
  `initializationCommand` 串入单个部署计划，并对初始化使用服务、环境和命令
  指纹检查点。
- 当前仍没有项目级 DAG、跨服务依赖、数据任务独立重试、结构化阶段输出、
  发布级恢复和发布控制中心。
- `DeploymentService` 已很大，F383 不得继续把编排职责堆入该文件。

## Scope

### In scope

- 项目和环境范围的发布计划；
- DAG 校验、依赖判定、阶段状态机、幂等、租约与恢复；
- 数据库迁移、bootstrap、数据回填、应用部署、健康检查、人工门禁；
- 对现有部署/执行/审批/审计能力的适配；
- 发布预览、执行、取消、失败重试、受控跳过和证据查看；
- 项目详情中的新手发布控制中心；
- 默认关闭的兼容上线和旧部署入口保留；
- 自动化测试、临时数据库集成验证和真实浏览器验证。

### Out of scope

- 新建另一套 SSH/Agent 执行器；
- 自动猜测任意仓库需要什么迁移或 seed；
- 自动修改业务仓库；
- 未经授权接触真实生产数据库、云资源或用户凭据；
- 第一版提供任意 YAML 工作流语言或通用 CI 平台；
- 用不可用按钮假装支持完整蓝绿、金丝雀或跨地域容灾。

## Workflow Routing

`routing: one GLM long-goal + codegraph-first + persistent TODO + isolated noisy verification; one active writer per checkout; no recursive goal handoff.`

## Functional TODO Breakdown

### F383.1 Architecture and compatibility

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.1.1 | done | 盘点部署、执行器、审批、审计、前端入口与 Prisma 关系。 | CodeGraph 与源码事实已写入权威架构文档。 |
| F383.1.2 | done | 明确发布对象、DAG、状态机、幂等、租约、输出和兼容桥。 | `release-orchestration-architecture.md`。 |
| F383.1.3 | done | 固定 GLM 实施边界、顺序和验收门槛。 | GLM Goal 提示词已落盘。 |

### F383.2 Persistence and API contracts

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.2.1 | done | 增加发布计划、阶段、依赖、阶段尝试和事件模型及迁移。 | Prisma validate/generate、迁移测试、唯一键与索引测试。 |
| F383.2.2 | done | 定义 DTO、序列化类型和脱敏响应。 | Controller/service contract specs。 |
| F383.2.3 | done | 提供预览、创建、详情、执行、取消、重试、受控跳过接口。 | 权限隔离与错误语义测试。 |

### F383.3 DAG and state machine

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.3.1 | done | 实现纯函数 DAG 校验、拓扑排序和环检测。 | 分支、汇合、缺失节点、重复 key、环测试。 |
| F383.3.2 | done | 实现依赖条件和 ready/blocked 判定。 | success、output、approval、optional skip 测试。 |
| F383.3.3 | done | 实现发布与阶段合法状态转换。 | 非法跳转、终态不可覆盖测试。 |

### F383.4 Coordinator, lease and recovery

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.4.1 | done | 原子认领 ready 阶段，限制同一并发键。 | 并发认领只产生一个执行尝试。 |
| F383.4.2 | done | 增加阶段租约、心跳、过期恢复和计划推进器。 | 崩溃恢复和重复推进测试。 |
| F383.4.3 | done | 实现稳定幂等键和成功阶段复用规则。 | 重启/重复请求不重复执行成功数据任务。 |

### F383.5 Stage adapters and legacy bridge

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.5.1 | done | 命令阶段复用 `ServerExecutorService`。 | 无新 shell runner，策略/租约/日志仍生效。 |
| F383.5.2 | done | 应用部署阶段复用 `DeploymentRun`。 | 发布阶段可追溯到部署运行和执行任务。 |
| F383.5.3 | done | 把 F382 配置翻译成独立阶段，同时保留直接部署的旧串行语义。 | 旧接口回归通过，发布模式不重复跑迁移/bootstrap。 |
| F383.5.4 | done | 提取并校验结构化输出。 | 版本、大小、schema、脱敏与错误测试。 |

### F383.6 Governance and evidence

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.6.1 | done | 复用访问策略与操作审批，按阶段风险门禁。 | 迁移、bootstrap、回填和正式部署审批测试。 |
| F383.6.2 | done | 记录发布、阶段、尝试、审批、操作者和关联 ID 的审计事件。 | 审计检索和团队隔离测试。 |
| F383.6.3 | done | 日志与输出脱敏，禁止持久化可重放明文密钥。 | 密钥不出现在 API、数据库快照和页面。 |

### F383.7 Novice-facing release center

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.7.1 | done | 增加发布创建/预览向导。 | 环境、版本、阶段、副作用、审批和 dry-run 清晰。 |
| F383.7.2 | done | 增加“一项下一步动作 + 阻塞原因 + 阶段列表”控制中心。 | 新手不需要理解 DAG 术语也能继续。 |
| F383.7.3 | done | 展示阶段输入、依赖、尝试、输出、日志、错误和关联运行。 | 刷新后可恢复到指定发布与阶段。 |
| F383.7.4 | done | 所有按钮连接真实接口；不可用动作解释原因。 | 无占位按钮和假成功 Toast。 |

### F383.8 Rollout and compatibility

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.8.1 | done | 用默认关闭的配置开关上线。 | 关闭时现有产品行为不变。 |
| F383.8.2 | done | 为旧服务生成发布计划快照，不篡改其持久配置。 | 可预览迁移结果并回退。 |
| F383.8.3 | done | 提供运维启用、禁用、恢复和已知限制文档。 | 文档含回滚路径。 |

### F383.9 Verification and closure

| ID | Status | Atomic TODO | Acceptance evidence |
| --- | --- | --- | --- |
| F383.9.1 | done | 完成 API/Web 定向测试、type-check、build、lint。 | `cr-fixes/`：API type-check exit 0；Web type-check/lint/build exit 0；nestjs-http build+test（3 用例）。212 单测 + 22 真实 MySQL 集成用例全过。 |
| F383.9.2 | done | 在一次性 MySQL 与本地执行目标验证分支、失败、恢复、幂等。 | 真实 MySQL :3399 22 集成用例：完整成功链、migration 失败阻断、bootstrap 幂等、backfill skip、health 失败、真实审批 approved/denied、API 重启恢复、retry、cancel、并发认领、并发同 concurrencyKey、CAS-lost 无孤儿、stale-lease 抢占、finalize-vs-cancel、retry-vs-cancel。 |
| F383.9.3 | in-progress | 在 `localhost:3120` 完成真实浏览器全流程。 | **阻塞于 Docker Desktop 存储损坏**：重建镜像失败（`failed to create temp dir: read-only file system` + `input/output error`），Docker daemon 进入挂起状态，原运行的 `devpilot-app-api`（旧镜像）与一次性 MySQL :3399 均被波及不可达。代码侧已通过 22 真实 MySQL 集成用例证明主链，但 Picshare 浏览器端到端截图取证需要先修复 Docker Desktop 存储（`docker system prune`/重启 Docker/重建镜像）后才能进行。 |
| F383.9.4 | in-progress | 同步 TODO、进度、架构、操作手册与最终报告。 | TODO 已据真实证据更新（done/in-progress 区分）；最终报告已更新区分本地验证与外部阻塞；架构与操作手册保持权威。 |

## Required Picshare Reference Flow

Devpilot 验证夹具必须能表达以下发布图，但 Devpilot 任务不得修改 Picshare：

```text
配置校验
  → 数据库结构迁移
  → 生产 bootstrap
  → 可选历史照片回填（人工审批）
  → Backend 部署
  → Backend 就绪检查
  → Admin 部署
  → Admin 就绪检查
```

其中历史照片回填只有在目标环境存在待回填数据时进入 ready；没有数据时应以带
结构化输出的 `skipped` 结束，而不是失败或伪成功。

## Implementation Fact Map (Slice 1 — confirmed by source read)

权威架构文档保持不变。以下为实现层确认事实与必要微调，已据源码逐条核实：

### 复用入口（已确认 file:line）

- 命令阶段适配器调用 `ServerExecutorService.queueExecution(input, opts)`，
  返回 `serverExecutionJobId`（`apps/devpilot-api/src/server-executor/server-executor.service.ts:124-129`）。
  关联写回不引入新 DB 列，沿用 `metadata.businessRunSync + sourceMetadata` 通道，
  新增 `release_stage` sync 类型与轻量 run-sync service（参照
  `server-executor-deployment-run-sync.service.ts`）。
- 应用部署阶段适配器调用 `DeploymentService.createRun(teamId, userId?, projectId, dto)`
  （`deployment.service.ts:243`）。前置阶段由
  `buildDeploymentLifecycleSteps`（`deployment-lifecycle-step-builders.utils.ts:54`）
  生成，**当前没有整组跳过开关**。F383 在 `DeploymentConfig`/`buildCommandSteps`
  上新增最小 opt-out 入口，仅由内部 `release_application_only` 通道使用，**不进入公共 DTO**。
- 审批复用 `OperationApprovalService.createPending / review / resolveApproved / consume`。
  当前无 `inputHash`/`correlationId` 字段；F383 给 `OperationApproval` 加 `inputHash`
  并贯穿 `CreateOperationApprovalInput`/`ValidateOperationApprovalInput`/`assertMatches`。
- 审计复用 `AuditEventService.create`（`audit-event.service.ts:78`），
  通过 `metadata.releasePlanId/releaseStageId/stageAttemptId/correlationId` 关联，
  无需新列。
- 权限复用 `ControlAccessPolicyService.assertCanRead/assertCanWrite`
  （phase `control_read`/`control_write`），新增 category `release_plan`。

### schema 微调（基于约定）

- 沿用无 enum、无 `@@map`、`cuid()` id、`@db.Text`、String+注释状态字段。
- 新增 5 个 model：`ReleasePlan`、`ReleaseStage`、`ReleaseStageDependency`、
  `ReleaseStageAttempt`、`ReleaseEvent`，参照 `ApplicationServiceInitialization`
  的租约/唯一键/索引风格。
- `OperationApproval` 增 `inputHash String?`（配置变更后旧审批失效的判定字段）。
- 迁移文件名：`20260727100000_release_orchestration`、
  `20260727110000_operation_approval_input_hash`。

### 实现切片路径（Slice 2-10 落点）

- 新模块根：`apps/devpilot-api/src/release-orchestration/`
  - 子目录：`dto/`、`repository/`、`types/`、`utils/`（纯函数 DAG/状态机/输出解析/脱敏）、
    `stage-adapters/`、`controller.ts`、`release-plan.service.ts`、
    `release-coordinator.service.ts`、`release-orchestration.module.ts`。
- feature flag：`DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false`（`ConfigService` 读取，
  关闭时 controller 直接 503/404，旧入口不变）。
- 前端新增 `projects/[id]/components/tabs/releases-tab.tsx` 与
  `projects/[id]/components/release-*/` 子组件；`PROJECT_TABS` 加入 `'releases'`。

### 已确认的兼容边界

- 旧 `POST /deployments/projects/:projectId/runs` 行为不变；`legacy_inline` 模式仍跑
  F382 串行前置阶段。`release_application_only` 仅由 release 模块内部调用。
- `script-plan` adapter 把 `dryRun` plan 视为 `completed`，不等于应用健康；
  release 的 health stage 必须独立验证，不依赖该状态。

## Stop Condition For This Codex Turn

本轮只产出架构、任务台账、验收和 GLM Goal 提示词。到达本节后停止，不写
F383 业务代码。后续实现必须从全新 GLM Goal 对话开始，并保持两个仓库串行、
单写者。
