# shipkit 深度审查

审查日期：2026-09-29。对象：当前工作区 `shipkit/`，版本声明 0.1.0。父仓库 HEAD 为 `47daa01d2010a31cd2b150021f31986cdc5fbcc4`，但审查时整个 shipkit 目录尚未跟踪，**该提交号不代表被审查代码已提交**。精确文件快照见 [source-sha256.json](source-sha256.json)。

**结论：已经具备 demo 交付闭环，但尚不适合承担无人值守生产发布。** 高风险集中在发布事务与回滚、源码和凭证隔离、云资源生命周期。现有单测通过与历史 demo 成功，都不能证明这些异常路径可靠。

本次登记 **38 项：17 项 P1、21 项 P2**。P1 表示可能误部署、泄露凭证、失去回滚能力、导致付费资源失管或 agent 整体中断；P2 表示功能失效、误判、可靠性或验证能力缺口。这不是 38 个已在线发生的事故；其中有直接复现、静态确定缺陷，以及明确条件下的安全/运维风险。未发现有足够证据定为 P0 的问题。

## 1. 项目到底做什么

这是从 Devpilot 拆出的独立轻量交付工具，目标是先跑通构建、推送、部署，再把能力回接平台。

- **控制器 CLI**：运行在开发者机器，读取 `ship.yaml` 与 `ship.config.yaml`；编排 build、deploy、release、rollback、status、doctor、builder 和 serve-bundle。
- **构建 agent**：HTTP API 接收 git 源或 tar.gz 源，在构建机执行 Docker build，再用机器上的凭证推送 registry。
- **运行 agent**：接收镜像引用、运行参数和 env 内容，生成 Compose 配置、拉镜像、启动容器、轮询 HTTP 健康检查，并记录 current/previous。
- **动态构建机 provider**：腾讯云 CVM 按量创建、cloud-init 安装 agent、等待就绪、复用或释放。也支持静态绑定机器。
- **引导分发服务**：控制器临时托管安装脚本与编译产物，让新机器完成自举。

当前产品边界是单机 Compose 上的多个单服务应用、多个可选择的运行目标。它没有实现完整发布事务、按版本配置快照、发布队列、持久卷声明、依赖编排、数据迁移、流量切换或持续运行监控。这些未声明的能力不直接算 bug，但决定了适用范围。

代码体量：`src/` 共 48 个 TypeScript 文件、2,977 行，其中 6 个测试文件。agent 运行依赖 Node 标准库；CLI 另外使用 YAML 与腾讯云 SDK。现有分层总体清晰、共享校验器无外部依赖、命令通过 argv 调用而非拼接 shell，这些是可保留的基础。

## 2. 审查方法与验证边界

已覆盖全部 `src/` 模块、bootstrap、provider、E2E 辅助脚本、配置示例、仓库集成及主要设计/使用/真机验证文档。

| 检查 | 结果 | 含义 |
|---|---|---|
| `pnpm --filter shipkit build` | exit 0 | 可编译 |
| `pnpm --filter shipkit typecheck` | exit 0 | 当前 TypeScript 检查通过 |
| `pnpm --filter shipkit test` | 28/28 通过 | 现有测试基线通过 |
| `bash -n shipkit/bootstrap/install.sh` | exit 0 | shell 语法通过，不等于实际安装成功 |
| 隔离缺陷复现 | R01–R25 全部断言通过 | 确认预期失败场景确实发生；不是功能正确性通过 |
| 真实 `docker compose config` | 成功 | 验证 env 插值、Compose 项目名和单端口发布语义；没有启动容器 |

第一次测试受沙箱限制，6 个 HTTP 测试因 `listen EPERM` 失败；允许本机监听后重跑 28/28 通过。这不是产品缺陷。

R01–R21 使用真实业务模块与临时文件，替换外部命令、健康检查、HTTP 和云客户端；R22–R25 使用真实文件系统、子进程、tar 与 Compose 配置解析。它们证明控制流和参数问题，**不冒充云端或真实容器 E2E**。复现摘要持久化于 [evidence.json](evidence.json)。

完整本地日志与可执行复现脚本：`/tmp/codex-tool-runs/svton/shipkit-audit-20260929/`：`tests-local.log`、`build.log`、`typecheck.log`、`reproduce.mjs`、`reproduce.log`、`extra-checks.mjs`、`extra-checks.log`。复现命令：

```bash
node --experimental-test-module-mocks /tmp/codex-tool-runs/svton/shipkit-audit-20260929/reproduce.mjs
node /tmp/codex-tool-runs/svton/shipkit-audit-20260929/extra-checks.mjs
```

临时文件可能被系统清理，仓库内的证据摘要与源码哈希不依赖其长期保留。本次没有创建/销毁云资源、访问生产 agent、启动容器、验证现存密钥、执行付费操作，也没有修改业务实现。

## 3. P1：生产使用前应解决

### F01 默认部署可能把 B 项目镜像发布到 A 项目

**证据：R14，直接复现。** `src/cli/local-state.ts:8` 全局只存一份 last-build；`src/cli/pipeline.ts:142` 取其 imageRef，却不校验记录中的 app。先 build B，再到 A 目录执行 deploy，实际请求为 `app=A, imageRef=B`。

影响：发布错误服务，可能带上 A 的环境凭证。建议按项目、仓库和目标隔离记录，默认部署前校验 artifact 与 app 的绑定，跨应用镜像必须显式指定。

### F02 回滚只恢复镜像，没有恢复旧环境和旧 spec

**证据：R01，直接复现。** `src/agent/handlers-deploy.ts:49–54` 在部署前覆盖单份 spec/env；`runRollback` 在 99–106 行读取最新 spec 和 `.env`。v1 → v2 → rollback 后，镜像为 v1，端口和 env 仍是 v2。自动回滚同样使用新请求 spec。

影响：数据库地址、密钥、端口、健康路径可能不兼容旧镜像。建议保存每次发布的不可变镜像、spec、env 快照，并把整体版本作为回滚单位；保护快照中的秘密。

### F03 Docker 启动等失败路径没有自动回滚

**证据：R02，直接复现。** `src/agent/handlers-deploy.ts:61` 的 bringUp 不在恢复异常处理内；只有后面的 HTTP 健康检查返回失败才进入回滚。端口冲突、compose up 中途失败、超时会直接退出，而 spec/env/compose 已被覆盖。

影响：可能旧容器已停、新容器未成功，磁盘配置与状态记录分离。建议从准备到激活用同一个发布事务管理，任何改变运行态之后的失败都进入恢复流程。

### F04 回滚健康失败仍上报“已回滚”

**证据：R03，直接复现。** `src/agent/handlers-deploy.ts:74–78` 即使恢复健康检查失败，仍填 `rolledBackTo`；`src/cli/pipeline.ts:46` 只检查字段是否 undefined，连 null 也返回“已回滚”的退出码 5。首次部署失败、根本没有旧版本时也会被归为该退出码。

影响：调用方误认为故障已经恢复。建议单独表达 recoveryAttempted、recoverySucceeded、recoveryTarget；只有实际验证成功才报告回滚完成。手动回滚健康失败也需要保留准确的实际运行状态和可恢复路径。

### F05 同一 app 发布/回滚不互斥，状态原子写也会撞车

**证据：R22，真实文件系统复现：10 个并发 shift 中 9 个 ENOENT。** `src/agent/jobs.ts:42–47` 立即启动所有任务，`routes.ts:112,120` 无 app 锁；`state.ts:33` 与 `compose.ts:30` 使用固定 `.tmp` 文件名。

影响：并发操作覆盖 compose/env、回滚目标漂移、状态丢失，磁盘状态不代表实际容器。建议按 app 串行执行部署/回滚，独立工作目录，唯一临时文件，以及版本前置条件。构建共享同一 clone 也应增加按源码工作区的隔离。

### F06 `--from-dir` 会把运行秘密和控制器配置传给构建机

**证据：R24，真实 tar 复现。** `src/cli/pipeline.ts:61–62` 对目录执行 `tar ... .`，没有排除 `spec.envFile`、`.env`、`ship.config.yaml`、`.git` 或依赖目录。`.dockerignore` 只影响后续 Docker context，不能阻止上传。

影响：与 README“运行 env 不经过构建机”的承诺冲突；同时有泄露 agent/cloud 配置、超大上传的风险。建议建立源码打包清单与默认敏感文件排除规则，运行秘密明确禁止进入上传包，并审计 git 模式下已跟踪的秘密。

### F07 tarball source.id 可越出 sources 根目录

**证据：R06，直接复现。** `src/agent/routes.ts:91` 只检查 id 为字符串；`src/agent/source.ts:42` 拼接 `tar-${id}`。`x/../../../outside` 可解析至 workRoot 之外已有目录。

影响：持有 builder token 的调用方能把不属于上传源码的宿主目录作为构建上下文。这是已鉴权 API 的边界突破，不是未登录攻击。建议强制 UUID、校验来源归属与 realpath containment，并对上下文中的符号链接设置边界。本次未把 tar 解压工具自身的目录穿越防护当作已被突破。

### F08 私有 git clone 失败会把 token 写入错误和任务日志

**证据：R10，用虚构 token 直接复现。** `src/agent/source.ts:61` 把 token 放 URL，`source.ts:33` 失败时拼接全部参数为异常；`jobs.ts:59–64` 将异常持久化并对 API 暴露。

影响：git token 落盘、进入 CLI 日志与作业结果；失败 clone 也没有 finally 保证清理 remote 凭证。建议使用临时 credential helper/askpass，通过独立秘密通道注入，统一脱敏并 finally 清理。

### F09 默认公网 HTTP 传输高权限 token、源码、env 和 root 安装脚本

**证据：静态确认，网络风险取决于部署边界。** `src/providers/tencent.ts:154` 使用公网 IP + HTTP；`bundle-server.ts:65,108` 同样 HTTP；agent `server.ts:93` 是 HTTP server。模板和教程按该路径使用。

影响：不可信网络中可能被监听、替换引导脚本或劫持 API。入口 token 和来源 IP 限制不提供传输机密性与完整性。建议采用 TLS/mTLS 或经过明确验证的加密私网通道；安装包做签名/校验。安装脚本还通过 HTTP 获取部分镜像源密钥与 Node tarball，应一并收紧。

### F10 凭证落盘及机器隔离措施不完整

**证据：静态确认。** `bootstrap/install.sh:117–129` 将 agent token、push password 写进 systemd unit，没有设置秘密文件权限；`tencent.ts:49` 保存带 token 的 builder-state 未指定 0600；`e2e/lib.mjs:13` 存在硬编码登录密码；`cmd-serve-bundle.ts:42–43` 默认给 runtime 和 builder 相同 token。

影响：常见 022 umask 下本机其他用户可读凭证，构建机泄露也会影响运行机；源码中的固定密码可能被复用。本报告不复述任何实际凭证，也未验证其当前有效性。建议分机 token，独立 0600 EnvironmentFile，状态目录 0700，源码只保留示例值；核查并轮换仍有效或复用的硬编码凭证。

### F11 CVM 创建成功后初始化失败，会留下没有本地记录的付费实例

**证据：R18，模拟云返回直接复现。** `tencent.ts:150–165` 已取得 instanceId 后，等待 IP/agent 仍可能异常；只有 ensure 完全成功才在 109 行写状态，finally 只停 bundle，不销毁 CVM。

影响：`ship builder down` 找不到未记录实例，持续计费。建议取得 ID 立即写持久状态，失败补偿销毁，并配置独立 TTL/云侧清理兜底；延长等待时间不能代替补偿。

### F12 build/push 失败后动态构建机不会释放

**证据：R21，直接复现。** `src/cli/pipeline.ts:93–126` 只在全部构建、push、saveLastBuild 成功后执行 release；源码解析、上传、构建、推送、轮询或本地写入失败都会绕过清理。

影响：失败构建持续产生费用，且错误现场未明确告知资源仍存活。建议把已取得实例的处理放入 finally，显式区分用户要求保留、远端任务仍在运行及已可安全回收。

### F13 不健康的旧构建机被覆盖，释放失败时也继续创建

**证据：R19，直接复现年轻但不健康实例；另有静态释放失败分支。** `tencent.ts:99–109` 只对超龄实例尝试释放；窗口内健康失败直接 create 并覆盖状态。超龄实例释放失败也 catch 后继续。

影响：遗留旧实例且丢失追踪信息。建议 reconcile 现有实例后再创建；清理失败保留旧记录并阻止覆盖，用资源账本记录全部实例。

### F14 云实例状态不区分账号、区域、配置，也无并发锁

**证据：静态确认。** `tencent.ts:30` 固定使用 `~/.ship/builder-state.json`，内容不记录账号或 region；ensure/release 用当前配置操作该记录。

影响：切换项目/账号/region 时复用错误机器或用错误 region 尝试删除；两个 CLI 同时创建会互相覆盖，某个 CLI 完成后可能释放另一个正在使用的实例。建议用账号/region/配置身份分区，增加锁、租约和引用关系。

### F15 运行 env 同时成为 Compose 控制环境，且秘密值会被插值

**证据：R25，真实 `docker compose config`。** `handlers-deploy.ts:54` 写 `.env`，`compose.ts:22` 将同文件设为 env_file，`docker.ts:83` 在该目录直接运行 compose。测试中 `COMPOSE_PROJECT_NAME=other-app` 改变实际项目名，虚构值 `x${UNDEFINED_AUDIT_VARIABLE}y` 变成 `xy`。

影响：运行变量意外控制项目/配置选择，可能影响其他服务；含 `$` 的密码被改变。建议秘密文件采用独立命名且避免默认 `.env` 控制入口，固定 Compose project/file 参数，明确 env_file 原样传递规则并验证支持版本。

### F16 镜像 tag 会碰撞，部署又优先相信本地同 tag 镜像

**证据：R07 与静态确认。** `handlers-build.ts:14–15` 时间精度到分钟，tarball 无 sha；同 app 同分钟重建、或同 SHA 不同 buildArgs 都可能同 tag。`handlers-deploy.ts:35` 本地存在镜像便跳过拉取；push digest 被记录但部署不用。

影响：registry 中镜像已更新，运行机仍启动旧镜像；current/previous 只存相同 tag，也失去回滚身份。建议唯一 build ID/内容摘要，部署绑定 registry digest，避免以可变 tag 和本地存在性判断版本。

### F17 job 持久化失败会导致整个 agent 进程退出

**证据：R23，真实子进程 exit 1。** `jobs.ts:47–49,67` 的异步 IIFE 没有外层 catch，初次 mkdir/persist 和最终 persist 都在 runner catch 之外。

影响：权限、磁盘满或文件系统错误造成 unhandled rejection，打断机器上其他任务。建议捕获完整 job 生命周期，持久化失败转成可观察故障，接受任务前确保账本可写，避免先返回成功接收再丢作业。

## 4. P2：功能、可靠性与验证缺口

| ID | 问题与证据 | 影响、建议 |
|---|---|---|
| F18 | **自托管 installUrl 与随机 agentToken 不一致。** `tencent.ts:115–120,164` 每次生成 token，但原样执行固定安装 URL，未把 token 传给脚本。R20 证实 user-data 不含返回给 CLI 的 token。 | 固定预渲染脚本安装出的 token 与 CLI 不一致，后续 API 401。建立明确 token 注入或返回协议，并用鉴权 API 验证就绪。 |
| F19 | **引导服务 15 分钟寿命短于整个创建/安装窗口。** `tencent.ts:127` bundle 15 分钟，IP 等待最长 15 分钟，agent 等待再 20 分钟；`bundle-server.ts:94` 无条件到点关闭。 | 分配 IP 或安装依赖较慢时，脚本/包下载可能遇到服务已关闭。按 bootstrap 完成信号控制寿命，或使用稳定的受保护制品源。 |
| F20 | **keepMinutes 不会到期自动销毁。** `tencent.ts:96–108` 仅下一次 ensure 检查年龄；`builder up`、`--keep-builder` 无外部清理定时器。普通成功 build 又立即 release，和模板“窗口内重复 build 复用”描述不一致。 | 用户停止调用后实例无限保留。明确保留语义，设置独立过期回收及可查询期限。这里是运行策略缺口，不声称已经发生额外账单。 |
| F21 | **默认安装链路未完整配置 registry 凭证。** `install.sh:128–129` 仅写 push 变量，不写 `SHIP_PULL_USER/PASSWORD`；动态创建配置没有标准 push 凭证绑定，需自行 preInstall 导出。 | 按默认教程安装后，私有仓库 push/pull 不完整；设置 pull 环境也不会被 installer 写入服务。增加受保护的凭证配置和安装后检查，不能只改 registry 地址。 |
| F22 | **重复安装不重启已运行 agent。** `install.sh:110–138` 替换程序和 unit 后只 `enable --now`。 | 已启动服务继续运行旧代码/旧 token；健康检查只验 HTTP 200，可能宣告新版本安装成功。安全停止/切换/重启，并验证版本、角色、鉴权与回退能力。 |
| F23 | **私有 git 认证链路不完整。** `source.ts:57–62` 首次 clone 使用 token 后移除 remote 凭证，缓存 fetch 不再注入；`types.ts:154` 的 CLI source 配置也没有 token，`pipeline.ts:50–55` 不传。R08 复现缓存 fetch 未使用 token。 | 新 builder 上 CLI 无标准私仓访问能力；直接 API 的首次成功不代表再次能 build。增加 credential 引用并统一 clone/fetch 认证，禁止持久明文 remote。 |
| F24 | **普通 git tag 被当远程分支。** `source.ts:25–28` 将 `v1.0.0` 变成 `origin/v1.0.0`；R09。 | tag 构建失败。分辨 commit、branch、tag，或先解析 refs/tags 与 refs/remotes；明确不支持的 ref 格式。 |
| F25 | **Dockerfile 路径定义与执行 cwd 不一致。** `types.ts:13` 规定相对 repo 根；`handlers-build.ts:23–27` 与 `docker.ts:39` 用 context 目录作为 cwd。R11 中 context=app、dockerfile=app/Dockerfile 实际找 app/app/Dockerfile。 | monorepo/子目录构建失败。将 repo-relative 路径解析成正确绝对路径，并做边界检查。 |
| F26 | **健康判断不能可靠证明目标容器正常。** `compose.ts:40` 将单端口 `3000` 当 host 3000，但真实 Compose 分配动态 host port（R05/R25）；`handlers-deploy.ts:81–85` 无端口就跳过全部验证（R04）；`server.ts:49–52` docker 可用性永久缓存。 | 错查其他服务、误回滚、崩溃容器仍成功，或 Docker 恢复后 agent 永久 503。解析实际映射，验证容器身份/状态/健康，对 Docker 探针设置刷新周期。 |
| F27 | **doctor 会为错误角色和错误 token 报全绿。** `cmd-doctor.ts:20–21` 只查公开 /health，不核对预期角色；动态 provider 甚至只判断 ok。R13/R20。 | “可交付”预检实际不能验证 API 可操作性。用鉴权只读端点校验角色、版本、Docker/Compose 和所需凭证。 |
| F28 | **CLI 稳定退出码和 JSON 错误契约不成立。** `main.ts:76–77` 除 CliError 外全部 exit 2；rollback 任务失败抛普通 Error；初次 agent 网络失败也是 exit 2。`--json` 错误走原始文本 stderr，无结构化错误 payload。 | AI/脚本分不清配置错误、网络失败和 job 失败。统一错误映射，覆盖 2/3/4/5 与 JSON 错误测试；F04 是其中影响更严重的独立恢复误报。 |
| F29 | **status 的未知 target 返回成功。** `cmd-status.ts:18,44` 过滤为空后 every 为 true；R12。 | 拼错生产目标会得到 exit 0 和空结果。与 deploy 一样拒绝未知 target，列出有效名称。 |
| F30 | **可选配置字段类型错误被静默丢弃。** `spec-schema.ts:45,48,72,81–86` 用 asString/asNumber 后跳过；R16 中 context 数字、hostPort 字符串直接消失。端口还允许小数 hostPort，拼错字段不报错。 | 用户以为限制和健康检查已配置，实际运行默认值。对“已提供但类型不对”的字段报错，对未知键明确策略，整数端口校验。 |
| F31 | **registry 带 https scheme 被接受，拼出非法 imageRef。** `config.ts:106` 不校验 Docker registry host 语法，现有 config.test.ts 甚至认可该值；`handlers-push.ts:12` 原样拼 ref；R15。 | 配置通过、买好机器后才构建/推送失败。将 registry host[:port] 与 URL 分开，拒绝 scheme/path/空白和非法 namespace。 |
| F32 | **缺失 env 文件仅警告，会继续使用旧 env 或延迟失败。** `pipeline.ts:148–155` 不阻断；agent 仍可能因 spec.envFile 引用已有 `.env`。只传 --env-file 且文件不存在时还可能完全省略 env。 | 本次发布悄悄带上上次变量；首次部署则 compose 才失败。要求明确“保留/替换/清空”操作，声明文件缺失提前失败。 |
| F33 | **状态文件损坏被当成首次部署。** `state.ts:26–28` 所有读取/解析异常都返回 empty；R17。 | 掩盖磁盘权限和 JSON 损坏，丢失回滚能力；status 给出空版本而不是故障。仅 ENOENT 表示初始状态，其他异常应阻断并提示恢复。 |
| F34 | **资源无背压与长期清理。** `jobs.ts:42,84–87` 无任务并发上限，tail 日志先整文件读取；jobs/sources/image 无保留策略；`body.ts:7,22` 单上传 300MB 并 Buffer.concat；`exec.ts:41–42` 未换行的 pending 文本无上限。 | 小内存 builder 可被正常大项目/并发任务耗尽内存或磁盘；压缩包上限也不限制解压后体积。流式上传/解压、并发配额、解压额度、日志轮转与 GC；执行输出 cap 应包含未换行缓冲区。 |
| F35 | **并发 push 共享 Docker 登录态，logout 未等待。** `docker.ts:52–68` 用默认 Docker config，finally `void exec(logout)`。 | 一个 job logout 可能撤掉另一个正在 push 的凭证，也会干扰机器已有登录状态。使用每 job 私有 DOCKER_CONFIG，并完成受控清理；pull 侧同样隔离。 |
| F36 | **失败后的日志获取没有超时。** `shared/http.ts:118–125` fetchLogTail 无 AbortSignal，`pipeline.ts:38,43` 在报告失败前等待它。 | 主任务已经超时，CLI 仍可能无限卡在取日志。设置短超时/大小上限，日志获取失败不能阻止原错误返回；声明的 CLI deadline 应覆盖全部等待阶段。 |
| F37 | **E2E 辅助脚本不能复现报告声称的修复。** `e2e/create-sg.mjs:21` 当前只有 Ingress，无 Egress，而历史报告 §4.2 说已补出站规则；`tat-run.mjs:6–7` 硬编码历史实例和 /tmp/e2e 文件；create-runtime 等失败也无自动清理。 | 新跑可能卡网、操作旧目标或留下付费资源。参数化、资源标签/所有权账本、完整清理流程，给出可执行的受限 E2E 入口。没有在云上重跑这些脚本。 |
| F38 | **测试和 CI 覆盖与交付风险不匹配。** 六个测试文件没有 deploy/rollback handler、pipeline、provider、bootstrap 的失败集成测试；现有 agent 测试允许 Docker 不可用即返回；仅有的 `.github/workflows/docs.yml` 未运行 shipkit 验证。 | 28/28 全绿无法拦住本报告核心缺陷。将 R01–R25 转成正式回归测试，增加真实 Compose 小型集成验证和 provider 故障注入，并接入 CI。 |

## 5. 历史“全链路通过”该怎样理解

`docs/e2e-report-2026-09-28.md` 支持的是：当时的一组临时 CVM、自建 registry、demo-web 和人工排障条件下，走通过成功发布与镜像切换。它没有证明：

- 自动失败回滚会恢复完整的环境/端口配置。报告自己写了“回滚后再部署”才回到 v1 环境。
- git 私仓与 tag 路径可用。记录主要走 tarball。
- 真实 ACR/TCR 凭证链路可用。报告明确保留此项。
- 并发发布、磁盘失败、断网、CVM 超时不会失管。
- 本轮当前代码和云资源状态与历史完全相同。本次没有实时核查云资源清理状态。

文档还把部分人工排障后的结果写成默认可复现流程。建议把正常主流程、人工前置配置、验证过的组合和未验证组合分开，并修正“env 永不经过 builder”“一键回滚”“keepMinutes 自动复用”等过强表述。

## 6. 建议的修复顺序与验收门槛

**大部分核心问题必须由当前工具链解决，不能等平台化。** 后续平台会调用这些能力；底层误部署、回滚不完整或遗留付费实例，会随着自动化和并发被放大。

当前目标是让单用户、受信任环境内的单机部署链路正确可靠，多目标选择有明确边界。38 项发现是审查清单，不能直接当成 38 个同等优先级的开发任务；P1/P2 表示风险等级，下面的阶段表示实施顺序。同一阶段内先处理影响正确性、恢复能力和秘密安全的问题。

### 6.1 当前工具链与平台化的责任边界

| 能力 | 当前工具链必须做到 | 后续平台化再做 |
|---|---|---|
| 发布身份 | 明确项目、目标、镜像 digest，拒绝跨项目误选 | 制品管理、版本检索、发布审批 |
| 部署与回滚 | 保存完整版本配置，失败恢复，准确报告恢复结果 | 灰度、流量切换、跨机器发布策略 |
| 并发控制 | 同一 app 部署/回滚互斥，共享构建目录隔离 | 分布式任务队列、多机调度、租户配额 |
| 云资源管理 | 每台机器可追踪，失败清理，保留有期限 | 资源池、成本中心、弹性调度 |
| 凭证安全 | 秘密不进源码包和日志，文件权限正确，安全传输 | RBAC、集中密钥管理、租户隔离 |
| 状态与诊断 | 真实状态、明确错误、可靠退出码和 JSON | 看板、告警、审计检索 |
| 验证 | 覆盖失败部署、回滚和资源清理 | 大规模兼容性、容量和长期稳定性测试 |

单用户工具同样需要保护凭证和拒绝误操作。当前可以采用本地文件、进程间锁、独立任务目录和受保护的配置快照，不必先引入数据库、消息队列或完整权限系统。单机限制也不能成为忽略两个 CLI 进程同时执行的理由。

### 6.2 第一阶段：让发布和恢复成为完整操作

**对应 F01–F05、F15–F17、F26、F32–F33。** 当前核心围绕 imageRef 工作，应调整为围绕明确的发布记录工作，记录项目、目标、镜像 digest、运行配置、受保护的 env 快照、发布前版本、执行阶段、健康检查和恢复结果。

建议采用“准备新版本 → 激活 → 验证 → 提交 current”的流程；失败则恢复上一份完整快照。同一 app 的部署和回滚串行执行，状态文件使用唯一临时文件并校验版本前置条件。进程重启后应能识别未完成发布并核对实际容器状态，不能把中断或损坏当成从未部署。

**验收门槛：** 跨项目默认镜像选择被拒绝；同 app 并发操作不会交叉覆盖；新版本失败后旧镜像、旧 env、旧端口和旧健康路径全部恢复；恢复失败明确报告；API 状态与实际容器一致；相同 tag 更新不会混淆发布身份。

### 6.3 第二阶段：闭合动态构建机生命周期

**对应 F11–F14、F18–F20。** 取得实例 ID 就立即持久化，不能等整台机器就绪。所有异常路径必须留下可追踪状态，按明确策略执行清理或保留；旧实例释放失败时不能覆盖其记录。资源记录按账号、region 和配置身份隔离，增加并发锁或租约。

到期回收必须独立于下一次 CLI 调用。CLI 超时后也要区分远端任务仍在运行、任务已终止和用户显式要求保留，避免简单 finally 销毁正在使用的机器。释放结果需要确认或持续追踪，不能仅以 API 接受请求视为资源已不存在。

**验收门槛：** 对 RunInstances 返回后的每个异常点注入故障，每个已创建实例都有记录和最终处置；CLI 中断不丢资源；并发 CLI 不误释放对方机器；过期实例在无人继续调用 CLI 时仍能回收。

如果暂时不投入这部分，可先将静态构建机作为稳定路径，动态模式保持实验性并收紧使用范围。此时必须明确动态模式尚未验收，不能将资源清理缺陷推迟给未来平台后仍按生产能力交付。

### 6.4 第三阶段：补齐安全边界和操作契约

**对应 F06–F10、F21–F25、F27–F31、F34–F36。** 建立源码打包清单，排除运行秘密和控制器配置；校验 source 路径；移除凭证 URL 日志；按任务隔离 Docker 登录态；完善私仓认证、安装升级和凭证文件保护。F15 的运行 env 与 Compose 控制环境分离在第一阶段完成。

统一配置校验、doctor/status、退出码和 JSON 错误结构，让调用方能区分配置错误、网络故障、任务失败、恢复成功与恢复失败。设置任务并发、日志、上传及解压额度和清理策略，先保证单机资源可控，再考虑平台级配额系统。

**验收门槛：** 源码包与日志没有测试秘密；非法 source.id 被拒绝；不同机器的 token 隔离；安装后的角色、版本和鉴权可验证；错误配置提前失败；诊断和返回码如实反映状态；超时后的错误报告不再卡住。

阶段编号不表示安全修复可以拖到生产使用之后。第一至第三阶段适用范围内的阻断项，必须在生产使用前完成；路径校验、脱敏和打包排除等独立修复可以提前实施。

### 6.5 第四阶段：以故障测试建立交付门槛

**对应 F37–F38，并回归 F01–F36。** 保留现有 28 个测试，将本次 R01–R25 的缺陷场景转为正式回归测试。每项修复同步补测试，本阶段集中完成 CI、真实 Compose 集成和受控 E2E，不把测试全部留到最后。

重点验证：误选项目能否阻止；新版本失败后完整旧版本能否恢复；恢复失败是否如实报告；并发操作是否互相干扰；云创建任何一步失败后实例是否仍可追踪并最终回收。真实 E2E 应使用独立测试资源、明确的资源所有权和清理流程，分别验证静态路径及计划支持的动态路径。

**验收门槛：** CI 能拦住已发现的核心缺陷；真实测试环境完成一次成功发布、一次故障发布及恢复；镜像、配置、API 状态与实际访问结果相符；测试资源处置有证据。云端或付费验证仍需单独授权，本修复建议不构成执行授权。

### 6.6 可以推迟的内容与当前交付结论

可以推迟灰度与审批、多租户、资源池、分布式调度、复杂看板和集中治理。发布正确性、完整回滚、安全边界、资源清理及真实状态属于工具链自身的基本责任。应先把 shipkit 做成可信的小工具，再以稳定 API 和发布记录供平台集成。

本节是修复方案及边界说明，**不代表任何缺陷已经修复**。本轮业务实现保持不变，原有复现结果和源码快照仍然有效。

验收应分三层记录：编译/单测通过、真实部署/恢复证据、最终业务访问确认。审查无法保证穷尽所有未知问题；本报告给出了当前完整代码范围内发现、核实并去重后的问题清单，未验证的外部行为已明确标注。
