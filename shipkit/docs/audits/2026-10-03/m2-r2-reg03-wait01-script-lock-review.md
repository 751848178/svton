# Shipkit 脚本状态文件锁独立复核：REG-03 / WAIT-01（2026-10-03）

**结论：REG-03 未关闭，脚本状态文件的互斥仍可失效；WAIT-01 已阻止超时后执行回调，但超时返回尚不受预算约束。** 本轮只评价脚本使用的本机状态文件锁，不涉及部署、云端或其他产品场景。没有修改运行时代码、提交或发布。运行时采用当前未提交工作树，保留既有用户改动。

## REG-03：活发布互斥目录可被误删，产生双持有者（P2）

位置：[lock-registry.ts](../../../src/shared/lock-registry.ts) 的 `withPublishMutex`：`mkdir(publock)` 与 `writeFile(owner)` 是两次操作，中间 owner 缺失时，竞争者把目录当作过期目录递归删除。若 owner 是当前 PID，也直接回收；清理不验证目录是否仍属于自己。

本轮使用两个真实子进程、真实 `/var/tmp/shipkit-lock-ports`、真实回环监听和实际状态文件写入，仅在原始 `writeFile(owner)` 与 `bindTest` 前后放置调度屏障，不伪造系统调用结果。先让 A 创建 publock 后、写 owner 前暂停；临时占用第一个候选端口，让 B 选择另一个候选并回收 A 的无 owner 目录；B 在发布前的真实 `bindTest` 成功后暂停；释放临时端口，恢复 A，让其发布并绑定；最后恢复 B。结果：同一 keyhash 的监听分别在 **53925、54128** 存活，A/B 同时进入，同一记录由 53925 改写为 54128，双方都读到 0，两次加一最终为 **1（应为 2）**。完整结果在[证据 JSON](m2-r2-reg03-wait01-script-lock-evidence.json)。复现脚本及完整日志保存在 `/tmp/codex-tool-runs/svton/reg03-wait01-independent-20261003/` 和 `/tmp/codex-tool-runs/svton/reg03-pubmutex-race-20261003-135420.log`。

旧 REG-03 的“B 在首次 bindTest 前暂停 → A 发布并持有 → B 恢复”本轮得到同时持有数 1、终值 2；它没有覆盖 publock 所有权窗口。当前全量测试 260 项中有 1 项失败：`file-lock.test` 的正常并发计数测试在 `writeFile(publock/owner)` 报 ENOENT，和目录被另一竞争者删掉的根因相符。该项单独重跑通过，说明失败随交错出现。

## WAIT-01：回调保护有效，等待仍超预算

在分配阶段真实 `bindTest` 前异步暂停 250ms，调用 `withFileLock({timeoutMs:50})`。业务回调**未执行**，返回预算耗尽错误；但调用约 **273.67ms** 后才结束。当前代码在若干异步操作完成后检查 deadline，却没有让获取等待在 deadline 到达时结算。若 `timeoutMs` 约定为脚本获取锁的等待上限，这一部分仍需修正或在接口中明确语义。现有预算测试只断言耗时小于 2500ms，无法检出 50ms 请求等了约 274ms。

## 验证与范围

| 检查 | 本轮结果 |
| --- | --- |
| build / typecheck | 通过 |
| REG-03 / WAIT-01 定向测试 | 4/4 通过；未覆盖上述交错 |
| 原 REG-03 时序 | 串行进入、映射不变、终值 2 |
| 新 publock 交错 | 双重进入、映射被改写、终值 1 |
| full `pnpm run test` | 259/260；并发基线报 `publock/owner` ENOENT；该项单独重跑通过 |
| 本地打包 / 仓库外包冒烟 | 使用临时 npm cache 后通过；首次打包因宿主 npm cache EPERM 失败，与本问题无关 |

首次沙箱定向运行也因回环 `listen` 返回 EPERM 而失败；获准在沙箱外重跑 4/4 通过。日志路径、实际结果及复现命令见[证据 JSON](m2-r2-reg03-wait01-script-lock-evidence.json)。本轮结果不支持关闭 REG-03，脚本安全锁不得按已验收处理。
