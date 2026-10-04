# M2-R2 第五轮独立复核（2026-09-30）

## 结论

**M2-R2 仍开放（P2）：回收者崩溃后不可恢复，且重试绕过 timeoutMs。** 本次未声称第五轮已发生双重进入；实际确认的是崩溃恢复及有界等待失败。R1、R3 与结构整顿维持此前通过状态。

## 触发与根因

`src/shared/file-lock.ts:92–104` 将 owner 移至 `${prev}/owner.gone.${nonce}`。该证物仍在 prev 目录内，清理者在真实 rename 完成后、校验或 unlink 前崩溃，目录内会永久留下 gone 文件。

后继者的 `readFile(prev/owner)` 返回缺失，走 110–114 行的 ownerless 分支；目录超过 500ms 后尝试 rmdir，但目录内有 gone，真实文件系统拒绝删除。错误被吞掉，却返回 retry。185 行直接 continue，跳过 188 行超时判断和后续抖动等待。

这与处置文档“gone 惰性残留，prev 变空目录可由 rmdir 恢复”的说明矛盾：目录实际不空。

## 独立复现

1. 用真实退出子进程 PID 构造死锁与死亡回收者记录，确认 PID 检查返回 ESRCH。
2. 启动清理子进程，真实执行 `rename(owner, owner.gone.*)`，仅暂停后续调度并通过 IPC 通知父进程。
3. 父进程 SIGKILL 清理者，确认退出。自然等待 650ms 使目录超过年龄阈值。
4. 启动另一个子进程，使用未 mock 的当前实现，调用 withFileLock，设置 timeoutMs=150。
5. 等待 1200ms，既未进入临界区，也未返回超时或其他错误；父进程终止测试子进程。gone 残留仍在。

实测：`exitedBeforeWatchdog=false`，观测 1202ms；事件仅有 waiter-started。两端都是真实独立子进程，只有清理者的调度暂停被注入，未伪造文件操作结果。有限观测证明超过超时仍未返回；无界重试的判断由源码循环共同支持。

完整脚本和结果：[m2-r2-generation-review-evidence.json](m2-r2-generation-review-evidence.json)。提取 reproduction.script 并调整仓库/日志路径，构建后执行 `node --experimental-test-module-mocks crash-recovery.mjs`。脚本 exit 0 是复现完成，不代表锁验收通过。

日志：`/tmp/codex-tool-runs/svton/m2-r2-generation-review-20260930/`。

## 验证边界

本轮独立重跑 build、typecheck 均 exit 0，241/241 Node 回归、17/17 安装器检查、生成物漂移检查通过。未重跑安装包冒烟，不将截图的包内 17/17 作为本轮独立证据。没有修改业务源码，没有生产、云资源、真实 Docker 操作或发布。

## 下一轮要求

- 完整定义拿走 owner 后各个崩溃点的证物归属与恢复，包括拿走真正死亡 owner，以及因过期观察拿走后来活 owner 的情况。不能仅无条件删除 gone/prev，也不能依靠事后放回来证明中间状态安全。
- 残留恢复必须可完成；同时所有重试分支都遵守统一截止时间并有退避。只补超时仍不能关闭崩溃恢复缺陷。
- 新增真实 SIGKILL 子进程回归：拿走后、校验前、恢复前、删除前，以及恢复者再次崩溃。保留互斥、活持有者不受损及等待者最终正常获得的断言。
- 短超时须有界返回；足够长的等待须完成合法恢复并进入临界区。不得把“所有调用均超时”视为修复。
- 保留前五轮场景与已有 241 项回归，完成打包和仓库外验证后标注实施方通过、待独立复核。

干净 Debian/systemd、公网可信 TLS、远端 registry 推拉、首次发布仍为独立待完成的真实环境门槛。
