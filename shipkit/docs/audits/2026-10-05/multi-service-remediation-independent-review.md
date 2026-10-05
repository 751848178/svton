# R01–R12 修复后的独立复核（2026-10-05）

对象：代码提交 `146d6b9a`，文档提交/本轮 HEAD `eb95ca12`。输入为 ZCode 的修复报告、原独立审计及用户提供的收口截图；截图中的通过声明作为待核实证据，不作为完成结论。

结论：R01、R04、R05、R06、R07、R08、R11 原触发路径通过；R02、R03、R10、R12 仍有确定缺陷；R09 基础取消处理已实现，准备机器阶段的主动释放存在确定性限制。整体尚未通过本地独立验收。联动探针与同机多环境并存是明确保留的 TODO，不混入“代码缺陷”计数。

本轮只读运行源码，未改 TCP 锁、用户本机安装、生产端或云资源。新增文件仅为审计/提示词与 TODO 链接。其他 569 条工作区状态保留。复现中的秘密均为合成 fixture，Tencent SDK、凭据与用户 ledger 均隔离替换。

## 独立复跑

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `pnpm --filter shipkit test` | exit 0，392/392 | `/tmp/codex-tool-runs/svton/multi-service-r-second-test-20261005-180732.log` |
| `pnpm run smoke:package` | exit 0，包外安装与隔离回归通过 | `/tmp/codex-tool-runs/svton/multi-service-r-second-package-20261005-181100.log` |
| `node scripts/e2e-multi-docker.mjs` | exit 0，26 项断言通过 | `/tmp/codex-tool-runs/svton/multi-service-r-second-docker-20261005-180948.log` |

真实 Docker 路径覆盖全量、部分、坏探针失败恢复、回滚、外部卷数据/CreatedAt 保留、混合 keep-env 和新增未选服务拒绝。本轮前后精确镜像 tag 快照显示新增残留为 0；这是本次正常清理的实际结果，不等于清理验证器在异常时可靠。镜像平台为本机 arm64，未经过 registry 推拉；仍不证明新协议的 TCR/CVM/TWGG 生产验收。

镜像快照：`/tmp/codex-tool-runs/svton/multi-service-second-review/images-before.json`、`images-after.json`、`new-image-residue.json`。非测试源文件 200 行上限检查通过。

## 已重放并通过的原问题

- R01：首次 up 失败且项目被外来容器占用时，零 down，恢复失败如实报告。
- R02 原 pull 窗口：绑定改变、丢失或损坏均零 up/down，提交状态不变；下述多服务恢复窗口仍缺检查。
- R03 原健康失败：部署和回滚都再次探测旧组合；旧组合仍不健康时 `recovery.succeeded=false`。下述混合探针报告仍不准确。
- R04：真实 Compose config 接受外部命名卷；真实 Docker 验证原卷数据与创建时间不变。
- R05：有 env 与明确无 env 混合继承成功；声称有 env 却丢文件的快照拒绝。
- R06：新增未选/不可继承服务、keep-env 选中新服务及首次 keep-env 均在计划阶段拒绝。
- R07：缺失、非法及不一致 digest 拒绝 manifest；运行端非法引用返回 400、零任务创建。
- R08：混合 v1/v2 当前、上一及 retained 快照的引用受保护；坏状态/标记/快照关闭 GC 删除。
- R09 基础行为：已增加有界 SIGINT/SIGTERM 守卫；活跃已准备租约的模拟 release 调用已在回归中验证。
- R11：服务覆盖后的有效平台正确记录；已知架构矛盾拒绝，未知如实标为未验证。

运行恢复证据：`/tmp/codex-tool-runs/svton/runtime-r-recheck-20261005.mjs`、`.log`。合约证据：`runtime-r-contract-recheck-20261005.mjs`、`.log`。这些脚本的 Docker/健康动作在 seam 中模拟，真实 Compose config 检查不会创建资源。

## 仍需修复或落实的条目

### S01 · P1 · 合法 envFile 被当成 tar glob，可能进入构建包（R10/F06）

位置：`src/cli/pipeline.ts:45`、`src/cli/source-digest.ts:18`、`src/shared/spec-schema.ts:115`。

规格接受相对文件名 `prod[1].env`。打包把该路径直接作为 `tar --exclude` glob，结果误排除普通文件 `prod1.env`，而真正声明的 `prod[1].env` 留在上传归档里；摘要逻辑恰好排除了声明文件，因此摘要也不能反映归档事实。常用 Dockerfile 的 COPY 可进一步将该环境文件带入镜像，违反运行秘密不进入 builder/源码包的边界。

独立复现使用合成字符串，结果 `declaredEnvUploaded=true`、`ordinaryFileOmitted=true`：`/tmp/codex-tool-runs/svton/multi-service-second-review/literal-env-repro.mjs`、`literal-env-results.json`、`literal-env-repro.log`。

另有同源覆盖错误：`./config/a.env` 摘要与 tar 匹配不一致；`config/*.env`、`?`、`[]` 的匹配也没有统一。配置中的 envFile 是字面路径，不能直接套用 glob。应规范化字面路径，避免再维护两份近似排除算法，并覆盖 v1 的共用打包入口。

### S02 · P1 · 多服务首部署恢复中，改绑后仍清理下一项（R02）

位置：`src/agent/group-recovery.ts:38`、`:61`、`:62`。

身份只在 recoverServices 入口检查一次；每次 down 前仅重查 Compose 归属。复现：api/web 首次部署后因健康失败清理；第一个 down 的窗口把 binding 改成 project-b/staging，仍执行第二项 `ship_sample_web` 的 down，并返回恢复成功。应在每个实际恢复/删除操作前重查原项目/环境绑定，变化后停止后续动作并报告准确范围。

证据：`runtime-r-recheck-20261005.log` 中 `NEW-R02-recovery-rebind-after-first-down-still-downs-second`；绑定已经变成 B/staging，`downProjects` 仍包含 api/web。

### S03 · P2 · 摘要和上传源码不是同一份快照（R10）

位置：`src/cli/pipeline-multi.ts:80`、`:89`。

摘要在准备构建机/能力检查之前计算，之后再扫描当前目录打包。完整流水线模拟在能力检查期间正常编辑源码：manifest 保存旧摘要，实际上传归档为新代码，仍成功返回。动态机器准备时间会扩大这个窗口。需要先冻结一次上传内容，再从同一份不可变产物取得摘要并上传，避免二次读取活动工作区；不能只把两个扫描的时间拉近。

证据：`/tmp/codex-tool-runs/svton/r09-r11-reaudit/pipeline-toctou.mjs`、`pipeline-toctou.log`，`matchesUploaded=false`。该目录有按 HEAD 编译的隔离 dist 与只读使用的 node_modules 链接，无真实云凭据。

### S04 · P2 · 部分恢复服务未探测，却汇总成全部验证通过（R03）

位置：`src/agent/group-recovery.ts:77`、`:84`；传播到 `handlers-group-deploy.ts:40`。

恢复 api/web，其中 api 探针通过、web 没探针。循环跳过 web，只要有一个 probe 通过就令整个 `verification='passed'`，最终打印 `and re-verified healthy`。实际只调用一次探针，web 日志明确 SKIPPED。恢复动作成功可单独保留，但验证汇总不能覆盖跳过项；应保留逐服务结果或使用 failed > skipped > passed 的保守汇总。

证据：`runtime-r-recheck-20261005.log` 的 `NEW-R03-mixed-probe-recovery-overstates-verification`。

### S05 · P2 · 清理复检仍可能假报零残留（R12）

位置：`scripts/e2e-multi-docker-lib.mjs:145`、`:151`–`:168`。

删除镜像遇到 conflict 被忽略；tracker 存完整 64 位 image ID，后续 `docker images --format '{{.ID}}'` 默认返回 12 位，比较永远漏掉该残留。模拟当前 helper 的删除 conflict + 有镜像残留，仍 exit 0 并打印“zero ... images left (1 images removed)”。另外查询失败多处被当成空结果，也会制造假绿。

证据：`/tmp/codex-tool-runs/svton/multi-service-second-review/cleanup-verifier-repro.mjs`、`.log`、`cleanup-verifier-results.json`。没有执行真实 Docker 删除。应使用可一致比较的精确身份，查询失败明确失败；跟踪本次新增 tag/资源，不能强制删除已有或共用镜像来凑零残留。本次正常 e2e 确实没有新增镜像残留，问题是异常验证逻辑不成立。

### S06 · P2 · 准备实例期间取消被创建锁阻塞（R09 限制）

位置：`src/providers/tencent.ts:48`、`:183`；`src/cli/builder-lease.ts:42`。

ensure 持同一状态锁覆盖创建与 Agent 健康等待；取消的 release 需要同锁。使用真实 TencentBuilderProvider、模拟 SDK/健康/ledger，SIGINT/SIGTERM 均约 10.1 秒退出，TerminateInstances 调用 0，状态仍 provisioning。守卫如实提示清理超时，**没有假报销毁**；但准备实例阶段的取消尚不能实现主动释放。

证据：`/tmp/codex-tool-runs/svton/r09-r11-reaudit/cancel-ensure-repro.mjs`、`cancel-ensure-child.mjs`、`cancel-ensure-repro.log`。应让准备流程协作取消并进入补偿/释放路径，在安全锁和租约规则内清理本次实例；不能绕过锁去删其他任务的机器。云定时销毁是兜底，不是这条本地可模拟释放路径的完成证据。

## 下一步与边界

修复 S01–S06，再重放这些补充触发路径及原 R01–R12，保留本轮通过的正常行为。完整修复提示词：`docs/handoffs/2026-10-05-multi-service-second-remediation.md`。

生产暂停与本机安装未升级的状态保持。真实 TCR 推拉、CVM 主动/定时销毁、TWGG 接管/多轮发布/admin 选择/回滚/H5/数据保留待用户明确恢复；联动探针与同机多环境并存继续明确 TODO，不以本轮绿灯宣称已完成。
