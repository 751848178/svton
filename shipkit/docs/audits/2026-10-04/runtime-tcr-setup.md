# 运行端安装与 TCR 个人版接入记录

> 阶段说明：本文保留下方安装/保留密码阶段的当时记录。用户随后已授权重设TCR密码，完成真实登录和TWGG r1三镜像推拉部署；H5修复尚未上线验收，临时构建机已释放。当前状态见[接入TODO](../../todos/2026-10-04-runtime-tcr-setup.md)及[本轮基线与规划](multi-service-planning-baseline.md)，不能以本文早期状态判断当前是否已完整交付。

日期：2026-10-04。用户授权安装指定运行服务器并直接开通免费 TCR；后续明确选择保留原有 TCR 密码，稍后提供。

## 已完成与验证

- 服务器 `81.70.201.31`：OpenCloudOS 8.8，复用现有 Docker 26.1.3、Compose v2.27.0 和 Node 22.23.1。
- 安装 Shipkit runtime Agent 0.5.0 到 `/opt/shipkit`；数据目录 `/opt/shipkit-data`，配置 `/etc/shipkit/agent.env` 权限 0600。
- `ship-agent.service` 已启用且运行。通过专用 systemd drop-in 引用现有 NVM Node 路径，未替换系统 Node。
- Agent 只监听服务器 `127.0.0.1:7410`。实际健康响应为 runtime 0.5.0、Docker 可用；159 个远端安装 JS 文件与本次审计后的本地 dist 哈希一致。
- 本机通过 SSH 隧道访问 `http://127.0.0.1:17410`；配对凭据引用为 `prod`。真实认证请求确认 runtime 身份以及 deploy、rollback、gc、deployment-identity-v1、deployment-env-preserve-v1 能力。
- 本机新增 `~/.local/bin/ship-runtime-connect`；受限专用 SSH 密钥与 known_hosts 保存在 `~/.ship/connections/runtime-prod/`。密钥指定本地转发目标并禁止 shell 命令，实际 shell 命令测试被拒绝；连接助手连续执行两次均可用。
- 安装前后对比：7 个既有容器的 ID、状态、StartedAt，以及 5 个既有卷名称均一致。
- TCR 账号已注册个人版。未重置密码；创建广州地域命名空间 `shipkit-zxb`，官方 API 与控制台均确认存在，仓库数为 0。
- 更新本机模板 `~/.ship/config.dynamic.template.yaml` 的仓库地址、命名空间、运行端地址及凭据引用。它仍是待填模板，不是可直接执行发布的项目配置。

## 本机连接与多项目使用

每次使用运行端前先执行：

```sh
~/.local/bin/ship-runtime-connect
```

连接成功后，使用已安装的 `ship` CLI。连接助手按需建立后台隧道；电脑重启或连接断开后再次执行即可。它未配置开机自动运行。

多个项目可以共用此运行端与命名空间，每个项目使用独立应用名、项目配置和镜像仓库，例如：

```text
ccr.ccs.tencentyun.com/shipkit-zxb/project-a
ccr.ccs.tencentyun.com/shipkit-zxb/project-b
```

各项目需要明确自己的端口和持久化卷；如使用宿主机端口，不得与已有应用冲突。现有业务容器未纳入 Shipkit 管理，本次没有执行部署、接管、回滚或清理。

## 剩余配置与验收边界

1. 用户稍后提供现有 TCR 仓库登录密码，再验证镜像登录、推拉并配置运行端拉取凭据。当前没有保存可用的 TCR 密码，也没有执行密码重置。
2. 确定首个项目的源码目录、Dockerfile、运行端口、环境变量与持久化需求，再准备项目的 `ship.yaml` 与 `ship.config.yaml`。源码可通过 Git 拉取或 `--from-dir .` 上传；为首个应用确认独立私有镜像仓库。
3. 动态构建 CVM 的可用区、实例类型、系统镜像、VPC、子网和安全组仍需确定。
4. 准备动态构建机可访问的安装包分发入口，以及构建 Agent 的 HTTPS、域名和网络路由；当前代码不自动签证书或配置 DNS。构建机推送仓库凭据也需要通过镜像或引导注入。
5. 以上配置齐备后，再进行首次真实构建、镜像推拉、部署与健康验证。本次未创建按量 CVM，也未产生实际应用部署记录。

复用的腾讯云 API 密钥查询 TCR 管理 API 返回 UnauthorizedOperation；本次命名空间通过用户已登录的腾讯云控制台会话创建，没有扩展 API 密钥权限。仓库 Docker 登录凭据与该云 API 密钥分别配置。

## 证据

- 原始安装与验证记录目录：`/tmp/codex-tool-runs/svton/runtime-setup/`。
- 脱敏结果：同目录 `runtime-evidence.json`，并随本报告保存副本。
- 创建个人版账号请求返回 `InvalidParameter.ErrUserExist`，确认原有账号存在；RequestId：`48492cc4-e99a-4a1c-a8f2-700f4219ced7`。
- 创建命名空间成功 RequestId：`8adc37e9-ebd7-4ba3-af63-97a28613e515`。
- 命名空间回读成功 RequestId：`ef8356a2-d18d-41f0-b890-1f76d545b8bd`；CreationTime：`2026-10-04 21:35:47`。

本文未记录密码、API 密钥、Agent token 或私钥。
