# R01–R12 修复证据（2026-10-05 修复轮）

对象：独立复核报告 `multi-service-independent-review.md` 的全部 12 项问题。修复前先落稳定回归（仓库内 dist 测试与重建后的 e2e），再改实现；审计的 /tmp 复现脚本仅作对照，未依赖为长期测试。全程未创建云资源、未改生产端与本机安装、未动 TCP 锁协议；其他 Devpilot/UI 工作区改动保留。

## 逐项关闭

| ID | 修复 | 稳定回归（仓库内） | 证据 |
| --- | --- | --- | --- |
| R01 首次失败清理缺归属复核 | `group-recovery.ts`：首部署删除路径在每次 `down` 前重新 `assertOwnedCompose`；绑定复核先行，任何恢复动作前整体拒绝 | `group-recovery.test.ts` 用例1：up 失败窗口被抢占 → 零 down、零误报（recovery.succeeded=false） | `all-r-tests-run3.log`/`recovery-run2.log` |
| R02 身份未贯穿 | `group-activation.switchService` 在归属复核后追加 `assertProjectBinding(identity, allowClaim=false)`；`recoverServices` 恢复前先复核绑定（丢失/损坏/变更→整体拒绝） | 用例2：拉取窗口改绑 project-b/staging → 零 up、零 down、状态原样、recovery.succeeded=false | 同上 |
| R03 恢复假报成功 | 恢复后对每个**实际恢复**的服务重新 `verifyService`：探针失败→`succeeded=false`；无探针→报告"verification skipped, not verified"（deploy 与 rollback 两个入口共用） | 用例3/4/5：恢复后仍不健康→false；无探针→skipped 文案；回滚路径同样生效 | 同上 |
| R04 外部命名卷渲染 | `compose-service.renderServiceCompose` 输出顶层 `volumes: <name>: {name, external:true}`（bind 不需要） | `group-deploy.test.ts` 外部资源用例断言顶层块；真实 e2e R1/R2 卷实际挂载+数据保留 | `e2e-run1.log` |
| R05 混合 keep-env | `group-merge.ts`：keepEnv 时有已提交 env→继承；`hasEnv:false`→明确保持无 env；无组合→拒绝；CLI 计划对"首部署+keepEnv"前置拒绝（`release-plan.ts`） | `group-deploy.test.ts` keepEnv 用例（envful 继承+envless 保持）；`release-plan.test.ts` 首部署 keepEnv 拒绝；真实 e2e R5 | 同上 |
| R06 新增未选服务漏检 | `release-plan.ts`：既未选中又无可继承版本的服务在计划阶段拒绝（与运行端 mergeCombination 同判定） | `release-plan.test.ts` R06 用例；真实 e2e R6（真实 CLI exit 2，无构建） | 同上 |
| R07 缺 digest 仍出 manifest | `pipeline-multi.ts`：push digest 必须 `sha256:<64hex>` 且与 ref 一致，否则拒绝产出 manifest；`routes-groups.ts` 只接受 `@sha256:` 固定 imageRef（400） | `multi-build.test.ts` R07 用例（none/非法 hex）；`multi-isolation.e2e.test.ts` 运行端 400 断言 | 同上 |
| R08 一个 v2 组打瘫 GC | `gc-protection.ts`：按 group.json 标记分流 v1/v2；v2 保护所有保留组合的全部服务镜像；标记损坏/坏快照/坏状态→GC 中止（fail-closed） | `gc-protection.test.ts` 三用例（混合保护、仅 v2 组、三类损坏中止） | 同上 |
| R09 取消不释放 | `signal-guard.ts` + `builder-lease`：动态租约期间武装 SIGINT/SIGTERM，首个信号执行有界（10s）`provider.release()` 后按信号退出；第二信号直接默认退出；keep 配置不豁免用户取消；静态模式不武装 | `builder-cancel.test.ts` 真实子进程：SIGINT/SIGTERM 均实测 RELEASE-CALLED 且按信号退出；release 失败如实上报；静态模式不武装 | 同上 |
| R10 from-dir 出处不可辨 | `source-digest.ts`：对上传源码树（同排除规则、排序路径+内容）求确定性 sha256 `contentDigest`，写入部署 source；tarball 带 sha 在运行端被拒（不伪造 Git 出处）；继承服务保留各自旧出处 | `multi-build.test.ts` R10 用例（确定性：同树同摘要、改内容变摘要、无 sha） | 同上 |
| R11 平台记错/假报 | manifest 记录每服务**生效平台**（覆盖优先）+ 实际 `arch` + `archVerified`（仅 arch==平台 才 true）；已知 arch 矛盾→拒绝 | `multi-build.test.ts` R11 用例（覆盖记录、矛盾拒绝、未知记 false） | 同上 |
| R12 e2e 残留+超行 | 脚本拆分为主入口（186 行）+ `e2e-multi-docker-lib.mjs`（163 行）；按本项目精确标签/名字跟踪清理（容器按 compose project 标签、网络含 compose 默认网络按标签、卷按精确名），清理后**复检零残留**才报 ok；无前缀式删除 | 真实 e2e 输出末行 `cleanup verified: zero containers/networks/volumes left` | `e2e-run1.log` |

## 规划缺口处置

- `dependsOn`：规格校验（存在/不自依/不重复）+ plan `constraints.declaredDependencies` 展示已实现（`spec-v2.test.ts`、`release-plan.test.ts`）。
- CLI 回滚版本冲突：`ship rollback <group> --base-release <id>` 已接入运行端既有 stale 检查（USAGE 已更新）。
- 联动探针（跨服务调用级验证）：**未实现，保留 TODO**（文档明示，不宣称完成）。
- 同机多环境并存：**未实现，保留显式拒绝**（文档明示为后续命名扩展工作）。

## 修复引入的结构调整

`group-store` 拆出 `group-snapshots`/`group-store-types`（上轮）；本轮再拆 `group-merge`（合并+keepEnv 语义）、`group-recovery`（R01-R03 恢复）、`gc-protection`（R08）、`signal-guard`（R09）、`source-digest`（R10）；`handlers-group-deploy/rollback` 保持编排职责。全部源文件 ≤200 行（见收口记录）。

## 收口验证（本轮）

| 命令 | 退出码 | 结果 | 日志 |
| --- | --- | --- | --- |
| `pnpm test` | 0 | 392/392（第一轮 390 + 第二轮 source-digest 2） | `full-test.log`/`full-test2.log` |
| `pnpm run smoke:package` | 0 | 包外安装+隔离回归通过 | `smoke.log`/`smoke2.log` |
| `node scripts/e2e-multi-docker.mjs` | 0 | 26 项断言全过 + 零残留（第二轮起含镜像：6 images removed） | `e2e-run1.log`/`e2e-round2.log` |

日志目录：`/tmp/codex-tool-runs/svton/r-remediation/`。

## 独立复审（修复后，子代理对抗式审查）与第二轮修复

复审结论：R01–R09、R11、R12 判定 CLOSED（逐条核对了触发路径重放与实现位置）；**R10 判定 NOT-CLOSED**：`sourceContentDigest` 的排除匹配按路径组件比对，而 `tar --exclude` 对含斜杠模式按完整相对路径匹配——`envFile: config/prod.env` 这类合法声明会导致摘要覆盖范围与上传内容不一致（env 内容哈希进入快照、env-only 变更误改"源码"摘要）。另列 7 项 P3 级残留。

第二轮修复（全部落回归后关闭）：

| 项 | 处置 |
| --- | --- |
| N1 (P2) R10 排除语义 | `source-digest.ts` 改为 tar 语义（含斜杠/通配模式匹配完整相对路径与后缀段；裸名匹配组件）；符号链接按其 target 参与摘要（tar 会归档链接）。行为级回归 `source-digest.test.ts`：改排除项（斜杠式 envFile、组件式 config）摘要不变；改包含项必变；与真实 `tar -tzf` 条目集一致（含符号链接） |
| N2 keepEnv 前置不足 | `release-plan.ts`：keepEnv 下选中服务无已提交组合即拒绝（构建前），与运行端同判定 |
| N3 回滚固定性纵深 | `handlers-group-rollback.ts`：恢复源快照中非 `@sha256:` 固定引用拒绝回滚（防手工/外来快照走私可变 tag） |
| N4 GC 被杂物卡死 | `gc-protection.retainedReleaseIds` 过滤非发布 ID 形状的条目（.DS_Store 等不再中止 GC；ID 形状条目仍严格加载） |
| N5 弱测试 | `multi-build.test.ts` from-dir 用例改为真实 `packSourceDir` + `tar -tzf` 断言 envFile 不入档 + 共享上传 id |
| N6 e2e 镜像残留 | 跟踪器记录本次构建镜像 digest，清理时按精确 ID `docker rmi` 并纳入零残留复检 |
| N7 守卫窗口 | `builder-lease.ts`：guard 在最终 finishBuilderRelease 之后才 dispose（收尾窗口信号仍有界清理）；空恢复集文案如实报告"无可恢复" |

复审原文（含逐项 file:line 判定）存于会话审计记录；未发现新的 P1。

## 剩余限制（不变）

- 本机 daemon 代理拦本地 registry：真实 e2e 不含推/拉 registry 环节（单测+既有云上证据覆盖）；TCR 全链路待用户恢复后验收。
- MS-06 真实 TWGG 接管/多轮/只发 admin/回滚/H5/数据保留，与真实 CVM 主动+定时销毁回读：待用户明确恢复。
- 已安装 CLI（`~/.local/bin/ship`）未升级；新能力在仓库源码与包产物中，端点升级另行执行。
