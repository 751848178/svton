# 5. 竞品差距

> 稳定参考文档,只在需要对标某竞品时按需读。

### 5.1 1Panel

1Panel 更像完整 VPS 控制面板,覆盖网站、SSL、运行时、数据库、容器、文件、监控、防火墙、进程、SSH、终端、计划任务、WAF、日志审计、备份恢复。官方 Overview 也把网站部署、应用市场、集中服务器管理、安全、备份恢复列为核心能力。Source: https://1panel.pro/docs/v2/

Devpilot 缺口:

- 缺完整站点模型,不只是 proxy。
- 缺服务器系统管理:文件、进程、防火墙、SSH、终端、计划任务。
- 缺 OpenResty/Nginx 生命周期管理:配置测试、reload、日志、模块。
- 缺备份恢复和安全审计闭环。
- 缺应用市场/模板化安装能力。

### 5.2 Coolify

Coolify 重点是自托管 PaaS:Git 集成、自动部署、PR 预览、Docker Compose、环境变量、数据库、一键资源、域名和代理。数据库页还把 public port 解释为通过 Nginx TCP proxy 暴露数据库。Source: https://coolify.io/docs/databases

Devpilot 缺口:

- Git 到部署主线已具备 dry-run/queued/rollback/Smoke/PR Preview 骨架;仍缺真实临时预览基础设施、真实临时域名/TLS/Nginx live 同步、真实资源销毁和真实部署日志。
- 缺环境变量/secret 与 compose 文件的联动检测。
- 缺数据库作为一等部署资源的创建、连接、备份、日志、监控。
- 缺部署日志和部署历史。

### 5.3 Portainer

Portainer 的强项是多环境容器管理:Docker、Swarm、Kubernetes、Podman、Azure ACI。它支持从 Web editor、上传、Git repository、模板创建 stack,也支持 stack webhook 和 GitOps 更新。Portainer Agent 用容器方式连接 Portainer Server 并访问节点资源。Source: https://docs.portainer.io/user/docker/stacks/add and https://docs.portainer.io/admin/environments/add/swarm/agent

Devpilot 缺口:

- 缺环境/服务器注册模型与连接健康。
- 缺 stack/compose 作为一等对象。
- 缺 GitOps drift 检测和 commit hash 记录。
- 缺多节点、多集群、多 provider 的统一环境视图。
- 当前 executor 还缺完整"环境能力矩阵":Docker、Compose、K8s、云厂商各支持哪些动作,以及每个动作是否支持 dry-run/live/rollback。

### 5.4 Dokploy

Dokploy 把应用作为 workspace,应用内有 General、Environment、Monitoring、Logs、Deployments、Domains、Advanced Settings。它还支持数据库管理、监控、日志、自动备份到 S3 destinations。Source: https://docs.dokploy.com/docs/core/applications and https://docs.dokploy.com/docs/core/databases

Devpilot 缺口:

- 缺项目内的应用/服务工作区。
- 缺监控图、实时日志、部署队列、取消部署。
- 缺数据库备份/恢复。
- 缺 external build server 概念,无法把构建和生产部署隔离。
- 缺 domain、deployment、resource 的统一应用页。
