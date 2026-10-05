# 多服务实现独立复核（2026-10-05）

复核对象：ZCode 提交 `b627d47e`，对照 `docs/plans/multi-service-release.md` 与实现报告。结论：主要发布链路已实现，本地正常路径通过；独立故障审计未通过，不能将 MS-01–MS-05 的本地部分整体标为验收完成。

本轮没有修改运行源码、升级本机/服务器安装、创建云资源、访问生产服务器或执行数据库迁移。其他 Devpilot/UI 工作区改动保留。本机现有 `~/.local/bin/ship --help` 仍没有 `--services`/`--plan`，仓库实现与已安装版本须分开看待。

## 重新执行的验证

| 检查 | 结果 | 原始证据 |
| --- | --- | --- |
| `pnpm --filter shipkit test` | exit 0；372/372，含类型编译、安装脚本检查 | `/tmp/codex-tool-runs/svton/multi-service-independent-test-20261005-163843.log` |
| `pnpm run smoke:package` | exit 0；仓库外安装和 50 项部署隔离回归通过 | `/tmp/codex-tool-runs/svton/multi-service-independent-package-20261005-164112.log` |
| `node scripts/e2e-multi-docker.mjs` | exit 0；19 项正常路径断言通过 | `/tmp/codex-tool-runs/svton/multi-service-independent-docker-20261005-164111.log` |

真实 Docker 验证了 target、生效的运行 env、外部网络、全量 → 仅 api → 回滚，以及未选 web 的 ID/StartedAt 不变。这次镜像是本机 arm64、daemon 内的固定镜像；未覆盖 amd64/TCR 推拉或生产接管，不能用旧云端专用脚本的证据替代新多服务协议验收。

调用链：`cmd-release → release-plan → pipeline-multi/builder-lease → pipeline-group-deploy → group handler → GroupStore/group-activation → Docker/health`；v1 `ReleaseStore`、镜像 GC、信号退出和 e2e 清理是本轮发现的遗漏边界。

## 已确认的问题

### R01 · P1 · 首次失败清理缺少归属复核

位置：`src/agent/group-activation.ts:140`；`src/agent/docker.ts:158`。

首次部署的 `up` 失败后，没有旧快照时直接对 service project 执行 `compose down`。如果 `up` 窗口出现同 project、其他 working directory 的容器，清理仍对其执行 down。补充模拟用例显示失败 up 后唯一命令为 down，`foreignDown=true`，并误报恢复成功。这会停止/移除非本次部署的容器；没有发现删卷调用，但容器风险本身必须关闭。

### R02 · P1 · 激活前未重查项目/环境绑定

位置：`src/agent/handlers-group-deploy.ts:111`、`handlers-group-rollback.ts:48`、`group-activation.ts:80`。

绑定只在预拉取前检查。拉取时将 `project.json` 从 project-a/prod 改为 project-b/staging，旧请求仍执行 up 并提交。v1 激活路径已有第二次身份检查，v2 未保留。需要把原身份传入激活、恢复和清理，在修改前拒绝绑定丢失、损坏或变化。

### R03 · P2 · 不健康的恢复被报告为成功

位置：`src/agent/group-activation.ts:137`；部署和回滚共用。

恢复只执行旧组合的 up，没有再次健康检查。持续失败的探针只调用一次，恢复仍返回 `succeeded=true`。应验证恢复后的所有实际变更服务，不能把 up 返回零等同恢复服务可用；未配置探针时须明确报告验证跳过。

R01–R03 复现：`/tmp/codex-tool-runs/svton/runtime-recovery-audit.mjs` 与 `.log`；真实 handler/store，Docker/健康/凭据在 module seam 模拟，无外部部署。

### R04 · P2 · 外部命名卷无法生成有效 Compose

位置：`src/agent/compose-service.ts:36`。

合法的 `existing:/data` 只进入 service volumes，没有顶层 `volumes` 的 `external:true` 与明确 name。真实 `docker compose config --quiet` exit 1：`service "web" refers to undefined volume audit-existing-volume: invalid compose project`。存在检查不能弥补渲染缺失；修复时不能把外部卷改成自动创建的 project 卷。

证据：`/tmp/codex-tool-runs/svton/multi-contract-audit/named-volume.log`。

### R05 · P2 · 混合服务的 keep-env 在构建之后失败

位置：`src/cli/pipeline-group-deploy.ts:61`；`src/agent/handlers-group-deploy.ts:77`。

CLI 为每个选中服务发送 `keepEnv:true`。api 有旧 env、web 没有 env 的全量发布也要求 web 有环境快照，运行端拒绝。应支持继承旧快照中明确的“无 env”，同时保持有 env 但快照丢失时拒绝；首次部署 keep-env 的不满足条件应尽可能前置到构建前。

### R06 · P2 · 新增但未选服务被计划漏掉

位置：`src/cli/release-plan.ts:96`。

已部署 api，规格新增 web，选择 api：计划成功且只列 api；构建后 mergeCombination 才拒绝 web 没有可继承版本。任何声明服务若既不在选择中也没有可继承快照，都必须在创建构建机前拒绝，不能只检查整个组是否首次部署。

R05/R06 独立证据：`/tmp/codex-tool-runs/svton/multi-service-review/selection-env-repro.mjs`、`selection-env-results.json`。

### R07 · P2 · 缺失 digest 仍产生可部署 manifest

位置：`src/cli/pipeline-multi.ts:92`；`src/agent/routes-groups.ts:30`。

push 返回成功但 digest 缺失时，流水线返回 mutable tag 而没有拒绝；运行端也没有不可变 ref 门槛。实际 stub 返回 `reg.example/ns/api:audit1`、`digest:null` 的成功 manifest，违背“全部 digest 校验后才可部署”。缺失、格式错误或 ref/digest 不一致必须拒绝；不能通过本地旧 tag 回退把错误隐藏起来。

### R08 · P2 · 一个 v2 组使整机 ship gc 失效

位置：`src/agent/gc.ts:44`；`src/agent/release.ts:64`。

GC 对所有目录使用 v1 ReleaseStore；遇到合法 v2 state 立即报 corrupt/不支持，而非读取组合内各服务镜像。临时有效 GroupStore 状态已复现。应兼容混合 v1/v2，保护 current/previous 和所有保留组合里的镜像，并继续在坏快照时关闭删除。

R07/R08 复现：`/tmp/codex-tool-runs/svton/multi-service-review/root-reproductions.mjs`。

### R09 · P2 · 取消没有执行主动释放

位置：`src/cli/builder-lease.ts:35`；CLI 没有相应 SIGINT/SIGTERM 取消处理。

活跃动态租约的自有子进程被 SIGINT/SIGTERM 终止后，provider.release 都未调用；普通 catch/finally 不会在默认信号退出时执行。真实 CVM 定时销毁是兜底，不能等同用户取消后的主动释放已完成。应实现有界取消/清理，且不能因保留配置跳过用户要求的取消策略。

证据：`/tmp/codex-tool-runs/svton/multi-service-review/cancel-parent.mjs`、`cancel-child.mjs`、`cancel-results.json`；完全模拟 provider，没有云资源。

### R10 · P2 · from-dir 源码出处不可辨认

位置：`src/agent/source.ts:64`；`src/cli/pipeline-group-deploy.ts:60`。

tarball build 没有 sha/内容摘要，部署请求又丢弃 tarball id；两个不同上传源最终都只记录 `{"type":"tarball"}`。需要可核对的内容/源码补丁摘要，记录本地来源事实；继承服务继续保留自己的旧出处，不能填一个无依据的 Git SHA。

### R11 · P2 · 架构覆盖的 manifest 记错平台

位置：`src/cli/pipeline-multi.ts:93`。

服务覆盖为 linux/arm64，实际构建请求也是 arm64，但 manifest 仍写组默认 linux/amd64。应记录有效构建 slice 平台并核对实际 build.arch；无法确认架构时不能假称已校验。是否继续支持 arm64，需要与原 amd64 范围和文档保持一致。

R05/R10/R11 实际 CLI 流水线 stub：`/tmp/codex-tool-runs/svton/multi-contract-audit/manifest-repro.mjs`、`manifest-repro.log`。

### R12 · P2 · e2e 清理留下默认网络

位置：`scripts/e2e-multi-docker.mjs:258`。

脚本只删除容器和手工创建的外部网络；api 的 Compose 默认网络留存。此次成功 e2e 后仍有 `ship_e2eg0304a_api_default`，Created 为本轮时间且没有连接容器，与“零残留网络”证据不符。已经按精确 ID/标签/时间清理本轮自建网络；未删除以前测试的网络。修复应跟踪本次资源精确身份、校验归属再清理，并检查实际残留，不能宽泛按名称前缀删除或只因 exit 0 假报完成。

证据：`/tmp/codex-tool-runs/svton/multi-service-review/docker-cleanup-residue.json`。脚本 271 行，也需要按本仓库结构标准拆分维护职责。

## 规划缺口与外部验收

- 声明式依赖约束与关键联动探针尚无规格字段或执行路径；不可将“单服务各自健康”当成该规划已实现。显式回滚 baseReleaseId 虽有 API 校验，但 CLI 没有提供/取得该冲突版本，需补全可用契约。
- 同项目不同环境在同一 agent 仍以组名占用目录和 service project，并由 binding 拒绝，不是已实现项目/环境/服务的并存命名；保持拒绝是安全行为，但不能宣称该扩展已完成。
- 原生动态配置占位项、bootstrap 可达性、新包发布/端点升级、TCR 推拉、真实 CVM 主动/定时销毁、TWGG 显式接管/多轮发布/H5/数据保留仍未验收。生产暂停授权继续有效，本轮不恢复。
- 当前安装 CLI 未包含新参数；新源码与包内功能通过，不等于本机和运行端已升级。

修复任务见 `docs/handoffs/2026-10-05-multi-service-review-remediation.md`。修复完成后需逐项重放上述触发路径，再执行全量测试、包冒烟和真实隔离 Docker；正常路径绿灯不能替代故障审计。
