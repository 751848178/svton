# Devpilot 交付内核提取方案 v3（原子化组件：提取 + 换签名 + 干净靶签收）

日期：2026-08-17（v3，吸收 §10 Codex 评审与 §11 DeepSeek 评审；v1/v2 为 2026-08-16）
状态：待用户确认锁版；锁版前不开组件编码
术语：原子化组件（component）；验证链（chain，独立验证工具，非生产组织器）；平台组织器（`release-orchestration`，唯一持久化组织器）。
诊断基准：§11.1 现状盘点表为"真机通电状态"的单一权威引用。
关联：`docs-internal/devpilot/requirements-and-progress.md`、`release-environment-governance-architecture.md`、`progress/f383-final-closure-evidence.md`

## 0. 决策（v3，十项）

1. **修正诊断**：能力已具备并经真机验证（F383 六阶段真实发布、F431 exact-Manifest 复投、F432 0600 runtime env、F433 失败恢复，证据见 §11.1）；缺口是**原子化形态**与**干净外部靶的可重复签收**。M1–M3 的实质是"提取 + 换签名 + 回归"，不是从零实现。
2. **组件边界按 build → release → run**：`build-artifact` → `materialize-release`（env/Secret 在此冻结为不可变 ReleaseSpec）→ `activate-release`（含 `rollback` 子命令）。禁止"部署成功后再注入 env 并重启"的双状态变化。
3. **两个组织器，职责不同**：验证链 `devpilot-release-chain` 只是独立验证工具 / walking skeleton / 契约参考实现；平台 `release-orchestration`（ReleasePlan→ReleaseStage→ReleaseStageAttempt）是唯一持久化组织器。平台按**阶段**调用组件，不得把整链当黑盒 Job。
4. **提取而非复制**：从现有服务提取框架无关内核；原 NestJS 服务改为 adapter 调用同一内核。禁止另写简化脚本形成双头逻辑。
5. **保持现网运行协议**：确定性 ZIP 制品 + `releases/<id>/` + `active.json` 原子指针。不引入 tar/symlink 新词汇；任何协议变更须单独记录兼容性与迁移成本。
6. **run-record 安全契约**：不记录含秘密的原始 argv；只记脱敏 argvTemplate、secret refs/版本 hash、inputHash、idempotencyKey（**由调用方生成下发**——组件自生成会使人/AI/平台三次执行产生三个键，重放语义失效）、组件版本、artifact/release/config/workload digest、目标身份、超时/取消/失败分类、日志引用、rollback source。
7. **幂等语义**：同 idempotencyKey + 同 inputHash → 返回原结果；同 key 不同 inputHash → 冲突报错。重复执行成功不得仅以"HTTP 200"判定。
8. **影子映射前移**：A1 完成后立即 spike CLI 输出 → BuildRun/ArtifactManifest/ReleaseStageAttempt 映射；A2 完成后立即验证 DeploymentRun/EnvironmentVersion 映射。数据模型与执行宿主适配不得推迟到 M4。
9. **战略条款保留（v2 原样）**：冻结广度、薄组织器、增量接链（反对"全部验证完再统一整合"）、嵌入成本台账、人/AI 轮换验证、M3 三级决策门（嵌入 → 薄交付模块 → 新平台）、strangler 整合。
10. **名称限定**：M3 交付的是"交付内核 MVP"（构建、不可变 release、启动、访问、恢复）；不得据此宣称 DNS/TLS、监控、备份、生产运维签收完成。

## 1. 行业依据

- 12-factor V（build/release/run）：https://12factor.net/build-release-run
- Walking skeleton / tracer bullet：切片从第一天端到端贯穿，"integration is where the risk is"，反对分段整合。
- GitLab CI / GitHub Actions：原子 job 独立可执行，workflow（组织器）只是声明式组合——主链路与组件的分离即此模型。
- K8s：image（A1）+ Deployment（A2）+ ConfigMap/Secret（A3）。
- Strangler fig：平台逐能力 adopt/replace/retire。

## 2. 分层与目录（v3：解开"提取"与"零平台依赖"的结构矛盾）

```
packages/devpilot-atomics/
  core/            # 框架无关内核：纯函数 + JSON in/out，从 devpilot-api 提取（禁 Nest DI / ConfigService / Prisma import）
  cli/             # 薄 CLI 适配器：bin devpilot-build / devpilot-materialize / devpilot-activate / devpilot-release-chain（人/AI 验证轨）
  contracts/       # ArtifactManifest / ReleaseSpec / run-record / env-spec / chain-config schema（版本化）
  chain/           # 验证链：walking skeleton，非生产组织器
```

- 平台 adapter **留在** `apps/devpilot-api`：原 NestJS 服务改为调用 core（构建类可进程内库调用；远端激活类经 server-executor 走 CLI/SSH）。
- 依赖方向钉死：`apps/devpilot-api → packages/devpilot-atomics/core`，永不反向。
- 运行产物与 run-record 写入 gitignore 工作目录（env `DEVPILOT_ATOMICS_HOME`，默认 `var/atomics/`），不进 git。
- 每组件提供 `--self-test`（不触真机的契约校验/干跑），供快循环回归。

## 3. 原子化组件契约（v3）

### A0 契约 + 映射 spike + 提取清单（先行）

- 冻结四个契约 schema：ArtifactManifest / ReleaseSpec / run-record（含 §0.6 安全字段）/ chain-config。
- 完成 run-record → ReleaseStageAttempt 映射 spike 一次（影子轨最小闭环）。
- **提取清单**：每组件列源文件、平台耦合点（projectId/buildRunId/deploymentRunId/environmentId、ConfigService、密文库）、提取后平台 adapter 的回归范围；原路径全量 spec 绿作为接链准入条件之一。
- 证据卫生：f383 文件头已回修为终态（2026-08-17），§11.1 表为通电状态权威引用。

### A1 `build-artifact`（构建制品）

- 输入：干净 checkout + 精确 commit + build spec（Git 凭据与仓库拉取由外层 source adapter 负责，组件不碰平台连接模型）。
- 输出：确定性 ZIP + digest + 不可变 ArtifactManifest（词汇对齐现网 `release-artifact://<id>/bundle.zip`）。
- 验收：同输入重跑 digest 稳定；密钥扫描 0 hits；CLI 轨 + 平台影子轨双绿（影子轨验证 BuildRun/ArtifactManifest 映射）。
- 提取源：`release-build-artifact.service.ts`、`release-build-artifact-publish.utils.ts`、`release-build-artifact-io.ts`、`release-build-artifact-secret.utils.ts`、`local-release-build-executor.service.ts`。

### A2 `materialize-release`（配置冻结为不可变 ReleaseSpec）

- 输入：ArtifactManifest + workload spec + env/Secret refs + target spec。
- 输出：不可变 ReleaseSpec；任何配置变化都产生新 release ID。
- 复用资产（按 12-factor **前移**而非重写）：`$DEVPILOT_*` 占位、执行边界解析、`deployment-env-injection.utils.ts`、`release-credential-injection.utils.ts`；secret reapply 相关两文件均存在并保留（`server-executor-secret-reapply.utils.ts` 与 `server-executor-deployment-env-secret-reapply.utils.ts`，11.1 表仅列前者，已核实补全）。
- 验收：同一制品不同 env → 不同 ReleaseSpec / 不同 release ID；ReleaseSpec 全文 grep 无明文密钥。

### A3 `activate-release`（含 `rollback` 子命令）

- 输入：ReleaseSpec + 目标（SSH/agent）。
- 步骤：上传 → 远端 digest 校验 → 0600 runtime 配置落盘 → 启动 → 状态/HTTP 健康检查（BusyBox 兼容）→ 成功后发布 `active.json`；失败保留或恢复上一工作负载。
- rollback：重新激活历史**完整 ReleaseSpec**，而非只切换旧 artifact——前提是 activation 时将完整 ReleaseSpec 持久化到目标机（升级为契约，离线回滚的基础）。
- 验收：激活 / 回滚 / 幂等冲突（同 key 异 inputHash 报错）全覆盖；CLI 轨 + 平台影子轨双绿（影子轨验证 DeploymentRun/EnvironmentVersion 映射）。
- 提取源：`ssh-release-deployment-provider.service.ts`、`release-workload-runtime.ts`、`environment-version-recovery.service.ts`。

## 4. 验证链规则（两个组织器之一：仅验证工具）

- 声明式 chain 配置（有序组件 + 组件间数据引用），只装已验证组件；每次接链整链真机重跑。
- 增长路径：M1 链 = [build-artifact]；M2 起链 = [build-artifact → materialize-release → activate-release]。
- 组织器保持薄：只做顺序执行、数据传递、fail-fast、链级 run-record 聚合、**idempotencyKey 生成与下发**。重试/审批/通知/条件分支/并发禁止进入。
- M4 完成后验证链保留为调试与契约参考工具；生产路径一律走平台组织器（§0.3）。

## 5. 双轨验证与验证靶（v3）

每组件"已验证" = **两轨皆绿**：

- **CLI 轨（治理全关）**：人/AI 直接调用组件，隔离内核缺陷。
- **平台影子轨（治理全开）**：经 server-executor / 审批 / 策略 / 审计执行同一内核，隔离 adapter 缺陷——F383 实测证明出血点集中在适配层（审批匹配器、write_env heredoc、策略匹配、BusyBox healthcheck）。

验证靶双份：

- **smoke 靶**：最小静态服务，供 `--self-test` 快循环。
- **验收靶**：Picshare 或等价真实项目，必须复现已观测失败类：私有仓库 git 认证（F383 曾卡死于 `git fetch` 无凭据）、DB migration/bootstrap、队列边界密钥 reapply、BusyBox 健康检查。简单 Dockerfile 靶**不得用于验收**（会绕过全部真实失败类）。
- 固定靶期间不换；验证者轮换：人和 AI 各成功执行一次；治理与靶环境变更记入台账。

## 6. 平台嵌入策略与"是否新建平台"决策门（v3 修订）

### 6.1 嵌入机制：六个适配器级接入点，不动内核

1. **触发**：现有 UI/webhook 端点改调组件（平台按**阶段**调用 core/CLI，镜像验证链配置；不得把整链当黑盒 Job）。
2. **状态**：run-record 映射 ReleaseStageAttempt / BuildRun / DeploymentRun / EnvironmentVersion；映射 spike 已前移至各组件验证期（§0.8）。
3. **凭据**：平台密文库解密后经参数/临时文件注入组件；组件自身永不接触平台存储。
4. **执行宿主**：server-executor 命令计划调用（构建类进程内库调 core；远端类走 CLI/SSH）——队列/租约/心跳/取消/审计全部复用。
5. **治理**：审批、命令策略、审计包裹在命令计划外层，逐能力开关。
6. **环境**：服务器注册表提供目标与 transport，组件只认目标参数。

### 6.2 嵌入成本买断规则（M0–M3 期间执行）

- 内核 JSON in/out，契约 schema 版本化；无头、幂等、退出码语义化。
- 多租户身份（teamId/projectId/buildRunId/deploymentRunId）永不进内核，由平台注入。
- run-record 字段对齐未来 DB/UI 所需（stage、status、log 引用、起止时间、digest、idempotencyKey）。
- **组件词汇对齐平台现有名词**（ArtifactManifest / ReleaseSpec / activate / active.json / releases/<id>），禁止另造协议词汇。
- 维护**嵌入成本台账**：内核每需要一样别扭的东西（DB 访问、团队上下文、轮询、平台共享工具）记一笔——M3 决策依据用实测数据。

### 6.3 M3 决策门：嵌入 vs 新建薄交付模块 vs 新平台

- **默认嵌入**（6.1 六接入点）：每能力一个 strangler 周期（影子对比 → 切换 → 删除旧内嵌路径），适配器级工作量。§11.2.8 表明平台承重墙（队列、审批桥、零泄露链、EnvironmentVersion、recovery 调度）比预期完整，嵌入成本预期进一步下降。
- **新建薄交付模块**（monorepo 内新 service，复用 auth/密文库/服务器注册/执行器）：仅当 run-record 无法低成本映射现有数据模型，或 release-delivery 纠缠到无法逐能力替换。
- **新平台**：仅当上两条都被运行证据否决；以台账实测为准，不凭印象。

### 6.4 切换与冻结

- 每能力：影子对比 → 切换 → 删除旧内嵌路径；平台旧路径与内核并存期不超过一个里程碑。
- 整合完成前不开新平台能力；既有 43 模块按 adopt/replace/retire 判定，依据验证链运行数据。
- **平台使能件禁止复制或重写**（server-executor、审批桥、零泄露脱敏链、EnvironmentVersion 体系、recovery 调度），嵌入时直接复用。

## 7. 里程碑（v3 改为 DoD-box，不设天数）

- **M0**：四个契约冻结；run-record → ReleaseStageAttempt 映射 spike 完成；提取清单成文（源文件 / 耦合点 / adapter 回归范围）；证据卫生修复完成。
- **M1**：`build-artifact` 提取完成；CLI 轨 + 平台影子轨双绿（含 BuildRun/ArtifactManifest 映射验证）；验证链 = [A1]。
- **M2**：`materialize-release` / `activate-release`(+rollback) 提取完成；env 前移、健康检查、失败恢复、幂等冲突全覆盖；双轨双绿；验证链全绿。
- **M3（交付内核 MVP 签收）**：干净外部服务器（不挂载开发工作区）一条命令完成 构建 → 发布 → 浏览器访问 → 回滚；执行中无手工 SSH 修复；删除源码后仍可按同一制品重新部署；人/AI 各跑通一遍；链级与组件级 run-record 齐全。
- **M4**：平台按组件/阶段 影子对比 → 切换 → 删除旧内嵌实现；ReleasePlan/Stage/Attempt 继续作为唯一流程与证据模型。
- M3 决策门以嵌入成本台账实测数据执行（§6.3）。

## 8. 明确不做（本方案期间）

监控、日志中心、备份、SLO、金丝雀、蓝绿、多级审批、证书生命周期、DNS 自动化、资源池、向导增强；平台新功能开发冻结。v3 追加：不复制/不重写平台使能件；不建第二套持久化组织器；未经兼容性评估不变更现网部署协议（ZIP / releases/<id> / active.json）。

## 9. 风险与对策（v3）

- **提取回归风险（v3 主要风险，替代"从零实现"风险）**：提取清单 + 原路径全量 spec 绿准入 + 平台影子轨。
- 双头逻辑：提取而非复制（§0.4）+ 内核/旧路径并存期上限。
- 验证靶失真：验收靶必须复现真实失败类清单（§5）；smoke 靶不得用于验收。
- 证据层失真：§11.1 表为权威；状态头与结论不一致时以终态证据为准并回修头部——陈旧头部的代价会被每个读到它的 AI 会话复利放大（本次误诊即实证）。
- 组织器发胖 / 双组织器混淆：§0.3 边界为验收线。
- 真机不可得：M1 前完成干净外部服务器就绪（不依赖研发工作区）。

## 10. 协作者评审意见

> 评审人：OpenAI Codex（Devpilot 团队协作者）  
> 评审日期：2026-08-16  
> 结论：**方向有条件通过；先修订为 v3，再开始 A0 编码。**

### 10.1 总体判断

冻结功能广度、提取原子化组件、通过独立 CLI 做真实验证、逐步接入现有平台，这一战略方向成立；但当前项目的准确状态不是“机器造好了、从未通电”，而是：

> Devpilot 已在隔离靶场通过真实 SSH、非 dry-run、真实 MySQL、工作负载启动、HTTP 健康检查和恢复链路完成过多轮通电验证；尚缺的是在干净、独立、非研发工作区依赖的外部服务器上完成可重复签收。

现有证据包括：

- F383 已完成 Picshare `master` 的六阶段真实 password-SSH 发布，两个 DeploymentRun completed，Backend/Admin 健康且 HTTP 200；见 `docs-internal/devpilot/progress/f383-final-closure-evidence.md`。
- F431 已证明 exact-Manifest 在源码移除后仍可重复投递到隔离 SSH 目标；F432 已证明 0600 runtime env 注入；F433 已证明工作负载启动、健康检查和失败激活后恢复上一工作负载；见 `docs-internal/devpilot/progress/INDEX.md`。
- 平台已存在 `ReleasePlan → ReleaseStage → ReleaseStageAttempt` 持久化编排、Server Executor 队列回填和恢复推进链路；新方案必须复用，不能再造第二套生产控制面。

因此，本方案应定位为**从已验证路径提取交付内核并完成外部干净靶验收**，而不是从头重写 build/deploy/env。

### 10.2 v3 必须修正的决策

1. **修正组件边界**：12-factor 的正确顺序是 build → release → run；环境配置属于 release，必须在启动和健康检查前冻结。不得采用“部署成功后再 apply-env 并重启”的双状态变化。
2. **区分两类组织器**：`devpilot-release-chain` 只作为独立验证工具、walking skeleton 和契约参考实现；现有 `release-orchestration` 是平台唯一持久化组织器。平台应按阶段调用组件 CLI，不能把整链作为一个黑盒 Job。
3. **提取而非复制**：从现有 `LocalReleaseBuildExecutorService`、exact-Manifest Provider、runtime-env、workload lifecycle、health 和 recovery 代码提取纯内核；原 NestJS 服务改为 adapter 调用同一内核。禁止另写一份简化脚本形成双头逻辑。
4. **平台影子接入前移**：A1 完成后立即验证 CLI 输出到 BuildRun/ArtifactManifest/ReleaseStageAttempt 的映射；A2 完成后立即验证 DeploymentRun/EnvironmentVersion 映射。正式切换可在 M4，但数据模型和执行宿主适配不得推迟到全链完成后。
5. **保持现有运行协议，除非证据要求修改**：当前制品为确定性 ZIP，部署使用 release 目录与 `active.json`；不得未经验证改为 tar + `current` symlink。若确需变更，应单独记录兼容性和迁移成本。
6. **强化 run-record 安全契约**：禁止记录含秘密的原始 argv；只记录脱敏 `argvTemplate`、secret refs/version hash、inputHash、idempotencyKey、组件版本、artifact/release/config/workload digest、目标身份、超时/取消/失败分类、日志引用和 rollback source。
7. **明确幂等语义**：同一 idempotency key + 相同 inputHash 必须返回原结果；同 key 不同 inputHash 必须冲突。重复执行成功不能仅以“HTTP 仍为 200”判定。
8. **限定 MVP 名称**：M3 是“交付内核 MVP”，证明构建、不可变 release、启动、访问和恢复；不得据此宣称 DNS/TLS、监控、备份和生产运维签收已经完成。

### 10.3 建议的 v3 原子化组件

1. `build-artifact`：干净 checkout + 精确 commit + build spec → 不可变 ArtifactManifest。Git Provider 凭据和仓库拉取由外层 source adapter 负责。
2. `materialize-release`：ArtifactManifest + workload spec + env/Secret refs + target spec → 不可变 ReleaseSpec；任何配置变化都创建新 release ID。
3. `activate-release`：上传、远端 digest 校验、0600 runtime 配置落盘、启动、状态/HTTP 健康检查、成功后发布 active pointer；失败时保留或恢复上一工作负载。
4. `rollback-release`：重新激活历史完整 ReleaseSpec，而不是只切换旧 artifact。若需维持三个组件，可作为 `activate-release rollback` 子命令。

### 10.4 建议里程碑

- M0：冻结 ArtifactManifest / ReleaseSpec / run-record 契约，明确验证链与平台组织器边界，完成一次 run-record → ReleaseStageAttempt 映射 spike。
- M1：从现有代码提取 `build-artifact`，独立 CLI 与平台影子路径共同调用。
- M2：提取 materialize/activate/rollback 事务，覆盖 env、健康检查、失败恢复和幂等冲突。
- M3：在干净外部服务器一条命令完成构建、发布、浏览器访问和回滚；禁止挂载开发工作区，禁止执行中手工 SSH 修复，删除源码后仍可重新部署同一制品。
- M4：平台按组件/阶段影子对比 → 切换 → 删除旧内嵌实现，现有 ReleasePlan/Stage/Attempt 继续作为唯一流程与证据模型。

### 10.5 最终协作意见

本评审支持“冻结广度、组件先行、渐进接链、嵌入现有平台”的主方向；不支持“从头重写原子能力”、deploy 后独立 env 注入、新建第二套生产组织器，以及把平台适配风险全部推迟到 M4。完成上述 v3 修订后，可以启动 M0；在此之前不建议开始组件编码。

## 11. 第三评审：现状盘点与观察建议

> 评审人：DeepSeek Harness（第三评审，同批）  
> 评审日期：2026-08-16  
> 结论：**能力全部具备且已真机验证；缺的是原子化形态。M1–M3 的实质工作是“提取 + 换签名 + 回归”，不是从零实现。** 11.1 表作为“真机通电状态”的单一权威引用，此后里程碑更新只改这张表。

### 11.1 现状盘点表（能力 × 形态）

| 能力 | 函数体现状（代表文件，均相对 `apps/devpilot-api/src`） | 真机验证证据 | 签名中的平台耦合点 | 原子化缺口 |
|---|---|---|---|---|
| 构建制品 | `release-delivery/release-build-artifact.service.ts`（ZIP 打包、digest、uri）、`release-build-artifact-publish.utils.ts`（`bundle.zip`、组件文件键）、`release-build-artifact-io.ts`（hash + 中止守卫）、`release-build-artifact-secret.utils.ts`（密钥扫描，复用 repository-analysis redact）、`local-release-build-executor.service.ts`（exact_commit checkout + 组件 buildCommand 执行） | F383 真实构建产物六阶段交付；F431 exact-Manifest 在源码移除后仍可重复投递；`release-build-reproducibility.integration.spec.ts` 同输入 digest 稳定 | 输入签名要求 `projectId / releaseOrderId / buildRunId`；产物 URI 为 `release-artifact://<buildRunId>/bundle.zip`；路径/限额来自 `ConfigService`；Nest DI | 无 CLI 入口、无 JSON 契约、无 idempotencyKey、无 `--self-test`；离线不可跑（ID 命名 + ConfigService） |
| 制品投递 + 启动 + 健康检查 | `release-delivery/ssh-release-deployment-provider.service.ts`（上传 → `releases/<deploymentRunId>` → 组件 env 文件 → `active.json` 原子换指针 → 记录 providerDeploymentId/manifestDigest）、`release-workload-runtime.ts`（启动 + `HTTP_STATUS` 探测 + healthBudget 重试）、`local-filesystem-deployment-provider.service.ts`（本地传输替代实现） | F383 两个 DeploymentRun completed、backend/admin 容器 healthy；F433 启动 + 健康检查 + 失败恢复 | 落盘路径按 `projectId/environmentId/deploymentRunId`；SSH transport 由平台服务器注册表提供；workload 快照来自 staging 冻结 | 同构建行；健康检查内嵌 runtime 且依赖 staging snapshot 形态 |
| 环境变量注入 | `deployment/deployment-env-injection.utils.ts`、`release-orchestration/release-credential-injection.utils.ts`（`$DEVPILOT_*` 占位 + build-time 脱敏）、`release-orchestration/release-credential-resolver.service.ts`、`server-executor/server-executor-secret-reapply.utils.ts` + `server-executor-devpilot-secret-resolver.service.ts`（队列边界 reapply、0600 落盘） | F432 0600 runtime env；F383 DB 零泄露（0 hits，持久化仅占位符） | 密文库 + 全局 crypto；reapply 挂在队列执行边界 | 时序缺陷：现在是“部署期写 env 再启动”（F383 实测跑通），12-factor 要求 release 期冻结、启动前注入；密钥引用需解耦为 env-spec + 注入式 resolver（组件不触平台存储） |
| 回滚/恢复 | `release-delivery/environment-version-recovery.service.ts`（+ recovery.repository/input/utils）、`release-orchestration/release-recovery.service.ts` + `release-recovery-scheduler.service.ts`；`active.json` + 历史 `releases/<id>` 落盘指针 | F433 激活失败后恢复上一工作负载 | `deploymentRunId` 命名；恢复由平台调度触发 | 无独立 rollback 命令；“activation 时将完整 ReleaseSpec 持久化到目标机”未成契约（离线回滚的前提） |
| 链级组织器（平台唯一持久化组织器） | `release-orchestration/release-coordinator.service.ts`（173 行，+ execution/terminal/helpers 拆分件）、`release-plan-orchestrator.service.ts`；`ReleasePlan / ReleaseStage / ReleaseStageAttempt` 持久化模型（schema.prisma）；server-executor 队列回填 + 恢复推进 | F383 六阶段全 succeeded（plan `cms5kc2rp`，6/6 阶段真实 Attempt） | 全部在平台内——它是承重墙，不是债务 | 独立参考链（`devpilot-release-chain`）不存在；run-record → ReleaseStageAttempt 映射未定义（M0 spike 项） |
| 平台使能件（非组件，嵌入时复用） | server-executor 命令计划/队列/租约/取消、`release-orchestration/release-deployment-approval-bridge.service.ts`（审批桥）、零泄露脱敏链（build-time 重写 + 持久化扫描）、服务器注册表 transport、EnvironmentVersion 读/写/补偿/门禁体系（`environment-version-*` 30+ 文件） | F383 审批桥 4 张派生审批、零泄露 0 hits；F383 期平台测试 1144 passed / 42 skipped / 0 failed | 不适用（本就属于平台） | 不适用；**原子化禁止复制、重写这些**，嵌入时直接复用 |

**表后修正提示**：v2 正文 §3 A1 引用的 `server-executor-deployment-env-secret-reapply.utils.ts` 实际文件名为 `server-executor-secret-reapply.utils.ts`；且 v2 的 tar + `current` symlink 与现网 ZIP + `active.json` 布局不符（见 10.2.5）。这两处是“从未通电”误诊的直接产物，v3 应删除。

### 11.2 观察

1. **能力具备、形态不备**（核心观察）：三项核心能力（构建/投递/env）函数体完整、各自真机验证过；但所有函数签名织入平台身份（`projectId/buildRunId/deploymentRunId/environmentId`）与平台基础设施（ConfigService/密文库/队列边界）。ZCode 的“机器造好未通电”错在把“缺形态”表述成“缺能力”——这个错误会导向“从零写脚本”（复制逻辑、双头），而正确动作是“提取 + 换签名”。

2. **工作量性质重估**：不是 3×（1–2 天）的从零实现，而是 3×（提取 + 解耦 + 平台 adapter 回归）。ZCode 的 M0–M3 time-box 按前者估，应改为 DoD-box（只定退出条件）。

3. **证据卫生是误诊的直接原因**：`docs-internal/devpilot/progress/f383-final-closure-evidence.md` 头部仍是 “Status: PARTIAL”，成功结论在文件尾（2026-07-29 SUCCESS 节，plan `cms5kc2rp`）。任何后来者读头部都会低估通电程度。本表（11.1）应成为单一权威引用，并回修该文件头。

4. **幂等性只有半套**：`active.json` 原子换指针存在；idempotencyKey + inputHash 冲突语义不存在。且幂等键必须由链/平台生成传入——组件自己生成会导致人、AI、平台三次执行产生三个键，重放冲突语义失效（补 Codex 10.2.7）。

5. **env 时序是移位、不是缺位**：现有 0600 落盘、`$DEVPILOT_*` 占位、队列边界 reapply 全部是资产，按 12-factor 前移到 release 冻结后原样复用，不是重写（呼应 Codex 10.2.1）。

6. **验证靶必须复现已观测失败类，否则验收无意义**：私有仓库 git 认证（F383 曾卡死于 `git fetch` 无凭据）、DB migration/bootstrap、队列边界密钥 reapply、BusyBox 健康检查（曾 404/语法失败）——ZCode 的“20 行 Dockerfile 静态服务”靶会把这些全部绕过。应直接用 Picshare 或等价靶做验收，另配简单 smoke 靶给 `--self-test` 快循环。

7. **“提取而非复制”与“零平台依赖”的结构矛盾，v3 必须用分层解开**：框架无关 core 层（去 Nest DI/ConfigService，纯函数 + JSON in/out）+ CLI 薄适配器（`packages/devpilot-atomics/cli`）+ 平台 adapter 留在 `devpilot-api` 改调 core。依赖方向钉死 `apps/devpilot-api → packages/devpilot-atomics/core`，永不反向。

8. **平台承重墙比预期完整**（队列、审批桥、零泄露、EnvironmentVersion、recovery 调度），嵌入成本会显著低于 ZCode 预期——但前提是组件词汇对齐现有名词（ArtifactManifest/ReleaseSpec/activate/active.json），而不是另造 tar/symlink 词汇。

### 11.3 建议

1. **半小时证据卫生**：回修 f383 文件头状态为终态成功并指向 SUCCESS 节；本文 11.1 表作为“通电状态表”权威引用，此后里程碑更新只改这张表。
2. **v3 修订吸收顺序**：Codex 10.2 八条为骨架 → 并入 11.2 第 4/5/7 条（幂等键归调用方、env 前移复用现有资产、三层分层钉死依赖方向）→ ZCode 的战略条款（冻结广度、薄组织器、嵌入台账、人/AI 轮换验证）原样保留。
3. **M0 前置物**：除契约与映射 spike（Codex 10.4）外，补一张“提取清单”——每个组件列出源文件、耦合点、提取后平台 adapter 的回归范围；现有 362 个 spec 中原路径全绿作为接链准入条件之一。
4. **双轨验证写进验收**：独立 CLI 轨治理全关（隔离内核缺陷）+ 平台影子轨治理全开（隔离适配器缺陷——F383 证明适配器是真实出血点：审批匹配器、write_env heredoc、策略匹配、BusyBox healthcheck 全是链上炸的）。每组件两轨都过才算“已验证”。
5. **里程碑从 time-box 改 DoD-box**；M3 决策门以嵌入成本台账实测数据为准，不凭印象。

本评审与 10.x 的合并版即 v3 定稿建议；v3 锁版前不建议开始组件编码（与 10.5 一致）。

## 12. v3 修订记录（2026-08-17，ZCode）

- **诊断修正**：撤销 v2 "机器造好、从未通电"——F383（六阶段真实发布、零泄露 0 hits、plan `cms5m7z2001ow14kkg3jg0l87`）、F431/F432/F433 证据经原文核实属实；准确状态以 §11.1 表为准。误诊根源：f383 证据文件头部停留在中间态 PARTIAL + 路线图状态行滞后，本轮仅审计了代码与状态文档、漏查 progress 证据文件。
- **方向修正**：撤销"从零写原子脚本"隐含路线，改为"提取 + 换签名"（§0.4），新增 core / cli / 平台 adapter 三层分层并钉死依赖方向（§2）。
- **结构修正**：A3 由"部署后 env 注入并重启"改为 materialize-release 冻结 + activate-release 激活（§0.2，消除双状态变化）；部署协议由 tar+symlink 改回现网 ZIP + active.json（§0.5）；组件词汇对齐平台现有名词。
- **时序修正**：平台影子映射前移至各组件验证期（§0.8）；里程碑 time-box 改 DoD-box（§7）。
- **验证修正**：单轨改双轨（CLI 治理关 + 平台影子治理开）；验证靶改双靶且验收靶必须复现真实失败类（§5）。
- **契约修正**：run-record 增加安全字段与脱敏 argvTemplate；idempotencyKey 改为调用方生成（§0.6/§0.7，吸收 10.2.6/10.2.7 + 11.2.4）。
- **保留 v2 战略条款**：冻结广度、薄组织器、增量接链、嵌入成本台账、人/AI 轮换、M3 三级决策门（§0.9）。
- **核实备注**：`server-executor-deployment-env-secret-reapply.utils.ts` 与 `server-executor-secret-reapply.utils.ts` 两文件均存在（11.1 表仅列后者，§3 A2 已双列）；f383 文件头已于 2026-08-17 回修为终态并保留中间态原文。
