# F383 发布编排最终报告（第三轮 P0-1/2/3 修复后）

> 仓库：`/Users/zhaoxingbo/Workspace/ai-driven/svton`
> 分支：`fix/f383-release-orchestration-mainchain`（HEAD `03d6d10d` 第三轮 + 第二轮 `f95f9a47`，未 push）
> 权威架构：`docs-internal/devpilot/release-orchestration-architecture.md`
> 第一/二轮报告已存档于本文件后半；本节（§0.5）记录第三轮（P0-1/2/3）修复的真实证据。

## 0.5 第三轮修复（P0-1/2/3，2026-07-28）

第二轮宣称主链 done，但独立审查在源码层面复现了三个确定性断点（P0-1 跨服务依赖未真实提交、
P0-2 planHash 不绑定依赖图、P0-3 cancel 反向竞态）。第三轮在保留第二轮骨架的前提下修复，证据可复现。

| 断点 | 根因 | 第三轮修复 | 真实验证 |
| --- | --- | --- | --- |
| **P0-1** 真实页面不提交跨服务依赖 | 向导 `buildInput()` 只传 `services`，从不传 `serviceDependencies`；后端规定"Devpilot 不推断"。故 Picshare 计划永不包含 `backend:health_check → admin:application_deploy` | 依赖定义源改为 `ApplicationService.deployConfig.releaseDependencies`（服务端归属、零迁移）；控制器移除 DTO `serviceDependencies` 入参，改由 `ReleasePlanAccessService.resolveServiceDependencies` 解析；向导环境切换清选；预览面板中文描述 | `release-service-config.utils.spec`（releaseDependencies 读取/畸形/去重）、`release-cross-service-edges.utils.spec`（Picshare 边解析）、`release-plan.controller.spec`（客户端注入被忽略、服务端解析、下游未选丢弃） |
| **P0-2** planHash 不绑定依赖图 | `inputSnapshot` 不含 `serviceDependencies`/解析后 `dependencies`；增减跨服务边 hash 不变 → preview/create 篡改不触发 409 | 新增 canonical snapshot 纯函数（`release-plan-snapshot.utils`），覆盖服务选择器 + 跨服务依赖 + 解析阶段 + dependencies + 审批；数组 sortBy 顺序无关 | `release-plan-snapshot.utils.spec`（无/有依赖 hash 不同、endpoint/condition/required 变更不同、顺序相同、命令变更不同、snapshot 无秘密）；`release-plan.service.spec`（preview↔create 依赖图 drift→409） |
| **P0-3** cancel 反向竞态 | `cancel` 的 plan `updateMany` 影响行数未检查；finalize 抢先把 plan→succeeded 后 cancel 的 CAS 命中 0 行但仍翻 stages/attempts 并写 plan_canceled 事件 → plan=succeeded/stage=canceled/event=plan_canceled 不一致 | plan 级 CAS 决定所有权：命中 0 行即事务内短路，不动 stages/attempts/leases、不写事件 | coordinator integration（真实 MySQL :3399，5 个新用例：finalize-then-cancel、cancel-then-finalize、双 cancel、外部 job 已终态、外部 cancel 失败；全部断言 plan/stage/attempt/event/lease 联合不变量） |

**结构拆分**：`release-plan.service.ts`（426 行）→ 拆出 `release-cancel.service.ts`（cancel + cancelAttemptExternalJob，
P0-3 落点）+ `release-stage-action.service.ts`（retry/re-request/skipStage），核心收敛为 preview/create/get/
list/execute/heartbeat/isEnabled/resolveGitRefInto。controller 委托新服务。单向无环、无逻辑复制。

**验证证据**（日志 `/tmp/codex-tool-runs/svton/f383-third-round/`）：

| 套件 | 结果 |
| --- | --- |
| release-orchestration + operation-approval 单测 + 集成 | **268 passed**（22 集成用例不再 skip，含 5 个 P0-3 竞态） |
| prisma validate + generate | exit 0（两 F383 migration 在一次性 MySQL 8 deploy 通过） |
| api type-check / build | exit 0 |
| web type-check / lint / build | exit 0 |
| nestjs-http build / test | exit 0 / 3 passed |

**Docker 健康**（2026-07-28）：`docker info` exit 0，`http://localhost:3120` → 200，`mysql:8` 本地可用。

**浏览器验证状态（如实声明 — F383.9.3 保持 in-progress/blocked）**：
尝试用 `docker compose -f docker-compose.devpilot-app.yml -f docker-compose.devpilot-app.release.yml up -d --build`
启动应用栈走 Picshare 参考流时，发现并修复了**两个基线即存在的生产 Nest DI 启动阻塞**（提交 `0b68dfd8`）：
- `OperationApprovalModule` 未导出 `OperationApprovalRepository`（第二轮 `ReleaseApprovalLifecycleService` 直接注入它）；
- `HealthCheckStageAdapter` 构造函数请求 `ReleaseStageAdapter` 接口类型（无 provider 绑定该 token）。

修复后 Nest 容器已能越过这两个 provider 完成初始化（容器日志从 `can't resolve dependencies` 变为
`P1017`——纯 MySQL 连接失败，即应用自身的 MySQL 依赖未起，而非 DI）。
**未完成浏览器流**：完整 Picshare 参考流还需要 staging 栈（`devpilot-g003-api-mysql`/`redis`/`ssh-server`）
+ 8 步数据初始化（资源池、服务器、MySQL/Redis 资源申请、SSH 凭据注入、Picshare 项目/服务/`deployConfig`/
`releaseDependencies` 落库），详见 `docs/devpilot/local-test-data.md`。staging 镜像下载极慢（网络）+ 初始化
耗时超出单会话预算，故停在等待 staging/数据初始化的节点。**未声称完成真实浏览器流或 SSH/生产验证。**

---

# 存档：第二轮返工报告

> 第一轮报告已被独立审计证伪（多处 done 状态与源码事实不符）。本报告据第二轮返工的真实证据重写。

## 0. 第二轮返工的触发与范围

第一轮（提交 `b31b7cbd` → `8c4e3b6b`）宣称 F383 完成，但只读独立架构审计（`/tmp/codex-tool-runs/svton/f383-independent-audit/arch-result.md`）与产品/UI 审计（`ux-result.md`）在源码层面复现了多个确定性主链断点（见第 1 节）。第二轮返工在保留第一轮可复用骨架（持久化模型、纯 DAG、REST 路由、`releaseApplicationOnly` 兼容桥）的前提下，按 8 个修复切片 + 对抗式 CR 修复重写了协调器、审批、并发、恢复、健康检查与 UI 主链。

参考契约（只读，未修改）：Picshare `picshare-devpilot-fix` @ `35609ca`，权威发布契约 `docs/devpilot-release-contract.md`。

## 1. 第一轮被证伪的 done 状态 → 第二轮已修复并验证

| 审计发现 | 第一轮虚假 done | 第二轮修复（提交） | 真实验证 |
| --- | --- | --- | --- |
| stage 持久化 `pending`，coordinator CAS 不含 pending；attempt+真实 job 已创建但 stage 永远 pending；recovery 不扫 pending（P0-1） | F383.4.1 done | `8e202f9e`（atomic claim + lease）+ `f95f9a47`（CAS 细化） | 集成用例：concurrent claim、CAS-lost 无孤儿、pending-with-active 恢复 |
| 没有完成回调/scheduler，job 完成后发布不推进（P0-2） | F383.4.2 done | `79a467c0`（completion sync port + scheduler） | 集成用例：SEJ 完成→attempt succeeded→后继认领；scheduler runOnce |
| 审批链路逻辑死锁：attempt 在 readiness 之后才创建，但 readiness 要求 attempt 已有 approved approval（P0-3） | F383.6.1 done | `38d7cac7`（approval lifecycle）+ `f95f9a47`（approved-latest 复用 + awaiting_approval 可认领） | 集成用例：真实 DB 审批流 pending→approved→claim→succeed+consume，无第二 pending |
| 跨服务 DAG 缺失：backend 与 admin 链拼接，无 `backend-readiness → admin-deploy` 边（P0-4） | F383.3.1/5.3 done | `f93556eb`（serviceDependencies 显式声明 + 边解析） | builder spec：Picshare cross-service edge + missing_reference 错误 |
| optional backfill 出边方向错：deploy 要求 backfill `succeeded`，skipped 后永久 blocked（P0-5） | F383.3.2 done | `f93556eb`（optional backfill 出边 `completed`） | builder spec：optional-skip 矩阵（skip→deploy proceeds；fail→deploy blocked） |
| health 适配器未接线，URL 当 shell 命令执行（P0-6） | F383.5.4 done | `2ef3a638`（type-first 路由 + sanitized curl + sentinel） | 单测：URL 注入防御（`;`/反引号/`$()` 全部被单引号包含）；集成：health 完成路径 |
| retry 在 failed plan 无效（P0-7）；cancel 只改表不取消真实任务（P0-8） | F383.4.x done | `cbee6496`（事务 retry + 真实 SEJ cancel）+ `f95f9a47`（retry-vs-cancel 一致） | 集成用例：retry 重开 failed 计划 + attempt#2；cancel 调 cancelJob + 原子翻表 |
| concurrencyKey check-then-act，无原子锁（P0-9） | F383.4.1 done | `8e202f9e`（ReleaseConcurrencyLease 唯一约束表）+ `f95f9a47`（CAS 抢占替代 blind delete） | 集成用例：并发同 concurrencyKey 只一胜；stale-lease CAS 抢占；active holder 不被误删 |
| 环境分裂：选"生产"仍生成"开发" stage（UX P0-1） | F383.7.1 done | `d21ec1ba`（controller + builder 双门校验 + DTO 剥离 shell 命令） | controller spec：env mismatch 403 |
| preview/create 无 hash 绑定（UX P0-2） | F383.7.1 done | `d21ec1ba` + `f95f9a47`（expectedPlanHash 必填 + 409） | service spec：hash 不一致 409 |
| Date 被 redact 成 `{}`，页面 NaN（UX P0-3） | F383.6.3 done | `7db15f82`（Date→ISO + Buffer/Decimal 守卫） | 单测：Date→ISO；嵌套对象 secret 仍脱敏 |
| skip 由代码替用户提交固定确认文本（UX P1-4） | F383.7.4 done | `dc1ac6fb`（skip dialog 要求用户输入原因 + L3 type-to-confirm） | UI 实现 + code review 确认（CR-3-F10 genuinely fixed） |
| feature flag 主 compose 强制 true（P2-1） | F383.8.1 done | `d21ec1ba`（主 compose false + release override） | compose merge 验证：override 才 true |
| 错误分类读 err.code 但 envelope string code 被后端 filter 丢弃（CR-3-F3，比 reviewer 更深） | — | `f95f9a47`（后端 filter 保留 string code + 前端读 details.code） | nestjs-http 回归用例 + 前端 taxonomy spec |

## 2. 提交与文件清单（第二轮，10 个提交）

| 提交 | 切片 | 内容 |
| --- | --- | --- |
| `7db15f82` | 1 | 状态机 retry 转换 + 脱敏基础（Date/Buffer 守卫、64KiB 解码上限、readOutputPath 白名单、artifacts 脱敏） |
| `f93556eb` | 2 | cross-service DAG + optional backfill 出边 + branch/commitSha/gitRepo 透传 + idempotencyKey 重算 |
| `38d7cac7` | 3 | 审批生命周期：stage-bound、lazy、denied→blocked、re-request-approval 路由 |
| `8e202f9e` | 4 | 原子 stage claim + ReleaseConcurrencyLease 唯一约束 + migration `20260727120000` |
| `79a467c0` | 5 | 完成回调 port（RELEASE_COORDINATOR_PORT）+ release-stage run-sync + recovery scheduler |
| `cbee6496` | 6 | 事务 retry + 真实 SEJ cancel（cancel 是逃生通道，flag off 仍可用） |
| `2ef3a638` | 7 | health 探针（sanitized curl）+ logSummary 集中脱敏 + toLogsText 修复 |
| `d21ec1ba` | 8a | env 一致性 + preview/create hash 绑定 + git-ref 解析 + capability API + compose flag |
| `dc1ac6fb` | 8b | 新手发布控制台 UI（577 行 monolith 拆为 23 个 <200 行聚焦文件） |
| `f95f9a47` | CR | 对抗式 CR 修复：approval approved-latest、awaiting_approval 可认领、lease CAS 抢占、finalize/recompute CAS、empty-services 拒绝、error taxonomy 双侧修复、git arg injection、retry-vs-cancel、owner-scoped lease release、usableApprovalId inputHash 复核 |

新增/重写模块（`apps/devpilot-api/src/release-orchestration/`）：coordinator（claim/finalize CAS）、stage-claim service、concurrency-lease repository、recovery-scheduler、approval-lifecycle service、approval-predicate utils、cross-service-edges utils、health-check adapter + curl utils、git-ref utils、env-validation utils、service-config utils、plan-access service、coordinator port。
新增前端（`apps/devpilot-web/.../projects/[id]/`）：releases-tab（thin host）+ 10 个聚焦组件 + 3 个 hooks + 6 个 utils + 扩展 types。
新增共享库修复：`packages/nestjs-http/src/filters/http-exception.filter.ts`（保留业务 string code）+ 首个 nestjs-http 测试。

## 3. 验证证据（真实，可复现）

### 3.1 自动化测试（日志：`/tmp/codex-tool-runs/svton/f383-fix/cr-fixes/`）

| 套件 | 结果 | 关键覆盖 |
| --- | --- | --- |
| `release-coordinator.integration.spec.ts`（真实 MySQL 8 :3399） | **22 passed** | 完整成功链、migration 失败、bootstrap 幂等、backfill skip、health 完成、**真实 DB 审批流 pending→approved→claim→succeed+consume**、API 重启恢复、retry、cancel、并发认领只一胜、并发同 concurrencyKey、CAS-lost 无孤儿、stale-lease CAS 抢占、finalize-vs-cancel 一致、retry-vs-cancel 一致、finalizeAndAdvance 幂等、scheduler runOnce/skip |
| release-orchestration + operation-approval 单测 | **212 passed** | DAG 分支/汇合/缺失/重复/自依赖/环、optional skip 矩阵、状态机合法转换、output_match 白名单、脱敏（Date/Buffer/Decimal）、64KiB、approval predicate、env validation、git-ref argv `--`、error taxonomy envelope codes、buildHealthCheckCurlCommand 注入防御 |
| API type-check | exit 0 | — |
| Web type-check / lint / build | 全 exit 0 | 24 路由静态生成成功 |
| nestjs-http build + test | build exit 0 / 3 passed | GlobalExceptionFilter 保留 string code 回归 |

### 3.2 数据库迁移

- `20260727100000_release_orchestration`（5 表 + OperationApproval.inputHash）+ `20260727120000_release_concurrency_lease`（并发租约唯一约束 `release_concurrency_lease_key`）在一次性 MySQL 8 `prisma migrate deploy` 成功（`slice4/migrate.log`）。
- `prisma validate` 通过；schema 与迁移 SQL 一致（CR-1 migration 审核确认）。

### 3.3 对抗式 CR 证据

3 个只读 reviewer（concurrency/approval/UI）+ 1 个 architect 裁定（`cr-consolidated.md` / `cr-fix-spec.md`）。所有 P0/P1 已修复并由新增集成用例证明。CR-3-F3（error taxonomy）经 architect 深挖发现后端 filter 丢弃 string code 的根因，双侧修复。

## 4. 兼容性

- `POST /deployments/projects/:projectId/runs` 行为不变；公共 controller 剥离 `releaseApplicationOnly`。
- feature flag 默认 `false`（主 compose）；`docker-compose.devpilot-app.release.yml` override 用于本地验证。
- 关闭只阻止创建/推进新计划（preview/create/execute/retry/skip/re-request-approval 均 `requireEnabled`）；**cancel 是逃生通道，flag 关闭时仍可用**（capability API `canCancel:true`）；历史可读。
- `releaseApplicationOnly` 仅由 release 模块内部调用；旧 F382 串行前置阶段不变。

## 5. 仍需外部环境/生产权限才能验收的事项（如实声明，**不在本任务完成定义内**）

1. **真实浏览器 Picshare 端到端截图取证（F383.9.3，进行中）**：本轮返工期间 Docker Desktop 存储损坏（`failed to create temp dir: read-only file system` + `input/output error` on `/var/lib/desktop-containerd`），导致：
   - 无法重建 `devpilot-app-api`/`devpilot-app-web` 镜像（构建编译通过，export 阶段失败）。
   - 原运行的 `devpilot-app-api` 容器（旧镜像）因 `devpilot-g003-api-mysql` 已 exited 而 P1017 crash-loop；重启 staging infra 后仍因 Docker daemon 挂起未恢复。
   - 一次性 MySQL :3399（集成测试用）在 daemon 挂起后不可达（TCP probe 失败）。
   代码侧主链已由 22 真实 MySQL 集成用例证明，但浏览器 GUI 全流程（创建→preview→审批→执行→失败诊断→retry→刷新恢复→日志查看）截图取证需要先修复 Docker Desktop（`docker system prune -af --volumes` 或重启 Docker Desktop 重建存储后重新 `docker compose -f docker-compose.devpilot-app.yml -f docker-compose.devpilot-app.release.yml up -d --build`），再以真实浏览器在 `localhost:3120` 走完 Picshare 参考流。截图计划保存到 `/tmp/codex-tool-runs/svton/f383-final/`。
2. **真实 SSH/Server Agent 执行**：本地用的是 fake ServerExecutor + sanitized curl 命令构造；`ssh-live` adapter 在真实目标主机上对每个命令阶段的端到端执行未在本地完成（Picshare 契约的 `docker compose ... run --rm backend node dist/prisma/bootstrap.js` 等需真实 Docker-in-Docker 目标）。
3. **真实生产数据库迁移**：只验证了一次性 MySQL；生产库需 DBA 按变更窗口执行。
4. **真实审批工单流与通知通道**：审批与 OperationApproval 集成代码已就绪（含 inputHash 绑定/失效/consume），但与团队真实审批人/通知通道的端到端流未在生产环境验证。

## 6. 与第一轮报告的差异（如实更正）

第一轮报告（`release-orchestration-final-report.md` 旧版本）称：
- "跨服务 readiness 门禁、optional skip、inputHash、权限与恢复均通过" — **与源码事实不符**（审计 P0-4/P0-5/P0-3 已证伪）；本轮已修复并验证。
- "实时 API 验证 preview/create/execute" — 只证明 attempt/job 创建，**未证明 stage/plan 完成**（P0-1/P0-2）；本轮集成用例证明完整链。
- "F383.9.3 浏览器全流程 done" — **与最终报告自己记录的"浏览器 GUI 未完成"矛盾**；本轮据实改为 in-progress（阻塞于 Docker 存储）。
- "89 个纯函数测试通过即完成" — **不足以证明主链**（审计 P1-8 指出所谓 integration spec 默认 skip 且不实例化 coordinator）；本轮 integration spec 实例化真实 ReleaseCoordinatorService + 真实 MySQL + fake adapters，22 用例覆盖全部 P0/P1 场景。

## 7. 完成定义对照

| 完成定义项 | 状态 | 证据 |
| --- | --- | --- |
| 真实 Picshare 发布可从页面完成，不需手工构造 API fixture | **阻塞**（Docker 存储） | 代码侧集成用例证明主链；浏览器端到端待 Docker 恢复 |
| 不存在 plan/stage/attempt/job 状态矛盾 | **done** | finalize/recompute CAS + 集成用例 finalize-vs-cancel/retry-vs-cancel |
| 不存在生产计划生成开发阶段 | **done** | controller + builder 双门 env 校验 |
| 数据阶段不会重复执行 | **done** | findSucceededByStage + idempotencyKey persist 重算 + 集成用例 |
| 审批、恢复、retry、cancel、health check 真实闭环 | **done** | 22 集成用例（真实 DB 审批流、SEJ 完成回调、retry、cancel、health） |
| 页面提供完整日志和证据 | **done（代码）** | UI 拆分实现全部字段；浏览器像素级取证待 Docker 恢复 |
| feature flag 默认关闭 | **done** | 主 compose false + release override |
| F383 TODO 仅在真实浏览器/API/数据库验收通过后才标记 done | **部分** | API/数据库 done；浏览器 in-progress（据实标记） |
| 更新最终报告，区分本地真实验证与仍需生产权限的事项 | **done** | 本报告第 5 节 |
| 工作区干净，所有本任务改动已提交 | **done** | `git status` clean；10 提交未 push |
| 最终报告提交 ID、验证命令、日志/截图路径和剩余外部风险 | **done** | 本报告第 2/3/5 节 |
| 不因纯函数测试/type-check/lint/build 通过就提前宣称完成 | **done** | 本报告未据此宣称完成；浏览器流据实标 in-progress |

## 8. 验证命令（可复现）

```bash
# 一次性 MySQL（需 Docker Desktop 存储正常）
docker run -d --rm --name svton-mysql-rel -e MYSQL_ROOT_PASSWORD=x -e MYSQL_DATABASE=rel -p 3399:3306 mysql:8
DATABASE_URL="mysql://root:x@localhost:3399/rel" npx prisma migrate deploy --schema apps/devpilot-api/prisma/schema.prisma

# 真实集成（22 用例）
cd apps/devpilot-api
DATABASE_URL="mysql://root:x@localhost:3399/rel" RUN_RELEASE_INTEGRATION=1 \
  npx jest src/release-orchestration/release-coordinator.integration.spec.ts

# 全套单测 + type-check
npx jest src/release-orchestration/ src/operation-approval/
npm run type-check
npx prisma validate --schema prisma/schema.prisma

# Web + 共享库
cd apps/devpilot-web && npm run type-check && npm run lint && npm run build
cd packages/nestjs-http && npm run build && npm test

# 浏览器（待 Docker Desktop 存储 repair 后）
docker compose -f docker-compose.devpilot-app.yml -f docker-compose.devpilot-app.release.yml up -d --build
# 然后真实浏览器访问 http://localhost:3120 走 Picshare 参考流，截图存 /tmp/codex-tool-runs/svton/f383-final/
```

日志路径：`/tmp/codex-tool-runs/svton/f383-fix/{slice1..slice8b,cr-fixes}/`、调研与 CR 产物 `invest-*.md`/`architect-decisions.md`/`cr-*.md`。

## 9. 剩余外部风险

1. **多副本/跨进程并发**：集成测试在单 Node 事件循环内 `Promise.all` 验证并发，能覆盖 MySQL 唯一约束 + CAS 的原子语义，但未模拟两个 pod 副本同时 advancePlan。`recomputePlanStatus` 的 CAS 已防御 lost-update，但生产多副本下建议加 advisory lock 或确认 scheduler 单实例部署。
2. **lease 生命周期极端窗口**：`LEASE_MS=15min`；若 SEJ 执行超过 15min 且 heartbeat 未续期（当前 release-attempt 不主动续期，依赖关联 SEJ 的 lease），recovery scheduler 会在下一 tick 回读关联 SEJ 终态而非假设失败——正确，但长任务（>15min）期间会有短暂的"看似 stale"窗口。生产长迁移建议显式调 `leaseRepo.renewWithinTx`。
3. **health 探针 `127.0.0.1` 语义**：curl 在目标主机执行（通过 ServerExecutor SSH/Agent 通道），所以 Picshare 契约的 `http://127.0.0.1:4100/...` 正确指向目标主机 loopback。若 Devpilot API pod 与目标服务不共享网络命名空间，需确保 health stage 的 ServerExecutor 目标解析正确。
4. **CI 未强制运行 integration spec**：`RUN_RELEASE_INTEGRATION=1` + `:3399` 门控意味着默认 CI 跳过整个 integration 文件。建议在 CI 加一个 throwaway MySQL job 显式开启。
5. **浏览器端到端 + 真实 SSH 执行 + 生产 DB 迁移 + 真实审批通知**：见第 5 节。

---

**结论**：F383 后端主链（数据 DAG、原子并发、审批闭环、完成回调、retry/cancel、health、env 一致性、preview/create 绑定、feature flag、脱敏/时间契约）已修复并由真实 MySQL 集成测试 + 对抗式 CR 证明；浏览器端到端截图取证阻塞于 Docker Desktop 存储损坏（环境问题，非代码缺陷），待环境修复后即可执行。未 push。
