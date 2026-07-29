# Devpilot 项目级发布编排架构（F383）

> 文档类型：实施级架构决策与验收基线
> 创建时间：2026-07-27（Asia/Shanghai）
> 作者：OpenAI Codex（GPT-5 系列）
> 事实来源：当前 master 源码、Prisma 模型、CodeGraph 调用关系、F381/F382 证据
> 适用范围：Devpilot；Picshare 仅作为验证案例

## 1. 决策

数据、数据结构和应用发布应当“执行分离、发布编排统一”。

- **执行分离**：schema migration、业务 bootstrap、存量数据 backfill、
  Backend/Admin 部署分别拥有命令、权限、重试、日志、输出和失败边界。
- **编排统一**：一次版本发布用持久化 DAG 明确依赖。后继阶段只在依赖成功
  或满足显式条件时运行。
- **证据统一**：用户从一个发布详情看到完整输入、依赖、审批、尝试、日志、
  结构化输出、错误、关联部署运行和下一步动作。
- **执行器复用**：命令阶段复用 `ServerExecutorService`，应用部署复用
  `DeploymentRun`，审批复用 `OperationApproval`，不新建旁路执行体系。
- **兼容上线**：F382 直接部署入口保持原行为；发布编排默认关闭，启用后由
  兼容适配器把旧配置翻译为独立阶段。

## 2. 当前事实与缺口

### 2.1 可复用事实

| 能力 | 当前事实 | F383 用法 |
| --- | --- | --- |
| 应用部署 | `DeploymentRun` 已记录目标、计划、日志、结果、错误、审批和执行任务 | 作为应用部署阶段的业务运行 |
| 远程执行 | `ServerExecutionJob` 已有队列、重试、租约、心跳、恢复、取消、锁和适配器 | 作为命令阶段执行底座 |
| 审批 | `OperationApprovalService` 已有风险、审核、消费和审计 | 作为高风险阶段门禁 |
| 前置阶段 | F382 已支持 pre-check、migration、initialization 和初始化指纹 | 作为旧配置到发布阶段的输入 |
| UI 证据 | 项目部署 Tab 已能显示命令、阶段、日志、错误和关联对象 | 复用视觉与字段表达 |

### 2.2 必须补齐

- 没有项目级发布实体，多个应用部署无法形成一个可恢复事务边界；
- 没有 DAG 和环检测，依赖只存在于人脑或命令拼接中；
- migration/bootstrap/backfill 不能独立审批、重试和审计；
- F382 的一次性检查点只覆盖 initialization，无法表达任意阶段与版本输出；
- 没有发布级下一步动作、阻塞原因和跨服务完整时间线；
- 当前 `DeploymentService` 体量过大，不能继续承担发布协调器职责。

## 3. 领域模型

第一版不建设通用 CI DSL。它持久化“一次发布的不可变快照”，下一次发布重新
生成计划。应用服务配置仍是计划来源。

### 3.1 ReleasePlan

一次项目、环境和版本的发布快照。

建议字段：

- `id`, `teamId`, `projectId`, `environmentId`, `name`;
- `branch`, `commitSha`, `source`, `trigger`, `mode`;
- `status`, `blockedReason`, `planHash`, `inputSnapshot`;
- `createdByUserId`, `startedAt`, `finishedAt`, `canceledAt`;
- `createdAt`, `updatedAt`.

状态：

`draft | awaiting_approval | ready | running | succeeded | failed | blocked | canceled`

约束：

- 正式执行前冻结 `inputSnapshot` 和 `planHash`；
- 冻结后不得原地改阶段，修改配置必须创建新计划；
- dry-run 只做解析、校验和副作用预览，不创建远程执行任务；
- 计划成功只能由所有必需阶段终态共同推导，不能手工写成成功。

### 3.2 ReleaseStage

计划中的不可变节点定义与当前派生状态。

建议字段：

- `id`, `releasePlanId`, `key`, `name`, `type`;
- `applicationId`, `applicationServiceId`, `environmentId`;
- `executorKind`, `configSnapshot`, `configHash`, `outputSchema`;
- `idempotencyKey`, `concurrencyKey`, `riskLevel`;
- `required`, `status`, `blockedReason`;
- `currentAttempt`, `createdAt`, `updatedAt`.

阶段类型：

- `precheck`
- `schema_migration`
- `bootstrap`
- `data_backfill`
- `application_deploy`
- `health_check`
- `manual_gate`
- `custom_command`

执行类型：

- `server_command`：使用 `ServerExecutorService`
- `deployment_run`：使用现有 `DeploymentService` 的内部适配入口
- `manual_gate`：只由审批/人工确认完成，不创建 shell 任务

阶段状态：

`pending | blocked | awaiting_approval | ready | queued | running | succeeded | failed | skipped | canceled`

### 3.3 ReleaseStageDependency

建议字段：

- `stageId`, `dependsOnStageId`;
- `conditionType`, `conditionSnapshot`;
- `createdAt`.

第一版条件：

- `succeeded`：依赖阶段必须成功；
- `completed`：允许成功或显式跳过，仅用于 optional 节点；
- `output_match`：依赖的结构化输出满足白名单条件；
- `approved`：人工门禁已批准。

不允许任意脚本条件。`output_match` 只支持等值、布尔、数字比较和存在性，
由纯函数解释，避免执行用户表达式。

### 3.4 ReleaseStageAttempt

每次执行尝试的不可变证据。

建议字段：

- `id`, `releaseStageId`, `attemptNo`, `status`;
- `deploymentRunId`, `serverExecutionJobId`, `operationApprovalId`;
- `inputSnapshot`, `output`, `logSummary`, `error`;
- `leaseOwner`, `leaseExpiresAt`, `heartbeatAt`;
- `startedAt`, `finishedAt`, `createdAt`, `updatedAt`.

唯一约束：`releaseStageId + attemptNo`。

### 3.5 ReleaseEvent

发布级统一时间线，字段至少包含：

- `releasePlanId`, `releaseStageId`, `stageAttemptId`;
- `eventType`, `actorType`, `actorId`, `correlationId`;
- `summary`, `metadata`, `createdAt`.

事件只追加，不覆盖历史。敏感值在写入前脱敏。

## 4. DAG 与状态机

### 4.1 创建计划

1. 读取项目、环境、应用服务和绑定资源的真实快照；
2. 把显式配置翻译为阶段，未配置的能力不猜测；
3. 构建依赖边；
4. 校验 key 唯一、引用存在、无自依赖、无环；
5. 计算稳定 `planHash`；
6. 返回副作用、风险、审批、密钥和目标预览；
7. dry-run 到此结束；正式计划持久化冻结快照。

### 4.2 就绪计算

就绪判断必须是纯函数：

```text
required approvals satisfied
AND all dependency conditions satisfied
AND no active attempt
AND stage is not terminal
AND release is executable
AND concurrency key is available
```

每次阶段终态、审批变化、租约恢复或人工操作后重新计算。不能依赖前端轮询推动
状态。

### 4.3 合法转换

- `pending/blocked → awaiting_approval/ready`
- `awaiting_approval → ready/canceled`
- `ready → queued/running/canceled`
- `queued → running/failed/canceled`
- `running → succeeded/failed/canceled`
- `failed → ready` 仅由显式 retry 创建新 attempt
- `pending/blocked/failed → skipped` 仅 optional 阶段且需要理由、权限和审计

成功、跳过、取消为阶段终态；成功不能被重试覆盖，除非创建新发布计划。

## 5. 协调器、幂等与并发

### 5.1 协调器

新增独立 `release-orchestration` 模块。控制器、计划构建器、DAG、状态机、
协调器、仓储、阶段适配器、输出解析、审计和 DTO 分文件，单文件保持职责单一。

协调器只负责：

- 选择 ready 阶段；
- 原子认领；
- 调用阶段适配器；
- 同步关联运行状态；
- 结束 attempt；
- 重新推进计划。

它不直接执行 shell，也不复制 SSH/Agent 逻辑。

### 5.2 原子认领

- 认领条件同时包含期望状态和租约是否可用；
- 用事务和条件更新保证一个阶段只有一个 active attempt；
- 计划级推进器可重复调用；
- `leaseOwner`、`leaseExpiresAt`、`heartbeatAt` 支持进程崩溃恢复；
- 过期尝试不得直接标成功，必须从关联
  `ServerExecutionJob`/`DeploymentRun` 回读终态。

### 5.3 幂等

默认幂等键：

```text
releasePlanId + stageKey + configHash
```

业务阶段可增加：

- schema migration：数据库资源 ID + migration artifact hash；
- bootstrap：服务 + 环境 + bootstrap command/config hash；
- backfill：目标数据集 + job version + parameters hash；
- application deploy：服务 + 环境 + commit SHA + deploy config hash。

同一计划内成功阶段不重复执行。重启、重复点击、重复调度只复用成功证据。命令或
版本变化必须创建新计划，不能偷偷失效旧成功记录。

### 5.4 并发键

- schema/data：`environment + databaseResource`;
- service deploy/health：`environment + applicationService`;
- project-wide manual gate：`releasePlan`.

不同数据库或不同服务可并行；同一数据目标禁止并行变更。

## 6. 阶段适配与 F382 兼容桥

### 6.1 命令阶段

precheck、schema migration、bootstrap、backfill、custom command 调用
`ServerExecutorService`，保留：

- 目标解析和权限；
- 命令策略；
- SSH/Server Agent 选择；
- 队列、租约、心跳、取消和恢复；
- 脱敏日志与审计。

### 6.2 应用部署阶段

application deploy 通过内部适配器创建 `DeploymentRun`，并把
`deploymentRunId` 写入 attempt。不能从 HTTP 回调自身接口。

内部创建选项需要区分：

- `legacy_inline`：现有公开直接部署保持 F382 串行前置阶段；
- `release_application_only`：发布编排已独立执行 precheck/migration/bootstrap，
  应用阶段不得重复运行它们；
- 独立 health stage 启用时，应用阶段不把“进程启动”误判成发布成功。

内部选项不能直接暴露为普通用户可绕过前置阶段的公共 DTO。

### 6.3 旧配置翻译

启用发布编排后，计划构建器读取：

- `preStartCheckCommand` → precheck
- `migrationCommand` → schema migration
- `initializationCommand` → bootstrap
- `deployCommand` → application deploy
- `healthCheckUrl/Command` → health check

翻译只生成计划快照，不回写服务配置。未配置命令不生成节点。

旧 `POST /deployments/projects/:projectId/runs` 行为保持不变。只有从发布计划
内部调用时使用 `release_application_only`。

## 7. 结构化输出

每个阶段都有标准输出：

```json
{
  "schemaVersion": 1,
  "summary": "human readable",
  "values": {},
  "metrics": {},
  "artifacts": []
}
```

内部适配器直接返回该对象。shell 命令如需返回结构化值，使用单行哨兵：

```text
@@DEVPILOT_OUTPUT@@ <base64url(JSON)>
```

规则：

- 解码后最大 64 KiB；
- 必须通过版本与 JSON schema 校验；
- 日志保留哨兵已脱敏摘要，不回显原始敏感值；
- 解析失败使阶段失败，并给出可操作错误；
- 依赖条件只能读取白名单 `values/metrics` 路径；
- 密码、token、连接串和私钥禁止进入 output。

## 8. 审批、安全与审计

- dry-run 不执行副作用，不消费审批；
- schema migration、bootstrap、backfill、正式应用部署按现有风险策略决定审批；
- 审批绑定发布计划、阶段、环境、输入哈希和有效期；
- 配置改变后旧审批失效；
- 重试沿用审批必须明确满足现有策略，否则重新申请；
- 跳过必需阶段永远禁止；跳过 optional 阶段需要原因、确认和审计；
- 密钥只在执行时注入，不写入计划快照、output、事件或页面；
- 团队、项目、环境权限必须同时校验，列表不能越权泄漏关联 ID。

## 9. API

建议保持资源式接口：

- `POST /release-plans/projects/:projectId/preview`
- `POST /release-plans/projects/:projectId`
- `GET /release-plans?projectId=&environmentId=&status=`
- `GET /release-plans/:planId`
- `POST /release-plans/:planId/secret-leak-verification`
- `POST /release-plans/:planId/execute`
- `POST /release-plans/:planId/cancel`
- `POST /release-plans/:planId/stages/:stageId/retry`
- `POST /release-plans/:planId/stages/:stageId/skip`

响应必须返回：

- 当前状态和可执行动作；
- 下一步动作与阻塞原因；
- 阶段、依赖和尝试；
- 审批状态；
- 关联 `DeploymentRun`/`ServerExecutionJob`；
- 脱敏日志摘要、结构化输出和错误；
- 完整时间字段。

错误使用稳定机器码和中文可操作说明，不用 HTTP 200 包装失败。

### 9.1 精确执行证据与零泄漏验证

发布阶段的关联运行必须定位到唯一记录，禁止退化为无过滤条件的最近列表：

- `ServerExecutionJob` 链接为
  `/execution-governance?jobId=<id>`；Web 将 `jobId` 原样交给
  `GET /server-execution-jobs?jobId=<id>` 的服务端 `where.id`，默认选中“作业”；
- `DeploymentRun` 链接为
  `/projects/<projectId>?tab=deployments&runId=<id>`；Web 调用
  `GET /deployments/runs/<id>`，API 同时校验 team、project/environment 访问范围，
  不可读或不存在统一 404，页面只显示并自动展开目标运行；
- 无效 `jobId`/`runId` 只能得到空态或未找到，不能回退到最近 100/30 条记录。

计划级零泄漏验证由
`POST /release-plans/:planId/secret-leak-verification` 提供：

- 仅 `team_admin` 且具有计划写权限的操作者可调用；
- `candidateSecrets` 只在请求内存中参与比对，不进入响应、日志或 AuditEvent；
- 覆盖 DeploymentRun 的参数、工作目录/命令、命令计划、日志、结果、错误，
  ServerExecutionJob 的输入快照、命令计划、日志、结果、错误、元数据，以及关联
  LogStream、LogEntry、AuditEvent；
- 响应只返回 verdict、覆盖完整性、记录/字段/命中计数和安全定位
  `recordType/recordId/field/path/detector`，不返回值或片段；
- 查询、检测或审计失败时 fail-closed，不生成 `clean` 结论；成功和失败均写安全审计。

## 10. 新手 UI

入口优先放在项目详情，名称使用“发布”，不要先暴露“DAG”术语。

### 10.1 创建发布

步骤：

1. 选择环境；
2. 确认分支/提交；
3. 选择应用服务；
4. 查看平台从真实配置解析出的数据与应用阶段；
5. 查看副作用、依赖、审批和 dry-run/live 区别；
6. 生成预览或提交正式发布。

### 10.2 发布控制中心

页面顶部只显示：

- 当前结论；
- 一条推荐下一步动作；
- 必须先解决的阻塞；
- 发布版本、环境和操作者。

主体使用按依赖排序的阶段卡片，而不是把复杂连线图作为唯一入口。每张卡显示：

- 为什么需要它、依赖谁；
- 当前状态与耗时；
- 输入摘要和执行目标；
- 审批、尝试次数；
- 输出、日志、错误；
- 关联部署/执行任务；
- 当前允许的真实动作。

高级用户可切换 DAG 视图。URL 恢复：

```text
?tab=releases&releasePlanId=<id>&stageId=<id>
```

### 10.3 操作真实性

- 不支持的动作不显示为主按钮；
- 暂不可用动作 disabled 并显示原因；
- API 失败不发成功 Toast；
- “已提交审批”“已排队”“执行成功”必须区分；
- 刷新后从服务端事实恢复，不依赖前端临时状态。

## 11. Picshare 验证图

```text
config-check
  → database-schema-migration
  → production-bootstrap
  → legacy-photo-backfill [optional + high-risk approval]
  → backend-deploy
  → backend-readiness
  → admin-deploy
  → admin-readiness
```

预期结构化输出示例：

- migration：`migrationCount`, `databaseSchemaVersion`;
- bootstrap：`adminCreated`, `adminReused`, `planUpsertCount`;
- backfill：`candidateRows`, `updatedRows`, `remainingRows`;
- health：`httpStatus`, `databaseReady`, `checkedAt`.

Devpilot 不内置 Picshare 业务逻辑，只消费它公开的命令和输出约定。

## 12. 上线与回滚

配置开关：

```text
DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false
```

要求：

1. 默认关闭，旧部署入口与页面不变；
2. 本地验证显式开启；
3. 开启后可对单项目生成预览；
4. 关闭开关只阻止创建/推进新计划，不删除历史证据；
5. 已运行阶段仍按安全策略完成或取消；
6. 数据库迁移可前向回滚应用代码，但不能假装自动回滚已提交的数据变更；
7. 提供恢复、取消、租约回收和关联运行核对手册。

## 13. 验收矩阵

| 场景 | 必须结果 |
| --- | --- |
| DAG 有环 | 预览失败，指出具体环 |
| dry-run | 有完整计划，无远程任务、审批消费和数据写入 |
| migration 失败 | bootstrap 与所有应用部署保持 blocked |
| bootstrap 重复推进 | 只复用成功 attempt，不再次创建管理员 |
| backfill 无候选数据 | 结构化输出为 0，optional stage 合法 skipped |
| Backend 健康失败 | Admin 部署不启动 |
| 同阶段并发推进 | 只产生一个 active attempt |
| 服务进程重启 | 从关联任务回读并恢复，不重复执行成功阶段 |
| 配置变化 | 生成新 planHash，旧审批不可复用 |
| 用户无环境权限 | 列表与详情均不可读取 |
| 日志含密钥 | API、数据库和 UI 中均被脱敏 |
| 关联任务深链接 | 只显示指定 job/run；伪造 ID 不回退通用列表 |
| 计划级零泄漏验证 | 覆盖完整、审计可回读、响应/审计不含秘密值 |
| 关闭 feature flag | 所有现有部署回归不变 |

## 14. 完成定义

只有同时满足以下条件才可标记 F383 完成：

- 模型、DAG、协调器、阶段适配器、API、UI 和操作文档全部落地；
- 无新旁路执行器，旧部署接口回归通过；
- 定向测试、API/Web type-check、build、focused lint 通过；
- 一次性 MySQL 和本地执行目标验证分支、失败、重试、恢复与幂等；
- `localhost:3120` 真实浏览器完成创建、预览、执行、失败诊断和刷新恢复；
- 截图、API 回读、数据库回读和审计事件一致；
- 所有按钮真实可用或明确解释不可用原因；
- TODO、进度和最终报告记录命令、退出码、证据路径与剩余生产风险。

2026-07-29 本地完成证据：计划 `cms5m7z2001ow14kkg3jg0l87` 六阶段
succeeded；真实浏览器验证两个精确链路与伪造 ID；零泄漏验证为 4 probes /
8 records / 44 fields / 0 findings，审计 `cms5o57vz000akza17koems85`。
