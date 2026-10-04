# Shipkit M2 独立审计（2026-09-30）

**结论：M2 暂不通过。确认 10 项 M2 问题（7 P1、3 P2），另有 1 项既有 P1 发布阻塞。** 本轮仅审计与记录，未修改业务代码。186/186 测试、build/typecheck、本地打包与隔离安装冒烟均通过，但未覆盖下面的失败路径。

范围：[M2 任务记录](../../todos/2026-09-30-shipkit-m2.md) 的 UX05–UX08，以及对首次发布有直接影响的既有路径。[M1 收口结论](m1-final-verification.md) 保留为历史范围内的结论；本轮发现不回写为此前已验证的事实。

## 验证方式与边界

- 独立执行 `pnpm --filter shipkit build`、`typecheck`、`test`：全部 exit 0，186 tests / 186 pass / 0 fail。
- 重新打包 0.4.0，仓库外临时 prefix 离线安装，安装包 `ship init --json` 成功；实际安装包 agent 的本机 `/health` 返回 runtime / 0.4.0。
- 使用实际编译后的 agent、CLI、配对与状态模块；HTTP/TLS 服务仅监听本机。涉及镜像任务时仅 Docker 命令由可记录的成功替身替代，未操作真实镜像。
- 安装器使用源码副本，重定位固定路径到临时目录，并替换 root 检查、systemctl、curl、sleep 等外部边界。它验证脚本分支与文件事务，**不是 Debian/systemd 实机验收**。校验和优先级另使用真实 sha256sum 验证。
- 本次未重跑实施方报告的 Debian 19/19、真实 registry 11/11，不把这些数量算作本次独立证据；公网 TLS、云仓库、干净服务器到首次发布仍未验收。
- 本次独立结果与源码/包哈希见 [证据 JSON](m2-audit-evidence.json)。原始脚本与日志目录：`/tmp/codex-tool-runs/svton/m2-audit-20260930/`。

## 问题与修复验收条件

### M2-01 · P1 · 安装模板丢失预置 token，并错误处理角色和端口

位置：[install.sh](../../../bootstrap/install.sh) 第 15–54 行；[bundle-server.ts](../../../src/providers/bundle-server.ts) 第 78–82 行。

新脚本的 AGENT_TOKEN/AGENT_PORT 初始化不再读取模板值，bundle server 仍按占位符替换。新机器直接使用生成的 builder 安装脚本，会在安装前报 `AGENT_TOKEN not set`。补上手工 token 后，渲染过程又将占位符哨兵比较替换成真实值：builder 被判为占位符并改成 both，端口回落 7410。原始脚本升级时，ROLE 先被赋成非空占位符，也会跳过既有 unit 的 runtime 角色，最终改为 both。

复现：生成的脚本新装 exit 1；仅补 token 后解析结果为 `ROLE=both, PORT=7410`，与生成参数 builder/随机 bundle 端口不符；已有 runtime 的无角色覆盖升级后变为 both。

修复：区分显式 env、既有安装值、模板默认值与最终默认值，禁止对已渲染值再做占位符比较。验收须覆盖真实 bundle-server 生成脚本、新装和无覆盖升级，检查 token、role、port、bind、workRoot，不仅测试手工传全量环境变量。

### M2-02 · P1 · 安装升级未实现完整事务回滚

位置：[install.sh](../../../bootstrap/install.sh) 第 160–230 行。

替换程序后写入 agent.env 和 systemd unit；健康失败的恢复只还原程序目录，没有还原凭据与服务配置。更早的 `systemctl daemon-reload/enable/restart` 失败会被 `set -e` 直接中断，根本不调用回滚。

复现：显式修改 token/role/port 后制造版本不匹配，OLD_AGENT 已恢复，但 env/unit 仍为新配置；令 systemctl restart 返回 7，脚本 exit 7，NEW_AGENT 仍在线路目录、旧目录仍留在 `.old`，没有恢复动作。

修复：在提交前备份程序、env、unit，统一捕获提交阶段失败并恢复全部相关状态，reload/restart 后核验旧版本；回滚失败如实单独报告。回归至少覆盖重启失败、健康超时、版本错误、配置覆盖和回滚自身失败。

### M2-03 · P1 · registry API 未按配对凭据的角色限制动作

位置：[server.ts](../../../src/agent/server.ts) 第 88–97 行；[routes.ts](../../../src/agent/routes.ts) 第 192–229 行。

路由层同时放行 builder/runtime，registry-creds handler 只检查 agent 的角色，verify handler 也不按 mode 检查调用者权限。在 both agent 上，runtime 配对 token 可以覆写构建机 push 凭据并发起 push 验证任务，绕过新增的角色隔离。

复现：runtime token 写 push 凭据返回 HTTP 200，发起 mode=push 返回 202；对照 builder token 调 deploy 正确返回 403，说明缺口在新增的复合动作路由。

修复：将已认证的有效角色传入 handler，按 push/pull 动作检查调用者及机器能力，或拆成独立权限路由。用 master/builder/runtime × agent role × kind/mode 做正反向矩阵，拒绝应发生在写文件或创建任务之前。

### M2-04 · P1 · 向导与 doctor 把机器角色当作凭据权限，复用错误角色 token

位置：[checks.ts](../../../src/cli/init/checks.ts) 第 41–47 行；[pair-flow.ts](../../../src/cli/init/pair-flow.ts) 第 65–74 行；[cmd-doctor.ts](../../../src/cli/cmd-doctor.ts) 第 25–33 行。

`/api/status` 返回的是机器 role=both。builder 配对 token 访问 status 成功后，checkAgent(runtime) 就报告角色满足；pairMachine 只筛同 URL 和检查结果，忽略凭据 role，因此把 builder 凭据复用成 runtime。用户看到已就绪，实际 deploy 却会被 403 拒绝。

复现：实际 agent 上 `checkAgent('runtime', builderToken).passed=true`；实际 pairMachine 返回 `reused=true, tokenRef=builder, passed=true`。

修复：状态接口明确返回已认证身份的有效权限，检查端据此判断；本地角色仅作预筛选，不能替代服务端验证。回归同一台 both 机器的 builder/runtime 分别配对及恢复流程，证明 runtime 不复用 builder 凭据。

### M2-05 · P1 · 重跑 init 会把 tokenRef 静默转换为项目内明文 token

位置：[defaults.ts](../../../src/cli/init/defaults.ts) 第 14–47 行；[machines.ts](../../../src/cli/init/machines.ts) 第 78 行起；[plan.ts](../../../src/cli/init/plan.ts) 第 45–58 行。

从配置解析 tokenRef 后，默认值只保留解析出的明文 token，丢失引用身份；默认接入方式为手工模式，仅配对模式会返回 tokenRef。因此已配对项目的非交互幂等重跑会重新把长期秘密写回项目配置，破坏 M2 的存储边界。

复现：builder/runtime 原为 tokenRef；执行真实 `ship init --json` exit 0 后，两个引用均变为明文 token，builderRef=null。

修复：把 URL、tokenRef、解析后的 token、来源作为完整连接组传递。没有显式改变凭据方式时保留 tokenRef；换 URL 或手工换 token 必须明确使旧引用失效。回归非交互重跑、交互回车、切换目标、修改 URL 与取消恢复，配置、备份、审阅、草稿都不得新增长期秘密。

### M2-06 · P1 · 配对存储只做实例内串行，管理员铸码与兑换会互相覆盖

位置：[security.ts](../../../src/agent/security.ts) 第 57、82–104、145–172 行。

agent 与管理员 `--pair` 使用不同 SecurityStore；Promise queue 只能保护同一个实例。共享文件的读取、更新、固定 `.tmp` 写入、rename 没有共同锁，mtime 检查不能实现原子事务。

复现：同路径两个独立 Store 分别兑换现有码和创建新码，5/5 次出现兑换返回成功但 token 无法认证，铸码 rename 报 ENOENT，磁盘上的原配对码仍为未消费。两个实例用于模拟线上分离进程的共享文件竞争；本次未把该用例称作跨进程端到端测试。

修复：为整个读改写建立跨进程锁/事务，锁内重新读状态；使用独占随机临时文件，成功提交后再更新内存并返回 token。补真实 agent + 管理员子进程并发回归，验证一次消费、所有已返回 token 可用、无丢失更新、文件损坏时拒绝继续覆盖。

### M2-07 · P2 · 新凭据存储重复引入固定临时文件与权限漏洞

位置：[credentials.ts](../../../src/shared/credentials.ts) 第 34–42 行；[registry-creds.ts](../../../src/agent/registry-creds.ts) 第 37–51 行；同类模式见 security.ts。

`writeFile(..., {mode: 0600})` 不会修改已存在文件的权限；固定 `.tmp` 后 rename 也会继承原模式。这与 M1 已处理的秘密文件写入问题相同。

复现：预置普通 0644 的 credentials.json.tmp / registry-creds.json.tmp，分别执行真实 ship pair 和 writeRegistryCreds；结果均为正式凭据文件 0644，ship pair 仍 exit 0。

修复：复用或抽取 M1 的安全写入实现，随机名、wx、显式权限校验、拒绝符号链接；读改写的并发保护也需覆盖 controller 和 registry 凭据，避免不同条目互相覆盖。回归预置临时文件、符号链接、并发更新、写入失败；对外“0600”声明必须与磁盘一致。

### M2-08 · P2 · 本地凭据名冲突在兑换后才检查，白白消耗一次性码

位置：[cmd-pair.ts](../../../src/cli/cmd-pair.ts) 第 67–98 行。

已知的本地名称/URL 冲突可在发送秘密前发现，但当前先向 agent 成功兑换，再因为缺少 --force 拒绝保存。此次 token 无法再取回；按提示改名重试，配对码却已失效。

复现：同名凭据指向旧 URL，使用新 URL 配对时 exit 2 并提示 --force；同码重试返回 401 pairing_replayed。

修复：兑换前校验名称、覆盖决策、存储可用性和预期角色；兑换后写入失败明确区分远端已提交与本地未保存，设计受控恢复路径。回归“冲突拒绝不消费码”和“写入失败不报告配对成功”。

### M2-09 · P1 · sidecar 校验和覆盖显式指定的可信 hash

位置：[install.sh](../../../bootstrap/install.sh) 第 128–133 行。

脚本先把 TARBALL_SHA256 写入校验文件，随后无条件用邻接 `.sha256` 覆盖它。管理员从可信渠道指定的 hash 不再决定是否安装，相邻文件可以改变校验基准。

复现：显式 hash 为 64 个 0（与包不符），邻接 sidecar 为该包真实 hash，脚本仍 exit 0 并显示 `bundle sha256 verified`；本用例执行真实 sha256sum。

修复：显式可信 hash 优先，来源冲突应拒绝，不能静默降级；清除或避免复用固定 `/tmp/ship-sums`，隔离每次安装的校验数据。回归显式/sidecar 冲突、缺失、损坏和跨次残留。

### M2-10 · P2 · --ca-file 只用于兑换，成功配对后其他命令仍不信任该入口

位置：[pair-http.ts](../../../src/cli/pair-http.ts) 第 18–29 行；[credentials.ts](../../../src/shared/credentials.ts) 第 11–16 行；[http.ts](../../../src/shared/http.ts) 第 24–45 行。

配对专用传输支持指定 CA，但凭据不保留信任配置，后续 doctor/init/release 使用普通 fetch。向导提示“先 ship pair --ca-file，再回来沿用”的路径因此不能闭环。

复现：本机实际 HTTPS 反代 + 有 SAN 的自签证书，指定 CA 的 ship pair exit 0；使用保存的 tokenRef 执行 doctor exit 1，builder/runtime 均为 TLS 连接失败。测试没有设置全局跳过证书校验，也没有额外 CA 环境变量。

修复：为入口提供可持久引用、由统一 HTTP 客户端使用的 CA 配置；或明确只支持系统信任并给出完整信任配置步骤，移除无法成立的绕行提示。回归 pair → doctor → init/业务请求，以及错误 CA/主机名拒绝；禁止用关闭 TLS 校验解决。

### LEGACY-02 · P1（既有）· 本地源码上传被当作 JSON，首次 release --from-dir 阻断

位置：[server.ts](../../../src/agent/server.ts) 第 97–99 行；[routes.ts](../../../src/agent/routes.ts) 第 104 行起。

sources 路由声明 raw=true，但统一 handler 对所有非 GET/HEAD 请求都先调用 readJson。合法 tar.gz 无法进入流式落盘逻辑。

复现：向实际 agent 的 `/api/sources` 发送上一轮实际打包生成的 gzip、有效 builder token，返回 HTTP 400 / bad_json；无镜像操作。已核对 HEAD 中的同一逻辑，故归为既有缺陷，不归因于 M2。上轮 M1 的 LEGACY-01 验证了打包产物，未证明真实 HTTP 接收链路。

修复：raw 路由绕过 JSON reader，仅由受限的流式 reader 消费 body；验证实际 CLI 打包 → HTTP 上传 → 服务端解包的完整路径，并覆盖非法包/超限/空包。此项必须在宣称“干净服务器到首次发布”前关闭。

## 工程与验收状态

- 当前 install.sh 249 行、routes.ts 251 行、wizard.ts 214 行，超过既有 200 行源码结构规范。任务记录只说明了安装脚本的分发考虑，没有说明其余超长模块；修复时需同步拆分职责并保持分发可用。此项作为工程整顿记录，不混入上面的功能缺陷数量。
- UX05：安装参数、升级事务及 hash 优先级未通过；UX06：角色约束、持久化与信任衔接未通过；UX07：角色动作门禁未通过，本次未独立复验真实 registry；UX08：引用保留、凭据复用和失败恢复未通过。
- 这些问题属于当前工具链承诺的功能，不应推迟到平台化阶段。先修复代码与持久回归，再执行受控真实环境验收；无需先给生产权限或开通云实例才能修这些问题。
- 推荐修复顺序：安装参数/升级与校验 → 存储事务/权限 → 服务端角色与客户端能力检查 → tokenRef 保留/配对预检/CA 衔接 → 真实 HTTP 源码上传 → 全量与打包回归。各项保留原始证据，修复另增处置记录。

M2 的整体门槛仍包括专用干净服务器、可信 TLS、仓库推拉及首个应用发布。即使上述本地缺陷全部修复，也应另列该真实环境门槛的状态。
