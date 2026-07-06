# Devpilot 需求与进度盘点

更新日期：2026-07-03

## 1. 项目定位

Devpilot 是 SVTON 体系里的项目初始化与资源管控平台，用于统一开发、管理多个应用项目及其开发资源。

核心目标：

- 通过可视化向导创建 SVTON 技术栈项目，支持 backend、admin、mobile 子项目组合。
- 管理团队、项目、资源凭证、密钥、Git 连接、服务器、代理配置、CDN 配置等开发资源。
- 将“项目模板生成、资源分配、密钥生成、Git 发布、部署配置”串成可追踪的项目交付闭环。
- 演进为以项目、环境、应用服务为中心的研发与运维控制平面，统一纳管构建部署、服务器、Docker、数据库/Redis、云资源、站点/TLS、日志、告警、审批和审计。

当前代码位置：

- 前端：`apps/devpilot-web`
- 后端：`apps/devpilot-api`
- 后端数据库模型：`apps/devpilot-api/prisma/schema.prisma`
- 功能注册配置：`apps/devpilot-api/src/config/features.json`
- 资源类型配置：`apps/devpilot-api/src/config/resources.json`

## 2. 用户与权限

目标用户：

- 平台管理员：维护资源池、系统级服务配置、用户和平台容量。
- 团队 owner/admin：维护团队成员、项目资源、服务器、代理、CDN、密钥、Git 连接。
- 团队成员：查看项目、查看资源、使用项目初始化能力。

权限要求：

- 所有项目与资源默认按团队隔离。
- 团队级资源操作必须携带 `X-Team-Id`。
- 敏感凭证只允许存储密文，默认返回脱敏值。
- 密钥值读取、Git token 使用、服务器凭证使用需要记录审计事件。

## 3. MVP 闭环需求

### 3.1 项目创建向导

用户可以完成以下步骤：

1. 填写项目名称、组织名称、描述、包管理器。
2. 选择子项目：backend、admin、mobile。
3. 选择业务功能：缓存、限流、队列、对象存储、短信、OAuth、支付、权限等。
4. 配置或跳过所需资源：数据库、Redis、对象存储、短信等。
5. 预览依赖、项目结构、环境变量和生成文件。
6. 生成项目 ZIP。
7. 可选：保存项目记录、生成密钥、分配资源、推送 Git 仓库。

MVP 验收标准：

- 生成的 ZIP 可以安装依赖并完成 `type-check`。
- 向导配置能完整传到后端，包含资源选择和跳过状态。
- 生成成功后必须产生 `Project` 记录，列表页可查看生成配置快照。
- 若选择 Git 发布，生成文件可以推送到已连接仓库。

### 3.2 项目与配置预设

需求：

- 支持项目列表、详情、编辑、删除。
- 支持从当前向导保存为预设。
- 支持从预设恢复向导配置。
- 支持预设导入、导出。

MVP 验收标准：

- 项目详情能看到生成时的配置、关联资源、密钥、代理和 CDN 配置。
- 预设导入后能再次生成同等配置项目。

### 3.3 开发资源管理

需求：

- 资源凭证：团队级 MySQL、PostgreSQL、Redis、七牛 Kodo、短信等连接配置。
- 资源池：系统级数据库、Redis、Nginx、CDN 池，支持容量、分配、释放。
- 密钥中心：生成、保存、查看、导出项目密钥。
- 资源与项目关联：项目生成时可选择使用已有凭证或从资源池自动分配。

MVP 验收标准：

- 资源凭证保存后以密文存储，列表不泄漏明文。
- 项目生成时可产出 `.env.example`，若选择凭证或自动分配资源，也能产出对应 `.env`。
- 资源池分配记录包含 `teamId`、`projectId`、`userId`，并能在项目详情中看到。

### 3.4 Git 与发布

需求：

- 支持 GitHub、GitLab、Gitee token 连接。
- 支持列出仓库、创建仓库、推送生成文件。
- 项目记录保存 Git 仓库 URL。

MVP 验收标准：

- Git token 加密存储。
- 推送成功后项目详情显示仓库地址。
- Git 推送失败时保留项目生成结果，并给出可恢复错误。

### 3.5 服务器、代理与 CDN

需求：

- 服务器管理：保存 SSH 连接、测试连通性、检测基础服务。
- 代理配置：生成 Nginx upstream/server 配置，关联服务器和项目。
- CDN 配置：管理 CDN 凭证、域名、源站、缓存规则。
- 独立配置生成工具：域名/Nginx 和 CDN 配置可以作为辅助工具，但应与托管式配置页面合并入口。

MVP 验收标准：

- 代理配置至少可预览 Nginx 配置。
- 同步到服务器、CDN 清缓存可以先保留模拟实现，但 UI 必须明确状态。
- 后续正式版需要通过 SSH/CDN provider API 真正执行同步。

### 3.6 动态资源类型与多接入形式

需求：

- 支持动态添加资源类型，不把资源能力写死为 MySQL、Redis、服务器、端口、CDN 等固定枚举。
- 每种资源类型可以定义自己的申请表单、审批规则、分配策略、交付结果和释放规则。
- 支持多种接入形式：
  - 手动交付：管理员审批后填写账号、密码、地址、端口等结果。
  - 资源池自动分配：从已有池中自动创建数据库、Redis DB、端口段、账号等。
  - 外部系统接入：通过 webhook、HTTP API、脚本、MCP/tool、云厂商 SDK 等方式创建资源。
  - 仅登记凭证：保存已有第三方账号或密钥，不做自动开通。
- 资源类型配置应包含字段 schema、敏感字段标记、校验规则、默认值、展示模板、环境变量模板和回收策略。
- 每次申请都应生成统一的申请单，记录申请人、团队、项目、环境、审批状态、分配结果、到期时间、释放状态和审计日志。

MVP 验收标准：

- 平台管理员可以新增、启用、禁用资源类型。
- 团队成员可以基于资源类型发起申请，前端动态渲染对应表单。
- 同一种资源类型可以选择不同交付方式，例如 Redis 可选择“已有凭证”“资源池分配”“外部接口开通”。
- 申请完成后，资源实例可以被项目引用，并能导出 `.env` 或接入项目生成流程。
- 不支持自动开通的资源类型也能通过手动交付完成闭环。

## 4. 当前进度

### 已实现较多

- 后端基础：NestJS 应用、Prisma 模型、JWT 登录注册、团队、权限、健康检查已存在。
- 数据模型：User、Team、Project、Resource、Preset、GitConnection、Server、ProxyConfig、CDNConfig、SecretKey、ResourcePool、ResourceAllocation 已建模。
- 项目生成：后端 `GeneratorService` 可以生成 ZIP，覆盖根目录、backend、admin、mobile、env、docker-compose。
- 注册表：功能、资源类型、子项目类型通过 JSON 配置驱动。
- 前端页面：已存在登录注册、团队、项目向导、项目列表/详情、资源凭证、密钥中心、预设、Git、服务器、代理、CDN、资源池等页面。
- 后端 API：上述模块基本都有 CRUD 或生成接口。

### 部分完成

- 项目向导：UI 流程完整，手动填写、已有凭证、资源实例、资源池分配和跳过资源配置都已能进入全局 `ProjectConfig`。
- 项目生成：能下载 ZIP、创建 Project 记录、持久化本地生成包并写回 `downloadUrl`；资源解析已支持 manual/credential/instance/pool/skipped 并写入 `config.resolvedResources`，项目详情已展示生成资源摘要和资源池分配摘要。
- 资源凭证：CRUD 和加密已有；项目生成已能消费向导手动填写、已有资源凭证、资源实例和资源池分配结果；资源申请已具备 `provisioningMode` 分发，资源池模式可在审批通过后自动分配并生成 ResourceInstance，`script` 模式可委托 Server executor 生成/执行受控脚本计划，`webhook` / `api` 模式可在显式开关开启后调用 HTTP adapter 并用成功响应完成申请；HTTP 外部交付已能解析 TeamCredential 红线内引用、生成 idempotency key、写入 redacted credential/auth adapter 证据，并对临时失败按 `maxAttempts` 受控重试；已审批但停在 blocked/planned 的处理器可由有权限用户手动重试并留下审计，显式配置 `autoRetry.enabled` 后还可由默认关闭的 scheduler 对到期 retryable HTTP blocked 申请自动补偿；HTTP 外部交付运行已新增 `ResourceProvisioningRun` 持久账本，记录 trigger、adapter/auth/executor、idempotencyKey、attempt、providerRunId、status 和脱敏结果，并可在资源申请页按申请查看运行历史；当前申请正在指向的 planned/blocked/failed HTTP run 可由有权限用户受控重放，新的 run 记录 `replayOfRunId` 并保留源 run 审计；默认关闭的 stale recovery 可把超时未结束的 running HTTP run 标记 failed、写 recovery 元数据和审计，并在仍是当前申请 run 时回写 blocked 以接上重放入口；资源申请页已新增 team-scoped 交付运行治理摘要、手动恢复入口、手动队列处理入口和默认关闭 queue worker 配置态，可查看 queued/running/stale/blocked/failed 压力、scheduler/queue/worker 配置态，显式恢复本团队超时 run，通过 `POST /resource-requests/provisioning-runs/process-next` 手动认领下一条 queued HTTP run，或开启 `RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED=true` 后按 batch 自动消费 queued HTTP run；`provider` 模式已固定 provider SDK adapter contract，可记录 provider/operation/region、Credential/Auth ref、idempotencyKey、providerState 查询/恢复计划，dry-run 生成可审计 plan，已有 providerState、当前 provider run 的受控对账入口或默认关闭的配置化 providerState polling 可幂等完成并创建 ResourceInstance；但密钥中心、Git 发布和真实 provider SDK live transport/真实 provider 状态查询仍未串成完整闭环。
- 资源池：有资源池 CRUD 和分配/释放接口，分配记录已包含团队上下文；实际开通数据库/Redis 仍是模拟。
- 服务器管理：端口连通测试可用；服务检测是模拟数据。
- 代理配置：Nginx 配置预览可用；同步服务器是模拟状态更新。
- CDN 配置：配置和凭证 CRUD 可用；清缓存是模拟。
- Git 集成：后端 provider 抽象和 token 存储已存在；项目向导尚未形成完整发布闭环。
- 动态资源类型：已新增运行时资源类型管理、统一申请单、资源实例和审计日志；前端申请页和交付页已能基于 `requestSchema.fields` / `deliverySchema.fields` 动态渲染表单，资源类型管理页已支持新增/编辑时用可视化字段编辑器维护这两类 Schema；资源申请列表已展示交付模式和处理器状态，审批通过后 `manual` / `credential_only` 保持人工交付，`pool` 可自动分配资源池并完成申请，`script` 会进入 Server executor 边界，`webhook` / `api` 在显式开关开启后可执行 HTTP adapter，默认关闭或失败时会写 planned/blocked 回写和审计证据，`provider` 会进入 provider SDK adapter contract，默认生成可审计 plan，显式 providerState、当前 run 对账或配置化 providerState polling 可幂等完成申请；外部 adapter 已具备 redacted TeamCredential ref、auth adapter key、idempotency header/payload、providerState recovery/reconcile/polling evidence、bounded retry、显式 opt-in autoRetry scheduler、默认关闭 stale running run recovery、team-scoped supervisor/manual recovery、可选 queued run + process-next、默认关闭 queue worker、默认关闭 providerState polling scheduler 和 `ResourceProvisioningRun` 运行账本证据，不解密或持久化 secret material；资源申请页可对 approved 且 provisioning 为 blocked/planned 的申请重新触发交付处理器，也可按申请查看外部交付运行记录、治理 queued/running/stale run，并对当前 planned/blocked/failed HTTP/provider run 发起受控重放或 providerState 对账。

### 2026-06-19 开发进展

- 根目录 `init:*` 脚本已从旧的 initializer 包名切换到 `@svton/devpilot-web` 和 `@svton/devpilot-api`。
- `devpilot-web` 的 React `Suspense` 类型冲突已局部修复，`type-check` 和 `next build` 已通过。
- 项目向导的资源配置会写入 `ProjectConfig.resources`，支持 `manual`、`credential`、`skipped` 三种资源配置模式。
- 项目生成接口现在需要团队上下文，生成 ZIP 的同时会保存 `Project` 记录，并通过 `X-Project-Id` 响应头返回项目 ID。
- 项目创建页已修复 token 读取，并会携带 `X-Team-Id`；生成成功后跳转到项目详情页。
- 生成器会读取手动填写的资源配置，并把对应资源环境变量写入生成结果。
- 资源池分配接口已改为使用 `req.user.id` 和 `req.teamId`，分配记录会写入 `teamId`，释放和项目分配查询也按团队隔离。

### 2026-06-20 开发进展

- 新增动态资源申请数据模型：
  - `ResourceType`：动态资源类型，包含表单 schema、交付 schema、环境变量模板、审批方式、交付方式和接入配置。
  - `ResourceRequest`：统一申请单，记录团队、项目、申请人、审批人、状态、规格、审批意见和交付结果。
  - `ResourceInstance`：申请交付后的资源实例，支持关联项目、申请单、资源类型、交付信息、凭证密文、过期和释放状态。
  - `ResourceAuditLog`：资源类型、申请、实例相关审计日志。
- 新增 migration：`apps/devpilot-api/prisma/migrations/20260620090000_resource_requests/migration.sql`。
- 新增后端模块 `ResourceRequestModule`，并接入 `AppModule`。
- 新增后端 API：
  - `resource-types`：资源类型创建、查询、更新、停用。
  - `resource-requests`：申请创建、列表、详情、审批、交付、取消。
  - `resource-instances`：实例列表、详情、释放。
  - `resource-audit-logs`：审计日志查询。
- 新增前端入口：
  - `/resource-requests`：资源申请列表与创建申请。
  - `/resource-instances`：资源实例列表与释放。
  - `/admin/resource-types`：资源类型管理。
- 侧边栏已增加“资源申请”“资源实例”“资源类型”入口。
- 后端启动时会初始化默认资源类型：MySQL、Redis、服务器、端口号、域名/DNS、Git 账号、云厂商账号、其他账号/凭证。
- 资源申请弹窗已从手写 JSON 升级为动态表单，支持 `text`、`number`、`password`、`textarea`、`select`、`checkbox` 字段；没有 schema 的资源类型仍保留 JSON 输入兜底。
- 默认资源类型包含申请字段、交付字段和环境变量模板，后续可以通过资源类型管理页面继续扩展新的资源种类或接入形式。
- 资源申请页已支持审批通过后的手动交付：按 `deliverySchema.fields` 填写交付信息，敏感字段进入加密凭证，提交后创建 `ResourceInstance`。
- 已完成本地预览环境验证：前端运行在 `http://localhost:43100`，后端运行在 `http://localhost:43101`，使用本机 MySQL 容器中的 `devpilot_preview` 数据库。
- 预览 smoke test 已覆盖：注册、创建团队、初始化默认资源类型、创建资源申请、审批申请、手动交付并生成资源实例。

### 2026-06-27 控制平面阶段进展

- 项目已支持生成项目、已有项目、仅构建部署项目和外部资源归属项目，项目环境可承载服务器、站点、部署、资源、CDN 和密钥；项目详情已能在权限过滤后的可见环境内给出跨环境只读同步建议，提示哪些环境还缺服务器角色、服务、部署配置、运行绑定、资源类型、站点运行时、CDN、密钥或成功部署记录，并支持先 dry-run 生成同步计划，再在目标环境确认后创建缺失应用服务骨架或补齐非敏感 deployConfig 字段；跨环境 Site 配置骨架复制 API 和项目详情确认入口已具备第一版，可从源环境向目标环境 dry-run/apply 创建 draft Site，前端要求逐个填写目标域名、展示重复域名提示并回显最近计划/执行步骤，非 dry-run 需要目标环境确认，不复制服务器/代理绑定、Nginx 同步状态或证书资产，已创建的 draft Site 可从复制结果跳转到站点管控聚焦接管，先绑定目标服务器、TLS 类型、证书名和已观测证书资产，再生成 Nginx/OpenResty 与 TLS dry-run 计划；跨环境 CDN 配置骨架复制 API 和项目详情确认入口已具备第一版，可 dry-run/apply 创建目标环境 pending CDNConfig，前端要求逐项填写目标域名/源站并选择兼容目标凭据，展示重复域名提示并回显最近计划/执行步骤，不会自动复用源环境凭据、复制 providerData/syncError 或调用云 provider；跨环境 ManagedResource/SecretKey 配置骨架复制 API 和项目详情确认入口已具备第一版，可 dry-run/apply 创建目标环境资源/密钥骨架，前端要求显式填写目标 externalId 或新密钥值、可选选择目标服务器/凭据并展示重复目标提示，不读取源密钥值、不复制资源 metadata/config/sync 状态、不自动复用源 server/credential，审计 metadata 不记录 secret value；资源骨架复制完成后已可从结果里跳转到资源管控详情并生成 dry-run 连接探测计划；环境工作台也支持选择团队可读服务器并确认 deploy/runtime/database/edge/mixed 角色后绑定到当前环境，或确认解绑，绑定/解绑会写入审计；项目下已存在但未归属环境的 Site、ManagedResource、ResourceInstance、CDNConfig 和 SecretKey 也可以按类型/单项选择后预览，再确认绑定到目标环境，且只更新 `environmentId`，不复制实际资源或读取密钥值。
- 项目详情首屏加载 Hook 已补齐 `usePersistFn` loader 依赖，保留项目、服务器、团队凭据和环境同步建议的加载顺序；Web build 不再报告该 hook 的 `react-hooks/exhaustive-deps` 警告。
- 站点管控 focused site takeover form initializer effect 已补齐 `focusedSite` 依赖，保留站点/项目/环境/代理/同步运行加载、focused site 选择和 takeover form patch/save/preview 行为；Web build 不再报告 `use-sites.ts` 的 focusedSite `react-hooks/exhaustive-deps` 警告。
- 资源凭证 Hook 已将 `resourceTypes` 缺省 fallback 收敛为稳定 empty array reference，保留 resources/resource-types SWR key、initial fallback、create/remove mutate flow 和返回 contract；Web build 不再报告 `use-resources.ts` 的 `resourceTypes` memo dependency 警告。
- 操作审批 Hook 已将 `approvals` 缺省 fallback 收敛为稳定 empty array reference，保留 status-filtered SWR key、默认 pending initial fallback、review/execute mutate flow 和返回 contract；Web build 不再报告 `use-approvals.ts` 的 `approvals` memo dependency 警告。
- 审计事件 Hook 已将 `allEvents` 缺省 fallback 收敛为稳定 empty array reference，保留固定 audit-events SWR key、`initialEvents` fallback、客户端过滤、统计和 reload/refresh 返回 contract；Web build 不再报告 `use-audit-events.ts` 的 `allEvents` memo dependency 警告。
- 团队成员行头像已从原生 `<img>` 切换为固定 40px 的 `next/image` `unoptimized` 渲染，保留动态 OAuth/Git avatar URL、fallback 首字母、角色编辑和移除行为，不新增宽泛 `images.remotePatterns`；Web build 不再报告 `member-row.tsx` 的 `@next/next/no-img-element` 警告。
- 日志 Tail Hook 已将 metadata hydration / stream reset 与 tail polling / SSE reconnect lifecycle 下沉到同目录 effect hooks，保留 tail refresh/close action contract、cursor/session refs、SSE session refresh 与 metadata 表单回填行为；Web build 不再报告 `use-logs-tail.ts` 的 `react-hooks/exhaustive-deps` 警告，相关 hook 文件均低于 200 行。日志页面 data hook 已将 stream CRUD、entry append、collection run 和 retention cleanup mutations 下沉到 `use-logs-actions.hooks.ts`，`use-logs.ts` 现在只组合加载、target options、selected stream、tail/policy/action hooks 和既有返回 contract。
- 新建项目和接入已有项目的默认环境基线已统一为 dev/test/staging/prod：项目配置规范化会在缺少 `config.environments` 时写入四环境，`ProjectEnvironmentService.ensureDefaultsForProject()` 也会在缺省配置下创建四个环境记录；已有自定义环境列表仍保持兼容，旧项目可继续通过环境同步入口补齐。
- Server executor 已成为统一执行边界，资源动作、部署运行、站点同步/回滚、服务操作、备份和日志采集都能沉淀标准执行计划、队列任务、日志、结果和审计；SSH live 取消/超时时会通过远端临时 wrapper 记录子进程 PID，best-effort 发起独立 SSH cleanup 终止远端进程组/子进程，并把 session/cleanup 写入 running `ServerExecutionJob.metadata.remoteExecution`；显式开启 `SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED=true` 后，stale recovery 会基于已记录 SSH PID 追偿清理 worker 崩溃后遗留的远端 orphan，并写入 `remoteExecution.staleCleanup`；执行治理页已能展示远端 PID、执行期 cleanup 和 stale 追偿 cleanup 摘要；ProjectWebhook 已支持 Push 自动部署和 PR Preview 两类入口，PR/MR 事件会先创建或复用 `preview-pr-*` / `preview-mr-*` 项目环境骨架，并在 webhook 有创建人时创建或复用对应的 draft Site 占位，例如 `preview-pr-42.preview.devpilot.local`，再生成安全的 dry-run queued DeploymentRun，记录源分支、目标分支、head SHA、PR 编号、标题、URL、预览环境、基准环境和预览 Site 等 `params.preview` 元数据；draft preview Site 已支持在站点聚焦接管面板显式绑定目标服务器和 upstream，清除占位 `syncBlocked` 并立即生成 dry-run Nginx/OpenResty 同步计划；PR/MR 关闭或合并事件会归档既有预览环境骨架和 draft Site 占位 metadata，记录 `teardown.status=not_started`，不会创建 DeploymentRun 或触碰真实 DNS、TLS、Nginx/OpenResty 或服务器资源；失败部署运行已支持保留原失败记录的一键重试，生成新的 dry-run/queued 重试计划，失败 live 部署也可重新发起受审批保护的 Live 重试；已完成部署/回滚运行可独立发起低风险 Smoke 检查，生成 `DeploymentRun mode=smoke_check` 并复用 Server executor、队列、执行任务和审计链路，监控页可按最近 N 次非 dry-run 部署 Smoke 检查失败次数生成标准告警事件；失败 live Smoke 也可生成回滚 dry-run/queued 计划或申请受审批保护的 live 回滚，回滚目标会选择 Smoke 来源部署之前的上一成功 live deploy；项目页已可显式开启 Live Smoke 失败后自动生成回滚计划，后端通过默认关闭的 scheduler 幂等扫描失败 Smoke 并自动创建回滚计划、审批申请，或在策略显式携带已批准 approvalId 与确认文本时沿既有审批消费和 Server executor 队列链路提交 live 回滚；项目页也可显式开启 Live 回滚完成后自动 Smoke，后端会在同步完成或默认关闭 scheduler 扫描到 completed live rollback 后幂等生成 dry-run/queued Smoke 检查，真实临时预览基础设施/域名和真实资源销毁仍留在后续安全策略里。
- 执行治理页的取消、重试、手动处理队列和 stale recovery 治理动作已进入统一 `AuditEvent`，审计目标使用 `server_execution_job`，并在 metadata 中保留原 job、重试 job、scope 和 remote cleanup 证据。
- 执行治理页的 URL scope contract 已补齐类型导出和 Hook 参数契约，`useExecutionGovernance(scope)` 复用既有 job/lease 查询参数 builder；操作审批页也补齐 `ApprovalScope` 类型导出，approval list query key 行为保持不变。
- 执行治理页已新增 Server executor Supervisor 状态，可查看当前 worker 配置、ready/scheduled/running/stale 队列积压、live lease、worker owner、跨实例 worker inventory/status、Server agent fleet 摘要、runtime health 摘要、runtime lifecycle preflight、queue coordination preflight、remote orphan governance preflight 和 task-pull readiness；worker inventory/status 只读展示当前实例、queue 状态、active/stale/expired owner、owned/unowned running jobs 和 owner 样本，runtime lifecycle preflight 只读展示 state/reason、target/heartbeat/dispatcher/queue gates、pressure、blockers 和 nextSteps，queue coordination preflight 只读展示 state/reason、worker/queue/owners/recovery gates、pressure、blockers 和 nextSteps，remote orphan governance preflight 只读展示 stale running job 的 remoteExecution session/cleanup、cleanup config、owner/recovery gate、risk、blocker、sample 和 nextSteps，task-pull readiness 只读展示 runtime/queue/pullContract/audit gates、pressure、blockers、nextSteps 和脱敏样例；前端 `ServerExecutionSupervisorSnapshot` 已拆成 worker/queue、remote orphan、audit、agent readiness/fleet 等 focused type files，保留顶层导出和现有 UI indexed access；`server-agent` 还新增默认关闭的 task-pull contract skeleton，供 agent 端在 token 校验后读取 contract version、poll 建议、runtime gate 和 queue sample；真实 agent 长连接/任务拉取/claim/ack/生命周期执行、真实跨实例 remote orphan cleanup 执行治理和实际多实例队列协调仍待补。
- 执行治理 Supervisor 已新增 execution audit visibility，只读聚合最近 `category=execution`、`targetType=server_execution_job` 的 `AuditEvent`，展示最近 status/risk/action 统计和 job 样例；它只复用现有审计事件，不新增审计写入、不触发执行动作、不暴露完整 metadata。
- Server executor 已新增默认关闭的 `server-agent` adapter 边界，`server_agent` target dry-run 会生成 agent dispatch envelope；live 默认 blocked，只有显式开启 `SERVER_EXECUTOR_AGENT_ENABLED=true` 且配置 `SERVER_EXECUTOR_AGENT_DISPATCHER_URL` 时才会向 HTTP dispatcher POST envelope，并接受同步终态响应；dispatcher envelope、result、command plan 和 HTTP headers 已携带 `serverExecutionJobId`、lease id、retry attempt、dispatch id 与 idempotency key 组成的 correlation 契约，便于 dispatcher、审计、重试和后续 agent supervisor 对齐同一条执行任务；server-agent adapter 返回后也会写入 `server_execution_job.agent_dispatch` 审计事件，metadata 保留 correlation、dispatcher 配置态、终态、boundary 和 whitelisted response 摘要，审计失败只记录 warn，不反向改写执行结果；Supervisor 已能只读判断 task-pull readiness，`POST /server-agent/task-pull/contract` 也已提供默认关闭的只读 contract/readiness skeleton，返回 contract version、poll 建议、runtime/queue/contract gate、blocker 和 nextSteps，但真实 agent runtime 长连接、任务拉取、claim/ack 和生命周期治理仍待补。
- Server executor target 解析已支持默认关闭的 agent capability 选择，只有显式开启 `SERVER_EXECUTOR_AGENT_TARGET_ENABLED=true` 且服务器 services/tags 标记 agent 时才返回 `server_agent` target；默认仍保持 SSH；显式开启 `SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED=true` 后，`resolveTarget()` 还会要求该服务器 heartbeat runtime 处于 online，缺失/stale/unknown 会安全回落 SSH。
- 执行治理页的 job history 已展示 execution target 路径：所有任务可查看 `transport`，`server_agent` 任务可查看 agentRef 的 displayName、capabilityKey、source 和 status，并基于已持久化的 `ServerExecutionJob.result` 展示 agent dispatch 摘要，包括已投递/投递失败/live 阻塞、dispatcher 配置态、脱敏 dispatcher、终态响应 status/run id、dispatch id、job/lease id、retry attempt、idempotency key 和 `server_agent_dispatcher` boundary，便于审计 SSH 到 server agent 的迁移路径。
- 执行治理 Supervisor 已新增 Server agent dispatcher config 摘要，只读展示 executor/dispatcher/token/timeout 和脱敏 dispatcher URL，不主动探测外部 dispatcher、不暴露 token。
- 执行治理 Supervisor 已新增 Server agent readiness 摘要，按团队服务器只读聚合 agent target selection 开关、capable/online/source/status 统计和 sample servers，为后续真实 agent supervisor 提供可观测契约。
- Server agent heartbeat 已有默认关闭的上报入口，只有显式配置 heartbeat token 后才允许写入 `Server.services.devpilotAgent` 的白名单 runtime 字段；执行治理 Supervisor/UI 已展示 heartbeat 开关、token 配置态、heartbeat-required target selection 门禁、online/stale/unknown 摘要和样例 lastSeen/expiresAt，不写入 token 或任意 metadata；runtime health 已进一步按 ready/degraded/stale/unknown/missing/expiringSoon 聚合，真实 agent runtime 生命周期仍待补。
- 执行治理 Supervisor 已新增 Server agent job demand 摘要，按 `transport=server_agent` 只读聚合 ready/scheduled/running/stale/blocked/failed/cancelled 和下一条 ready agent job，便于真实 dispatcher 接入前观察任务压力。
- 执行治理 Supervisor 已新增 Server agent blocked reason 摘要，扫描最近 blocked `server_agent` job 的 error/result，展示 reason 分布、`server_agent_dispatcher` boundary 数和样例任务，便于定位 dispatcher 未接入、命令策略阻断或配置告警。
- 执行治理 Supervisor 已新增 Server agent fleet 摘要，把 agent-capable server、heartbeat runtime、dispatcher 配置态和最近 `server_agent` job 样本聚合为每台服务器的 target/live dispatch readiness、blocking reasons、job pressure、next queued job 和 blocked sample；该视图只读诊断，不改变 `resolveTarget()` 或队列执行行为。
- 执行治理 Supervisor 已新增 Server agent runtime health 摘要，把 agent-capable server 的 heartbeat 缺失、stale、unknown、degraded、临近过期、lastSeenAge 和 expiresIn 归一为只读健康状态，并在 fleet server 上展示 health/reason/seen/expires；该视图不改变 target selection、dispatcher 或队列执行。
- 执行治理 Supervisor 已新增 Server agent runtime lifecycle preflight，基于现有 target selection、heartbeat token/required、dispatcher config、runtime health、fleet、agent job demand 和 queue worker 推导只读 state/reason、四类 gate、pressure、blockers 与 nextSteps；该视图不启动真实 agent、不注入 Secret、不引入日志流、不改变 dispatcher、target selection 或队列领取。
- 资源管控已覆盖 Docker 容器、Docker MySQL/Redis、阿里云 RDS/SLS、腾讯 COS 的清单、连接探测、只读查询计划和部分 live readonly/SDK inventory 边界；ResourceControl 前端 action run contract 已对齐既有后端 DTO，`useResourceControl.runAction` 可接受 action definition 或 string key，默认 dry-run，live/confirmation/queue/approval 只转发已有 DTO 字段；日志中心已支持默认关闭的 Server executor 定时 follow，以及 SLS credential-backed live 只读查询入库和按流定时回填；Agent Follow UI 的 `metadata.agentFollow` 类型/helper 持久化契约已补齐，但真实 agent 级持续日志 follow runtime 仍待后续安全策略补齐。
- 资源管控前端已持续按 page/hooks/components/utils/types 拆分；资源申请前端已把 provisioning run history、replay、provider reconcile、manual recovery 和 queue processing 操作从主 `useResourceRequests` hook 拆到专用 hook，并把运行记录 modal 的行视图拆出、恢复当前 provider run 的对账操作入口；创建申请 modal 已把 requestSchema 派生、字段状态、环境同步和 `POST /resource-requests` 提交下沉到专用 hook，并把字段渲染拆到 component；完成交付 modal 也已把 deliverySchema 派生、交付字段状态、JSON fallback 和 `POST /resource-requests/:id/complete` 提交下沉到专用 hook，并把交付字段渲染拆到 component；admin/resource-types schema editor 已拆为集合 editor 与单字段 row component，form modal 已拆为 state/submit hook 与字段 component；project detail 的 deployment-config difference/reference-profile 工具已从环境画像构建工具中拆出，`projects/[id]` route/components/hooks/types/utils 当前均 <200 行；applications route header actions 已拆为专用 component，应用/服务创建 mutation flow 已下沉到 `use-application-creation.hooks.ts`，service row SLO summary 已拆到专用 component，`applications/page.tsx`、`use-applications.ts` 与 `service-row.tsx` 当前均 <200 行；Sites TLS/date format utility 已从 `utils-format.ts` 拆到 focused `.utils.ts` 并保持旧 `../utils-format` import contract，live sync/TLS renew/rollback approval action flow 已从 `use-site-actions.ts` 拆到 focused hook，focused takeover form/preview activation flow 已从 `use-sites.ts` 拆到 `use-site-takeover.hooks.ts`，`SiteCard` action buttons 已拆到 `site-card-actions.component.tsx`，Add Site basic fields 与 shared form type 已拆到 `add-site-basic-fields.component.tsx` / `add-site-form.types.ts`，focused plan/run summary 已拆到 `focused-site-plan-run-summary.component.tsx`；Sites 目录当前全部源码文件均低于 200 行，`use-sites.ts` 当前 140 行、`site-card.tsx` 当前 93 行、`add-site-modal.tsx` 当前 136 行、`focused-site-panel.tsx` 当前 175 行；execution-governance supervisor snapshot 类型已拆到 focused `.types.ts`，SupervisorPanel 只读视图已拆成 summary、worker process、agent readiness、queue coordination、remote orphan、execution audit 和 owner sample components，`supervisor-panel.tsx` 当前 38 行且本轮 focused components/utils 均 <200 行；resource-requests、access-policies 与 admin/resource-types 目录当前全部源码文件均 <200 行。
- 生成项目向导已支持数据库引擎选择，后端项目默认 MySQL，也可选择 PostgreSQL 或 SQLite；生成器会同步输出对应的 README、Prisma datasource、`.env.example` 和本地 docker-compose 数据库服务，SQLite 不生成外部数据库服务。
- 生成项目 ZIP 已支持本地 artifact 持久化和第一版本地生命周期：`POST /projects/generate` 会写回 `Project.downloadUrl` 和带 `retentionDays` / `expiresAt` 的 `config.generatedArtifact`，项目详情可重新下载生成包；下载接口受项目读权限保护，会拒绝过期 artifact、写回 `downloadCount` / `lastDownloadedAt` / `lastDownloadedBy` 访问 metadata，并写入 `project.artifact.download` 审计事件，metadata 只包含 `fileName`、`size`、`sha256`、`generatedAt`、`expiresAt`、`downloadCount` 等安全字段；过期本地 ZIP 已新增受控制面访问策略保护的 `POST /projects/artifacts/cleanup` 运维清理入口和默认关闭的 `PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED` 调度器，均默认 dry-run，实际删除会写入 `project.artifact.cleanup` 审计。
- 站点管控已从旧 ProxyConfig 演进为 Site：支持 Nginx/OpenResty 同步计划、live/queued 同步、配置 diff、审批门禁、配置快照回滚、诊断运行、OpenResty/Nginx 运行态状态探测、OpenResty/Nginx 模块盘点、固定模块基线检查、低风险 Smoke 检查、Smoke 检查失败告警、证书手动/定时探测、证书资产快照、证书资产变化告警、受控续期计划、续期结果回写、正式续期成功后的自动探测刷新、默认关闭续期调度、证书过期告警和 TLS 续期失败告警；PR Preview draft Site 会带 `syncBlocked` 占位标记，同步计划会给出 warning，避免在真实 runtime/domain 策略补齐前误同步到服务器，运营者可在站点接管面板补齐服务器和 upstream 后解锁并生成 dry-run 计划；跨环境 Site copy 也可显式开启 `openRestyTakeover`，在 apply 时为目标站点绑定 server/upstream 并生成 Nginx/OpenResty dry-run 接管计划；显式 `createQueuedLiveSync` 时可继续创建 queued live sync 请求，未携带已批准 per-site approval 时只生成 blocked approval，copy 返回体和审计 metadata 会汇总 `followUp.queuedLiveSync` 的状态计数、pending approval、queued job 和 alerts，真实写入仍交给 Site sync 审批、confirmation、Server executor 队列和 worker 路径；默认仍不执行 live 写入；项目详情 Site copy follow-up 面板已补齐审计、审批和执行治理深链 helper contract。
- 监控、日志、备份、审批、审计和访问策略已经具备第一版闭环，资源级指标时间序列曲线已补入资源详情，日志中心已支持入库日志 SSE 流式 tail、cursor resume、断线自动重连、有界会话治理、活跃会话控制、单流/用户/团队基础限流和默认关闭的 Server executor 定时 follow，且手动关闭日志流会话已写入审计，Agent Follow UI 的 metadata 持久化契约已补齐，监控页也已具备资源指标大盘、服务 SLO 大盘、服务 SLO `applicationServiceId` 精确过滤、应用服务页单服务 SLO 摘要、监控页单服务 SLO 详情深链、站点 Smoke 失败告警、部署 Smoke 失败告警、日志数量阈值告警、服务 SLO 违约告警、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测、SLO 模板和事件去重抑制第一版，通用 Webhook、飞书、钉钉、企业微信机器人通知、邮件通知、失败/planned 投递手动重试、默认关闭的失败通知自动重试以及默认关闭的严重告警升级第一版也已补齐；Monitoring Web 当前源码文件均低于 200 行，API DTO 输入结构已拆成 alert、dashboard、silence、notification focused DTO 文件并保留 `monitoring.dto.ts` barrel contract，Monitoring scheduler 已拆出 config service、summary types 和 summary value utils，主 scheduler service 保留编排入口且低于 200 行，Monitoring HTTP 入口已拆成 alert rules/events、dashboard、silence、notification focused controllers 并通过 shared access provider 复用读写访问策略，资源指标大盘 read-model 已拆出 focused query service、builder service 和类型文件，服务 SLO 大盘 read-model 已拆出 focused query service、builder service、status service、类型文件和 derived metric 常量，dashboard/template controller routes 已直接调用 focused dashboard/template services，不再经过 MonitoringService 兼容委托，notification-channel 与 notification-delivery HTTP routes 已直接调用 focused channel/read/retry services，不再经过 MonitoringService 兼容委托，notification delivery read/access-scope 查询已拆出 focused read service、shared include 常量和 delivery record 类型，notification delivery payload/text/email formatting 已拆出 focused builder/types/utils/channel select 边界，notification delivery dispatch/config/write execution 已拆出 focused dispatch、Webhook/Email adapter、sender、writer 和 config service，manual/scheduled notification retry orchestration 与 retry audit 已拆出 focused retry service、audit service、types 和 utils，stale alert escalation scan/dedupe/audit 已拆出 focused escalation service、audit service、types 和 utils，scheduler retry/escalation branches 已直接调用 focused retry/escalation services，不再经过 MonitoringService 兼容委托，notification-channel list/access-scope/create/update/settings 已拆出 focused channel service/settings service/filter/json utils 且保留 MonitoringService 兼容委托，alert silence list/access-scope/create/update/window/matching 已拆出 focused silence service/matcher/window/types，并复用 project/environment scope service，silence HTTP routes 已直接调用 focused silence service，不再经过 MonitoringService 兼容委托，alert event list/access-scope/acknowledge/audit writes 已拆出 focused event service/audit service，alert-event HTTP routes 已直接调用 focused event service，不再经过 MonitoringService 兼容委托，alert rule list/get/access-scope/create/update 和 create-time target resolution 已拆出 focused rule service/target service，alert-rule HTTP routes 已直接调用 focused rule service，不再经过 MonitoringService 兼容委托，alert evaluation post-evaluation event persistence/dedupe/rule status/audit/notification dispatch 已拆出 focused evaluation event service，Site certificate expiry、certificate asset change 和 TLS renewal failure evaluation 已拆出 focused Site certificate/TLS evaluation services，observed value 与 generic bound-target status evaluation 已拆出 focused status evaluation service，Service SLO breach/error-budget/exhaustion evaluation、signal query 与 window evaluation 已拆出 focused Service SLO evaluation services，Site/Deployment smoke-check failure evaluation 已拆出 focused smoke-check evaluation services，log-count alert evaluation、level fallback、latest log entry summary formatting 和 message truncation 已拆出 focused log-count evaluation service，generic Deployment/Backup status evaluation 已拆出 focused status evaluation services，Cloud provider sync failure 与 Resource metric threshold evaluation 已拆出 focused resource alert evaluation services，Service SLO rule template output 已拆出 focused template service，category/metric alert evaluation dispatch 已拆出 focused dispatch service；早期项目交付入口中的 Project generate/preview、Preset、Git、旧 Domain 和旧 CDN 配置生成也已接入团队上下文和控制面访问策略；但证书库/上传绑定、真实备份恢复、agent 级持续日志 follow runtime、真实 SLO 周期/多周期错误预算策略、e2e 权限覆盖、完整 agent supervisor 和 agent executor 仍待补。

### 主要缺口与风险

1. 生成项目记录闭环仍缺生产级 artifact 生命周期
   已完成 Project 记录创建、本地 ZIP 持久化、`downloadUrl` 写回、受权限下载、过期 metadata、过期下载拒绝、下载访问 metadata、下载审计事件、team-scoped 运维清理 API、默认关闭清理调度和清理审计；后续还要补对象存储和历史生成包补档。

2. 外部资源交付 adapter 仍待扩展
   项目生成已能消费 manual/credential/instance/pool/skipped 资源配置，并在项目详情展示解析结果；资源类型 request/delivery schema 可视化编辑和资源申请 provisioningMode 分发已具备，script 已接入 Server executor，webhook/API 已具备默认关闭的 HTTP adapter 执行、TeamCredential redacted ref、idempotency key、bounded retry、失败回写、手动重试入口、显式 opt-in 的自动补偿 scheduler、`ResourceProvisioningRun` 持久化运行账本、资源申请页运行历史弹窗、当前 HTTP run 受控重放、默认关闭 stale running run recovery、team-scoped 运行治理摘要/手动恢复入口，以及可选 queued HTTP run、手动 process-next 执行入口和默认关闭 queue worker；provider 模式已具备默认 dry-run 的 SDK plan、providerState 幂等恢复完成、run 级受控 providerState 对账、配置化 providerState polling、redacted evidence 和重放入口。下一步要把该边界扩展成真实 Aliyun/Tencent provider SDK live transport、真实 provider 状态查询 adapter 和更完整的失败补偿。

3. 生成项目数据库选择已统一，真实交付仍待补
   Devpilot 生成器已默认 MySQL，并支持选择 PostgreSQL/SQLite；后续还要把数据库资源池、只读账号、备份、监控和密钥注入与生成项目配置联动起来。

4. 资源池分配接口存在运行时风险
   已修复 `teamId` 和 `userId` 写入；实际开通数据库/Redis 仍是模拟实现。

5. 根目录脚本命名过期
   已修复为 `@svton/devpilot-web`、`@svton/devpilot-api`。

6. 前端类型检查未通过
   已修复并通过 `type-check`；当前采用局部兼容组件绕过 monorepo 中 React 类型不一致。

7. Devpilot 专属测试仍不均衡
   后端核心控制面已补入 Jest 回归测试，环境同步、资源批量绑定、权限策略、部署、站点、资源动作、备份、日志、监控等关键服务已有覆盖；前端交互测试、真实 DB fixture 和端到端权限/部署流程仍待补。

8. 页面入口重复或未纳入导航
   `domain` 与 `proxy-configs`、`cdn` 与 `cdn-configs` 都覆盖相近场景，需要明确是工具页还是托管配置页，避免产品路径分裂。

9. 动态资源申请模型缺失
   基础模型、API、页面入口、默认资源类型、动态申请表单和手动交付创建实例已完成；下一步需要补审批权限细化、资源类型 schema 编辑体验和自动交付处理器。

## 5. 建议里程碑

### M1：项目生成闭环

- 修复根目录 `init:*` 脚本指向。
- 修复前端类型检查。
- 让项目向导资源配置进入 `ProjectConfig`。
- `POST /projects/generate` 支持保存 Project 记录，返回项目 ID 与 ZIP。
- 项目详情显示生成配置、下载状态、关联资源；本地 `downloadUrl` 下载已完成，生产级对象存储和生命周期待补。

### M2：资源与密钥闭环

- 统一数据库选择，支持 MySQL/PostgreSQL/SQLite（生成项目向导与模板已完成；资源交付联动待补）。
- 项目生成接入资源凭证和密钥中心。
- 修复资源池分配的 `teamId` 与 `userId`。
- 资源池分配先明确模拟/真实模式，避免 UI 暗示已真实创建资源。
- 完善统一资源申请模型：审批权限细化、自动交付处理器、资源实例导出 `.env`、资源类型 schema 可视化编辑。

### M3：Git 发布闭环

- 向导增加 Git 发布步骤或在预览页启用 Git 发布。
- 生成后可创建仓库、推送文件、保存仓库 URL。
- Git 错误可重试，不影响 ZIP 下载。

### M4：部署配置闭环

- 合并 `domain`/`proxy-configs` 与 `cdn`/`cdn-configs` 的产品入口。
- 代理配置同步从模拟升级为 SSH 写入/校验/回滚。
- CDN provider API 清缓存从模拟升级为真实调用。

### M5：质量基线

- devpilot-api 增加服务层单测：project、resource、resource-pool、generator。
- devpilot-web 增加向导状态流测试。
- 增加最小端到端用例：注册、建团队、创建资源、生成项目、查看项目。

## 6. 本次验证

- `pnpm --filter @svton/devpilot-api type-check`：通过。
- `pnpm --filter @svton/devpilot-web type-check`：通过。
- `pnpm --filter @svton/devpilot-api build`：通过。
- `pnpm --filter @svton/devpilot-web build`：通过。
- `pnpm --filter @svton/devpilot-api exec prisma validate`：通过。
- `curl http://localhost:43101/api/health`：通过。
- `curl http://localhost:43100/login`：通过。
- 本地 API smoke test：注册、建团队、查资源类型、创建申请、审批、交付、查询实例均通过。

## 7. 下一步优先级

建议先做 P0：

1. 将外部资源交付 adapter 从第一版 script/HTTP/provider contract + redacted credential/idempotency/manual retry/reconcile 边界扩展到真实 provider SDK live transport、队列化自动重试、自动 provider 状态轮询和更完整的失败补偿。
2. 将数据库选择继续联动到资源池/凭证交付、密钥注入、备份和监控；生成项目默认不一致问题已修复。
3. 将生成 ZIP 的本地生命周期继续升级为生产级 artifact 管理：对象存储和历史补档；当前公开清理调度/API 与下载审计仍是本地 artifact 版本。

完成 P0 后，Devpilot 才能从“模块齐全的原型”进入“可用于日常项目初始化的 MVP”。
