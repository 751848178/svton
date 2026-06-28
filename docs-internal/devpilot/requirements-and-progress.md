# Devpilot 需求与进度盘点

更新日期：2026-06-28

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

- 项目向导：UI 流程完整，手动填写/跳过资源配置已能进入全局 `ProjectConfig`；已有凭证选择和资源池自动分配还未接入。
- 项目生成：能下载 ZIP，并已创建基础 `Project` 记录；ZIP 持久化、资源池、密钥中心和 Git 发布还未串成完整闭环。
- 资源凭证：CRUD 和加密已有；项目生成已能消费向导手动填写的资源配置，但还未消费已保存的资源凭证。
- 资源池：有资源池 CRUD 和分配/释放接口，分配记录已包含团队上下文；实际开通数据库/Redis 仍是模拟。
- 服务器管理：端口连通测试可用；服务检测是模拟数据。
- 代理配置：Nginx 配置预览可用；同步服务器是模拟状态更新。
- CDN 配置：配置和凭证 CRUD 可用；清缓存是模拟。
- Git 集成：后端 provider 抽象和 token 存储已存在；项目向导尚未形成完整发布闭环。
- 动态资源类型：已新增运行时资源类型管理、统一申请单、资源实例和审计日志；前端申请页已能基于 `requestSchema.fields` 动态渲染表单。

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
- Server executor 已成为统一执行边界，资源动作、部署运行、站点同步/回滚、服务操作、备份和日志采集都能沉淀标准执行计划、队列任务、日志、结果和审计；ProjectWebhook 已支持 Push 自动部署和 PR Preview 两类入口，PR/MR 事件会先创建或复用 `preview-pr-*` / `preview-mr-*` 项目环境骨架，并在 webhook 有创建人时创建或复用对应的 draft Site 占位，例如 `preview-pr-42.preview.devpilot.local`，再生成安全的 dry-run queued DeploymentRun，记录源分支、目标分支、head SHA、PR 编号、标题、URL、预览环境、基准环境和预览 Site 等 `params.preview` 元数据；draft preview Site 已支持在站点聚焦接管面板显式绑定目标服务器和 upstream，清除占位 `syncBlocked` 并立即生成 dry-run Nginx/OpenResty 同步计划；PR/MR 关闭或合并事件会归档既有预览环境骨架和 draft Site 占位 metadata，记录 `teardown.status=not_started`，不会创建 DeploymentRun 或触碰真实 DNS、TLS、Nginx/OpenResty 或服务器资源；失败部署运行已支持保留原失败记录的一键重试，生成新的 dry-run/queued 重试计划，失败 live 部署也可重新发起受审批保护的 Live 重试；已完成部署/回滚运行可独立发起低风险 Smoke 检查，生成 `DeploymentRun mode=smoke_check` 并复用 Server executor、队列、执行任务和审计链路，监控页可按最近 N 次非 dry-run 部署 Smoke 检查失败次数生成标准告警事件；失败 live Smoke 也可生成回滚 dry-run/queued 计划或申请受审批保护的 live 回滚，回滚目标会选择 Smoke 来源部署之前的上一成功 live deploy；项目页已可显式开启 Live Smoke 失败后自动生成回滚计划，后端通过默认关闭的 scheduler 幂等扫描失败 Smoke 并自动创建回滚计划或审批申请；项目页也可显式开启 Live 回滚完成后自动 Smoke，后端会在同步完成或默认关闭 scheduler 扫描到 completed live rollback 后幂等生成 dry-run/queued Smoke 检查，预授权 live 自动执行、真实临时预览基础设施/域名和真实资源销毁仍留在后续安全策略里。
- 资源管控已覆盖 Docker 容器、Docker MySQL/Redis、阿里云 RDS/SLS、腾讯 COS 的清单、连接探测、只读查询计划和部分 live readonly/SDK inventory 边界；日志中心已支持默认关闭的 Server executor 定时 follow，以及 SLS credential-backed live 只读查询入库和按流定时回填。
- 站点管控已从旧 ProxyConfig 演进为 Site：支持 Nginx/OpenResty 同步计划、live/queued 同步、配置 diff、审批门禁、配置快照回滚、诊断运行、OpenResty/Nginx 运行态状态探测、OpenResty/Nginx 模块盘点、固定模块基线检查、低风险 Smoke 检查、Smoke 检查失败告警、证书手动/定时探测、证书资产快照、证书资产变化告警、受控续期计划、续期结果回写、正式续期成功后的自动探测刷新、默认关闭续期调度、证书过期告警和 TLS 续期失败告警；PR Preview draft Site 会带 `syncBlocked` 占位标记，同步计划会给出 warning，避免在真实 runtime/domain 策略补齐前误同步到服务器，运营者可在站点接管面板补齐服务器和 upstream 后解锁并生成 dry-run 计划。
- 监控、日志、备份、审批、审计和访问策略已经具备第一版闭环，资源级指标时间序列曲线已补入资源详情，日志中心已支持入库日志 SSE 流式 tail、cursor resume、断线自动重连、有界会话治理、活跃会话控制、单流/用户/团队基础限流和默认关闭的 Server executor 定时 follow，且手动关闭日志流会话已写入审计，监控页也已具备资源指标大盘、服务 SLO 大盘、站点 Smoke 失败告警、部署 Smoke 失败告警、服务 SLO 违约告警、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测、SLO 模板和事件去重抑制第一版，通用 Webhook、飞书、钉钉、企业微信机器人通知、邮件通知、失败/planned 投递手动重试、默认关闭的失败通知自动重试以及默认关闭的严重告警升级第一版也已补齐；但真实生产级执行、证书库/上传绑定、真实备份恢复、agent 级持续日志 follow、真实 SLO 周期/多周期错误预算策略、e2e 权限覆盖和 agent executor 仍待补。

### 主要缺口与风险

1. 生成项目后没有项目记录闭环
   已完成基础记录创建，但下载文件本身仍未持久化，`downloadUrl` 还没有真实实现。

2. 向导资源配置没有进入提交数据
   已完成基础入参打通；下一步要接入已有资源凭证选择、资源池自动分配和动态资源类型。

3. 数据库选择不一致
   Devpilot README 和资源配置强调 MySQL，生成器默认产出 PostgreSQL schema、PostgreSQL `DATABASE_URL` 和 docker-compose。需要明确项目生成的默认数据库，并支持选择 MySQL/PostgreSQL/SQLite。

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
- 项目详情显示生成配置、下载状态、关联资源。

### M2：资源与密钥闭环

- 统一数据库选择，支持 MySQL/PostgreSQL/SQLite。
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

1. 接入已有资源凭证选择，让 `credential` 模式真正可用。
2. 让资源池分配在项目生成流程中可选触发。
3. 为 `ResourceType.requestSchema` 和 `deliverySchema` 增加可视化编辑器，减少管理员手写 JSON 的成本。
4. 为 `provisioningMode` 增加交付处理器：手动交付、资源池、webhook/API/script。
5. 支持数据库类型选择，解决 MySQL/PostgreSQL 默认不一致。
6. 将生成 ZIP 持久化为可重新下载的 `downloadUrl`。

完成 P0 后，Devpilot 才能从“模块齐全的原型”进入“可用于日常项目初始化的 MVP”。
