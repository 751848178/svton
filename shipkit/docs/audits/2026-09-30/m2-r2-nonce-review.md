# M2-R2 第六轮独立复核：具名记录与目录换代（2026-09-30）

## 结论

**M2-R2 仍开放（P2）。** 具名 owner 解决了删除操作误命中不同记录的问题，但没有保证同一回收目录内只能有一个有权执行替换的发布者。目录被清理重建后，暂停中的旧发布者能够在新目录中创建自己的不同名记录；双方均通过原锁身份检查，随后覆盖活锁并重叠进入临界区。

本轮 build/typecheck 均 exit 0，246/246 Node 回归、17/17 安装器检查及漂移检查通过。未重跑包内冒烟；R1、R3 和结构整顿维持此前通过范围。未修改业务源码。

## 确定性失败交错

对应 `src/shared/file-lock.ts` 的 mkdir / publishExclusive(owner.<nonce>) / stale-verdict guard / rename(claim, lock) 链路。

1. A 成功创建 `.prev`，在执行 `open(prev/owner.A, wx)` 前暂停。
2. 自然等待 650ms；B 清掉仍为空的旧目录，重新 mkdir，创建 owner.B，通过死锁身份校验，在 rename 前暂停。
3. A 恢复。它打开的是当前路径对应的新目录；由于 owner.A 与 owner.B 是不同文件名，真实 `open(wx)` 成功，而非 EEXIST。
4. A 也通过死锁身份校验，在 rename 前暂停。此时同一个目录同时有两份 owner 记录，且 A、B 都已经进入“mine”路径。
5. 放行 B，使其替换锁并保持临界区；再放行 A，A 覆盖 B 活锁并进入临界区。

实测：`maxActive=2`、`activeAtObservation=2`、`overwroteLiveB=true`、`bLockChanged=true`；旧目录 inode 为 160650634，新目录为 160650635；替换前目录内同时存在两个不同 nonce 的 owner 文件。

`inspectPrev` 的 records.length > 1 保守等待只影响后来走检查分支的调用，不能撤销已经认为自己取得槽位的 A、B。具名文件的独占创建只能保证同名文件唯一，不能证明父目录发布者唯一。

## 现有 s7 为何全绿

`file-lock-race.test.ts` 的 s7 保留了“A 的 publish hits EEXIST on B's owner”注释，但具名文件已不满足该假设。A 的回调只是立即 enter/exit，测试只暂停 B 的替换，没有暂停 A 的替换并保持其临界区；A 可以先完成后再让 B 完成，计数仍为 1。最终 owner 原样和最终双方成功不足以证明这段交错中的回收权唯一。

新增验证必须同时控制双方的替换时机，并让先进入者保持临界区，才能观测后进入者是否破坏互斥。

## 方法与证据

使用真实文件系统、真实退出子进程 PID 并确认 ESRCH；只暂停 open/rename 前的调度，不伪造文件操作结果。A/B 是同一进程内通过 AsyncLocalStorage 标记的并发调用；这是确定性协议复现，不冒称独立进程端到端失败。

脚本全文与观测：[m2-r2-nonce-review-evidence.json](m2-r2-nonce-review-evidence.json)。提取 reproduction.script 并调整仓库与输出路径，构建后执行 `node --experimental-test-module-mocks nonce-race.mjs`。脚本 exit 0 表示复现完成，失败判据为 maxActive=2 等结果。

日志：`/tmp/codex-tool-runs/svton/m2-r2-nonce-review-20260930/`。

## 下一轮要求

- 完整约束目录创建代次、发布资格和最终替换权限：旧目录创建者不能因为同一路径重新存在，就在新目录中取得回收权。
- 不接受只增加一次 stat/inode/token/readdir 检查、延长阈值或检查记录数量，除非有覆盖检查之后交错的排他依据。不要回退到已被证伪的无条件清理或拿走后放回方案。
- 若重新选用成熟锁原语，验证目标平台与离线包兼容性；若保留自实现，必须重新论证完整协议，不能沿用已依赖旧假设的“前几轮已证明”注释。
- 将本轮交错转为持久回归：双方先通过身份检查，B 进入并保持，A 恢复不得重叠或改写 B 锁；B 正常释放后 A 必须能获得。保留前六轮竞争、真实 SIGKILL 恢复和有界等待场景。
- 通过后再完成全量回归、打包和仓库外安装验证，标记“实施方验证通过，待独立复核”。

本轮没有发布、git 提交或真实资源操作。干净 Debian/systemd、公网 TLS、远端 registry 推拉及首个应用发布仍为独立真实环境门槛。
