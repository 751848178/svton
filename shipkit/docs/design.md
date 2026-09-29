# shipkit 设计文档 (v1, 2026-09-28)

## 背景与决策

devpilot 盘子过大难推进。经盘点（2026-09-28）：

| 能力 | devpilot 现状 | 结论 |
|---|---|---|
| 构建镜像 | 产物是 zip（`bundle.zip`+sha256），从不 `docker build` 用户项目 | 绿地 |
| 推 ACR/TCR | API 侧为零；仅 svton CLI 有朴素 dockerPush（`packages/cli/src/commands/docker.ts:305`） | 绿地，tag 命名对齐 |
| 服务器运行 | server-executor（ssh2/agent 双通道），命令白名单已放行 docker compose | **继承契约** |
| 动态开机 | resource-request provider 模式 blocked 桩 | 绿地 |

用户确认的整体方案 + 两处调整：

1. 构建机支持**动态创建**（前期腾讯云 CVM，provider 适配器可扩展）与**绑定既有机器**（static）双模式
2. 控制器**不直接 SSH** 任何机器，改用机器上 agent 的 **HTTP 开放接口 + 参数**触发

其余决策：TS CLI（bash 受系统限制且无法承载 HTTP/AI 诉求）；运行侧单机多 app 起步但 targets 设计为多机即插即用；镜像仓库为交付唯一事实源。

## 架构与时序

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

```
 ship 控制器         builder 构建机         镜像仓库              runtime 运行机
 (TS CLI/本机)       (动态或绑定)           (ACR/TCR)             (常驻)
 │                   │                      │                     │
   1. 创建构建机: 腾讯云 CVM 按量实例 + cloud-init 自装 docker/node/agent
 ├───────────────────>
   2. HTTP 触发 /api/build {repo,ref,spec}: 构建机自行 git clone
 ├───────────────────>
   3. builder: docker build 产出 ${REGISTRY}/${NS}/${APP}:${sha}-${时间}
 ├───────────────────>
   4. HTTP 触发 /api/push: agent 用环境凭证 docker login + push
                     ├──────────────────────>
   5. 释放构建机(按量计费止损; keepMinutes 窗口内复用)
 ├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄> (销毁)
   6. HTTP 触发运行服务器 /api/deploy {app,imageRef,spec}
 ├───────────────────┼──────────────────────┼─────────────────────>
   (运行服务器拉镜像(本地已有则跳过) + compose up + 轮询健康检查)
                                            <─────────────────────┤
   7. HTTP 返回: 成功=新版本上线; 失败=agent 自动回滚上一版本
 <───────────────────┼──────────────────────┼─────────────────────┤
 │                   │                      │                     │
```

## 关键机制

### 无 SSH 的引导（鸡生蛋问题）

新机器上没有 agent 时怎么装？控制器临时起一个 **bundle server**（`providers/bundle-server.ts`，端口 7411，token URL）：

- 动态 CVM：cloud-init user-data 只有一行 `curl -fsSL '<install.sh>' | bash`，参数全部在 URL query 里
- 绑定机器：`ship serve-bundle` 打印同款一键命令，运维手动执行

安装脚本（`bootstrap/install.sh`）装 docker + node20 + agent（dist 是纯 node 标准库产物，**机器上无需 npm install**）并注册 systemd。

### 源码怎么到构建机（无 rsync）

- 默认 git：`/api/build {source:{type:'git',repo,ref}}`，构建机自己 clone/fetch（凭证用 `source.token`，clone 后立即从 remote 清除）
- 备选 tarball：`POST /api/sources` 上传 tar.gz（`ship build --from-dir ./local`）

### 版本与回滚

- tag：`${sha7}-${yyyyMMddHHmm}`；完整 ref `${registry}/${ns}/${app}:${tag}`（与 svton CLI dockerPush 命名对齐）
- runtime 每个app 维护 `state.json`（current/previous/history 上限 20）+ `spec.json`（部署时的 spec 快照，回滚时复用 ports 等信息）
- 部署失败且存在 previous：自动回滚并等待健康；job 失败信息携带 `rolledBackTo`，CLI 退出码 `5`
- 镜像本地已存在时跳过 registry pull（重部署/同机构建/离线场景）

### 动态构建机（腾讯云适配器）

`providers/tencent.ts`：`RunInstances(POSTPAID_BY_HOUR + UserData)` → 轮询公网 IP → 轮询 agent `/health`；`TerminateInstances` 释放。状态存 `~/.ship/builder-state.json`；`keepMinutes` 内健康则复用，超窗则换新。凭证走 `TENCENTCLOUD_SECRET_ID/KEY` 环境变量。新云厂商只需实现 `providers/provider.ts` 接口（ensure/release/status）。

## 契约

- 项目规范 `ship.yaml`：见 `examples/demo-web/ship.yaml`；字段校验在 `src/shared/spec-schema.ts`（agent 与 CLI 共用，零依赖）
- 控制器配置 `ship.config.yaml`：见 `ship.config.example.yaml`
- agent API：见 README 表格；错误统一 `{error:{code,message}}`
- CLI 退出码：0/1/2/3/4/5（见 README「AI 友好性」）

## 与 devpilot 的关系（后续反哺路径）

| shipkit | devpilot 对应 | 反哺动作 |
|---|---|---|
| ship.yaml | `ApplicationService.deployConfig`（prisma schema:1424） | UI 生成的 deployConfig 可直接渲染 ship.yaml |
| buildArgs strict 白名单 | `release-build-config.utils.ts` buildEnvironment 校验 | 同一条正则，语义一致 |
| image tag 命名 | svton CLI dockerPush（packages/cli:305） | 已对齐 |
| deploy.sh 等价的 compose 操作 | server-executor 命令白名单（container-rules.constants.ts） | agent 的 deploy 步骤可直接作为其 deployment 脚本执行 |
| ship builder (CVM provider) | resource-request provider 模式（当前 blocked） | 把 tencent.ts 的调用封装为其 provider 实现 |
| ship CLI --json / 退出码 | devpilot API | 后期平台化时 CLI 可整体上服务器，或按子命令逐步吸收 |

## 验证记录（2026-09-28）

- `pnpm --filter shipkit build` 通过（strict TS）
- `pnpm --filter shipkit test`：28/28 通过（spec/config 校验、compose 渲染、状态机、exec、agent HTTP 鉴权/角色门禁/参数校验）
- 冒烟：agent 启动、/health 开放、无 token 401、CLI help/doctor/status
- 本地 E2E：通过 agent HTTP API 完成 deploy v1（健康检查 200）→ deploy v2 → rollback，状态机与容器版本均正确
- 待真机验证：腾讯云动态构建机（等凭证）、真实 ACR/TCR 推送、跨机部署

## 已知限制（v1）

- 构建缓存：动态机构建无层缓存（镜像每次全量构建）；后续可用 registry cache（buildx cache-from/to）
- agent 单实例并发执行 job 无队列（docker 自身串行化）；job 日志仅存本机
- git 源为全量 clone（大仓库慢）；后续加 --depth 与增量 fetch 策略
