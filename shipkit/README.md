# shipkit — 轻量构建/推送/部署工具链

**使用文档：** [图文使用手册](docs/user-guide.md) · [浏览器阅读版](docs/user-guide.html)。新用户从这里开始；覆盖安装、配置、发布、回滚、清理与动态构建机，注明当前真实环境验收边界。

**改进方案：** [新手使用体验实施方案](docs/beginner-experience-plan.md)——安装即用、首次向导、机器接入与日常发布的分阶段改造计划（待实施）。

脱离 devpilot 的独立交付工具链：**控制器 CLI + 机器 agent（HTTP 开放接口）+ 私有镜像仓库**。控制器从不 SSH 到任何机器，一切操作通过 agent 的 HTTP API + 参数触发。跑通后可反哺 devpilot（见 `docs/design.md`）。

```
┌──────────────────────────────────────────────┐
│(A) ship 控制器 CLI (TS)                      │
│ship build | deploy | rollback | status       │
│前期: 开发者本机 -> 后期: devpilot 平台服务器 │
└──────┬────────────────────────────────┬──────┘
  1. 创建/释放构建机                     6. HTTP: /api/deploy
  (腾讯云 CVM 按量 + cloud-init)
       │                                │
┌──────▼───────────────────────┐    ┌───▼──────────────────────────┐
│(B) builder 构建机            │    │(D) runtime 运行服务器        │
│动态创建 或 绑定既有机        │    │常驻容器运行时                │
│- /api/build 构建镜像         │    │- /api/deploy 部署/回滚       │
│- /api/push  推送仓库         │    │- docker + compose            │
└────────────┬─────────────────┘    └─────────────▲────────────────┘
             │ 4. docker push                     │ 5. docker pull
      ┌──────▼────────────────────────────────────┴──┐
      │(C) 私有镜像仓库 (ACR / TCR / 自建)           │
      │所有交付镜像的唯一事实源                      │
      │${registry}/${ns}/${app}:${sha}-${时间}       │
      └──────────────────────────────────────────────┘
```

## 概念

| 概念 | 说明 |
|---|---|
| **ship CLI** | 控制器，装在开发者本机（后期可上服务器作为平台能力）。纯编排，不做重活 |
| **ship-agent** | 机器上的常驻进程（node，零 npm 依赖），暴露 HTTP API，角色 `builder` / `runtime` / `both` |
| **ship.yaml** | 项目交付规范：一个文件描述“怎么构建（Dockerfile/buildArgs）+ 怎么运行（ports/healthcheck/envFile）” |
| **ship.config.yaml** | 控制器配置：builder（static 绑定 / dynamic 动态创建）、registry、runtime targets（多机即插即用） |

## 快速开始（控制器本机）

```bash
pnpm --filter shipkit build     # 编译 (node >= 20)
node shipkit/dist/cli/main.js help
cp shipkit/ship.config.example.yaml ship.config.yaml   # 填入你的机器/仓库信息
node shipkit/dist/cli/main.js doctor                   # 本地+远端自检
```

## 给机器装 agent（一次性）

在控制器本机启动引导分发（把编译产物 + 安装脚本临时挂成 HTTP 服务）：

```bash
node shipkit/dist/cli/main.js serve-bundle --host <控制器IP> [--minutes 30]
# 输出两条一键安装命令, 分别在运行服务器/构建机上以 root 执行:
#   curl -fsSL 'http://<控制器IP>:7411/<token>/install.sh?role=runtime&token=<t>&port=7410' | bash
#   curl -fsSL 'http://<控制器IP>:7411/<token>/install.sh?role=builder&token=<t>&port=7410' | bash
```

安装脚本自动装 docker + node 20 + agent 并注册 systemd（`ship-agent.service`）。把打印的 agent token 填进 `ship.config.yaml`。

动态构建机（腾讯云）不需要手工安装：`ship build` 会用 CVM API 按量创建 + cloud-init 自举，用完释放（`keepMinutes` 窗口内复用）。需要 `TENCENTCLOUD_SECRET_ID/KEY` 环境变量与 VPC/安全组参数，详见 `ship.config.example.yaml`。

## 日常使用

```bash
ship build                     # 触发构建机: docker build + push（源码取 cwd git 仓库）
ship build --from-dir ./app    # 或打包本地目录上传（无 git 仓库时）
ship deploy                    # 触发运行服务器: 拉镜像 + compose up + 健康检查（缺省用上次 build 的 ref）
ship deploy --ref registry/ns/app:tag --to server-b
ship release                   # build + deploy 一条龙
ship rollback demo-web         # 回滚到上一完整发布快照(镜像+env+配置)
ship gc                        # 预览运行机上可清理的镜像(按发布账本, 保护所有快照引用); --execute 执行
ship status [--to all]         # 各机器上的 app 版本
```

## agent HTTP API（AI/工具可直接调用）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/health` | 开放 | 存活/角色/docker 可用性（无鉴权） |
| POST | `/api/sources` | builder | 上传源码 tar.gz，返回 `{id}` |
| POST | `/api/build` | builder | `{source, spec, tag?}` → `{jobId}` |
| POST | `/api/push` | builder | `{name, tag, registry?, namespace?}` → `{jobId}` |
| POST | `/api/deploy` | runtime | `{app, imageRef, spec, envFileContent?}` → `{jobId}` |
| POST | `/api/rollback` | runtime | `{app}` → `{jobId}` |
| GET | `/api/status` | both | 机器状态 + apps 版本 |
| POST | `/api/gc` | runtime | `{dryRun}`：按发布账本预览/清理镜像（保护全部快照引用） |
| GET | `/api/jobs/:id` · `/api/jobs/:id/log?tail=N` | both | 任务状态 / 日志尾部 |

所有 `/api/*` 需 `Authorization: Bearer <token>`。耗时操作走 job 模型：`202 + jobId`，轮询 job 至 `succeeded/failed`。

### agent 环境变量

| 变量 | 说明 |
|---|---|
| `SHIP_AGENT_ROLE` | `builder` / `runtime` / `both` |
| `SHIP_AGENT_TOKEN` | API bearer token（必填，agent 拒绝裸奔启动） |
| `SHIP_AGENT_PORT` | 默认 7410 |
| `SHIP_WORK_ROOT` | 默认 `/opt/shipkit-data`（apps/ sources/ jobs/） |
| `SHIP_PUSH_USER` / `SHIP_PUSH_PASSWORD` | 构建机推送仓库凭证（仅 builder） |
| `SHIP_REGISTRY` / `SHIP_NAMESPACE` | 请求未带 registry 时的兜底 |
| `SHIP_PULL_USER` / `SHIP_PULL_PASSWORD` | 运行服务器拉取私有仓库的只读凭证（仅 runtime） |

## AI 友好性

- 所有命令支持 `--json`：payload 走 stdout，进度日志走 stderr（可分离消费）
- 稳定退出码：`0` 成功 · `1` doctor 发现问题 · `2` 用法/配置/spec 错误 · `3` agent 不可达 · `4` 任务失败 · `5` 部署失败但已恢复到上一发布 · `6` 部署失败且恢复也失败
- agent API 本身即机器可读契约；job 模型天然适合 AI 分步驱动与观察

## 安全要点

- **传输层（F09 决策）**：固定运行机用 Caddy 自动 HTTPS 反代（安装时 `AGENT_BIND=127.0.0.1` 只监听本机，安全组关闭 7410 公网入站，证书校验不可关闭）；动态构建机走 VPC 内网/加密隧道；引导包必须经 HTTPS 获取。CLI 原生支持 https:// URL（`agentScheme`/`agentPort`/`bundleBaseUrl` 配置化）；固定机 Caddy 模板见 `bootstrap/caddy/`；`ship doctor` 对公网 http 目标输出告警。暂不采用自签 CA。真实域名/证书链路属环境输入——上线前需完成实际加密通道验收

- 控制器→机器只有 HTTP+token，无 SSH 通道；token 每机独立
- 推送凭证只存在于构建机环境；运行服务器只配拉取凭证；运行时 env 文件（`.env`，0600）由控制器在部署时直传运行服务器，**不经过构建机**
- 动态构建机安全组应仅放行控制器来源 IP 的 7410/7411
- `ship.yaml` 的 buildArgs 默认 `strict` 白名单（沿用 devpilot `NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_` 规则），防止把秘密烘进镜像；需要任意参数时显式 `buildArgsPolicy: open`

## 目录

```
shipkit/
├── src/shared/     契约与纯工具(spec/config/exec/http/log/git)
├── src/agent/      agent: server/routes/jobs/handlers/docker/compose/state
├── src/providers/  构建机 provider: static / tencent(CVM) / bundle-server
├── src/cli/        ship 控制器命令
├── bootstrap/      install.sh(agent 一键安装) + systemd unit 参考
└── examples/demo-web/  示例项目(ship.yaml + Dockerfile)
```

验证状态：28 个单测全绿；本地 E2E（deploy v1 → v2 → rollback → 状态机校验）通过。设计细节与 devpilot 反哺映射见 [docs/design.md](docs/design.md)。
