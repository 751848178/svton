# Devpilot 需求与进度盘点

更新日期：2026-06-20

## 1. 项目定位

Devpilot 是 SVTON 体系里的项目初始化与资源管控平台，用于统一开发、管理多个应用项目及其开发资源。

核心目标：

- 通过可视化向导创建 SVTON 技术栈项目，支持 backend、admin、mobile 子项目组合。
- 管理团队、项目、资源凭证、密钥、Git 连接、服务器、代理配置、CDN 配置等开发资源。
- 将“项目模板生成、资源分配、密钥生成、Git 发布、部署配置”串成可追踪的项目交付闭环。

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

7. 缺少 Devpilot 专属测试  
   当前未发现 devpilot-api/devpilot-web 的单元测试或集成测试文件。

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
