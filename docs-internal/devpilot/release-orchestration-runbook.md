# 发布编排运维手册（F383）

> 适用范围：Devpilot 项目级发布编排（F383）
> 相关文档：`docs-internal/devpilot/release-orchestration-architecture.md`
> 状态：F383 已完成；产品默认关闭；本地验证栈可显式开启

## 1. 功能开关

环境变量：`DEVPILOT_RELEASE_ORCHESTRATION_ENABLED`

| 值 | 行为 |
| --- | --- |
| `false`（默认） | 禁止创建、预览、执行、重试、跳过、重新申请审批（均返回 403）。历史发布计划与事件保留**可读**。`cancel` 始终可用（逃生通道，见 §3）。旧 `POST /deployments/projects/:projectId/runs` 与部署页面完全不变。 |
| `true` | 全部接口可用；可对单项目预览/执行。 |

切换不影响历史数据；关闭只阻止创建/推进新计划，不删除证据。**不建议直接 SQL 修改业务状态**——所有状态变更都走 REST 接口（cancel 在 flag 关闭时仍走接口）。

## 2. 启用步骤（本地）

应用配置默认 `DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false`。当前本地
`docker-compose.devpilot-app.yml` 为 F383 验证栈显式设为 `true`；生产部署仍须主动开启。
其他本地环境可通过 override 文件开启：

```bash
# 1) 用 override 文件叠加开启（flag 翻 true，其余 compose 配置不变）
docker compose -f docker-compose.devpilot-app.yml \
  -f docker-compose.devpilot-app.release.yml up -d

# 或者在 devpilot-api/.env 显式开启后重启 API（compose environment 段优先级高于 .env，
# 故需同时把主 compose 内该行删/注释，或改用 override 文件）
DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=true

# 2) 重启 API（3121）与 Web（3120）
# 3) 在项目详情的「发布」Tab 新建发布 → 预览（dry-run）→ 创建 → 执行
```

`docker-compose.devpilot-app.release.yml` 只覆盖 API 服务的 flag 字段，便于一次性
本地验证而不污染默认（默认关闭）。

## 3. 在途任务处理（关闭开关时）

- 关闭开关时，已 `running` 的阶段仍按其租约完成或被恢复链路回收；
  已 `queued` 的新阶段不再被认领推进。
- **`cancel` 始终可用**：`POST /release-plans/:planId/cancel` 是逃生通道，
  feature flag 关闭时**不**返回 403，可随时停止在途计划（控制器 cancel 路由有意不守 flag，
  对应 `GET /release-plans/capability` 的 `canCancel:true`）。**不建议直接 SQL 修改业务状态**。
- cancel 采用 plan 级 CAS（compare-and-set）决定所有权：若 plan 已被并发 finalize 推进到
  `succeeded`，cancel 的 CAS 命中 0 行即短路返回，不产生部分取消、不写虚假 `plan_canceled` 事件
  （P0-3 修复）。调用方读最新 plan 即可看到真实终态。
- 过期租约回收：恢复链路在 `advancePlan` 触发时扫描
  `leaseExpiresAt < now` 的 `running` attempt，从关联
  `ServerExecutionJob`/`DeploymentRun` 回读终态。

## 4. 租约回收

- 单 attempt 租约默认 15 分钟（`LEASE_MS`）。
- 过期 attempt **不会**直接标成功；必须回读关联运行终态。
- 手动恢复：调用任意会触发 `advancePlan` 的接口（如 `execute`、`retry`），
  或定时器周期性调用 `ReleaseCoordinatorService.advancePlan(planId)`。

## 5. 失败修复

| 场景 | 操作 |
| --- | --- |
| 单阶段失败 | `POST /release-plans/:planId/stages/:stageId/retry`（仅 failed 可重试，创建新 attempt） |
| 可选阶段跳过 | `POST /release-plans/:planId/stages/:stageId/skip`，需 `reason` + 确认文本 `我确认跳过此可选阶段`；必需阶段永远不可跳过 |
| 配置变化 | 旧审批失效（`inputHash` 不匹配）；需创建新发布计划 |
| 全量回滚 | `POST /release-plans/:planId/cancel` 取消发布；应用层回滚走既有 `POST /deployments/runs/:runId/rollback` |

## 6. 回滚手册

1. 应用代码回滚：使用既有部署 rollback 入口（不受 F383 影响）。
2. 数据库结构迁移**不自动回滚**：已提交的数据变更必须由业务侧手工或
   反向迁移脚本处理。F383 不会假装自动回滚已提交的数据变更。
3. 关闭 F383：将 `DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false` 并重启；
   旧部署入口立即恢复 F382 串行行为。

## 7. 审计与证据

- 每个发布计划、阶段、attempt 的事件写入 `ReleaseEvent`（只追加）。
- 审批走 `OperationApproval`（绑定 `inputHash`，配置变化后失效）。
- 审计 `AuditEvent` 记录 `release_plan.*` category 的请求/审批/执行。
- 所有计划快照、日志、output、event 在持久化前脱敏（密钥、连接串、PEM、Bearer）。

## 8. 精确运行定位

从发布阶段查看执行证据时使用以下 URL：

- 执行任务：`/execution-governance?jobId=<ServerExecutionJob.id>`；
- 部署运行：
  `/projects/<projectId>?tab=deployments&runId=<DeploymentRun.id>`。

页面必须显示“仅显示该任务/运行”的聚焦提示。若 ID 不存在，显示空态或未找到；
若出现无条件最近列表，视为路由回归。

## 9. 计划级零泄漏验证

管理员调用：

```text
POST /api/release-plans/<planId>/secret-leak-verification
Authorization: Bearer <admin-token>
X-Team-Id: <teamId>

{"candidateSecrets":["<从受控凭据源仅在内存注入>"],"reason":"release verification"}
```

操作要求：

1. 不把秘密探针写入脚本、文档、终端输出或证据文件；
2. 只接受 `coverageComplete=true` 且 `verdict=clean`、`findingCount=0`；
3. 用返回的 `auditEventId` 从审计事件回读计数，确认审计中无探针值；
4. `leak_detected` 时只按 record ID、field/path 定位，由有权限的运维人员处理，
   不要求验证器回显命中片段；
5. 接口错误或覆盖不完整均不得作为通过结论。

真实基线（2026-07-29）：计划 `cms5m7z2001ow14kkg3jg0l87`，4 个有效秘密探针、
8 条记录、44 个字段、0 命中；审计 `cms5o57vz000akza17koems85`。

## 10. 已知限制

- 第一版不提供任意 YAML 工作流语言或通用 CI 平台。
- health 阶段依赖真实探针结果；若目标不可达，阶段判 failed 而非伪成功。
- 结构化输出哨兵 `@@DEVPILOT_OUTPUT@@ <base64url(json)>` 单行，最大 64 KiB，
  schemaVersion 必须为 1。
- 零泄漏验证是计划级、时间点只读审计，不替代所有写入边界的持续脱敏防护；新执行完成后
  应重新运行。
- 秘密探针由有权限的操作者从受控凭据源提供；平台不持久化探针，也不会在结果中回显。

## 11. password live SSH 验证

password 认证的服务器现可走 live 发布（`SERVER_EXECUTOR_LIVE_ENABLED=true`）。

- **连接测试**：`POST /servers/:id/test` 现做三段判定（`networkReachable` /
  `authenticationVerified` / `executorCompatible`），任一不通过给出可操作 `recommendation`；
  不再把「端口可达」伪装成 online。
- **真实 password SSH 集成测试**：
  ```bash
  docker compose -f docker-compose.deploy-target.yml up -d deploy-target-password
  RUN_SSH_INTEGRATION=1 npx jest src/common/ssh/ssh2-transport-password.integration.spec.ts
  ```
  （默认 skip，需显式 `RUN_SSH_INTEGRATION=1`。）
- **目标 sshd 要求**：`PasswordAuthentication yes` 且（若部署用户 uid=0）`PermitRootLogin yes`；
  linuxserver/openssh-server 镜像用 `PASSWORD_ACCESS=true`（非 `PASSWORD_AUTH`）才会开启密码登录。
