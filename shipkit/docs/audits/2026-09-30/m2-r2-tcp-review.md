# M2-R2 TCP 内核互斥方案独立复核（2026-10-01）

## 结论

**M2-R2 仍开放（P2）。** 改用监听 socket 持锁消除了上一轮移走文件槽位的直接机制；当前锁相关并发与 SIGKILL 回归均通过。但新的资源身份、探测及释放生命周期有三个确定性缺口，另有端口占用导致的全量验收失败。

本轮只读审查与验证，未修改业务源码。R1、R3 和结构整顿维持此前通过范围；不能将本轮集成失败误报为那些问题复发。

## TCP-01：路径别名使同一文件对应不同锁（P2）

位置：`src/shared/file-lock.ts:121` 的 path.resolve(file)，以及 56–59 行端口派生。

path.resolve 只做词法绝对化，不解析父目录软链接。真实目录与指向它的软链接目录内同名文件是同一个物理文件，却会派生不同端口，两把锁可同时取得。实际调用者 SecurityStore、registry credentials 使用传入的 workRoot 路径，credentials 使用 HOME；这些入口没有统一解析物理父目录。secureWrite 只拒绝最终文件本身为符号链接，不拒绝合法的父目录软链接，因此此触发方式未被现有约束排除。

独立复现：创建 real/state.json 与 alias/state.json（alias 为父目录软链接），两者 realpath 相同。两次锁分别绑定 56448、60724；保持两个临界区时 maxActive=2。两个事务均读取计数 0 并分别加一，最终为 1，预期为 2，实际丢失一次更新。没有伪造任何操作结果。

修复须统一数据资源与锁资源身份；覆盖父目录别名、目标尚不存在的首次创建及后续原子替换。不要将目标文件当前 inode 直接作为长期键：secureWrite 会通过 rename 替换 inode。继续保留拒绝最终目标软链接的既有安全行为。

## TCP-02：探测连接 EOF 不收尾，deadline 也未贯穿探测（P2）

位置：`src/shared/file-lock.ts:78–94` 和 129 行。

probe 只处理 data、error 和 socket timeout，没有处理对端无数据正常关闭的 end/close。独立本机服务接受连接后立即 end，无任何 mock：withFileLock(timeoutMs=100) 观测 1600ms 后仍 pending。连接关闭后 socket timeout 不能再为未完成 Promise 兜底，主循环也无法到达截止时间检查。

另一个服务保持静默不关闭：设置 timeoutMs=100，实际约 1202ms 才失败，原因是 probe 固定等待 1200ms，未使用剩余预算。两者是同一探测生命周期与 deadline 传递缺口的不同入口。

修复须确保 EOF/close/error/data/timeout 等路径均只完成一次，探测使用剩余预算并在结束后释放连接及定时器；无横幅连接不能永远挂起。保留对正常持有者等待、对无关服务明确失败的行为。

## TCP-03：释放依赖对端主动断开，可拖住调用完成（P2）

位置：`src/shared/file-lock.ts:97–101`。

实际对象是 net.Server。本次运行中不存在 closeAllConnections 方法，可选调用不执行。server.close 的完成等待现存连接关闭。

独立复现：正常持锁，建立一个 allowHalfOpen 的真实 TCP 客户端，读取横幅后保持写侧打开，再让业务回调结束。350ms 后 withFileLock 仍未完成；销毁客户端后立即完成。这里不需要攻击性数据，也没有 mock。

这是释放/响应完成受外部连接控制，不代表 callback 结束之后又出现临界区重叠。修复应显式管理本次 server 接收的 socket，并在退出时终止所属连接、完成 close；同时验证新持有者可正常接班、业务异常也能清理。

## 集成阻塞：端口冲突已实际影响全量回归

两次独立全量运行都 exit 1、245/246：

| 运行 | 失败用例 | 实际错误 |
| --- | --- | --- |
| 第一次 | security.test：0600 与符号链接拒绝 | 15000ms 超时；端口 51635 被不同 keyhash 的 shiplock 占用 |
| 第二次 | pair-reuse.test：runtime 不复用 builder 凭据 | 15000ms 超时；派生端口忙且无 banner |

第一次失败后，只读探测端口收到 `shiplock:22208:f061881e`。未查明该服务归属，未终止或修改它。第一次失败用例单独重跑 1/1 通过（临时路径变化），不能据此抹掉全量失败，也不能将两次错误都归为相同持有者。第二次只证明占用与无横幅，未推断其服务身份。

实现方已披露跨文件端口碰撞限制；本轮证明它不是仅理论可能，而是当前环境的实际可用性限制。需要处理冲突策略或明确支持边界，并使当前验收满足该边界；不能静默跳到另一个端口而让同一资源的竞争者分裂为两把锁，也不能擅自杀掉未知占用者。

## 验证与证据

- build、typecheck 均 exit 0。
- 全量两次均 245/246、exit 1；Node 阶段失败使 pnpm test 内安装器步骤未执行。
- 独立执行 installer-check：17/17、exit 0；test 前置生成物漂移检查通过。
- 定向 security 用例：1/1 通过。
- 边界复现全部使用真实临时文件和真实回环 TCP，无模块 mock；主动关闭本轮创建的连接与监听。
- 未重新打包或运行包内冒烟；全量门槛尚未通过，不将此前截图成功当成本轮证据。

完整脚本、结果、源码和日志哈希：[m2-r2-tcp-review-evidence.json](m2-r2-tcp-review-evidence.json)。提取 reproductions 中 source 为对应脚本，调整仓库与输出路径，先构建，然后执行 `node tcp-boundaries.mjs`、`node probe-eof.mjs`。脚本 exit 0 表示观测结束，判断缺陷看保存的结果字段。

日志目录：`/tmp/codex-tool-runs/svton/m2-r2-tcp-review-20261001/`。没有真实 Docker、云资源或生产操作，没有发布或 git 提交。

## 下一轮范围

修复 TCP-01/02/03，补充真实连接与路径别名回归，明确并验证端口冲突处理。保留当前已通过的同键互斥、跨进程、SIGKILL 恢复及最终进展断言；不要回退到已证伪的文件抢占协议。完成全量回归、安装器、打包和仓库外验证后，保持实施方通过与独立复核状态分离。

干净 Debian/systemd、公网可信 TLS、远端 registry 推拉和首个应用发布保持独立真实环境验收门槛。
