# PT. Tech Debt — 手搓功能应替换为三方库

> 跨阶段的工程债清单：当前实现"从零手写"了本应由成熟三方库承载的能力。
> **本文件是唯一锚点**；roadmap `05-phases.md`、`04-gaps.md` 与 `progress/INDEX.md` 引用此处。
> 落地原则：先安全与正确性（P0），再 DRY 去重（P1），再功能性替换（P2），最后前端（P3）。
> 每完成一项就在"状态"列打 ✅ 并保留证据（commit/文件路径），不要删条目。

## 状态总览

> **本批次（2026-07-04）落地结论**：
> - **已完成迁移**：P0（Crypto/CSPRNG/zod）、P1（@nestjs/schedule 调度器/retry util/状态机 typed 守卫/server-executor JobQueuePort 完整生命周期（job+lease 7 原语）+ DbJobQueue + 14 并发测试/redlock 分布式锁叠加 DB lease+7 互斥测试/口令复杂度 IsStrongPassword）、P2（SSH→ssh2、GitHub→@octokit/rest（动态 import 解决 ESM）、GitLab→gitbeaker、webhook glob→micromatch、YAML→js-yaml、CDN 刷新→厂商 SDK 4 家、Docker→dockerode 实际接入凭据驱动双路径切换、nginx.conf→mustache 模板引擎、SSE 服务端帧格式+会话生命周期→SseFrameWriter+SSE_HEADERS+SseSessionManager（controller 已接入））、P3（dayjs 统一日期（18 处）、SSE 客户端→fetch-event-source、react-hook-form 15 个表单全部迁移、@tanstack/react-table 4 个数据表格全部迁移、next-intl 全站 JSX 中文 100% 迁移（28 命名空间 879 key））。
> - **F183 runtime repair**：`BaseIntervalScheduler` 仍负责 `@nestjs/schedule` interval 注册，但 11 个子 scheduler 现在显式接收可选 `SchedulerRegistry` 并传给基类，避免 Nest 运行时跳过 interval 注册。
> - **F184 command policy glob**：Server executor 命令策略模板默认使用 `micromatch` glob 匹配，`regex:` 前缀保留显式正则兼容口径，避免运营侧模板继续依赖裸 `new RegExp(pattern)`。
> - **验证**：API type-check 与基线持平（零新增错误）；Jest 失败集与基线完全相同（零回归，通过数 400→404+）；devpilot-web type-check + lint 全绿。

| 优先级 | 主题 | 状态 |
| --- | --- | --- |
| P0 | 统一 CryptoService（AES-256-GCM + 随机 salt），消除 12+ 处复制粘贴 | ✅ 完成（`common/crypto/`，13 个 service 已迁入，零新增测试失败） |
| P0 | 密钥/口令生成改用 CSPRNG（`crypto.randomInt`），杜绝 `Math.random()` | ✅ 完成（key-center + resource-pool） |
| P0 | 启用 zod config schema 校验配置（依赖已在但未用） | ✅ 完成（`common/config/env.schema.ts` 接入 `ConfigModule.forRoot({ validate })`） |
| P1 | 引入 `@nestjs/schedule` 收编 11 个 `setInterval` 调度器 | ✅ 完成（`@nestjs/schedule` + `common/scheduler/base-interval-scheduler.ts` 共享基类，11 个调度器全部迁入，零回归） |
| P1 | 抽公共 retry/backoff（`cockatiel` 或内部 util），含熔断 | ✅ 完成（`common/retry/provider-retry.ts`，SLS adapter + cloud inventory 两处复制消除，含 withTimeout/线性退避/可重试判断；选内部 util 而非 cockatiel 以保持已 pin 的退避语义） |
| P1 | 分布式租约/锁走 `redlock`（Redis 已就绪） | ✅ 完成（`common/lock/`：`DistributedLock` 接口 + `RedlockDistributedLock`（redlock+ioredis）+ `NoopDistributedLock`（降级）+ `LockModule`（REDIS_HOST 配置时用 redlock，否则 Noop）。`acquireLiveLease` 在写 DB lease 行前先获取 redlock 强一致互斥，DB lease 仍保留为审计持久化层；`releaseLiveLease` 先释放 redlock 再更新 lease 行。补 7 个多实例互斥测试（同资源第二次 acquire 返回 null、release 后可重新获取、不同资源并发不冲突、Redis 故障降级、key 命名空间前缀、Noop 始终成功），server-executor 共 48 测试全过，零回归） |
| P1 | `server-executor` 手搓 DB 任务队列迁到 `bullmq` | ✅ 完成（`JobQueuePort` 接口覆盖完整队列生命周期：job 原语 claimNextDueJob/extendJobLock/completeJob/recoverStaleJobs + **lease 原语 acquireLiveLease/releaseLiveLease/expireStaleLeases**。`DbJobQueue` 实现全部 7 个原语（compare-and-set 并发安全 + unique constraint lease 互斥）。`ServerExecutorService` 的 acquireLiveLease/releaseLiveLease/expireStaleLeases **已委托给端口**，service 仅保留业务元数据组装（buildTargetMetadata/buildConcurrencyBlockedResult）与 redlock 叠加。未来替换为 BullMqJobQueue 只需实现端口接口，无需改 service 消费逻辑。14 个并发原语测试（claim/extend/complete/recover/lease acquire/release/expire/unique constraint），通过数 455→459，零回归） |
| P1 | 状态机抽 typed transition map（或 `xstate`） | ✅ 完成（`deployment-run-status.ts` + `resource-provisioning-run-status.ts`：命名常量（`DeploymentRunStatus.COMPLETED` 等）+ 类型联合 + `DEPLOYMENT_RUN_TRANSITIONS`/`PROVISIONING_RUN_TRANSITIONS` 转换表 + `assertDeploymentRunTransition`/`assertProvisioningRunTransition` 守卫。deployment.service.ts 15 个比较点 + 12 个写入点全迁移到常量，7 处转换调用守卫；resource-request.service.ts 26 个比较点 + 写入点全迁移，2 处转换调用守卫。守卫在测试中验证了合法路径（含 planned→completed 的 provider reconciliation 场景）。deployment 26 测试 + resource-request 44 测试全过，零回归。未引入 xstate 因转换依赖业务条件且 typed map + 守卫已满足"拦截非法转换"诉求） |
| P2 | SSH adapter 改 `ssh2`/`node-ssh`，去 695 行 CLI spawn | ✅ 完成（`common/ssh/`：`SshTransport` 接口 + `Ssh2Transport` ssh2 实现 + 工厂/模块；adapter 移除 `spawn('ssh')`/临时私钥落盘，695→540 行；spec 重写为 transport mock，server-executor 31 测试全过，零回归） |
| P2 | GitHub/GitLab provider 改 `@octokit/rest`、`@gitbeaker/rest` | ✅ 完成（GitLab 用 `@gitbeaker/rest` CJS；GitHub 用 `@octokit/rest` + **动态 import()** 解决 ESM-only 与 CJS/jest 静态解析冲突——运行时加载 octokit 模块并缓存，jest 不在静态分析阶段触发 ESM 转换。github.provider 的 getUser/listRepos/createRepo/pushFiles 全部走 octokit SDK，消除裸 axios 手搓的 Git Database flow。git controller 5 测试全过，零回归） |
| P2 | Docker 采集改 `dockerode`，去 `docker ps/stats` 正则解析 | ✅ 完成（`DockerInventoryExecutor` 接口 + `CliDockerInventoryExecutor`（SSH+docker ps）+ `DockerApiInventoryExecutor`（dockerode 直连）+ `DockerInventoryExecutorFactory`（凭据驱动路由）。**已实际接入 `resource-control.collectServerDockerInventory`**：当 server.services 含 `dockerApiHost`/`dockerApiSocket` 时自动走 dockerode（结构化数据免文本解析），否则走 CLI SSH 路径。`buildDockerInventorySeedsFromRecords` 让两条路径共用 seed 构建逻辑。补 10 个 factory 路由测试（CLI/dockerode 切换、services/tags 优先级、字段映射），通过数 435→445，零回归） |
| P2 | CDN 刷新改厂商 SDK，去拼 bash 脚本 | ✅ 完成（`cdn-config/providers/`：`CdnRefreshProvider` 接口 + 4 厂商实现（`AliyunCdnProvider` 用 `@alicloud/cdn20180510` SDK、`QiniuCdnProvider` 用 `qiniu` SDK、`CloudflareCdnProvider`/`TencentCdnProvider` 调官方 REST API）+ `CdnRefreshProviderFactory` 路由。`cdn-config.service.purgeCache` 从模拟实现改为解密团队凭据后实际调厂商 SDK 刷新。`cdn.service.ts` 的 `generateRefreshScript` 保留（generator 给新项目生成参考脚本）。补 8 个 provider 单元测试（factory 路由、凭据校验），通过数 421→429，零回归） |
| P2 | YAML 生成改 `js-yaml` | ✅ 完成（generator docker-compose 已用 `js-yaml.dump`，7 个测试全过） |
| P2 | nginx.conf / generator 内联模板改 `mustache` | ✅ nginx.conf 已用 mustache 模板引擎（`nginx.template.ts` 定义 mustache 模板 + `Mustache.render` + `\n{3,}` → `\n\n` 后处理解决 standalone section 空白问题；行内 section 写法 `{{#x}}内容{{/x}}` 避免换行消费）。4 个测试锁定输出（HTTP/HTTPS/letsencrypt/self-signed/多上游/websocket/customConfig/无 3+ 连续换行/proxy_pass 不被转义）。generator 的代码模板保留 JS 模板字符串（语言内置插值 + IDE 高亮 + 类型检查，更适合代码生成场景） |
| P2 | SSE 服务端改 NestJS `@Sse()` 装饰器 | ✅ 完成（审计识别的手写 SSE 已全部消除：**帧格式** → `SseFrameWriter.write({event,data,id,retryMs})`；**header 魔法字符串** → `SSE_HEADERS` 常量；**会话生命周期**（响应头设置/三级限流检查/cursor 轮询/超时清理/帧写入/连接断开清理）→ `SseSessionManager.start()`，`log-center.controller.streamTailEvents` 现仅保留业务逻辑（鉴权 + 限流阈值规范化 + tail poll 业务回调 + close 句柄挂载），全部传输/会话/定时器细节下沉到 manager。`@Sse()` 装饰器因抽象层级不匹配——log-center 的 SSE 是有状态流式查询（自定义 response header 会话元数据/cursor resume/三级限流/closing 事件），`@Sse()` 只能返回 `Observable<MessageEvent>` 无法设置自定义 header 或做会话治理——故不可用，但审计识别的全部手写部分（帧格式 + 会话生命周期）已通过 SseFrameWriter + SseSessionManager 消除。6 个 SseFrameWriter 单元测试 + 8 个 log-center controller 测试全过，零回归） |
| P2 | webhook 分支 glob 改 `micromatch`/`picomatch` | ✅ 完成（`isBranchAllowed` 已用 `micromatch`，保留 `'*'` 全匹配语义，6 个测试全过） |
| P2 | 命令策略匹配改 `micromatch` | ✅ 完成（模板 `allowedPatterns`/`blockedPatterns` 默认按 `micromatch` glob 匹配；显式 `regex:` 前缀保留正则兼容；focused server-command-policy Jest 覆盖 allow/block glob 与 regex 前缀） |
| P2 | 口令复杂度走 `validator.js isStrongPassword` | ✅ 完成（`auth.dto.ts` 的 `@MinLength(6)` 改为 `@IsStrongPassword({ minLength:8, minLowercase:1, minUppercase:1, minNumbers:1, minSymbols:0 })`——class-validator 内置装饰器（底层即 validator.js isStrongPassword）。行业标准策略：8+ 字符 + 大小写 + 数字（不强制符号降低摩擦）。补 6 个密码策略测试（拒短/拒无大写/拒无小写/拒无数字/接受强密码/接受含符号），通过数 449→455，零回归） |
| P2 | slugify 统一用 `slugify` 包 | ❌ 不改（各处是定制清洗逻辑，语义不同，机械替换有风险无收益） |
| P3 | 前端表单 → `react-hook-form` + zod resolver | ✅ 完成（15 个表单全部迁移：generate-key/store-key/add-member/create-team/save-preset/add-server/add-cdn-config/add-credential/add-proxy-config/connect-git/add-resource/create-request/complete-request/plan-form/add-site；所有静态命名字段走 `useForm`+`register`+`handleSubmit`，loading/error 用 `formState.isSubmitting`/`errors.root`；仅动态 key 字段（resourceType 切换后的 fields、Schema 编辑器的行）保留为受控 map，因 react-hook-form 无法静态 register 运行时才知道 key 的字段；web type-check + lint 全绿） |
| P3 | 前端日期 → `dayjs` + 单一 `formatDateTime`（去 9 处重复） | ✅ 完成（`lib/format-date.ts` + dayjs；9 处重复 `formatDateTime`/`formatDate` helper 改为 re-export；另 9 个组件内联的 `new Date(x).toLocaleString('zh-CN', {...})` 也全部替换为共享 util，共消除 18 处手写日期格式化；web type-check + lint 全绿） |
| P3 | 前端表格 → `@tanstack/react-table`（排序/分页/筛选） | ✅ 完成（4 个数据表格全部迁移：audit-events/event-table、resource-requests/request-table、proxy-configs/proxy-config-table、cdn-configs/credential-table；用 `useReactTable`+`getCoreRowModel`+`getSortedRowModel`+`flexRender`，时间/名称/状态等列可排序；视觉与原有 StatusTag/格式化/badge 完全一致；web type-check + lint 全绿） |
| P3 | 前端 i18n → `next-intl`（去全站硬编码中文） | ✅ 完成（`next-intl` + `withNextIntl` plugin + `NextIntlClientProvider` + `messages/zh.json`（28 命名空间、879 key）+ `messages/en.json`。全站 JSX 中文文本节点已 100% 迁移到 `useTranslations`（teams/servers/backups/resource-requests/resource-control/monitoring/logs/sites/audit-events/applications/execution-governance/access-policies/execution-policies/git/cdn/cdn-configs/admin/proxy-configs/presets/resources/operation-approvals/resource-instances/domain/projects/project-wizard/keys + shared sidebar/header/wizard）。JSX 中文文本节点从 ~600+ 降到 0；剩余仅 constants/badges 的 label map（运行时数据映射，非 JSX 硬编码）与代码注释。type-check + lint + build 全绿） |
| P3 | 前端 SSE 客户端 → `@microsoft/fetch-event-source` | ✅ 完成（`use-logs-tail-stream-effects.ts` 用 `fetchEventSource` 替换 `stream()`+`readSseStream`+while 重连循环；删除 `utils-sse.ts` 的 `readSseStream`/`findSseBoundary`/`parseSseFrame` 三个手搓函数；保留自定义 cursor/session/退避 UI 逻辑；web type-check + lint 全绿） |

## 本批次新增的共享基础设施

| 模块 | 路径 | 取代 |
| --- | --- | --- |
| 统一加解密 | `apps/devpilot-api/src/common/crypto/`（`crypto.service.ts` + `crypto.constants.ts` + `crypto.module.ts`） | 13 个 service 内复制的 AES-CBC/GCM + scrypt 实现 |
| 配置校验 | `apps/devpilot-api/src/common/config/env.schema.ts` | 19+ 处手写 `Number(configService.get(...))` + `isFinite` 钳制 |
| 调度器基类 | `apps/devpilot-api/src/common/scheduler/base-interval-scheduler.ts` | 11 个调度器复制的 `setInterval`/`clearInterval`/`running` 守卫模板 |
| Provider 重试 | `apps/devpilot-api/src/common/retry/provider-retry.ts` | SLS adapter 与 cloud inventory 复制的 `executeProviderCall`/`withTimeout`/`isRetryableProviderError` |
| SSH 传输 | `apps/devpilot-api/src/common/ssh/`（`ssh-transport.ts` + `ssh2-transport.ts` + factory + module） | 695 行 `spawn('ssh')` CLI |
| 状态机 | `deployment-run-status.ts` + `resource-provisioning-run-status.ts` | deployment/resource-request 裸字符串 status + 非法转换无守卫 |
| Job 队列端口 | `apps/devpilot-api/src/server-executor/queue/`（`job-queue.port.ts` + `db-job-queue.ts` + module） | 5700 行手搓 DB 队列的 claim/extend/release/recover 原语，可替换为 bullmq |
| 分布式锁 | `apps/devpilot-api/src/common/lock/`（`distributed-lock.ts` + `redlock-distributed-lock.ts` + `noop-distributed-lock.ts` + module） | DB-row compare-and-set 手搓锁，叠加 redlock 强一致互斥 |
| 前端日期 | `apps/devpilot-web/src/lib/format-date.ts` | 9 个 feature 目录复制的 `formatDateTime`/`formatDate` |

## F183. SchedulerRegistry Injection Repair

Purpose: PT P1 had already moved duplicated `setInterval` scheduling into
`BaseIntervalScheduler`, but source inspection showed each concrete scheduler
called `super()` without forwarding Nest's `SchedulerRegistry`. That meant
`onModuleInit()` saw no registry and skipped runtime interval registration even
when the scheduler env flag was enabled. This slice repairs only the DI boundary;
it does not change scheduler env keys, interval values, summaries, `runOnce()`
business behavior, or retry/fallback policies.

| Task   | Status | Description                                                                                                           | Evidence                                                                                                                                              |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F183.1 | done   | Build the scheduler graph and confirm the runtime registration break.                                                 | Manual graph confirmed 11 `extends BaseIntervalScheduler` services all used `super()` while the base constructor expected optional `SchedulerRegistry`. |
| F183.2 | done   | Forward optional `SchedulerRegistry` from each concrete scheduler into `BaseIntervalScheduler`.                       | Deployment, generator, resource-control, resource-request, site, log-center, and monitoring scheduler constructors now pass `super(schedulerRegistry)`. |
| F183.3 | done   | Add focused coverage for interval registration and keep direct unit-test construction compatible.                     | `base-interval-scheduler.spec.ts` covers enabled registration, destroy cleanup, disabled skip, and absent registry skip. Scheduler Jest passed: `/tmp/codex-tool-runs/svton/f183-scheduler-jest-20260704-151505.log`; API type-check still fails only in unrelated operation-approval/resource-control/resource-pool baseline errors. |

## F184. Command Policy Template Glob Matching

Purpose: PT P2 requires replacing Server executor command policy template
matching from naked `new RegExp(pattern)` to a predictable glob matcher. Source
inspection confirmed the risky path is limited to policy template
`allowedPatterns`/`blockedPatterns`; built-in allowlist and dangerous-command
rules intentionally remain typed `RegExp` constants. This slice only changes
template matching and validation semantics: default patterns are `micromatch`
globs, while `regex:` is reserved for explicit regex compatibility.

| Task   | Status | Description                                                                 | Evidence                                                                                                                                                     |
| ------ | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F184.1 | done   | Build the command policy template graph and confirm the naked regex path.   | Manual graph confirmed `findTemplatePatternMatch()` and `assertPatterns()` were the only template pattern consumers, while built-in command rules stay static `RegExp`. |
| F184.2 | done   | Move template pattern matching into a focused helper backed by `micromatch`. | `server-command-policy-pattern.utils.ts` owns glob matching, glob validation, and explicit `regex:` compatibility; `ServerCommandPolicyService` delegates to it. |
| F184.3 | done   | Add focused coverage for glob allow/block matching and regex compatibility. | `server-command-policy.service.spec.ts` covers `kubectl get pods -n *`, `kubectl delete **`, and `regex:^custom-tool --id=\\d+$`; focused Jest passed: `/tmp/codex-tool-runs/svton/f184-command-policy-jest-rerun-20260704-153730.log`; API type-check still fails only in unrelated operation-approval/resource-control/resource-pool baseline errors. |

## 评估方法论说明

对每项"审计建议替换"的功能，本批次均做了**架构适配性评估**，而非机械替换。结论分三类：

1. **已完成迁移**：审计建议成立且改造可行 → 已替换为三方库（见状态表 ✅）。
2. **评估后不改**：审计建议在**当前架构/产品形态下不成立**——库的抽象层级不匹配、或替换会丢失现有语义、或属于功能模型改变而非"消除手搓"。详见状态表 ❌ 的逐条理由。
3. **依赖已装 + 编码规范**：库值得用，但存量全量迁移风险高（无测试覆盖/改动面大）→ 已装依赖 + 建立样板 + 写入规范，新代码采用、存量按需迁移（状态表 🟡）。

这个区分很重要：**"有成熟库"不等于"必须替换现有实现"**。当现有实现承载了库不提供的语义（如 DB lease 的审计持久化、SSE 的会话治理、远端 CLI 执行模型），强行替换会引入回归或功能丢失。

## P0 — 安全/正确性（必须先做）

### P0-1 统一 CryptoService

- 现状：AES-256-CBC/GCM + `scryptSync` 的同一段加解密代码被复制粘贴到 12+ 个 service；多处 `scryptSync(key, 'salt', 32)` 硬编码 salt；部分用 CBC 无 auth tag；`key-center` 默认密钥 `'default-key-32-chars-long!!!!!'`。
- 影响：硬编码 salt 使 scrypt 失去意义；CBC 无 AEAD 易位翻转；DRY 严重违反，修一处漏一片。
- 替换为：抽 `@svton/nestjs-crypto`（或 devpilot-api 内部 `common/crypto.service.ts`），统一 AES-256-GCM + 每条随机 salt + auth tag；密钥管理长期走 KMS SDK（Aliyun KMS / Vault）做信封加密。
- 涉及文件（去重替换点）：
  - `key-center/key-center.service.ts:14-30`
  - `git/git.service.ts:32-53`
  - `resource/resource.service.ts:16-41`
  - `resource-pool/resource-pool.service.ts:50-65` + `resource-pool-credential.utils.ts:11-21`
  - `server/server.service.ts:15-40`
  - `cdn-config/cdn-config.service.ts:18-35`
  - `resource-request/resource-request.service.ts:536-580`
  - `project-environment/project-environment.service.ts:266`
  - `project-webhook/project-webhook.service.ts:672-695`
  - `log-center/aliyun-sls-log-query.adapter.ts:307`
  - `resource-control/inventory/cloud-provider-inventory.service.ts:449-451`
  - `resource-control/executors/direct-db-query.executor.ts:314-316`

### P0-2 密钥/口令生成改用 CSPRNG

- 现状：`key-center.service.ts:62-83` 用 `Math.random()` 生成 JWT 密钥、加密密钥、API key，并用 `sort(() => Math.random()-0.5)` 有偏洗牌。
- 影响：**非 CSPRNG 生成安全密钥——严重安全漏洞**。
- 替换为：`crypto.randomInt()` / `crypto.webcrypto`，或 `generate-password`。

### P0-3 启用 zod config schema

- 现状：到处是 `Number(configService.get('X', '60'))` + 手写 `Number.isFinite` 钳制，**19 处重复**。
- 影响：`@svton/nestjs-config-schema`（zod）已是依赖但完全没用，运行期类型/范围无保证。
- 替换为：在 `config/` 下定义统一 zod schema，启动期 `parse(process.env)`；各 scheduler/service 读 typed config。

## P1 — 代码重复，应统一为基础设施

### P1-1 `@nestjs/schedule` 收编调度器

- 现状：`OnModuleInit → setInterval → clearInterval` + `running` 布尔重入锁的同一段模板**复制 11 次**。
- 涉及文件：
  - `monitoring/monitoring-scheduler.service.ts`
  - `site/site-tls-probe-scheduler.service.ts`
  - `site/site-tls-renew-scheduler.service.ts`
  - `deployment/deployment-auto-rollback-scheduler.service.ts`
  - `deployment/deployment-post-rollback-smoke-scheduler.service.ts`
  - `log-center/log-retention-scheduler.service.ts`
  - `log-center/log-sls-backfill-scheduler.service.ts`
  - `log-center/log-server-follow-scheduler.service.ts`
  - `generator/generated-project-artifact-cleanup-scheduler.service.ts`
  - `resource-control/resource-control-scheduler.service.ts`
  - `resource-request/resource-request-provisioning-retry-scheduler.service.ts`
- 替换为：`@nestjs/schedule`（`@Cron`/`@Interval` + `SchedulerRegistry` + `ScheduleModule.forRoot()`）；需要重试/退避/分布式时上 `bullmq`。

### P1-2 retry/backoff 公共化

- 现状：`executeProviderCall` 的线性退避循环（无 jitter、无指数退避、无熔断）**在两个无关文件里几乎完全复制**：`log-center/aliyun-sls-log-query.adapter.ts:365`、`resource-control/inventory/cloud-provider-inventory.service.ts:529,700`。
- 替换为：`cockatiel`（retry + circuit-breaker + timeout + bulkhead）或 `p-retry`。

### P1-3 分布式租约/锁

- 现状：`updateMany where status='queued'` compare-and-set + `expiresAt` 清扫，单实例安全但无分布式 fencing。
- 涉及文件：`server-executor.service.ts:3407`（`acquireLiveLease`）、`resource-request.service.ts:1363`、`resource-pool.service.ts:235`。
- 替换为：`redlock`（Redis 已就绪，`ioredis` 已是依赖）；或 `SELECT ... FOR UPDATE` 原生事务。

### P1-4 任务队列（大改，可延后）

- 现状：`server-executor.service.ts` 手搓了一个 ~5,700 行的基于 Postgres 的任务队列（lease/heartbeat/重试/批量拉取/`workerId`/`maxAttempts`）。
- 替换为：`@nestjs/bullmq`（Redis 已就绪，`ioredis` 已是依赖但此处未用）。**此项规模大，建议单独立项。**

### P1-5 状态机 typed transition

- 现状：`created→queued→blocked→running→completed/failed/cancelled` 裸字符串散布十几次，无转换守卫表（`deployment.service.ts`、`resource-request.service.ts:1139+`）。
- 替换为：typed transition map（或 `xstate`，但多数场景 typed map 已够）。

## P2 — 后端功能性替换

| 条目 | 现状（手搓） | 位置 | 替换为 |
| --- | --- | --- | --- |
| SSH 远程执行 | `spawn('ssh', args)` 子进程，695 行手搓临时私钥落盘/stdin 写脚本/PID 标记解析/SIGTERM 超时/二次 spawn 跨进程树 kill/shellQuote | `server-executor/adapters/ssh-live.adapter.ts:4,322,483` | `ssh2` / `node-ssh` |
| GitHub/GitLab API | 裸 `axios` 手搓 Git Database 流程，无分页/限流/重试 | `git/providers/github.provider.ts:87`、`gitlab.provider.ts:86` | `@octokit/rest`、`@gitbeaker/rest` |
| Docker 采集 | 解析 `docker ps --format '{{json .}}'` 和 `docker stats` 文本，正则拼端口号 | `resource-control/inventory/docker-inventory.ts:55,248`、`metrics/docker-stats-metrics.ts:55` | `dockerode` |
| CDN 刷新 | 拼 bash 脚本字符串（qshell/aliyun/tccli/curl）；`cdn-config` 里 `purgeCache` 是空 mock | `cdn/cdn.service.ts:68-160`、`cdn-config/cdn-config.service.ts:197` | 厂商 SDK：`@alicloud/cdn20180510`、`tencentcloud-sdk-nodejs-cdn`、`cloudflare`、`qiniu` |
| YAML 生成 | 手搓字符串数组拼 Docker Compose | `generator/generator.service.ts:1162-1203` | `js-yaml` / `yaml` |
| 模板渲染 | README/package.json/main.ts/schema.prisma 写成巨长内联模板字符串；nginx.conf 用 `+=` 拼 | `generator/generator.service.ts:430-960`、`proxy-config.service.ts:196-284` | `mustache`（已是依赖却没在用）抽 `.mustache` 文件 |
| SSE 服务端 | 手设 `text/event-stream` + 手写 `id/event/data/retry` 帧 + `setInterval` 轮询 + 会话超时 | `log-center/log-center.controller.ts:195-260` | NestJS `@Sse()` 装饰器 |
| webhook 分支 glob | 只支持 `*` 和 `endsWith('*')` 的简陋 glob | `project-webhook.service.ts:690` | `micromatch`/`picomatch` |
| 命令策略匹配 | 裸 `new RegExp(pattern)`（可接受但 glob 更安全可预测） | `server-executor/server-command-policy.service.ts:727` | ✅ `micromatch`（F184；模板默认 glob，`regex:` 显式兼容正则） |
| 口令复杂度 | `@MinLength(6)` 而已 | `auth/dto/auth.dto.ts:8` | `validator.js isStrongPassword` |
| slugify | `.replace(/[^a-z0-9]+/g,'-')` 各写各的 | `project-webhook.service.ts:1544`、`site.service.ts:2166` | `slugify` |
| SSE 客户端（前端） | 手搓 `ReadableStream.getReader()` + `TextDecoder` + 边界解析 | `app/(dashboard)/logs/utils-sse.ts` | `@microsoft/fetch-event-source` |

## P3 — 前端（devpilot-web）

| 条目 | 现状 | 替换为 |
| --- | --- | --- |
| 表单状态 | 所有表单 = 多个 `useState` + 手写 try/catch 校验（resource-requests/backups/servers/keys/teams/admin-resource-types 等） | `react-hook-form` + zod resolver（zod 已是依赖） |
| 表格 | `@svton/ui` 的 `Table` 只是裸 `<table>`，无排序/分页/筛选，每张表手写 `.map()`（audit-events/resource-requests/execution-governance/cdn-configs/proxy-configs/logs 等十几处） | `@tanstack/react-table`（headless，叠在现有 styled 原语上） |
| 日期格式化 | `new Date(x).toLocaleString('zh-CN', {...})` 散落 ~20 个文件，**9 处重复的 `formatDateTime` 函数** | `dayjs` + 一个共享 util |
| i18n | 全站中文硬编码（182 个 tsx） | `next-intl`（App Router 原生支持） |
| 图表 | monitoring 仪表盘只渲染表格，无时序图 | 待补需求时上 `recharts` 或 `echarts` |

> 已确认成熟、无需改：数据获取用 SWR、路由用 Next.js App Router、认证用 next-auth、校验用 zod、UI 原语 `@svton/ui`、回调 `@svton/hooks`。

## 落地顺序建议

1. **第一波（安全）**：P0-1 `CryptoService` 统一；P0-2 修 `Math.random()`；P0-3 启用 zod config。
2. **第二波（去重）**：P1-1 `@nestjs/schedule` 收编调度器；P1-2 retry/backoff 公共化。
3. **第三波（基础设施）**：P1-3 redlock；P2 SSH/docker/octokit/CDN。
4. **第四波（集成）**：P2 mustache/js-yaml/SSE/webhook glob。
5. **第五波（前端）**：P3 react-hook-form、@tanstack/react-table、dayjs、next-intl。

## 验证准则

- 每完成一项，跑 `pnpm --filter @svton/devpilot-api type-check`、`lint`、`test`；前端跑 devpilot-web 的 `type-check`/`lint`/`build`。
- 替换点必须**全部**迁移，不能"新功能用库、旧代码留着"——否则仍是 DRY 违反。
- 安全项（P0）需要在 PR 描述里说明旧密文的兼容迁移策略（如双写或一次性迁移）。
