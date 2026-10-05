# S01–S06 修复证据（2026-10-05 第二次修复轮）

对象：第二次独立复核（[multi-service-remediation-independent-review.md](multi-service-remediation-independent-review.md)）确认的六项问题；基线为代码 `146d6b9a`、文档 `eb95ca12`。本轮先落仓库内稳定回归再修复；已通过的 R01、R04–R08、R11 与正常发布行为保留（全量回归复跑）。全程未创建云资源、未改 TCP 锁协议/本机安装/生产端；其他 Devpilot/UI 工作区改动保留。日志目录：`/tmp/codex-tool-runs/svton/s-remediation/`。

## 逐项关闭

| ID | 修复 | 稳定回归（仓库内） |
| --- | --- | --- |
| S01 envFile 被 tar 当 glob（`prod[1].env` 误排 `prod1.env`、真秘密入档） | 新增 `src/cli/source-freeze.ts`：**冻结式打包**——staging 拷贝由我们的代码应用排除（默认秘密规则 + envFile 按规范化**字面路径**，`./` 前缀折叠），tar 对 staging 无任何排除参数；v1/v2 共用同一入口（`pipeline.ts`/`pipeline-multi.ts` 均改走 `freezeSourceDir`+`uploadFrozenSource`，glob 式 `packSourceDir` 删除） | `source-freeze.test.ts` 用例1/2：`prod[1].env` 与 `prod1.env` 并存时归档含普通文件、绝不含声明秘密；`./config/a.env` 规范化排除；`routes-guards.test`/`pipeline.test` A10/`source-digest.test` 的真实 tar 条目断言全部改经冻结产物 |
| S03 摘要与上传非同一份快照（TOCTOU） | 冻结发生在能力检查与机器准备**之前**；上传的只能是该冻结 tarball，manifest `contentDigest` 取自同一 staging 内容；事后（能力检查/机器准备期间）改环境文件或普通源码均不影响 | `source-freeze.test.ts` 用例3/4：冻结后改 env/源码/新增文件 → tarball 字节与摘要不变、上传内容为冻结版；能力检查期间改源码 → manifest 摘要 = 冻结内容，上传归档为冻结字节（真实 tar -x 断言） |
| S02 多服务首部署恢复中改绑仍清理下一项 | `group-recovery.ts`：绑定复核从"入口一次"改为**每个恢复/删除动作前**；任一动作前复核失败 → 停止全部后续动作，`pending` 记录被放弃的服务，`detail` 报告 `cleaned=[...] abandoned=[...]` 与中止原因 | `group-recovery.test.ts` S02 用例：首个 down 窗口改绑 → 第二个 down 未执行（downProjects 仅 1 项）、`recovery.succeeded=false`、消息含 abandoned 范围 |
| S04 混合探针误报整体 re-verified | `RecoveryOutcome` 携带逐类计数（probed/probesSkipped）；汇总保守化：任一探针失败→failed；有跳过→skipped（PARTIAL 文案列出通过/无探针数）；全通过才 passed；恢复动作结果与验证结果分离（`succeeded` 仅因动作或探针失败为假） | 同文件 S04 用例：1 探针通过 + 1 无探针 → `verification PARTIAL — 1 probe(s) passed, 1 service(s) have no probe declared`，绝不出现 `re-verified healthy`；全部无探针 → `no probes passed — verification skipped` |
| S05 清理验证器假报零残留 | 新增 `src/cli/test-support/cleanup-verifier.ts`（注入式 fake docker 的单测覆盖）：rmi 冲突=失败；**任何 Docker 查询失败=失败**（不再当空集）；镜像按精确 repo:tag 跟踪与比较（不再 12 位短 ID 误比）；**前后快照差分**只把"本次新增且未清理"的镜像算残留，绝不强删既有/共用镜像；e2e lib 改调该编译模块 | `cleanup-verifier.test.ts` 4 用例：冲突即败、查询失败即败、诚实成功（含既有镜像不动）、漏跟踪的新 tag 被差分抓住；真实 e2e 末行 `zero new residue (… 6 images removed; 77 pre-existing images untouched)` |
| S06 ensure 期间取消被创建锁阻塞 | `TencentBuilderProvider.ensure` 携带 AbortController（拆出 `tencent-provision.ts`，文件≤200 行）：RunInstances 前/后、IP 等待（`waitForPublicIp` 加 signal）、健康轮询逐点检查；`release()` 先 abort 活跃 ensure 并**有界等待其补偿路径**（terminate+clearState，8s 预算），再走原锁内释放；不删他人实例（lease/归属检查原样） | `tencent-cancel-ensure.test.ts`：真实 provider + 模拟 SDK 子进程——SIGINT/SIGTERM 在健康等待期触发 → `TerminateInstances` 实际调用且仅含本次实例、ledger 清空、常规信号退出、有界；对照组正常完成恰好释放一次 |

## 收口验证

| 命令 | 退出码 | 结果 | 日志 |
| --- | --- | --- | --- |
| `pnpm test` | 0 | 全量通过（392→406：freeze 4、S02/S04 2、cleanup-verifier 5、S06 4——含 P2-1 RunInstances 窗口用例） | `full-test3.log` |
| `pnpm run smoke:package` | 0 | 包外安装与隔离回归通过 | `smoke3.log` |
| `node scripts/e2e-multi-docker.mjs` | 0 | 26 项断言全过（全量/部分/坏探针恢复/回滚/外部卷数据与 CreatedAt 保留/混合 keep-env/新增服务拒绝）+ `cleanup verified: zero new residue (2 containers, 2 networks, 1 volume, 6 images removed; 77 pre-existing untouched)` | `e2e3.log` |

R01–R12 原回归全部在 405 项内复跑通过（含 R01 归属复核、R02 拉取窗口、R03 恢复再健康、R04 顶层卷、R05/R06 计划一致、R07 digest 门槛、R08 GC、R09 完成路径取消、R10 出处、R11 平台、R12 拆分）。

## 修后独立复审（子代理对抗式）与第三轮加固

复审结论：S01–S05 判定 CLOSED（逐 file:line 核对并做了真实 tar/冻结探针）；S06 对已测窗口 CLOSED，但发现 1 项 P2 与 6 项 P3，全部当场修复：

| 项 | 处置 |
| --- | --- |
| P2-1 RunInstances 往返窗口取消 → 孤儿付费实例+假报干净 | `tencent-provision.ts`：先捕获 `instanceId` 再查中止信号——API 已应答的取消走既有补偿路径（terminate+clear），不再丢弃已创建实例。新增回归：`tencent-cancel-ensure.test.ts` P2-1 用例（mock RunInstances 1.5s RTT，信号落在往返中 → TerminateInstances 仍执行且仅含本次实例、ledger 清空） |
| P3-1 大小写不敏感文件系统上 envFile 误入档 | `literalExcluded` 改为大小写不敏感比较（保守方向：最多样外排除一个仅大小写不同的源文件） |
| P3-2 悬空镜像逃过 tag 差分 | 验证器新增 `snapshotDangling`（按 ID 差分）；e2e 前置快照含悬空集；新增用例：新悬空 ID 被抓住 |
| P3-3 健康探针 5s 超时+5s 睡眠可超 settle 预算 | 健康循环在每次探针返回后**立即**复查中止信号（最大延迟降为探针超时本身） |
| P3-4 冻结失败残留临时产物 | freeze 全程 try/catch：失败清理 staging 与半成品 tarball |
| P3-5 冷机无基础镜像 → e2e 误红 | 前置快照前先确保构建基础镜像存在（尽力拉取；失败仍如实报构建失败） |
| P3-6 恢复探针抛异常丢失退出码语义 | 探针循环逐服务 try/catch：硬错误计为验证失败（hardFail），恢复结果与 5/6 退出码语义保留 |

复审另确认：R01/R04–R08/R11 触发路径在本轮重构后全部保持（归属复核、顶层卷、计划一致、digest 门槛、GC、arch）；无恒真测试。

## 剩余限制（不变）

- 本机 daemon 代理拦本地 registry：真实 e2e 不含推/拉 registry 环节（单测+既有云上证据覆盖）。
- MS-06 真实 TWGG 验收、真实 CVM 主动/定时销毁回读、TCR 全链路：待用户明确恢复。S06 的取消释放已在模拟 SDK 下证明，真实云端行为待该门槛一并验收。
- 联动探针与同机多环境并存：保留 TODO。
- 已安装 CLI 未升级；新能力在仓库源码与包产物中。
