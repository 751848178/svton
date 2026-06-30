# Devpilot 项目纳管、Webhook 与站点管控演进说明

## 1. 本次产品判断

`Project` 不应该只代表“由 Devpilot 初始化生成的新项目”，而应该是一个项目管控容器。它可以有三种来源：

| 来源 | 含义 | 是否必须有技术栈 | 是否必须初始化 |
|----|----|----|----|
| `generated` | 通过 Devpilot 向导生成的新项目 | 是，来自生成器配置 | 是 |
| `imported` | 已有 Git 仓库或已有部署接入纳管 | 否，可后补或自动检测 | 否 |
| `external` | 只作为服务器、站点、云资源的归属容器 | 否 | 否 |

当前第一步已经按这个方向打开：已有项目可以通过 `/projects/import` 接入，不再强制绑定技术栈、子项目或初始化器；仅构建部署项目也可以保存部署配置，并在详情页生成 dry-run 部署执行计划。

项目来源只说明项目从哪里来，不能完整表达用户想让 Devpilot 管什么。因此新增 `managementScope` 作为管理范围：

| 管理范围 | 含义 | 典型场景 |
|----|----|----|
| `full` | 项目完整纳管 | 项目既要关联仓库，也要逐步绑定服务器、站点、数据库、云资源和 Webhook |
| `deployment` | 仅构建部署 | 项目只希望接入仓库、构建命令、部署命令、部署目标和健康检查 |
| `resources` | 资源归属 | 项目不关心代码，只作为服务器、站点、云资源、密钥的归属容器 |

## 2. 已有项目接入的产品形态

已有项目接入不应该复用“创建新项目”的完整向导，而应该是一条轻量路径：

1. 选择接入方式：已有代码项目、仅构建部署或外部管控项目。
2. 填写基础信息：项目名、描述、默认环境。
3. 可选填写仓库信息：Git Provider、仓库地址、默认分支。
4. 可选填写技术栈：语言、框架、包管理器。
5. 若管理范围包含部署，填写部署目标、工作目录、构建命令、部署命令、健康检查地址。
6. 保存后进入项目详情，再按管理范围逐步绑定部署、服务器、Docker、数据库、Redis、RDS、SLS、COS、域名、证书、CDN、密钥。

这个流程的关键是“先纳管，再补齐”，避免因为技术栈不清楚、初始化配置不存在，就无法把线上项目纳入 Devpilot。

仅构建部署场景要被正式支持，而不是隐藏在完整纳管里。它的第一阶段数据形态如下：

```json
{
  "origin": "imported",
  "managementScope": "deployment",
  "source": {
    "type": "git",
    "provider": "github",
    "repository": "https://github.com/acme/app",
    "branch": "main"
  },
  "deployment": {
    "enabled": true,
    "targetType": "docker-compose",
    "workingDirectory": "/srv/apps/acme-app",
    "buildCommand": "pnpm build",
    "deployCommand": "docker compose up -d --build",
    "rollbackCommand": "docker compose up -d",
    "healthCheckUrl": "https://example.com/health"
  }
}
```

## 3. Webhook 能力应该支持

结论：应该支持，而且它应该属于“部署与自动化触发器”，不是简单 HTTP 回调。

竞品依据：

- Coolify 支持 GitHub App、GitHub Actions 和 Webhooks 三种自动部署方式，并要求 webhook secret 匹配后才接受请求。Source: https://coolify.io/docs/applications/ci-cd/github/auto-deploy
- Coolify 的 GitHub 集成覆盖公有仓库、私有仓库、自动部署、GitHub Actions、PR 预览部署。Source: https://coolify.io/docs/applications/ci-cd/github/overview
- Portainer 的 GitOps 更新支持轮询或 webhook 触发；触发后会比较最新 commit hash，必要时拉取仓库并执行 Docker Compose、Docker Stack 或 Kubernetes apply。Source: https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/how-do-automatic-updates-for-stacks-applications-work
- Dokploy 的 Auto Deploy 支持 Webhooks 或 API，覆盖 GitHub、GitLab、Bitbucket、Gitea、DockerHub，并强调分支或 tag 匹配。Source: https://docs.dokploy.com/docs/core/auto-deploy

建议模型：

| 模型 | 关键字段 |
|----|----|
| `ProjectWebhook` | projectId、environmentId、provider、secret、enabled、eventTypes、branchPattern、tagPattern、deploymentMode、maxAttempts |
| `WebhookDelivery` | webhookId、eventType、providerEventId、idempotencyKey、sourceIp、signatureStatus、payloadHash、receivedAt、status、deploymentRunId、error |
| `AutomationAction` | triggerType、targetType、executorType、action、parameters |
| `DeploymentRun` | projectId、environment、mode、sourceRunId、targetType、dryRun、commitSha、branch、status、commandPlan、logs、result |

当前已具备 `DeploymentRun` 的最小闭环：可以从项目详情手动创建 dry-run 部署运行，生成拉取代码、构建、部署、健康检查的执行计划，并记录状态、日志、错误和结果；失败的 deploy run 可以保留原失败记录并重新创建 dry-run/queued 重试 run，失败 live deploy 也可以重新发起受审批保护的 Live 重试；已完成的部署运行也可以作为 `sourceRun` 发起回滚 run，生成 checkout/build/redeploy/health check 的 dry-run 或 queued 计划；已完成的 deploy/rollback run 还可以独立发起低风险 Smoke 检查，生成 `mode=smoke_check` 的 DeploymentRun 并复用 Server executor、队列任务和审计。非 dry-run 的部署和回滚已经进入 `OperationApproval` 审批门禁，审批通过后可在审批页执行并消费审批单；失败的 live deploy 可以申请回滚，系统会按同项目、同环境、同应用/服务、同服务器维度选择最近成功 live deploy 作为回滚源；失败的 live Smoke 检查也可以生成回滚 dry-run/queued 计划或申请受审批保护的 live 回滚，并且回滚目标会选择 Smoke 来源部署之前的上一成功 live deploy；项目页可显式开启“Live Smoke 失败后自动生成回滚计划”，后端通过默认关闭的 scheduler 幂等扫描失败 Smoke 并自动创建回滚计划、审批申请，或在策略显式携带已批准 approvalId 与确认文本时沿既有审批消费/Server executor 队列链路提交 live 回滚；项目页可显式开启“Live 回滚完成后自动 Smoke”，后端在同步完成或默认关闭 scheduler 扫描到 completed live rollback 后幂等生成 dry-run/queued Smoke 检查。部署计划已经接入通用 `ServerExecutorModule` 和 `script-plan` adapter；同时已新增默认关闭的 `ssh-live` adapter，只有 `SERVER_EXECUTOR_LIVE_ENABLED=true`、服务器使用 key auth、非 dry-run 且确认文本匹配时才会通过 SSH 执行稳定脚本；SSH live 取消/超时时会通过远端临时 wrapper 记录子进程 PID，并 best-effort 发起独立 SSH cleanup 终止远端进程组/子进程。`server-agent` adapter 边界也已存在，`server_agent` target 的 dry-run 会生成 agent dispatch envelope；live 在 `SERVER_EXECUTOR_AGENT_ENABLED=true` 且配置 `SERVER_EXECUTOR_AGENT_DISPATCHER_URL` 后可以 POST 到默认关闭的 HTTP dispatcher，并接受同步终态响应，未开启或未配置时仍保持 blocked；dispatch envelope、result、command plan 和 HTTP headers 已携带 job/lease/retry attempt/dispatch id/idempotency key correlation，让 dispatcher 与 Devpilot job history、重试、审计和未来 agent supervisor 能对齐同一条执行任务；server-agent adapter 返回后也会 best-effort 写入 `server_execution_job.agent_dispatch` 审计事件，metadata 保留 correlation、dispatcher 配置态、终态、boundary 和 whitelisted response 摘要，审计失败只记录 warn、不反向改写执行结果；`SERVER_EXECUTOR_AGENT_TARGET_ENABLED=true` 且服务器 services/tags 存在 agent capability 时，`resolveTarget()` 可选择 `server_agent` target 并携带 agentRef 证据，显式开启 `SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED=true` 后还会要求 heartbeat runtime online，否则安全回落 SSH；执行治理页会在 job history 中展示 transport、agentRef 来源/状态、agent dispatch result 和 correlation 摘要，让 SSH 与 server agent 路径、dispatcher 投递结果、终态响应、dispatch/job/lease/retry/idempotency handle 和 blocked boundary 可被直接审计；Supervisor 也会只读汇总团队服务器的 agent readiness、heartbeat runtime 和 dispatcher 配置态，展示 capability 数量、services/tags 来源、状态分布、样例服务器、heartbeat 开关/token 配置态、heartbeat-required 门禁、online/stale/unknown、executor/dispatcher/token/timeout 和脱敏 dispatcher URL，并按 `transport=server_agent` 展示 agent job demand、下一条 ready agent job、blocked/failed 压力和近期 blocked reason/dispatcher boundary。后续还要补真实 server agent runtime、agent supervisor 和跨实例治理。

SSH live 远端 session/cleanup 事件已在 running `ServerExecutionJob.metadata.remoteExecution` 中持久化，供执行治理、stale recovery 和后续 agent supervisor 追踪远端 orphan 线索；`SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED=true` 时，stale recovery 会基于已记录的 SSH PID best-effort 清理 worker 崩溃后遗留的远端进程，并把结果写入 `remoteExecution.staleCleanup`，完整 agent supervisor 仍留待后续阶段。

当前也已具备 `ProjectWebhook` / `WebhookDelivery` 的最小闭环：可以在项目详情创建 Git push webhook 或 PR Preview webhook，获得 endpoint 和一次性 secret；secret 只在创建或轮换时明文返回一次，服务端保存 hash 和加密后的 HMAC 材料。Webhook 可绑定目标环境，Push 触发后可生成 deployment dry-run 计划、加入 Server executor dry-run 队列，或创建 live 部署审批申请；`live_request` 策略会创建非 dry-run DeploymentRun，但会先被 `OperationApproval` 拦截为 blocked run，审批通过后再入队执行。PR/MR 事件可通过 `deploymentMode=preview` 先创建或复用 `preview-pr-*` / `preview-mr-*` 项目环境骨架，并在 webhook 有创建人时创建或复用对应 draft Site 占位，例如 `preview-pr-42.preview.devpilot.local`，再生成安全的 dry-run queued DeploymentRun，trigger 标记为 `git_pr_preview`，并在 `params.preview` 记录 PR 编号、源分支、目标分支、head SHA、标题、URL、预览环境、基准环境和预览 Site；draft preview Site 可以在站点接管面板显式绑定服务器和 upstream，清除占位 `syncBlocked` 后生成 dry-run Nginx/OpenResty 计划；closed/merged 等关闭事件会归档既有预览环境骨架和 draft Site metadata，记录 `teardown.status=not_started`，且不会创建 DeploymentRun 或触碰真实 DNS、TLS、Nginx/OpenResty、容器或云资源。公开接收端会记录投递、识别 push / pull_request / merge_request 事件、匹配分支，按 providerEventId 或 payloadHash/branch/commit 生成幂等键，避免重复投递反复创建 DeploymentRun。第一版安全边界是不可猜测 URL token、可选 `x-devpilot-webhook-secret`、GitHub `x-hub-signature-256` HMAC、GitLab/Gitee token 校验、generic/custom secret 的 5 分钟 timestamp 时间窗和 secret rotation；生产级还需要补 provider 级签名时间窗、密钥版本保留、统一加密密钥治理和更细策略审计。

第一阶段只需要做 push webhook：

1. Git 平台发送 push event。
2. Devpilot 校验签名、secret、分支、重复投递。
3. 生成 `DeploymentRun`。
4. 调用 `ServerExecutor` 执行稳定脚本，例如 pull、build、docker compose up、health check。
5. 写入日志、状态和可回滚信息。

安全设计不能省：

- 每个 webhook 都有独立 secret。
- GitHub/GitLab/Gitee 等 provider 用各自签名校验 adapter。
- payload 存 hash 和裁剪后的原文，避免无限存储敏感内容。
- 按 commitSha、branch、eventId 做幂等。
- 操作命令从白名单 action/template 生成，不允许 payload 直接拼 shell。

## 4. 代理能力应该升级为站点管控

当前 `ProxyConfig` 更像“反向代理配置”。但用户实际要的不是只配一条 upstream，而是管理一个能对外服务的站点。

竞品依据：

- 1Panel 的 Website 能创建多种站点：应用一键部署、运行时环境、反向代理、静态网站、子网站，并把主域名、其他域名、HTTPS、站点目录、数据库、FTP 等作为同一站点表单的一部分。Source: https://1panel.pro/docs/v2/user_manual/websites/website_create/
- 1Panel 的 OpenResty 设置支持启动、停止、重启、reload、状态、配置修改、性能调优、日志和模块管理。Source: https://1panel.pro/docs/v2/user_manual/websites/openresty/
- Nginx Proxy Manager 聚焦转发域名、重定向、stream、免费 SSL、访问列表、HTTP Basic Auth、用户权限和审计日志。Source: https://nginxproxymanager.com/guide/
- Coolify 在 Docker Compose 场景中会给部署服务创建网络并添加 proxy service；服务可以通过 domain 暴露，端口映射则被提醒可能绕过 proxy 控制。Source: https://coolify.io/docs/knowledge-base/docker/compose

建议把能力从 `ProxyConfig` 演进为 `Site`。当前已经落地第一版 `Site` 最小闭环：站点可以关联项目、环境、服务器和旧 `ProxyConfig`，记录主域名、别名、运行时类型、运行时配置、TLS、访问策略、状态和同步错误；PR Preview 现在也会为预览环境创建 draft Site 占位并写入 `syncBlocked`，让后续临时域名、TLS、Nginx/OpenResty 和销毁流程挂到一等 Site 对象上，同时避免占位配置误同步。前端 `/sites` 支持创建、列表、删除、聚焦接管、生成 Nginx dry-run 同步计划，并可在 Server executor live transport 开启后执行站点同步；针对 PR Preview draft Site，聚焦接管面板可以补齐目标服务器、upstream 和 WebSocket 标记，调用受控接管接口清除 sync block 并立即生成 dry-run 计划。每次 dry-run、live sync 和 rollback 都会沉淀为 `SiteSyncRun`，保留 Nginx 配置快照、配置 diff、执行计划、结果、日志、错误、目标配置路径、审批单和 `ServerExecutionJob` 关联；成功 live run 可以作为回滚源重新写回、校验并 reload，非 dry-run 的同步/回滚需要先进入 OperationApproval 审批门禁，审批后可选择加入 Server executor 队列。

| 层级 | 能力 |
|----|----|
| Site | 已有：名称、项目、主域名、别名、状态、归属服务器 |
| Route | 已有：第一版通过 `runtimeConfig.upstreamUrl`/Docker 容器端口生成根路径代理；待补 path、负载均衡、超时、headers、rewrite |
| TLS | 已有：记录 TLS 类型、生成 Let’s Encrypt 命令计划，通过 Server executor OpenSSL 手动/定时探测回填证书元数据，并把探测到的公有证书元数据沉淀为 `Site.tls.assets` 资产快照；可发起受控 certbot 续期演练/审批续期，也可通过默认关闭调度器批量提交临期证书续期演练或审批续期；续期执行完成后会把 rehearsal/live 结果回写到 `Site.tls.renewal` 并在站点卡片展示摘要，正式续期成功后会自动排队执行后续 TLS probe 刷新实际证书元数据；可用 `AlertRule metric=certificate_expiry` 评估证书过期，`metric=tls_renewal_failure` 告警续期失败或续期后探测失败，也可用 `metric=certificate_asset_change` 告警证书资产变化；待补证书库、上传/绑定、OCSP、HSTS |
| Runtime | 已有：静态目录、Docker 服务、运行时服务、外部 upstream 的最小配置位 |
| Access | 已有：IP 白名单和 Basic Auth 配置计划；待补鉴权转发、限流 |
| Ops | 已有：Nginx 配置预览、配置 diff、OperationApproval 审批门禁、写入配置、可选 certbot、`nginx -t`、reload 的 Server executor dry-run/live sync/queued sync 边界，以及 `SiteSyncRun` 历史和基于成功配置快照的回滚；待补访问日志、错误日志、模块管理 |

执行层建议仍然沿用当前方向：第一阶段用稳定 `ServerExecutor`。当前已新增通用 `ServerExecutorModule`，资源动作、部署运行、站点同步、服务运行态操作、服务器备份和日志采集都统一走 `server-executor` adapter，输出标准 `commandPlan/result/logs/status`。默认路径是 `script-plan`，可显式启用 `ssh-live`；默认关闭的 `server-agent` adapter 已能为 `server_agent` target 生成 dispatch envelope，并在 live 模式下阻断到真实 dispatcher 接入点；Server target 解析也已支持默认关闭的 agent capability 选择，只有显式开启且服务器 services/tags 标记 agent 时才返回 `server_agent` target；DeploymentRun、SiteSyncRun、ResourceActionRun、ApplicationServiceOperationRun、BackupRun 和 LogCollectionRun 已接入 `ServerExecutionJob` 队列桥，未来再替换为 server agent executor。

## 5. 竞品差距

### 5.1 1Panel

1Panel 更像完整 VPS 控制面板，覆盖网站、SSL、运行时、数据库、容器、文件、监控、防火墙、进程、SSH、终端、计划任务、WAF、日志审计、备份恢复。官方 Overview 也把网站部署、应用市场、集中服务器管理、安全、备份恢复列为核心能力。Source: https://1panel.pro/docs/v2/

Devpilot 缺口：

- 缺完整站点模型，不只是 proxy。
- 缺服务器系统管理：文件、进程、防火墙、SSH、终端、计划任务。
- 缺 OpenResty/Nginx 生命周期管理：配置测试、reload、日志、模块。
- 缺备份恢复和安全审计闭环。
- 缺应用市场/模板化安装能力。

### 5.2 Coolify

Coolify 重点是自托管 PaaS：Git 集成、自动部署、PR 预览、Docker Compose、环境变量、数据库、一键资源、域名和代理。数据库页还把 public port 解释为通过 Nginx TCP proxy 暴露数据库。Source: https://coolify.io/docs/databases

Devpilot 缺口：

- Git 到部署的主线已有 source、build、deploy、health、dry-run/queued rollback、失败 live deploy 回滚申请、失败 Smoke 受控回滚申请、默认关闭的失败 Smoke 自动回滚计划/审批申请、预授权 live 自动回滚提交、live rollback 后自动 Smoke、PR Preview 环境骨架、draft Site 占位、占位 Site 接管生成 dry-run Nginx/OpenResty 计划、关闭/合并归档和 PR Preview dry-run queued DeploymentRun 最小闭环；仍缺真实临时预览基础设施、真实临时域名/TLS/Nginx live 同步、真实资源销毁和真实部署日志。
- 已具备 PR/MR 预览环境骨架、draft Site 占位、占位 Site 接管 dry-run 计划和关闭/合并归档；缺真实预览资源、部署产物、临时域名/TLS 生效和关闭 PR 后的真实资源销毁流程。
- 缺环境变量/secret 与 compose 文件的联动检测。
- 缺数据库作为一等部署资源的创建、连接、备份、日志、监控。
- 缺部署日志和部署历史。

### 5.3 Portainer

Portainer 的强项是多环境容器管理：Docker、Swarm、Kubernetes、Podman、Azure ACI。它支持从 Web editor、上传、Git repository、模板创建 stack，也支持 stack webhook 和 GitOps 更新。Portainer Agent 用容器方式连接 Portainer Server 并访问节点资源。Source: https://docs.portainer.io/user/docker/stacks/add and https://docs.portainer.io/admin/environments/add/swarm/agent

Devpilot 缺口：

- 缺环境/服务器注册模型与连接健康。
- 缺 stack/compose 作为一等对象。
- 缺 GitOps drift 检测和 commit hash 记录。
- 缺多节点、多集群、多 provider 的统一环境视图。
- 当前 executor 还缺完整“环境能力矩阵”：Docker、Compose、K8s、云厂商各支持哪些动作，以及每个动作是否支持 dry-run/live/rollback。

### 5.4 Dokploy

Dokploy 把应用作为 workspace，应用内有 General、Environment、Monitoring、Logs、Deployments、Domains、Advanced Settings。它还支持数据库管理、监控、日志、自动备份到 S3 destinations。Source: https://docs.dokploy.com/docs/core/applications and https://docs.dokploy.com/docs/core/databases

Devpilot 缺口：

- 缺项目内的应用/服务工作区。
- 缺监控图、实时日志、部署队列、取消部署。
- 缺数据库备份/恢复。
- 缺 external build server 概念，无法把构建和生产部署隔离。
- 缺 domain、deployment、resource 的统一应用页。

## 6. Devpilot 现在还缺的关键东西

最核心缺口不是某一个页面，而是一条完整控制闭环：

```mermaid
flowchart LR
  Repo["代码源"] --> Build["构建"]
  Build --> Deploy["部署"]
  Deploy --> Site["站点入口"]
  Site --> Observe["日志/监控/告警"]
  Observe --> Operate["操作/回滚/扩容"]
  Operate --> Backup["备份/恢复"]
  Backup --> Audit["审计/权限"]
```

现在 Devpilot 已有项目、资源、服务器、执行器的雏形，但缺少把它们串起来的产品对象：

- `Environment`：项目的 dev/test/staging/prod 边界。
- `Application/Service`：一个项目里可部署和观察的服务。
- `Deployment`：从代码/镜像/compose 到服务器的执行记录。
- `Site`：域名、证书、路由、访问控制和 Nginx/OpenResty 生命周期。
- `Database` / `ResourceConnectionRun` / `ResourceQueryRun`：MySQL/Postgres/Redis/RDS/SLS/COS 这类可连接、可查询、可备份、可监控的资源；当前已有云凭据和 DB/Redis 只读账号创建入口、资源环境/服务器/Provider 凭据/查询凭据绑定入口、连接/授权探测运行记录、只读查询/浏览运行记录、结果预览契约和 adapter 计划。
- `BackupPlan` / `BackupRun`：已有最小闭环，支持数据库/Redis/RDS 备份计划、dry-run 运行记录、服务器备份队列桥和审计关联；真实备份/恢复待补。
- `AlertRule` / `AlertSilence` / `AlertNotificationChannel`：已有最小闭环，支持服务、服务器、站点、站点证书过期、站点 Smoke 失败、资源、备份和部署状态、云同步失败、日志错误数、资源指标阈值、服务 SLO 违约、服务错误预算和错误预算耗尽预测的告警规则、手动评估、默认关闭的定时评估、告警事件、维护窗口静默、事件去重抑制，以及通用 Webhook、飞书、钉钉、企业微信机器人和邮件通知投递；失败或 planned 投递已支持手动重试并写入审计，失败投递也支持默认关闭的自动重试，长期未确认严重告警支持默认关闭的升级通知；监控页已具备服务 SLO 大盘、服务 SLO 违约告警创建入口、站点 Smoke 失败告警创建入口、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测和 SLO 模板第一版。
- `LogStream` / `LogCollectionRun`：已有最小闭环，支持服务、服务器、站点、资源、部署、备份和告警日志的统一归档、查询，Docker/Nginx/服务器日志采集 dry-run 计划和队列桥，默认关闭的 Server executor 定时 follow，SLS GetLogs dry-run/live 查询与默认关闭的按流回填调度，以及基于入库 `LogEntry` 的 SSE 流式 tail、cursor resume、自动重连、有界会话治理、活跃会话列表、主动断开和单流/用户/团队基础限流。
- `AuditEvent`：已有最小闭环，记录谁在什么项目、什么环境、对什么资源执行了部署、资源动作、资源连接探测、资源只读查询、服务操作、备份、告警评估、日志归档或日志采集计划。

当前阶段可以概括为：P0-P4 的项目纳管与控制面主链路已经成型，项目详情已具备按环境聚合的工作台视图，并能把环境缺口联动到带项目/环境上下文的资源管控、应用服务和站点创建入口，还能只读展示 dev/test/staging/prod 之间的服务、部署配置、站点/TLS、资源和密钥差异；项目环境 API 已新增只读同步建议，会在权限过滤后的可见环境内选择参考环境，并给出补服务器角色、服务、部署配置、运行绑定、资源类型、站点运行时、CDN、密钥和成功部署记录的建议动作；同步建议已具备第一版确认执行入口，可以先 dry-run 生成计划，再在目标环境确认后创建缺失应用服务骨架或补齐非敏感 deployConfig 字段，服务器、站点、资源、CDN 和密钥仍只作为待手动确认项；项目环境还支持把已属于项目但未归属环境的 Site、ManagedResource、ResourceInstance、CDNConfig 和 SecretKey 按类型/单项选择、预览并确认绑定到选中环境，只更新 environmentId，不复制实际资源或读取密钥值；跨环境 Site 配置骨架复制已具备项目详情确认入口，支持选择源环境、逐个填写目标域名、预览计划并确认创建 draft Site，不复制服务器/代理绑定、Nginx 同步状态或证书资产；跨环境 CDN 配置骨架复制已具备 API 和项目详情确认入口，要求显式提供目标域名、源站和目标 credentialId，apply 只创建 pending CDNConfig，不自动复用源环境凭据、不复制 providerData/syncError、不调用云 provider；跨环境 ManagedResource/SecretKey 配置骨架复制已具备 API 和项目详情确认入口，要求显式提供目标 externalId 或新密钥值，可选目标 server/credential，apply 只创建 unknown 资源骨架和加密后的目标密钥，不复制资源 metadata/config/sync 状态、不读取源密钥值，也不把 secret value 写入审计，复制结果已能深链到资源管控详情并生成 dry-run 连接探测计划；P5 的资源绑定、连接探测、只读查询计划、结果预览契约、云资源 live inventory、DB/Redis live readonly 查询和备份计划 dry-run 最小闭环已经启动，Docker 容器 read/restart 已进入 Server executor live action 和队列桥边界，Docker 指标已具备快照持久化、默认关闭的调度采集、短窗口趋势摘要和阈值告警第一版，服务器备份 dry-run 已进入队列桥边界；P6 的监控告警规则/事件、站点证书手动/定时探测、证书资产变化告警、证书续期结果回写、正式续期成功后的自动探测刷新、证书过期告警、TLS 续期失败告警、默认关闭定时评估、静默窗口、事件去重抑制、通用 Webhook 通知、飞书/钉钉/企微机器人通知、邮件通知、手动投递重试、默认关闭的失败投递自动重试、默认关闭的严重告警升级通知、服务 SLO 大盘第一版、服务 SLO 违约告警第一版、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测和 SLO 模板第一版已经补齐，P7 的日志中心归档/查询、采集运行 dry-run、Server executor 定时 follow、SLS credential-backed live 查询入库、SLS 按流回填调度、入库日志 SSE 流式 tail、cursor resume 自动重连、有界会话治理、活跃会话控制、单流/用户/团队基础限流和队列桥最小闭环已经补齐，P8 的统一审计、审批、命令策略、团队/项目/环境级策略模板、Server executor live lease 并发门禁、执行治理可视化、execution job 重试入口、队列 worker 基座、DeploymentRun/SiteSyncRun/ResourceActionRun/ApplicationServiceOperationRun/BackupRun/LogCollectionRun 队列桥和锁租约恢复已经补齐，DeploymentRun 已具备基于成功 run 的 dry-run/queued rollback、live 部署/回滚审批门禁和失败 live deploy 回滚申请，Site 已具备 Nginx/OpenResty 同步历史、队列化同步/回滚、基于配置快照的回滚，以及 Nginx/OpenResty 诊断运行；控制面访问策略已覆盖审批链路、项目/环境/站点写接口，资源、应用、备份、日志、监控的主要写接口，服务器、CDN、密钥、资源申请、资源实例、团队资源池分配和旧资源凭证写接口，以及项目生成/预览、预设、Git、旧域名和旧 CDN 配置生成等早期项目交付入口；读权限已覆盖密钥列表/值/导出、资源申请/实例、资源管控资源与运行记录、日志流/日志条目/采集运行、监控规则/告警事件、告警静默、告警通知通道/投递、执行治理 job/lease、命令策略模板、审计事件、站点与同步历史、CDN 配置、团队凭据、服务器、旧资源凭证、部署运行、审批单、应用/服务/操作记录、备份计划/运行、项目环境、项目 Webhook/投递、项目列表/详情嵌套资源和旧代理配置。产品还没到“生产级运维平台”，但已经从资源登记台进入了项目/环境/服务维度的控制台阶段。

补充：P6 也已纳入站点 Smoke 检查失败告警，可基于最近 N 次非 dry-run `SiteSyncRun mode=smoke_check` 触发标准告警事件、静默、通知、审计和升级链路。

已具备：

- 项目可以是生成项目、已有项目、仅构建部署项目或外部资源归属项目。
- 项目环境可以承载服务器、站点、部署运行、托管资源、资源申请实例、CDN 和密钥。
- 生成项目向导已支持数据库引擎选择，默认 MySQL，可选 PostgreSQL/SQLite；生成器会按引擎输出 README、Prisma datasource、`.env.example` 和本地 docker-compose 数据库服务，SQLite 不生成外部数据库服务。
- 生成项目 ZIP 已支持本地 artifact 持久化和可复用 `downloadUrl`：生成响应仍即时返回 ZIP，同时写回 `Project.downloadUrl` 和 `config.generatedArtifact`，项目详情可通过受项目读权限保护的下载接口重新获取生成包；生产级对象存储、过期清理和历史补档待补。
- 生成项目资源解析结果已在项目详情可见：manual/credential/instance/pool/skipped 解析会写入 `config.resolvedResources`，项目详情展示资源模式、来源和资源池分配摘要；Project API 对 allocation 只返回安全摘要字段，不返回 encrypted credentials。
- 项目详情已新增环境工作台：按 dev/test/staging/prod 聚合服务器、应用服务、站点、部署、ManagedResource、ResourceInstance、CDN 和密钥摘要，展示跨环境基础对象差异、配置差异、后端只读同步建议和未绑定环境的资源提醒，并支持从缺口标签或建议动作跳转到带当前项目/环境上下文的操作入口；非参考环境可生成同步计划或确认应用服务配置，先覆盖缺失应用服务骨架和非敏感部署配置字段；未绑定环境的项目资源可按类型/单项勾选后预览，再确认归属到当前选中环境；站点可选择源环境、逐项填写目标域名后预览跨环境复制计划，并确认创建目标环境 draft Site；CDN 可选择源环境、逐项填写目标域名/源站/凭据后预览复制计划，并确认创建目标环境 pending CDNConfig；资源/密钥可选择源环境、逐项填写目标 externalId、目标 server/credential、目标密钥名和值后预览复制计划，并确认创建目标环境 ManagedResource/SecretKey 安全骨架；已创建的资源骨架可从复制结果直接跳转到资源管控详情或生成连接探测计划。
- Server executor 已统一资源动作、部署运行、站点同步和服务运行态操作，默认输出稳定 dry-run 脚本计划。
- ResourceControl 已支持 Docker 容器 inspect/logs、Docker MySQL ping 和 Docker Redis info 通过 Server executor 生成计划或执行 live read；Docker restart 仍走审批和资源名称确认后才能 live。
- Application/Service 已经成为部署、站点、服务器和资源的服务视角。
- 审计事件已经能统一串起 DeploymentRun、ResourceActionRun、ApplicationServiceOperationRun、BackupRun、AlertEvent 和 OperationApproval。
- 中高风险 live 资源动作、服务操作、非 dry-run 的站点同步/回滚，以及非 dry-run 的部署/回滚已经进入 OperationApproval 审批门禁。
- Server executor 已接入内置命令策略和 `ServerCommandPolicyTemplate`，live/dry-run 执行计划都会先经过危险命令基线，再合并团队/项目/环境级 allow/block 模板。
- Server executor 已接入 `ServerExecutionLease`，同一团队同一服务器默认只允许一个非 dry-run live 执行持有 lease；冲突会返回标准 blocked 结果并记录 blocked lease。
- 执行治理页面已能查看 Server executor running/blocked/completed/failed/expired lease，并支持管理员手动释放过期 lease。
- Server executor 已接入 `ServerExecutionJob`，所有通过 `execute()` 的执行都会沉淀输入快照、状态、结果和错误；执行治理页面已支持查看 job history，并对 failed/blocked/cancelled 任务发起 queue retry，对 queued/blocked/running 任务发起取消请求；取消请求、取消、queued/inline 重试、手动处理队列和 stale recovery 治理动作也会写入 `category=execution`、`targetType=server_execution_job` 的统一 `AuditEvent`，metadata 保留原 job、重试 job 和远端 cleanup 证据。
- Server executor 已具备 queued job worker 基座：`SERVER_EXECUTOR_QUEUE_WORKER_ENABLED=true` 可开启定时领取，管理员也可在执行治理页手动处理下一个 queued job；running job 会通过 `cancelRequestedAt` 持久取消信号让执行 worker 轮询感知并中断当前 SSH live 子进程；SSH live 脚本会通过远端临时 wrapper 输出子进程 PID，cancel/timeout 时会 best-effort 发起独立 SSH cleanup 终止远端进程组/子进程；failed/blocked queued job 可按 maxAttempts 自动入队重试。
- 执行治理页已新增 Server executor supervisor snapshot，可查看当前 API 进程 worker id、queue worker 开关、批量大小、轮询/锁/心跳/取消参数、ready/scheduled/running/stale 队列积压、active/blocked/expired live lease、下一个 queued job 和最近 worker owner 摘要；该状态面只读聚合现有 `ServerExecutionJob` / `ServerExecutionLease`，不改变执行语义，为后续 server agent supervisor 与多实例队列治理提供可观测契约。
- Server executor 已新增默认关闭的 `server-agent` adapter 边界：`server_agent` target dry-run 会生成 agent dispatch envelope，记录 target、step、policy、metadata 和 correlation；live agent dispatch 默认 blocked，只有 `SERVER_EXECUTOR_AGENT_ENABLED=true` 且配置 `SERVER_EXECUTOR_AGENT_DISPATCHER_URL` 时才会通过 HTTP dispatcher 发送 envelope，并把 dispatcher 终态响应映射回标准 Server executor result。dispatcher envelope/result/plan/header 已包含 `serverExecutionJobId`、lease id、retry attempt、dispatch id 和 idempotency key；adapter 返回后会 best-effort 写入 `server_execution_job.agent_dispatch` 审计事件，保留 correlation、dispatcher 配置态、终态、boundary 和 whitelisted response 摘要。
- Server executor target 解析已支持默认关闭的 agent capability 选择：仅当 `SERVER_EXECUTOR_AGENT_TARGET_ENABLED=true` 且服务器 `services` 或 `tags` 标记 Devpilot/server agent capability 时，才返回 `transport=server_agent` 和 `agentRef` 证据；默认仍走 SSH target。
- 执行治理页已在 job history 中展示 execution target 路径：所有任务可看到 `transport`，`server_agent` target 可看到 agent displayName、capabilityKey、source 和 status，且可从 `ServerExecutionJob.result` 查看 agent dispatch 摘要，包括已投递/投递失败/live 阻塞、dispatcher 配置态、脱敏 dispatcher、终态响应 status/run id、dispatch id、job/lease id、retry attempt、idempotency key 和 `server_agent_dispatcher` boundary，便于审计 SSH 与 server agent 迁移路径。
- Supervisor 已新增只读 dispatcher config 摘要：展示 agent executor 是否开启、dispatcher URL 是否配置、脱敏 URL、timeout 和 token 配置状态，不主动探测外部 dispatcher，也不暴露 token。
- Supervisor 已新增只读 agent readiness 和 heartbeat runtime 摘要：复用 Server.services/tags capability 解析，展示 target selection 开关、capable/online/source/status 统计和 sample servers；默认关闭的 `POST /server-agent/heartbeat` 只有配置 heartbeat token 后才会写入 `Server.services.devpilotAgent` 白名单字段，Supervisor/UI 会展示 heartbeat enabled/token、heartbeat-required target selection 门禁、online/stale/unknown 和样例 lastSeen/expiresAt，为后续真实 agent supervisor 留出可观测契约。
- Supervisor 已新增只读 agent job demand 摘要：按 `transport=server_agent` 聚合 ready/scheduled/running/stale/blocked/failed/cancelled，并展示下一条 ready agent job，让 agent dispatcher 接入前也能观察任务压力。
- Supervisor 已新增只读 agent blocked reason 摘要：扫描最近 blocked `server_agent` job 的 error/result，聚合 reason 分布、`server_agent_dispatcher` boundary 数和样例任务，用于定位 dispatcher 未接入、命令策略阻断或配置告警。
- Server executor 已将 SSH live 远端 session/cleanup 事件写入 running `ServerExecutionJob.metadata.remoteExecution`，让 stale recovery 和后续 agent supervisor 能在 job metadata 中看到远端 PID、cleanup 策略和清理结果；显式开启 `SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED=true` 后，stale recovery 会复用 SSH key auth 对已记录 PID 发起 best-effort orphan cleanup，并把追偿清理结果写入 `remoteExecution.staleCleanup`；执行治理页会在任务列表中展示远端 PID、执行期 cleanup 和 stale 追偿 cleanup 摘要。
- DeploymentRun 已接入 Server executor 队列桥：创建部署运行时可选择 queue，业务记录会保存 `serverExecutionJobId` 和 queued result，worker 执行完成后回写 DeploymentRun 状态、计划、日志和结果。
- DeploymentRun 已支持回滚最小闭环：成功部署 run 可作为 sourceRun 发起 rollback run，生成 checkout/build/redeploy/health_check 计划并可加入队列；非 dry-run 部署/回滚会先生成 blocked run 和 OperationApproval，审批通过后再执行并消费审批单；失败 live deploy 可一键申请回滚到最近成功 live deploy。
- ProjectWebhook 已支持目标环境和触发策略：Git push 可生成 dry-run DeploymentRun、创建 queued dry-run DeploymentRun，也可创建 live deployment approval request；PR/MR 事件可创建或复用 `preview-pr-*` / `preview-mr-*` 项目环境骨架和 draft Site 占位，生成 `git_pr_preview` dry-run queued DeploymentRun 并记录 preview environment/site metadata，draft Site 可在站点页接管并生成 dry-run Nginx/OpenResty 计划，关闭/合并事件会归档既有预览环境和 draft Site metadata 且不创建 DeploymentRun；WebhookDelivery 已记录 idempotencyKey，重复投递会复用既有 delivery/run。
- ResourceActionRun 已接入 Server executor 队列桥：资源管控页可选择把服务器资源动作加入队列，业务记录会保存 `serverExecutionJobId`，worker 完成后回写状态、命令计划、结果和审批消费；Docker 容器资源已支持 `docker stats` 指标快照动作，并能把 completed live 输出沉淀为 `ResourceMetricSnapshot`，还可在显式开启调度后按最近采集时间入队采集，并展示趋势摘要和资源详情指标曲线。
- ApplicationServiceOperationRun 已接入 Server executor 队列桥：应用服务页可选择把服务状态、日志、重启、回滚操作加入队列，worker 完成后回写状态、命令计划、日志、结果和审批消费。
- BackupRun 已接入 Server executor 队列桥：备份页可选择把服务器侧 Docker MySQL/Redis dry-run 备份计划加入队列，worker 完成后回写状态、命令计划、日志、结果和备份计划 lastStatus。
- LogCollectionRun 已接入 Server executor 队列桥：日志中心可选择把 Docker、Docker Compose、Nginx 和服务器 `/var/log` dry-run 采集计划加入队列，worker 完成后回写状态、命令计划、日志和结果。
- Server executor 已具备基础锁租约和僵尸恢复：running job 会写入 lockOwner、lastHeartbeatAt 和 lockExpiresAt 并周期续租；worker 和管理员可恢复 lock 过期的 running job，标记 failed/stale，并在 maxAttempts 未耗尽时自动 queue retry。
- ManagedResource 已支持在资源管控页调整项目环境、服务器、Provider TeamCredential 和查询 TeamCredential 绑定；资源管控页已支持创建 `cloud_aliyun` / `cloud_tencent` 云凭据以及 `db_mysql_readonly` / `db_redis_readonly` 只读账号，使 Credential/Auth adapter 边界可以从 UI 落地。
- 资源类型管理页已支持 `requestSchema.fields` 和 `deliverySchema.fields` 的可视化新增/编辑：管理员可以维护字段 key、label、类型、必填、敏感、默认值、占位符和 select options，提交仍保存为现有 `{ fields: [...] }` 契约，申请与交付动态表单无需改 API 即可消费。
- 资源申请已具备 `provisioningMode` 处理器第一版和外部 adapter 执行/治理边界：`manual` / `credential_only` 继续人工交付，`pool` 在审批通过或免审批 approved 后会调用 ResourcePool allocation、拆分敏感凭证、创建 ResourceInstance、写入 request result 和 ResourceAuditLog；`script` 会委托 Server executor 生成/执行受控脚本计划，并把 job 摘要、队列、阻断或完成状态写回申请，metadata 带稳定 idempotencyKey 和可选 redacted credentialRef；`webhook` / `api` 默认不外呼，只有显式开启 `RESOURCE_PROVISIONING_HTTP_ENABLED=true` 且配置 endpoint 后才调用 HTTP adapter，成功响应按 deliverySchema/敏感 key 拆分后可完成申请并创建 ResourceInstance；HTTP adapter 已能解析 `provisioningConfig.credentialId` / `auth.credentialId` 为 TeamCredential 红线内引用，只在 header/payload/result/audit 中保留 redacted credentialRef、authAdapterKey 和 idempotencyKey，不解密或持久化 secret material；`provider` 模式已固定 provider SDK adapter contract，默认 dry-run 生成 provider/operation/region、Credential/Auth ref、idempotencyKey、providerState 查询计划和 redacted evidence，显式 providerState 或当前 run 级 providerState 对账可幂等完成申请并创建 ResourceInstance，但真实 provider SDK live transport 仍默认不执行；408/425/429/5xx 与网络异常可按 `maxAttempts` 做 bounded retry，失败或配置不完整会写 planned/blocked 边界和审计。已审批且仍处于 blocked/planned 的非人工处理器可通过 `POST /resource-requests/:id/retry-provisioning` 手动重试，先写 `provisioning.retry_requested` 审计，再复用当前 ResourceType provisioningConfig 进入原处理器；显式配置 `provisioningConfig.autoRetry.enabled=true` 且启用默认关闭的 `RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED` 后，retryable HTTP blocked 申请会按 `nextAttemptAt` 自动补偿并写 `provisioning.auto_retry_requested` 审计；HTTP `api`/`webhook` 和 provider 每次外部交付都会创建 `ResourceProvisioningRun` 运行账本，保存 trigger、adapter/auth/executor、idempotencyKey、attempt/maxAttempts、status、providerRunId、脱敏结果和错误摘要，并让 ResourceAuditLog 关联到该 run；当前资源申请正在指向的 planned/blocked/failed HTTP/provider run 可通过 `POST /resource-requests/:id/provisioning-runs/:runId/replay` 受控重放，新 run 记录 `replayOfRunId` 并写 `provisioning.run_replay_requested` 审计；当前 provider run 还可通过 `POST /resource-requests/:id/provisioning-runs/:runId/reconcile-provider-state` 提交 providerState 对账，系统脱敏写入 `provisioning.provider_state_reconciled` 审计，pending/failed 更新 run 证据，completed 则按 deliverySchema 拆分敏感凭据并完成申请；默认关闭的 `RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED` 可以扫描超时 running HTTP run，标记 failed、写 `recoveredAt/recoveryReason/recoveryCount` 和 `provisioning.run_stale_recovered` 审计，并在该 run 仍是当前申请 run 时回写 blocked 以接上重放入口；`provisioningConfig.queue.enabled=true` 或 `queue=true` 可让 approval/retry/replay 先落 `queued` run，`POST /resource-requests/provisioning-runs/process-next` 会在本 team 内认领最早可用 queued HTTP run 并执行同一条 run，显式开启 `RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED=true` 后 scheduler 也可按 `RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_BATCH_SIZE` 跨 team bounded 消费 queued HTTP run；`GET /resource-requests/provisioning-runs/supervisor` 已提供 team-scoped 运行治理摘要，`POST /resource-requests/provisioning-runs/recover-stale` 可手动恢复本团队超时 run；资源申请列表可展示交付模式、处理器状态、queued/running/stale 运行治理摘要、“处理下一条队列”、“重试交付”和“运行记录”操作，运行记录弹窗按申请读取 provider run、attempt、idempotencyKey、错误、时间、队列时间、重放来源和 stale recovery 摘要，并可对当前可恢复 run 发起重放或 providerState 对账。
- ResourceConnectionRun 已经能为 Docker 容器、Docker MySQL、Docker Redis、阿里云 RDS、阿里云 SLS 和腾讯云 COS 生成连接/授权探测计划，并记录 Credential/Auth adapter 与 Executor adapter 边界。
- ResourceQueryRun 已经能为 MySQL/RDS 生成只读 SQL 计划，为 Redis 生成只读浏览计划，为 SLS/COS 生成 provider SDK 查询/列表计划；运行结果已经包含统一 preview/pageInfo/redaction/livePrerequisites 契约，资源管控页可展示结果预览，并写入统一审计事件。
- BackupPlan/BackupRun 已经能为 Docker MySQL、Docker Redis 和阿里云 RDS 生成 dry-run 备份执行计划，并写入统一审计事件；服务器侧备份 dry-run 已支持 `ServerExecutionJob` 队列桥。
- AlertRule/AlertEvent 已经能为服务、服务器、站点、站点证书过期、证书资产变化、TLS 续期失败、站点 Smoke 失败、资源、备份、部署、云同步、日志错误和资源指标创建告警规则，支持手动评估和默认关闭的定时评估，生成告警事件后写入统一审计并进入静默/通知链路。
- LogStream/LogEntry 已经能把服务、服务器、站点、资源、部署、备份和告警日志按项目/环境归档和检索，并将追加动作写入统一审计。
- LogCollectionRun 已经能为 Docker、Docker Compose、Nginx 和服务器 `/var/log` 日志生成 Server executor dry-run 采集计划，并可选择加入 `ServerExecutionJob` 队列；非 dry-run 完成后会解析 stdout/stderr/executor logs，脱敏后自动写入 LogEntry；SLS 日志流已能生成 `cloud-sdk` / `aliyun-sls-query-plan` GetLogs dry-run 查询计划，也能在 `LOG_CENTER_SLS_LIVE_QUERY_ENABLED=true`、绑定 `cloud_aliyun` TeamCredential 且显式 `confirmLiveRead` 后通过 `aliyun-sls-live-query` adapter 拉取日志、脱敏并写入 LogEntry。
- Site 已经能发起 Nginx/OpenResty 诊断运行：通过 Server executor 执行或排队执行 `nginx -t`、access.log/error.log tail，并把日志摘要沉淀到 SiteSyncRun 和审计事件。

尚未完成：

- 真实执行治理还不够完整，SSH live 虽已默认关闭接入，命令策略、策略模板、live lease 并发门禁、execution job、队列 worker 基座、执行治理 supervisor 状态面、DeploymentRun/SiteSyncRun/ResourceActionRun/ApplicationServiceOperationRun/BackupRun/LogCollectionRun 队列桥、DeploymentRun 手动回滚、失败回滚申请、失败 Smoke 自动回滚计划/审批申请、预授权 live 自动回滚提交、live rollback 后自动 Smoke、基础锁租约、持久取消轮询、SSH live 远端进程树 best-effort cleanup、remoteExecution metadata、默认关闭的 stale orphan cleanup、审批链路访问策略、主要读写接口访问策略和自动 retry 入队也已有内置基线，且已有第一组服务/入口级授权回归测试；但完整 server agent supervisor、多实例 worker 协调和更多集成/e2e 级授权覆盖还要补。
- 站点已进入 Nginx/OpenResty live sync、诊断运行、低风险 Smoke 检查、Smoke 失败告警、配置 diff、审批门禁、配置快照回滚、证书手动/定时探测回填、证书资产快照、受控证书续期计划、续期结果回写、正式续期成功后的自动探测刷新、默认关闭续期调度和证书过期告警边界，但真实执行仍依赖 `SERVER_EXECUTOR_LIVE_ENABLED=true`、SSH key auth、命令策略和 executor lease；模块管理、证书库/上传绑定、真实环境 smoke 自动化、日志归档自动化和完整队列治理还没闭环。
- 数据库/Redis/RDS/SLS/COS 已有连接/授权探测和只读查询/浏览计划，DB/Redis 已补 live readonly 查询，阿里云 RDS/SLS 与腾讯 COS 已补 live inventory；备份目前到 dry-run 计划、运行记录和服务器备份队列桥，真实备份/恢复仍待补。
- 可观测性目前具备状态型告警、站点证书手动/定时探测、证书过期告警、证书资产变化告警、TLS 续期失败告警、站点 Smoke 失败告警、维护窗口静默、事件去重抑制、通用 Webhook/飞书/钉钉/企业微信机器人通知、邮件通知、失败/planned 通知投递手动重试、默认关闭的失败通知自动重试、默认关闭的严重告警升级通知、手动日志归档、日志采集 dry-run 计划、默认关闭的 Server executor 定时 follow、SLS GetLogs dry-run/live 查询、默认关闭的 SLS 按流回填调度、采集完成后自动入库第一版、可配置日志脱敏策略、近实时日志 tail、入库日志 SSE 流式 tail、cursor resume 自动重连、有界会话治理、活跃会话列表、主动断开和单流/用户/团队基础限流，以及 Docker 容器指标快照动作、最近指标快照持久化、默认关闭的调度采集、短窗口趋势摘要、资源详情指标曲线、监控页资源指标大盘、服务 SLO 大盘、资源指标阈值告警、服务 SLO 违约告警、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测和 SLO 模板第一版；仍缺 agent 级持续日志 follow 和真实 SLO 周期/多周期错误预算策略。
- 权限已经从团队角色级推进到项目、环境、操作分类、action 和 risk 维度的控制面策略；密钥中心、资源申请/实例、资源管控、日志、监控、执行治理、命令策略、审计、站点、CDN、服务器、团队凭据、旧资源凭证、部署、审批、应用服务、备份、项目环境、项目 Webhook、项目详情嵌套资源和旧代理配置已接入只读可见性与敏感读取授权；第一组 Jest 回归已覆盖 owner bypass、deny 优先、默认角色门槛、显式 policy allow、敏感读取、部署列表过滤、live rollback high-risk gate 和项目详情嵌套资源过滤，下一步要扩展到真实 DB fixture 或 e2e 级权限用例。

## 7. 建议路线

### P0. 项目纳管入口

状态：第一版已完成。

- 新增已有项目接入。
- 项目可不绑定技术栈。
- 项目可不绑定初始化器。
- 项目详情开始呈现来源、环境、仓库、技术栈、资源入口。
- 生成项目已支持 Project 记录、即时 ZIP 响应、本地 artifact 持久化、`downloadUrl` 写回和项目详情重新下载。
- 生成项目已支持资源解析结果可追踪：项目详情展示生成时使用的手动配置、已有凭证、资源实例、资源池分配或跳过状态；资源池 allocation 只暴露安全摘要。
- 仅构建部署项目支持创建 dry-run `DeploymentRun` 执行计划。
- 仅构建部署项目支持创建 Git push `ProjectWebhook` 和 PR Preview `ProjectWebhook`，投递后可生成 dry-run `DeploymentRun`、加入 Server executor dry-run 队列、创建 live 部署审批申请，或创建/复用 PR/MR 预览环境骨架和 draft Site 占位并生成带 PR/MR 与 preview Site 元数据的 `git_pr_preview` queued dry-run 运行；draft preview Site 可从站点页接管并生成 dry-run Nginx/OpenResty 计划；关闭/合并事件可归档预览环境骨架和 draft Site metadata，并具备重复投递幂等基线。

### P1. 项目环境与资源绑定

状态：环境资源绑定闭环、项目详情环境工作台、服务器确认绑定、缺口操作入口联动、跨环境配置差异只读版、跨环境同步建议只读版、服务/部署配置同步计划第一版、跨环境 Site 配置骨架复制 API 与前端确认入口第一版、跨环境 CDN 配置骨架复制 API 与前端确认入口第一版、跨环境 ManagedResource/SecretKey 配置骨架复制 API 与前端确认入口第一版、复制后资源接管入口第一版、复制后 Site 聚焦接管和服务器/TLS 绑定表单第一版，以及未绑定项目资源可选择归属第一版已完成。

- 已新增 `ProjectEnvironment` 模型和 `/project-environments` API。
- 已支持项目创建后从 `config.environments` 初始化环境记录。
- 缺少 `config.environments` 时，项目配置规范化和环境初始化都会默认使用 dev/test/staging/prod 四环境；生成项目和接入已有项目的前端默认值也已对齐到四环境。
- 已支持旧项目从项目详情触发环境同步。
- 项目详情已展示环境记录，并兼容旧 config 环境。
- 已支持 Site 创建/更新时绑定项目环境。
- 已支持 DeploymentRun 创建时绑定项目环境，并兼容旧 `environment` 字符串。
- 已支持服务器通过 `ProjectEnvironmentServer` 绑定到项目环境；项目详情环境工作台可选择团队可读服务器、确认 deploy/runtime/database/edge/mixed 角色后绑定，也可确认解绑，绑定/解绑都会写入统一审计。
- 已支持 ManagedResource、ResourceRequest、ResourceInstance、CDNConfig 和 SecretKey 绑定到项目环境。
- 已支持在资源管控页重新绑定 ManagedResource 的环境、服务器和 TeamCredential，并将绑定变更写入统一审计。
- 已支持 ResourceControl 按环境同步 Docker/云资源，并在资源清单按环境过滤。
- 项目详情已展示每个环境的服务器、站点、部署、资源、CDN 和密钥数量。
- 项目详情已支持按环境切换查看服务器、应用服务、站点、部署、ManagedResource、ResourceInstance、CDN 和密钥摘要。
- 项目详情已支持跨环境对比基础对象数量，并提醒未绑定到环境的 ManagedResource、ResourceInstance、Site、CDN 和 SecretKey。
- 项目详情已支持环境工作台顶部入口和缺口标签携带 `projectId/environmentId` 跳转到资源管控、应用服务和站点创建页；资源管控、应用服务和站点页已消费这些上下文参数；环境工作台也会直接展示服务器执行边界并提供确认绑定/解绑入口。
- 项目详情已支持跨环境配置差异只读视图：以 prod/production 或最后一个环境作为参考，展示服务集合、部署配置覆盖、运行绑定、站点/TLS、资源类型、密钥类型和成功部署差异。
- 已新增 `GET /project-environments/sync-suggestions`：在项目环境读权限过滤后的可见环境内选择参考环境，返回服务器角色、服务、部署配置、运行绑定、资源类型、站点运行时、CDN、密钥和成功部署记录的差异与建议动作；项目详情页已展示这些建议并跳转到应用服务、资源管控、站点、密钥或 CDN 配置入口。
- 已新增 `POST /project-environments/sync-suggestions/apply`：支持 dry-run 生成同步计划，非 dry-run 需要目标环境名称或 key 确认，并且只会创建缺失的应用服务骨架或补齐目标环境缺失的非敏感 deployConfig 字段；环境变量、secretKeyIds、服务器、站点、托管资源、CDN、密钥绑定不会自动复制，结果会写入统一审计。
- 已新增 `POST /project-environments/sites/copy`：支持从源环境向目标环境 dry-run/apply 复制 Site 配置骨架；项目详情环境工作台已提供前端确认入口，可选择源环境、逐项填写目标域名、提示目标环境重复域名、预览计划并确认创建 draft Site；非 dry-run 需要目标环境名称或 key 确认，并要求每个站点显式提供目标域名；只创建 draft Site，不复制服务器绑定、旧代理绑定、Nginx 同步状态、证书观测资产、续期状态或真实 TLS 证书内容，结果会写入统一审计；已创建的 draft Site 可从复制结果直接跳转到 `/sites?siteId=...` 聚焦接管，绑定目标服务器、TLS 类型、证书名和已观测证书资产，并可一键生成 Nginx/OpenResty 同步 dry-run 计划和 TLS 探测 dry-run 计划。
- 已新增 `POST /project-environments/cdn-configs/copy`：支持从源环境向目标环境 dry-run/apply 复制 CDN 配置骨架；项目详情环境工作台已提供前端确认入口，可选择源环境、逐项填写目标域名/目标源站、选择兼容 CDN 凭据、提示目标环境重复域名、预览计划并确认创建 pending CDNConfig；非 dry-run 需要目标环境名称或 key 确认；不复制 providerData、syncError，不读取凭据值，也不调用云 provider API，结果会写入统一审计。
- 已新增 `POST /project-environments/resources/copy`：支持从源环境向目标环境 dry-run/apply 复制 ManagedResource 和 SecretKey 配置骨架；项目详情环境工作台已提供前端确认入口，可选择源环境、逐项填写目标 externalId/endpoint/server/credential、目标密钥名/新值/描述、提示目标重复资源或同名密钥、预览计划并确认创建资源/密钥骨架；复制结果中的已创建 ManagedResource 可直接跳转到资源管控详情，也可一键调用 dry-run 连接探测计划；资源管控页支持 `resourceId` 深链并自动打开资源详情抽屉；非 dry-run 需要目标环境名称或 key 确认；ManagedResource 必须显式提供目标 externalId，可选绑定目标 server/credential 且会校验归属，apply 只创建 `unknown` 资源索引，不复制 metadata、config、syncError、lastSyncAt 或 resourceInstanceId；SecretKey 必须显式提供新的目标 value，API 只加密该新值，不读取源密钥值，审计 metadata 不记录 secret value。
- 已新增 `POST /project-environments/resources/bulk-bind`：支持 dry-run 预览和确认后把项目下未绑定环境的 Site、ManagedResource、ResourceInstance、CDNConfig 和 SecretKey 归属到目标环境；项目详情可按类型和单项选择绑定范围，API 也支持 `resourceTypes/resourceIds` 精确限定；仅更新 environmentId，不复制实际资源、Provider 配置或 SecretKey value，并写入统一审计。
- 下一步做更细的项目/环境级 RBAC、Site copy 后续的 OpenResty 深度接管，以及资源 copy 后的同步/指标/告警接管入口。

### P2. Webhook 与部署运行

- ProjectWebhook 已支持目标环境、dry-run/queue/live_request/preview 触发策略、最大尝试次数、provider/payload 幂等键、generic/custom secret timestamp 重放防护和 secret rotation；`live_request` 只创建 live 部署审批申请，不绕过 OperationApproval；`preview` 会创建/复用 PR/MR 预览环境骨架并只创建 dry-run queued PR Preview 运行，关闭/合并事件只归档预览环境，不触发 live 临时资源；下一步补 provider 级签名时间窗、密钥版本保留、统一加密密钥治理、真实 preview 环境资源、临时 Site/域名、PR 关闭真实资源销毁和 live webhook 策略审计。
- DeploymentRun 已支持 dry-run/queued 部署、失败 run 的 dry-run/queued 重试、失败 live deploy 的受审批 Live 重试、基于成功 run 的 dry-run/queued 回滚、失败 live deploy 回滚申请、完成 run 的 dry-run/queued/live Smoke 检查、部署 Smoke 失败告警、失败 live Smoke 到上一成功 live deploy 的受控回滚计划/申请、显式开启后的失败 live Smoke 自动回滚计划/审批申请、携带已批准 approvalId 和确认文本的预授权 live 自动回滚提交、显式开启后的 live rollback 完成自动 dry-run/queued Smoke，以及非 dry-run 部署/回滚的 OperationApproval 审批门禁；下一步扩展到部署观测和真实部署日志。
- 支持 Git push 触发 ServerExecutor dry-run 队列；部署队列、并发控制、部署 Smoke、部署 Smoke 失败告警、失败重试、手动回滚、失败 deploy 回滚申请、失败 Smoke 受控回滚申请、默认关闭的失败 Smoke 自动回滚 scheduler、预授权 live 自动回滚提交和默认关闭的 post-rollback Smoke scheduler 已具备第一版，后续补 live transport 审批执行和更完整部署日志。
- 支持 deploy/pull/restart/health check 的脚本模板。
- 支持部署日志；失败重试已具备第一版，后续继续补重试策略、失败分类和真实部署日志归档。

### P3. 站点管控

状态：Site 最小闭环、Nginx/OpenResty live sync 边界、诊断运行、OpenResty/Nginx 运行态状态探测、模块盘点、固定模块基线检查、低风险 smoke 检查、Smoke 失败告警、配置 diff、审批门禁、同步历史和配置快照回滚已完成，完整生命周期治理待补。

- 已新增 `Site` 模型和 `/sites` API。
- 已新增站点管控页面，支持创建站点，并通过 `server-executor` 生成 Nginx dry-run 同步计划或执行 live sync。
- 已支持 `dryRun=false` 的站点同步写入 Nginx 配置、可选 certbot、`nginx -t` 和 reload；执行结果会更新 `Site.status/lastSyncAt/syncError` 并写入统一审计事件。
- 已新增 `SiteSyncRun`，每次 dry-run、live sync、queued sync 和 rollback 都会保存 Nginx 配置快照、执行计划、结果、日志、错误、目标配置路径、审计和 `ServerExecutionJob` 关联。
- 已支持在站点页查看最近同步记录，并基于成功 live run 发起回滚；回滚会写回历史 Nginx 配置、`nginx -t`、reload，并生成新的 rollback run。
- 已支持站点同步/回滚配置 diff；非 dry-run 的站点 sync/rollback 会先生成 blocked run 和 OperationApproval，批准后可在操作审批页执行并消费审批单。
- 已支持站点 Nginx/OpenResty 诊断运行：站点页可发起 `nginx -t`、access.log/error.log tail，也可加入 Server executor 队列，运行结果沉淀到 `SiteSyncRun`、`ServerExecutionJob` 和审计事件。
- 已支持站点 OpenResty/Nginx 运行态状态探测：站点页和聚焦接管面板可通过 `POST /sites/:id/openresty-status` 读取配置测试结果、Nginx/OpenResty 构建信息、systemd 活跃状态和进程摘要；命令策略只允许 `site.openresty_status` 下的固定只读命令，结果复用 `SiteSyncRun`、`ServerExecutionJob` 和审计事件。
- 已支持站点 OpenResty/Nginx 模块盘点：站点页和聚焦接管面板可通过 `POST /sites/:id/openresty-modules` 读取 Nginx/OpenResty 编译参数和固定目录下的动态模块 `.so` 文件列表；命令策略只允许 `site.openresty_modules` 下的固定只读命令，结果复用 `SiteSyncRun`、`ServerExecutionJob` 和审计事件。
- 已支持站点 OpenResty/Nginx 固定模块基线检查：站点页和聚焦接管面板可通过 `POST /sites/:id/openresty-module-baseline` 检查 TLS、HTTP/2 或 HTTP/3、realip、stub_status、stream 和 Lua/OpenResty 能力，命令只输出 `present/missing`，结果复用 `SiteSyncRun`、`ServerExecutionJob` 和审计事件。
- 已支持站点低风险 Smoke 检查：站点页和聚焦接管面板可通过 `POST /sites/:id/smoke-check` 生成或执行 public domain curl、本机 Nginx Host 路由 curl 和 upstream curl 计划；命令策略只允许 `site.smoke_check` 下的窄格式 curl，结果复用 `SiteSyncRun`、`ServerExecutionJob` 和审计事件；监控页可创建 `metric=site_smoke_check_failure` 规则，按最近 N 次非 dry-run Smoke 检查失败次数生成标准 `AlertEvent` 并进入静默、通知、审计和升级链路。
- 已在项目详情中展示关联 Site，旧 `ProxyConfig` 作为兼容数据保留。
- 下一步把 ProxyConfig 收敛为 Site 的路由能力或做迁移兼容。
- 下一步支持 OpenResty 模块基线策略化、基线失败告警、性能调优、日志归档自动化和队列/并发治理。
- 已支持站点证书探测、受控续期、默认关闭续期调度和过期告警第一版：站点页可通过 Server executor 执行或排队执行 OpenSSL TLS probe，完成后把证书到期时间、签发方、序列号、指纹、探测时间和剩余天数写回 `Site.tls`，并按指纹/序列号沉淀到 `Site.tls.assets` 证书资产快照，记录 firstSeenAt、lastSeenAt、observationCount 和 active 状态；也已新增默认关闭的 `SITE_TLS_PROBE_SCHEDULER_ENABLED` 定时探测器，会按批次和最小间隔提交队列任务，跳过非 TLS 或近期已探测站点；Let’s Encrypt 站点可发起 certbot 续期演练或审批门禁后的续期运行，命令策略只允许固定 `certbot renew --cert-name ...` 格式；续期执行完成后会解析 certbot 输出，把 `succeeded/not_due/failed/unknown`、演练/正式、运行记录和摘要写回 `Site.tls.renewal`，并在站点卡片展示最近续期状态；正式续期成功后会自动创建一条关联原续期 run 的 `tls_probe` 队列任务，后续探测完成后刷新实际 served certificate 元数据；`SITE_TLS_RENEW_SCHEDULER_ENABLED=false` 默认关闭，启用后只对有到期元数据且进入续期窗口的 Let’s Encrypt 站点提交队列任务，默认 `SITE_TLS_RENEW_SCHEDULER_DRY_RUN=true` 只做续期演练；`AlertRule category=site` / `metric=certificate_expiry` 可以读取这些字段并按阈值天数生成证书过期告警，`metric=tls_renewal_failure` 可以对续期失败或续期后探测失败生成告警，`metric=certificate_asset_change` 可以对最近窗口内的证书资产变化生成标准 `AlertEvent`、静默和通知投递。
- 下一步支持证书库、上传、绑定、私钥敏感存储和更细粒度证书策略告警。

### P4. 应用与服务工作区

状态：Application/Service 与服务运行态操作最小闭环已完成，服务操作已接入 Server executor 队列桥，可观测性、环境变量和 Secret 注入待补。

- 已新增 `Application` / `ApplicationService` 模型和 `/applications` API。
- 已支持服务绑定项目环境、服务器、站点、托管资源和 deployConfig。
- 已支持 `DeploymentRun` 绑定 Application/Service，并使用服务 deployConfig 生成部署计划。
- 已新增应用服务页面，支持创建应用、添加服务、生成服务 dry-run 部署计划。
- 已在项目详情展示应用服务概览。
- 已支持服务状态、日志、重启、回滚的 Server executor dry-run 操作计划，并持久化 `ApplicationServiceOperationRun`。
- 已支持 `ApplicationServiceOperationRun` 关联 `ServerExecutionJob`，服务操作可直接入队，worker 完成后回写业务运行结果。
- 应用服务页面已展示服务操作入口、队列开关、最近运行结果和关联 Job。
- 下一步接入真实日志流、监控指标、环境变量和 Secret 注入。

### P5. 数据库和备份

状态：生成项目数据库引擎选择、云凭据管理、DB/Redis 只读账号绑定、资源绑定、连接探测、只读查询计划、结果预览契约、DB/Redis live readonly 查询 adapter、服务器资源动作队列桥、备份计划 dry-run 和服务器备份队列桥最小闭环已完成，数据库资源交付联动、Postgres 查询/备份、云 SDK 查询、真实备份和恢复待补。

- 已支持生成项目选择 MySQL/PostgreSQL/SQLite：MySQL 为默认引擎，PostgreSQL 继续兼容，SQLite 使用本地 `file:./dev.db`，并且不会生成数据库容器服务。
- 已在 ResourceControl capabilities 中暴露云凭据 profile，当前覆盖 `cloud_aliyun` 与 `cloud_tencent`。
- 已在 ResourceControl capabilities 中暴露 DB/Redis 只读账号 profile，当前覆盖 `db_mysql_readonly` 与 `db_redis_readonly`。
- 已在资源管控页支持创建和脱敏展示云 TeamCredential、DB/Redis readonly TeamCredential，并可删除未被硬依赖阻断的凭据。
- 已新增 `PUT /resource-control/resources/:id/binding`，支持更新资源项目环境、服务器和 TeamCredential 绑定，并写入 `resource_binding` 审计事件。
- 已支持通过 `ManagedResource.config.credentialBindings.queryCredentialId` 单独绑定查询凭据，避免 Provider 凭据、Server SSH 和 DB/Redis 只读账号混用。
- 已支持 Docker 容器 inspect/logs、Docker MySQL ping 和 Docker Redis info 在 `SERVER_EXECUTOR_LIVE_ENABLED=true` 且服务器为 SSH key auth 时通过 Server executor live 执行；Docker restart 保持审批和确认保护。
- 已支持服务器 Docker 清单通过 Server executor 执行受控只读 `docker ps` inventory：同步运行会解析 Docker JSON lines，生成 Docker 容器、Docker MySQL 和 Docker Redis 资源；当 live transport 未启用或被阻止时，只使用明确标注的 `inventory_stub_fallback` 兜底。
- 已新增默认关闭的资源管控调度器：`RESOURCE_CONTROL_SCHEDULER_ENABLED=true` 时可按配置周期标记 stale 资源，并按服务器批量触发 scheduled Docker sync；`RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED=true` 时可对服务器 Docker 容器资源按批次和最小采集间隔提交 `docker.container.stats` 队列任务；调度会继承服务器的活跃环境绑定，单台服务器或单个指标任务失败不会拖垮整轮。
- 已支持服务器资源动作加入 Server executor 队列：`ResourceActionRun` 关联 `ServerExecutionJob`，worker 完成后回写执行结果；审批页执行已批准资源动作时会保留 queue 选择。
- 已支持 Docker 容器指标快照动作：`docker.container.stats` 通过 Server executor 生成或执行 `docker stats --no-stream --format '{{json .}}'`，命令策略只允许这一种窄格式，资源管控页复用现有 dry-run/live/queue 控制；completed 非 dry-run 的 direct/queued 结果会解析 stdout/logs 并写入 `ResourceMetricSnapshot`，资源管控页可展示最新 CPU/内存、最近指标历史、短窗口 CPU/内存/PID 趋势摘要，并在资源详情抽屉中按 CPU、内存、网络、块 IO、PIDs 切换查看时间序列曲线。
- 已支持云资源同步和资源绑定按 provider 优先选择兼容 TeamCredential，生成的 RDS/SLS/COS 清单会携带凭据绑定；云 inventory adapter 已能把阿里云 RDS、阿里云 SLS 和腾讯 COS 的 SDK 响应形状映射为 `ManagedResource`。在 `RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED=true` 且绑定兼容凭据时，阿里云 RDS 通过 `@alicloud/pop-core` 读取实例，阿里云 SLS 通过 `@alicloud/sls20201230` 读取 project/logstore，腾讯 COS 通过 `cos-nodejs-sdk-v5` 真实列桶；provider 调用已支持超时、重试/退避、requestPolicy metadata 和阿里云 `inventoryRegions` 跨区域读取，失败时会明确记录 provider fallback 原因。资源管控页的最近同步记录已展示每个 provider 的 live/fallback、解析/跳过数量、regions、SDK、timeout/retry policy、fallback 原因和 provider 错误，并新增云 Provider 健康摘要，把最近可见云同步按 provider 聚合为 healthy/degraded/error、live/fallback、quota、rate limit、timeout 和 provider failure 计数；监控告警已新增 `cloud_provider_sync_failure` 规则，可以按全部项目/单项目和 provider 过滤最近云同步记录，重复 live provider 失败会生成正常 `AlertEvent`，配置 fallback 默认只作为诊断保留，并可通过通用 Webhook、飞书、钉钉或企业微信机器人通道生成默认 dry-run 的告警通知投递记录。真实凭据 e2e 和真实 provider quota API 仍待补。
- 已新增 `ResourceConnectionRun` 模型和 `/resource-control/connection-runs`、`/resource-control/resources/:id/connection-probe` API。
- 已支持 Docker 容器、Docker MySQL、Docker Redis 通过 Server executor 生成连接探测计划。
- 已支持阿里云 RDS、阿里云 SLS、腾讯云 COS 生成 cloud provider SDK 授权/连接探测计划。
- 已在资源管控页新增连接探测入口和最近连接探测记录，展示 Credential/Auth adapter、Executor adapter、状态和错误。
- 已新增 `ResourceQueryRun` 模型和 `/resource-control/query-runs`、`/resource-control/resources/:id/query-runs` API。
- 已支持 MySQL/RDS 只读 SQL 计划、Redis 只读浏览计划、SLS 查询计划和 COS 对象列表计划。
- 已在 `ResourceQueryRun.result` 和 `queryPlan` 中固定 preview/pageInfo/redaction/livePrerequisites/resultContract 结构，真实 adapter 后续复用同一结果契约。
- 已支持 ResourceQueryRun 优先解析 DB/Redis 查询凭据为 `direct_db` transport，livePrerequisites 可以区分 readonly credential ready/missing。
- 已支持 MySQL/RDS 与 Redis 在 `dryRun=false` 且 `params.confirmLiveRead=true` 时通过 `direct-db-adapter` 执行真实只读查询；凭据材料只在 driver 边界内解密使用，写入 ResourceQueryRun 的结果已按 secret-like 字段脱敏。
- 已在资源管控页新增可配置只读查询面板和最近只读查询记录，展示 queryType、query、Credential/Auth adapter、Executor adapter、adapterState、结果预览、状态和错误。
- 已在资源管控页新增资源详情抽屉，可查看资源身份、项目/环境/服务器/凭据绑定、脱敏配置/元数据，并聚合该资源最近的动作、连接探测和只读查询历史。
- 已在资源管控页为 DB/Redis 增加真实只读查询入口；未绑定查询凭据时阻止 live 执行，执行前需要用户确认。
- 已新增 `BackupPlan` / `BackupRun` 模型和 `/backups` API。
- 已支持 Docker MySQL、Docker Redis 和阿里云 RDS 创建备份计划。
- 已支持手动触发 dry-run，生成 Server executor `backup-script-plan` 或云 SDK 快照计划。
- 已支持服务器侧 BackupRun 关联 `ServerExecutionJob`，备份页可选择把 Docker MySQL/Redis dry-run 备份计划加入队列，worker 完成后回写运行结果和备份计划 lastStatus。
- 已新增备份计划页面，支持创建计划、暂停/启用、生成计划、服务器备份入队和查看最近运行。
- 已将备份运行写入 `AuditEvent`，并把 MySQL/Redis 备份命令接入 Server executor 命令策略。
- 下一步接入 live Aliyun/Tencent provider SDK 调用、Postgres、账号管理、查询权限策略和更完整的结果表格能力。
- 下一步接入真实备份执行、恢复记录、恢复演练和备份失败告警。
- 下一步支持 S3/COS/OSS/R2 等备份目的地和凭证治理。

### P6. 监控告警

状态：告警规则、告警事件、默认关闭定时评估、静默窗口、事件去重抑制，以及通用 Webhook、飞书、钉钉、企业微信机器人通知、邮件通知、手动投递重试、默认关闭自动重试、默认关闭严重告警升级、服务 SLO 大盘、服务 SLO 违约告警、短/长窗口 burn-rate 策略、错误预算阈值策略、错误预算耗尽预测和 SLO 模板第一版已完成，并已覆盖云资源同步 provider 重复失败、日志错误数、资源指标阈值、服务 SLO 违约、服务错误预算和错误预算耗尽预测；Docker 指标已具备默认关闭的调度采集、趋势摘要、资源详情时间序列曲线、监控页指标大盘和阈值告警第一版；真实 SLO 周期/多周期错误预算策略待补。

- 已新增 `AlertRule` / `AlertEvent` 模型和 `/monitoring` API。
- 已支持服务、服务器、站点、资源、备份计划和项目部署状态告警规则。
- 已支持手动评估和默认关闭的定时评估规则，基于现有状态字段或最近运行记录生成告警事件。
- 已支持云资源同步 provider 失败规则：从 `ResourceSyncRun.metadata.providers[]` 评估 live provider fallback、同步失败、阈值窗口和 provider 过滤，配置 fallback 默认不触发但会保留在事件 value 中。
- 已支持资源指标阈值规则：从 `ResourceMetricSnapshot` 按资源、项目、环境和窗口读取 CPU、内存、内存用量、PIDs 等指标，支持 latest/average/max 聚合和阈值比较，并复用告警静默、通知、审计链路。
- 已新增监控告警页面，支持创建手动/定时规则、配置评估间隔、手动评估、查看事件和确认告警。
- 已将告警评估和确认写入 `AuditEvent`，统一进入审计事件页。
- 已新增 `AlertSilence`，支持按项目、分类、指标、级别和时间窗口静默告警；命中的事件会标记为 `suppressed`，仍可见并进入审计，但不会触发通知派发。
- 已新增 `AlertNotificationChannel` / `AlertNotificationDelivery`，支持项目级通用 Webhook、飞书、钉钉、企业微信机器人和邮件通知通道、投递记录、权限过滤和默认 dry-run planned delivery；只有 `ALERT_NOTIFICATION_WEBHOOKS_ENABLED=true` 时才会真实 POST，只有 `ALERT_NOTIFICATION_EMAIL_ENABLED=true` 且 SMTP host/from 配齐时才会真实发信；失败或 planned 投递可以在监控页手动重试，重试会创建新的投递记录并写入统一审计；失败投递还支持默认关闭的自动重试调度（`ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED=true`），会跳过 planned dry-run、已有更新尝试和超过近期尝试上限的记录；未确认的 firing/error 严重告警支持默认关闭升级调度（`ALERT_ESCALATION_SCHEDULER_ENABLED=true`），会向匹配通道生成 `devpilot.alert_event.escalation` 投递并写入 `alert.escalate` 审计。
- 已新增事件去重抑制第一版：重复的 `firing` / `error` / `suppressed` 评估会在规则配置窗口内复用最近同状态事件，跳过新事件和通知投递，同时更新规则状态并写入 `alert.evaluate.deduped` 审计；恢复事件不会被去重。
- 已新增服务 SLO 大盘第一版：按服务聚合窗口内非 dry-run 部署运行、非 dry-run 服务操作运行和服务告警事件，展示 SLO、错误预算剩余、burn rate、部署失败、操作失败和告警影响；读接口会先按项目/环境权限过滤服务行再汇总。
- 已新增服务 SLO 违约告警第一版：`AlertRule category=service` / `metric=service_slo_breach` 会复用服务 SLO 聚合信号，按目标 SLO、burn-rate 阈值、错误预算和 critical alert impact 生成标准 `AlertEvent`，并进入静默、通知和审计链路。
- 已新增短/长窗口 burn-rate 策略第一版：服务 SLO 规则兼容旧的单窗口条件，也可使用 `condition.windows[]` 和 `matchPolicy=all` 同时评估短窗口与长窗口，只有配置窗口同时违约才触发 paired burn-rate 告警。
- 已新增错误预算阈值策略第一版：`AlertRule category=service` / `metric=service_error_budget` 会从同一套服务 SLO 信号计算剩余错误预算，在低于配置阈值时生成标准 `AlertEvent`，并复用静默、通知和审计链路。
- 已新增错误预算耗尽预测第一版：`AlertRule category=service` / `metric=service_error_budget_exhaustion` 会按当前窗口 burn rate 预测剩余错误预算耗尽时间，低于配置阈值时生成标准 `AlertEvent`，并复用静默、通知和审计链路。
- 已新增服务 SLO 模板第一版：`GET /monitoring/service-slo/templates` 提供标准 API 可用性、高可靠短长窗口、错误预算保护线和错误预算耗尽预测预设，监控页可一键套用到服务 SLO、错误预算或耗尽预测规则创建表单。
- 下一步把资源指标大盘扩展为更多指标字段，并接入证书有效期采集。
- 下一步支持模板化通知内容。
- 下一步支持真实 SLO 周期/多周期错误预算策略、静默规则和抑制规则。

### P7. 日志中心

状态：日志流、日志条目、日志采集运行 dry-run、Server executor 队列桥、默认关闭的 Server executor 定时 follow、SLS GetLogs dry-run/live 查询、默认关闭的 SLS 按流回填调度、采集结果自动入库、可配置日志脱敏策略、近实时日志 tail、入库日志 SSE 流式 tail、cursor resume 自动重连、有界会话治理、活跃会话控制、单流/用户/团队基础限流、日志级别统计、日志错误告警第一版、手动保留清理和默认关闭的定时保留清理已完成；agent 级持续日志 follow 待补。

- 已新增 `LogStream` / `LogEntry` 模型和 `/logs` API。
- 已新增 `LogCollectionRun` 模型，支持记录采集运行、执行器、adapter、tail、命令计划、结果、错误和审计关联。
- 已支持服务、服务器、站点、资源、部署运行、备份计划/运行和告警事件作为日志归属目标。
- 已支持手动创建日志流、追加日志条目、按项目/环境/目标和关键字查询日志。
- 已支持对 Docker、Docker Compose、Nginx access/error log 和服务器 `/var/log/*.log` 生成 Server executor dry-run 采集计划。
- 已支持对 SLS 日志流生成 `cloud-sdk` / `aliyun-sls-query-plan` dry-run 查询计划，计划包含 project、logstore、query、时间窗口、limit、GetLogs planned call、结果契约和 live 前置条件；也已支持默认关闭的 `aliyun-sls-live-query` adapter，在 `LOG_CENTER_SLS_LIVE_QUERY_ENABLED=true`、绑定 `cloud_aliyun` TeamCredential 且显式确认后执行 SLS GetLogs live 只读查询。
- 已支持 SLS 按流回填调度第一版：`LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED=false` 默认关闭，启用后只处理 `metadata.slsBackfill.enabled=true` 的 active SLS 日志流，并按每条流配置的 query、window、limit 和 interval 生成 dry-run 或确认后的 live GetLogs 采集运行。
- 已支持日志采集运行加入 Server executor 队列：`LogCollectionRun` 关联 `ServerExecutionJob`，worker 完成后回写状态、命令计划、日志和结果。
- 已支持日志采集完成后的入库回写：非 dry-run 且 completed 的 `LogCollectionRun` 会解析 stdout/stderr 或 executor logs，识别时间戳和级别，脱敏 password/token/authorization 等敏感片段，并批量写入 `LogEntry`。
- 已支持默认关闭的 Server executor 日志 follow 调度第一版：`LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED=false` 默认关闭，启用后只处理 `metadata.serverFollow.enabled=true` 的 active Docker/Nginx/server 日志流，跳过近期已有采集运行，默认 dry-run；live 需要关闭全局 dry-run 且流配置 `live=true` / `confirmLiveRead=true`，并默认通过 Server executor 队列执行。
- 已支持可配置日志脱敏策略：基础 password/token/authorization 类字段始终脱敏，日志流可配置额外 key、邮箱和 IP 脱敏；采集入库和手动追加日志共用同一套策略。
- 已支持近实时日志 tail：`GET /logs/streams/:streamId/tail` 使用日志读权限和复合 cursor 返回新增日志，日志中心页面可以手动刷新或开启 3 秒自动刷新，不需要打开服务器 shell。
- 已支持入库日志 SSE 流式 tail 第一版：`GET /logs/streams/:streamId/events` 复用 `log.stream.tail` 读权限和同一套 cursor 语义，以 SSE 推送 ready/entries/heartbeat/error 事件；日志中心页面通过带鉴权 header 的 fetch stream 打开实时流、合并新入库日志并展示连接状态。
- 已支持日志 SSE 断线恢复第一版：事件流接受 `Last-Event-ID` 作为恢复 cursor，并在 SSE 帧中输出 `id`/`retry`；日志中心页面会保存最近 cursor，断线后按 1/2/5/10/30 秒退避重连，并同时携带 query cursor 和 `Last-Event-ID` 续接。
- 已支持日志 SSE 有界会话治理第一版：事件流会生成 sessionId、expiresAt 和 maxSessionMs，响应头和 SSE payload 都携带会话元数据；达到最大会话时长后服务端发送 `closing` 事件并关闭响应，由前端按 cursor resume 自动续接。
- 已支持日志 SSE 活跃会话控制第一版：后端以内存态 `LogStreamSessionRegistry` 跟踪当前进程的 open 会话，提供 `/logs/stream-sessions` 和 `/logs/stream-sessions/:sessionId/close`，列表复用 `log.stream.tail` 读权限，关闭操作走 `log.stream_session.close` 低风险写权限，手动关闭写入 `AuditEvent`，并通过 `LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM`、`LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR` 和 `LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM` 限制单流、用户和团队活跃连接数。
- 已支持按可读日志流统计最近窗口日志级别分布，`/logs/stats` 会先走日志流 read policy，再统计 `LogEntry`。
- 已支持日志错误告警第一版：`AlertRule category=log` / `metric=log_error_count` 可以按最近窗口、级别集合、阈值和可选 streamId 评估，并生成标准 `AlertEvent`、审计和通知投递。
- 已支持日志保留清理第一版：`LogRetentionRun` 记录按日志流 retentionDays 计算的 cutoff、匹配条数、删除条数、dry-run/live、状态和错误；live 清理会刷新日志流最后一条元数据，并写入审计。
- 已支持日志保留定时清理第一版：`LogRetentionSchedulerService` 默认关闭，通过 `LOG_RETENTION_SCHEDULER_ENABLED=true` 启用；默认 dry-run，可用 `LOG_RETENTION_SCHEDULER_DRY_RUN=false` 显式启用 live 清理，并通过 batch size 控制单次处理量。
- 已新增日志中心页面，支持创建日志流、配置 sourceKey、追加日志、搜索条目、生成采集计划、为 SLS 传入 query/window/limit 并选择 dry-run 或确认 live 读取、保存 SLS 定时回填 query/window/limit/interval/live 配置、保存 Docker/Nginx/server 定时 follow enable/live/queue/tail/interval 配置、配置每条日志流的扩展脱敏策略、手动/自动/SSE 实时流 tail、断线自动重连、会话 id/到期时间展示、活跃会话刷新和主动关闭、计划入队、查看最近采集运行，展示采集入库状态、条数和错误，显示最近窗口日志级别分布，并可执行日志保留 dry-run/live 清理。
- 已将日志追加、采集计划和活跃日志会话关闭写入 `AuditEvent`，统一进入审计事件页。
- 下一步接入远端命令/agent 级持续日志 follow、跨实例会话持久化和更细的租户级限流策略。
- 下一步支持更细的日志告警模板和 SLS 真实凭据 smoke。

### P8. 安全和运维治理

- 状态：统一审计事件、高风险操作审批、部署 live 审批门禁、失败 live deploy 回滚申请、失败 Smoke 自动回滚计划/审批申请、预授权 live 自动回滚提交、Server executor 命令策略、团队/项目/环境级策略模板、live lease 并发门禁、执行治理可视化、execution job 重试入口、queued worker 基座、Server executor supervisor 状态面、默认关闭的 Server agent HTTP dispatcher 边界、Server agent dispatcher correlation/idempotency 契约、Server agent dispatch outcome 审计事件、Server agent heartbeat runtime 摘要、Server agent heartbeat-required target selection 门禁、Server agent dispatcher config 摘要、Server agent readiness 摘要、Server agent job demand 摘要、Server agent blocked reason 摘要、执行治理页 agent dispatch result/correlation 可见性、DeploymentRun/SiteSyncRun/ResourceActionRun/ApplicationServiceOperationRun/BackupRun/LogCollectionRun 队列桥、基础锁租约恢复、同进程 cancel signal、跨进程持久取消轮询、SSH live 远端进程树 best-effort cleanup、remoteExecution metadata、默认关闭的 stale orphan cleanup、执行治理页 remoteExecution 可见性、执行治理页 agent target 可见性、审批链路控制面访问策略，项目/环境/站点写接口策略门禁，资源/应用/备份/日志/监控主要写接口策略门禁，服务器/CDN/密钥/资源申请/资源实例/资源池分配/旧资源凭证写接口策略门禁，Generator/Preset/Git/Domain/Legacy CDN 早期项目交付入口策略门禁、主要读路径可见性过滤，以及第一组授权回归测试最小闭环已完成；完整 server agent supervisor、更多集成/e2e 授权覆盖和真实日志写入待补。
- 执行治理动作审计已补齐：取消请求/取消、queued retry、inline retry、管理员手动处理下一个 queued job 和 stale recovery 都会写入统一 `AuditEvent`，审计目标使用 `server_execution_job`，并在 metadata 中保留 retry、source scope 和 remote cleanup 证据。
- 已新增 `AuditEvent` 模型和 `/audit-events` 查询 API。
- 已在部署运行、资源动作、服务运行态操作和备份运行完成后写入审计事件。
- 已新增审计事件页面，支持分类、状态和风险过滤。
- 已新增 `OperationApproval` 模型和 `/operation-approvals` 查询/审批 API。
- 已在非 dry-run 的中高风险资源动作、服务操作、站点同步/回滚和部署/回滚前加入审批门禁。
- 已新增操作审批页面，支持批准、拒绝和执行已批准动作，包括 `site.sync` / `site.rollback` / `deployment.run` / `deployment.rollback`。
- 已新增 `ControlAccessPolicy` 和 `/control-access-policies` API，支持按团队角色或用户配置 allow/deny 策略，并限定项目、环境、操作分类、action 和 risk；访问策略页可管理这些策略。
- 已将控制面访问策略接入 OperationApproval 创建、审批和已批准执行校验：owner 默认绕过，deny 优先，未命中策略时沿用当前团队角色默认行为；无用户上下文的 webhook live 申请仍作为系统触发进入审批链路。
- 已将控制面访问策略接入第一批普通写接口：Project create/update/delete、ProjectEnvironment create/update/archive/server bind/server unbind/sync-from-project、Site create/update/delete。默认仍要求 admin，命中 allow 策略的 member 可以执行，deny 策略优先拒绝。
- 已将控制面访问策略接入第二批普通写接口：ResourceControl 资源动作、资源绑定、连接探测、只读查询、服务器 Docker 同步、云资源同步；Application/Service 创建、更新、归档和服务操作；BackupPlan 创建/更新/运行；LogStream 创建/更新、日志采集和追加；AlertRule 创建/更新/评估和 AlertEvent 确认。默认仍要求 admin，命中 allow 策略的 member 可以执行，deny 策略优先拒绝。
- 已将控制面访问策略接入第三批历史写接口：Server 创建/更新/删除/连接测试/服务检测；CDNConfig 创建/更新/删除/缓存清理；TeamCredential 创建/删除；SecretKey 创建/更新/删除/项目批量生成；旧 Resource 凭证创建/更新/删除；ResourceRequest 创建/审批/交付/取消；ResourceInstance 释放；ResourcePool 团队侧分配/释放。平台级 ResourceType 和 ResourcePool 管理仍保留全局 admin 权限。
- 已将控制面访问策略接入早期项目交付入口：Project generate/preview、Preset create/update/delete/import、Git connect/delete/create repo/push、旧 Domain Nginx/Certbot 配置生成和旧 CDN artifact 生成。`/projects/preview` 现在也要求 JWT 与团队上下文；这些入口默认保留 team member self-service，但可被项目/环境/分类/action/risk 策略显式 allow/deny。
- 已新增控制面读策略第一批：`control_read` 默认 team member 可读但可被 deny 策略过滤，`sensitive_read` 默认 admin 才能读取明文材料；SecretKey 列表按 read 策略过滤，SecretKey 明文读取和项目 `.env` 导出按 sensitive_read 策略逐项过滤，ResourceRequest/ResourceInstance 列表和详情按 read 策略过滤。
- 已新增 `ServerCommandPolicyService`，在 Server executor adapter 前统一校验命令白名单和危险命令。
- 已新增 `ServerCommandPolicyTemplate` 和执行策略页面，支持团队/项目/环境级模板按 adapter、operation 限定作用域，扩展 allow/block pattern，并在执行结果中保留 policyKey/template 证据。
- 已新增 `ServerExecutionLease`，非 dry-run 的同服务器 live 执行会先持有 active lease，冲突执行返回 blocked 并记录阻塞原因。
- 已新增执行治理页面和 `/server-execution-leases` API，支持查看 lease 状态、服务器、操作、执行器、申请人和过期时间，并支持管理员释放过期 lease。
- 已新增 `ServerExecutionJob` 和 `/server-execution-jobs` API，支持查看执行任务、输入快照、状态、错误、重试链路和 remoteExecution 摘要，并支持管理员取消 queued/blocked/running 任务、把 failed/blocked/cancelled 任务加入 retry queue、手动处理下一个 queued job；这些治理动作以及 stale recovery 会写入统一 `AuditEvent`。
- 已新增 Server executor queue worker 基座，支持 opt-in 定时领取 queued job、同进程 cancellation token、基于 `ServerExecutionJob.cancelRequestedAt` 的跨进程持久取消轮询、SSH live 子进程 SIGTERM、SSH live 远端进程树 best-effort cleanup、remoteExecution metadata 持久化、默认关闭的 stale orphan cleanup 和 failed/blocked queued job 按 maxAttempts 自动 retry 入队。
- 已新增 `GET /server-execution-jobs/supervisor` 和执行治理页 Supervisor 区块，聚合当前进程 worker 配置、队列积压、stale running job、live lease 和 worker owner 摘要。
- 已新增默认关闭的 `ServerAgentServerExecutorAdapter`：`server_agent` transport 可进入 Server executor adapter 体系，dry-run 生成 dispatch envelope，live 默认 blocked；显式开启 `SERVER_EXECUTOR_AGENT_ENABLED=true` 并配置 `SERVER_EXECUTOR_AGENT_DISPATCHER_URL` 后，可向 HTTP dispatcher POST envelope 并接受 completed/failed/blocked/cancelled 终态响应；envelope、result、command plan 和 HTTP headers 已带有 job correlation 与 idempotency key。
- Server agent dispatch outcome 已写入统一 `AuditEvent`：adapter 返回后会生成 `server_execution_job.agent_dispatch` 事件，metadata 只保留 correlation、dispatcher 配置态、终态、boundary 和 whitelisted response 摘要，审计写入失败不改变原执行结果。
- 已新增默认关闭的 Server agent target 选择：`ServerExecutorService.resolveTarget()` 可在显式开启且服务器存在 agent capability 证据时返回 `server_agent` target，否则保持 SSH；显式开启 `SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED=true` 后还要求 heartbeat runtime online，缺失/stale/unknown 时回落 SSH。
- 执行治理任务列表已展示 execution target 路径：所有 job 可查看 `transport`，`server_agent` job 可查看 agentRef 的 displayName、capabilityKey、source 和 status；agent dispatcher result 也会展示已投递/投递失败/live 阻塞、dispatcher 配置态、脱敏 dispatcher、终态响应 status/run id、dispatch id、job/lease id、retry attempt、idempotency key 和 `server_agent_dispatcher` boundary。
- 执行治理 Supervisor 已展示 Server agent dispatcher config：只读展示 executor/dispatcher/token/timeout 和脱敏 dispatcher URL。
- 执行治理 Supervisor 已展示 Server agent readiness 和 heartbeat runtime：只读聚合团队服务器上的 agent capability，展示 target selection 开关、capable/online/source/status、heartbeat enabled/token、heartbeat-required 门禁、online/stale/unknown 和 sample servers。
- 执行治理 Supervisor 已展示 Server agent job demand：只读聚合 `transport=server_agent` 的 ready/scheduled/running/stale/blocked/failed/cancelled 和下一条 ready agent job。
- 执行治理 Supervisor 已展示 Server agent blocked reason：只读扫描最近 blocked `server_agent` job，展示 reason 分布、dispatcher boundary 数和样例任务。
- 已新增 `ServerExecutorService.queueExecution()`、DeploymentRun 队列桥、SiteSyncRun 队列桥、ResourceActionRun 队列桥、ApplicationServiceOperationRun 队列桥、BackupRun 队列桥和 LogCollectionRun 队列桥，部署运行、站点同步/回滚、服务器资源动作、服务运行态操作、服务器备份 dry-run 与服务器日志采集 dry-run 可直接创建 queued job、保存 `serverExecutionJobId`，并在 worker 完成后回写业务运行结果；LogCollectionRun completed 后会触发采集结果入库。
- 已新增 Server executor lock lease/heartbeat/stale recovery，支持 lockExpiresAt 续租、恢复过期 running job、记录 recoveryReason/recoveryCount，在显式开启 `SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED=true` 时基于 `remoteExecution.session` 尝试清理远端 orphan，并在恢复后按 maxAttempts 自动 queue retry。
- 下一步把控制面只读数据可见性过滤继续扩展到资源管控、日志、监控、执行历史、审计、站点、CDN、服务器和旧资源凭证等读路径。
- 下一步补完整 Server agent supervisor、更完整的跨实例远端 orphan 治理和多实例队列治理。
- 资源危险操作二次确认。

## 8. 推荐下一步

下一步建议优先做真实执行治理、P3 的真实站点同步，以及可观测性：

1. 继续补安全治理：扩展真实 DB fixture/e2e 权限覆盖、资源实例级策略、agent supervisor、跨实例远端 orphan 治理和多实例队列治理。
2. 继续完善 Nginx/OpenResty adapter：模块基线策略化与失败告警、性能调优、真实环境 smoke，并把 ProxyConfig 收敛到 Site。
3. 补服务可观测性：实时日志流/SLS 查询、容器指标、健康趋势、通知渠道、SLO、环境变量和 Secret 注入。
4. 在环境工作台基础上继续补 Site copy 创建 draft 后的 OpenResty 深度接管，并把资源 copy 后的同步、指标、告警接管入口做深。

这样 Devpilot 会从“能登记资源”变成“项目代码变更后能触发部署并落到服务器资源”，产品主线会明显更完整。
