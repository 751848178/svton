# 临时共享主机隔离

此模块为仍运行其他业务的 Docker 26 主机提供限定部署配置。正式环境优先采用
维护中的 Linux 与 Docker >= 28。暂时无域名时使用 SSH 隧道，不开放平台公网入口。
本模块不升级、重启 Docker，不修改 Docker unit 或全局 FORWARD 策略。

## 资源与边界

| 资源 | 默认配置 | 用途 |
| --- | --- | --- |
| Docker external bridge | `shipkit-control` / `br-shipkit` | 仅 Shipkit Server 加入 |
| IPv4 子网 / 宿主网关 | `172.30.241.0/28` / `172.30.241.1` | 首次安装前核对现有 Docker 网络和路由 |
| Web 入口 | `127.0.0.1:28769` → 容器 `8769` | SSH 隧道与宿主 Agent 健康检查 |
| 新 Runtime Agent | `172.30.241.1:17412` | Server 通过 bridge 网关连接 |
| 原 Runtime Agent | 不修改 | 原项目继续使用其既有连接 |

自有 `SHIPKIT-FORWARD` 仅处理目的地址为新子网的转发：允许本 bridge 发起与
已建立连接的返回流量，拒绝其余流量，包括来自其他 bridge、L2/DNAT 和 direct-route
路径的新连接。`SHIPKIT-INPUT` 仅处理新网关的 Agent 端口，允许本 bridge 和 loopback。
DOCKER-USER 和 INPUT 中只插入上述限定跳转；不 flush 其他规则或改变策略。
启动时要求 FORWARD 的首条规则无条件进入 DOCKER-USER，异常则拒绝 Shipkit 启动，
不擅自重排已有业务规则。宿主 root 和已授权 Docker 操作者仍拥有主机控制权。

独立 Agent 以 root 调用 Docker，目录和凭据分离提供操作隔离，尚未提供项目或挂载
目录授权。它不能视为多租户安全沙箱。不得给不可信用户 Agent 凭据或 Docker 权限。

## 安装顺序

以下是管理员部署步骤，文档中的命令不会自动执行。安装前确认固定镜像、数据迁移
策略、备份、主密钥、管理员账号与新 Agent 独立凭据，按 container README 完成引导。
目标需要 `/usr/bin/python3 >= 3.6`、`iptables`、支持 JSON 输出的 `ip`、Docker 与 Compose v2。

1. 将本目录的运行 Python 模块和三个 `.service` 文件安装到
   `/usr/local/lib/shipkit-host-isolation/`，整条父目录链和文件均 root 所有，目录 0755，
   文件 0644，无组/其他用户写权限。独立 Agent 和 Node 安装到同一个冻结目录
   `/opt/shipkit-agent/releases/<immutable-id>/`，禁止符号链接或可写父目录；Node 可执行。
2. 创建 root 所有的 `/etc/shipkit-isolation`、`/srv/shipkit-agent`，权限 0700。
   根据 example 写入 `control.env`、`agent.env`，权限 0600；Agent 的 HOME 固定为
   `/srv/shipkit-agent`，不借用旧项目或 root 的 Docker 配置。环境变量名称见示例文件。
3. 在 root shell 加载已审核的 `control.env`，**先**运行
   `python3 /usr/local/lib/shipkit-host-isolation/network.py ensure`。
   它先拒绝网段、路由和 bridge 冲突，只创建带专用 ownership label 的 external bridge，
   再独占写入 0600 的 `network.json`。现有冻结记录或网络 ID/配置不匹配时拒绝继续。
   缺少此证明时，任何 guard 入口均拒绝写入防火墙规则。
4. 运行 `guard.py apply`、`guard.py verify`。只能补全本模块首次安装中断留下的规则前缀，
   未知自有规则需要管理员核对。网络配置安装后冻结，不直接编辑 CIDR、名称或端口。
5. 将三个已审核 unit 复制到 `/etc/systemd/system/`。先核对同名 unit 不属于其他安装，
   执行 `systemd-analyze verify` 与 `systemctl daemon-reload`，不操作 Docker unit。
6. 用下面两个文件执行 `docker compose ... create server`，**不能用 `up -d` 绕过 guard**。
   固定 `SHIPKIT_HOST_PORT=28769`，保持 base 的持久化挂载、UID、只读文件系统和安全策略。

```sh
docker compose --env-file /etc/shipkit-isolation/control.env \
  --env-file /srv/shipkit/config/deploy.env \
  -f shipkit/ops/container/compose.yaml \
  -f shipkit/ops/host-isolation/compose.override.yaml create server
```

7. 运行 `server.py verify`，检查容器名 `ship_shipkit_server-server-1`、实际 restart policy、
   loopback 端口与唯一 external network。通过后启动 guard、专用 Agent、Server 三个 unit，
   核对健康检查与登录页面。验收前不启用开机服务；通过后只 enable 这三个自有 unit。

Server 使用 `on-failure:3`，Docker daemon 启动时不会自动拉起它。Server unit 在启动时
验证网络冻结记录、修复并验证限定规则、核对容器策略，才执行 `docker start`。
guard 的 `Before=docker.service` 仅表达排序，Docker 不依赖 guard；guard 失败只阻止
要求它的 Shipkit Server/Agent。新 Agent 有独立 systemd 生命周期，不借用旧业务 Agent。
这些启动检查不提供持续防火墙监控，管理员改网络或防火墙后需要重新核对。

## 自身发布与迁移

临时主机 spec 从维护中的 `ops/container/ship.yaml` 派生，避免复制全部服务定义：

```sh
node shipkit/ops/host-isolation/render-spec.mjs /secure/shipkit-temporary.yaml
```

生成器保留 base 策略，只添加冻结 external network 和 `runtime.restartPolicy=on-failure:3`，
输出为独占创建的 0600 文件。`SHIPKIT_CONTROL_NETWORK` 必须与宿主冻结配置一致。
Agent 更新后的容器也须保持这两个策略，不使用 base spec 覆盖临时隔离配置。
接管后不再用 bootstrap Compose 更新同一服务；自身发布/重启恢复由独立模块验收。

本机使用 `ssh -L 28769:127.0.0.1:28769 用户@临时主机`，页面来源设置为
`http://localhost:28769`。迁移时离线保存完整 `/srv/shipkit/data` 与主密钥，按 container
README 的备份边界操作；在新主机重新核对并创建 external network 与冻结记录。
网络 ID、宿主 unit、Agent 安装和连接地址不能直接照搬。保持数据挂载与加密主密钥，
更新独立 Agent 连接 profile/凭据，恢复后重新验收用户、项目、配置与日志。

## 验证边界

`test_guard.py`、`test_preconditions.py` 与 `test_synthetic_qa.py` 是纯 mock 检查，覆盖
规则范围与恢复顺序、前置失败不写规则、路径信任、QA 依赖替换和只清理自有对象。
它们不证明实际内核过滤效果、真实开机排序或 Docker 重启后的容器状态。

`acceptance/systemd-synthetic-qa.py` 默认拒绝运行；管理员审核后显式以 root 加 `--run`。
它只在 `/run` 创建随机命名 QA unit 与 marker，用自建 control unit 替代真实 Docker
依赖；真实 Docker 只读取状态戳。验证 guard 故障、健康启动和缓存 guard 的再次前检，
最终仅停止/清理本次独占创建且身份未变的 QA unit，daemon-reload 是唯一全局 systemd 动作。
所有子进程有 30 秒超时；失败清理需要核对输出，不能全局 reset-failed 或 stop Docker。
此脚本通过也只证明 synthetic 依赖图，生产启动与真正 boot/restart 仍需单独验收。

不得在共享内核 privileged systemd 容器运行这类验证。systemd-binfmt 会清空共享内核
解释器注册，其他内核服务也可能越过 namespace。此前本地不安全 fixture 已停止并删除，
不能将它的结果作为隔离或启动证明。真实防火墙的 L2/DNAT/direct-route 测试应使用
独立 VM；目标共享主机的 boot/restart 验收需要单独批准的维护窗口。

依据：[Docker 端口边界](https://docs.docker.com/engine/network/port-publishing/)、
[DOCKER-USER 语义](https://docs.docker.com/engine/network/firewall-iptables/)、
[restart policy](https://docs.docker.com/engine/containers/start-containers-automatically/)、
[Docker 26 DOCKER-USER 保留实现](https://github.com/moby/moby/blob/v26.1.3/libnetwork/firewall_linux.go)。
