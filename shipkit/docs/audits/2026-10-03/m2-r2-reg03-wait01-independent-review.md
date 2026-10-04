# M2-R2 REG-03 / WAIT-01 独立复核（2026-10-03）

**结论：REG-03 仍开放（P2）；WAIT-01 的“超时后不执行回调”已生效，但获取过程本身未按预算有界结束。M2-R2 不能关闭。** 实施方的旧交错和本轮新增的四项定向测试通过，但新发布互斥目录在持有者尚未写入 owner 时可以被另一竞争者删除，导致两个发布者并行并改写活映射。

本轮未修改业务源码。仅用新建的临时文件、真实子进程、真实回环监听及本轮专用的注册表 key 复现；结束时清理自己的资源。两个屏障只暂停 `writeFile(owner)` 和 `bindTest` 调用时机，恢复后仍调用真实函数，没有伪造返回值、端口横幅或计数。

## REG-03：发布互斥被抢占，活映射改写并丢更新

位置：[`lock-registry.ts`](../../../src/shared/lock-registry.ts) 的 `withPublishMutex`。`mkdir(publock)` 成功和 `writeFile(owner)` 之间存在窗口；竞争者遇到 `EEXIST` 后读取到空 owner，就执行递归 `rm(publock)`。此外，owner 为当前进程 PID 时也会走回收分支，因此同进程并发也没有可靠的唯一发布权。持有方 `finally` 再次按路径删除目录，不能证明删除的还是自己建立的那一代。

可控双进程时序：

1. A 成功创建 publock，暂停在真实 owner 写入之前。
2. 测试临时占用首选候选端口；B 选择另一个候选，将 A 的仍有效 publock 当成无 owner 的残留删掉，进入自己新建的 publock，并在实际 `bindTest` 成功后暂停。
3. 测试释放临时监听；A 恢复真实 owner 写入，发布端口 **53925** 并进入临界区。
4. B 恢复，沿先前的有效 bindTest 结果发布 **54128**，在 A 持锁期间也进入临界区。

观测：两个端口同时返回同一 keyhash 的 `shiplock` 横幅；注册表从 `{port:53925}` 变为 `{port:54128}`；两方都读到旧计数 0，最后计数 **1（应为 2）**。这直接违反同键互斥和活映射不可改变的不变量。脚本、结果、哈希见 [复核证据](m2-r2-reg03-wait01-independent-review-evidence.json)。原来的“B 在首次 bindTest 前暂停，A 发布并保持”交错在当前代码下仍通过：maxActive=1、终值 2；该回归没有覆盖 publock 的生命周期窗口。

全量 `pnpm run test`（沙箱外允许回环监听）实测 **259/260**；第 248 项基线并发锁测试失败，`writeFile(publock/owner)` 报 `ENOENT`，堆栈落在 `withPublishMutex`。这是同一回收竞争在未经注入的测试中的直接信号。定向 `file-lock-publish` + `file-lock-budget` **4/4 通过**，说明现有覆盖未捕获本场景。

## WAIT-01：回调隔离已修，等待时间仍越过预算

在分配阶段的真实 `bindTest` 之前插入 250 ms 可恢复异步暂停，`timeoutMs=50`。当前代码没有进入业务回调，最后报“获取预算耗尽”，这是进展；但错误约 **274 ms** 才返回。检查点在被等待的异步操作之后才执行，不能让等待在截止时结束。现有测试仅要求小于 2500 ms，因此无法证明 50 ms 预算约束获取时长。需要明确有限调度容差，并验证分配、发布、探针、bind 等等待阶段的及时结算和晚到资源清理。

## 验证边界

`pnpm run build`、`pnpm run typecheck`、使用独立 `/tmp` npm 缓存的 `pnpm run pack:tarball` 均成功。定向测试 4/4 通过；全量测试 259/260 失败，故不能把安装器和打包成功视为 M2-R2 验收。首次沙箱内测试因回环监听 `EPERM` 导致 0/4，已在沙箱外重跑；该环境失败不计入产品结论。安装器检查及仓库外包冒烟的本轮结果见证据 JSON。`git diff --check` 在相关文件上通过。

仍需由实施方修复并重新证明整个发布互斥协议；干净 Debian/systemd、可信 TLS、远端 registry 和首个真实发布仍是独立环境验收门槛。

## 给实施方的修复提示词

请在 `/Users/zhaoxingbo/Workspace/ai-driven/svton/shipkit` 只修 M2-R2 TCP 锁的 REG-03 发布互斥和 WAIT-01 获取预算，并保留当前脏工作区的用户文件，勿整体暂存或重置。独立复核证据在本文件及同目录 evidence JSON。已复现：A `mkdir(publock)` 后、写 owner 前暂停，B 将空 owner 目录误判残留并删除；B 取得发布权且真实 bindTest 成功后暂停，A 发布 53925 并持锁，B 恢复发布 54128，同 keyhash 两监听同时有效、两次加一终值 1。未经注入的全量测试还出现 `writeFile(publock/owner)` ENOENT。请设计并论证真正跨进程、同进程都唯一的发布权；不能因 owner 暂未写入或 PID 等于当前进程就删除活互斥，也不能让旧持有者按路径删除后来者的互斥代。修复空/损坏 claim 的恢复路径，不得迁移活映射。保留 TCP 内核持有锁、固定主机注册表、保守失败和现有身份/释放/探针行为。

WAIT-01：`timeoutMs=50`、分配 bindTest 异步等待 250 ms 时虽然 fn 未运行，错误约 274 ms 才返回。让同一 deadline 约束分配、发布、探针、退避、bind 等阶段的等待结束；超时后不运行 fn，晚到的监听、临时 claim/publock/本进程 holding 必须安全清理且不得破坏其他持有者。先增加持久化的可控子进程回归，覆盖上述 owner 尚未写入窗口、同 PID 并发、持有者退出与回收、原 REG-03 迟到分配者、损坏记录有活持有者、发布后未 bind、获取超时与故障解除后恢复；断言 maxActive=1、最终计数=2、映射不改写、无资源残留、超时按预算加合理调度容差结算。再运行定向锁测试、完整 `pnpm run test`、build/typecheck、installer-check、打包及仓库外冒烟。将每项命令、退出码、日志路径、复现结果写入审计记录；实施验证与独立复核分别标注，未复核前 M2-R2 保持开放。
