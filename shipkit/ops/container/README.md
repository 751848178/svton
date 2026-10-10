# Shipkit 自身发布

同一个镜像运行 Web 与 API。Web 在容器内监听 `0.0.0.0:8769`，API 只监听
`127.0.0.1:8770`；Next 同源代理 `/api`。容器不包含 Docker daemon，不挂载
Docker socket。负责更新此容器的 Runtime Agent 安装在宿主机，独立于 Server。

正式部署使用维护中的 Linux、GNU/Linux kernel >= 4.18、Docker >= 28 与 Compose v2。
Node 22 的运行支持依赖宿主内核，容器不替换内核。Docker 28 之前存在同一局域网访问
loopback 发布端口的边界，不能以 `127.0.0.1` 绑定代替版本与网络隔离检查。旧主机应先
使用隔离环境验证兼容性，禁止为部署此平台升级或重启已有业务服务。

## 构建与数据布局

在仓库根目录构建：

```sh
docker build --platform linux/amd64 -f shipkit/ops/container/Dockerfile -t shipkit-server:VERSION .
```

Dockerfile 使用专属默认拒绝的 context 白名单、锁定 pnpm 与冻结锁文件，仅安装
Shipkit 和 Web/API 依赖的 workspace。主机 `.npmrc`、认证文件、`.platform`、
本地依赖、Next 产物和真实生产验收截图不会进入 context。运行用户为 `10001:10001`。

宿主机布局：

| 路径 | 用途 | 权限 |
| --- | --- | --- |
| `/srv/shipkit/data/platform.db` | SQLite 与迁移记录 | UID 10001，0600 |
| `/srv/shipkit/data/logs/` | 已归档的发布日志 | UID 10001，0700 |
| `/srv/shipkit/data/process-logs/` | 迁移、API、Web 进程日志 | UID 10001，0700 |
| `/srv/shipkit/data/controller-state/` | 按项目与服务隔离的构建记录 | UID 10001，离线备份时一同保存 |
| `/srv/shipkit/data/.ops.lock` | 启动与离线维护独占锁 | 由 supervisor 管理 |
| `/srv/shipkit/config/private/secret-key.json` | 原加密主密钥 | UID 10001，0600，只读挂载 |
| `/srv/shipkit/config/` | 外置连接 profile、CA、非秘密部署引用 | 目录 0700，只读挂载 |
| `/srv/shipkit/config/.ship/credentials.json` | `tokenRef` 对应的 Agent 凭据 | UID 10001，0600，只读挂载 |

离线备份保存 SQLite、`logs/`、`process-logs/` 与 `controller-state/`，原主密钥另行备份。
`runtime.json` 和 `.ops.lock` 是当前进程证据，不随备份恢复。不能只保留数据库而丢失主密钥。
连接配置中的宿主 Runtime Agent 地址必须能从容器访问，容器的 `127.0.0.1` 仅指容器自身。

镜像带有经过生成一致性检查的 Agent 安装模板，支持现有 Builder 流程。首次部署优先
使用已有静态 Builder。临时云 Builder 如使用内置 bundle server，其 7411 分发监听需有
独立、受保护且云机器可达的 HTTPS 入口；或显式配置既有 `installUrl`。只映射 Web 8769
不能让新云机器取得安装包，本配置不自动开放分发端口，需单独验收该网络链路。

## 首次引导

1. 创建 data 与 config/private 目录，所属 UID/GID 设为 10001，目录权限 0700。
2. 使用已发布且校验过的镜像，在一次性引导容器执行
   `node shipkit/ops/container/bootstrap.mjs migrate`。
3. 明确初始化一次主密钥：运行
   `node shipkit/ops/container/bootstrap.mjs key:init`，挂载 data 与可写 config，
   设置上述 `SHIPKIT_DATA_DIR` 和 `SHIPKIT_SECRET_KEY_FILE`。已有密钥或加密数据时拒绝初始化。
4. 使用同一个镜像与数据目录，通过交互 TTY 执行
   `node shipkit/ops/container/bootstrap.mjs admin --username USERNAME` 初始化登录用户；按命令提示操作。
5. 将 `env.example` 复制至仓库外的 deploy.env，固定镜像 digest 与页面来源。
6. 运行 `docker compose --env-file /srv/shipkit/config/deploy.env -f shipkit/ops/container/compose.yaml up -d`。

生产启动要求已存在的安全主密钥，缺失时直接失败，绝不自动创建或替换。启动先获取
维护锁、执行 `prisma migrate deploy`，成功后启动两个子进程；任一退出时停止另一个。
SIGTERM 只终止当前 supervisor 的子进程，正常退出释放维护锁。被强杀后的遗留锁需核实
旧进程及其子孙进程确实退出后，由管理员核对并处理，不能无条件删除。没有自动清锁命令。

引导命令使用相同的维护锁并先迁移数据库，拒绝与运行服务同时操作。引导容器也必须
以 UID 10001 执行，使主密钥所属用户与长期运行身份一致。固定 `HOME=/etc/shipkit`，
因此 profile 的 `tokenRef` 从外置 `.ship/credentials.json` 读取，不落入临时容器。

初次可使用 SSH 隧道 `localhost:28769`；bootstrap compose 只将宿主端口绑定 loopback。
公网使用前配置 HTTPS 反向代理与准确的 `SHIPKIT_PUBLIC_ORIGIN=https://实际域名`。
登录 cookie 和同源访问检查以这个地址为准，不使用容器 IP 作为页面来源。

## 平台发布自身

项目源码为 svton Git 仓库，spec 路径为 `shipkit/ops/container/ship.yaml`，服务为 `server`。
Builder 构建并推送镜像；宿主 Runtime Agent 更新此容器。平台中的配置版本至少绑定
`SHIPKIT_PUBLIC_ORIGIN`，密钥只使用外置只读文件，不写进配置文本或镜像。升级保持
相同的 `/srv/shipkit/data` 与 `/srv/shipkit/config` 挂载，执行前完成离线备份。

发布规格与 bootstrap compose 都将 `127.0.0.1:28769` 绑定至容器 `8769`，不公开管理端口。
Runtime Agent 的 bind allowlist 只放行上述两个宿主目录；自发布后仍需核对宿主实际绑定。

首次安装 compose 只负责引导，后续通过平台发布前应按 Agent 的部署归属要求接管，
禁止同时用 bootstrap compose 与 Runtime Agent 操作同一服务。发布进行中不启动另一轮
自身升级；Server 重启恢复、本次发布最终状态、数据库迁移失败与匹配备份回退须分别验收。

## 验收边界

镜像健康检查同时探测 API 与 Web 同源代理。必须验证未登录页面、初始化用户、正常
登录、无密钥拒启、错误密钥拒绝读取、停止信号、维护锁、容器重建后用户/项目/日志
仍保留。不要将健康检查通过等同于自身升级完成；自身更新后的任务恢复由发布模块验收。
