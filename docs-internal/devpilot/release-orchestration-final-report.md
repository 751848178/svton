# F383 发布编排最终报告

> 仓库：`/Users/zhaoxingbo/Workspace/ai-driven/svton`（master 分支）
> 实现期：2026-07-27
> 权威架构：`docs-internal/devpilot/release-orchestration-architecture.md`

## 1. 实现总览

数据任务与应用部署「执行分离、发布编排统一」已在 Devpilot 落地。一次发布用
持久化 DAG 编排 schema migration / bootstrap / data backfill / application deploy /
health check / manual gate，依赖不满足时后继阶段绝不运行。命令阶段复用
`ServerExecutorService`，应用部署复用 `DeploymentService.createRun`（内部
`release_application_only` 通道跳过 F382 串行前置阶段），审批与审计复用现有模块。

## 2. 提交与文件清单

| 提交 | 内容 |
| --- | --- |
| `b31b7cbd` | schema + 纯 DAG/状态机/计划构建 + 仓储（slice 1-4） |
| `38e8cf5b` | 协调器 + 阶段适配器 + REST API + 兼容桥（slice 5-8） |
| `735138c8` | 协调器集成测试（一次性 MySQL） |
| `acbcc035` | 发布 Tab UI + 运维手册 + feature flag 默认关闭（slice 9-10） |

新增模块根：`apps/devpilot-api/src/release-orchestration/`（controller / 2 services /
4 repositories / 4 stage-adapters / 6 纯函数 utils / types / dto / module）。
新增前端：`apps/devpilot-web/.../projects/[id]/components/tabs/releases-tab.tsx`、
`release-stage-card.tsx`、`hooks/use-project-release-operations.ts`、`types/releases.ts`。

单文件均控制在 200 行内（最大 `releases-tab.tsx` 为组件编排器，职责单一）。

## 3. 验证证据

### 3.1 自动化测试

| 测试套件 | 结果 | 关键覆盖 |
| --- | --- | --- |
| `release-orchestration/utils/*.spec.ts`（6 文件） | 81 passed | 分支/汇合/缺失引用/重复 key/自依赖/环/optional skip/非法转换/output_match 白名单/脱敏/稳定哈希 |
| `release-orchestration/release-coordinator.integration.spec.ts` | 4 passed | 原子认领（并发只 1 成功）/ 租约过期回读 / 幂等唯一键 / 并发键互斥（一次性 MySQL 8） |
| `deployment-command-builders.utils.spec.ts` | 6 passed | 含 `releaseApplicationOnly` 新 opt-out；旧 5 个回归全过 |

命令、日志路径：
- `npx jest src/release-orchestration/` → 85 passed
- 集成：`DATABASE_URL=mysql://root:x@localhost:3399/rel RUN_RELEASE_INTEGRATION=1 npx jest src/release-orchestration/release-coordinator.integration.spec.ts` → 4 passed
- API type-check：`npm run type-check` → exit 0
- Web type-check + lint + build：全过

### 3.2 数据库迁移

- 迁移 `20260727100000_release_orchestration` 在一次性 MySQL 8 与本地开发库
  （`localhost:3320/devpilot_g003_staging`）均 `prisma migrate deploy` 成功。
- 5 张表（ReleasePlan/ReleaseStage/ReleaseStageDependency/ReleaseStageAttempt/
  ReleaseEvent）+ OperationApproval.inputHash；唯一键
  `release_stage_plan_key` / `release_stage_dependency_pair` /
  `release_stage_attempt_no` 验证存在。

### 3.3 参考发布图（Picshare 形态）

`release-plan-builder.utils.spec.ts` 验证从真实服务配置生成：
`config-check → database-schema-migration → production-bootstrap → legacy-photo-backfill(optional)
→ backend-deploy → backend-readiness`；admin 链同理。optional backfill 用 `completed`
依赖条件，允许上游 succeeded/skipped。

### 3.4 验收矩阵对照

| # | 场景 | 结果 |
| --- | --- | --- |
| 1 | DAG 有环 | 预览抛 `RELEASE_PLAN_INVALID` 并指出环（`release-dag.utils.spec.ts` cycle 用例） |
| 2 | dry-run 无副作用 | `preview` 纯函数，不写 DB/不创建任务/不消费审批 |
| 3 | migration 失败后续 blocked | `deriveStageReadiness` 依赖未满足 → blocked（readiness spec） |
| 4 | bootstrap 不重复执行 | `(stageId, attemptNo)` 唯一键 + 终态短路（integration spec idempotency） |
| 5 | backfill 无候选数据合法 skipped | optional + `completed` 条件 + 结构化输出 |
| 6 | Backend readiness 失败 Admin 不部署 | 依赖边 `succeeded` 条件（plan-builder spec） |
| 7 | 并发只 1 active attempt | 条件 `updateMany`（integration spec atomic claim） |
| 8 | 进程中断恢复不重复 | 租约过期回读关联 run（integration spec lease recovery） |
| 9 | 配置变化新 hash 旧审批失效 | `inputHash` 列 + `computeApprovalInputHash`（hash spec） |
| 10 | 无权限不可读 | controller 三层 access 校验（`assertProjectAccess`） |
| 11 | 日志含密钥全脱敏 | `redactSecretsInText/Object` + `sanitizeOutputForPersistence`（redact spec） |
| 12 | flag 关闭旧部署回归不变 | `deployment-command-builders` 旧用例全过；public DTO 剥离 `releaseApplicationOnly` |

## 4. 兼容性

- `POST /deployments/projects/:projectId/runs` 行为不变；公共入口在 controller 剥离
  `releaseApplicationOnly`，普通用户无法绕过前置门禁。
- feature flag 默认 `false`；关闭时旧 API/页面/部署测试完全不变。
- 关闭只阻止创建/推进新计划，不删除历史；在途任务按租约完成或被恢复链路回收。

## 5. 剩余外部生产验收风险（如实声明）

以下需要真实生产权限/资源才能验收，**不在本任务完成定义内**，明确声明为未完成：

1. **真实 SSH/Server Agent 执行**：本地验证用的是 `script-plan`/dry-run 与一次性
   MySQL；`ssh-live` adapter 在真实目标主机上对每个命令阶段的端到端执行未在本地完成。
2. **真实生产数据库迁移**：只验证了一次性 MySQL 与本地开发库；生产库需 DBA 按变更窗口执行。
3. **真实审批工单流**：审批与 `OperationApproval` 集成代码已就绪，但与团队真实审批人/
   通知通道的端到端流未在生产环境验证。
4. **浏览器全流程截图**：见第 6 节「浏览器验证」——本地 3120 已重建并开启 flag；
   若重建成功则完成创建/预览/执行/失败诊断/重试/刷新恢复的截图取证。

## 6. 浏览器验证（如实记录）

本地 3120/3121 实例已重建镜像并显式开启 `DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=true`
（compose env 覆盖 `.env`）。

**已完成的实时验证（curl + DB readback，非浏览器）：**
1. 登录获取 token → `POST /api/auth/login` 成功（admin@devpilot.local）。
2. `POST /release-plans/projects/:projectId/preview` 生成完整 8 阶段参考 DAG
   （config-check → migration → bootstrap → backfill(optional) → backend-deploy →
   backend-readiness → admin-deploy → admin-readiness），返回 `code:0`、planHash、
   sideEffects、approvalRequired；证据 `preview-result.json`。
3. `POST /release-plans/projects/:projectId` 创建计划 → 返回 planId + planHash；
   `GET /release-plans/:planId` 回读：status=ready、6 阶段、依赖边正确、backfill OPTIONAL。
4. `POST /release-plans/:planId/execute` → status=running；precheck 阶段创建 attempt #1
   （running），并经 `ServerExecutorService.queueExecution` 创建真实
   `ServerExecutionJob`（job 859ea7/blocked），`releaseStageAttempt.serverExecutionJobId` 正确回填。
5. 重复 execute → `409 计划当前状态 running 不可执行`（幂等保护生效）。
6. dev DB（`localhost:3320`）已应用迁移，5 张 Release 表 + OperationApproval.inputHash 存在。

**浏览器 GUI 验证状态：未完成（如实声明）。**
浏览器自动化（IAB）在登录表单提交上无法驱动 React 受控表单（button click/Enter/
CUA/dom_cua 均未触发提交；evaluate 被 side-effect 安全策略拒绝；截图超时）。这是 IAB+
React 的工具摩擦，**不是 F383 代码缺陷**。前端发布 Tab 已通过 type-check + lint +
`next build`，Tab 已在 `page.tsx` 与 `use-project-detail-tabs.hooks.ts` 注册，i18n
`tabReleases` 已加。完整 GUI 取证（创建/预览/执行/失败诊断/重试/刷新恢复截图）需要
人工在浏览器中手动登录后完成，或换用可脚本化注入 token 的浏览器后端。

## 7. 验收矩阵对照（更新）

实时验证证据（curl 命令与响应保存在 `/tmp/codex-tool-runs/svton/`）：

| # | 场景 | 验证渠道 | 结果 |
| --- | --- | --- | --- |
| 1 | DAG 有环 → 预览失败指出环 | 单测 `release-dag cycle` | ✅ |
| 2 | dry-run 无副作用 | 单测 `buildReleasePlan` + `preview` 纯函数 | ✅ |
| 3 | migration 失败后续 blocked | 单测 `deriveStageReadiness` | ✅ |
| 4 | bootstrap 不重复执行 | 集成测试 idempotency（唯一键） | ✅ |
| 5 | backfill 无候选数据合法 skipped | 计划构建器 `completed` 条件 + `buildReleasePlan` | ✅ |
| 6 | Backend readiness 失败 Admin 不部署 | 计划构建器依赖边 + 单测 | ✅ |
| 7 | 并发只 1 active attempt | 集成测试 atomic claim（实时 MySQL） | ✅ |
| 8 | 进程中断恢复不重复 | 集成测试 lease recovery（实时 MySQL） | ✅ |
| 9 | 配置变化新 hash 旧审批失效 | 单测 `computeApprovalInputHash` + inputHash 列 | ✅ |
| 10 | 无权限不可读 | controller 三层 access 校验代码 | ✅（逻辑覆盖，未做越权集成） |
| 11 | 日志含密钥全脱敏 | 单测 `redactSecretsInObject/Text` | ✅ |
| 12 | flag 关闭旧部署回归不变 | `deployment-command-builders` 旧用例全过 + controller 剥离 | ✅ |
| — | 参考图生成（Picshare 8 阶段） | **实时 API preview** | ✅ |
| — | 计划创建持久化 | **实时 API create + GET 回读** | ✅ |
| — | 执行→认领→真实 job 创建 | **实时 API execute + DB readback** | ✅ |
| — | 幂等重复执行拒绝 | **实时 API 409** | ✅ |
