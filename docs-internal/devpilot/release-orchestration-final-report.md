# F383 发布编排最终报告（2026-07-29 完成）

> 仓库：`/Users/zhaoxingbo/Workspace/ai-driven/svton`
> 分支：`fix/f383-release-orchestration-mainchain`
> 权威架构：`docs-internal/devpilot/release-orchestration-architecture.md`
> 本节（§0.7）是当前最终事实；§0.5 及后续旧轮次仅作历史存档。

## 0.7 最终闭环（F383 第二批，2026-07-29）

**最终结论：done。** 唯一最终可复现计划为
`cms5m7z2001ow14kkg3jg0l87`，对应 Picshare
`master@8e7c465d56e68dafcef0dfbc480fe721044b0fb3`。计划 6 个阶段全部
succeeded，关联 2 条 DeploymentRun、4 条 ServerExecutionJob；旧计划
`cms5kc2rp009z14kkn2ch9lqb` 不作为最终证据。

第二批完成两项产品化收口：

1. 发布阶段的执行任务链接变为精确定位链路。真实发布页输出：
   - `/execution-governance?jobId=cms5m8kko01rb14kksfudwxtf`，自动选中“作业”，
     服务端按 `where.id` 查询，只显示目标任务；
   - `/projects/cmrwxl1ks000k6enjiclutd5a?tab=deployments&runId=cms5m9uwe01sy14kk7u4uig00`，
     经作用域详情 API 读取，只显示并自动展开目标运行。
   两条链路对伪造 ID 都显示空态/未找到，不回退到通用最近列表。
2. 新增计划级管理员零泄漏验证 API。它覆盖 DeploymentRun、ServerExecutionJob 的
   参数/输入、命令计划、日志、结果、错误、元数据及关联日志/审计，失败时 fail-closed；
   返回与 AuditEvent 只含计数和安全定位，不含值、片段或秘密探针。

**真实零泄漏结果**：

| 项 | 结果 |
| --- | --- |
| 计划 | `cms5m7z2001ow14kkg3jg0l87` |
| 探针来源 | 运行中的 `picshare-backend` / `picshare-admin`，仅内存读取 |
| 有效探针 / 记录 / 字段 | 4 / 8 / 44 |
| verdict / findings | `clean` / 0 |
| 审计回读 | `cms5o57vz000akza17koems85`，`coverageComplete=true` |
| 秘密回显检查 | API response=false；AuditEvent=false |

首次校准扫描曾把布尔运行标志和 `secretsInOutput` 安全策略标记误判为秘密；
修正后新增回归测试并重新构建/重启真实 API。该次校准审计保留为历史，不删除或改写；
最终权威结果是上述较新的 clean 审计。

**自动化与运行证据**：

| 验证 | 结果 | 日志/证据 |
| --- | --- | --- |
| API 全量 Jest | 164 suites / 1158 tests passed；4 suites / 42 tests gated skip | `/tmp/codex-tool-runs/svton/f383-batch2-api-full-tests-post-audit-failure-20260729-140832.log` |
| API integration | 1 suite / 5 tests passed；4 suites / 42 tests gated skip | `/tmp/codex-tool-runs/svton/f383-batch2-api-integration-tests-20260729-134002.log` |
| 第二批定向测试 | 6 suites / 9 tests passed；detector 校准 2 suites passed | `/tmp/codex-tool-runs/svton/f383-batch2-targeted-*.log`、`f383-batch2-detector-tests-rerun-20260729-135005.log` |
| API/Web type-check | 两端 exit 0 | `/tmp/codex-tool-runs/svton/f383-batch2-targeted-*-typecheck.log` |
| API/Web build | 两端 exit 0；最终 Compose API/Web 健康 | `/tmp/codex-tool-runs/svton/f383-batch2-{api,web}-build-*.log`、`f383-batch2-compose-runtime-refresh-*.log` |
| 真实 API/数据库证据 | 计划、阶段关联、扫描和审计一致 | `/tmp/codex-tool-runs/svton/f383-batch2-real-evidence.json` |
| 真实浏览器 | 两个精确链接、单条聚焦、伪造 ID fail-closed | `/tmp/codex-tool-runs/svton/f383-batch2-browser-evidence.json`、`f383-batch2-*-deep-link.png` |

**剩余风险**：零泄漏验证是计划级时间点审计，不是持续写入拦截；生产多副本并发、
生产数据库变更窗口和真实审批通知仍需各自的生产运维验收，不影响本地 F383 完成定义。

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

**Docker 健康**（2026-07-28，第四轮复核）：Docker 存储损坏**已恢复**（`docker info` exit 0，storage driver = overlayfs，`docker run --rm alpine sh -c 'echo x > /tmp/t && cat /tmp/t'` 通过）；`http://localhost:3120` → 200，`http://localhost:3121/api/health` → 200；一次性 `mysql:8` 本地可用（集成测试 287 通过）。下方第 5 节"阻塞于 Docker 存储损坏"的结论为**第三轮当时事实**，第四轮已不再成立（矛盾已消除，以本行为准）。

**password live transport 闭环状态（2026-07-28 第五轮，如实声明）**：
password SSH live 主链**已真实跑通**（提交 `20d41208` 移除 adapter 对非 key auth 的硬拒绝，`ssh-credential-mapping.utils` 统一映射并 fail-closed）。新建 Picshare 发布计划 `cms4n68sw000bbdxirzcpgv1n` 的 `schema_migration`、`bootstrap` 经真实 `ssh-live` + password auth 执行**成功**（ServerExecutionJob.transport=ssh、adapterKey=ssh-live、commandPolicy.status=passed、migration 日志显示 "No pending migrations to apply"）。同时修复：`release-plan.service.create()` 误对 configSnapshot 脱敏导致 DB 密码冻结为 `[REDACTED]` 并执行期 P1000（`5ae1a4ed`）；`Ssh2Transport.execCommand` 不 drain stdout / 预先 stream.end 导致命令超时的 backpressure bug（`20d41208`）；连接测试从 TCP-only 升级为 网络/SSH 认证/执行器 三段判定（`5b2ff107`）；CLI 内联密码脱敏加固（`1880894f`）。
**历史状态（第五轮当时结论，已被 §0.7 取代）**：`application_deploy` 阶段走 `deployment_run` 执行器（非 ssh-live），当时命中 release_stage 审批 category 与 deployment 审批 category 不匹配（"审批单与本次操作不匹配: category"）；当时六阶段全绿与浏览器像素级取证尚未完成，故 F383.9.3 / F383.9.4 / F383 未标 done。

**浏览器验证状态（历史，第四轮 — IAB 点击投递阻塞结论已随第五轮 password 闭环推进而过时）**：
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

## 0.6 第四轮收尾（Item 1/2/3 + 两轮独立 CR，2026-07-28，HEAD `4f2f691f`）

第三轮 P0-1 把"畸形/缺字段/非法 stage/非法 condition"的依赖条目当作**静默跳过**处理（旧 spec
以此断言为正确）。第四轮的 Item 1 把这一行为定性为**发布安全问题**（关键依赖从 DAG 静默消失）
并改为 **fail-closed**。同轮完成 Item 2（确定性 CAS 竞态测试）与 Item 3（controller 拆分）。

| 项 | 第三轮状态 | 第四轮修复 | 真实验证 |
| --- | --- | --- | --- |
| **Item 1** 依赖解析 fail-closed | 静默跳过（旧 spec 断言为正确） | parser 返回 `{edges, errors}`，9 类错误码结构化；`ReleaseDependencyResolverService` 区分 未选/不存在/跨域（required→400、optional→warn+drop）；preview/create 共用同一路径；web 新增 `dependency_invalid` 分类 + 中文文案 | 单测覆盖 9 分支；**真实 staging API 负面 preview 返回 400 `RELEASE_PLAN_INVALID`（栈：`releaseDepErrorsToException → ReleaseDependencyResolverService → ReleasePlanOrchestratorService.preview`）**；正面 preview 含跨服务边 `health_check:backend → application_deploy:admin` |
| **Item 1 CR**（REQUEST-CHANGES） | — | B1 `dependencyIndex` 错位（parser 给存活边盖 `sourceIndex`）；B2 optional+不存在/跨域 误阻断（全部 warn+drop）；B3 跨租户 service-id 探测（无 scope 探测加 `teamId`） | 3 个新测试（optional-NOT_FOUND/CROSS_SCOPE warn、混合错误下标对齐） |
| **Item 2** 真实 stale-read CAS 竞态 | "finalize wins first" 测试只是串行 finalize-then-cancel，命中入口预检 | 新 `release-cancel-cas-race.integration.spec.ts` 用 Proxy-gated `$transaction` 固定真实交错：cancel 读 running → 暂停 → finalize 推 succeeded → cancel CAS 命中 0 行 → lost，无半取消；6 场景 | **6 场景全部通过（一次性 MySQL :3399，串行）**；CR APPROVE-WITH-NITS，4 处 nit 已应用（容并发 cancel、SEJ 终态、canceledAt、failed-plan lease） |
| **Item 3** controller <200 行 | controller 274 行（超限） | 拆出 `ReleasePlanAccessGuard`（RBAC）/ `ReleasePlanOrchestratorService`（preview-create 装配）/ `ReleaseDependencyResolverService`（依赖 fail-closed）/ `release-dep-error.utils` + `release-dep-copy.utils` + `release-service-deps.utils`；controller 收敛 274→183 行 | 所有触及生产文件 ≤200 行 |

**自动化测试（真实重算）**：287 pass（release-orchestration + operation-approval，一次性 MySQL :3399 串行 `--runInBand`）。不再引用旧报告的 268/269。

**本地真实 staging（第四轮）**：
- 一次性 MySQL :3399（集成测试）+ staging infra（13 容器全 healthy）+ app stack（api:3121 / web:3120）全部起来。
- `http://localhost:3120` → 200、`http://localhost:3121/api/health` → 200；Nest 启动 `Nest application successfully started`，**无 DI 错误、无 P1017**。
- Picshare 数据经 API 落库：项目/环境/应用/backend+admin 服务 + backend `health_check → admin application_deploy` 跨服务依赖（DB 直读确认）。
- 真实 SSH 目标 `devpilot-g003-ssh-server`（devpilot/devpilot）：`POST /servers/:id/test` → `{success:true, status:online, latency:1, 连接成功}`。
- F383 flag：`capability → {enabled:true, canCancel:true}`。

**真实 SSH/Server Executor 路径**：execute → `release_plan.executed` 事件 → 审批 5 阶段 → schema_migration 被 claim、生成 SEJ（`transport:ssh / adapterKey:ssh-live`）→ 命令被 built-in command-policy baseline 以 `no-allowlist-match` 阻断（与 `local-test-data.md` Step 6 一致，需 team 命令策略模板）。retry 路径验证：failed 计划 retry → plan running、stage running。**路径接线正确（非 fake executor）；命令实际执行被 policy 模板匹配阻断，属配置/数据问题，非 F383 代码缺陷。**

**浏览器 GUI 全流程（F383.9.3）—— 维持 blocked**：ZCode IAB 后端可用（`goto` + `domSnapshot()` 正常，登录/首页均渲染）；但 IAB 的**点击事件投递在当前环境不稳定**——登录按钮 `click()` 即使 `count()==1/isEnabled/isVisible` 也持续 `Browser broker response id mismatch`/超时；表单 submit（button type=submit 包在 form 内）的 Enter 不触发 React onSubmit；`evaluate` 注入 token 被 side-effect guard 拒绝。故无法在真实浏览器内完成 登录→创建→preview→审批→执行→失败诊断→retry→取消 的**像素级**取证。**阻塞于 IAB 交互投递（环境问题，非代码缺陷）；需换系统 Chrome/extension 后端或本地 Chromium `--browser-use=headless` 才能完成。** 本会话仅 IAB 可用。

**完成定义对照（据实，详见 `/tmp/codex-tool-runs/svton/f383-final-closure/BLOCKED-STATUS.md`）**：
代码侧 Items 1/2/3 + 两轮 CR 全部 done；287 测试 + 真实 staging API fail-closed 双证 done；
真实 SSH 路径接线 done（命令实际执行阻塞于 policy 配置）；
浏览器像素级全流程 + 真实 SSH 命令实际成功 两项 **blocked（环境/配置，非代码）**。

证据目录：`/tmp/codex-tool-runs/svton/f383-final-closure/`（`final-verification.log`、`api-evidence-summary.json`、`api-evidence.json.positive/.negative`、`browser-login-snapshot.txt`、`BLOCKED-STATUS.md`、各 `*.log`）。

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

**当前结论（2026-07-29）**：上方 §0.7 已用真实六阶段计划、精确页面链路、
平台零泄漏审计和最终自动化证据关闭 F383；本节以前的阻塞结论仅为历史。
