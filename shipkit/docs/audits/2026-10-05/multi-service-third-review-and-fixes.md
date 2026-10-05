# 第三次独立复核与直接修复（2026-10-05）

基线：`00f77340`。输入为上一轮 S01–S06 修复报告；用户本轮明确授权独立复核后直接修复。本轮只使用本地代码、模拟云 SDK 和隔离 Docker，不创建云资源、不操作生产端、不升级已安装 CLI，不改 TCP 锁协议。其余 569 项工作区改动在开始时保存了状态快照。

结论：本轮确认的本地缺陷已直接修复，并经稳定反例、模块交叉复审、442 项全量、包外安装与真实 Docker 验证通过。下方外部验收边界仍开放；不把本地通过作为生产交付完成。

路线：specialized。源码冻结、恢复激活、实例取消三个模块由独立 worker 复核并修复，协调者处理清理验证器及集成验收。写入范围互不重叠；统一执行最终全量、包冒烟和真实 Docker。

## 调用链与本轮发现

| 范围 | 源码确认的调用链 | 缺陷与状态 |
| --- | --- | --- |
| 环境文件与来源 | `cmd-release` → v1/v2 pipeline → `source-freeze` → `source-digest`/上传 | 已修：env 符号链接/硬链接别名、`--from-dir` 与 cwd 基准不一致、v1 `--env-file` 未传入构建排除；默认秘密规则同步覆盖别名。真实归档与 CLI 子进程 14/14 通过 |
| 恢复与激活 | group deploy/rollback → `group-recovery` → `group-activation`/ownership/binding → compose | 已修：ownership 异步窗口内改绑、一次 binding 拒绝未锁存停止、失败探针计数、实际 up 前写盘窗口；结构化恢复状态经 JobStore 持久化/重启回读。恢复/激活/部署/回滚 35/35 通过 |
| 取消与释放 | `builder-lease` → signal guard → Tencent provider → provision/termination/state | 已修：实例 ID 先持久化再响应取消；补偿失败保留 ledger；IP 查询后及时响应中止；销毁经官方 SDK 字段及实例 ID 有界确认；过期清理在状态锁内重读，拒绝清掉后来写入的实例账本。43 项定向检查及最后断言修正后的 sweeper 5/5 通过 |
| 清理验收 | e2e → lib → `cleanup-verifier` | 已修：已有标签进入 tracked 集不授予删除权限；基线查询失败拒绝启动；已有标签/悬空 ID 缺失拒绝报 untouched。8 项定向检查通过。e2e 使用随机组身份和专属镜像内容，tarball 纳入清理，真实 prod target 经 marker 验证 |

CodeGraph status 可读，但新清理符号查询无结果，本轮以限定目录的真实源码与调用关系为准。SDK 接口从本地已安装官方类型核对；模拟测试不读取真实密钥。

## 验证记录

- 起始工作区快照：`/tmp/codex-tool-runs/svton/s-third-review/status-before.json`。
- 起始 Docker 只读快照：`/tmp/codex-tool-runs/svton/s-third-review/docker-before.json`（77 条镜像、17 个容器、8 个网络、28 个卷）。
- 清理反例修前：`s-third-cleanup-red-tests-20261005-191951.log`，2 个新增行为断言失败；修后：`s-third-cleanup-green-20261005-192146.log`，8/8 通过。
- 源码归档修前：`source-freeze-red-local-20261005-192006.log`（4 个失败反例）、`source-freeze-alias-red-20261005-192520.log`（默认秘密别名）；修后：`source-freeze-final-green-20261005-192644.log`，14/14 通过，包含实际 CLI 子进程 env 优先级/上传归档核验。
- 恢复修前：`recovery-regression-before-20261005-191849.log`（5 个失败反例）；启动写盘窗口修前：`activation-regression-before-20261005-192543.log`（5/5 失败）；修后：`activation-recovery-after-20261005-192633.log`，35/35 通过。部分探针 verification=skipped / exit=5；探针失败 verification=failed / probesFailed=1 / exit=6。
- 模块交叉复审：恢复 worker 只读核对源码冻结；源码 worker 核对清理范围；实例 worker 核对恢复 gate 与停止语义。均未发现这批补丁新增的确定缺陷。协调者核对官方 SDK 类型，补充纠正自定义模拟的 `InstanceStatus` 字段为 `InstanceState`，并补过期清理账本并发窗口。
- 取消/清理旧 HEAD 反例：`s06-third-review/baseline-regressions.log`（3/3 失败）、`s06-third-review/sweeper-baseline.log`（2/2 失败）。修后：`s06-third-review/focused-tests-sdk-final.log`（43/43）、最后仅修改断言位置后 `s06-third-review/sweeper-final.log`（5/5），均 exit 0；断言在 SDK 回调之外，避免被业务 catch 吞掉假绿。
- 首次全量受沙箱本地 TCP 监听权限限制（`listen EPERM`），停止本次测试及其子进程，退出 143；保留 `s-third-full-test-20261005-193751.log`，不计为验收通过。
- 全量重跑：`env -u TENCENTCLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_KEY pnpm --filter shipkit test`，exit 0，442/442、installer 17/17；`s-third-full-test-local-20261005-194124.log`。
- 包冒烟：`env -u TENCENTCLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_KEY pnpm run smoke:package`（shipkit 目录），exit 0；`s-third-package-20261005-194310.log`。只在隔离目录安装，不升级用户 CLI。
- 真实 Docker：`env -u TENCENTCLOUD_SECRET_ID -u TENCENTCLOUD_SECRET_KEY node scripts/e2e-multi-docker.mjs`（shipkit 目录），exit 0，日志 `s-third-docker-20261005-194609.log`。全量/部分/坏探针失败恢复/回滚/混合 keep-env/新增服务拒绝均通过；真实 prod target marker 可读取；外部卷内容及 CreatedAt 保留，未选 web 的 ID/StartedAt 不变。
- 资源复检：清理本轮 2 个容器、2 个网络、1 个卷及 6 个镜像标签；`s-third-review/docker-after.json` / `docker-delta.json` 与起始快照对比，镜像、容器、网络、卷及已有容器启动时间/卷创建时间全部差分为 0。已有 77 条镜像、17 个容器、8 个网络、28 个卷保持原身份，零本轮新增残留。
- 包外安装冒烟含 50 项部署隔离回归；本轮新增 36 项仓库回归（406→442）。源码（含脚本与测试 fixture）均 ≤200 行，`git diff --check` 通过；与起始快照比较，其他 569 项改动保持原状态。日志均在 `/tmp/codex-tool-runs/svton/`。

共享 daemon 验收限制：若别的任务在测试期间创建镜像，全局差分会保守报告残留，但不会据此删除它们。本次前后差分没有此情况。

## 外部验收边界

真实 TCR 推拉、CVM 主动/定时销毁回读、TWGG 多轮发布/H5/数据保留及安装升级仍待明确恢复。联动探针与同机多环境并存继续保留 TODO。本轮不以本地修复和隔离验证宣称生产链路完成。

取消仍有外部响应边界：若 RunInstances 超过 8 秒 settle / 10 秒信号总预算且尚未返回实例 ID，进程只能有界退出并如实告警，不能安全猜测实例并删除。请求内的 ActionTimer 是云侧后备；该情况下创建结果与定时回收尚无真实云端回读证据。已知 ID 的取消补偿、失败保留和销毁确认均有上述模拟证据。
