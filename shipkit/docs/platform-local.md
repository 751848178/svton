# Shipkit 本机控制平台

在 svton 仓库根目录运行：

```bash
pnpm shipkit:start
```

打开 http://127.0.0.1:8769。启动器构建 Shipkit、svton 依赖、Prisma client、API 和前端，执行数据库迁移，并等待两个服务就绪。开发模式使用 `pnpm shipkit:dev`。需要 Node ≥20 和工作区依赖；本次已在 Node 22.17.0 / pnpm 8.12.0 验证。Ctrl+C 只停止本次启动器的前后端，不取消 Agent 上的发布；取消必须使用任务页面的协作取消操作。

默认数据位于 `shipkit/.platform/`，已加入 Git 忽略：

| 位置 | 内容 |
|---|---|
| `platform.db` | 项目、身份/工作空间、元数据、计划、任务、阶段、远端映射、事件、审计和资源租约 |
| `logs/` | 脱敏归档日志，数据库记录范围、字节游标和完成状态 |
| `process-logs/` | 构建、迁移和前后端进程诊断 |
| `runtime.json` | 当前启动器及其两个子进程的 PID |

`SHIPKIT_DATA_DIR` 可指定另一绝对数据目录。`DATABASE_URL=file:/绝对路径/platform.db` 可指定 SQLite 文件。修改后端环境变量后重启平台。数据库和日志应一起备份；配置文件、凭据引用和 Agent 数据由其各自的文件管理。停止平台不会清空历史。

## 当前 macOS 后台运行

2026-10-08 早间发现上一轮终端进程已退出，随后用当前用户的 `launchctl submit` 恢复平台和隔离验收 Agent。后台标签为 `com.svton.shipkit.platform` 与 `com.svton.shipkit.fixture-agent`，任务父进程均为 launchd，已经脱离 Codex 对话终端。前端8769、API8770、隔离Agent19741均重新返回HTTP200；数据库和归档未清空。后台托管当前运行时无需再启动一个前台实例。

后台任务记录在 `shipkit/.platform/background-jobs.json`，日志在 `process-logs/com.svton.shipkit.*.log`。停止平台后台托管可执行 `launchctl remove com.svton.shipkit.platform`；这不会删除数据库或停止业务容器。正在发布的任务应先在平台请求协作取消。隔离测试 Agent 可单独用 `launchctl remove com.svton.shipkit.fixture-agent` 停止，不能将此操作用于取消远端发布。

这两个 submit 任务只在当前 macOS 登录会话内托管，未安装登录启动配置，电脑重启或重新登录后不会据此自动启动；届时仍可使用上面的标准启动命令。

## 使用

1. 注册项目，填写名称、本机绝对项目目录、绝对 Shipkit 配置文件路径。目录需要有效的 schemaVersion 2 `ship.yaml`。可以补服务器显示名和服务入口；这些字段不会改写 target/env 身份。
2. 在项目详情查看真实 Git 分支/提交/未提交状态、Agent 连接、服务版本和构建配置。镜像仓库“已配置”只表示配置有效；推拉能力以实际发布结果为准。
3. 选择服务并生成只读计划。首次部署必须全量；之后未选服务继承运行版本。无 Git 仓库来源时使用本机目录快照；Git 发布使用计划中的固定提交。
4. 核对服务、基线和外部资源，进入执行页，手动开始。流程按准备构建机→构建→推送→归档/清理→部署→健康检查呈现。点击阶段打开日志，可按服务筛选。刷新后继续读取同一持久任务。

平台每个服务的构建与推送任务期限为 20 分钟，部署与回滚期限为 60 分钟。动态构建机仍在创建前检查整轮任务、初始化时间与云定时销毁期限能否互相覆盖；不会为了发布自动延长项目的销毁兜底。
5. 执行结束后手动查看结果。应用、健康/恢复、取消和构建资源清理分别记录。再次发布会生成新计划和新任务。
6. 从发布记录选择历史变更及服务，核对其变更前快照和当前基线，再确认回滚。整轮平台历史永久保留；Agent 快照可能过期，缺失或越界目标会被拒绝。

取消请求会持久保存并送达 Agent；构建/推送等待当前 Docker 操作结束，运行端在安全点恢复已切换的服务。提交临界区明确不可取消。取消请求中、已取消、恢复失败不会混用。构建机释放失败不会改写应用结果；清理重试必须先核对原配置、租约、终态任务及完整归档，不能释放其他轮次的实例。

## 接入边界

前端同源 `/api` 代理到 127.0.0.1:8770。写入要求本机来源、JSON 和本机标头；无任意 shell 接口。固定本机 Actor/Workspace 与策略接口为以后接入认证预留边界，本版没有登录或权限管理页面。

平台发布要求 runtime 的 group-baseline 和 jobs operation/events/cursor/cancel 能力；builder 同样要求四项 jobs 安全能力。旧 Agent 会被拒绝，需人工升级已安装组件；平台不会自动升级服务器。原 CLI/JSON 入口继续可用。

本次使用独立 Docker Agent、仓库和临时测试项目完成验收；项目列表中的验收项目引用隔离目录，不能代替注册实际项目。动态云供应商通过既有腾讯云 provider 接入，SDK 模拟验证了租约、保留、取消及释放失败边界；本次未创建收费云资源，真实新建/销毁实例验收仍需单独授权。未更改 TWGG 生产服务或已安装 Agent。

架构见 [platform-architecture.md](platform-architecture.md)，数据库/API 见 [platform-api.md](platform-api.md)，证据见 [platform-acceptance.md](audits/2026-10-08/platform-acceptance.md)。
