# Shipkit M2 审计问题处置记录（2026-09-30）

> 后续状态（2026-10-04）：REG-03 / WAIT-01 在本机脚本状态文件锁范围已通过[最终独立复核](../2026-10-04/m2-r2-script-lock-final-review.md)。下方保留各次处置的当时状态；真实安装/项目验收边界以[当前接入记录](../../todos/2026-10-04-runtime-tcr-setup.md)为准，多服务和选择性发布尚未实现。

> 最新独立复核（TCP 内核互斥轮，2026-10-01）：**M2-R2 仍开放（P2）**。确认路径别名导致双重进入与丢更新、探测 EOF 挂起/预算超限、半开连接拖住释放。全量两次均 245/246（端口占用），build/typecheck 与独立安装器 17/17 通过；未重跑包内冒烟。见 [本轮复核及证据](m2-r2-tcp-review.md)。R1、R3 和结构整顿维持此前范围，真实环境仍待验收。

**结论：M2 独立审计确认的 10 项问题（M2-01…M2-10）与既有 P1 发布阻塞 LEGACY-02 的代码修复全部完成**，逐项复现→修复→同构验证→持久回归入库。本轮基线：`pnpm run typecheck` exit 0；`pnpm test` = tsc + 226/226 node 测试 + `scripts/installer-check.mjs` 13/13 场景；重新打包 0.5.0 并在仓库外隔离安装冒烟 `scripts/package-smoke.mjs` 14/14。本地修复通过**不等于** M2 整体验收完成——真实环境门槛（专用干净服务器、可信公网 TLS、真实仓库推拉、首个应用发布）仍单独待验收，见文末。

日志与证据目录：`/tmp/codex-tool-runs/svton/m2-remediation-20260930/`（test-final.log、installer-check-r4.log、package-smoke.log、pack.log、typecheck-final.log）。
原始审计与证据不改动：[m2-audit.md](m2-audit.md) / [m2-audit-evidence.json](m2-audit-evidence.json)。

## 验证方式与边界声明

- **实际代码路径**：agent HTTP/认证/配对/存储、CLI（pair/init/doctor/上传）、bundle-server 渲染、install.sh 分支与文件事务（bash 实执行）。HTTP/TLS 均为本机回环监听。
- **替身边界**：`scripts/installer-check.mjs` 中 `systemctl/curl/id/sleep/journalctl/apt-get` 为可记录替身（sha256sum 为真实命令）；systemd/Debian 实机不在本轮范围。
- **未混报**：Docker 相关（verify 任务的真实推拉）未在本轮重跑；公网 TLS、真实远端仓库未触碰。

## 逐项处置

### M2-01 · P1 · 安装参数四层优先级

- **修复位置**：`bootstrap/install.sh`（参数解析段重写：显式 env > 既有安装值 > 渲染模板值 > 内置默认）；`src/providers/bundle-server.ts`（渲染不变，脚本侧以运行期拼接 `printf '__%s__'` 构造哨兵比较，replaceAll 无法改写比较本身）。
- **修复前证据**（审计 repro）：渲染脚本新装 exit 1（`AGENT_TOKEN not set`）；补 token 后 `ROLE=both, PORT=7410`，与生成参数 builder/随机端口不符；原始脚本升级把既有 runtime 改成 both。
- **修复后同构验证**：`dist/providers/bundle-server.test.js`——真实 bundle-server 渲染脚本，新装得 `ROLE=builder PORT=<bundle端口> TOKEN_OK=yes`；显式 env 全量覆盖；已有 unit(runtime,17410) 升级保持原值；原始脚本（哨兵未替换）升级保持 runtime、无 token 时明确报错退出。`scripts/installer-check.mjs` M2-01 场景（全新安装提交请求的 role/port/workroot）。
- **持久回归**：上述两处均在 `pnpm test` 内。
- **剩余限制**：`__AGENT_BIND__` 无模板占位（bundle-server 不下发 bind），bind 走 env>unit>默认，属既有约定。

### M2-02 · P1 · 升级完整事务

- **修复位置**：`bootstrap/install.sh`（提交段重写：程序/env/unit 先备份；daemon-reload/enable/restart 失败进入统一回滚；回滚恢复三者并用旧端口/旧版本实测验证；回滚失败单独 exit 5）。
- **修复前证据**：health-mismatch 后 env/unit 仍为新配置；restart exit 7 时脚本直接中断、无回滚。
- **修复后同构验证**（`scripts/installer-check.mjs`，实跑 bash，systemctl/curl 替身语义=重启后运行版本跟随所装树）：health-mismatch → exit 4 且程序/env/unit 全部恢复、输出 `rollback verified`、失败树留档；restart 失败（一次性）→ exit 4 全恢复；健康超时 → 旧版回滚验证 exit 4；restart 恒失败 → exit 5 且 stderr 明示 `rollback INCOMPLETE`；无覆盖升级保持 runtime/17410/旧 workroot/token 并清理 `.old`。
- **持久回归**：installer-check 5 场景 + M2-01 新装场景，接入 `pnpm test`。
- **剩余限制**：实机 systemd/Debian 验收未做（与审计相同边界）。

### M2-03 · P1 · registry 动作按调用者有效角色门禁

- **修复位置**：`src/agent/server.ts`（认证结果 `ctx.auth.role` 注入）；`src/agent/route-guards.ts`（`assertCallerCan/assertMachineCan`）；`src/agent/routes-registry.ts`（registry-creds 按 kind、verify 按 mode 在写文件/建任务之前检查调用者与机器双向能力）。
- **修复前证据**：runtime token 写 push 凭据 200、发起 push verify 202。
- **修复后同构验证**：`dist/agent/routes-guards.test.js`——both 机器上 runtime×push、builder×pull 均 403 且 `registry-creds.json` 未创建、jobs 列表为空；builder×push、runtime×pull 正常（读改写并存）；builder-only 机器 master 也不能存 pull 凭据。
- **持久回归**：`pnpm test`；安装包内同样成立（package-smoke 两项 M2-03 检查）。
- **剩余限制**：无。

### M2-04 · P1 · 凭据能力以服务端判定

- **修复位置**：`src/agent/routes-lifecycle.ts`（`/api/status` 返回 `auth:{role,capabilities}`＝调用者有效角色）；`src/cli/init/checks.ts`、`src/cli/cmd-doctor.ts`（roleOk 依据 `auth.role`，缺失则明确失败）；`src/cli/init/pair-flow.ts`（复用候选按本地 role 预筛 + 服务端 checkAgent 定夺）。
- **修复前证据**：`checkAgent('runtime', builderToken).passed=true`；`pairMachine` 把 builder 凭据复用为 runtime。
- **修复后同构验证**：routes-guards（status.auth 区分 master/builder/runtime）；checks.test（无 auth 上报的老 agent 不通过角色层；builder 凭据不满足 runtime）；pair-reuse.test（真实 agent：runtime 接入不再复用 builder 凭据且不再弹复用问句；对照用例 builder 复用照常）。
- **持久回归**：`pnpm test`；package-smoke（status.auth + doctor tokenRef 全绿）。
- **剩余限制**：对 <0.5.0 的旧 agent，doctor/init 会如实报告"agent 未上报凭据有效权限"并判不通过（有意为之，防止 again 以机器角色冒充凭据权限）；升级 agent 后即恢复。

### M2-05 · P1 · tokenRef 保留与失效

- **修复位置**：`src/cli/init/defaults.ts`（连接组携带 `{url, token, tokenRef, caFile}`）；`src/cli/init/machines.ts`（保留默认值＝保留引用；改 token 或改 URL 即失效）；`src/cli/init/wizard.ts`（凭据一次读入传入解析）。
- **修复前证据**：非交互重跑 `ship init --json` 后 builder/runtime 均变明文 token、`builderRef=null`。
- **修复后同构验证**：`dist/cli/init/tokenref.test.js`——非交互重跑与交互回车均保留 tokenRef 且配置无明文；手工改 token → 该机转明文（引用失效）；换 URL → 引用失效且旧 token 不发往新入口（请求侧断言）。
- **持久回归**：`pnpm test`；package-smoke 最后一项断言项目配置不含明文 agent token。
- **剩余限制**：无。

### M2-06 · P1 · 配对存储跨进程事务

- **修复位置**：`src/shared/file-lock.ts`（O_EXCL 锁 + 过期接管 + 超时）；`src/agent/security.ts`（`tx()`：锁内重读→变更→独占提交；损坏文件抛 `SecurityStateError` 拒绝读取与覆盖；persist 走 secureWrite）。
- **修复前证据**：双实例并发 5/5 出现"兑换成功但 token 不可认证 / rename ENOENT / 码未消费"。
- **修复后同构验证**：security.test——双实例 exchange+mint 并发全部成功、token 可认证、无丢更新；损坏文件拒绝且不被覆盖；security.test 最后一个用例为**真实子进程并发**（真实 agent 进程 + 6 个 `--pair` 子进程铸码 + 6 路 HTTP 兑换并发）：每个码恰好消费一次、全部返回 token 可通过 /api/status 认证、重放全部 401、最终文件可解析。
- **持久回归**：`pnpm test`。
- **剩余限制**：锁为同主机文件锁；多主机共享 workRoot 本就不是支持形态。

### M2-07 · P2 · 秘密文件安全写入统一

- **修复位置**：`src/shared/secure-write.ts`（自 M1 `cli/init/safe-write.ts` 上移为唯一实现：随机名 + wx + chmod 校验 + 拒绝符号链接）；`src/shared/credentials.ts`（saveCredential 走锁 + secureWrite，并导出 `credentialNameError/assertCredentialsStoreWritable`）；`src/agent/registry-creds.ts`（写路径同构）；`src/agent/security.ts`（persist 同构）。
- **修复前证据**：预置 0644 `.tmp` 后 ship pair / writeRegistryCreds 产出正式文件 0644。
- **修复后同构验证**：credentials.test / registry-creds.test / security.test——预置 0644 临时文件后最终文件 0600；符号链接目标拒绝；并发写不同条目无丢失（锁内读改写）。
- **持久回归**：`pnpm test`；package-smoke 断言安装包内凭据文件 0600。
- **剩余限制**：无。

### M2-08 · P2 · 配对预检与失败恢复

- **修复位置**：`src/cli/cmd-pair.ts`（名称合法性/存储可解析可写/名称冲突全部前置到消费码之前，exit 2；兑换成功但保存失败 → exit 5 并如实报告"远端已提交+本地未保存+恢复方式"）；`src/cli/init/pair-flow.ts`（preflightStore 同构；保存失败文案区分远端已提交）。
- **修复前证据**：同名冲突先兑换后拒绝 exit 2，重试同码 401 pairing_replayed。
- **修复后同构验证**：cmd-pair.test——冲突/损坏存储/只读存储三种情形均 exit 2 且**码仍可兑换**（200）；--force 才消费；savefail.test（模块级模拟 saveCredential 失败）：exit 5、文案含"远端已配对成功/本地保存失败/恢复方式"、码确已消费（重放 401）、本地无凭据文件；向导路径同样输出远端已提交文案。
- **持久回归**：`pnpm test`。
- **剩余限制**：保存失败的 token 出于安全考虑不回显（只能换新码重配），文案已明示。

### M2-09 · P1 · 可信校验和优先级

- **修复位置**：`bootstrap/install.sh`（显式 `TARBALL_SHA256` 优先；与 sidecar/SHA256SUMS 不一致 → 冲突拒绝 exit 3；sha 真实计算比对；mktemp 按次隔离并 trap 清理）。
- **修复前证据**：显式 hash 全 0 + 正确 sidecar → exit 0 `bundle sha256 verified`（真实 sha256sum）。
- **修复后同构验证**：installer-check（真实 sha256sum）——显式错+sidecar 对 → exit 3 冲突且安装未动；显式对+sidecar 一致 → 通过并标注 `source: explicit`；损坏 sidecar → 拒绝；非法格式 → 参数错误；无来源 → 警告放行；两次不同 bundle 的安装无固定/残留校验文件（`ship-sums`/`ship-agent.*` 均无）；file:// 下载路径 SHA256SUMS 对/错/与显式冲突三态。
- **持久回归**：installer-check 接入 `pnpm test`。
- **剩余限制**：无。

### M2-10 · P2 · CA 信任衔接

- **修复位置**：`src/shared/http-transport.ts`（node 核心统一传输，支持按入口固定 CA，不关闭校验）；`src/shared/http.ts`（api/apiUpload/waitForJob/fetchLogTail 全部走该传输并接受 caFile）；`src/shared/credentials.ts`（凭据条目记录 `caFile`，`resolveTargetToken` 随目标返回）；`src/cli/pair-http.ts`（并入统一传输）；`src/cli/cmd-pair.ts`（`--ca-file` 随凭据保存并提示保留）；调用侧（static provider、pipeline、doctor、status、gc、verify-registry、rollback、checks、pair-flow）贯穿传递。
- **修复前证据**：`ship pair --ca-file` exit 0 后 doctor exit 1（fetch failed）。
- **修复后同构验证**：`dist/shared/http-ca.test.js`——本机真实 HTTPS 反代（自签 CA-A + SAN 127.0.0.1 的服务端证书，夹具入库 `e2e/fixtures/tls/`）：无 CA 与错误 CA-B 均拒绝；pair --ca-file → 凭据记录 caFile → tokenRef 配置下 doctor exit 0；status 业务请求经同一 CA 成功。TLS 校验全程未关闭。
- **持久回归**：`pnpm test`。
- **剩余限制**：明文 token（非 tokenRef）入口无 CA 记录位，走系统信任——向导文案已改为指向 `ship pair --ca-file`；公网 CA 实链路属真实环境门槛。

### LEGACY-02 · P1（既有，归因保留）· raw 路由流式上传

- **修复位置**：`src/agent/server.ts`（`route.raw` 跳过 JSON reader）；`src/agent/routes-images.ts`（空包先检、失败清理 dir+incoming）。
- **修复前证据**：真实 gzip POST `/api/sources` → 400 bad_json。
- **修复后同构验证**：routes-guards——真实 CLI 打包产物（`packSourceDir`）→ `apiUpload` → 真实 agent 流式落盘解包（201 + 目录内容校验 + 打包排除项生效）；空包 400 bad_request；非法包 400 bad_tarball；超限（>300MB 流式）拒绝且无残留（另有 streamBodyToFile 413 单元断言）。
- **持久回归**：`pnpm test`；package-smoke 在安装包内复测 201+服务端解包。
- **剩余限制**：无。"干净服务器到首次发布"宣称前仍需真实环境整链路验收（与 M2 门槛合并）。

## 工程整顿（审计工程项）

- `src/agent/routes.ts` 251 → 13 行（装配器），按职责拆为 `route-types.ts` / `route-guards.ts` / `routes-lifecycle.ts` / `routes-pairing.ts` / `routes-images.ts` / `routes-registry.ts`（均 ≤130 行）。
- `src/cli/init/wizard.ts` 214 → 184 行（辅助函数移 `wizard-support.ts`）。
- `bootstrap/install.sh` 249 → 357 行：curl|bash 单文件分发约束的既有显式例外继续保留；增量全部来自 M2-01/02/09 要求的事务与校验逻辑。
- 其余触碰文件全部 ≤200 行（`src/agent/security.ts` 恰 200）。

## 夹具调整说明（不改失败场景含义）

- 审计 install-check.py 将 `sha256sum` 替身为恒 exit 0；本轮脚本改为真实 sha256sum（M2-09 语义即校验和本身），替身仅剩 systemctl/curl/id/sleep/journalctl/apt-get，且 systemctl 替身语义明确为"重启成功后运行版本跟随所装树"。
- 向导/检查测试桩的 `/api/status` 响应补 `auth` 字段——服务端契约新增调用者有效角色上报（M2-04），桩需建模该契约而非沿用机器角色。

## 证据索引

- 产物：`pack/shipkit-0.5.0.tgz`（sha256 `9314fe70…cc5a36`）、`pack/ship-agent-0.5.0.tgz`（`6374a178…360657`）。
- 日志：`/tmp/codex-tool-runs/svton/m2-remediation-20260930/{test-final.log, installer-check-r4.log, package-smoke.log, pack.log, typecheck-final.log}`。
- 环境：macOS arm64、node v22.17.0、本机 Docker 28.3.0（仅存在性探测，本轮未执行镜像操作）。

## 真实环境验收状态（未因本地修复而关闭）

1. 专用干净服务器（Debian/systemd 实机）上 install.sh 全链路 + `--pair`/`ship pair` 实机。
2. 公网可信 TLS（域名+证书/反代）下 pair→doctor→release 全链路（本轮已验证自签 CA 等价链路）。
3. 真实远端 registry 的 verify 推拉实测（本轮仅回归既有本地 registry:2 用例所依赖的代码路径，未重跑 11/11）。
4. 干净服务器到首个应用发布的端到端（M2 门槛，LEGACY-02 关闭后条件已具备）。

---

# 收口复核遗漏修复轮（2026-09-30，M2-R1–R3 + 安装脚本结构整顿）

依据：[收口复核](m2-closure-audit.md) 确认的 3 项遗漏与工程事项。本轮基线结果：`pnpm test` = tsc + 漂移检查 + **234/234** node 测试 + installer-check **17/17**；重新打包 0.5.0 并仓库外隔离冒烟 **14/14**。日志：`/tmp/codex-tool-runs/svton/m2-closure-fix-20260930/`。

## M2-R1 · P1 · 提交阶段文件操作失败纳入统一回滚

- **修复位置**：安装脚本源码拆分后落于 `bootstrap/src/10-preflight.sh`（交换前预检：WORK_ROOT/INSTALL_DIR/SECRETS_FILE/UNIT_FILE 的路径类型冲突全部前置拒绝；提前创建运行目录并探测可写性）与 `bootstrap/src/40-transaction.sh`（提交区间全部步骤——目录交换、目录创建、env/unit 写入、chmod、非 systemd 启动、systemctl、健康检查——逐条 `|| rollback_and_fail`，无一步可经 set -e 中断留下混合状态）。
- **修复前复现**（`repro-r1.mjs`，已归档）：WORK_ROOT 指向普通文件 → exit 1、新程序已换入、`.old` 残留、无回滚；chmod exit 9 → 新程序+新 env 在位、unit 旧值。
- **修复后同构验证**：workroot-file → **exit 1 且零状态变化**（agent/env/unit 原样、无 `.old`）；chmod-failure → exit 4、程序/env/unit 全恢复且输出 `rollback verified`。
- **持久回归**（installer-check 新增 4 场景，`pnpm test` 内）：workroot-is-file（零变化）、chmod 失败（回滚验证）、提交段 mkdir 失败（预检过后第 3 次调用失败 → 回滚）、程序交换 mv 失败（回滚）；既有健康失败/重启失败/回滚失败场景保持通过。断言检查实际文件内容与退出码，非仅日志匹配。
- **剩余限制**：无（systemd/Debian 实机验收仍属真实环境门槛）。

## M2-R2 · P2 · 锁存活判定与所有权协议

- **修复位置**：`src/shared/file-lock.ts` 重写。协议：锁文件记录 `pid\ttoken`；**存活判定只认 PID**（`process.kill(pid,0)`；ESRCH=死、EPERM=活），锁龄不再作为死亡证据；接管需 pid 确认死亡 + token 跨两次读一致 + 原子 rename 收割 + 收割后再验 token（误收活锁则 link 回原位）；释放仅当 token 仍属自己才删除（导出 `releaseLockIfOwner`）；不可读/无法解析的锁视为存活（等待后明确超时，绝不删除）。
- **修复前复现**（`repro-r2.mjs`，默认参数）：活跃持有 15.5s 后第二个事务进入（`overlap=true`），第一个退出时第二个的锁被删（`secondLockSurvives=false`）。
- **修复后同构验证**：同一脚本 → 第二个事务明确超时（报 `holder pid N is alive`）、锁原样保留、`overlap=false`。
- **持久回归**（`src/shared/file-lock.test.ts` 6 项，真实子进程）：活跃持有者（真实子进程）超任意时长不被抢占、等待方超时且锁不被删；SIGKILL 崩溃残留锁被 PID 判定立即收割（<4s，不等待锁龄）；崩溃后 4 路竞争接管串行无重叠无丢失更新；**旧持有者延迟释放**（`releaseLockIfOwner` 以旧 token 调用）不删新锁；普通并发计数无丢失；垃圾锁内容视为存活不删除。既有并发配对/损坏拒绝/锁内重读回归全部保留通过。
- **剩余限制**：同主机锁（跨机共享 workRoot 不属支持形态）；不可归属的残留锁（如 open 与写内容之间崩溃）以超时失败并提示人工清理，绝不自动删除。

## M2-R3 · P2 · CA 引用不依赖后续命令的工作目录

- **修复位置**：`src/cli/cmd-pair.ts`（`--ca-file` 配对时 `path.resolve` 为绝对引用入库）；`src/shared/credentials.ts`（`resolveTargetToken` 对历史相对记录抛出明确指引：用绝对路径重新配对或手工修正条目，明示不得猜测原目录、不得改用同名其他证书）；`src/shared/http-transport.ts`（相对 CA 一律拒绝并给同一指引；**取消 CA Agent 缓存**，每次重读文件——修复了原 CA 删除后仍按旧缓存放行连接的缺陷；`requestBuffered` 改 async，坏引用以 rejected promise 而非同步 throw 呈现）；`src/cli/init/checks.ts`（**/health 可达性探测同样使用 pinned CA**——修复自签入口下 init 第一层检查失败的缺口）。
- **修复前复现**（`repro-r3.mjs`）：`--ca-file ./ca.pem` 原样入库（`isAbsolute=false`）。
- **修复后同构验证**：同一脚本 → 入库为绝对路径。
- **持久回归**（`src/shared/http-ca.test.ts` 新增 2 项，真实本机 HTTPS 反代 + 入库夹具证书）：相对 `./ca-a.pem` 配对存绝对 → 换目录 doctor/业务请求/init 非交互重跑全部通过；新目录放置**另一张同名证书**后依旧用原绝对 CA（不采信）；删除原 CA 文件 → doctor 失败且错误点名绝对路径；历史相对记录 → `resolveTargetToken` 与传输层均给准确指引；错误 CA 拒绝（既有）；**证书 SAN 未覆盖的主机名（[::1]）即使持正确 CA 也拒绝**（新增，全程未关闭 TLS 校验）。
- **剩余限制**：无。

## 安装脚本结构整顿（工程项）

- 源码按职责拆分为 `bootstrap/src/`：`00-params.sh`(71 行：参数与四层优先级)、`10-preflight.sh`(39 行：身份/来源/参数/写前条件预检)、`20-packages.sh`(64 行：包管理器/docker/node)、`30-bundle.sh`(51 行：产物获取与校验和)、`40-transaction.sh`(162 行：升级事务与提交区间)——**每模块 ≤200 行**。
- `bootstrap/install.sh`（387 行）改为**构建产物**：`scripts/build-install.mjs` 按序拼接生成；`--check` 模式接入 `pnpm test`、pack 前自动再生成——源与分发不允许静默漂移（生成文件头标注 do-not-edit）。
- 产物一致性已验证：`pnpm test` 内置 `install.sh in sync with bootstrap/src`；打包 tarball 内 `bootstrap/install.sh` 与仓库生成文件逐字节一致（抽查通过）；bundle-server 下发的安装脚本即读取该生成文件（bundle-server.test 使用真实 startBundleServer 渲染断言，覆盖下发内容）；installer-check 17/17 直接执行生成产物。
- `curl | bash` 与离线安装能力不变（路径/接口零变化）。

## 夹具调整说明（本轮，含义不变）

- bundle-server.test 的解析夹具新增 `/opt/shipkit-data`、` /etc/shipkit`、` /etc/systemd/system` 路径重定位并将场景 WORK_ROOT 指向临时目录：预检**新增写入条件探测**是 M2-R1 的预期行为，夹具必须跟随重定位；各场景断言的目标值（模板值/env 覆盖/既有安装保持）逐字未变，仅路径前缀随重定位。
- repro 三份脚本与修复前后输出均归档于日志目录。

## 本轮证据索引

- 产物：`pack/shipkit-0.5.0.tgz`（sha256 `d512d87d…2e0af`）、`pack/ship-agent-0.5.0.tgz`（`473b4640…fdd7b`）、`bootstrap/install.sh`（`6adf19f8…17dcc`）。
- 环境：macOS arm64、node v22.17.0；systemctl/curl 等仍为可记录替身，sha256sum 真实。
- 真实环境验收状态不变：干净服务器实机、公网可信 TLS、真实远端仓库推拉、干净服务器到首个发布，均未因本地修复而关闭。

---

# M2-R2 竞争回收收口轮（2026-09-30，prev 串行化死锁回收）

依据：[收口复核后追加复核](m2-closure-recheck.md) 唯一剩余项——reapIfDead 的"两次读 token → rename"非条件原子，rename 可移走**新持有者**的锁，短暂空窗让第三方进入，事后核对与 link 回填无法撤销重叠。本轮只修此项，未动 R1/R3 与结构整顿。

## 协议（重设计后）

锁文件 `pid\ttoken`；同主机。**互斥成立依据**：

1. **获取（空闲）**：`open(lock,'wx')` 原子排他，唯一胜者。
2. **持有**：身份行创建时一次写入、此后不变；活 pid 永不过存活判定（`kill(pid,0)` 对活进程恒成功，EPERM 亦视为活）⇒ **活跃持有者的锁永不被替换/移走/删除**。
3. **回收（持有者确证死亡）**：
   a. `link(lock, lock.prev)` —— **原子存证**：成功 ⇔ 路径此刻存在；硬链接将 inode 与身份行**定格**。EEXIST ⇒ 另一回收者在途 ⇒ 等待 prev 消失（超过 500ms 视为在途回收者崩溃残骸，任何人可清除——prev 只是证据、不是互斥载体，任何时刻清除都不破坏互斥）。
   b. 读 prev 并要求身份 == 刚才判死的身份：**过期证据（锁已被接管）在此被拒**，清证据回循环。
   c. `rename(claim, lock)` —— **原子替换，路径全程存在，无空窗**。(a)–(c) 之间路径只可能被本回收者改写：他人需要 prev（被本回收者持有）、或 wx（路径存在）、或对本回收者的死亡判定（本回收者活着）——三者皆不可能。
   d. 清 prev、自检身份、进入临界区。claim 按 token 唯一命名，并发回收者互不干扰。
4. **释放**：仅当路径 token 仍是自己的才 unlink；检查与删除之间不可能被替换（替换者需先判自己死）。
5. **保守路径**：不可读/格式坏锁视为存活（等待→明确超时）；超时永不抢占。pid 复用导致死锁被误判活时同样保守失败（fail-safe，不破坏互斥）。

修复位置：`src/shared/file-lock.ts`（重写，165 行 ≤200；`releaseLockIfOwner` 保留导出）。既有能力未动：损坏状态拒绝、锁内重读、独占安全写入（secureWrite）、security/credentials/registry-creds 用法与接口不变。

## 修复前后证据

- **修复前**（审计脚本 `/tmp/codex-tool-runs/svton/m2-final-20260930/lock-reap-check.mjs`，本轮重跑确认）：`bAndCOverlap=true`（B/C 同时处于临界区），残留 1 个 `.reap-*`（归档 `m2-r2-final-20260930/repro-before.json`）。
- **修复后同构验证**（`/tmp/codex-tool-runs/svton/m2-r2-final-20260930/lock-reap-check-adjusted.mjs`，真实文件系统、真实退出的子进程 pid、仅调度暂停）：
  - v1（A 死判+持证后暂停在原子替换前；B/C 并发竞争）：A 暂停期间 B/C 均未进入；A 独占完成；随后 B、C 串行成功；**maxActive=1**，无残留。
  - v2（A 死判后暂停、B 完整接管并进入；A 恢复）：A 在 prev 身份核对处退让（明确超时报 holder alive），B 的锁身份逐字未变，C 等待；**maxActive=1**，A 清理了自己的证据。

## 注入点调整依据（保留等价竞争语义）

旧协议的危险瞬间是"两次读 token 后、rename(lock→reap) 前"——该 rename 可移走新持有者的锁。新协议中唯一的无条件路径改写是 `rename(claim→lock)`，发生在回收者独占 prev 证据且身份核对之后；**等价瞬间**即"证据已固、替换在即"。v1 暂停点 = rename(→lock) 前（对应审计步骤 1）；v2 暂停点 = link(prev) 前（对应"读取后、动作前锁已被换"的过期证据语义，即审计步骤 3 中 rename 会砸掉 B 的那个交错）。新协议下"移走活跃锁"与"路径空窗"不再存在，故审计原时序的步骤 4/5（C 在空缺获取、回填失败）不可能发生——这正是修复目标，以 v1/v2 的 maxActive=1 与"B 锁未触碰"断言覆盖。调度机制（node:test 模块替身暂停真实调用）与审计脚本相同，未伪造任何文件内容或系统调用结果。

## 持久回归

- **新增** `src/shared/file-lock-race.test.ts`（2 项，`pnpm test` 内）：上述 v1、v2 的确定性 A/B/C 调度，核心断言**临界区最大并发数恒为 1**（实时计数采样），并断言 A 暂停期间无人进入、过期证据方明确超时、B 锁身份不变、无 `.prev/.claim` 残留。死 pid 为真实退出的子进程，且挑选"未被立即复用"者（复用 pid 会被判活而保守等待——协议正确但调度不确定）。
- **保留并全部通过**（`src/shared/file-lock.test.ts` 6 项）：活跃持有者超阈值不被抢占；真实子进程 SIGKILL 崩溃后等待者恢复获取（<4s，不等待锁龄）；多回收者竞争无重叠无丢失；旧持有者延迟释放不删新锁；普通并发计数；不可读锁视为存活。**agent 与管理员子进程并发配对**（security.test 真实子进程用例）保留通过。
- 实现缺陷顺带修复：claim 文件改按 token 唯一命名（固定名会让并发回收者在 rm/wx 上互踩，出现 EEXIST）。

## 包内与全量验证

- `pnpm run typecheck` exit 0；`pnpm test` = tsc + 漂移检查 + **236/236** node 测试 + installer-check **17/17**。
- 重新打包 0.5.0：`pack/shipkit-0.5.0.tgz`（sha256 `da807dbd…8739`）、`pack/ship-agent-0.5.0.tgz`（`eb5adaba…0f5b`）。
- 仓库外隔离安装冒烟 **17/17**（`pnpm run smoke:package`，日志 `package-smoke2.log`），其中新增三项包内验证：安装包内 agent + 多个 `--pair` 管理员子进程在 security.json 上真实竞争——**所有成功返回的配对 token 均可认证**、**每个码恰好消费一次（重放 401）**、**共享状态无丢失更新**。
- 边界：systemd/公网 TLS/真实仓库等真实环境验收不变；本轮未操作生产/云资源/真实 GC/发布。

## 本轮产物哈希

- `src/shared/file-lock.ts`：见上方输出（重写后）。
- 日志目录：`/tmp/codex-tool-runs/svton/m2-r2-final-20260930/`（repro-before.json、reap-adjusted-final4.log、test-full.log、pack.log、package-smoke2.log、typecheck.log）。

---

# M2-R2 收口轮·二（2026-09-30，prev 目录 + 回收者 pid 所有权）

依据：[`.prev` 协议独立复核](m2-r2-protocol-review.md)。上一轮的 prev 是 `lock` 的硬链接，mtime 继承原锁；按 mtime>500ms 清理既不能证明回收者死亡、也不能证明回收权失效——活回收者被误清后，其无条件 `rename(claim,lock)` 会覆盖新持有者的活锁。复核给出两个确定性失败场景（`maxActive=2, aOverwroteLiveB=true`）。本轮只修此项。

## 根因与新协议不变量

根因：**回收权的失效判定建立在时间之上**（且该时间还是继承来的），而正确判据只能是**存活**。

新协议（`src/shared/file-lock.ts` 重写，194 行）：

1. **获取**：`open(lock,'wx')` 原子排他（不变）。
2. **持有**：身份行一次写入不变；活 pid 永不过存活判定 → 活锁永不被替换/移走（不变）。
3. **回收权**：`mkdir(lock.prev)` 为原子唯一槽位；回收者以 `'wx'` 写入 `lock.prev/owner`（`reaper_pid\treaper_token\tdead_token`）。归属规则：
   - owner 存在且回收者 pid **活** → 任何人不得动 prev，**无时间上限**（暂停/慢的活回收者永不被抢）；
   - owner 存在且回收者 pid **死** → 任何人可清后重新竞争（崩溃恢复由存活判定决定，与年龄无关）；
   - owner 缺失（mkdir→write 间死亡）→ 仅当**目录自身 mtime**（=回收开始时刻，**不再继承死锁 mtime**）超过 PREV_RESIDUE_MS 才视为残骸可清；若活回收者的半成品 prev 被清，其 owner 'wx' 写入失败（ENOENT/EEXIST）→ **本轮放弃并重循环**，不可能覆盖接管者。
4. **替换**：prev 归属自己时**再读 lock 核对 == dead_token**（过期证据在此退让），随后 `rename(claim,lock)` 原子替换（路径恒存在，无空窗）。核对后到 rename 之间无人能写路径（需 prev/需路径空/需我死，皆不可能）。
5. **释放**：仅当锁 token 仍是自己的才 unlink（不变）；进入前尽力交回 prev（先 unlink owner 再 rmdir——rmdir 只删空目录，竞争者新建的 prev 不会被误删）。
6. 等待遵循 timeoutMs（20–50ms 抖动睡眠，无忙等）；不可读锁保守等待、明确超时（不变）。

## 修复前后复现（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before-scenario{1,2}.json`）：两场景 `maxActive=2、aOverwroteLiveB=true、activeAtObservation=2`；`prevAndLockSameInode=true`（硬链接结构性证据）。
- **修复后**（同脚本，仅按新协议调整调度观察顺序——见下）：两场景 `maxActive=1、aOverwroteLiveB=false、activeAtObservation=1、bEnteredDuringPause=false、bEventuallyAcquired=true、prevAndLockSameInode=false`（`repro-after-scenario{1,2}.json`）。

**注入点与调度调整依据**：注入点不变（场景 1：A 通过身份核对后、`rename(claim,lock)` 前暂停 650ms；场景 2：死锁预老化 650ms、A 取得 prev 后无额外暂停）。调度仅两处、均为"旧缺陷行为不再发生"的必然结果：bEntered 由无限等待改为 1.2s 限时探测（原等待的目的就是观察 B 是否进入——修复后不进入，限时探测保留同等观察能力）；B 的等待预算改为覆盖 A 的完整持有（9s），并在断言中**新增** `bEventuallyAcquired`（排除"让所有竞争者失败"式规避——旧脚本 B 的 3s 超时建立在"靠缺陷提前进入"之上）。`maxActive/aOverwroteLiveB/activeAtObservation` 断言原样保留。

## 持久回归

`src/shared/file-lock-race.test.ts` 重写为 5 个场景（`pnpm test` 内，核心断言全程 `maxActive===1` 实时计数）：
- **s1 长暂停**：A 暂停 650ms（>PREV_RESIDUE_MS）→ B 不得进入/不得清 A 的槽 → A 独占完成 → B 随后以自身身份获得（B 持有期间锁身份快照断言）。
- **s2 旧锁 mtime 继承**：死锁预老化 650ms；断言 prev 与锁**不同 inode**（硬链接根除的结构证据）+ B 等待后串行获得。
- **s3 回收者持 prev 死亡恢复**：owner 记录真实退出子进程 pid → 等待者按存活判定清理残骸并接管（<4s，不等待年龄阈值）；临界区内断言持有 pid=自己、残骸已清。
- **s4 半成品 prev**：老化残骸被清理并恢复；**新鲜**半成品不被删（保守等待→明确超时）。
- **s5 过期证据退让**：A 死判后暂停在 mkdir(prev) 前，B 完整接管进入 → A 在身份核对处退让（明确超时报 holder alive），B 活锁逐字未变，无 `.prev/.claim` 残留。

既有回归全部保留通过：`file-lock.test.ts` 6 项（活跃持有者超任意时长不被抢占、真实 SIGKILL 崩溃收割 <4s、多回收者竞争串行、旧持有者延迟释放不删新锁、普通并发计数、不可读锁保守）、`security.test.ts` 的 agent+管理员真实子进程并发配对。R1/R3/结构整顿无回退（installer-check 17/17 + 漂移检查通过）。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **239/239** node 测试 + installer-check **17/17**。
- 打包：`pack/shipkit-0.5.0.tgz`（sha256 `2b8e6c99…68ab`）、`pack/ship-agent-0.5.0.tgz`（`1a9e67e1…2379`）；`src/shared/file-lock.ts`（`98337103…d68c`，194 行 ≤200）。
- 仓库外离线安装冒烟 **17/17**（含包内 agent + 多 `--pair` 子进程并发配对：token 全可认证、码恰好消费一次、无丢失更新）。
- 日志：`/tmp/codex-tool-runs/svton/m2-r2-lock-final-20260930/`（repro-before/after ×2、test-full.log、pack.log、package-smoke.log、typecheck.log）。
- 剩余限制：同主机锁（跨机共享 workRoot 非支持形态）；pid 复用可能把死锁误判为活（保守等待→明确超时，fail-safe 不破坏互斥）；owner 缺失的半成品残骸仍以目录自身年龄为清理依据（唯一的时间判定，且该 mtime 是回收开始时刻、不再继承；被误清的活回收者由 owner 'wx' 失败兜底放弃）。

**状态：实施方修复验证通过，待独立复核确认。** 真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·三（2026-09-30，代次安全清理）

依据：[第四轮复核：回收目录所有权](m2-r2-owner-review.md)。上轮协议的两个失败入口同根：**对固定路径 `prev` 的删除没有绑定"我判断过的那一代"**——窗口 A（判死后、rm 前暂停；B 清残重建后 A 的 rm -r 删掉 B 的新目录并二次取得回收权）与窗口 B（mkdir 后发布 owner 前暂停；A 恢复后 wx 真实 EEXIST，但 catch 里的 rm -r 删掉 B 的目录）。两场景实测 `maxActive=2、removedLiveBOwner=true、overwroteLiveB=true`。

## 方案选择（选型依据）

- **flock(2)/fcntl 记录锁**：内核级互斥、崩溃自动释放，是理想原语；但 Node 无内置绑定，`flock` CLI 仅 Linux（util-linux，macOS 无），原生模块需编译且破坏离线 npm 包分发（无 prebuild、目标机无工具链）——否。
- **Unix domain socket 绑定**：bind 独占原子、进程死亡内核释放；但"connect 探活→unlink 残留→重绑"与被否决协议同构（检查-动作窗口，经典 LFD 问题）——否。
- **采用自实现代次安全清理**：锁路径不变量沿用四轮已验证部分；回收槽（`prev` 目录 + `owner` 文件）的**每一次清理都不可删除后来者的所有权**。

## 协议保证（不变量）

1. **锁**（沿用）：空闲获取=wx 原子；身份一次写入，活 pid 永不过死判 → 活锁永不被替换/删除；替换=持槽者核对当前死身份后的原子 `rename(claim,lock)`（路径恒存在，核对后无人可写路径）；释放=token 校验 unlink。
2. **槽位**：`mkdir(prev)` 原子唯一；owner 记录 `reaper_pid\treaper_token\tdead_token`（wx 发布）。
3. **代次安全清理**（本轮核心，消除全部检查-动作窗口）：
   - 删除死回收者的 owner：`rename(owner → owner.gone.<nonce>)` **原子拿走** → 读 gone 内容与**判死的那一代逐字比对** → 不等则 **rename 放回原位**（后来者的活 owner 完好归位，本轮退让）→ 相等才 unlink(gone)、`rmdir(prev)`。
   - 删除无 owner 的半成品槽：**只 rmdir**（仅空目录成功；后来者的槽必含其 owner 文件 → 结构上不可能被删）。
   - owner 发布失败（EEXIST/ENOENT）：**零副作用退让**（至多 rmdir 自己的空槽）。
   - 清理者在"拿走后、放回前"崩溃：`owner.gone.*` 惰性残留（无人再读），prev 变空目录由后来者 rmdir 兜底恢复。
4. **慢/暂停不被抢占**：已发布 owner 的取代只由 pid 存活判定（无时间上限）；年龄仅作用于无 owner 残骸且以**槽位自身创建时刻**为准。等待遵守 timeoutMs（20–50ms 抖动），不可读锁/格式坏 owner 保守等待→明确超时。

排他论证（对应两个失败入口）：互斥破坏需"活持有者的锁被覆盖"（需持槽+当前身份==判死身份——活 pid 不可能）或"其槽位/owner 被毁"（需通过任一清理——每个清理要么作用于"已在我手且代次校验过的证物"、要么受 rmdir 空目录约束；后来者的 owner 被拿走时必经逐字校验并放回）。窗口 A 的交错在新协议下：A 拿走的是 B 的活 owner → 校验≠judged → **放回** → A 退让等待；窗口 B：A 的 wx 真实 EEXIST → 退让（零删除）→ 等待。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before-{stale,publish}.json`）：两场景 `maxActive=2、removedLiveBOwner=true、overwroteLiveB=true、bLockChanged=true`。
- **修复后**（`owner-race-gen.mjs`，同一交错语义，注入点与断言调整见下）：两场景 `maxActive=1、removedLiveBOwner=false、bOwnerRestoredIntact=true、overwroteLiveB=false、aReachedReplace=false、aHeldAfterB=true、aHeldFreshIdentity=true、bEventuallyAcquired=true、aResult.ok=true`（`repro-after-{stale,publish}.json`）。

**注入点调整依据**：窗口 A 的危险瞬间="判死后即将动共享路径"——旧 hook=rm(prev) 前；新协议中该动作唯一入口=rename(owner→gone) 拿走前（同一点）。窗口 B 的瞬间="mkdir 后、owner 发布前"——新协议发布用 `open(wx)` 而非 writeFile，hook 相应移至 open(prev/owner,'wx')。断言保留 maxActive/removedLiveBOwner（等价观察：**A 全部动作后 B 的 owner 仍在原位且逐字未变**——旧形式观察 rm 删除时点）/overwroteLiveB；bLockChanged 改为等价的 `aHeldFreshIdentity`（A 之后获得必须是全新身份的正常换代，而非对 B 的覆盖）；新增 `aReachedReplace=false` 与 `bEventuallyAcquired/aResult.ok`（双方最终都成功——排除"让所有竞争者失败"式规避）。观察点移至 B 的 rename 之前（B 自我 dropPrev 发生在进入临界区前，否则 owner 观察会被 B 自己的合法清理污染）。

## 持久回归与验证

- `file-lock-race.test.ts` 新增 **s6（stale-cleanup）**：A 暂停在原子拿走前，B 接管至替换前（观察窗口），A 恢复——断言 B 的 owner 逐字复原、无人进入临界区、B 以自身身份持有、A 之后获得、`maxActive=1`；**s7（publish-failure）**：A 暂停 650ms（>残骸阈值）于 open(wx) 前，B 清空槽接管——断言 A 恢复后 B 的 owner 未被删除、逐字未变、同上行为断言。
- 保留并全部通过：s1（长暂停 650ms）、s2（旧锁 mtime 继承+inode 断言）、s3（回收者持槽死亡恢复）、s4（半成品残骸：老化可恢复/新鲜不删）、s5（过期证据退让）、活持有者保护、真实 SIGKILL 崩溃收割、多回收者竞争、旧持有者延迟释放、普通并发计数、不可读锁保守——共 13 项；`security.test.ts` 的 agent+管理员真实子进程并发配对保留。
- 全量：typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **241/241** + installer-check **17/17**；打包 `shipkit-0.5.0.tgz`（`2ffd4b44…b27b`）、`ship-agent-0.5.0.tgz`（`6a24bca3…454b`）；`src/shared/file-lock.ts` 199 行（≤200，`1999ca19…e225`）、`file-lock-race.test.ts`（`71701b4e…f095`）；仓库外离线安装冒烟 **17/17**（含包内 agent+`--pair` 子进程并发配对：token 全可认证、码恰好消费一次、无丢失更新）。日志：`/tmp/codex-tool-runs/svton/m2-r2-gen-20260930/`。
- 剩余限制：同主机锁；pid 复用可能把死判保守化为活（明确超时，fail-safe）；ownerless 残骸仍以槽位自身年龄为清理依据（协议中唯一时间判定，被误清的活发布者由 wx 失败+零副作用退让兜底）；无新增依赖。

**状态：实施方修复验证通过，待独立复核确认。** 真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·四（2026-09-30，崩溃恢复与有界等待）

依据：[第五轮复核：崩溃恢复与无界重试](m2-r2-generation-review.md)。两个确认问题：(1) `rename(owner → prev/owner.gone.<nonce>)` 的目标仍在 prev 目录内——清理者在拿走后、校验/删除前崩溃会留下 gone 文件，目录永不为空，rmdir 无法恢复；(2) ownerless 分支吞掉 rmdir 失败却返回 retry，主循环直接 continue 绕过 timeoutMs 与抖动退避，形成无界重试（复核实测：timeoutMs=150 的等待者 1202ms 仍未返回）。

## 根因与协议依据（本轮重设计）

- 根因 1：**"拿走-校验-放回"的中间证物落在槽位目录内**，崩溃后产生既非"记录在位"也非"空目录"的第三态。
- 根因 2：**retry 分支绕过统一截止时间**。

新协议（`src/shared/file-lock.ts` 重写，198 行，接口不变）——**以发布者 nonce 具名记录取代"拿走"动作**：

1. **锁不变量沿用**（wx 原子获取、活 pid 永不过死判、持槽+死身份核对后原子替换、token 校验释放）。
2. **槽位记录具名**：`prev/owner.<publisher_nonce>`，内容 `reaper_pid\tdead_token`。**删除死回收者的记录 = unlink 观察时解析出的那个确切文件名**——后来者的记录是**不同文件名**，故无论清理者停留多久，unlink 在结构上不可能命中后来者的记录（检查-动作窗口对"文件名"无害：文件名不会易主）。**"拿走-放回"中间态不复存在**。
3. **崩溃点穷尽**（不存在第三态残留）：
   - unlink 前：记录仍在位 → 后来者重新走读→判死→unlink ✓；
   - unlink 后、rmdir 前：槽位目录**真空**（无 gone 证物）→ 后来者 rmdir 恢复 ✓；
   - rmdir 后：槽位已释放 ✓；
   - 恢复者再崩溃：回到上述任一点 ✓；
   - 误删活记录：结构上不可能（不同文件名）；多条 owner.* 并存视为异常，保守 wait。
4. **统一截止时间**：主循环重构为 `while(!acquired)`，所有非成功路径（reclaimed/发布失败/过期证据/wait）**统一**经过 `deadline 检查 + 20–50ms 抖动退避**，无任何 continue 旁路。

**纠正前轮错误说明**：上一轮处置记录中"gone 惰性残留、prev 变空目录可由 rmdir 恢复"的表述不实——gone 在 prev 内使目录非空。本轮以"具名记录 + 无拿走动作"消除该状态，说明已在本节纠正。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before.json`）：`observedMs=1202 > timeoutMs=150`、`exitedBeforeWatchdog=false`、`residueAfterCrash=["owner.gone.<nonce>"]` 且等待后仍在。
- **修复后**（同脚本，注入点按等价关系调整：旧暂停点=rename(owner→gone) 后，新协议清理动作为 unlink 具名记录，暂停点=真 unlink 后；waiter 未 mock。fixture 的死身份在 cleaner 导入延迟后重挑并复验，防 pid 复用导致的非确定性等待）：`events=[started,entered,finished(elapsedMs=51)]`、`exitedBeforeWatchdog=true`、`residueAfterCrash=[]`、`residueAfterWait=null`（恢复者清走空槽）——**等待者在 51ms 内完成合法恢复并进入临界区**（150ms 预算内），无界重试消除（`repro-after.json`）。

## 持久回归

- **新增 `src/shared/file-lock-crash.test.ts`（5 项，真实独立子进程 + 真实 SIGKILL，仅受害者调度暂停注入）**：
  - c1 unlink-after 崩溃（审计时序）：记录已删、槽位真空、无 gone 残留；后来等待者恢复进入，进入时刻锁身份=恢复者自身活 pid，预算内完成。
  - c2 unlink-before 崩溃：死记录留在原位可重走；等待者经同一路径恢复。
  - c3 短超时有界：真实活持有者下 timeoutMs=150 的等待者**明确 reject**（报 holder alive）、elapsed<1500ms、干净退出、未进入。
  - c4 恢复者再崩溃：第一恢复者又死于 rmdir-after（或已恢复），后续等待者仍恢复并获得。
  - c5 多恢复者并发：3 个等待者全部在预算内 ok（串行），终态干净（锁释放、无 owner.* 残留、槽位目录清除）。
- **保留并全部通过**：`file-lock-race.test.ts` 7 场景（注入点已按新协议映射：s6 的"判死后即将动共享路径"= unlink 具名记录前；owner 观察改经 readdir 读 `owner.*`；断言不变且更强——A 的 unlink 根本不会碰 B 的不同名记录）与 `file-lock.test.ts` 6 项（活持有者保护、SIGKILL 崩溃收割、多回收者、旧持有者延迟释放、普通并发、不可读锁）。
- 全量：typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **246/246** + installer-check **17/17**；`src/shared/file-lock.ts` 198 行（≤200，无新增依赖）。
- 打包：`shipkit-0.5.0.tgz`（`7c3c51c1…dcb7`）、`ship-agent-0.5.0.tgz`（`e5e8867f…8e0f`）；源文件哈希：file-lock.ts `c5fb567d…d863`、file-lock-race.test.ts `97c8b647…14f6`、file-lock-crash.test.ts `7a43790b…8459`。仓库外离线安装冒烟通过（含包内 agent+`--pair` 子进程并发配对）。
- 日志与前后证据：`/tmp/codex-tool-runs/svton/m2-r2-recovery-20260930/`。
- 剩余限制（沿用并收窄）：同主机锁；pid 复用时死判保守化为活（明确超时，fail-safe）；ownerless 残骸仍以槽位自身年龄为清理依据（协议中唯一时间判定；rmdir 仅删空目录，不构成对后来者的威胁）。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·五（2026-09-30，目录换代与发布资格）

依据：[第六轮复核：具名记录与目录换代](m2-r2-nonce-review.md)。确认问题：具名 owner 解决了删除误命中，但**未保证发布者唯一**——A mkdir 旧目录后在发布前暂停 650ms；B 清理残骸、重建目录（新 inode）、发布 owner.B、通过身份检查；A 恢复后在新目录里 open(owner.A) 因**文件名不同而成功**（非 EEXIST），也通过身份检查——两个回收者并存，B 先替换进入后 A 覆盖其活锁。实测 `maxActive=2、overwroteLiveB=true、bLockChanged=true`，目录 inode 换代（160655887→160655889）、同一目录双记录。

## 根因与完整协议依据（重新论证，不沿用旧结论）

- **根因**：回收权的取得（mkdir 成功）与行使（发布+替换）之间，**目录身份未被绑定**——同一路径重新出现不代表还是发布者创建的那一代目录；具名文件只保证"同名唯一"，不保证"父目录发布者唯一"。`inspectPrev` 的多记录保守等待只能约束后到的检查者，不能阻止已取得资格的双方。

新协议（`src/shared/file-lock.ts` 重写，199 行，接口不变）建立**目录创建代次 → 发布资格 → 身份检查 → 最终替换**的完整排他链：

1. **代次（GENERATION）**：mkdir 成功者立即 stat 记录目录 inode。此后该目录若含活记录则不可被清理（清理需目录内记录全死或为空），即活记录把目录"钉住"。
2. **发布资格（ELIGIBILITY）**：发布 `owner.<nonce>` 后，发布者**重读目录 inode == 创建时 inode 且重读自己的记录仍原样存在**。停滞发布者的原代次目录若已被回收重建（其 ownerless 残骸老化、他人重建），此检查**必然失败**——记录落在新代次目录里，inode 不匹配——发布者退让并只删除自己的具名记录。检查通过后资格不可再丢失：自己的活记录钉住目录，任何清理者都不能删除/重建它。
3. **身份检查（IDENTITY）**：资格持有者重读锁身份 == 判死身份（过期证据退让并释放槽位）。
4. **替换（REPLACE）**：`rename(claim, lock)` 原子替换，路径不消失（无空窗）。

崩溃残留仍只有两态（记录在位可重走 / 空目录可 rmdir）；所有重试路径统一 deadline+抖动退避（第六轮修复保留）。本轮交错在新协议下的推演：A 恢复→发布 owner.A 成功于新目录→**代次验证 stat=inode₂≠inode₁→退让**→退避→读到 owner.B 活→等待；B 独占替换进入。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before.json`）：`maxActive=2、overwroteLiveB=true、bLockChanged=true`、双记录、目录换代。
- **修复后**（同脚本调度按等价关系调整——注入点不变（A 暂停在 open(owner.A) 前 650ms、双方 rename 前可暂停）；调整的是**观察顺序**以适配"A 被提前阻止"的正确结果：A 恢复后先观察是否重叠/改写，再释放 B 验证 A 最终合法获得；A/B 预算增至 9s 覆盖 B 的完整持有；断言字段 maxActive/overwroteLiveB/bLockChanged 全保留）：`maxActive=1、overwroteLiveB=false、bLockChanged=false、aReachedReplace=false`（A 未到达替换——在代次验证处被阻止）、`aOverlappedDuringHold=false`、目录内仅 owner.B 一条记录、`bResult.ok=true、aResult.ok=true`（B 释放后 A 合法获得，非"让所有竞争者失败"式规避）（`repro-after.json`）。

## s7 盲点修正与持久回归

- **s7 重写**（复核指出的盲点：旧注释假设 EEXIST 冲突、A 的临界区立即 enter/exit 无法观测重叠）：新 s7 **同时控制双方替换时机**——A 暂停在发布前（其代次目录被 B 回收重建），B 在替换前暂停开观察窗；A 恢复后在代次检查处退让（提前阻止，按等价调度验证）；**B 进入并保持临界区**（800ms 观察窗断言 A 未重叠、B 锁身份未变）；B 正常释放后 A 在预算内合法获得；全程 `maxActive=1`；断言无槽位/claim 残留。
- 保留并全部通过：s1–s6（长暂停/旧锁 mtime/回收者持槽死亡/半成品残骸/过期证据/判死后清理）、`file-lock-crash.test.ts` c1–c5（真实 SIGKILL：unlink 前后崩溃、rmdir 后崩溃、恢复者再崩溃、短超时有界、多恢复者串行）、`file-lock.test.ts` 6 项——锁相关 **18/18**。
- 全量：typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **246/246** + installer-check **17/17**；199 行 ≤200、无新增依赖。
- 打包：`shipkit-0.5.0.tgz`（`e96e7915…3f1e`）、`ship-agent-0.5.0.tgz`（`26f38d2f…2e5d`）；`file-lock.ts`（`e5c9cfb3…bc29`）、`file-lock-race.test.ts`（`59d987d4…0d8cc`）。仓库外离线安装冒烟通过（含包内 agent+`--pair` 子进程并发配对：token 全可认证、码恰好消费一次、无丢失更新）。
- 平台与限制：同主机锁；inode 对比为 `stat().ino`（macOS APFS / Linux ext4 均为活动目录生命周期内稳定）；pid 复用时死判保守化为活（明确超时，fail-safe）；ownerless 残骸仍以槽位自身年龄为清理依据（唯一时间判定，仅作用于真空目录）；无新增依赖，分发兼容性不变。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·六（2026-09-30，fd 凭据协议）

依据：[第七轮复核：mkdir 与首次 stat 的窗口](m2-r2-inode-review.md)。确认问题：`mkdir` 成功与首次 `stat` 是两个独立异步操作——A 在其间暂停时，B 回收空目录并重建，A 恢复后把**新目录 inode 错认成自己创建的代次**，发布具名记录后全部校验自洽通过，与新发布者双回收权、覆盖活锁。实测 `maxActive=2、overwroteLiveB=true、bLockChanged=true`，目录 inode 换代（160692661→160692664）。

## 根因与协议依据（从头论证，不沿用旧假设）

- **根因**：按路径读取的 inode 不是创建操作的返回身份——"取得回收权"与"取得不可混淆的凭据"从未绑定；发布后反复 stat 无法纠正首次采样已错的情况。

新协议（`src/shared/file-lock.ts` 重写，197 行，接口不变）——**回收权与身份凭据在同一次原子调用中取得**：

1. **资格（ELIGIBILITY）**：`fd = open(prev,'wx')`——**open(wx) 是唯一"创建并返回句柄"的原语**，fd 即本次创建的 inode 之身份，无论路径随后如何。身份行（`pid\tdead_token\tcall_nonce`，nonce 为**每次调用唯一**，区分同进程并发——同 pid 下 payload 不足以识别调用者，这是本轮修复中实测发现并关闭的伴生缺陷）**通过 fd 写入**——落在自己创建的 inode 上；路径若已被回收重建，写入走向孤儿 inode，槽位检查必然失败。
2. **槽位检查（SLOT CHECK，发布后与替换前各一次）**：`stat(prev).ino == fd 的 inode`。路径任一时刻只有一个 inode → **至多一个候选者能对当前代次通过**；被顶替者退让、close fd（孤儿 inode 随之消散）、且仅在 nonce 匹配时删除路径记录。
3. **身份重验（IDENTITY RE-CHECK）**：锁仍携带判死身份，否则退让。
4. **替换（REPLACE）**：`rename(claim, lock)` 原子（路径不消失）；进入前重读锁==自己，否则重循环——并发替换收敛到**最后写者唯一**。
5. **死槽回收（inspectPrev）**：**原子隔离**——`rename(prev → prev.dead.<nonce>)` 移到平级名，核对移走后 inode==观察时 inode，**按内容处置**：死记录/老化的无主残骸（以文件自身 mtime）从隔离名删除；活记录恢复原位。隔离动作碰不到后来者：抢占空缺路径的候选拥有**不同 inode**，恢复至多使其孤儿化（其槽位检查会退让）。**这不是被证伪的"移走后放回"回收权**——资格始终由 open(wx)+fd 原子取得，隔离文件只是待删对象的隔离区，其崩溃残留是惰性平级路径、不阻塞任何操作（区别于第六轮 gone 文件卡死目录的问题）。
6. 全部重试路径统一 deadline+抖动退避；崩溃残留两态（无主空文件/死记录，均可重走）；活 pid 永不被判死。

**本轮交错的封闭**：A open(wx) 取得 fd（凭据原子绑定）→ 暂停 → B 回收无主残骸、重建、发布、通过全部检查并替换进入 → A 恢复：写入落在**孤儿 inode** → 槽位检查 `stat(path)≠fd` → **退让** → 等待 → B 释放后合法获得。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before.json`）：`maxActive=2、overwroteLiveB=true、bLockChanged=true`、双记录、目录换代。
- **修复后**（同脚本，注入点按等价关系调整：旧="mkdir 成功后、首次 stat 前"；新协议的等价瞬间="**open(wx) 成功（创建即凭据）后、首次身份写入/采样前**"——hook 在真 open 返回 fd 后暂停；观察顺序适配"A 被提前阻止"：先探测 A 是否到达替换/是否重叠、B 保持期间锁身份是否被改写，再释放 B 验证 A 最终合法获得；断言字段 maxActive/overwroteLiveB/bLockChanged 全保留）：连续三次运行 `maxActive=1、overwroteLiveB=false、bLockChanged=false、aReachedReplace=false`（A 未达替换——阻于槽位检查）、`aOverlappedDuringHold=false`、`bResult.ok=true、aResult.ok=true`（`repro-after.json`）。

## 持久回归

- `file-lock-race.test.ts` 重写 s5/s6/s7 并**新增本轮窗口为 s7 主体**（"credential taken, first identity sampling not yet run"：A 恰在 open(prev,wx) 返回后暂停 650ms，B 经无主残骸老化路径完整接管并在替换前开观察窗；A 恢复后于槽位检查退让、B 持有期间（800ms 窗）无重叠、B 锁与记录未被动、B 释放后 A 合法获得；全程 maxActive=1）：
  - s5（过期凭据）：A 取得 fd 后未发布即停滞，B 完整接管并**保持临界区**——A 退让且不触碰 B 的记录；
  - s6（过时清理观察）：A 停滞在死槽隔离 rename 前，B 回收接管并保持——A 的隔离按内容处置（活→恢复），B 的记录逐字复原；
  - 保留 s1–s4（替换前长暂停/旧锁 mtime/回收者死亡恢复/半成品残骸）。
- 保留并全部通过：`file-lock-crash.test.ts` c1–c5（真实 SIGKILL：unlink 前后崩溃、二次崩溃、短超时有界、多恢复者串行；fixture 已适配文件槽）、`file-lock.test.ts` 6 项——锁相关 **18/18**。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **246/246** + installer-check **17/17**；`src/shared/file-lock.ts` 197 行（≤200）、无新增依赖。
- 打包：`shipkit-0.5.0.tgz`（`66a1e1a7…8df1`）、`ship-agent-0.5.0.tgz`（`8b7c9516…8b79`）；`file-lock.ts`（`aa7a3691…caae`）、`file-lock-race.test.ts`（`38bf0841…5e38`）、`file-lock-crash.test.ts`（`25b05787…537c`）。仓库外离线安装冒烟通过（含包内 agent+`--pair` 子进程并发配对）。
- 平台与限制：同主机锁；fd/inode 语义为 POSIX（macOS APFS/Linux ext4 实测）；pid 复用时死判保守化为活（明确超时，fail-safe）；无主残骸仍以文件自身年龄为清理依据（唯一时间判定，作用于真空文件）；`prev.dead.<nonce>` 隔离名在清理者于"移走后、删除前"崩溃时残留为惰性平级文件（不阻塞任何路径操作，仅在磁盘上堆积，可人工清理）。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·七（2026-09-30，内核互斥原语）

依据：[fd 凭据协议复核](m2-r2-fd-review.md)。确认的失败时序：A 通过全部检查后在 `rename(claim, lock)` 前暂停；B 的 inspectPrev **先 rename 移走 A 的活槽位**（发生在判活之前）；C 在空出的路径上取得槽位、替换主锁并进入保持；A 恢复执行已获批的 rename，**覆盖 C 活锁**，自检双双通过、双重进入。实测 `maxActive=2、overwroteLiveC=true、cLockChanged=true、prevMissingWhileALive=true`。根因判定与复核一致：fd 绑定创建身份，但**不能阻止资格检查之后槽位被移走**；"最后写入者唯一"只描述文件终态，不保证临界区唯一——先进入者不会因锁文件被覆盖而退出。

## 方案选择（成熟原语，按复核要求验证）

九轮文件系统协议的共性根因：POSIX 没有可移植的**条件替换/条件删除**，一切"检查-动作"组合都留下被第三方插入的窗口。本轮改用**内核持有的互斥原语：TCP 端口绑定**（`node:net`，零依赖）：

- **获取 = bind**：内核保证同一 (addr, port) 任一时刻至多一个活跃 listener（macOS/Linux 一致，Node 标准库，SO_REUSEADDR 不影响活跃 listener 的独占）。**获取即持有——不存在"已批准未生效"的窗口**，本轮"A 恢复执行已获批 rename"的整类状态被消除。
- **持有 = 监听 socket 保持打开**：任何文件系统操作序列都不能夺走已绑定端口——"槽位被移走"结构性消失。
- **崩溃释放**：进程死亡由内核即刻关闭 socket、释放端口——死亡持有者恢复即时、无需任何存活启发式/年龄阈值/残留遍历（此前各轮的崩溃恢复问题整体消失）。
- **释放**：`server.close()`，仅由注册表中 token 匹配的获取方执行（`releaseLockIfOwner` 契约保留；新增 `heldToken` 诊断导出）。
- **EADDRINUSE 处理**：探针连接——shiplock 横幅（含 pid+keyhash）⇒ 活持有者（报告 pid）⇒ 等待；keyhash 不同 ⇒ 跨文件哈希碰撞 ⇒ 等待（绝不抢占，超时报 collision）；非 shiplock 横幅 ⇒ 无关服务 ⇒ 明确报错拒绝；连接被拒 ⇒ listener 正在关闭/瞬态碰撞 ⇒ 抖动重试 bind。全部等待走统一 deadline+20–50ms 抖动。
- **进程内并发**：bind 按 socket 计——同进程并发调用与独立进程完全同构序列化。
- **离线分发/平台**：`node:net`/`node:crypto` 均为标准库，无新增依赖；macOS（开发）与 Linux（部署）实测；端口由状态文件绝对路径 sha256 确定（49152–65535）。
- 连带修复：`saveCredential` 此前依赖旧锁隐式创建 `~/.ship` 目录——内核互斥不触文件系统，显式补上（其本职责）。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before.json`）：`maxActive=2、overwroteLiveC=true、cLockChanged=true、prevMissingWhileALive=true`。
- **修复后**（`fd-race-gen.mjs`，等价调度映射已写入脚本头注释：旧"A 过检后暂停于 rename 前"= 新"A 已 bind 即持有并滞留临界区"；旧"B 移走 A 活槽位"= 新"B 的 bind 失败、探针看到 A 活横幅、B 无任何可改变的状态"；旧"C 取空槽进入"= 新"C 同样等待——A 持有期间空槽状态不存在"；断言保留 maxActive/重叠/身份变迁并新增最终进展）：`maxActive=1、overwroteLiveC=false、aStillSoleHolderWhilePaused=true、holderIdentityStableWhileHeld=true`、A/B/C 全部 `ok:true`（`repro-after.json`）。实测释放后接管 162ms（150ms 人为延迟 + 内核即时）。

## 持久回归（注入点等价映射见各文件头注释）

- `file-lock-race.test.ts` **s7 = 本轮三方时序**：A bind 持有；B、C 并发竞争——A 持有期间（700ms 窗）二者均不得进入、横幅身份逐字节不变；A 释放后恰好一方以**自己的获取 token** 合法接班（同进程共享 pid+keyhash，横幅无法区分同进程调用者——身份断言改用每次获取唯一 token）；`maxActive=1`。s1 长持 650ms、s2 持有身份稳定（替代旧 mtime 继承场景）、s3 真实 SIGKILL 崩溃恢复、s4 获取后立即死亡同等恢复、s5 超时者绝不运行临界区、s6 多等待者探测不扰动持有。
- `file-lock-crash.test.ts` c1–c5（真实子进程+真实 SIGKILL：持有中被杀/获取即死/150ms 短超时有界明确拒绝/第一恢复者再死第三方仍恢复/三子进程串行全部完成且端口终态空闲）。
- `file-lock.test.ts` 6 项（活持有者不被抢占、SIGKILL 即时恢复 <4s、竞争者串行无丢失、旧 token 延迟释放不动当前持有、并发计数、无关占用者绝不抢占并明确报错）。
- 锁相关 **18/18**；全部既有竞争、崩溃恢复与有界等待语义保留。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **246/246** + installer-check **17/17**；`src/shared/file-lock.ts` 150 行（≤200）、无新增依赖。
- 打包：`shipkit-0.5.0.tgz`（`a4545e3e…5480`）、`ship-agent-0.5.0.tgz`（`d4b7cb60…8527d`）；`file-lock.ts`（`967a9550…fb26`）及三个测试文件哈希见上。仓库外离线安装冒烟通过（含包内 agent+`--pair` 子进程并发配对：token 全可认证、码恰好消费一次、无丢失更新）。
- 日志与前后证据：`/tmp/codex-tool-runs/svton/m2-r2-hold-20260930/`。
- 平台与限制（如实）：同主机；端口派生自路径哈希，跨**不同锁文件**的 16 位端口空间碰撞理论上可能——表现为活等待或超时时的明确 collision 报错，**绝不表现为互斥失效**；探针对关闭中的 listener 报瞬态并重试；无文件残留需清理（内核即 GC）。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·八（2026-10-01，TCP 方案三缺口 + 端口注册表）

依据：[TCP 内核互斥方案复核](m2-r2-tcp-review.md)。三个确认缺口：**TCP-01** `path.resolve` 不解析父目录软链接——同一物理文件经别名路径派生不同端口（实测两锁并发 `maxActive=2`、两次加一丢失一次更新）；**TCP-02** probe 未处理无数据的 end/close（Promise 永久 pending，实测 timeoutMs=100 观察 1600ms 仍未返回）且固定 1200ms 不遵守剩余预算（实测 100ms 预算 1202ms 才失败）；**TCP-03** `closeAllConnections` 在实际对象上不存在（可选调用不执行），半开客户端拖住 `server.close`（实测 350ms 后 withFileLock 未完成，销毁客户端立即完成）。另确认**集成阻塞**：两次全量 245/246，分别因跨锁端口碰撞（不同 keyhash 的 shiplock 占用）与端口忙无横幅而超时。

## 修复内容与协议依据

- **TCP-01（统一数据资源与锁资源身份）**：新增 `lockKeyOf(file)`——`path.resolve` 后**对最深现存祖先目录做 `realpathSync`** 再接回剩余分量：父目录别名归一（真实目录与其软链接下的同名文件同一 key）、目标不存在也可用（首次创建）、不依赖目标文件 inode（secureWrite 原子替换不受影响）；**最终分量为符号链接则拒绝加锁**（与 secureWrite 规则一致）。获取、释放、诊断（`heldToken`）全部经同一 `lockKeyOf`。端口由 key 经注册表派生（见下）。
- **TCP-02（探测生命周期与预算贯穿）**：probe 的 data/end/close/error/timeout 全部经单一 `finish` 守卫**恰好结算一次**，定时器在所有路径清除、连接销毁；预算 = `min(剩余时间, 1200ms)` 由调用方 deadline 贯穿。EOF 无横幅 → 'none' → 在同一 deadline 下抖动重试。**本轮新增发现并修复的超预算残留缺陷**：截止前最后一次探针可能只剩 1ms，超时先于横幅到达被判 'none'，覆盖此前 N 次 "shiplock-ours" 的正确分类（复现于 file-lock.test 间歇失败，9 次探针中 8 次正确、末次 1ms 预算误报 no-banner）——修复为**探针结果记忆**（'none' 不擦除既有信息）+ **预算下限 20ms**（不足则直接按记忆分类报错）。
- **TCP-03（显式连接跟踪）**：`bindTracked` 在 `connection` 事件把每个接受的 socket 存入集合并挂 `close` 清理；`shutdown` **先 destroy 全部仍开连接再 close**——半开客户端、业务异常、正常结束都确定完成清理，不依赖对端行为，也不依赖 `closeAllConnections` 的存在。
- **集成阻塞（端口注册表）**：新增 `src/shared/lock-registry.ts`——key→端口映射经 OS tmpdir 下内容寻址的声明文件（`wx` 原子领取）：**同 key 永远同端口**（同资源竞争者绝不分裂）；分配时读取其他 key 的已领取集合并**真实 bind 探测候选端口**，跳过任何当前占用者（无关服务/其他锁/临时 socket——不终止任何服务、不随机换口）；同 key 并发领取竞争由 wx 失败方读胜者收敛；注册表不可用时回退纯哈希（碰撞表现为等待或明确报错，绝不互斥失效、绝不分裂）。**该设计直接消除复核观察到的两类全量失败**：跨锁碰撞（不同 key 现在不同端口）与哈希端口被无关服务占用（分配时避开）。配套 `src/shared/lock-bindtest.ts`（仅回答"此刻是否有人绑定"，不终止任何东西）。

## 修复前后证据（同构验证）

- **修复前**（复核两脚本原文重跑，`repro-before-{boundaries,probe}.json`）：alias `maxActive=2、finalCounter=1≠2、ports=[63513,52844]`；shutdown `resolvedWhilePeerOpen=false`；silent `elapsedMs=1201（预算 100）`；probe-eof `observedMs=1600、settled=false`。
- **修复后**（`tcp-boundaries-gen.mjs` 等价调度——修复使破损状态不可达，观察移至固定后的等价物：旧"别名双锁并发"= 新"别名第二获取等待"，断言保留 maxActive/计数/双完成；probe-eof 脚本原样可跑）：alias `maxActive=1、portsSame=true、finalCounter=2、aResult/bResult ok`；shutdown `resolvedWhilePeerOpen=true`；silent `elapsedMs=101`；probe-eof `settled=true`（`repro-after-{boundaries,probe}.json`）。

## 持久回归

- **新增 `src/shared/file-lock-tcp.test.ts`（5 项，全部真实 TCP/符号链接，无 mock）**：TCP-01 别名同端口+串行无丢失+符号链接目标拒绝；TCP-02 EOF 无数据/静默占用按预算有界失败 + 正常横幅分类/异常断开有界结算；TCP-03 半开访客不阻塞释放+业务异常清理+接班+无连接残留；注册表——不同 key 不同端口 + **无关监听者占据新 key 的首选哈希候选时分配自动避开**（第二次全量失败模式的确定性复现与验证）。
- 保留并全部通过：race 7 项（含三方时序）、crash 5 项（真实 SIGKILL 各点/短超时有界/多恢复者）、base 6 项（活持有者/崩溃恢复/竞争者/延迟释放/计数/无关节点绝不抢占——已适配为"占用**已领取**端口"）。锁相关 **23/23**。既有全部竞争、崩溃恢复与有界等待语义不回退。
- 间歇失败回归：file-lock.test 首测连续 8 次通过（修复前约 1/3 失败率）。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **251/251** + installer-check **17/17**——**两次独立全量均通过**（修复前两次均 245/246），端口碰撞不再阻塞集成验收；`file-lock.ts` 197 行、`lock-registry.ts` 83 行、`lock-bindtest.ts` 19 行（均 ≤200，无新增依赖）。
- 打包：`shipkit-0.5.0.tgz`（`51b49226…7e95`）、`ship-agent-0.5.0.tgz`（`02af9921…09da`）；`file-lock.ts`（`943c49e6…6922`）等哈希见上。仓库外离线安装冒烟通过（含包内 agent+`--pair` 子进程并发配对）。
- 日志与前后证据：`/tmp/codex-tool-runs/svton/m2-r2-tcpfix-20261001/`。
- 平台与限制（如实）：同主机；注册表声明文件按内容寻址持久存在于 OS tmpdir（崩溃残留惰性，仅固定端口号，无互斥影响；生产 key 稳定、测试 key 每次全新）；分配与持有之间理论上仍可能被新占用者抢先（表现为明确报错/等待，不互斥失效）；回退路径碰撞表现为等待或明确报错。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·九（2026-10-01，注册表命名空间 / fallback / 缺失分量）

依据：[TCP 注册表修复独立复核](m2-r2-tcp-registry-review.md)。三个确认缺陷：**REG-01** 注册表位于进程 tmpdir——同主机两进程仅 TMPDIR 不同即为同一文件分配不同端口（实测同键双端口 51256/61562、同时保持 2、两次加一终值 1）；**REG-02** 64 候选不可用时 claimPort 返回未持久化的纯哈希 fallback 并缓存——候选恢复后另一进程发布不同端口的 claim 与旧 fallback 双重进入（实测同 TMPDIR 亦分裂）；**KEY-01** lockKeyOf 寻找现存祖先是丢掉缺失中间目录——持锁回调创建父目录后同一路径变成不同 key（实测 65442/55135 双端口、同时 2、终值 1），且 finally 重算 key 找不到原 holding——withFileLock 成功返回但监听与 token 泄漏。

## 修复内容与协议依据

- **REG-01**：注册表移至**固定主机位置 `/var/tmp/shipkit-lock-ports`**（模式 0777）——与 TMPDIR/TMP/TEMP 完全无关，同主机所有进程共享一个命名空间与每个 key 的唯一 claim；"per-host"注释所声称的语义现在成立。
- **REG-02**：**删除未登记 fallback**——候选耗尽或注册表不可用时 claimPort **有界保守失败**（明确报错、绝不返回未登记端口作为成功锁）；故障解除后下一次调用正常分配（回归验证）。发布改为**写临时文件 + 原子 rename**：claim 要么不存在要么完整；并发发布者 rename 后重读收敛于胜者；**空/撕裂 claim（含旧撕裂写入）由一次 rename-over 修复**——对同 key 的并发修复安全（后写胜、双方重读收敛）。同时**移除进程内缓存**：缓存端口会掩盖他进程修复到不同端口后的两份视图（测试开发中发现并消除的分裂路径）。
- **KEY-01**：lockKeyOf 向上寻找现存祖先时**收集并保留全部缺失分量**，`realpath(现存祖先) + 全部剩余分量`——多层父目录在临界区内创建前后 key 逐字节一致；最终分量符号链接仍拒绝；目标 inode 不参与（原子替换稳定）。**释放绑定获取时身份**：`withFileLock` 的 finally 直接按获取时的 `holding` 对象释放（不再从路径重推导）；公开 `releaseLockIfOwner(lockPath, token)` 先按当前 key 查找、未命中则按 **token 精确匹配**（仍拒绝一切非调用者所有的释放——旧 token 不影响新持有者的契约保留）。

## 修复前后证据（同构验证）

- **修复前**（复核脚本原文重跑，`repro-before-registry.json` / `repro-before-identity.json`）：三场景 `simultaneousSections=2、finalValue=1≠2`；identity-release `leakedHoldingAfterSuccessfulReturn=true`。
- **修复后**（同脚本）：三场景 `simultaneousSections=1、finalValue=2`，键前后一致；identity-release `leakedHoldingAfterSuccessfulReturn=false、retainedOriginalToken=false`（`repro-after-*.json`）。

## 持久回归

**新增 `src/shared/file-lock-registry.test.ts`（5 项，真实子进程 + 隔离 TMPDIR + 真实 claim 文件，无 mock）**：
- REG-01：不同 TMPDIR 命名空间的两个真实子进程共享同一 claim——A 持有期间 B 等待、终值 2；
- REG-02：用**自有**监听占满 64 候选 → claimPort 保守失败（不产生未登记锁）；释放后恢复正常获取（故障解除可推进）；
- REG-02：空 claim 与撕裂 claim 分别被修复为可用锁（声明完整），另一进程收敛于同一修复后端口；
- KEY-01：临界区内创建多层父目录——key 逐字节不变、第二进程等待、终值 2；
- KEY-01：进程内释放绑定获取身份——成功返回后无 holding 残留、端口无自监听残留、旧 token 幂等拒绝且不影响新持有者。

保留并全部通过：TCP-01/02/03（5 项）、SIGKILL 崩溃恢复（5 项）、竞争场景（7 项）、基础（6 项）——锁相关 **28/28**。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **256/256** + installer-check **17/17**；`file-lock.ts` 199 行、`lock-registry.ts` 90 行（≤200，无新增依赖）。
- 打包：`shipkit-0.5.0.tgz`（`ffe0dca2…c90`）、`ship-agent-0.5.0.tgz`（`b0083bfc…7a4d`）；`file-lock.ts`（`117119d4…1aec`）、`lock-registry.ts`（`8a158c78…854b`）、`file-lock-registry.test.ts`（`02bfbd4d…887`）。仓库外离线安装冒烟通过（含包内并发配对）。
- 日志与前后证据：`/tmp/codex-tool-runs/svton/m2-r2-keyreg-20261001/`（一次中断运行遗留的孤儿测试进程曾污染后续全量——清理后全新注册表全量通过；非本修复缺陷，已在记录中说明）。
- 平台与限制（如实）：同主机；注册表条目按唯一 key 累积（每条一个小文件；陈旧条目仅固定端口号，绝不破坏互斥；开发机可定期删除 `/var/tmp/shipkit-lock-ports`）；`/var/tmp` 需可写（不可写时明确报错拒绝加锁——保守，不分裂）；跨用户共享同一注册表受 sticky 位约束（rename 他人的 claim 会失败→重读收敛于对方端口，不分裂）。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd（含 /var/tmp 权限与 SELinux/AppArmor 策略实测）、公网可信 TLS、远端 registry 推拉、首个应用发布。

---

# M2-R2 收口轮·十（2026-10-02，发布互斥与预算贯穿）

依据：[原子发布独立复核](m2-r2-atomic-publish-review.md)。两项确认缺陷：**REG-03** `publishClaim` 用 rename 覆盖发布且"重读"不构成唯一发布权——B 读到 claim 缺失后在首次 bindTest 前暂停，A 发布 63023 并持锁，B 恢复后跳过 A 已占端口选 62536，rename 覆盖 A 的有效 claim 并同时进入（同 keyhash 双端口、同时保持 2、两次加一终值 1）；**WAIT-01** deadline 创建于 claimPort 之前但注册表分配与首次 bind 不检查预算——159 个 claim 的真实注册表上 timeoutMs=20 仍 33.5ms 进入回调；注入 250ms 分配暂停时 timeoutMs=50 仍 288.98ms 进入且成功返回。

## 修复内容与协议依据（发布/获取/释放的并发论证）

- **REG-03（唯一发布权）**：claim 发布从"先到先得 rename"改为**串行化发布事务**：每个 key 的发布/修复全部经由 registry 本地**发布互斥**（对 claim 文件的 `<claim>.publock` 目录做原子 mkdir——内核串行化、不占任何 TCP 端口；陈旧持有者按 **PID 存活**判定回收，绝不按年龄）。发布者在互斥内**重读 claim**：任何已存在的有效映射被遵循并直接返回，迟到分配者的陈旧"缺失"快照因此不可能覆盖活映射。**活持有者发现**：claim 文件存在但内容损坏（撕裂记录）时，发布互斥内对 key 的确定性候选端口序列探测携带本 key keyhash 的横幅——活持有者的端口按构造必然出自同一确定性序列，claim 被**修复到活端口**（绝不改向别处）。claim 文件缺失时跳过发现（活持有者必然持有其读取为有效的 claim；注册表自身从不删除有效 claim）。发布→绑定窗口由内核裁决：claim 指向唯一端口，bind 成功者即持有者，他人 EADDRINUSE→探针→同 keyhash→等待。附带修复：publock 回收的并发竞争（ENOTEMPTY/ENOENT 重试）与 bindTest 迟到连接句柄泄漏（close 挂起时 accept 的连接永不结束→每个 bindTest 泄漏一个监听句柄，已用 destroy-on-connection + 压测 4000 次零泄漏验证）。
- **WAIT-01（预算贯穿）**：`claimPort(key, deadline)` 接收获取截止时间，互斥等待、活持有者发现（每探针 min(150ms, 剩余)）、候选评估、发布前、发布互斥等待全部预算检查；耗尽即抛有界错误、清理临时文件（无未登记端口、无残留）。`withFileLock` 在 claimPort 返回后、首次 bind 前与 bind 成功后进入 fn 前各检查一次预算——**预算耗尽绝不执行 fn**，晚成功的监听立即释放（shutdown），不产生分裂映射；预算只约束获取阶段，不限制已合法进入的业务回调时长。

## 修复前后证据（同构验证）

- **修复前**（复核三脚本原文重跑，`repro-before-*.json`）：publish-race `simultaneousSections=2、claimBefore.port≠claimAfter.port（映射被覆盖）、finalValue=1`；scheduled-deadline `timeoutMs=50, callbackAtMs=290（fn 在预算耗尽后执行）、error=null`；acquisition-deadline 在 159-claim 真实注册表上 `timeoutMs=20 仍 33.5ms 进入`。
- **修复后**（同脚本；publish-race 三次运行）：`simultaneousSections=1、claimBefore==claimAfter（映射不变）、finalValue=2`；scheduled-deadline `callbackAtMs=null（fn 未执行）、error=获取预算耗尽`；acquisition-deadline 全部 `callbackAtMs≈7-9ms（预算内）`。夹具适配依据：复核 worker 以 `mock.module` 替换了 lock-bindtest 的全部命名导出（该模块现还导出发布互斥使用的 bindHold/closeHold/probeBanner）——改为展开真实模块后仅包装 bindTest，调度屏障语义不变。

## 持久回归

- **`file-lock-publish.test.ts`（3 项）**：审计交错（B 在首次分配 bindTest 前可控暂停→A 发布并保持→B 恢复：映射不被覆盖、A 持有期间 B 不进入、A 释放后 B 于**同一端口**合法推进、终值 2）；损坏记录+活持有者（进程内：撕裂写入→修复收敛到活端口→等待者有界失败不进入→释放后同端口合法推进）；发布→绑定窗口（只 claim 不 bind→恰一个 binder 取得该端口、他人等待、映射不变）。
- **`file-lock-budget.test.ts`（1 项，确定性）**：被静默监听占据的已 claim 端口上预算耗尽——fn 从不执行、有界明确失败、无 holding/临时文件残留；故障解除后正常获取；1ms 预算下 fn 要么不执行要么远在预算内执行。
- 保留并全部通过：REG-01/02/KEY-01（5）、TCP-01/02/03（5）、SIGKILL 崩溃恢复（5）、竞争（7）、基础（6）——锁相关 **32/32**（连续三次全过）。

## 验证与产物

- typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **260/260** + installer-check **17/17**；`file-lock.ts` 188 行、`lock-registry.ts` 201 行、`lock-bindtest.ts` 78 行（测试文件豁免）。
- 打包：`shipkit-0.5.0.tgz`（`d5e6ee6f…727a`）、`ship-agent-0.5.0.tgz`（`bf22daf1…4cf1`）；源文件哈希见上。仓库外离线安装冒烟通过（含包内并发配对）。
- 日志与前后证据：`/tmp/codex-tool-runs/svton/m2-r2-pubwait-20261002/`。中途一次间歇失败为 publock 回收竞争（已修复为 ENOTEMPTY 重试）与 bindTest 句柄泄漏（已修复并压测），均在持久回归覆盖后连续三次全绿。
- 平台与限制（如实）：同主机；发布互斥为注册表目录 mkdir（/var/tmp 需可写）；活持有者发现依赖确定性候选序列（每次撕裂修复最多 64 次短探针，150ms/次上限）；publock 崩溃残留按 PID 存活回收（PID 复用时保守等待，deadline 有界失败）。

**状态：实施方修复验证通过，待独立复核确认。** R1、R3 与结构整顿维持原通过范围。真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

# 收口轮次（2026-10-03）：脚本状态文件安全锁 REG-03 + WAIT-01 —— 面包店发布权

本轮只修独立复核（`2026-10-03/m2-r2-reg03-wait01-script-lock-review.md`）指出的 REG-03 与 WAIT-01，保留其余全部修复与用例。范围之外未动；无提交、发布、Docker 或云资源操作。

## 复核结论与两次自证推翻（如实记录）

1. 审计原始夹具（pubmutex-race）在新协议下不适配：旧协议的 `owner` 文件不再存在（创建即所有权），`owner-unpublished` 暂停点不可达。属夹具适配而非协议失败，按预授权改写为等价调度验证。
2. **第一次自证推翻**：改写验证脚本时发现「仅 NAME-OWNED + 收敛重读」并不构成互斥——唯一名目录的 mkdir 永不 EEXIST，跨进程发布互斥实际为空；两进程可同时通过「重读无 claim」并各自 rename，瞬时 bindTest 探针碰撞使候选分歧，双发布不同端口。同刻双子进程复现 **4/6 轮终值 1**（同 key 双端口、同时进入、丢更新）。
3. **第二次自证推翻**：改用 (pid,rand) 有序队列（仅删除可证死同类）后仍有 TOCTOU——到达顺序可与 pid 顺序矛盾：晚创建但 pid 更小的槽位不阻塞已进入者，扫描间隙跨过对方 mkdir，双进入临界区。同刻配对压测再次失败。
4. 最终协议（`src/shared/lock-pubmutex.ts`，151 行）：**Lamport 面包店**。两阶段关闭创建/扫描窗口：先建 CHOOSING 标记 `<claim>.pubc-<pid>-<rand>`，读已提交队列后以 seq = max(committed)+1 提交 `<claim>.pubq-<seq>-<pid>-<rand>`，删除标记；入场等待「无存活 choosing 标记且无更早提交槽位」。序号取自已提交目录 ⇒ 临界区内者不可能被后来者超过（其目录保持已提交且更小）；同时取号者以 (seq,pid,rand) 全序分离，恰一人进入。创建即所有权（原子 mkdir、无 owner 文件、无未拥有窗口）；泄漏槽位仅在 NAME 内 pid **可证死亡**（kill ESRCH；EPERM/解析失败/自身 pid 均视为活）时回收；等待全部受 deadline 约束（保守失败、绝不抢占）。同进程经 `processMutexes` 链先行串行（同 pid 槽位永不可回收，必须排队）。
5. **发布收敛**（`lock-registry.ts`，137 行）：每次发布在互斥内**重读** claim——存在有效映射即收敛（永不改写活持有者端口）；仅撕裂记录（外部损坏；rename 不会撕裂）修复且只修**到**横幅验证过的活端口。**发现保守化**：候选上忙但不可识别的占用者重试两次后判 INCONCLUSIVE，保守失败可重试（持有者横幅可能因事件循环阻塞超时，宁可失败不可错发）。临时文件改为按 key 命名（并行测试残留检查互不干扰）。
6. **WAIT-01 有界返回**（`file-lock.ts` 不变，本轮复核其行为）：整个「分配+绑定」步骤与 deadline 竞速（raceDeadline），超时立即返回；晚到的 bind 被 shutdown 且 fn 不执行；publishAtomic 在 rename 前即刻检查过期。实测 250ms 分配停顿 + timeoutMs=50 于 **51–53ms** 返回（修复前 274–288ms）。

## 等价调度验证（全部真实子进程/文件/监听；mock 仅加调度屏障，系统调用结果不伪造）

- **pubmutex-race2**：A 在提交队列槽位后立即停住（等价于旧「publock 已建、owner 未写」危险瞬间）。分支 Q（常规）：B 既不回收 A 槽位、不发布、不进入；A 恢复后单映射、overlap 0ms、终值 2、无标记/临时残留。分支 P（pid 回绕使 B 更早）：B 合法完成（A 尚未发布任何内容），恢复后的 A 收敛等待、同端口推进——两分支同一安全断言，P 的等价场景由既有「审计交错」回归覆盖。
- **sameprocess-race2**：8 个并发 claimPort 同 key 同端口；进程内双区段 maxActive=1、终值 2；同刻双子进程配对终值 2、单映射。
- **acquisition-deadline2**：51–53ms 有界返回；fn 不执行；无迟到发布、无监听泄漏（子进程自然退出即探针）、无残留；故障解除后同 key 正常获取。
- **pair-stress**：同刻 2 路 ×12 轮 + 4 路 ×6 轮全部终值=路数、零错误、零残留（修复前 2 路即 4/6 失败）。

## 持久回归（新增 3 项，锁相关 32→35）

- `file-lock-pubmutex.test.ts`（2 项）：双子进程「槽位已提交未继续」交错（分支检测，断言槽位不被回收、单映射、maxActive=1、终值 2、无残留）；同进程并发 claimPort 收敛单端口 + 并发区段串行。
- `file-lock-budget.test.ts`（+1 项）：250ms 分配停顿 vs timeoutMs=50——**<150ms** 有界返回、fn 不执行、子进程自然退出（无泄漏监听）、无迟到映射/残留、故障解除后推进。
- 复用既有：损坏记录遇活持有者、发布后未 bind、审计交错（B 于 bindTest 前暂停）。

## 验证与产物（2026-10-03）

- 定向锁测试 **35/35 × 连续 5 次**；build / typecheck exit 0；`pnpm test` = tsc + 漂移检查 + **263/263** + installer-check **17/17**；pack:tarball exit 0；仓库外离线包冒烟 **17/17**（v0.5.0）。
- 行数：`lock-registry.ts` 137、`lock-pubmutex.ts` 151、`file-lock.ts` 210（测试文件豁免）。日志、脚本与哈希：`/tmp/codex-tool-runs/svton/m2-r2-scriptlock-20261003/`（`m2-r2-scriptlock-final-evidence.json`）。
- 限制（如实）：同主机；/var/tmp 可写；pid 复用时泄漏槽位保守等待至 deadline；「候选忙且不可识别」在撕裂恢复路径上保守失败（可重试）；全部外部删除（非撕裂）claim 的极端情形不在覆盖内。

**状态：实施方修复验证通过，REG-03 在独立复核确认前保持开放。** 真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

# 收口轮次（2026-10-04）：独立复核四缺口修复 —— 枚举保守、清理结算、争用预算、临时/晚到收尾

本轮只处理 [2026-10-04 复核](../2026-10-04/m2-r2-script-lock-rereview.md) 的 REG-03/WAIT-01 四项，先重放其保存的复现脚本确认全部基线成立（326.05ms/150ms、`.tmp` 残留、EACCES 双进入终值 1、清理后 stillPending），修复后再次重放全部转为安全结果。范围外未动；无提交、发布、Docker 或云操作。

## 修复内容

1. **枚举失败保守化（REG-03）**：`lock-pubmutex.ts` 新增共享 `readEntries(dir, expired, stage)` —— readdir 遇 EACCES/EPERM/EAGAIN 在获取预算内抖动重试，超时抛出明确保守错误，**绝不折算为空队列**（scanQueue、序号读取、`lock-registry.ts` 占用端口枚举三处共用）。`readClaim` 区分 ENOENT（缺失→null）、内容损坏（→null）、**其他读错误（抛出保守失败）**——读不出的有效映射绝不被发布覆盖。重放：EACCES 期间 B 不发布不进入、活映射不变；恢复权限后同 key/新 key 均合法推进。
2. **清理失败结算排队权（REG-03）**：`withPublishMutex` finally 改为**先结算进程内 gate**，清理失败按精确名字记入 `leakedSlots`；同 claim 的后续调用入场前按名恢复自身遗留槽位，scanQueue 跳过并顺手回收，**绝不触碰其他活调用的槽位**（外部槽位测试断言不被删除且仅造成有界阻塞）。重放：initial 值 'first' 正常返回（原 350ms 仍 pending），恢复后 'recovered' 立即执行。
3. **争用阶段预算贯穿（WAIT-01）**：`file-lock.ts` 争用循环的退避按剩余预算截断，**每次重试 bindTracked 都与 deadline 竞速**，晚成功监听即刻 shutdown 且 fn 不执行。重放：300ms 二次监听停顿 + 150ms 预算 → **152.14ms** 返回（原 324.29ms）。
4. **临时清理与晚到 rename 语义（WAIT-01）**：`publishAtomic` 三个出口都负责本次 temp（过期返回 rm；rename 移走；异常 catch）——统一为 finally 清理。**晚到 rename 的安全收尾**（复核边界项）：rename 始终在面包店临界区内完成、槽位释放前落盘，故不可能覆盖其他发布者创建的映射；调用方的迟到管线的晚监听被关闭；落盘映射成为唯一合法映射，后续获取者收敛到它（rename 模式回归断言同端口、不重映射）。重放：write 模式 filesAfterDrain 为空（原残留 `.json.<rand>.tmp`）。

## 过程中发现并修复的两处自伤（如实记录）

- **竞速超时吞噬探针分类**：初次实现把 raced-bind 的超时错误硬编码 kind:'none'，丢弃 lastInfo——重放复核脚本时暴露（TCP-02 把"port collision"误报为"cannot be identified"，且全量套件在其失败路径泄漏 peer 后挂起）。修复：`raceDeadline` 增加 `infoAt()` 供给函数，争用阶段超时携带等待期间的真实分类。修复后套件连续全绿。
- **直接调用契约破坏**：曾给 `withPublishMutex` 加 deadline 参数，导致复核脚本按旧 4 参签名调用时参数错位（其 `expired` 落入 deadline 槽，一次重放出现假"双重进入"）。恢复原签名 `(claimFile, lockKey, expired, fn)`，重试由 `expired()` 界定。教训：复核脚本即契约。
- 另：发现保守发现在并行负载下把"正在关闭的瞬时占用者"误判为不可判定——收窄为**持续**忙且不可识别（3 轮探针 + bindTest 复查转 free 即跳过）才保守失败；期间清理了 15630 个历史遗留 ship-* 临时目录与 696 条注册表条目（文档许可的开发机例行清理）。

## 新增持久回归（锁相关 35→39）

- **`file-lock-faults.test.ts`（3 项）**：注册表枚举 EACCES（私有重定向注册表 + 真实 chmod——故障期不进入不改写，恢复后推进，终值 2）；发布互斥清理失败结算 gate + 自身槽位恢复 + 外部活槽位不误删；temp 写完后过期清理（write 模式）与 rename 晚到安全落盘（rename 模式，后续获取收敛同端口）。子进程仅包装路径映射/调度门，系统调用结果不伪造。
- **`file-lock-budget.test.ts`（+1 项）**：争用阶段 300ms 二次监听停顿 vs 150ms 预算——<220ms 有界返回、晚监听关闭（端口随后无人应答）、故障解除后可获取。

## 验证（2026-10-04，日志 /tmp/codex-tool-runs/svton/m2-r2-scriptlock-20261004-r/）

- 复核脚本重放（修复后）：retry-bind 152.14ms；write 模式 filesAfterDrain=[]；readdir-permissions overlapping=false（B 保守阻塞，恢复后推进）；cleanup-recovery initial/'first' + recovered/'recovered'；publish-race 同时持有 1、终值 2、映射不变；scheduled-deadline 50.16ms。full-readdir 的 exit 1 为脚本自身编排（expired≡false 的等待者按设计保守阻塞），其语义由持久回归覆盖。
- 锁回归 **39/39**（终版连续 5 次 + 中间 3 次）；build/typecheck exit 0；`pnpm test` **267/267** + installer-check **17/17**；pack exit 0；仓库外包冒烟 **17/17**（v0.5.0）。
- 行数：`file-lock.ts` 200、`lock-pubmutex.ts` 198、`lock-registry.ts` 156（测试文件豁免）。完整哈希与度量：`m2-r2-scriptlock-20261004-final-evidence.json`。

**状态：实施方修复验证通过；REG-03/WAIT-01 在独立复核确认前保持开放。** 真实环境门槛不变：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。

# 收口轮次（2026-10-04b）：choosing 标记清理恢复遗漏 —— 单项修复

本轮只修 [收口复核](../2026-10-04/m2-r2-script-lock-closure-review.md) 保留的唯一发现：`lock-pubmutex.ts` 仅把 queueDir 清理失败登记入 `leakedSlots`，phase-3 的 choosing 标记删除失败（如真实 EACCES）不入恢复集合——同进程后续获取被自身"存活" choosing 标记阻塞至 deadline，需人工删除才能恢复。上轮已通过场景（枚举故障、queue 清理、deadline/temp、晚 rename、重试 bind）均按原样重放通过，未重开、未扩大。

## 修复

- `withPublishMutex` 统一跟踪本次**成功创建**的两类标记：`choosingDir`（phase 1 成功后）、`queueDir`（phase 2 提交后）；`recordLeak(name)` 按精确名称登记任一阶段的清理失败；phase-3 删除失败在登记后原样抛出（保守失败），外层 finally 无论哪个阶段失败都先结算进程内 gate；同 claim 后续调用入场恢复与 scanQueue 跳过均按名称操作，**不触碰其他活调用的标记**。
- 复核脚本重放：firstRan=false（EACCES 保守失败）→ 恢复权限 → **secondRan=true 仅 2ms**（原 256–269ms 超时）→ `afterSecond=[]`（pubc/pubq 全清），脚本尾部的"人工删除孤儿"阶段成为无操作。
- **附带硬化（不改变安全边界）**：`discoverLive` 的保守中止由"首个不可判定候选即中止"改为**扫完全部候选后仍无 ours 且存在不可判定者才中止**（我们的持有者可能在更晚候选上，减少误伤）；REG-02 回归对保守失败按契约做有界重试（并行测试夹具可能瞬时占用某候选端口）。5 次全量锁回归中 1 次因旧逻辑误伤 REG-02，调整后 40/40×5 稳定。
- **新增持久回归**（`file-lock-faults.test.ts`）：真实 queue mkdir 成功 → chmod 撤销目录写权限 → choosing 删除实际报 EACCES → 恢复权限 → **同进程同 key**再次获取。断言首次回调未执行、第二次无人工清理即成功（预算内有界）、pubc/pubq 均清空。（夹具注记：子进程消息 handler 会 ref IPC 通道，必须注册 exit 处理器供父进程回收。）

## 验证（2026-10-04，日志 /tmp/codex-tool-runs/svton/m2-r2-scriptlock-20261004-choosing/）

- 复核四场景 + choosing 重放全部安全（retry-bind 152.28ms/150ms、write 模式 filesAfterDrain=[]、cleanup first/'recovered'、choosing 2ms 恢复）。
- 锁回归 **40/40 × 连续 5 次**；build/typecheck exit 0；`pnpm test` **268/268** + installer-check **17/17**；pack exit 0；仓库外包冒烟 **17/17**（v0.5.0）。
- 行数：`lock-pubmutex.ts` 200、`lock-registry.ts` 159。哈希与度量：`choosing-recovery-final-evidence.json`。

**状态：实施方修复验证通过；仅本恢复项在独立复核确认前保持开放，其余维持既有通过范围。** 真实环境门槛不变。

# 部署资源归属核验（2026-10-04c）：同名项目误操作防护

本轮只修对已有非目标容器的误操作风险，未新增任何全局清理、删除卷或停止非目标容器的操作；无关改动未动。

## 修复

- **归属核验（`docker.ts` 新增 `assertComposeOwnership`）**：部署与回滚在任何修改前执行只读核验——按项目标签（`com.docker.compose.project=ship-<app>`）与项目派生名前缀清点现存容器，逐个要求其 `com.docker.compose.project.working_dir` 等于**本次部署的 appDir**（同机多环境/不同仓库的部署身份即 appDir，天然互异）。发现他人所属（或无标签的同名占用者）即明确拒绝并列出容器、其工作目录与本次目录；docker 命令失败按**失败关闭**处理（无法核验即不修改）。核验自身绝不停止、删除任何资源。
- **落点**：`runDeploy` 在应用锁内、`saveRelease` 之前调用（拒绝时连本地状态都不写入）；`runRollback` 在激活前调用。CLI 流水线经 agent 处理器，两条入口同受保护。
- **取消 `--remove-orphans`**：`activate()` 的 compose 参数改为 `['up','-d']`；不再存在无归属约束的清理。全仓确认部署路径无其他 stop/rm/down/卷删除类 compose 操作（builder up/down 为云主机生命周期，不在本范围且未改动）。

## 回归（`src/agent/deploy-ownership.test.ts`，5 项，exec 层仿真 docker）

同名外部项目（列出他方工作目录、零 compose 命令、零状态写入）；无标签同名占用者拒绝；不同环境/仓库同名应用：第二环境拒绝且第一环境零接触，第二环境回滚亦拒绝；**归属环境**重部署与回滚通过（无误伤）；回滚遇归属被接管时拒绝且状态不变；所有记录到的 `up` 均无 `--remove-orphans`。

## 验证（日志 /tmp/codex-tool-runs/svton/shipkit-ownership-20261004/，`ownership-final-evidence.json`）

build / typecheck exit 0；`pnpm test` **273/273** + installer-check **17/17**；重新打包 `pack/shipkit-0.5.0.tgz`（agent bundle sha256 f6cfcb6f…）；仓库外包冒烟 **17/17**。行数：docker.ts 179、handlers-deploy.ts 186。

**状态：实施方验证通过（单元/exec 仿真层）。** 真实多环境同机验收归入既有真实环境门槛。

# 部署项目/环境隔离（2026-10-04d）：四项修复

同一 Agent、同一 appsRoot 内，同名应用不再可能跨项目/环境静默共享或覆盖。未新增任何孤儿清理、卷删除或停止非目标容器的操作；无关改动未动。

## 修复

1. **项目/环境身份与绑定**：`DeployRequest`/`RollbackRequest` 新增必填 `project`（CLI 由规范化 git origin 派生，无远端时回退 `local:<绝对路径>`；API 对缺失/非法身份直接 400）。Agent 在 appDir 内以 `project.json` 原子登记首次声明者的身份；此后任何部署/回滚身份不符即在任何修改前拒绝（先 compose 归属门、再绑定门，然后才写 release 状态）。
2. **构建记录按身份隔离**：`~/.ship` 记录按 (app, project) 哈希分文件；读取必须 project 匹配；无 project 的旧记录（按 app 的 0.2.x 或全局 0.1.x）一律不再归属任何项目——不同仓库同名应用不可能串用镜像。
3. **每次真实激活前复核归属**：`assertComposeOwnership` 在 `activate()` 内 `up -d` 之前重跑——正常部署、手动回滚、失败自动恢复全部经此路径；镜像拉取窗口内被外部接管者在该处拦下（恢复尝试同样拒绝，绝不收养外部资源）。并发边界如实说明：同 app 调用经应用锁（进程内链 + 跨进程文件锁）串行；两次归属核验（预检 + 激活前）覆盖外部行为者；与 docker daemon 之间无事务性——正因如此两道核验都必须存在。
4. **容器名精确匹配**：清点改为严格匹配 compose 派生名（`ship-<app>-<app>-<n>` 及 legacy 下划线形），`web` 与 `web-api` 正常共存，前缀误吞消除。

## 回归（`src/cli/deploy-isolation.e2e.test.ts`，5 项，真实 CLI→HTTP→Agent，单一下发根目录）

多项目同名（第二个项目零改动被拒、绑定不变、归属项目重部署与回滚正常）；last-build 各取己像（含第二目标上的独立验证）；拉取窗口接管（部署失败且自动恢复同样拒绝，`up` 零次、状态完好）；web/web-api 共存与真外属同名拒绝；同项目并发部署串行收敛；无身份调用 400。docker 仅在 exec 层仿真（机器容器清单 + compose 记录），拒绝场景断言零改动。

## 验证与产物（日志 /tmp/codex-tool-runs/svton/shipkit-isolation-20261004/，`isolation-final-evidence.json`）

build / typecheck exit 0；`pnpm test` **278/278** + installer-check **17/17**；重新打包 `pack/shipkit-0.5.0.tgz`（sha256 37fd21ca…）与 `pack/ship-agent-0.5.0.tgz`（afa5b071…，较上轮 f6cfcb6f 变更）；仓库外包冒烟 **17/17**。

**状态：实施方验证通过（真实 CLI→API 路径，exec 仿真 docker）。** 真实多仓库/多机验收归入既有真实环境门槛。

# 部署身份隔离收口（2026-10-04e）：三个遗留项

## 修复

1. **项目与环境身份明确定义并贯通**：项目身份 = `config.source.repo`（规范化）→ git origin → 本地摘要，构建缓存（last-build）按项目身份隔离（镜像属仓库，可跨环境复用）；**环境身份 = 运行时目标名**，作为部署/回滚请求的必填 `env` 字段（API 400 拒缺失/非法）。Agent 将应用名绑定到 (project, env)：**同一仓库、同一 Agent、同名应用的 prod/staging 明确拒绝**（一个应用名在一个 Agent 上只服务一个环境——共享 appDir 与 compose 项目必然互相覆盖），不同 source.repo 同样拒绝。
2. **严格认领**（新模块 `project-binding.ts`）：仅"绑定不存在且无任何部署证据（无 state.json、无 releases/）"的全新应用自动认领；旧部署缺绑定给出**显式迁移指引**（错误信息含需写入的完整 JSON）；读取错误、JSON 损坏、结构非法一律拒绝且**原文件（含权限）原样保留**。
3. **本地路径身份摘要化**：`local:` + sha256(realpath) 前 32 位——无 Git、含空格、超长路径均可稳定通过（此前空白符会被 API 校验拒绝）。

## 回归（真实 CLI→HTTP→单 Agent，新增 3 项共 8 项）

prod/staging 分离（拒绝零改动、绑定不改写、prod 持续可用、source.repo 不符拒绝）；严格认领（旧部署不自动认领→迁移指引→人工写入后成功；损坏/非法/不可读绑定拒绝且字节与权限保留）；本地摘要（含空格无 Git 目录端到端部署、异目录同名仍拒绝）。保留并通过：缓存隔离、激活前复核（拉取窗口）、web/web-api 共存。夹具调整：gc-integration 的预置部署同时预置其项目绑定（严格认领下本应拒绝）；REG-02 对保守失败按新键重试（契约即"可重试"；并行夹具可长期占用某键的候选端口）。

## 验证与产物（日志 /tmp/codex-tool-runs/svton/shipkit-identity-20261004/，`identity-final-evidence.json`）

build / typecheck exit 0；`pnpm test` **281/281 × 连续 3 次** + installer-check 17/17；重新打包 `shipkit-0.5.0.tgz`（sha256 9d2c8e50…）与 `ship-agent-0.5.0.tgz`（e5ea8a82…）；仓库外包冒烟 **17/17**。

**状态：实施方验证通过。** 真实多仓库/多环境机器验收归入既有环境门槛。
