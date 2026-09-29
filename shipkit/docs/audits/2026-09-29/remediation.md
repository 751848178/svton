# 审查处置报告（F01–F38 → 修复/决策映射）

处置日期：2026-09-29 · 版本：0.1.0 → **0.2.0** · 验证：`pnpm build` + `pnpm test` **47/47 全绿**（新增 19 个回归测试，覆盖下述 ✅ 项的核心缺陷场景）

对照原审查：[review.md](review.md)。状态图例：✅ 已修复并有测试/实现 · 🔧 已修复（静态实现，无专项测试）· ⚠️ 部分落地（剩余项有明确决策）· 📄 文档/契约修正

**2026-09-29 独立复审补充：** 最新本地测试为 50/50 通过，但 F09/F20/F34 仍未验收通过；复审确认 10 项发现（6 P1、4 P2），并完成 10 个隔离缺陷场景复现。详见 [修复后复审报告](re-audit.md) 和 [复现证据](re-audit-evidence.json)。本轮聚焦这三项及关联链路，不代表其余 ✅ 项均已独立复验；以下三行已按本轮证据校正。

## P1（17 项）

| ID | 状态 | 处置 |
|---|---|---|
| F01 跨项目误部署 | ✅ | last-build 按 app 分文件（`~/.ship/last-build-<app>.json`，0600）；legacy 全局记录仅当 `record.app === app` 才可解析。测试：local-state.test |
| F02 回滚不完整 | ✅ | **发布快照模型**：每次 deploy 落 `releases/<id>/{meta.json(spec+image), env(0600)}`；回滚/自动恢复整体重激活上一快照（镜像+env+ports+健康路径）。测试：deploy-transaction.test |
| F03 启动失败无恢复 | ✅ | `attempt()` 统一包裹 activate+verify，compose pull/up 任何异常都进入恢复流程。测试同上 |
| F04 恢复误报 | ✅ | 恢复结果结构化 `{attempted, succeeded, target}`；退出码 5=恢复成功、6=恢复失败、4=未尝试恢复；首次部署失败不再是 5。测试 + main.ts 映射 |
| F05 并发竞态 | ✅ | `withAppLock` 按应用串行 deploy/rollback；所有原子写使用 `pid-时间-随机` 唯一临时名（atomic.ts）。测试：5 并发 deploy 无损坏 |
| F06 --from-dir 泄密 | ✅ | 打包排除 `.git/node_modules/.env/deploy.env/*.pem/ship.config.*` + spec.envFile；超 500MB 拒绝。README 承诺自此真实成立 |
| F07 source.id 穿越 | ✅ | 双重防护：路由层强制 UUID 格式 + source 层 realpath 必须落在 sources 根内。测试：source.test |
| F08 git token 入日志 | ✅ | 错误消息统一 `REDACT`（`//user@` → `//***@`）；clone 失败清理半成品目录。测试：token 不出现在异常文本 |
| F09 公网 HTTP 明文 | ⚠️ | 已新增安装参数 AGENT_BIND，支持固定机反代前的监听配置；动态 API 和内置 bundle 仍固定公网 HTTP，未提供实际 TLS/隧道验收证据。复审 RA06：目前属于接入准备，尚未完成安全链路。 |
| F10 凭证落盘权限 | ✅ | agent 凭证移入 `/etc/shipkit/agent.env`（0600 EnvironmentFile）；builder-state 目录 0700/文件 0600；serve-bundle 为 runtime/builder 发放**不同 token**；last-build 0600 |
| F11 孤儿付费实例 | ✅ | RunInstances 返回即写 `status:'provisioning'` 状态（先于等 IP/健康）；后续失败**补偿销毁**，补偿失败则保留记录并在错误中指明 `ship builder down` |
| F12 失败不释放 | ✅ | pipeline 改 try/finally：build/push/save 任一失败也释放动态构建机（`--keep-builder` 除外），释放失败带指引告警 |
| F13 不健康记录被覆盖 | ✅ | ensure() 先 reconcile：已有记录必须先成功释放并清除，才允许创建新实例；释放失败直接抛错不覆盖 |
| F14 状态不分身份/无锁 | ✅ | 状态按 `secretId+region+zone+type+vpc+subnet` 指纹分文件（`~/.ship/builders/b-<fp>.json`）；mkdir 锁 + 10 分钟陈锁自动破除 |
| F15 env 兼任控制面 | ✅ | 服务 env 改名 `runtime.env`；compose 显式 `-p ship-<app>` + `--env-file compose.env`（空文件）钉死控制面；`$` 插值不再触及业务 env |
| F16 tag 碰撞+本地优先 | ✅ | tag 升为 `sha-秒级时间戳-随机4`；部署统一 **digest 锚定**（`ref@sha256:...`），digest 引用本地存在才跳过 pull，可变 tag 必须先打 registry |
| F17 job 崩 agent | ✅ | 任务全生命周期（含持久化）包裹 catch；persist 失败降级为 console.error + 内存态；并发上限 `SHIP_AGENT_MAX_JOBS`(默认2) + 队列排队 |

## P2（21 项）

| ID | 状态 | 处置 |
|---|---|---|
| F18 installUrl token 不一致 | ✅ | 配置契约：`installUrl` 必须伴随 `installToken`（config 校验强制）；provider 使用 installToken 而非随机值。测试：config.test |
| F19 bundle 15 分钟太短 | ✅ | 动态创建路径 bundle 寿命提到 50 分钟（覆盖 IP 等待 15' + 安装 20'）；serve-bundle 默认 45 分钟 |
| F20 keepMinutes 不回收 | ⚠️ | 已在 RunInstances 提交 ActionTimer，增加 maxLifetimeMinutes，且 doctor 已移除销毁清扫。复审 RA03–RA05/RA07：剩余寿命准入不足、活跃机器可能被替换、锁在新目录下卡住及错误判陈旧、定时任务查询用了不存在的 SDK 方法。不能标为生命周期验收完成。 |
| F21 pull 凭证不落地 | ✅ | install.sh 将 SHIP_PULL_USER/PASSWORD 一并写入 0600 EnvironmentFile |
| F22 重装不重启 | ✅ | `enable` + `restart` 替代 `enable --now` |
| F23 私仓 git 认证 | ✅ | config `source.token` 全链路透传；缓存 clone 的 fetch 用一次性 URL 参数注入认证（不落 .git/config） |
| F24 tag 被当分支 | ✅ | resolveRef：commit → origin/分支 → refs/tags 逐级探测，未命中报错（不再盲拼 origin/） |
| F25 dockerfile 路径 | ✅ | 统一按仓库根解析为绝对路径传 `-f`（context 仍是 spec.context） |
| F26 健康验证语义 | ✅ | 动态端口经 `docker compose port` 查真实映射；无法解析时结果显式 `verification:'skipped'`（不再静默成功）；docker 探测 60s TTL 自动恢复 |
| F27 doctor 假绿 | ✅ | doctor 改为**鉴权**调 `/api/status`，校验 role 与 docker；动态 builder 的 status() 同样鉴权化（tencent.ts） |
| F28 退出码/JSON 契约 | ✅ | main.ts 统一映射：ApiError→3、Spec/Config→2、CliError→自带码；`--json` 输出 `{ok:false,error:{code,exitCode,message}}` 到 stdout；rollback 失败也走 CliError |
| F29 status 未知目标 | ✅ | 空过滤即报错并列出可用目标（exit 2） |
| F30 类型错误静默丢弃 | ✅ | 字段存在但类型不对 → 报错；未知字段 → 报错；hostPort 必须整数。测试：spec-schema.test 扩展 |
| F31 registry scheme 混入 | ✅ | registry.url 强制 bare host[:port]，namespace 字符集校验。测试翻转原断言 |
| F32 env 缺失静默 | ✅ | `--env-file` 不存在 / 声明的 spec.envFile 缺失 → 硬失败；`--keep-env` 显式选择复用服务端 env |
| F33 状态损坏当首部署 | ✅ | 仅 ENOENT 视为初始；损坏/权限错误上抛并提示恢复路径。测试：release-store.test |
| F34 背压与清理 | ⚠️ | 已有并发/流式上传等措施，并新增 ship gc 预览与执行，按快照保护引用、不使用全局 prune。复审 RA01/RA02/RA08–RA10：损坏快照会丢保护、GC 与新部署竞态、旧镜像随短历史丢失清理入口、Docker 错误被当不存在、同步执行超出 CLI 超时。清理安全性及可观察性尚未验收通过。 |
| F35 docker 登录态共享 | 🔧 | push/pull 登录均使用每任务独立 `DOCKER_CONFIG` 临时目录，受控 logout+清理；不再触碰机器默认 `~/.docker` |
| F36 日志拉取无超时 | ✅ | fetchLogTail 8s AbortSignal + 200KB 截断 |
| F37 E2E 脚本失修 | ✅ | create-sg.mjs 补 Egress（与报告 §4.2 对齐）；lib.mjs 密码改 `SHIP_E2E_PASSWORD` 环境变量（无默认值即报错） |
| F38 测试缺口 | ✅ | 新增 deploy-transaction（mock docker/health）、release-store、local-state、source 安全、spec/config 严格化——共 19 个回归测试；测试脚本启用 module-mocks。CI 接入属仓库层事项，未在包内处理 |

## 明确的遗留决策：建议方案与验收（待实施）

2026-09-29 补充：**TLS 用标准部署方案解决；回收接入云端定时销毁；镜像清理由 shipkit 按发布记录管理。三项都属于当前工具链的责任，不必等 Devpilot 平台。** 以下保留建议方案及验收约束，当前已有部分代码实现，实际完成度以文首复审说明和对应 F 项为准；尚未通过真实环境验收。本次复审只更新审计材料，不代表已执行云端操作、网络调整或镜像清理。

### F09：固定运行机用 Caddy，动态构建机走受保护的内部通道

- **固定运行机**：配置域名，由 Caddy 提供 HTTPS，反向代理到仅监听本机的 agent；关闭外部对 7410 的直接访问，继续使用每机独立的 Bearer token。Caddy 支持自动申请和续期证书，证书校验不得关闭。[Caddy 官方说明](https://caddyserver.com/docs/automatic-https)
- **动态构建机**：优先通过 VPC 内网和固定 HTTPS 控制入口访问；控制器仍在笔记本时，可通过加密隧道进入。限制内部入口来源和权限，不能把任意公网 HTTP 地址当成可信内网。避免为每台临时机器单独维护公网域名和证书。
- **引导分发**：安装脚本和 agent 包也必须通过 HTTPS 或已验证的加密通道获取；不能只保护 API，继续从公网 HTTP 下载 root 安装脚本。
- **暂不默认采用自签 CA**：自行维护证书分发、信任和轮换会增加当前工具链的运维负担；仅在有既定内部 PKI 的环境下采用。

当前实现的边界是：CLI 能访问 HTTPS URL，agent 使用 Node HTTP server；动态 provider 仍生成 `http://<公网IP>:7410`。固定目标主要通过部署配置解决，动态路径还需要修改地址发现、引导分发和连接方式。“部署反代后代码零改动”不适用于整个动态链路。

实施时需落实可用域名、DNS/证书验证条件，以及控制器到动态构建机的实际网络路径。这些是环境配置输入，不需要先开发平台权限系统。

**验收：** 外部无法直连 agent 明文端口；API、安装脚本及包下载的公网链路不再明文传输；CLI 正常验证证书与 token；证书续期有验证路径；动态创建后能通过选定安全通道完成构建和推送。

### F20：云端定时销毁兜底，本地清扫辅助核对

腾讯云 CVM 的 `RunInstances` 支持 `ActionTimer`，可在创建实例时同时指定定时销毁；因此无需先建立常驻平台才能防止机器无限计费。定时器动作使用 `TerminateInstances`，时间采用 UTC ISO8601，并满足接口要求；实际账号和机型的支持情况需在受控验证中确认。[腾讯云 ActionTimer 文档](https://cloud.tencent.com/document/api/213/15753)

| 时间 | 建议语义 |
|---|---|
| 空闲保留时间 | 从任务结束进入空闲开始计算，例如保留 30 分钟，便于复用；与当前按创建时间判断的实现分开 |
| 最长存活时间 | 由云端执行的最终销毁期限，控制器退出后仍有效；不能只写在本地状态文件里 |

实施要求：

1. 创建请求同时提交云端销毁期限，并查询确认定时任务存在且目标、时间正确；设置或确认失败时阻止进入可用状态，保留资源记录并按失败补偿流程处理。
2. 最长期限覆盖安装、上传、构建、推送及缓冲时间，不能简单沿用 `keepMinutes + 60分钟`。在配置中明确最大任务预算和最终保留上限。
3. 接受新任务前检查剩余寿命；不足时先成功延长并核实云端期限，或换新实例，不让正常任务跨过销毁时刻。
4. `--keep-builder` 可以保留调试现场，但默认仍受最终期限约束。不能通过持续心跳无限延长；超出预设上限需要显式调整保留策略。
5. 本地记录、补偿和清扫继续负责核对与恢复，但 `expireAt` 只有配合实际执行机制才是有效限制。空闲到期及时回收可由独立调度后续优化，云端最长存活期限先作为兜底。
6. **把销毁清扫移出 doctor**：诊断命令保持只读；清理通过明确的管理命令或受控生命周期执行，避免一次自检意外销毁机器。

平台化后可以接管空闲调度、资源池和集中账本，云端销毁仍保留为兜底。此次查阅文档未执行实际云 API，不能据此宣称当前账号的定时销毁已经验证。

**验收：** 创建后能查询到正确的云端销毁任务；关闭控制器、不再调用 CLI 后，实例仍按期限销毁并确认资源处置；延长失败不会继续接长任务；并发使用不误回收；doctor 不产生云资源写操作。

### F34：按发布记录定向清理，不采用全局 prune 定时任务

撤回将 `docker system prune -af --filter until=168h` 配为运行机默认 cron 的建议。该命令会清理符合条件的停止容器、未使用镜像、网络和构建缓存，Docker 不理解 shipkit 发布快照中的回滚引用。七天过滤不能保护较老的上一版本，也不能保证只影响 shipkit。[Docker 官方说明](https://docs.docker.com/reference/cli/docker/system/prune/)

按机器职责处理：

| 机器 | 建议策略 |
|---|---|
| 临时构建机 | 主要依靠实例销毁回收磁盘；先确保单次任务空间足够，不必先做复杂镜像 GC |
| 长期构建机 | 优先限制构建缓存容量，在受控时机清理，避开进行中任务和其他工具共享的缓存 |
| 运行机 | 根据发布账本及任务状态构造镜像保护集合，只删除 shipkit 管理且不在保护集合中的镜像 |

运行机保护集合至少包含：所有 app 的当前版本、上一版本、明确保留且承诺可回滚的历史版本，以及部署/回滚中的镜像。以镜像 digest/ID 核对引用，不能只比较 tag；多个应用共用镜像时必须合并计算。

建议提供先预览、后执行的 GC 命令，列出候选对象、所属应用、删除原因和预计可回收空间。执行前加锁并重新核对保护集合，避免预览后新发布引用了待删镜像。无法确认归属或读取状态时保留对象并报告，禁止强制删除被容器引用的镜像。后续可由 systemd timer 定期调用；清理策略属于工具链，定时触发交给操作系统。

默认不删除其他应用的镜像、容器、网络或数据卷；磁盘不足也不能绕过回滚保护。registry 侧的历史镜像保留策略需与发布保留期限协调，不能把“以后可以重新拉取”当成已验证的恢复保障。

**验收：** 预览与执行范围可追踪；GC 后当前服务正常，上一版本可在禁止重新拉取的条件下完成回滚；进行中任务不受影响；其他应用资源不变；状态损坏时清理安全退出并报告。

## 与审查 §6 阶段划分的对应

- 第一阶段（发布事务）→ F01–F05/F15–F17/F26/F32/F33 ✅
- 第二阶段（构建机生命周期）→ F11–F14/F18–F20 ✅/⚠️
- 第三阶段（安全与契约）→ F06–F10/F21–F25/F27–F31/F34–F36 ✅/🔧/⚠️
- 第四阶段（故障测试）→ F37/F38 + 全部新增回归测试 ✅（云端故障注入复测待下次真机窗口）

## 实施记录（2026-09-29 第二轮：三项决策落地）

按用户补充的决策文档执行，测试 47 → **50/50 全绿**：

**F09**（🔧 环境就绪即收口）：`install.sh` 支持 `AGENT_BIND=127.0.0.1`（反代部署时 agent 只监听本机）；README 固化 Caddy 自动 HTTPS 方案与动态机构网/隧道原则；自签 CA 不采用。动态链路的地址发现/引导分发 HTTPS 化依赖域名与网络路径等环境输入，到位后实施——"零改动"表述已按决策修正。

**F20**（✅ 代码完成，ActionTimer 账号可用性待真机确认）：`RunInstances` 携带 `ActionTimer{TerminateInstances, UTC ISO8601}`，期限 = `maxLifetimeMinutes`（新配置项，30-1440，默认 max(keepMinutes+90, 120)），创建后尽力校验定时任务并在日志中报告；复用判据改为 **lastUsedAt 空闲窗口** + **剩余寿命 > 30 分钟任务预算**；**doctor 已移除清扫**（诊断只读，清扫只在 build/builder 生命周期命令中执行）。单测：配置边界。

**F34**（✅）：新增 `ship gc [--execute]`（默认预览）→ agent `POST /api/gc`：保护集 = 全部保留发布快照的镜像引用（当前/上一/可回滚目标），候选 = 仅存在于 history 的陈旧引用；执行前重核保护集、逐个 `docker rmi`（不强制）、进行中 deploy/rollback 直接 409 拒绝；不做全局 prune，不触碰非 shipkit 资源。单测：保护集与候选计算。

---

# RA01–RA10 处置报告（第三轮，2026-09-29）

复审依据：[re-audit.md](re-audit.md)（6 P1 + 4 P2）。全部为**代码修复 + 本地回归验证**；不涉及真实云 API、真实镜像删除或生产网络变更。验证：build exit 0 · typecheck exit 0 · **81/81 测试全绿**（50 存量 + 31 新增，覆盖复审全部 10 个场景）。源码行数上限合规。

## 逐项处置

### RA01 [P1] GC 吞掉损坏快照 → ✅ 代码修复 + 本地验证
`gc.ts` 保护集加载改为遇错阻断：apps 根/任何应用的 `state.json`、`releases/` 目录、任一保留快照的 meta 不可读、损坏或校验失败，整轮 GC 停止并报告（含损坏文件路径与处置提示）；current/previous 必须能解析为完整快照——“不知道是否被引用”一律视为被引用。全新机器（apps 根不存在）视为空而非损坏。
验证：`gc-safety.test` ×3（损坏 previous meta 阻断 plan；current meta 缺失阻断 execute 且 docker 零调用；execute 前置校验）。

### RA02 [P1] GC 与部署不互斥 → ✅ 代码修复 + 本地验证
新增机器级读写锁（`app-lock.ts`）：deploy/rollback 为读者（相互并发），GC 执行为唯一写者；GC 的**计算→复核→删除全程**持有写锁，期间任何 deploy/rollback 无法开始（反之 GC 等待在途部署清零后才进入）。不再依赖入口一次性 busy 检查。`both` 角色下 builder 域镜像（`shipbuild/*`）永不进入 GC 候选。
验证：`op-locks.test` ×3（GC 等部署、部署等 GC、部署间并发）+ `gc-safety.test` 交错保护（preview→execute 之间新发布的镜像被跳过）。

### RA03 [P1] 30 分钟硬编码预算 → ✅ 代码修复 + 本地验证
准入改为接收**真实任务预算**：pipeline 传入 `build超时 + push超时 + 15min`；`admissionDecision()` 要求云端剩余寿命 ≥ 任务预算+10min 缓冲，不足一律换机（不依赖计费兜底）。新实例寿命 = max(keep+90, 120, 任务预算+35min 供给)；显式 `maxLifetimeMinutes` 覆盖不了预算+供给时**创建前直接拒绝**（配置下限提到 60）。
验证：`tencent-lifecycle.test`（31min 余量拒绝 60min 任务、边界放行）+ `tencent-provision.test`（余量不足换机、显式配置不足预拒绝）。

### RA04 [P1] 工作中的构建机可被销毁 → ✅ 代码修复 + 本地验证
- **任务租约**：build/push 经 `provider.runExclusive()` 在账本上登记带 TTL 的租约（60s 续约）；他人持有效租约（或租约过期但持有进程存活）时 `ensure/release` 一律拒绝触碰该实例。
- **空闲锚点**：`lastUsedAt` 改为**任务结束时**由 `releaseLease()` 写入，复用不再刷新。
- **锁恢复**：锁目录写入 owner.pid + 30s 心跳续期；只有“心跳过期 **且** 持有进程已死”才可破锁；存活但沉默的持有者等待至 deadline。锁竞争仅 EEXIST 分支，全部重试受总 deadline 约束。
验证：`builder-state.test` ×6（新根目录不卡死、活跃超龄锁不破、死亡所有者恢复、活/死持有者租约判定、release 锚定任务结束）+ `tencent-provision.test`（活跃租约阻断 ensure 且零云调用）。

### RA05 [P1] 全新账本目录死循环 → ✅ 代码修复 + 本地验证
`withLock` 先以 0700 递归创建账本父目录；仅 `EEXIST` 进入竞争；ENOENT/EACCES 等直接报错；所有重试路径（含破锁重试）受 deadline 约束。
验证：`builder-state.test` 首条（全新 HOME 下加锁成功）——即复审 A09 场景。

### RA06 [P1] TLS 仍是接入准备 → 🔧 代码+模板完成 / 真实环境**未验收**
- 动态 provider：`agentScheme`/`agentPort`（`https://<ip>:<port>` 不再硬编码 http）、`bundleBaseUrl`（引导包经 HTTPS 反代分发，本地监听不变）——三个字段均入配置校验与示例。
- 固定机：`bootstrap/caddy/Caddyfile.tmpl`（反代到仅监听 127.0.0.1 的 agent、320MB body 上限、明确禁止关闭证书校验）+ 部署 README；`install.sh` 的 `AGENT_BIND` 联动安全组指引。
- 本地验证：配置校验单测 + provision 测试断言 https URL 生成；模板为纯文本占位（无可本地运行的真实 TLS）。
- **待真实环境验收**：域名/DNS/证书签发、安全组收紧、动态链路经加密通道的实际构建——无环境输入前不虚构，F09 维持未验收。

### RA07 [P2] 定时器查询用错 SDK 方法 → ✅ 代码修复 + 本地验证
改用真实存在的 `DescribeInstancesActionTimer`（已在安装的 SDK 4.1.316 上验证方法存在），作为**必需接口方法**（无可选调用、无 unknown 强转）；`verifyActionTimer()` 严格校验实例归属、动作=TerminateInstances、期限与期望偏差 ≤3min；查询异常、空集、失配一律视为供给失败 → 走补偿销毁并清除账本，绝不宣告 ready。账本仍先于任何外部确认落盘。
验证：`tencent-lifecycle.test` ×4（空集/他机/错动作/时间偏差/不可解析）+ `tencent-provision.test`（匹配→ready 且真正查询过、空集→补偿、查询抛错→补偿）。

### RA08 [P2] 候选只看 20 条 history → ✅ 代码修复 + 本地验证
新增持久**镜像账本** `image-ledger.json`（0600、原子写）：每次 deploy/rollback 成功后记录；GC 候选以账本为准（history 仅作补充）；条目仅在“确认删除”或“验证不存在”后移除。账本损坏：GC 阻断报告；记录路径归档重置（未知镜像永不成为候选——安全方向）。
验证：`gc-safety.test`（35+ 次发布后旧镜像全部可发现；确认缺失后账本移除）。

### RA09 [P2] inspect 错误全当不存在 → ✅ 代码修复 + 本地验证
分类规则：仅 stderr 明确命中 not-found 语义才计 `missing`；daemon 不可达、权限错误、超时（`timedOut`）一律 `failed` 并保留原始错误文本；不再以 failed 数量之外的方式“假成功”。
验证：`gc-safety.test` ×3（daemon 断连、not-found、超时）。

### RA10 [P2] 长同步 GC 请求 → ✅ 代码修复 + 本地验证
GC 执行改为**持久 job 模型**：`POST /api/gc {dryRun:false}` 立即返回 202+jobId，执行入任务队列（并发上限、日志落盘、可轮询可查日志）；CLI `ship gc --execute` 轮询至终态（15min 上限），失败附日志尾部，退出码 4。预览保持同步（读者锁下计算）。客户端超时中断不再影响服务端结果可追踪性。
验证：`agent-server.test` 新增（preview 200 同步、execute 202 jobId、job 终态 succeeded）。

## 状态汇总与剩余限制

| 类别 | 结论 |
|---|---|
| 代码修复 | RA01–RA05、RA07–RA10 全部完成；RA06 完成代码与模板 |
| 本地验证 | 81/81 回归测试（含复审 10 场景全部转正）；build/typecheck/bash -n 通过 |
| 真实环境验收（未做，需授权/输入） | ① RA06：真实域名+证书+安全组收紧+动态链路加密通道的实机构建；② RA07/RA03 云端路径：真实 RunInstances 后 `DescribeInstancesActionTimer` 的实际响应形态与 ActionTime 时区/格式、ActionTimer 到期真实销毁；③ RA10：大量镜像机器上的长 GC 实测 |

云端行为以真实验收为准——本地用模拟云客户端覆盖了协议与故障分支，不替代真实环境结论。

---

# 第四轮处置（acceptance-next-steps §A/§B/§C，2026-09-29）

依据：[acceptance-next-steps.md](acceptance-next-steps.md)。验证：build exit 0 · typecheck exit 0 · **90/90 测试全绿**（81 + 9 新增；其中含一段真实执行 >20 秒的长 GC 集成）。未触碰云资源、真实镜像、生产网络。

## A. 定时器响应契约修复（✅ 代码修复 + 本地验证）

**契约依据（已安装 SDK 的官方声明，非二手推测）**：`cvm_models.d.ts` `DescribeInstancesActionTimerResponse.ActionTimers?: Array<ActionTimer>`；`ActionTimer{TimerAction, ActionTime(UTC ISO8601), Status: UNDO|DOING|DONE, InstanceId, ActionTimerId, Externals}`。前一轮自定义 `ActionTimerSet` 字段与真实响应不符——真实成功响应会被当成空结果并触发补偿销毁，已确认并修复。

- `ActionTimerView = Pick<DescribeInstancesActionTimerResponse, 'ActionTimers'>`——直接由官方类型派生，手写镜像不允许漂移；类型通过 `tencentcloud-sdk-nodejs-cvm/tencentcloud/services/cvm/v20170312/cvm_models.js` 深导入解析。
- 校验新增 **Status 门槛**：仅 `UNDO`（已排定未执行）放行；`DOING`（正在销毁）/`DONE`（已销毁）拒绝准入。
- 测试样例全部改为官方形状并用 `satisfies ActionTimerView` 约束，新增**负向类型锁**：写 `ActionTimerSet`（旧错误字段）在编译期即报错（`@ts-expect-error`），实现与模拟数据无法再一起写错。
- 覆盖样例：成功（含 RequestId 的完整响应）、字段缺失/空数组/undefined、他人实例、错误动作、期限偏差、时间不可解析、DOING/DONE 状态——共 9 例；provider 集成维持"正确响应→ready 且零补偿、错误响应→补偿销毁+账本清除"断言，fake 同步改为官方形状。
- 定点复核（与 acceptance 文档 §1 完全同构）：`{ActionTimers:[...]}`→ok；`{ActionTimerSet:[...]}`→fail；`Status:DONE`→fail。

## B. 隔离长 GC 验证（✅ 本地验证，含真实 >20s 执行）

新增可注入 Docker 执行缝 `gc-docker.ts`（生产调真 `docker`；测试经 module-mock 注入慢/坏 daemon，**全程零真实镜像操作**）。新集成测试 `gc-integration.test.ts`（真实本地 HTTP agent + 真实任务队列/日志，仅 Docker 与 compose/health 被替身）：

1. **跨超时窗口**：10 候选 × 2.6s inspect ≈ 26s 执行（> 20s 请求窗口）；提交后 **<3s** 拿到 jobId；轮询至终态，10 个 removed 齐全，日志尾部可查。
2. **客户端断连**：拿到响应头后立即 `AbortController.abort()`（响应体不读=客户端走人）；服务端任务照常完成，jobId+日志在新连接上可查（未涉及 agent 重启——与验收要求一致，两者不混同）。
3. **与部署交错**：GC 执行期间提交 deploy（202 返回、进入队列）——部署的 compose up **严格晚于 GC 最后一次 rmi**（时间戳断言）；GC 期间发布的新镜像不出现在删除集合。
4. **Docker 故障**：daemon 断连 → job 诚实返回 `failed:[...]`、removed/missing 皆空，无假成功。
5. 大账本（36 条、瞬时）与长执行（10 条、>20s）分别构造，未用"数据多"替代"跨窗口"。

## C. TLS 可部署性核对（🔧 代码/模板补齐；真实环境未验收）

逐链路核对结论：scheme 已可配、bundle 外部 URL 已可配（`bundleBaseUrl`），但**动态 endpoint 缺"命名入口"表达**——公网 CA 不为裸 IP 签发证书，`https://<IP>` 无法通过证书身份校验，此前仅有 scheme 开关确实不构成可部署链路。本轮补齐：

- 新增 `tencent.agentHost`（域名/隧道/VIP 命名入口）：agent URL = `scheme://agentHost:agentPort`，不再强制拼 IP；**配置校验强制 `agentScheme: https` 时必须提供 `agentHost`**（提前拒绝不可能通过证书校验的配置）；host 格式校验（裸 host，拒绝带 scheme/空白）。
- 新增 `bootstrap/caddy/Caddyfile.bundle.tmpl`：分发域 `https://__SHIP_HOST__/__BUNDLE_TOKEN__/* → 127.0.0.1:7411`，与 `bundleBaseUrl` 闭合"安装脚本+agent 包全程 HTTPS"链路；与固定机模板一致，证书校验禁关、token 路径兼作访问门槛。
- 固定机侧既有 `Caddyfile.tmpl`（反代到 `AGENT_BIND=127.0.0.1` 的 agent）+ 部署 README；至此 **固定机 API 入口、固定机引导（同域下发或 bundleBaseUrl）、动态 agent 入口（agentHost）、动态引导（bundleBaseUrl）四条链路均有配置表达与校验**，证书身份均落在命名入口上。
- 测试：https 无 host 拒绝、host 格式校验、provider 生成 `https://builder.internal.example.com:8443` URL。

## 本轮后状态

| 类别 | 结论 |
|---|---|
| 代码修复 | A 完成（官方契约+Status 门槛+负向类型锁）；C 补齐 agentHost 与分发模板 |
| 本地验证 | 90/90（新增 9：A×7、B×3 集成含真实 >20s、C×2；另有定点复核）|
| 仍需真实环境验收 | ①TLS 实机（测试机+域名+DNS+安全组/反代操作范围）；②云端到期销毁（专用临时实例授权+地域/规格/费用上限）；③专用 Docker 环境真实删除与回滚验证——输入清单见 acceptance-next-steps.md §3 |

云上行为仍以真实验收为准；本地证据不替代。

---

# 第五轮收口（2026-09-29，用户指定三项）

验证：build/typecheck exit 0 · **92/92 全绿**（+2：缺失 Status 拒绝、URL 构造回归；另修正 2 处测试断言）。未触碰任何真实资源。

1. **定时器 Status 严格化**：`Status !== 'UNDO'` 即拒绝——**缺失状态不再被信任**（原实现 `!== undefined &&` 放过缺失）。新增样例：无 Status 的"完美"定时器被拒（reason 明示 missing）。
2. **agentHost 禁止端口**：配置校验拒绝 `host:port` / URL / 空白（端口唯一来源是 `agentPort`）；新增 URL 构造回归：`agentHost` 不注入端口、`agentPort` 缺省 7410、无 `agentHost` 回落 IP host、ready 状态复用时返回持久化 URL（构造仅在新建时发生——行为经独立账本目录验证）。
3. **证书说明更正**："公网 CA 不为 IP 签发证书"表述已过时——Let's Encrypt 自 2025-07 起提供短期 IP 地址证书。据此：①`agentScheme: https` 不再强制要求 `agentHost`（IP 证书场景合法）；②命名入口仍是默认推荐（身份可控、续期稳定、兼容性最好），文档与示例同步更正；③相关硬校验移除，保留 host 格式校验。

范围就此收口，不扩展。真实环境验收输入清单见 acceptance-next-steps.md §3（下方"环境验收输入"为其复述）。

## 环境验收输入（未执行，等待授权）

**TLS 实机**：测试机标识与访问方式；可用域名及 DNS 管理方式（或 LE IP 证书方案）；允许修改的端口/安全组/反代范围；验收动作为证书+鉴权+明文端口关闭+引导下载+动态构建全链路。

**云端到期销毁**：云配置/凭证在本地的引用位置（环境变量名即可，不粘贴密钥）；地域与网络参数；允许机型/规格与费用上限、实例最长存活时间；仅创建并销毁本次测试专用实例的明确授权。

**真实 Docker GC**：专用 Docker 环境访问方式；允许创建/删除的测试镜像/容器命名规则与资源上限；验证内容为长任务实测删除、当前/上一版本离线回滚、非 shipkit 对象零影响。
