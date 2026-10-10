# Shipkit 自托管基础验收

日期：2026-10-10。范围为首次部署基础；本记录不代表注册中心、Agent 自升级或 Server 自发布已完成。

## 已通过

| 模块 | 提交 | 验收 |
| --- | --- | --- |
| 回环端口 | `c636e85e` | 112 项定向测试；旧端口格式保持兼容 |
| 容器停机备份身份 | `518962bf` | 19 项测试及真实 Docker 停机身份检查 |
| 控制端辅助状态备份 | `3d010150` | 25 项测试；旧备份兼容、源变更和不安全路径拒绝 |
| 容器运行安全策略 | `ce52b813` | 38 项测试；真实只读根、noexec tmpfs、能力限制、用户和停止宽限 |
| 完整进程树监督 | `1d73c141` | 8 项测试；迁移后代停止后释放锁、迟到锁和日志打开竞态 |
| 私有 Git 与 noexec | `1723d32e` | 21 项回归及真实 HTTPS 私有 Git 容器；错误凭据拒绝、清理、并发不串凭据 |
| 容器镜像与引导 | `53df3f7e` | 固定源码 native/amd64 构建、已有验收目录迁移、TTY 初始化、双端健康、正常停止；首次空配置场景见下文 |
| 受控重启策略 | `680f91b7` | 41 项测试；v1/v2 实际 Docker 策略、快照恢复与 Builder 排除 |
| 空配置 Corepack | `4cce3e0a` | 镜像内只读缓存；真实空配置、无网络迁移和 UID 10001 首次启动 |
| 临时宿主隔离 | `c2ca80f0`、`5f20151d` | 30 项纯测试；真实 synthetic systemd 图、内核 bridge 拒绝与限定规则计数 |
| Runtime 日志轮转 | `7104d672` | 48 项通过、2 项既有容器 fixture 跳过；两种 Compose 渲染的真实 Docker HostConfig 为 json-file 10m×3 |
| 仓库内自托管规格 | `bf66cc5e` | 生成一致性门禁、真实构建上下文白名单与固定源码 amd64 构建 |
| 服务与镜像仓库名称 | `b08ffde7` | 58 项定向测试、构建与独立纯用例审查；运行服务 server 使用独立 shipkit-server 镜像仓库 |

上述生产代码均经过独立审查。核心定向测试日志保存在本机私有目录
`/tmp/codex-tool-runs/svton/self-hosting/`，不将真实凭据、完整生产日志或主机信息提交到公开仓库。

## 真实页面与镜像替换

在独立容器页面登记合成项目“自托管持久化验收”，通过页面保存秘密变量并冻结
“容器持久化配置 · 0.0.1”。随后以固定提交 `53df3f7e` 的新镜像替换容器，复用原数据和配置挂载。

替换后浏览器重新加载仍显示同一项目与配置版本；独立数据检查的 14 项结果全部为真，
包括账号登录、原主密钥摘要、项目/版本身份、秘密解密匹配、日志原内容、controller-state、
私有 fixture 内容和文件权限。账号与主密钥未被重置。合成连接未指向真实业务，未执行发布。

## 固定版本离线镜像

源码：`680f91b7b6fcc453b597bdca5aae7c76070042ab`。构建上下文来自限定路径的
`git archive`，并经 Dockerfile 白名单过滤；未读取本机 `.npmrc`。

amd64 镜像在已有验收配置目录下的迁移、健康、真实 noexec Git helper 和正常停止已通过。
目标主机的首次空配置目录、只读挂载与无网络迁移随后暴露 Corepack 缓存未随运行用户
正确固定：尝试创建 `/etc/shipkit/.cache/node/corepack/v1` 而失败。`4cce3e0a` 将 Corepack
缓存固定在镜像内，重建后通过真实空配置、只读挂载与无网络迁移。Prisma 初始化自己的
缓存属于正常行为，不能将它误判为 Corepack 缓存回写。独立 Agent 包的完整
dist 与冻结依赖来自同一固定镜像，在目标机新命名空间的 Node 22.23.3 下通过真实 x64
健康验收；只使用临时回环端口，测试进程随后停止，现有 Agent 未被替换。离线压缩包完成 gzip、
SHA-256 和 OCI index → amd64 manifest → Docker config 的身份链校验。Docker 28 的
index ID 与 Docker 26 传统存储的 config ID 不同，安装必须核对对应身份，不能直接混比。

## 首次真实部署

实际 Server 使用固定提交 `4cce3e0aaeb94cc8a7301f945c252621b967ba16` 的 amd64 镜像。
仅通过 SSH 隧道访问，Server 无 Docker socket；外置数据与原主密钥、只读根、能力限制、
noexec tmpfs、停止宽限及有限日志轮转均保留。专用宿主 Runtime Agent 使用独立目录、
Node 与认证凭据；旧业务 Agent 未被覆盖。三个专用 systemd unit 已验收后启用。

用户选择全新平台数据，保留本机原数据。页面真实登录通过；正常停止释放维护锁后重建
Server 容器，同一冻结镜像下账号、会话、主密钥、Agent 凭据与已有进程日志均保留，
API 和容器健康通过。前后对照的原有 7 个业务容器身份、镜像、启动时间和健康状态一致，
旧 Agent 的进程与启动状态一致。

同 control bridge 的验收容器访问 Agent/Server 均为 200；另一专用 bridge 访问均超时，
两条限定 DROP 规则计数增加，验收容器/网络已清理。synthetic systemd 检查涵盖前置失败、
健康启动与缓存 guard 下再次前检；它没有重启真实 Docker，也不代表实际开机验收。

随后以 `b08ffde7a30249ce718888d5c7c3639c34fa3f1a` 冻结镜像完成正常 Runtime 接管。
完整 Agent 包的 SHA、499 个编译文件、41 个冻结依赖及内部相对链接独立通过，专用 Runtime
仅切换不可变安装目录，保留 token 与工作台账。镜像经正常认证拉取；registry index、amd64
manifest、Docker config ID 对应关系核对通过。操作员先正常停止唯一 bootstrap 容器、保存
完整离线数据与配置并单独保存密钥，再只删除该已停实例（无 `-v`），通过正常
`deploy-group` 建立首次基线。任务完成且 `verification=passed`，真实 group-state 与
任务 releaseId、固定 imageRef、spec 和 Git SHA 一致；没有手工填写 Agent 状态。

新容器实际 Compose 工作目录已属于 Runtime Agent，json-file 日志、只读根、UID10001、
安全策略、loopback 端口和私有网络核对通过。宿主 Server unit 重新启动并通过前检，API、
Docker 健康、原登录会话、2 条 Actor、空任务表、数据库完整性和原主密钥摘要均通过。
原有 7 个业务容器身份、镜像、启动时间与健康、旧 Agent 进程和启动时间逐项不变。

有限 E3 验收采用独立本机 Builder，经 SSH Unix socket 与仅 control bridge 的 relay
连接。Server 真实请求为 200 且角色 builder/Docker 可用，错误凭据为 401；其他专用 bridge
的三次 TCP 连接均超时，限定 DROP 计数增加，QA 容器、网络和回执已确认清理。
relay 无发布端口、只读 socket 挂载、0700/0600 权限与受限日志已核对。
这是临时验收连接，依赖本机与 SSH，不是永久 Builder 托管。

首次初始化的数据库通过离线备份、完整性和管理员记录检查；原解密主密钥单独保存。
经用户明确批准，数据库与密钥分别下载至本机私密恢复目录，两份归档均为 0600，
数据库重读完整性为 `ok`。这是初始恢复副本，尚非定期备份或当前完整运行状态的备份。

## 尚未通过的门槛

- Docker 空 IPAM 和未加载 synthetic QA unit 的兼容问题已在 `5f20151d` 修复并重放。真实开机、Docker daemon 重启、外部 L2/DNAT 路径尚未回放；不升级或重启其既有 Docker。
- 嵌套系统启动测试未屏蔽 systemd-binfmt，清空了本机 Rosetta 注册；沙箱容器、镜像和源码已删除。经用户批准重启 Docker Desktop 后，15 个原运行容器均恢复，原健康的 8 个容器保持健康，amd64 Node 22.23.3 与浏览器持久化页面重新通过。后续禁止共享内核 privileged fixture。
- Shipkit Git 项目登记、版本化环境配置与计划尚在验收。真实 GitHub 预览暴露 Node 22 HTTPS lookup 的 `all:true` 回调兼容问题，正在修复并补 transport 回归；本机 fake-IP DNS 已被 Git 安全校验拒绝，临时 Builder 将使用独立真实 DNS，保留地址防护。
- 注册中心、维护交接与自升级均尚未完成；首次 Agent 接管不等于通过平台任务发布自身已获验收。
