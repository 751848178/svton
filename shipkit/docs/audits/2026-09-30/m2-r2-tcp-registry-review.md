# M2-R2 TCP 注册表修复独立复核（2026-10-01）

**M2-R2 仍开放（P2）。** 上轮 TCP-01/02/03 在原场景内已修复，当前全量、安装器和仓库外安装包冒烟均通过；但新增注册表及缺失父目录处理仍允许同一文件双重进入和丢更新。以下三个场景全部使用真实子进程、临时文件、回环监听，没有模块 mock，也没有终止未知服务。

本轮未修改业务源码，没有提交、发布、Docker 或云端操作。R1、R3 与安装脚本结构整顿维持此前已通过范围。本报告为独立复核结论，不将实施方测试结果当作互斥证明。

## REG-01：注册表命名空间依赖进程 TMPDIR（P2）

位置：[lock-registry.ts](../../../src/shared/lock-registry.ts) 的 `claimDir`（25 行）及跳过已占用候选的分配循环（60–78 行）。

两个同主机子进程访问**完全相同的绝对文件路径**，仅 TMPDIR/TMP/TEMP 不同。A 已绑定其登记端口；B 在另一注册表中看不到 A 的记录，真实 bindTest 发现首选端口被 A 占用后分配另一端口。B 在 A 尚未释放时进入同一文件的临界区。

实测同一 canonical key 的两个端口为 **51256 / 61562**，临界区同时保持数为 **2**，双方都读取 0，两次加一最终为 **1（应为 2）**。不是路径软链接问题，也没有伪造占用者。

该实现注释的“per-host”实际是“per-tmpdir”；单一测试环境中继承相同 TMPDIR 的跨进程回归未覆盖此边界。必须提供所有受支持同主机竞争者一致的锁身份，或在进入临界区前明确拒绝不支持的环境；不能静默分裂锁。

## REG-02：未持久化的 fallback 与后来发布的 claim 分裂（P2）

位置：[lock-registry.ts](../../../src/shared/lock-registry.ts) 60–85 行，尤其 80–84 行 fallback/cache。

使用本轮自己的真实监听占据新 key 的 64 个候选端口，A 执行 claimPort 得到纯 key hash 的 fallback **65337**。随后关闭这些测试监听，A 通过本进程缓存取得 fallback 锁并保持。B 使用**相同 TMPDIR、相同 canonical key**，因没有持久化 claim 而新建记录、绑定 **56497**，同时进入。

实测同时保持数 **2**，两次加一最终 **1（应为 2）**。本场景证明“fallback 不会 split”的源码说明不成立；不需要不同 TMPDIR。注册表暂时不可用、候选耗尽、发布失败时，不能将未统一登记的另一端口作为成功锁返回并缓存。失败须保守且有界，后续合法获取仍须能推进。

此外 wx 只保证创建排他，不保证读者看到完整 JSON；下一轮应验证发布暂停/崩溃、空或损坏记录不会导致独立 fallback。本轮没有将该额外时序声称为已复现结果。

## KEY-01：缺失祖先分量被丢弃，创建目录后身份改变且释放泄漏（P2）

位置：[file-lock.ts](../../../src/shared/file-lock.ts) `lockKeyOf` 64–75 行、`releaseLockIfOwner` 137–145 行、finally 194–195 行。

对尚不存在的 `base/new/nested/state.json` 加锁时，向上寻找现存祖先后只接回 basename，丢掉 `new/nested`，初始 key 成为 `base/state.json`。A 在回调中创建父目录后，B 对同一个完整路径生成 `base/new/nested/state.json` key，绑定另一端口并与 A 重叠。实测端口 **65442 / 55135**，同时保持数 **2**，两次加一最终 **1（应为 2）**。

独立补充检查：仅 A 在回调中创建目录、正常返回，finally 重新计算 key 后找不到原 holding，**withFileLock 已成功返回但原 token/监听仍被持有**；以获取时原始 key 调用 releaseLockIfOwner 才完成清理。本轮已主动释放自己产生的残留。

这不仅是任意目录变更：[registry-creds.ts](../../../src/agent/registry-creds.ts) 41–53 行是在 withFileLock 回调内部 mkdir(workRoot)，共享函数确实需要处理父目录首次创建。已存在父目录下仅目标文件缺失的首次写入不受此特定 bug 影响。

规范化必须保留相对现存祖先的全部剩余分量；释放必须绑定获取时的 key/token/server，不能依赖路径在回调之后仍可重新解析为同一身份。继续拒绝最终目标符号链接，保留原子替换后的稳定键。

## 已通过的验证

| 检查 | 本轮结果 |
| --- | --- |
| pnpm run build / typecheck | exit 0 / 0 |
| pnpm run test | exit 0，Node **251/251**，installer-check **17/17** |
| pnpm run pack:tarball | exit 0，本地 v0.5.0 包 |
| pnpm run smoke:package | exit 0，仓库外离线安装，**17 项 PASS** |
| 原 TCP-01 父目录别名 | 同端口 62905，maxActive=1，最终计数 2 |
| 原 TCP-02 静默服务 | timeoutMs=100，elapsedMs=100，明确超时 |
| 原 TCP-02 EOF 无数据 | 1600ms 观察时已经结算，不再 pending |
| 原 TCP-03 半开连接 | 350ms 观察时已完成释放，net.Server 无 closeAllConnections 仍成立 |

原复现脚本仅适配新 lockPortFor 查询；别名观察改为等待 250ms 后先释放 A，再等待 B，避免正确串行时脚本本身死等。没有 mock 协议操作。全部测试绿灯不覆盖上列三个新时序。

首次沙箱运行阻止回环 listen（EPERM）及 npm 缓存写入；获准在沙箱外重跑后完成上述验证。初次沙箱失败不作为产品失败统计，原始日志保留。

完整证据、源码/日志哈希及可提取的独立复现脚本：[m2-r2-tcp-registry-review-evidence.json](m2-r2-tcp-registry-review-evidence.json)。日志目录 `/tmp/codex-tool-runs/svton/m2-r2-tcp-rereview-20261001/`。脚本 exit 0 表示观测完成，是否通过须看结果中的同时保持数和最终计数。

## 下一轮修复范围

只修 REG-01/REG-02/KEY-01，继续使用内核互斥，禁止回退到此前已证伪的可抢占文件锁。补充持久化跨进程回归：不同临时目录、64 候选不可用后恢复、claim 发布中断、缺失多层父目录在持锁期间创建、获取后原身份释放。断言 maxActive=1、最终计数=2、旧 token 不影响新持有者、超时有界、无自身 socket/holding 残留、故障解除后可继续取得锁。

保留原 TCP-01/02/03、SIGKILL 恢复、同键串行、权限及安装器回归，重跑 build/typecheck/test/打包/仓库外冒烟。更新处置记录和 TODO 时保持“实施方验证通过”与“独立复核关闭”分离。

干净 Debian/systemd、公网可信 TLS、真实远端 registry 与首个应用发布仍是独立环境验收门槛。
