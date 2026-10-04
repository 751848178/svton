# M2-R2 第七轮独立复核：mkdir 与首次 stat 的窗口（2026-09-30）

## 结论

**M2-R2 仍开放（P2）。** 第七轮在发布后加入的 inode 校验，不能证明第一次记录下来的 inode 属于自己创建的目录。`mkdir` 与紧随其后的 `stat` 是两个独立异步操作；在两者之间暂停，旧目录可被回收重建。旧发布者恢复后，将新目录 inode 错认成自己创建的代次，最终与新发布者同时取得回收权。

本轮只复核 M2-R2，未修改业务源码。R1、R3 和安装脚本结构整顿维持此前通过范围。

## 唯一发现：代次采样晚于目录创建，绑定仍不成立

位置：`src/shared/file-lock.ts:150–151`（mkdir 与第一次 stat）；后续 161 行校验沿用这个可能错误的 generation。

确定性交错：

1. A 成功 mkdir 创建旧 `.prev`；在调用第一次 stat 前暂停。
2. 自然等待 650ms；B 清理无 owner 的旧目录，创建新目录并发布 owner.B，通过代次与死锁身份检查，在 rename 前暂停。
3. A 恢复，真实 stat 读到的是 B 新目录的 inode。A 将其记录为 generation，然后在新目录中创建 owner.A。
4. A 的第二次 stat 与第一次值相同，自己的具名记录也可读，故校验通过；A 也通过死锁身份检查，在 rename 前暂停。
5. 先放行 B 并保持临界区，再放行 A。A 覆盖 B 活锁并进入，发生重叠。

实测：`maxActive=2`、`activeAtObservation=2`、`overwroteLiveB=true`、`bLockChanged=true`；旧目录 inode=160692661，新目录 inode=160692664；替换前同目录有两份不同 nonce 的 owner 记录。

这不依赖 inode 重用或 stat 返回错误。只是在路径已经换代之后才首次采样，后续校验自然一直一致。自己的记录可读只能证明后来创建的记录在新目录里，不能证明自己最初 mkdir 的目录仍然在位。

当前 s7 在 owner 的 open 前暂停，此时第一次 stat 已完成，因此不能覆盖本轮更早的窗口。

## 证据与复验

使用真实文件系统及真实退出子进程 PID（确认 ESRCH）；A/B 为单进程内并发调用，通过 AsyncLocalStorage 标记。仅在第一次 stat 前与双方 rename 前暂停调度，所有 stat/open/rename 均真实执行，不伪造 inode 或文件操作结果；不冒称跨进程端到端复现。

完整脚本与结果：[m2-r2-inode-review-evidence.json](m2-r2-inode-review-evidence.json)。提取 reproduction.script，按环境调整仓库和日志路径，先构建，再执行 `node --experimental-test-module-mocks inode-race.mjs`。exit 0 代表复现结束，缺陷判据为结果中的 maxActive=2 和活锁被覆盖。

日志目录：`/tmp/codex-tool-runs/svton/m2-r2-inode-review-20260930/`。

## 后续修复要求

- 必须解释“原子取得回收权”与“取得不可混淆的身份凭据”如何绑定；不能继续把 mkdir 后按路径读取的 inode 视作创建操作的返回身份。
- 不接受简单多读一次 stat/token、缩小窗口或延长时间阈值。若改用打开目录句柄，应同样证明句柄取得之前的路径换代不会导致错误归属，不能只把窗口移到 open 前。
- 可以重新选择适用平台的成熟锁原语，验证进程内、跨进程、崩溃释放及离线分发语义；若保留自实现，重新审视完整协议，不沿用已被该反例否定的排他假设。
- 将本轮“mkdir 后、首次身份采样前暂停”加入持久回归，保留双方替换控制、先进入者持有、maxActive=1、活锁身份不变和释放后等待者最终获得的断言。
- 保留此前全部竞争场景、真实 SIGKILL 恢复与统一有界等待验证。不要只修这一个暂停位置而牺牲前几轮保证。

真实环境门槛保持独立：干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首个应用发布。本轮未操作真实资源，未发布、未 git 提交。

## 本轮独立验证结果

build、typecheck 均 exit 0；全量测试 exit 0：246/246 Node 回归、17/17 安装器检查及生成物漂移检查通过。安装包冒烟本轮未重跑，不把截图声明作为独立结果。上述通过与本轮确定性互斥失败同时成立。
