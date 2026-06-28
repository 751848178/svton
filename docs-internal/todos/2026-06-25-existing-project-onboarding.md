# Existing Project Onboarding And Control Surface

## Goal

让 Devpilot 的项目管理从“只能创建全新项目”演化为“可以纳管已有项目”，并沉淀 Webhook、站点管控与竞品差距的产品说明，支撑后续资源控制平面继续扩展。

## Scope

- In scope: 新增已有项目接入的最小前后端闭环；让项目列表和详情兼容非生成项目；产出 Webhook、站点管控、竞品差距说明文档；新增 Site 站点管控最小闭环。
- In scope: 保留现有新项目生成向导和 `/projects/generate` 行为。
- Out of scope: 本次不实际执行 Git webhook 触发部署、不安装 Nginx/OpenResty、不向线上服务器写入站点配置。

## Clarifications And Assumptions

- Confirmed: 用户希望按照“项目可以不关联技术栈和初始化”的方向改造。
- Confirmed: 用户希望研究 Webhook、代理/站点管控，以及竞品缺口。
- Assumption: 先用 `Project.config` 承载 `generated | imported | external` 三种模式，避免当前阶段引入破坏性 Prisma 迁移。
- Assumption: 竞品说明优先引用官方文档或产品页，作为产品演进参考，不直接绑定到当前实现。

## Functional TODO Breakdown

### F1. 已有项目纳管入口

Purpose: 用户可以不经过初始化生成器，直接创建一个已有项目/外部项目的管理壳。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F1.1 | done | 识别当前项目创建、列表、详情的代码链路。 | 只读检查 project API、DTO、web 页面和 config store。 | CodeGraph status + `rg` 搜索完成；确认后端 `POST /projects` 已通用，前端缺少接入入口 |
| F1.2 | done | 为后端项目创建 DTO 增加导入模式可接受的配置形状。 | `apps/devpilot-api/src/project` DTO/service 范围。 | `CreateProjectDto.origin` + `ProjectService.normalizeProjectConfig` |
| F1.3 | done | 新增“接入已有项目”前端页面。 | `apps/devpilot-web/src/app/(dashboard)/projects/import`。 | 新增 `/projects/import`，提交到 `POST /projects`，支持跳过技术栈和初始化 |
| F1.4 | done | 让项目列表和详情兼容 imported/external 项目。 | `projects/page.tsx` 和 `projects/[id]/page.tsx`。 | 新增 project display helper；列表/详情展示来源、环境、栈、初始化状态 |

### F2. Webhook 与站点管控产品设计

Purpose: 回答 Git 提交后操作、代理能力、站点管控边界，并形成后续可拆任务。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F2.1 | done | 调研 Webhook/自动部署在相关产品中的做法。 | 官方文档来源，不做代码实现。 | 对照 Coolify、Portainer、Dokploy 自动部署/Webhook 文档 |
| F2.2 | done | 梳理代理能力从 ProxyConfig 演化到 Site 管控的模型。 | 文档说明，不改 Prisma 站点模型。 | 在 roadmap 文档中定义 Site/SiteRoute/TLS/Access/Ops 分层 |

### F3. 竞品差距说明

Purpose: 对照 1Panel、Coolify、Portainer、Dokploy 等产品，找出 Devpilot 目前缺失的产品能力。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F3.1 | done | 收集竞品核心能力与证据来源。 | 官方产品页/文档，避免泛化猜测。 | 覆盖 1Panel、Coolify、Portainer、Dokploy、Nginx Proxy Manager |
| F3.2 | done | 产出一份 Devpilot 能力缺口与路线建议文档。 | `docs/devpilot` 下产品说明。 | `docs/devpilot/project-onboarding-control-plane-roadmap.md` |

### F4. 验证与收尾

Purpose: 确认代码改动符合需求，不破坏现有生成项目流程。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F4.1 | done | 运行 API 与 Web 类型检查/构建。 | 仓库已有脚本。 | API/Web type-check 通过；API/Web build 通过；最终 API build 复跑通过 |
| F4.2 | done | 对照需求检查 diff，记录剩余未实现项。 | 最终自查。 | `git diff --check` 通过；Webhook 与站点模型已文档化为后续任务 |

### F5. 仅构建部署接入

Purpose: 允许已有项目只接入构建部署能力，不强制进入完整资源管控或外部资源归属模式。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F5.1 | done | 定义 deployment-only 接入的配置语义和显示语义。 | 复用 `Project.config`，不做 Prisma 迁移。 | `managementScope: deployment` + `deployment` config |
| F5.2 | done | 在接入页面新增“仅构建部署”方式和部署目标字段。 | `projects/import/page.tsx`。 | 接入方式三选一；新增部署目标、工作目录、健康检查地址 |
| F5.3 | done | 在项目列表和详情展示管理范围、构建部署配置。 | `project-display.ts`、项目列表、项目详情。 | 项目卡片显示管理范围；详情显示构建部署区块 |
| F5.4 | done | 更新产品路线文档，说明 deployment-only 场景。 | `docs/devpilot/project-onboarding-control-plane-roadmap.md`。 | 增加 `managementScope` 表与 deployment-only config 样例 |

### F6. 部署运行最小闭环

Purpose: 让 deployment-only 项目不仅能登记配置，还能创建可审计的部署运行记录和 dry-run 执行计划。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F6.1 | done | 增加 DeploymentRun 数据模型和迁移。 | Prisma schema 与 migration。 | `DeploymentRun` model + `20260625100000_deployment_runs` migration；Prisma validate/generate 通过 |
| F6.2 | done | 增加部署运行 API 和 dry-run 计划服务。 | `apps/devpilot-api/src/deployment` 与 AppModule。 | `GET /deployments/runs` + `POST /deployments/projects/:projectId/runs` |
| F6.3 | done | 在项目详情页创建部署运行并展示最近运行记录。 | `projects/[id]/page.tsx`。 | 构建部署区块支持生成 dry-run 执行计划并展示最近运行 |
| F6.4 | done | 更新路线文档，把 DeploymentRun 从规划变为 P1/P2 边界。 | `docs/devpilot/project-onboarding-control-plane-roadmap.md`。 | 文档标注 DeploymentRun dry-run 最小闭环已具备 |

### F7. Git Webhook 最小闭环

Purpose: 支持 Git push 事件进入 Devpilot，记录投递并自动生成 deployment dry-run 运行记录。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F7.1 | done | 增加 ProjectWebhook 与 WebhookDelivery 数据模型和迁移。 | Prisma schema 与 migration。 | `ProjectWebhook` / `WebhookDelivery` model + `20260625110000_project_webhooks` migration |
| F7.2 | done | 增加 Webhook 管理 API 与公开接收 API。 | `apps/devpilot-api/src/project-webhook` 与 AppModule。 | `GET/POST/PATCH /project-webhooks`、`GET /project-webhooks/deliveries`、`POST /webhooks/git/:token` |
| F7.3 | done | 在项目详情页展示 Webhook 配置、创建入口和投递记录。 | `projects/[id]/page.tsx`。 | 构建部署项目可创建 Push Webhook、查看 endpoint/secret/投递记录 |
| F7.4 | done | 更新产品路线文档，说明当前 Webhook 安全边界。 | `docs/devpilot/project-onboarding-control-plane-roadmap.md`。 | 文档说明 URL token、secret hash、自定义 secret 校验与原生签名待 raw-body |

### F8. Webhook 原生签名校验

Purpose: 让 webhook 接收端具备 GitHub/GitLab/Gitee 的真实校验能力，而不是只记录为 unchecked。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F8.1 | done | 启用 raw body 捕获并传入 webhook service。 | `main.ts` 与 public webhook controller。 | `NestFactory.create({ rawBody: true })` + `req.rawBody` |
| F8.2 | done | 将 webhook secret 存储改为 hash + encryptedSecret。 | `ProjectWebhookService` 内部格式，数据库字段不迁移。 | secret 字段存 JSON record，兼容旧 hash-only |
| F8.3 | done | 实现 GitHub HMAC 与 GitLab/Gitee token 校验。 | `ProjectWebhookService.validateSignature`。 | GitHub `x-hub-signature-256`、GitLab token、Gitee token、自定义 secret |
| F8.4 | done | 更新文档和验证记录。 | TODO 与 roadmap。 | roadmap 更新为 raw-body/HMAC 已支持，后续补重放防护和密钥轮换 |

### F9. Site 站点管控最小闭环

Purpose: 把代理能力升级成站点管控对象，支持从站点维度管理域名、运行时、TLS、访问策略和 dry-run 同步计划。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F9.1 | done | 增加 Site 数据模型和迁移。 | Prisma schema 与 migration。 | `Site` model + `20260625120000_sites` migration；Prisma validate/generate 通过 |
| F9.2 | done | 增加 Site 管理 API 与同步计划 API。 | `apps/devpilot-api/src/site` 与 AppModule。 | `GET/POST/PUT/DELETE /sites`、`POST /sites/:id/sync-plan` |
| F9.3 | done | 新增站点管控页面。 | `apps/devpilot-web/src/app/(dashboard)/sites`。 | `/sites` 支持列表、创建、删除、生成 Nginx dry-run 同步计划 |
| F9.4 | done | 在项目详情和导航中接入站点管控。 | 项目详情页与 Sidebar。 | 项目详情展示关联 Site，快捷操作进入 `/sites?new=true&projectId=...`；侧边栏新增站点管控 |
| F9.5 | done | 更新路线文档和最终验证记录。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；API/Web type-check 通过；API/Web build 通过；`git diff --check` 通过 |

### F10. Server executor adapter 基座

Purpose: 把资源动作、构建部署、站点同步统一到同一套 Server executor / adapter 契约，当前只生成稳定脚本计划，后续可替换为 SSH live transport 或 server agent executor。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F10.1 | done | 梳理当前资源动作、部署和站点同步的执行链路。 | 只读检查 resource-control/deployment/site/server 相关代码。 | 确认 ResourceControl 已有 executor 接口，Deployment/Site 仍各自手写计划 |
| F10.2 | done | 新增通用 ServerExecutorModule、接口和 script-plan adapter。 | `apps/devpilot-api/src/server-executor`。 | `ServerExecutorService` + `ScriptPlanServerExecutorAdapter` |
| F10.3 | done | ResourceControl 的 ServerScriptExecutor 复用通用 Server executor。 | `resource-control/executors`。 | Resource action 计划统一走 `ServerExecutorService` |
| F10.4 | done | DeploymentRun 复用通用 Server executor 生成执行结果。 | `apps/devpilot-api/src/deployment`。 | Deployment dry-run/live blocked 统一由 `server-executor` 输出 |
| F10.5 | done | Site sync-plan 复用通用 Server executor。 | `apps/devpilot-api/src/site`。 | Site sync-plan 返回 executor envelope 和展示步骤 |
| F10.6 | done | 更新产品文档和验证记录。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F11. ProjectEnvironment 项目环境边界

Purpose: 让项目从“单一管理容器”演进为可按 dev/test/staging/prod 划分资源、部署和站点的控制面基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F11.1 | done | 增加 ProjectEnvironment 数据模型和迁移。 | Prisma schema 与 migration。 | `ProjectEnvironment` model + `20260625130000_project_environments` migration；Prisma validate/generate 通过 |
| F11.2 | done | 增加 ProjectEnvironment API。 | `apps/devpilot-api/src/project-environment`。 | `GET/POST/PUT/DELETE /project-environments` + `POST /project-environments/sync-from-project` |
| F11.3 | done | 项目创建时从 config 初始化环境记录。 | `ProjectService.create`。 | `ProjectEnvironmentService.ensureDefaultsForProject` |
| F11.4 | done | 项目详情展示环境记录并兼容旧 config 环境。 | `projects/[id]/page.tsx`。 | 项目详情新增项目环境区块和从配置同步按钮 |
| F11.5 | done | 更新路线文档和验证记录。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F12. Site/Deployment 环境绑定

Purpose: 让站点和部署运行先具备 ProjectEnvironment 归属，为项目详情按环境组织资源和操作记录打基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F12.1 | done | Site 和 DeploymentRun 增加 environmentId 关系。 | Prisma schema 与 migration。 | `20260625140000_environment_bindings` migration；Prisma validate/generate 通过 |
| F12.2 | done | DeploymentRun 创建时支持 environmentId。 | Deployment DTO/service。 | `CreateDeploymentRunDto.environmentId`，创建时校验并回填 environment key |
| F12.3 | done | Site 创建/更新时支持 environmentId。 | Site DTO/service。 | Site binding 校验环境必须属于同项目 |
| F12.4 | done | 前端站点创建与项目详情展示环境绑定。 | sites page 与 project detail。 | 站点创建可选择项目环境；项目详情显示站点/部署环境 |
| F12.5 | done | 更新文档和验证记录。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F13. SSH live Server executor adapter

Purpose: 在不安装 agent 的前提下，为 Server executor 增加默认关闭的 SSH live adapter，只有显式配置开启、非 dry-run、key auth 且确认文本匹配时才执行稳定脚本。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F13.1 | done | 实现 SSH live adapter。 | `apps/devpilot-api/src/server-executor/adapters`。 | `SshLiveServerExecutorAdapter` 默认关闭，支持 key auth + 确认文本 |
| F13.2 | done | 接入 ServerExecutorService adapter 路由。 | `server-executor.service/module`。 | `ssh-live` 优先，`script-plan` 兜底 |
| F13.3 | done | 更新 capabilities 和文档安全边界。 | resource-control capabilities 与 roadmap。 | capabilities/roadmap 已说明默认关闭与限制 |
| F13.4 | done | 运行验证。 | API/Web type-check/build 与 diff check。 | Prisma validate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F14. 环境资源绑定闭环

Purpose: 让项目环境成为服务器、Docker/云资源、资源申请实例、CDN 和密钥的统一归属边界，为按环境执行部署、审计和授权打基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F14.1 | done | 新增环境服务器绑定表和资源 environmentId 外键。 | Prisma schema 与 migration。 | `ProjectEnvironmentServer` + `20260625150000_environment_resource_bindings` migration；Prisma validate/generate 通过 |
| F14.2 | done | ProjectEnvironment API 支持绑定/解绑服务器。 | `apps/devpilot-api/src/project-environment`。 | `GET/POST/DELETE /project-environments/:id/servers` |
| F14.3 | done | ResourceControl 同步和清单支持 environmentId。 | `apps/devpilot-api/src/resource-control`。 | Docker/云资源同步可写入 projectId/environmentId；清单可按环境过滤；服务器同步自动补环境-服务器绑定 |
| F14.4 | done | ResourceRequest/ResourceInstance 支持 environmentId。 | `apps/devpilot-api/src/resource-request`。 | 创建申请可绑定环境，交付实例继承环境 |
| F14.5 | done | CDNConfig 和 SecretKey 支持 environmentId。 | `apps/devpilot-api/src/cdn-config`、`apps/devpilot-api/src/key-center`。 | 创建/更新时校验环境必须属于项目，并在列表/详情返回环境信息 |
| F14.6 | done | 项目详情和资源管控页展示环境资源归属。 | `projects/[id]`、`resource-control`。 | 项目环境卡片显示服务器/站点/部署/资源/CDN/密钥计数；资源管控页支持环境范围选择 |
| F14.7 | done | 运行验证。 | Prisma、API/Web type-check/build 与 diff check。 | Prisma validate/generate 通过；API/Web type-check 通过；API/Web build 通过；`git diff --check` 通过 |

### F15. Application/Service 工作区最小闭环

Purpose: 把项目环境中的服务器、站点、Docker/云资源和部署配置组织成“应用/服务”视角，让控制平台能围绕服务做部署、日志、监控、回滚和告警。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F15.1 | done | 设计 Application 与 ApplicationService 数据模型。 | Prisma schema 与 migration。 | `Application`、`ApplicationService`、`DeploymentRun.applicationId/applicationServiceId` + `20260625160000_application_services` migration；Prisma validate 通过 |
| F15.2 | done | 实现 Application API。 | `apps/devpilot-api/src/application` 与 AppModule。 | `GET/POST/PUT/DELETE /applications` + `POST/PUT/DELETE /applications/:id/services`；API type-check 通过 |
| F15.3 | done | DeploymentRun 支持绑定 Application/Service。 | Deployment DTO/service。 | `CreateDeploymentRunDto`/query 支持 applicationId/applicationServiceId，服务 deployConfig 可作为部署配置来源；API type-check 通过 |
| F15.4 | done | 新增应用服务前端页面并接入导航。 | `apps/devpilot-web/src/app/(dashboard)/applications` 与 Sidebar。 | `/applications` 支持应用创建、服务添加、服务 dry-run 部署计划；Sidebar 新增应用服务 |
| F15.5 | done | 项目详情展示应用服务概览。 | `projects/[id]/page.tsx`。 | 项目详情展示应用、服务、环境、服务器、站点、资源和部署次数 |
| F15.6 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F16. 服务运行态操作最小闭环

Purpose: 让 ApplicationService 具备基础运维动作入口，把状态检查、日志查看、重启和回滚计划都纳入 Server executor 与运行记录，为后续真实执行、审计、告警和回滚做铺垫。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F16.1 | done | 新增 ApplicationServiceOperationRun 数据模型。 | Prisma schema 与 migration。 | `ApplicationServiceOperationRun` + `20260626001000_application_service_operation_runs` migration；Prisma validate 通过 |
| F16.2 | done | Application API 增加服务操作运行接口。 | `apps/devpilot-api/src/application`。 | `GET/POST /applications/:id/services/:serviceId/operations`；API type-check 通过 |
| F16.3 | done | 服务操作复用 ServerExecutor。 | `ApplicationService` + ServerExecutor。 | status/logs/restart/rollback 生成 `application-service-runtime-plan` dry-run plan；API type-check 通过 |
| F16.4 | done | 前端应用服务页接入运行态操作。 | `/applications` 页面。 | 服务行支持状态、日志、重启、回滚 dry-run 操作按钮，并展示最近操作 |
| F16.5 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F17. 统一审计事件最小闭环

Purpose: 把部署、资源动作、服务操作等控制面行为沉淀为统一审计流，形成后续权限治理、告警、回滚责任链和合规查询的基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F17.1 | done | 新增 AuditEvent 数据模型。 | Prisma schema 与 migration。 | `AuditEvent` model + `20260626004500_audit_events` migration；Prisma validate/generate 通过 |
| F17.2 | done | 实现 AuditEvent API 与服务。 | `apps/devpilot-api/src/audit-event` 与 AppModule。 | `GET /audit-events` 支持团队范围筛选查询，`AuditEventService.create` 供内部控制面动作写入 |
| F17.3 | done | 接入部署、资源动作、服务操作审计写入。 | Deployment/ResourceControl/Application service。 | DeploymentRun、ResourceActionRun、ApplicationServiceOperationRun 完成/失败/阻塞后写入统一审计事件 |
| F17.4 | done | 新增审计事件页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/audit-events` 与 Sidebar。 | `/audit-events` 展示最近审计流、统计、分类/状态/风险过滤；Sidebar 新增审计事件 |
| F17.5 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F18. 高风险操作审批最小闭环

Purpose: 在审计事件之后补上执行治理第一层，让非 dry-run 的高风险/维护类操作先进入审批队列，管理员批准后才能再次尝试 live 执行。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F18.1 | done | 新增 OperationApproval 数据模型。 | Prisma schema 与 migration。 | `OperationApproval` model + `20260626012000_operation_approvals` migration；Prisma validate/generate 通过 |
| F18.2 | done | 实现 OperationApproval API 与服务。 | `apps/devpilot-api/src/operation-approval` 与 AppModule。 | `GET /operation-approvals`、`POST /operation-approvals/:id/review`，并支持内部创建、校验、消费已批准审批 |
| F18.3 | done | 接入资源动作和服务操作审批门禁。 | ResourceControl/Application service。 | 非 dry-run 中高风险资源动作/服务操作会生成 pending approval；已批准审批可用于重试执行；API type-check 通过 |
| F18.4 | done | 新增操作审批页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/operation-approvals` 与 Sidebar。 | `/operation-approvals` 展示审批流、支持批准/拒绝和执行已批准动作；资源管控/应用服务页可申请 Live；Web type-check 通过 |
| F18.5 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F19. Server executor 命令策略最小闭环

Purpose: 在审批之后补上 live 执行前的命令白名单/策略门禁，确保 Server executor 只能执行已知来源和已知形态的命令计划。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F19.1 | done | 新增 ServerCommandPolicy 服务和结果类型。 | `apps/devpilot-api/src/server-executor`。 | `ServerCommandPolicyService` + `ServerCommandPolicyResult`，支持内置基线规则、危险命令检测和阻断原因 |
| F19.2 | done | 在 ServerExecutorService 统一接入策略校验。 | Server executor service/adapters。 | `ServerExecutorService.execute` 在 adapter 前执行策略；未通过时统一返回 blocked |
| F19.3 | done | 让执行计划返回策略结果。 | commandPlan/result/logs。 | 策略结果进入 commandPlan metadata/safety/result；资源管控 capabilities 展示命令策略安全边界；API type-check 通过 |
| F19.4 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；API/Web type-check、API/Web build、`git diff --check` 通过 |

### F20. 资源备份计划最小闭环

Purpose: 让数据库/Redis/RDS 等托管资源具备备份计划和备份运行记录，先生成 dry-run 执行计划并进入统一审计，为后续真实备份、恢复和告警打基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F20.1 | done | 新增 BackupPlan 和 BackupRun 数据模型。 | Prisma schema 与 migration。 | `BackupPlan` / `BackupRun` model + `20260626021500_backup_plans` migration；审计事件可关联 backupRun |
| F20.2 | done | 实现备份计划 API 与执行计划。 | `apps/devpilot-api/src/backup` 与 AppModule。 | `GET/POST/PUT /backups/plans`、`POST /backups/plans/:id/runs`、`GET /backups/runs`；支持 Docker MySQL/Redis 和 RDS dry-run 计划 |
| F20.3 | done | 新增备份管理页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/backups` 与 Sidebar。 | `/backups` 支持创建计划、暂停/启用、生成 dry-run 和查看运行记录；Sidebar 新增备份计划 |
| F20.4 | done | 接入审计和 Server executor 命令策略。 | AuditEvent 与 ServerCommandPolicy。 | 备份运行写入 `backup` 审计事件；`backup-script-plan` 接入 MySQL/Redis 备份命令白名单 |
| F20.5 | done | 更新文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F21. 监控告警最小闭环

Purpose: 让项目/环境/服务/服务器/站点/备份具备统一的告警规则和告警事件，先支持手动评估和控制面可见，为后续真实指标采集、通知渠道和 SLO 做铺垫。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F21.1 | done | 新增 AlertRule 和 AlertEvent 数据模型。 | Prisma schema 与 migration。 | `AlertRule` / `AlertEvent` model + `20260626024500_monitoring_alerts` migration；Prisma validate/generate 通过 |
| F21.2 | done | 实现告警规则 API 与手动评估。 | `apps/devpilot-api/src/monitoring` 与 AppModule。 | `GET/POST/PUT /monitoring/alert-rules`、`POST /monitoring/alert-rules/:id/evaluate`、`GET /monitoring/alert-events`、ack API；API type-check 通过 |
| F21.3 | done | 将告警事件接入统一审计。 | AuditEvent 与 MonitoringService。 | AlertEvent 可关联 AuditEvent；手动评估/确认告警写入 `alert` 审计事件 |
| F21.4 | done | 新增监控告警页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/monitoring` 与 Sidebar。 | `/monitoring` 支持创建规则、手动评估、查看/确认事件；Sidebar 新增监控告警；Web type-check 通过 |
| F21.5 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F22. 日志中心最小闭环

Purpose: 让服务、站点、服务器、资源、部署、备份和告警的日志片段具备统一归档、查询和项目/环境归属，先支持手动归档和控制面检索，为后续真实日志流、SLS/COS 日志源和 Server executor tail 采集做铺垫。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F22.1 | done | 新增 LogStream 和 LogEntry 数据模型。 | Prisma schema 与 migration。 | `LogStream` / `LogEntry` model + `20260626031200_log_center` migration；Prisma validate/generate 通过 |
| F22.2 | done | 实现日志流 API 和手动归档入口。 | `apps/devpilot-api/src/log-center` 与 AppModule。 | `GET/POST/PUT /logs/streams`、`GET /logs/entries`、`POST /logs/streams/:id/entries`；API type-check 通过 |
| F22.3 | done | 将日志归档接入统一审计。 | AuditEvent 与 LogCenterService。 | LogStream/LogEntry 可关联 AuditEvent；追加日志写入 `log` 审计事件 |
| F22.4 | done | 新增日志中心页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/logs` 与 Sidebar。 | `/logs` 支持创建日志流、追加日志、搜索条目和查看目标归属；Sidebar 新增日志中心；Web type-check 通过 |
| F22.5 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F23. 日志采集运行最小闭环

Purpose: 让日志中心从手动归档进入可执行采集计划阶段，先通过 Server executor 生成 Docker/Nginx/服务器日志 tail 的 dry-run 采集运行，并为 SLS 等云日志源保留 provider adapter 边界。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F23.1 | done | 新增 LogCollectionRun 数据模型和迁移。 | Prisma schema 与 migration。 | `LogCollectionRun` model + `20260626033200_log_collection_runs` migration；Prisma validate/generate 通过 |
| F23.2 | done | 实现日志采集运行 API。 | `apps/devpilot-api/src/log-center`。 | `GET /logs/collection-runs`、`POST /logs/streams/:streamId/collect`；API type-check 通过 |
| F23.3 | done | 采集计划接入 Server executor 和命令策略。 | LogCenterService 与 ServerCommandPolicy。 | Docker logs、Docker Compose logs、Nginx/var-log tail 进入 `log-collection-plan` 白名单；真实执行仍默认阻断 |
| F23.4 | done | 将采集运行接入统一审计。 | AuditEvent 与 LogCenterService。 | `AuditEvent.logCollectionRunId`；采集计划写入 `log.collect` 审计事件 |
| F23.5 | done | 前端日志中心展示采集运行。 | `/logs` 页面。 | 选中日志流可生成 dry-run 采集计划，并展示最近采集运行、状态、tail、错误信息；Web type-check 通过 |
| F23.6 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F24. 资源连接探测最小闭环

Purpose: 让 Docker MySQL/Redis、RDS、SLS、COS 等托管资源具备可追踪的连接/授权探测运行记录，先生成 Credential/Auth adapter 与 Executor adapter 的 dry-run/blocked-live 计划，不直接泄露凭证或连接线上资源。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F24.1 | done | 新增 ResourceConnectionRun 数据模型和迁移。 | Prisma schema 与 migration。 | `ResourceConnectionRun` model + `20260626041000_resource_connection_runs` migration；Prisma validate/generate 通过 |
| F24.2 | done | 实现资源连接探测 API。 | `apps/devpilot-api/src/resource-control`。 | `GET /resource-control/connection-runs`、`POST /resource-control/resources/:resourceId/connection-probe`；API type-check 通过 |
| F24.3 | done | 连接探测接入 Credential/Auth 和 Executor adapter 边界。 | ResourceControlService、DefaultCredentialResolver、ServerExecutor。 | Server 资源走 `server-ssh` + `resource-connection-plan`；云资源走 TeamCredential/provider SDK plan；direct-db adapter 标记为 planned |
| F24.4 | done | 连接探测接入 Server executor 命令策略和统一审计。 | ServerCommandPolicy 与 AuditEvent。 | Docker inspect、MySQL ping、Redis PING 进入白名单；`AuditEvent.resourceConnectionRunId` 写入 `resource_connection` 审计事件 |
| F24.5 | done | 前端资源管控页展示连接探测。 | `/resource-control` 页面。 | 资源行支持生成连接探测计划，最近连接探测展示 status/authAdapter/executor/endpoint/error；Web type-check 通过 |
| F24.6 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F25. 资源只读查询/浏览运行最小闭环

Purpose: 在连接探测之后，为 MySQL/RDS、Redis、SLS、COS 等资源建立可审计的只读查询/浏览运行对象，先生成 read-only query plan 和 adapter 边界，后续再接真实 driver/provider SDK。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F25.1 | done | 新增 ResourceQueryRun 数据模型和迁移。 | Prisma schema 与 migration。 | `ResourceQueryRun` model + `20260626043000_resource_query_runs` migration；Prisma validate/generate 通过 |
| F25.2 | done | 实现资源只读查询 API。 | `apps/devpilot-api/src/resource-control`。 | `GET /resource-control/query-runs`、`POST /resource-control/resources/:resourceId/query-runs`；API type-check 通过 |
| F25.3 | done | 建立 read-only query adapter 计划边界。 | ResourceControlService。 | SQL 仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN；Redis 仅允许 SCAN/INFO/PING/TTL/TYPE/EXISTS；SLS/COS 生成 provider SDK read plan |
| F25.4 | done | 将查询运行接入统一审计。 | AuditEvent 与 ResourceControlService。 | `AuditEvent.resourceQueryRunId`；查询计划写入 `resource_query` 审计事件 |
| F25.5 | done | 前端资源管控页展示只读查询运行。 | `/resource-control` 页面。 | 资源行支持生成默认只读查询计划，最近只读查询展示 queryType/query/authAdapter/executor/error；Web type-check 通过 |
| F25.6 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F26. 资源绑定与可配置只读查询面板

Purpose: 让已发现资源可以在资源管控页重新绑定环境、服务器和 TeamCredential，并把只读查询从默认一键计划升级为可配置的操作面板，为后续真实 Credential/Auth adapter 与 driver/provider SDK 执行做准备。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F26.1 | done | 增加 ManagedResource 绑定更新 API。 | `apps/devpilot-api/src/resource-control` DTO/controller/service，不新增数据表。 | `PUT /resource-control/resources/:resourceId/binding` 支持更新 environment/server/credential 绑定并校验团队归属 |
| F26.2 | done | 绑定更新写入统一审计事件。 | ResourceControlService + AuditEventService。 | 绑定变更写入 `resource_binding` / `resource.binding.update` 审计事件 |
| F26.3 | done | 资源管控页加载 TeamCredential 并支持云同步选择凭据。 | `/resource-control` 页面与现有 `/team-credentials` API。 | 云资源同步表单可选择 TeamCredential，传入 `credentialId` |
| F26.4 | done | 资源行支持打开绑定面板并提交环境/服务器/凭据绑定。 | `/resource-control` 页面。 | 资源行新增绑定按钮；绑定面板可保存环境/服务器/凭据 |
| F26.5 | done | 只读查询支持选择资源后编辑 queryType/query/limit/prefix 再生成计划。 | `/resource-control` 页面，复用 `POST /query-runs`。 | 只读查询按钮打开查询面板，提交 queryType/query/limit/prefix |
| F26.6 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F27. 云凭据管理最小闭环

Purpose: 让 RDS、SLS、COS 等云资源在资源管控页就能创建和选择云 TeamCredential，并通过类型化 Credential profile 暴露 Credential/Auth adapter 边界，为后续 provider SDK 真实连接、查询和备份执行做准备。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F27.1 | done | 在 ResourceControl capabilities 中暴露云凭据 profile。 | `ResourceControlService.getCapabilities`，不新增数据表。 | capabilities 新增 `credentialProfiles`，覆盖 `cloud_aliyun` 和 `cloud_tencent` |
| F27.2 | done | 资源管控页增加云凭据创建面板。 | `/resource-control` 页面，复用 `/team-credentials` API。 | 新增云凭据面板，可创建 `cloud_aliyun` / `cloud_tencent` TeamCredential |
| F27.3 | done | 云同步和资源绑定选择凭据时优先展示兼容云凭据。 | `/resource-control` 页面本地筛选逻辑。 | 云同步按 provider 筛选可选凭据；资源绑定按资源 provider 筛选并保留当前选中项 |
| F27.4 | done | 云凭据列表脱敏展示并支持删除。 | `/resource-control` 页面与 `/team-credentials/:id`。 | 云凭据列表仅展示名称、类型和创建时间；支持调用删除 API |
| F27.5 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F28. 只读查询结果预览与 adapter 契约

Purpose: 在真实 driver/provider SDK 接入前，先固定 ResourceQueryRun 的执行结果结构，让 SQL、Redis、SLS、COS 查询都返回统一的结果预览、分页、脱敏和 live 前置条件契约，后续真实 adapter 只替换数据来源。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F28.1 | done | 后端 ResourceQueryRun.result 增加统一 preview/pageInfo/redaction/livePrerequisites 结构。 | ResourceControlService，不新增 Prisma 字段。 | `ResourceQueryRun.result` 新增 `adapterState`、`preview`、`livePrerequisites` |
| F28.2 | done | queryPlan 增加 resultContract 与 livePrerequisites。 | ResourceControlService。 | `queryPlan` 新增 `resultContract`、`livePrerequisites`、复用 plannedCalls |
| F28.3 | done | 资源管控页展示最近查询结果预览和 adapter 状态。 | `/resource-control` 页面。 | 最近只读查询记录展示 preview table、adapterState、pageInfo 和 livePrerequisites |
| F28.4 | done | capabilities 和路线文档标注查询 adapter 进入 result-preview 阶段。 | ResourceControlService + roadmap/TODO。 | query adapter `currentStatus` 更新为 `dry_run_plan_with_result_preview_contract`；roadmap 已更新 |
| F28.5 | done | 运行验证。 | Prisma、API/Web type-check/build、diff check。 | Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F29. DB/Redis 只读账号凭据绑定

Purpose: 在结果预览契约之后，给 MySQL/RDS 和 Redis 查询补上专用只读账号凭据 profile 与资源级 queryCredential 绑定，避免把云账号、服务器 SSH 和数据库账号混成同一个凭据，为后续真实 driver live read 做准备。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F29.1 | done | capabilities 增加 DB/Redis readonly credential profiles。 | ResourceControlService，不新增数据表。 | capabilities 新增 `db_mysql_readonly` / `db_redis_readonly` profiles |
| F29.2 | done | ManagedResource 绑定 API 支持 queryCredentialId。 | ResourceControl DTO/service，写入 `config.credentialBindings.queryCredentialId`。 | `UpdateManagedResourceBindingDto.queryCredentialId` 写入资源 config 的 `credentialBindings.queryCredentialId` |
| F29.3 | done | ResourceQueryRun 使用 queryCredential resolver 区分 direct_db 和 provider/server 凭据。 | ResourceControlService。 | DB/Redis 查询优先解析 queryCredentialId 为 `direct_db`，livePrerequisites 能识别 readonly credential ready/missing |
| F29.4 | done | 资源管控页支持创建 DB/Redis 只读凭据并绑定到资源查询。 | `/resource-control` 页面。 | 操作凭据面板支持创建 DB/Redis readonly TeamCredential；资源绑定面板新增查询凭据下拉 |
| F29.5 | done | 更新路线文档并运行验证。 | roadmap/TODO 与 build 检查。 | roadmap 已更新；Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过 |

### F30. DB/Redis 真实只读查询 adapter

Purpose: 在 DB/Redis 查询凭据绑定之后，补上可真实执行的只读 driver adapter，让资源管控从“只生成查询计划和结果契约”推进到“在明确 dryRun=false 且有只读凭据/确认参数时，可以安全读取真实 MySQL/Redis 资源”。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F30.1 | done | 后端修正 ResourceQueryRun 凭据解析并新增 direct_db live readonly driver。 | ResourceControlService + resource-control executor/credential 边界，不新增 Prisma 字段。 | 查询 run 使用 queryCredentialId/TeamCredential；MySQL/Redis live adapter 在 `dryRun=false` + `confirmLiveRead=true` 后返回统一 preview/result |
| F30.2 | done | 资源管控页增加真实只读查询触发入口和凭据状态提示。 | `/resource-control` 页面。 | DB/Redis 面板可选择生成计划或执行只读查询，缺少查询凭据时阻止 live |
| F30.3 | done | 更新路线文档，标注 DB/Redis readonly adapter 的当前能力和剩余边界。 | roadmap/TODO。 | P5 状态已推进到 DB/Redis live readonly 已接入，SLS/COS/RDS SDK 待补 |
| F30.4 | done | 运行验证。 | Prisma、API/Web type-check/build、diff check。 | Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 DB/Redis 凭据做 live smoke |

### F31. Docker Server executor live action

Purpose: 在 Server executor adapter 基础之上，把服务器维度 Docker 资源从“只生成计划”推进到“可在 live transport 开启后执行受控 read/restart 动作”，为后续以服务器维度管理所有 Docker 容器打基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F31.1 | done | 后端开放 Docker/服务器只读动作 live 执行，并修正命令白名单兼容性。 | ResourceAction definitions、ServerScriptExecutor、ServerCommandPolicy，不新增 Prisma 字段。 | inspect/logs/mysql ping/redis info 可走 live；restart 保持审批与确认；docker logs 命令匹配白名单 |
| F31.2 | done | 资源管控页增加 Live 执行动作入口，区分直接 live 与审批 live。 | `/resource-control` 页面。 | read 动作显示执行 Live；mutating/maintenance 动作显示申请 Live；仅暴露当前 Server executor live 支持的动作 |
| F31.3 | done | 更新路线文档，标注 Docker Server executor live 能力和开关边界。 | roadmap/TODO。 | roadmap 已说明 Docker action live 需要 `SERVER_EXECUTOR_LIVE_ENABLED=true` 与 SSH key auth |
| F31.4 | done | 运行验证。 | API/Web type-check/build、diff check。 | API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 SSH 服务器做 live smoke |

### F32. Site Nginx/OpenResty live sync

Purpose: 在 Site dry-run 同步计划基础上，让站点配置进入 Server executor live sync 边界。先支持写入 Nginx 配置、可选 certbot、`nginx -t` 和 reload，并把状态、错误和审计记录落回 Devpilot。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F32.1 | done | 后端 Site sync-plan 支持 live sync 状态更新与审计记录。 | SiteService/SiteModule，复用现有 Site 字段，不新增 Prisma 字段。 | `dryRun=false` 走 Server executor，完成后更新 `lastSyncAt/status/syncError`，并写入 AuditEvent |
| F32.2 | done | 站点页增加执行同步入口、确认和执行结果展示。 | `/sites` 页面。 | 保留同步计划按钮，新增执行同步按钮；执行前确认站点名称；显示执行状态和错误 |
| F32.3 | done | 更新路线文档，记录 Nginx/OpenResty live sync 能力和边界。 | roadmap/TODO。 | P3 状态推进到 live sync 边界，仍待补日志、模块、证书生命周期 |
| F32.4 | done | 运行验证。 | API/Web type-check/build、diff check。 | API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 Nginx/OpenResty 服务器做 live smoke |

### F33. Site 同步运行历史与回滚

Purpose: 在 Site live sync 之后补齐运维历史和回滚能力。每次 dry-run/live/rollback 都要形成 SiteSyncRun，保留 Nginx 配置快照、执行计划、状态和结果；成功运行可以作为回滚源，重新写入配置、校验并 reload。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F33.1 | done | 新增 SiteSyncRun 数据模型与列表 API。 | Prisma schema + Site API，不改变现有 Site 字段语义。 | `SiteSyncRun` model + `GET /sites/:id/sync-runs` 返回最近同步运行 |
| F33.2 | done | Site sync-plan 写入 SiteSyncRun，并支持基于成功 run 的 rollback。 | SiteService + Server executor。 | `POST /sites/:id/sync-runs/:runId/rollback` 基于成功 live run 生成 rollback run |
| F33.3 | done | 站点页展示最近同步运行并提供回滚按钮。 | `/sites` 页面。 | 展示 dry-run/live/rollback、状态、时间、错误，成功 live run 可回滚 |
| F33.4 | done | 更新路线文档，标注 Site 回滚闭环和剩余边界。 | roadmap/TODO。 | P3 记录同步历史与回滚已接入，完整配置 diff/审批待补 |
| F33.5 | done | 运行验证。 | Prisma、API/Web type-check/build、diff check。 | Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 Nginx/OpenResty 服务器做 live rollback smoke |

### F34. Site 配置 diff 与审批化执行

Purpose: 让 Site live sync/rollback 从“可执行”升级为“可治理执行”。每次计划要能对比最近成功配置快照，展示配置 diff；非 dry-run 的 sync/rollback 先生成 OperationApproval 和 blocked SiteSyncRun，批准后从审批页执行并消费审批单。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F34.1 | done | 新增 F34 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Site diff/审批化执行范围 |
| F34.2 | done | SiteSyncRun 增加 configDiff 和 operationApprovalId。 | Prisma schema + migration，关联 OperationApproval。 | run 可追踪审批单和配置差异 |
| F34.3 | done | Site sync/rollback 生成配置 diff，并对非 dry-run 操作进入审批门禁。 | SiteService + OperationApprovalService。 | 未带 approved approvalId 时返回 blocked run 和 pending approval；申请人或审批人可消费审批单 |
| F34.4 | done | 站点页展示配置 diff/审批状态，审批页可执行已批准的 Site 操作。 | `/sites` 与 `/operation-approvals` 页面。 | 站点计划显示 diff；审批页支持 site_sync 执行 sync/rollback |
| F34.5 | done | 更新路线文档，标注 Site 执行治理阶段。 | roadmap/TODO。 | P3 从回滚闭环推进到 diff/approval gated live execution |
| F34.6 | done | 运行验证。 | Prisma、API/Web type-check/build、diff check。 | Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 Nginx/OpenResty 服务器做 live approval rollback smoke |

### F35. Server executor 并发治理最小闭环

Purpose: 在审批和命令策略之后，为 Server executor 补上 live 执行互斥门禁。同一团队同一服务器默认只允许一个非 dry-run Server executor 执行持有 lease；并发冲突返回标准 blocked 结果，避免多个资源/部署/站点操作同时 reload、restart 或写配置。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F35.1 | done | 新增 F35 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Server executor lease/concurrency 范围 |
| F35.2 | done | 新增 ServerExecutionLease 数据模型与迁移。 | Prisma schema + migration。 | `ServerExecutionLease` 记录 team/server/actor/operation/adapter/status/lease 时间 |
| F35.3 | done | ServerExecutorService 在 live 执行前 acquire lease，完成后 release。 | `apps/devpilot-api/src/server-executor`。 | 冲突时返回 blocked 结果并记录 blocked lease；成功/失败/阻塞都释放 running lease |
| F35.4 | done | 更新路线文档，标注并发门禁已接入和完整队列待补。 | roadmap/TODO。 | P8 从命令策略推进到 live execution lease，完整队列/取消/重试待补 |
| F35.5 | done | 运行验证。 | Prisma、API type-check/build、Web build、diff check。 | Prisma validate/generate、API/Web type-check、API/Web build、`git diff --check` 通过；未连接真实 SSH 服务器做并发 live smoke |

### F36. Server executor 执行治理可视化

Purpose: 让 live execution lease 从“后端门禁”变成可观察的控制面对象。团队成员可以查看 running/blocked/completed/failed/expired leases，按服务器和状态筛选，管理员可以手动释放过期 lease，为后续完整队列、取消、重试和执行历史页面打基础。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F36.1 | done | 新增 F36 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Server executor lease visibility 范围 |
| F36.2 | done | 新增 ServerExecutionLease 查询 API 和释放过期接口。 | `server-executor` module/controller/service。 | `GET /server-execution-leases`、`POST /server-execution-leases/expire-stale` |
| F36.3 | done | 新增执行治理页面并接入导航。 | `apps/devpilot-web/src/app/(dashboard)/execution-governance` 与 Sidebar。 | 展示指标、筛选、lease 列表、手动释放过期 |
| F36.4 | done | 更新路线文档，标注执行治理可见性已接入。 | roadmap/TODO。 | P8 从 lease 门禁推进到可视化 |
| F36.5 | done | 运行验证。 | API/Web type-check/build、diff check。 | type-check/build/diff check 通过 |

### F37. Server executor 执行任务与重试入口

Purpose: 在 lease 可视化之后补上执行治理第二层：每次 Server executor 执行都沉淀为 execution job，保留输入快照、状态、执行结果和错误；团队成员可以查看任务历史，管理员可以取消尚未真正运行的任务，并从 failed/blocked/cancelled 任务发起重试。异步 worker、进程级 kill 和自动队列调度仍留作后续 F38。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F37.1 | done | 新增 F37 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Server executor job history/cancel/retry 范围 |
| F37.2 | done | 新增 ServerExecutionJob 数据模型与迁移。 | Prisma schema + migration。 | job 记录 team/server/actor/operation/status/inputSnapshot/result/retryOf |
| F37.3 | done | ServerExecutorService 记录 job，并提供列表、取消、重试接口。 | `apps/devpilot-api/src/server-executor`。 | `GET /server-execution-jobs`、`POST /:id/cancel`、`POST /:id/retry` |
| F37.4 | done | 执行治理页面接入 job 列表和重试/取消操作。 | `apps/devpilot-web/src/app/(dashboard)/execution-governance`。 | 页面展示任务历史、状态、尝试次数、错误和操作按钮 |
| F37.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F38. Server executor 异步队列 worker 与运行中取消信号

Purpose: 在 job history/retry 之后补上执行治理第三层：ServerExecutionJob 可以进入 queued 状态，后台 worker 或管理员手动触发后领取队列任务执行；running job 可以记录 cancel request，并在同进程执行时把取消信号传给 adapter；失败/阻塞任务可以按 maxAttempts 自动排入下一次 retry。分布式队列、多实例锁租约、跨进程 kill 和业务 run 异步化仍留作后续。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F38.1 | done | 新增 F38 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 queued job worker/cancel signal/auto retry 范围 |
| F38.2 | done | 扩展 ServerExecutionJob 队列控制字段与迁移。 | Prisma schema + migration。 | queueMode、availableAt、lockOwner、lockedAt、cancelRequestedAt 等字段 |
| F38.3 | done | ServerExecutorService 支持 queued job 领取、执行、自动重试和 running cancel signal。 | `apps/devpilot-api/src/server-executor`。 | `processNextQueuedJob`、定时 worker、adapter cancellation token |
| F38.4 | done | 执行治理 API/UI 支持处理队列、queue retry 和 running cancel。 | Controller + execution-governance page。 | 管理员可手动处理下一个 queued job；重试默认进入 queue |
| F38.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F39. Server executor 多实例锁租约与僵尸任务恢复

Purpose: 在 queued worker 基座之后补上生产化执行治理的锁租约层。每个 running ServerExecutionJob 都要有 lockExpiresAt 和心跳续租；worker 处理队列前先恢复过期 running job，管理员也可以手动恢复僵尸任务。恢复时把过期任务标记为 failed/stale，并在 maxAttempts 未耗尽时自动创建下一次 queued retry。跨进程 kill 和业务 run 全量异步化仍留作后续。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F39.1 | done | 新增 F39 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 lock lease/heartbeat/stale recovery 范围 |
| F39.2 | done | 扩展 ServerExecutionJob 锁租约和恢复字段。 | Prisma schema + migration。 | lockExpiresAt、recoveredAt、recoveryReason、recoveryCount |
| F39.3 | done | ServerExecutorService 支持 heartbeat 续租和 stale running job 恢复。 | `apps/devpilot-api/src/server-executor`。 | running job 周期续租；worker/manual 恢复 stale job |
| F39.4 | done | 执行治理 API/UI 支持恢复僵尸任务并展示租约。 | Controller + execution-governance page。 | 管理员可手动恢复过期 running job；页面展示 lock owner/expires |
| F39.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F40. Server executor 命令策略模板

Purpose: 在内置命令白名单和危险命令检测之后，补上团队/项目/环境级策略模板。模板可以按 adapter、operation、project、environment 限定作用域，额外 block 命令模式，也可以在危险命令基线之外扩展 allow pattern。所有 Server executor 执行先跑危险命令基线，再合并匹配模板，最后给出 policyKey/template 证据。完整 RBAC、审批 DSL 和脚本市场仍留作后续。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F40.1 | done | 新增 F40 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 policy template 范围 |
| F40.2 | done | 新增 ServerCommandPolicyTemplate 数据模型与迁移。 | Prisma schema + migration。 | team/project/environment scope、adapter/operation filters、allow/block patterns |
| F40.3 | done | 实现策略模板 API 并接入 ServerCommandPolicyService。 | `apps/devpilot-api/src/server-executor`。 | `GET/POST/PATCH/DELETE /server-command-policy-templates`；evaluate 合并模板 |
| F40.4 | done | 增加执行策略页面和导航入口。 | `apps/devpilot-web/src/app/(dashboard)/execution-policies` 与 Sidebar。 | 团队管理员可创建、编辑、启停、删除策略模板 |
| F40.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F41. DeploymentRun 接入 Server executor 队列桥

Purpose: 在已有 ServerExecutionJob 队列/worker 基座之上，把业务 run 异步化从“执行治理页面可重试”推进到“部署主链路可直接入队”。第一步先打通通用 `queueExecution` 契约和 DeploymentRun 队列执行：创建部署运行时可选择 queue，业务记录保存 `serverExecutionJobId`、返回 queued 状态，并由 worker 执行后回写 DeploymentRun 的最终结果。SiteSyncRun、ResourceActionRun、ApplicationServiceOperationRun、BackupRun 和 LogCollectionRun 已在后续 F42-F46 迁移。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F41.1 | done | 新增 F41 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 DeploymentRun queue bridge 范围 |
| F41.2 | done | 增加 DeploymentRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `serverExecutionJobId` 可追踪 queued job |
| F41.3 | done | 为 ServerExecutorService 增加 `queueExecution` 和 queued result 契约。 | `apps/devpilot-api/src/server-executor`。 | 业务服务可创建 queued job 并得到标准 result |
| F41.4 | done | DeploymentService 支持 `queue` 创建部署运行并由 worker 回写结果。 | `apps/devpilot-api/src/deployment` + worker sync。 | queued DeploymentRun 保存 job id；worker 完成后同步状态 |
| F41.5 | done | 前端部署入口支持排队执行。 | 项目详情和应用服务部署入口。 | 用户可选择“加入队列”，列表能看到 queued/job id |
| F41.6 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F42. SiteSyncRun 接入 Server executor 队列桥

Purpose: 在 DeploymentRun 队列桥之后，把站点同步/回滚也接入同一套 ServerExecutionJob 队列治理。站点同步仍保留审批门禁、配置 diff、Nginx 配置快照和 rollback 语义；queue 只改变执行时机，不绕过审批。worker 完成后需要回写 SiteSyncRun 和 Site 状态，使站点管控从“同步调用 Server executor”推进到“可排队、可治理、可追踪的 Site 运维动作”。ResourceActionRun、ApplicationServiceOperationRun、BackupRun 和 LogCollectionRun 已在后续 F43-F46 迁移。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F42.1 | done | 新增 F42 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 SiteSyncRun queue bridge 范围 |
| F42.2 | done | 增加 SiteSyncRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `serverExecutionJobId` 可追踪 queued job |
| F42.3 | done | 扩展 Server executor worker 回写 SiteSyncRun/Site。 | `apps/devpilot-api/src/server-executor`。 | worker 完成后同步 SiteSyncRun 状态、执行结果和 Site.lastSyncAt/syncError |
| F42.4 | done | SiteService/DTO 支持 queue 同步与回滚。 | `apps/devpilot-api/src/site`。 | `sync-plan` / `rollback` 可传 queue/maxAttempts，审批 metadata 保留 queue 决策 |
| F42.5 | done | 站点页面和审批执行支持队列入口。 | `sites` 与 `operation-approvals` 页面。 | 用户可选择站点操作加入队列，最近同步记录展示 job |
| F42.6 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check/build、diff check 通过 |

### F43. ResourceActionRun 接入 Server executor 队列桥

Purpose: 在 DeploymentRun/SiteSyncRun 队列桥之后，把服务器资源动作也接入 ServerExecutionJob 队列治理。第一版只覆盖 `ServerScriptExecutor` 支持的资源动作，例如 Docker inspect/logs/restart、Docker MySQL/Redis 探测类动作；云 SDK 和 direct adapter 缺口仍保持同步计划。资源动作仍保留审批、二次确认、Credential/Auth adapter 和 Executor adapter 证据；queue 只改变执行时机，不绕过审批或确认。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F43.1 | done | 新增 F43 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 ResourceActionRun queue bridge 范围 |
| F43.2 | done | 增加 ResourceActionRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `ResourceActionRun.serverExecutionJobId` + `20260626100000_resource_action_run_server_execution_job` migration |
| F43.3 | done | 扩展 ServerScriptExecutor 与 Server executor worker 回写 ResourceActionRun。 | `resource-control/executors` + `server-executor`。 | queued resource action 完成后同步状态、计划、结果和审批消费 |
| F43.4 | done | ResourceControl API/审批/UI 支持 queue 资源动作。 | `resource-control` API、资源管控页、操作审批页。 | 用户可选择资源动作加入队列，最近动作记录展示 job |
| F43.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F44. ApplicationServiceOperationRun 接入 Server executor 队列桥

Purpose: 在 DeploymentRun/SiteSyncRun/ResourceActionRun 队列桥之后，把应用服务运行态操作也接入 ServerExecutionJob 队列治理。第一版覆盖服务状态、日志、重启、回滚的 `application-service-runtime-plan`，使服务操作和部署/站点/资源动作一样可排队、可取消、可重试、可追踪。审批和确认仍保留；queue 只改变执行时机，不绕过 OperationApproval、Server executor 命令策略或 live lease。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F44.1 | done | 新增 F44 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 ApplicationServiceOperationRun queue bridge 范围 |
| F44.2 | done | 增加 ApplicationServiceOperationRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `ApplicationServiceOperationRun.serverExecutionJobId` + `20260626103000_application_service_operation_run_server_execution_job` migration |
| F44.3 | done | ApplicationService/DTO 支持 queue 操作并由 worker 回写结果。 | `apps/devpilot-api/src/application` + `server-executor`。 | queued 服务操作完成后同步状态、计划、日志、结果和审批消费 |
| F44.4 | done | 应用服务页和审批页支持服务操作 queue。 | `/applications` 与 `/operation-approvals` 页面。 | 用户可选择服务操作加入队列，最近操作展示 job |
| F44.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F45. BackupRun 接入 Server executor 队列桥

Purpose: 在 DeploymentRun/SiteSyncRun/ResourceActionRun/ApplicationServiceOperationRun 队列桥之后，把服务器侧备份运行也接入 ServerExecutionJob 队列治理。第一版只覆盖 `server-executor` 的 Docker MySQL/Redis dry-run 备份计划；云 SDK snapshot 计划仍保持同步，真实 live 备份仍被审批/恢复策略缺口阻断。queue 只改变执行时机，不绕过 Server executor 命令策略、live lease 或未来备份审批。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F45.1 | done | 新增 F45 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 BackupRun queue bridge 范围 |
| F45.2 | done | 增加 BackupRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `BackupRun.serverExecutionJobId` + `20260626110000_backup_run_server_execution_job` migration |
| F45.3 | done | BackupService/DTO 支持 queue 并由 worker 回写 BackupRun。 | `apps/devpilot-api/src/backup` + `server-executor`。 | queued server backup run 完成后同步状态、计划、日志、结果和计划 lastStatus |
| F45.4 | done | 备份页支持备份计划入队并展示 job。 | `/backups` 页面。 | 用户可选择服务器备份运行加入队列，最近运行展示 job |
| F45.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F46. LogCollectionRun 接入 Server executor 队列桥

Purpose: 在 DeploymentRun/SiteSyncRun/ResourceActionRun/ApplicationServiceOperationRun/BackupRun 队列桥之后，把日志采集运行也接入 ServerExecutionJob 队列治理。第一版覆盖 Server executor dry-run 日志采集计划，包括 Docker logs、Docker Compose logs、Nginx access/error log 和 `/var/log` tail；SLS 等云日志源仍保持 provider adapter 计划边界。queue 只改变执行时机，不绕过 Server executor 命令策略、live lease 或未来采集授权。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F46.1 | done | 新增 F46 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 LogCollectionRun queue bridge 范围 |
| F46.2 | done | 增加 LogCollectionRun 到 ServerExecutionJob 的链接字段。 | Prisma schema + migration。 | `LogCollectionRun.serverExecutionJobId` + `20260626113000_log_collection_run_server_execution_job` migration |
| F46.3 | done | LogCenter DTO/service 支持 queue 并由 worker 回写 LogCollectionRun。 | `apps/devpilot-api/src/log-center` + `server-executor`。 | queued 日志采集完成后同步状态、计划、日志和结果 |
| F46.4 | done | 日志中心页面支持日志采集入队并展示 job。 | `/logs` 页面。 | 用户可选择日志采集加入队列，最近采集运行展示 job |
| F46.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F47. Webhook 部署策略与幂等

Purpose: 在 Git Webhook 最小闭环之后，把 Git push 触发部署从“固定生成 dry-run 计划”推进到“可配置目标环境、可选择 dry-run 或加入 Server executor 队列、可避免重复投递生成重复 DeploymentRun”。第一版仍不默认 live 执行，queue 也默认 dry-run；真实 live webhook 触发需要后续审批/RBAC/重放防护继续补齐。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F47.1 | done | 新增 F47 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Webhook deployment policy/idempotency 范围 |
| F47.2 | done | 扩展 ProjectWebhook schema/DTO/service 支持 environmentId、deploymentMode、maxAttempts。 | Prisma schema + migration + webhook DTO/service。 | `ProjectWebhook.environmentId/deploymentMode/maxAttempts` + `20260626120000_webhook_deployment_policy` migration |
| F47.3 | done | Webhook 接收端按策略创建 queued DeploymentRun 并处理重复投递。 | `ProjectWebhookService.receiveGitWebhook`。 | providerEventId/payloadHash 幂等 key；queue 策略创建 queued DeploymentRun |
| F47.4 | done | 项目详情 Webhook UI 支持执行策略和目标环境展示。 | `/projects/[id]` 页面。 | 创建 Push Webhook 可选择目标环境、dry-run/queue、最大尝试；卡片展示策略 |
| F47.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F48. DeploymentRun 回滚最小闭环

Purpose: 在 DeploymentRun 队列桥和 Webhook 触发策略之后，补齐部署主线的回滚入口。第一版用 `mode=rollback` 和 `sourceRunId` 让回滚运行关联到成功部署源 run，生成 checkout/build/redeploy/health check 的 Server executor 计划，并支持 dry-run 或加入队列。真实 live 回滚仍受 Server executor live 开关、确认文本、命令策略和 lease 约束。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F48.1 | done | 新增 F48 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 DeploymentRun rollback 范围 |
| F48.2 | done | 扩展 DeploymentRun schema/迁移支持 mode/sourceRunId。 | Prisma schema + migration。 | `DeploymentRun.mode/sourceRunId` + `20260626123000_deployment_run_rollback` migration |
| F48.3 | done | 增加 DeploymentService rollback API 和 Server executor 计划/队列。 | Deployment controller/service/DTO。 | `POST /deployments/runs/:runId/rollback` 生成 checkout/build/redeploy/health_check 计划，支持 queue |
| F48.4 | done | 项目详情部署记录支持回滚入口和回滚源展示。 | `/projects/[id]` 页面。 | 最近部署运行展示 deploy/rollback 标签、回滚源和回滚按钮 |
| F48.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F49. DeploymentRun live 审批门禁

Purpose: 在 DeploymentRun dry-run/queue/rollback 之后，把非 dry-run 的部署和回滚纳入统一 OperationApproval。第一版不默认 webhook live，也不宣称生产级自动发布；它只保证用户从项目详情申请 live 部署/回滚时会创建 blocked DeploymentRun 和审批单，审批通过后在操作审批页复用部署接口执行，并在执行或入队后消费审批单。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F49.1 | done | 新增 F49 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 DeploymentRun live approval gate 范围 |
| F49.2 | done | 增加 DeploymentRun 到 OperationApproval 的关联。 | Prisma schema + migration。 | `DeploymentRun.operationApprovalId` + `20260626130000_deployment_run_operation_approval` migration |
| F49.3 | done | DeploymentService 对非 dry-run 部署/回滚创建审批门禁，并支持 approved approvalId 执行。 | Deployment service/DTO/module。 | 无审批时返回 blocked run + pending approval；审批通过后执行或入队并消费审批 |
| F49.4 | done | OperationApproval 列表和 Server executor 队列回写支持部署审批关联。 | OperationApprovalService + ServerExecutorService。 | 审批 include 返回 deploymentRuns；queued deployment 完成后消费 linked approval |
| F49.5 | done | 项目详情和操作审批页支持申请/执行 live 部署与 live 回滚。 | `/projects/[id]` 与 `/operation-approvals` 页面。 | 项目详情新增申请 Live 部署/回滚；审批页执行 `deployment.run` / `deployment.rollback` |
| F49.6 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过 |

### F50. Webhook live 部署申请策略

Purpose: 在 DeploymentRun live 审批门禁之后，让 Git push webhook 能从“只生成 dry-run/queued dry-run”推进到“可申请 live 部署”。第一版新增 `live_request` 策略：Webhook 收到 push 后创建非 dry-run DeploymentRun，但会被 OperationApproval 拦截为 blocked run；审批通过后从操作审批页按审批 metadata 加入 Server executor 队列执行，不允许 webhook 直接绕过审批执行线上部署。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F50.1 | done | 新增 F50 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 Webhook live request 范围 |
| F50.2 | done | ProjectWebhook DTO/service 支持 `live_request` 策略。 | `apps/devpilot-api/src/project-webhook`，不新增表。 | DTO 允许 `live_request`；接收端创建 `dryRun=false, queue=true` 的 DeploymentRun，交给 OperationApproval 门禁 |
| F50.3 | done | 项目详情 Webhook UI 支持选择和展示 live 申请策略。 | `/projects/[id]` 页面。 | Webhook 表单新增 `申请 Live 部署`，卡片展示 live_request 和最大尝试次数 |
| F50.4 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；lint 脚本因缺配置/交互提示未执行到代码检查 |

### F51. Webhook 重放防护与密钥轮换

Purpose: 在 Webhook live_request 之后补上生产化安全边界。公开接收端需要校验请求时间窗，避免签名泄露或历史请求被长时间重放；管理端需要能轮换 webhook secret，并且新 secret 只在轮换响应里显示一次。第一版不新增数据表，继续复用 `ProjectWebhook.secret` 的 JSON 存储形态和 `WebhookDelivery` 失败记录。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F51.1 | done | 新增 F51 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 replay window 和 secret rotation 范围 |
| F51.2 | done | 公开 Webhook 接收端校验 timestamp 时间窗并记录失败投递。 | `ProjectWebhookService.receiveGitWebhook`。 | generic/custom secret 请求要求 `x-devpilot-webhook-timestamp`，超窗或缺失会写 failed delivery 并拒绝 |
| F51.3 | done | 管理端新增 rotate secret API。 | `ProjectWebhookController/Service`。 | `POST /project-webhooks/:id/rotate-secret` 返回一次性 setupSecret |
| F51.4 | done | 项目详情 Webhook 卡片支持轮换 secret 并展示 timestamp 要求。 | `/projects/[id]` 页面。 | Webhook 卡片新增轮换 Secret 按钮，新 secret 仅当前卡片显示一次；表单区展示 timestamp header 要求 |
| F51.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；lint 脚本因缺配置/交互提示未执行到代码检查 |

### F52. 失败部署回滚申请

Purpose: 在 live 部署审批和回滚闭环之后，补齐失败现场的恢复入口。第一版不做无人值守自动回滚，避免线上失败后绕过人审直接执行；用户可以从失败的 live deploy 申请回滚，系统按同项目、同环境、同应用/服务、同服务器维度选择最近一次成功 live deploy 作为回滚源，并复用既有 rollback run、OperationApproval 和 Server executor 队列链路。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F52.1 | done | 新增 F52 持久任务拆分。 | TODO 文档，不改业务逻辑。 | 本节记录 failed deployment rollback request 范围 |
| F52.2 | done | 增加失败部署回滚申请 API。 | Deployment controller/service。 | `POST /deployments/runs/:runId/failure-rollback` 校验 failed live deploy 并选择最近成功 live deploy 作为 sourceRun |
| F52.3 | done | 项目详情失败部署记录支持申请失败回滚。 | `/projects/[id]` 页面。 | 失败 live deploy 显示“申请失败回滚”，生成新的 live rollback approval request |
| F52.4 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F53. 项目环境工作台

Purpose: 让项目详情真正围绕 dev/test/staging/prod 环境组织资源和运维对象，而不是只展示环境计数。第一版在项目详情中按环境聚合服务器、应用服务、站点、部署运行、ManagedResource、ResourceInstance、CDN 和密钥，帮助用户从项目入口判断每个环境现在挂了哪些资源、哪些资源缺绑定，以及下一步该去资源管控、应用服务或站点管控页面操作。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F53.1 | done | 确认项目详情 API 和页面已有环境数据链路。 | ProjectService、Project detail page、ResourceControl/ResourceRequest 数据模型。 | 确认 `ProjectService.findOne` 已返回环境、服务、站点、CDN、密钥，但缺 `ManagedResource` 和 `ResourceInstance` 列表 |
| F53.2 | done | 项目详情 API 返回环境相关 ManagedResource 和 ResourceInstance 摘要。 | `apps/devpilot-api/src/project/project.service.ts`。 | `findOne` 新增 `managedResources` / `resourceInstances` 只读摘要 include，不返回敏感凭证明文 |
| F53.3 | done | 项目详情新增按环境聚合的工作台视图。 | `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx`。 | 新增环境选择、服务器/服务/资源/站点/CDN/部署/密钥聚合视图 |
| F53.4 | done | 更新路线文档并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F54. 环境差异与绑定缺口

Purpose: 在项目环境工作台之后补上环境成熟度判断。用户不仅要看到每个环境有哪些对象，还要能一眼发现某个环境缺服务器、缺服务、缺站点、缺资源、没有部署记录，以及项目级资源是否还没绑定到任何环境。第一版只做只读提醒和跨环境对比，不新增自动绑定或执行动作。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F54.1 | done | 记录环境差异与绑定缺口需求。 | TODO 文档，不改业务逻辑。 | 本节记录 cross-environment comparison 和 unbound-resource reminder 范围 |
| F54.2 | done | 项目详情环境工作台展示跨环境对比。 | `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx`。 | 新增跨环境对比表，展示服务器、服务、资源、站点/CDN、部署和缺口 |
| F54.3 | done | 项目详情展示未绑定环境的资源提醒。 | `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx`。 | 新增未绑定环境资源提醒，覆盖 ManagedResource、ResourceInstance、Site、CDN 和 SecretKey |
| F54.4 | done | 更新路线文档并运行验证。 | roadmap/TODO + API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F55. 环境缺口操作入口联动

Purpose: 把项目环境工作台里的“缺服务器、缺应用服务、缺资源、缺站点、暂无部署、服务未绑定运行资源”等提醒从只读文本升级成带项目/环境上下文的操作入口。第一版不新增自动修复动作，只让用户从项目详情跳到资源管控、应用服务、站点管控等页面时保留当前项目和环境筛选，并预填创建/绑定表单。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F55.1 | done | 记录环境缺口操作入口联动需求。 | TODO 文档，不改业务逻辑。 | 本节记录 contextual operation entry 范围 |
| F55.2 | done | 资源管控页支持从 URL 读取项目/环境上下文并过滤。 | `resource-control` 前端页面。 | `/resource-control?projectId=...&environmentId=...` 可预选项目/环境并按资源项目/环境过滤 |
| F55.3 | done | 应用服务页支持从 URL 读取项目/环境上下文并预填创建/服务表单。 | `applications` 前端页面。 | `/applications?projectId=...&environmentId=...` 可预填项目/环境、筛选服务工作区，并按当前环境统计 |
| F55.4 | done | 站点创建入口支持环境上下文预填。 | `sites` 前端页面和 Site list API。 | `/sites?new=true&projectId=...&environmentId=...` 可筛选站点并预填新增站点环境 |
| F55.5 | done | 项目详情缺口标签和顶部入口跳转时携带项目/环境上下文。 | `/projects/[id]` 页面。 | 环境工作台顶部入口和缺口标签跳转到带 projectId/environmentId 的资源管控、应用服务和站点创建页 |
| F55.6 | done | 更新路线文档并运行验证。 | roadmap/TODO + Web/API checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F56. 跨环境配置差异视图

Purpose: 在环境工作台已有数量对比和缺口跳转之后，继续补齐“环境之间到底配置差在哪”的判断能力。第一版只做只读差异视图，不自动修复和同步配置；以 prod 环境作为优先参考环境，没有 prod 时使用最后一个环境，展示服务集合、部署配置覆盖、运行资源绑定、站点/TLS、资源类型、密钥类型和最近成功部署情况的差异。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F56.1 | done | 记录跨环境配置差异视图需求。 | TODO 文档，不改业务逻辑。 | 本节记录 config drift view 范围 |
| F56.2 | done | 确认项目详情已有环境配置数据面。 | Project detail API/page 只读检查。 | Project detail 已返回环境、服务、站点、资源、密钥和 DeploymentRun；服务 deployConfig/站点 tls 通过现有 include scalar 可消费 |
| F56.3 | done | 项目详情生成每个环境的配置画像和相对参考环境差异。 | `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx`。 | 新增 `buildEnvironmentConfigProfiles`，生成服务集合、部署配置覆盖、运行绑定、站点/TLS、资源类型、密钥类型和成功部署差异 |
| F56.4 | done | 项目详情展示跨环境配置差异视图。 | `/projects/[id]` 环境工作台 UI。 | 新增“跨环境配置差异”面板，prod/production 优先作为参考环境，没有 prod 时使用最后一个环境 |
| F56.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + API/Web checks。 | API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F57. Site Nginx/OpenResty 诊断运行

Purpose: 继续把 Site 从“配置同步对象”推进到“可运维对象”。第一版新增站点诊断运行，不写配置、不 reload，只通过 Server executor 生成或执行 Nginx/OpenResty 诊断命令：`nginx -t`、读取 access.log/error.log 最近行，并把结果沉淀到 SiteSyncRun、ServerExecutionJob 和审计链路。真实执行仍受 Server executor live 开关、命令策略、队列和 SSH 凭据约束。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F57.1 | done | 记录 Site 诊断运行需求。 | TODO 文档，不改业务逻辑。 | 本节记录 site diagnostics run 范围 |
| F57.2 | done | 确认 Site 同步和 Server executor 已有复用边界。 | SiteService、SiteController、ServerCommandPolicy、Sites page。 | 现有 SiteSyncRun 已支持 commandPlan/logs/result/job/audit；ServerCommandPolicy 已有 nginx/log 命令基线 |
| F57.3 | done | 新增 Site 诊断 API 和 Nginx/OpenResty 诊断执行计划。 | Site controller/service/dto + command policy。 | 新增 `POST /sites/:id/diagnostics`，生成 `nginx -t`、access.log/error.log tail 计划，mode=`diagnostics`，复用 Server executor/队列/审计 |
| F57.4 | done | Sites 页面支持发起诊断并展示诊断运行记录和日志摘要。 | `apps/devpilot-web/src/app/(dashboard)/sites/page.tsx`。 | 站点卡片新增诊断/诊断入队按钮，最近运行展示“诊断”和 executor logs 摘要 |
| F57.5 | done | 更新路线文档并运行验证。 | roadmap/TODO + API/Web checks。 | Prisma validate、API/Web type-check、API/Web build、git diff --check 通过；Web build 仅提示 Browserslist/caniuse-lite 数据过期 |

### F58. Server executor 跨进程取消信号

Purpose: 在同进程 cancel signal 和 lock lease 之后，补上多实例/多进程部署下的取消感知。第一版不引入 server agent，也不做远端进程树强杀；它复用 `ServerExecutionJob.cancelRequestedAt` 作为持久取消信号，让负责执行的 worker 进程轮询数据库并触发本地 cancellation token，从而让 SSH live adapter SIGTERM 当前 SSH 子进程。worker 崩溃或远端孤儿进程治理仍由 lock lease 恢复和后续 agent/supervisor 能力承接。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F58.1 | done | 记录跨进程取消信号需求和非目标边界。 | TODO 文档，不改业务逻辑。 | 本节记录 persisted cancellation polling 范围 |
| F58.2 | done | 确认 Server executor 取消链路和当前持久字段。 | ServerExecutionJob schema、ServerExecutorService、SSH adapter。 | `cancelJob()` 已写 `cancelRequestedAt`；SSH adapter 已监听 token；缺持久轮询 |
| F58.3 | done | 实现基于数据库取消请求的轮询 cancellation token。 | `apps/devpilot-api/src/server-executor/server-executor.service.ts`。 | token 每 2 秒轮询 `cancelRequestedAt`，执行前和拿到 live lease 后显式检查，finally 清理 interval |
| F58.4 | done | 更新路线文档，标注跨进程取消 baseline 与剩余 remote kill gap。 | roadmap/TODO。 | roadmap P8 标注持久取消轮询已完成，远端进程树强杀/agent supervisor 仍待补 |
| F58.5 | done | 运行验证并记录结果。 | Prisma/API/Web checks + whitespace checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 和 touched-file whitespace scan 通过 |

### F59. 控制面访问策略和审批前置 RBAC

Purpose: 在团队 owner/admin/member 粗粒度角色之后，补上项目/环境/动作级访问策略第一版。策略按团队角色或用户生效，可限定项目、环境、操作分类、action 和 risk；owner 默认绕过，未配置策略时保留当前 team_admin/team_member 行为。第一版先接入 OperationApproval 创建、审批和已批准执行校验，让 live 部署、站点同步/回滚、资源动作、服务操作等高风险链路能被统一策略拦截；普通 CRUD 接口后续逐批迁入同一个策略服务。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F59.1 | done | 梳理 auth/team role/审批/高风险操作入口图谱。 | Authz config、TeamService、OperationApproval、Resource/Deployment/Site/Application/Backup/Log/Monitoring controller。 | CodeGraph status 可用但索引未覆盖新模块；已切手工图谱，确认审批链路携带 project/environment/category/action/risk |
| F59.2 | done | 新增 ControlAccessPolicy 数据模型、迁移、DTO、service、controller 和 module。 | Prisma schema + `control-access-policy` API。 | 新增 `ControlAccessPolicy` schema/migration、`/control-access-policies` API、策略 service/module |
| F59.3 | done | 将访问策略接入 OperationApproval 创建、审批和 approved approval 校验。 | OperationApprovalService + module imports。 | `createPending`/`review`/`resolveApproved` 已调用 ControlAccessPolicyService；无 actor 的 webhook 申请保持系统触发边界 |
| F59.4 | done | 前端新增访问策略页面和侧边栏入口。 | `apps/devpilot-web` dashboard。 | 新增 `/access-policies` 页面和侧边栏入口，可管理 allow/deny、主体、项目/环境、分类/action/risk |
| F59.5 | done | 更新路线图并运行验证。 | roadmap/TODO + Prisma/API/Web checks。 | Prisma validate/generate、API/Web type-check、API/Web build、git diff --check 和 touched-file whitespace scan 通过；schema 尾随空白已机械清理 |

### F60. 访问策略接入第一批普通写接口

Purpose: 把 F59 的控制面访问策略从 OperationApproval 审批链路推进到普通写接口。第一批覆盖项目、项目环境和站点 CRUD/绑定入口：默认仍要求团队 admin，owner 仍绕过；成员只有命中 allow 策略才可写，命中 deny 策略会被拒绝。后续再把同一策略服务扩展到资源、应用、备份、日志和监控等模块。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F60.1 | done | 记录第一批普通写接口访问策略范围。 | TODO 文档，不改业务逻辑。 | 本节记录 project/environment/site write policy 范围 |
| F60.2 | done | 扩展 ControlAccessPolicyService 的普通写接口判断方法。 | `control-access-policy.service.ts`。 | 新增 `assertCanWrite()`，默认 admin，支持策略 allow/deny |
| F60.3 | done | Project 写接口接入访问策略。 | Project controller/module。 | Project create/update/delete 调用 `assertCanWrite()`；ProjectModule 导入 ControlAccessPolicyModule |
| F60.4 | done | ProjectEnvironment 写接口接入访问策略。 | ProjectEnvironment controller/module。 | 环境 create/update/archive、服务器 bind/unbind、sync-from-project 调用 `assertCanWrite()`；模块导入 ControlAccessPolicyModule |
| F60.5 | done | Site CRUD 写接口接入访问策略并更新路线文档。 | Site controller/module + roadmap/TODO。 | Site create/update/delete 调用 `assertCanWrite()`；更新时同时校验当前 scope 和新 scope |
| F60.6 | done | 运行验证并记录结果。 | API/Web checks + whitespace checks。 | API/Web type-check、API/Web build、git diff --check 和 touched-file whitespace scan 通过 |

### F61. 访问策略接入早期项目交付入口

Purpose: 把仍停留在早期 team role guard 的项目交付入口纳入统一控制面策略。第一批补 Generator、Preset、Git、旧 Domain/CDN 配置生成入口；这些入口会影响项目初始化、Git 发布、域名配置或 CDN 辅助交付。Auth、Team、Admin 仍保留在账号/团队治理边界，后续单独设计，不混入项目/环境访问策略。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F61.1 | in_progress | 梳理剩余无访问策略的写接口并确认本轮范围。 | Controller read-only discovery。 | 已确认 Generator、Preset、Git、Domain、Legacy CDN 是本轮项目交付相关入口；Auth/Team/Admin 不纳入 |
| F61.2 | pending | 为 Generator 和 Preset 写入口接入控制面访问策略。 | `generator`、`preset` controller/module。 | |
| F61.3 | pending | 为 Git、Domain、Legacy CDN 写入口接入控制面访问策略。 | `git`、`domain`、`cdn` controller/module。 | |
| F61.4 | pending | 更新路线文档并运行针对性验证。 | roadmap/TODO + API checks。 | |

## Verification Plan

- `pnpm --filter @svton/devpilot-api exec prisma validate`
- `pnpm --filter @svton/devpilot-api exec prisma generate`
- `pnpm --filter @svton/devpilot-api type-check`
- `pnpm --filter @svton/devpilot-web type-check`
- 如类型检查通过，再根据耗时运行相关 build。

## Change Log

- 2026-06-25 00:19: Created plan.
- 2026-06-25 00:28: Completed onboarding code path, roadmap document, and verification.
- 2026-06-25 00:35: Added deployment-only onboarding requirement.
- 2026-06-25 00:43: Implemented deployment-only onboarding UI and display.
- 2026-06-25 00:48: Verified deployment-only onboarding with web/API type-check, web build, and diff check.
- 2026-06-25 01:00: Added DeploymentRun minimum loop requirement.
- 2026-06-25 01:13: Implemented DeploymentRun model, API, and project detail dry-run UI.
- 2026-06-25 01:20: Added Git webhook minimum loop requirement.
- 2026-06-25 01:34: Implemented ProjectWebhook/WebhookDelivery minimum loop and UI.
- 2026-06-25 01:42: Verified DeploymentRun and ProjectWebhook with Prisma validate, API/Web type-check, API/Web build, and diff check.
- 2026-06-25 01:50: Added native webhook signature verification requirement.
- 2026-06-25 01:58: Implemented raw-body native webhook signature verification.
- 2026-06-25 02:18: Added Site management minimum loop requirement and implementation.
- 2026-06-25 02:36: Added Server executor adapter foundation requirement.
- 2026-06-25 02:52: Implemented shared ServerExecutorModule and wired ResourceControl, DeploymentRun, and Site sync-plan to it.
- 2026-06-25 03:00: Added ProjectEnvironment minimum loop requirement.
- 2026-06-25 03:12: Implemented ProjectEnvironment model, API, project creation initialization, and project detail display.
- 2026-06-25 03:18: Added Site/Deployment environment binding requirement.
- 2026-06-25 03:29: Implemented Site and DeploymentRun environment binding.
- 2026-06-25 03:36: Added default-off SSH live Server executor adapter requirement.
- 2026-06-25 03:45: Implemented default-off SSH live Server executor adapter.
- 2026-06-26 13:20: Added DeploymentRun live approval gate for deploy/rollback and verified Prisma, API/Web type-check, API/Web build, and diff check.
- 2026-06-26 13:45: Added ProjectWebhook live_request deployment policy and verified Prisma, API/Web type-check, API/Web build, and diff check; lint scripts are not currently non-interactive/configured for Devpilot packages.
- 2026-06-26 14:15: Added Webhook replay timestamp guard and secret rotation, then verified Prisma, API/Web type-check, API/Web build, and diff check; lint scripts still stop before code checks.
- 2026-06-26 18:05: Added failed live deployment rollback request flow, updated project detail recovery action, refreshed roadmap, and verified Prisma, API/Web type-check, API/Web build, and diff check.
- 2026-06-26 18:20: Added F53 project environment workspace requirement and started API/page data-flow discovery.
- 2026-06-26 18:45: Implemented project environment workspace summaries for servers, services, resources, sites/CDN, deployments, and secrets; verified Prisma, API/Web type-check, API/Web build, and diff check.
- 2026-06-26 19:05: Implemented environment gap badges, unbound environment resource reminder, cross-environment comparison table, roadmap update, and full verification.
- 2026-06-26 19:25: Added F55 environment gap contextual operation entry requirement.
- 2026-06-26 19:45: Implemented F55 contextual operation entries from project environment workspace to resource-control, applications, and sites; verified Prisma, API/Web type-check, API/Web build, and diff check.
- 2026-06-26 20:05: Added F56 cross-environment configuration drift view requirement.
- 2026-06-26 20:25: Implemented F56 cross-environment configuration drift view in project environment workspace; verified API/Web type-check, API/Web build, and diff check.
- 2026-06-26 20:45: Added F57 Site Nginx/OpenResty diagnostics run requirement.
- 2026-06-26 21:05: Implemented F57 Site diagnostics run API/UI, command policy allowance, roadmap update, and full verification.
- 2026-06-26 15:59: Added F58 Server executor persisted cross-process cancellation signal requirement.
- 2026-06-26 16:05: Implemented F58 persisted cancellation polling token and updated roadmap; verification in progress.
- 2026-06-26 16:12: Verified F58 with Prisma validate/generate, API/Web type-check, API/Web build, git diff --check, and touched-file whitespace scan.
- 2026-06-26 16:08: Added F59 control-plane access policy and approval-gated RBAC requirement.
- 2026-06-26 16:35: Implemented F59 ControlAccessPolicy API/UI, wired OperationApproval access checks, updated roadmap, and verified Prisma/API/Web checks.
- 2026-06-26 16:22: Added F60 first-batch ordinary write API access policy requirement.
- 2026-06-26 16:45: Implemented F60 access policy checks for Project, ProjectEnvironment, and Site write APIs; verified API/Web checks.
- 2026-06-28 23:15: Added F61 early project delivery entry access policy requirement and started remaining controller discovery.
- 2026-06-25 04:25: Added environment resource binding requirement.
- 2026-06-25 04:42: Implemented ProjectEnvironmentServer and environmentId binding across managed resources, requests, instances, CDN, keys, and resource-control UI.
- 2026-06-25 04:50: Verified F14 with Prisma validate/generate, API/Web type-check, API/Web build, and diff check.
- 2026-06-25 05:05: Added Application/Service workspace minimum loop requirement.
- 2026-06-25 05:30: Implemented Application/Service model, API, deployment binding, applications page, project detail overview, and verification.
- 2026-06-26 00:10: Added service runtime operation minimum loop requirement.
- 2026-06-26 00:32: Implemented service runtime operation run model, API, ServerExecutor plans, applications UI actions, and verification.
- 2026-06-26 00:45: Added unified audit event minimum loop requirement.
- 2026-06-26 01:05: Implemented AuditEvent model, API, deployment/resource/service-operation write hooks, audit-events page, and full verification.
- 2026-06-26 01:18: Added high-risk operation approval minimum loop requirement.
- 2026-06-26 01:38: Implemented OperationApproval model, API, resource/service approval gates, operation-approvals page, live approval request buttons, and full verification.
- 2026-06-26 01:50: Added Server executor command policy minimum loop requirement.
- 2026-06-26 02:05: Implemented built-in Server executor command policy, adapter pre-check blocking, policy metadata in execution plans, and full verification.
- 2026-06-26 02:15: Added resource backup plan minimum loop requirement.
- 2026-06-26 02:38: Implemented BackupPlan/BackupRun model, API, backups page, audit/policy integration, and full verification.
- 2026-06-26 02:45: Added monitoring alert minimum loop requirement.
- 2026-06-26 03:05: Implemented AlertRule/AlertEvent model, monitoring API, monitoring page, audit integration, and full verification.
- 2026-06-26 03:12: Added log center minimum loop requirement.
- 2026-06-26 03:32: Implemented LogStream/LogEntry model, logs API, logs page, audit integration, and full verification.
- 2026-06-26 03:40: Added log collection run minimum loop requirement.
- 2026-06-26 03:58: Implemented LogCollectionRun model, collection API, Server executor plan, audit integration, logs page run display, and verification.
- 2026-06-26 04:10: Added resource connection probe minimum loop requirement.
- 2026-06-26 04:28: Implemented ResourceConnectionRun model, connection probe API, Credential/Auth adapter plan, audit integration, resource-control UI probe action, and verification.
- 2026-06-26 04:30: Added resource read-only query run minimum loop requirement.
- 2026-06-26 04:48: Implemented ResourceQueryRun model, read-only query API, adapter plans, audit integration, resource-control UI query action, and verification.
- 2026-06-26 05:00: Added resource binding and configurable read-only query panel requirement.
- 2026-06-26 05:18: Implemented ManagedResource binding API, binding audit, cloud credential selection, configurable query panel, roadmap update, and verification.
- 2026-06-26 05:35: Implemented cloud credential profiles, resource-control cloud credential creation/list/delete UI, provider-compatible credential selection, roadmap update, and verification.
- 2026-06-26 05:55: Implemented ResourceQueryRun result preview contract, queryPlan resultContract/livePrerequisites, resource-control preview UI, roadmap update, and verification.
- 2026-06-26 06:15: Implemented DB/Redis readonly credential profiles, queryCredentialId binding, direct_db query credential resolver, resource-control query credential UI, roadmap update, and verification.
- 2026-06-26 06:35: Added DB/Redis live readonly query adapter requirement.
- 2026-06-26 07:05: Implemented DB/Redis live readonly query adapter, ResourceQueryRun queryCredential resolver fix, resource-control live query UI, and roadmap update.
- 2026-06-26 07:25: Added Docker Server executor live action requirement.
- 2026-06-26 07:45: Implemented Docker Server executor live read/restart action exposure, UI live action controls, and roadmap update.
- 2026-06-26 08:05: Added Site Nginx/OpenResty live sync requirement.
- 2026-06-26 08:25: Implemented Site Nginx/OpenResty live sync boundary, status/audit update, sites UI live sync control, and roadmap update.
- 2026-06-26 08:40: Added Site sync history and rollback requirement.
- 2026-06-26 09:05: Implemented SiteSyncRun history, rollback API, sites UI rollback controls, and roadmap update.
- 2026-06-26 09:30: Added Site config diff and approval-gated live sync/rollback requirement.
- 2026-06-26 10:00: Added Server executor live execution lease/concurrency requirement.
- 2026-06-26 10:20: Added Server executor execution-governance visibility requirement.
- 2026-06-26 10:40: Implemented execution-governance API/page, roadmap update, and verification.
- 2026-06-26 11:00: Added Server executor execution job history/cancel/retry requirement.
- 2026-06-26 11:25: Implemented ServerExecutionJob history/cancel/retry API, execution-governance job UI, roadmap update, and verification.
- 2026-06-26 11:40: Added Server executor queued worker/cancel signal/auto retry requirement.
- 2026-06-26 12:05: Implemented queued job worker foundation, running cancel signal, queue retry UI/API, roadmap update, and verification.
- 2026-06-26 12:20: Added Server executor lock lease/heartbeat/stale recovery requirement.
- 2026-06-26 12:40: Implemented Server executor lock lease heartbeat, stale recovery API/UI, roadmap update, and verification.
- 2026-06-26 12:55: Added Server executor command policy template requirement.
- 2026-06-26 13:15: Implemented ServerCommandPolicyTemplate model/API, template-aware command evaluation, execution-policies page, roadmap update, and full verification.
- 2026-06-26 13:30: Added DeploymentRun Server executor queue bridge requirement.
- 2026-06-26 13:55: Implemented queueExecution contract, DeploymentRun queued job link, worker result sync, UI queue controls, roadmap update, and full verification.
- 2026-06-26 14:05: Added SiteSyncRun Server executor queue bridge requirement.
- 2026-06-26 14:25: Implemented SiteSyncRun queued job link, worker result sync, site queue controls, approval queue propagation, roadmap update, and full verification.
- 2026-06-26 14:50: Implemented ResourceActionRun queued job link, worker result sync, resource action queue controls, approval queue propagation, roadmap update, and full verification.
- 2026-06-26 15:10: Implemented ApplicationServiceOperationRun queued job link, worker result sync, service operation queue controls, approval queue propagation, roadmap update, and full verification.
- 2026-06-26 15:30: Implemented BackupRun queued job link, worker result sync, server backup queue controls, roadmap update, and full verification.
- 2026-06-26 15:45: Added LogCollectionRun Server executor queue bridge requirement.
- 2026-06-26 15:50: Implemented LogCollectionRun queued job link, worker result sync, log collection queue controls, roadmap update, and full verification.
- 2026-06-26 16:05: Added Webhook deployment policy and idempotency requirement.
- 2026-06-26 16:25: Implemented ProjectWebhook environment/deployment policy, WebhookDelivery idempotency key, queued dry-run webhook execution, project detail webhook controls, roadmap update, and full verification.
- 2026-06-26 16:40: Added DeploymentRun rollback minimum loop requirement.
- 2026-06-26 17:05: Implemented DeploymentRun mode/sourceRun rollback relation, rollback API, Server executor rollback plan/queue path, project detail rollback controls, command policy update, roadmap update, and full verification.
