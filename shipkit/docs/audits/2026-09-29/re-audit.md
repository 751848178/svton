# F09 / F20 / F34 修复后的独立复审

日期：2026-09-29。对象：当前本地 shipkit 0.2.0 工作区。范围：TLS/引导连接、动态构建机生命周期、镜像 GC，以及关联的锁、发布快照、CLI 和测试；本次不是对原 F01–F38 的全部重新验收。整个 `shipkit/` 仍未跟踪，不能用父仓库 HEAD 代表审查版本。

**结论：三项均未达到上一轮约定的验收门槛。** F09 主要新增了监听地址配置与使用说明；F20 已提交云端销毁时间，但查询验证和任务寿命保护有缺陷；F34 已有预览/执行功能，但仍可能把回滚或新发布镜像送入删除流程。本轮确认 10 项发现（6 项 P1、4 项 P2），完成 10 个隔离缺陷场景复现。

## 已确认的进展

- 安装脚本支持 `AGENT_BIND` 并写入 systemd 环境，可供外部 TLS 反代使用。
- `RunInstances` 请求包含 `ActionTimer.TerminateInstances`，增加 `maxLifetimeMinutes`。
- doctor 已移除过期实例销毁调用，恢复为只读诊断路径。
- 新增 `ship gc` 和 `/api/gc`，默认预览，不使用全局 Docker prune；执行调用 `docker rmi` 不带 force。
- GC 会扫描保留快照，也会在入口发现已有部署任务时拒绝执行。这些措施方向正确，但尚未形成可靠的互斥与错误保护。

## 验证结果及边界

| 检查 | 结果 |
|---|---|
| `pnpm --filter shipkit test` | 50/50 通过 |
| `pnpm --filter shipkit build` | exit 0 |
| `pnpm --filter shipkit typecheck` | exit 0 |
| `bash -n shipkit/bootstrap/install.sh` | exit 0 |
| A01–A08 隔离控制流复现 | 全部断言命中缺陷行为 |
| A09–A10 实际文件系统锁复现 | 首次目录缺失卡住；活跃的超龄锁可被抢走 |
| 安装的腾讯 SDK 原型检查 | `DescribeActionTimers` 不存在；`DescribeInstancesActionTimer` 存在 |

A01–A08 使用真实业务模块和临时账本，替换 Docker 命令与云客户端；“删除”表示确认代码发出了删除调用，不代表实际删除了机器上的镜像。A09 子进程被测试工具在 800ms 后主动终止，静态控制流进一步确认缺失目录分支一直 continue，跳过了锁等待 deadline。A10 用 utimes 模拟锁已持有 11 分钟，不需要真实等待 11 分钟。

没有访问生产 agent、执行云资源 API、删除真实 Docker 资源、修改业务源文件或验证公网 TLS 部署。50 个现有测试通过不能替代上述边界验证；新增 GC 测试只检查 plan，未覆盖 execute 和并发清理。

结构化证据：[re-audit-evidence.json](re-audit-evidence.json)。本轮代码快照：[re-audit-source-sha256.json](re-audit-source-sha256.json)。完整日志和复现脚本位于 `/tmp/codex-tool-runs/svton/shipkit-reaudit-20260929/`，包括 `tests.log`、`build.log`、`typecheck.log`、`reproduce.mjs`、`reproduce.log`、`lock-checks.mjs` 和 `lock-checks.log`。临时目录可能被系统清理，证据摘要和源码哈希保存在仓库中。

## 发现清单

### RA01 [P1] GC 吞掉损坏快照，可能删除上一版本镜像

位置：`src/agent/gc.ts:23–28,41–45`。证据：A01。

`protectedRefs()` 把目录读取及 `loadRelease` 错误吞掉；被破坏的上一版本 meta 不进入保护集合，但其 imageRef 仍在 history 中，于是成为删除候选。复现中，上一版本快照损坏后，该镜像被传给 `docker rmi`。上一版本通常已没有容器引用，不带 force 也不能保证它被保留。

修复：保护集合加载采用遇错阻断；任何应用 state 或 retained snapshot 无法读取、解析、验证时，整轮清理停止并报告。必须校验 current/previous 能解析为完整快照，不可把“不知道是否被引用”视为“没有引用”。增加损坏/缺失/权限失败回归测试。

### RA02 [P1] GC 与新部署不互斥，执行期间新增引用仍可能被删除

位置：`src/agent/routes.ts:163–168`、`src/agent/gc.ts:62–75`。证据：A02。

入口 busy 只检查一次；进入 GC 后，新 deploy/rollback 仍能开始。execute 在整个循环前只读取一次保护集合，与注释“每次删除前重新验证”不符。复现中，在 inspect 阶段新增引用该镜像的快照，后续仍调用 rmi。

修复：GC 与部署/回滚共享同一资源协调机制，在计算、复核和删除之间保证引用不能并发变化；构建/推送与运行机共用 Docker 的 `both` 场景也需明确保护。单纯再调用一次扫描不能消除检查与删除之间的竞态。验收需要交错执行测试，不只是 plan 单元测试。

### RA03 [P1] 仅预留 30 分钟就复用机器，云端可能在正常任务中途销毁它

位置：`src/providers/tencent.ts:32–37,57–58`，关联 `src/agent/docker.ts:57,77`。证据：A07。

硬编码 `TASK_BUDGET=30分钟`，剩余 31 分钟即允许复用，而 build 和 push 各允许 60 分钟；CLI 还允许更长等待配置。默认最长寿命最低 120 分钟，也没有把安装、上传、构建、推送预算完整纳入。配置允许最低 30 分钟，甚至短于声明的初始化等待总预算。

修复：ensure 接收实际总任务预算和缓冲时间；复用前确认云端剩余时间足够，否则先成功延长或更换实例。新实例也做相同准入校验。配置不足时提前拒绝，不能依靠最终计费兜底误杀正常任务。

### RA04 [P1] 活跃构建机可被另一个调用销毁，生命周期锁也会误判失效

位置：`src/providers/tencent.ts:32–43`、`src/providers/builder-state.ts:76–98`，关联 `src/cli/pipeline.ts:119–149`。证据：A08、A10。

lastUsedAt 在 ensure 复用时更新，而不是任务结束时更新；ensure 的锁也不覆盖实际 build/push。任务运行 40 分钟时，另一次调用按默认 30 分钟窗口认定实例空闲过期，直接销毁，未检查 activeJobs 或有效任务租约。复现已确认发出针对旧实例的 TerminateInstances。

同时锁仅按 mtime 超过 10 分钟就强制移除，没有持有者存活或续约检查；初始化预算可超过 10 分钟。A10 证明原持有者仍在运行时第二调用可以进入临界区。

修复：增加有所有者、任务状态和续约的实例租约；idle 从最后任务完成开始计算。替换/销毁与任务准入共用协调机制，不能仅查一次健康状态。锁恢复需要确认持有者失效，不可只凭固定年龄。

### RA05 [P1] 新用户账本目录尚未创建时，动态 builder 会无限重试加锁

位置：`src/providers/builder-state.ts:76–89`。证据：A09。

首次运行没有 `~/.ship/builders`；withLock 直接 mkdir 子路径锁，得到 ENOENT。catch 将不存在锁的 mtime 设为 0，进入“陈旧锁”分支，删除后 continue，绕过 30 秒 deadline。创建父目录的逻辑在后续 writeState，因无法进入临界区永远到不了。

修复：加锁前以 0700 创建父目录；只有 EEXIST 进入锁竞争逻辑，ENOENT/EACCES 等单独处理。所有重试都受总 deadline 限制。测试使用全新临时 home 对应的状态根，不能只覆盖已有目录场景。

### RA06 [P1] TLS 仍是接入准备，动态 API 与引导地址继续使用公网 HTTP

位置：`src/providers/tencent.ts:111`、`src/providers/bundle-server.ts:66,108–112`、`bootstrap/install.sh:12,136`。证据：A06 + 静态检查。

新增 AGENT_BIND 可帮助固定运行机接反代，但默认仍监听 0.0.0.0，动态 provider 固定选择公网 IP 并拼 HTTP；内置 bundle 的安装脚本和包 URL 同样固定为 HTTP。即使提供 HTTPS installUrl，动态 API 仍是公网 HTTP。仓库没有提供已验收的安全入口或隧道集成证据。

修复：落实固定机 Caddy/证书配置并验证端口暴露；动态 provider 支持实际可达的受保护 endpoint，不能继续固定公网 HTTP；引导源同步支持安全 URL。未完成部署前，F09 应保留未验收状态。单纯文档说明和 HTTP warning 不满足加密要求。

### RA07 [P2] 定时销毁查询用了不存在的 SDK 方法，验证被可选调用静默跳过

位置：`src/providers/tencent.ts:98–108`。证据：A05 + 已安装 SDK 原型检查。

代码调用 `DescribeActionTimers?.()`，实际 SDK 提供的是 `DescribeInstancesActionTimer`。可选调用返回 undefined，不抛错，随后仍记录“cloud terminate timer registered”，verified=false，并继续进入 ready。即使未来临时 mock 返回空数组，`Boolean([])` 也不能证明目标与时间正确。

这不等于云端定时销毁一定没设置：RunInstances 确实已携带 ActionTimer。问题是没有按约定验证实际定时器，不能把它标为验收完成。

修复：按 SDK 正确方法和请求/响应类型实现查询，检查实例、动作、期限与状态；查询失败/未找到/内容不匹配时不得直接宣告就绪。去掉 unknown 强转和可选方法绕过；创建成功先落账本，再做外部确认。增加云响应故障测试。

### RA08 [P2] GC 只从最近 20 条 history 找候选，较老镜像永久失去清理入口

位置：`src/agent/gc.ts:41–46`、`src/agent/release.ts:90,100`。证据：A03。

history 截断为 20 条，旧快照又会轮转删除；若 20 次以上发布之间未执行 GC，更早的镜像既不在保护集合也不在候选集合。35 次发布复现中 v0 已不可被 GC 发现，磁盘泄漏会继续累积。

修复：保留独立的受管镜像账本或可信所有权标签，发现过程不能依赖短期 UI 历史；删除成功或确认不存在后再移除账本项。跨应用按实际镜像身份合并保护关系。

### RA09 [P2] Docker inspect 的任意错误都被当成镜像不存在，GC 假成功

位置：`src/agent/gc.ts:68–71`、`src/cli/cmd-gc.ts:46`。证据：A04。

Docker daemon 不可达、权限错误或超时都被计入 missing，而非 failed；CLI 只根据 failed 返回失败码。模拟 Docker daemon 连接失败后，所有候选都被判 missing，failed 为 0。

修复：仅明确的 image-not-found 才算 missing；其他错误保留并返回失败。预检 Docker 可达性不能代替逐项错误分类。增加断连、权限和超时用例。

### RA10 [P2] GC 是长同步请求，CLI 默认 20 秒超时后服务端仍会继续删除

位置：`src/cli/cmd-gc.ts:40`、`src/shared/http.ts:30`、`src/agent/routes.ts:168`、`src/agent/gc.ts:68,73`。证据：静态控制流确认，本轮未真实等待长时间删除。

单个 inspect 最多 15 秒、rmi 最多 60 秒，多个候选顺序执行；CLI 却沿用 api 默认 20 秒超时。客户端中止请求不会取消服务端执行，用户看到网络失败时清理仍可能继续，也没有持久 job ID 供查询。

修复：GC 执行采用已有 job 模型，返回 jobId、可轮询结果和日志；明确重试、并发及取消边界。加长 HTTP 超时不能解决结果不可追踪的问题。

## 建议的下一轮边界

先修 RA01/RA02，保护运行机恢复能力；修 RA05 解除首次动态运行阻塞，再把 RA03/RA04/RA07 作为一次生命周期修复；F09 按环境实施并验证。RA08–RA10 一起完成可持续、可观察的 GC。上述缺陷测试应随修复进入正式测试集。

下一次验收需包括：账本损坏时拒绝清理、GC 与部署交错、超过 20 次发布后的回收、全新账本目录、长任务租约、云定时查询不匹配，以及实际加密通道和云端到期销毁。云端和真实资源操作仍需明确测试范围；本轮没有以任何模拟结果替代真实部署验收。
