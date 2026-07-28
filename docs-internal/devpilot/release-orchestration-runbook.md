# 发布编排运维手册（F383）

> 适用范围：Devpilot 项目级发布编排（F383）
> 相关文档：`docs-internal/devpilot/release-orchestration-architecture.md`
> 状态：实现完成；默认关闭；本地可显式开启验证

## 1. 功能开关

环境变量：`DEVPILOT_RELEASE_ORCHESTRATION_ENABLED`

| 值 | 行为 |
| --- | --- |
| `false`（默认） | 禁止创建、预览、执行、重试、跳过、重新申请审批（均返回 403）。历史发布计划与事件保留**可读**。`cancel` 始终可用（逃生通道，见 §3）。旧 `POST /deployments/projects/:projectId/runs` 与部署页面完全不变。 |
| `true` | 全部接口可用；可对单项目预览/执行。 |

切换不影响历史数据；关闭只阻止创建/推进新计划，不删除证据。**不建议直接 SQL 修改业务状态**——所有状态变更都走 REST 接口（cancel 在 flag 关闭时仍走接口）。

## 2. 启用步骤（本地）

主 `docker-compose.devpilot-app.yml` 默认 `DEVPILOT_RELEASE_ORCHESTRATION_ENABLED=false`
（匹配本表第 1 行）。本地端到端验证时通过显式 override 文件开启：

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

## 8. 已知限制

- 第一版不提供任意 YAML 工作流语言或通用 CI 平台。
- health 阶段依赖真实探针结果；若目标不可达，阶段判 failed 而非伪成功。
- 结构化输出哨兵 `@@DEVPILOT_OUTPUT@@ <base64url(json)>` 单行，最大 64 KiB，
  schemaVersion 必须为 1。
- **application_deploy 审批 category 不匹配（待修）**：`application_deploy` 阶段走
  `deployment_run` 执行器，把 release 阶段的 `release_stage`-category 审批传给部署服务，
  而部署服务按 `deployment`-category 校验，报「审批单与本次操作不匹配: category」。
  属部署↔发布审批协调的设计缺口（与 password SSH 无关）；在修复前，发布链止于
  application_deploy。
- **configSnapshot 保留可执行真实命令**：`release-plan.service.create()` 不再对
  `ReleaseStage.configSnapshot` 脱敏（否则 DB 密码被冻结成 `[REDACTED]` 导致执行期 P1000）。
  展示/审计安全由 `get()/list()` 响应级 `redactSecretsInObject`（含 CLI 内联密码形态）
  与 `inputSnapshot` 脱敏保证；FE 不会收到未脱敏的 configSnapshot。

## 9. password live SSH 验证

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
