# Devpilot V13 Project Delivery Control Plane

## Goal

将 Devpilot 收敛为以项目为中心、以发布单和环境版本为高频交付入口的真实发布管控产品，并从项目接入、不可变构建制品、同制品预发/生产门禁、环境恢复、51/15 门禁到浏览器 E2E 形成可审计闭环。

## Scope

- In scope: 项目目录、三步接入、项目 IA、发布单、BuildRun/Manifest、Staging/Production、环境版本、项目治理、51/15 门禁、兼容迁移、Docker/浏览器 E2E、文档与最终验收。
- Out of scope: push、PR、合并主线、外部生产部署、伪造 Provider 成功、删除或导入原主工作区未提交修改。
- Protected checkout: `/Users/zhaoxingbo/Workspace/ai-driven/svton` 始终只读；本任务只写 `/Users/zhaoxingbo/Workspace/ai-driven/svton-devpilot-project-delivery-v13`。

## Clarifications And Assumptions

- Confirmed: 基线为 `b6c3488743be13eacf4320f685da927488490113`。
- Confirmed: 依次集成 `17652567`（保留分析应用前的发布配置）和 `ef1a47cb`（发布命令 workingDirectory）。
- Confirmed: 不导入原主工作区 61 个 V13 重叠未提交文件；它们只作只读参考。
- Confirmed: V13 canonical spec 是产品语义事实源；旧 V10/V12 和 HTML 原型只作迁移与交互证据。
- Confirmed: 一个 checkout 同时只允许一个写入者；普通失败、修复和切片切换不等待用户确认。

## Workflow Routing

`routing: long-goal + codegraph-manual-fallback + single-writer + noisy-tools; F386-F410 逐切片登记、实现、测试、文档同步和原子提交，完整日志保存在 /tmp/codex-tool-runs/svton/long-goals/devpilot-project-delivery-v13/。`

## Functional TODO Breakdown

| ID   | Status  | Atomic TODO                                                                                             | Context Boundary                                           | Evidence                                                                                   |
| ---- | ------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| F386 | done    | 建立独立 worktree/分支、集成两个授权提交、登记 V13 事实源/迁移/任务板并运行基线验证。                   | Git、V13 文档、现有 API/Web 基线；不改产品行为。           | `7d9d580c` → `724abfef`；Prisma/build/type-check/35 tests 通过；主工作区 checkpoint 未变。 |
| F387 | done    | 增加项目生命周期、仓库规范身份、finalize、环境 baseline role/config revision 的增量 schema 与冲突报告。 | Prisma 与项目/环境迁移工具。                               | 空库/升级 fixture 迁移、Prisma/type-check、14 tests 通过；历史状态/歧义环境保持 NULL。     |
| F388 | done    | 实现 draft→analysis→review→幂等 finalize 后端事务与恢复。                                               | project-intake、repository-analysis、project-environment。 | 39 unit + 7 real-MySQL integration tests、API build/type-check 通过。                      |
| F389 | done    | 提供 ACL 过滤的项目目录服务端读模型。                                                                   | Project query/read-model 与 DTO。                          | 12 unit/regression + 2 real-MySQL tests；API type-check/build 通过。                         |
| F390 | done    | 实现 `/projects` 目录和三步 `/projects/create`，兼容 `/projects/import`。                               | Projects Web routes/components/hooks。                     | 11 个 API/Web 回归、双端 type-check/build、真实 MySQL 和浏览器接入闭环通过。               |
| F391 | done    | 建立 delivery/settings 路由宿主和旧 tab/query 深链适配。                                                | Project detail routes/navigation。                         | 12 个路由回归、Web type-check/build 和浏览器深链验收通过；focused ID 保留。                |
| F392 | done    | 增加 ReleaseOrder、BuildRun、ArtifactManifest、ReleaseRun、EnvironmentVersion 与 legacy nullable 关系。 | Prisma/release domain migration。                          | 新库/升级库真实迁移、legacy/unverified 报告、API 门禁通过。                                |
| F393 | done    | 实现发布单列表/创建读写模型；创建只含版本号与说明且不自动构建。                                         | ReleaseOrder API/Web。                                     | 19 个 API/Web 回归、真实 MySQL 并发幂等、浏览器和零 BuildRun/Manifest 证据通过。           |
| F394 | done    | 实现服务端主分支最新 Commit 构建与独立 BuildRun/Manifest/日志/测试安全证据。                            | Build domain 与 executor port。                            | 真实 MySQL/浏览器证明 5 次独立构建、4 Manifest、失败无 Manifest、精确 Commit、脱敏日志。   |
| F395 | done    | 实现四步详情、步骤恢复、可访问 tab 与独立日志抽屉。                                                     | Release detail Web。                                       | 深链、键盘/ARIA、刷新恢复、按钮位置和日志抽屉浏览器证据通过。                              |
| F396 | done    | 按精确 Manifest 重复部署 Staging，禁止隐式构建。                                                        | Deployment manifest command。                              | 两次 DeploymentRun 使用同一 Manifest，BuildRun 保持 5，Git/checkout/build 均为 false。    |
| F397 | done    | 实现 Production 同 Manifest 证明、快照冻结、审批和并发门禁。                                            | ReleaseRun/approval/deployment transaction。               | 真实 MySQL 并发收敛；漂移、跨项目、未知 Digest 负例和浏览器审批闭环通过。                   |
| F398 | done    | 实现环境版本 current/history、受控升级和 recovery 回退。                                                | EnvironmentVersion API/Web。                               | Staging/Production 真实版本链、审批消费、升级/回退和任意输入负例通过。                     |
| F399 | done    | 将仓库、环境配置、资源、Webhook 和设置收敛到 Manage Project。                                           | Settings routes/compat adapters。                          | 五区普通路径、legacy 重定向和专业运行审批证据浏览器回归通过。                              |
| F400 | done    | 实现环境 key 锁定、配置修订、共享资源/Secret 引用/域名路由/策略治理。                                   | Project environment governance。                           | 服务端权限、审计、无 Secret 明文、漂移测试通过。                                           |
| F401 | done    | 建立版本化 51 项目录、统一状态和默认不可用 capability registry。                                        | Release gates schema/service/Web。                         | 10/11/20/10 目录计数；未接 Provider 不通过。                                               |
| F402 | done    | 接通 M01-M05 Commit/Build 真实能力组。                                                                  | Commit/build provider adapters。                           | 正/负/新鲜度证据；缺失 Provider 不可用。                                                   |
| F403 | done    | 接通 M06-M09 Deploy 真实能力组。                                                                        | Config/Secret/resource/connectivity/migration adapters。   | 环境归属、脱敏、过期证据测试。                                                             |
| F404 | done    | 接通 M10-M15 Promote 真实能力组。                                                                       | Approval/DNS/TLS/HTTP/observability/recovery adapters。    | 业务验证只作证据；技术门禁真实。                                                           |
| F405 | done    | 完成标准发布策略；金丝雀/蓝绿/自动放量 fail closed。                                                    | Release policy/capability。                                | 不可变 R1、Production 冻结和高级策略具体拒绝原因已由 DB/API/browser 证明。                 |
| F406 | done    | 收敛兼容 backfill/archive 和新链路，移除新路径 branch-pull/build-on-deploy。                            | Migration/compat/read adapters。                           | 历史只读、归档保留、受管项目旧写入口拒绝和 exact-Manifest 命令边界均已证明。                |
| F407 | done    | 完成中英文文案、术语和用户/迁移文档。                                                                   | messages 与 docs。                                         | 2,796 条 zh/en leaf/ICU parity；运行时切换与双语文档已验证。                               |
| F408 | done    | 用隔离 Docker 数据完成真实主链浏览器 E2E。                                                              | Disposable compose/runtime/browser evidence。              | 2.4.2 接入/设置→双构建→双预发→生产审批/部署→回退均已闭环。                                |
| F409 | done    | 完成 ACL、并发、失败恢复、兼容、Provider 不可用和脱敏负向 E2E。                                         | Cross-layer tests。                                        | 11 suites/74 tests 与 API/DB/browser 负向证据全部通过。                                   |
| F410 | done    | 独立代码/领域/UX/无障碍/安全审查、修复、全量验证和最终交付审计。                                        | 全目标与证据包。                                           | GateEvaluation 持久化、安全收口、全量验证、生产构建浏览器 E2E 与工作区保护全部通过。       |

## Verification Plan

- 每个切片：聚焦测试、相关 type-check/build、Prisma 或浏览器证据、`git diff --check`、文件职责/行数检查。
- 产品收尾：API/Web 单元与集成、并发/权限/幂等、Docker 真实数据、浏览器主链和负向链、51/15、日志/Secret 脱敏、旧 deep link。
- 高噪声命令统一通过 `isolate-tool-output` 保存完整日志；构建/type-check 不代替 E2E。

## Change Log

- 2026-08-03: F386 开始；独立 worktree 建立并按顺序集成两个授权提交，未导入原工作区脏改动。
- 2026-08-03: F386 完成；依赖安装、Prisma generate/validate、`init:build`、API/Web type-check、3 suites/35 tests 和 CodeGraph 索引均通过，原主工作区 checkpoint 保持不变。
- 2026-08-03: F387 开始；按 nullable-first 约束增加 intake/environment schema，并先产出仓库别名和 `prod`/`production` 歧义报告，不删除或猜测历史数据。
- 2026-08-03: F387 完成；新增三张增量表、nullable lifecycle/baseline/config revision 关系和只读迁移预检。真实 MySQL 空库全迁移及含 `prod`/`production` 历史 fixture 的升级迁移均通过，历史项目未被默认为 DRAFT/READY。
- 2026-08-03: F388 开始；新增 intake API 编排层，复用真实 repository-analysis 能力，并把 finalize、幂等记录与失败恢复放入独立事务职责。
- 2026-08-03: F388 完成；新 draft 无隐式环境，intake API 复用真实 connect/run/retry/review，finalize 以 Serializable/CAS 事务锁定仓库身份和 Staging/Production。重复、并发、部分回滚恢复、跨团队、重复仓库及历史环境保留均在真实 MySQL 验证通过。
- 2026-08-03: F389 开始；目录查询先固定 team scope，再执行逐项目 ACL，运行、配置、Production、域名和活动均只从项目关系读取。
- 2026-08-03: F389 完成；新增 ACL 过滤目录读模型，支持名称/仓库/域名搜索、运行/配置筛选、精确 Staging/Production 基线、线上/待配置摘要、最近活动排序，真实 MySQL 证明团队/归档/嵌套运行隔离。
- 2026-08-03: F390 开始；Web 项目目录改用新读模型，创建与接入入口收敛为生成新项目和三步接入已有项目，同时保留旧 `/projects/import` 深链兼容。
- 2026-08-03: F390 完成；浏览器真实完成失败保留、重试、分析审核、双环境 finalize 和目录筛选，数据库证明固定 commit、唯一 Staging/Production 及幂等 finalization；目录运行态只读取最新运行，应用建议依赖的环境建议在 UI 中 fail closed。
- 2026-08-03: F391 开始；收敛项目详情一级 IA，并建立 delivery/settings 宿主与旧 tab/query 深链适配。
- 2026-08-03: F391 完成；项目默认发布单，一级只保留发布单/环境版本，低频配置进入独立 settings；旧 repository/environment/deployment 深链分别保留 analysisRunId/environmentId/runId，未具备的环境版本明确保持空状态。
- 2026-08-03: F392 开始；按 nullable-first 增加发布单、构建、不可变 Manifest、生产发布运行和环境版本领域关系，并为 legacy/unverified 数据提供只读报告。
- 2026-08-03: F392 完成；新库与含 legacy ReleasePlan/DeploymentRun 的升级库迁移均通过，旧 digest 外观数据保持 unverified 且不合成 Manifest；同 digest 的两个独立 BuildRun/Manifest 合法，重复项目发布版本号被拒绝。
- 2026-08-03: F393 开始；建立 ReleaseOrder ACL 列表/创建合同和 Web 默认发布单列表，创建只接受发布版本号与说明且不触发构建。
- 2026-08-03: F393 完成；ReleaseOrder API 按 team/project ACL 隔离，项目内版本唯一且相同输入顺序/并发重放收敛；浏览器创建 `2.4.1` 后仅出现一张草稿卡，冲突说明明确拒绝，数据库为 1 order / 0 build / 0 manifest / 0 release run。
- 2026-08-03: F394 开始；构建服务端解析项目主分支最新 Commit，每次创建独立 BuildRun，只有成功构建才能产生 Manifest，日志与证据按运行隔离并脱敏。
- 2026-08-03: F394 完成；API 在服务端重新解析默认分支并按精确 Commit 隔离检出，逐次分配不可变 revision，显式启用的受控本地 executor 仅接收最小环境并约束工作目录，成功后写入可复现 ZIP Manifest，失败运行只保留脱敏日志/门禁证据。真实浏览器与 MySQL 证明同一发布单 5 个 BuildRun、4 个 Manifest，revision 3 失败且无 Manifest，revision 4/5 的同输入 digest 一致。
- 2026-08-03: F395 开始；在 ReleaseOrder 聚合上建立四步详情、稳定步骤深链、刷新恢复和按 BuildRun 隔离的可访问日志抽屉。
- 2026-08-03: F395 完成；详情服务从真实仓库连接/环境基线/运行计数返回前置检查与恢复步骤，Web 以四个 ARIA tab 固定前置检查、构建制品、预发发布和生产发布。无 step 深链自动恢复到最后构建步骤，非法 step fail closed 并规范化；BuildRun 日志通过独立 dialog/role=log 展示，刷新仍保持精确 buildRunId，构建按钮只在构建步骤出现。
- 2026-08-03: F396 开始；Staging 命令只接受当前发布单内成功 BuildRun 的精确 Manifest，逐次创建新的 DeploymentRun，禁止 checkout、pull 或隐式构建。
- 2026-08-03: F396 完成；Staging API 按 team/project/order 校验成功 BuildRun 的项目 bundle 和 digest，锁定唯一活动 Staging 基线，每次创建独立非 dry-run DeploymentRun；本地 exact-artifact adapter 先复算存储 digest、拒绝越界 ZIP 路径，再物化到 run 隔离目录。真实浏览器连续两次选择 Build #5 Manifest，数据库为 2 DeploymentRun / 1 distinct Manifest / 5 BuildRun，commandPlan 的 checkout/build 均为 false。
- 2026-08-03: F397 开始；Production 事务只接受已在 Staging 由 exact-artifact adapter 成功验证的同一 Manifest，冻结环境/配置/资源/路由/策略快照并建立审批、并发与幂等边界。
- 2026-08-03: F397 完成；Production 预览服务端冻结环境、发布版本号、Build/Commit、Manifest/Digest、当前配置修订及资源/路由/策略快照并生成稳定 inputHash，确认事务在 ReleaseOrder 行锁内建立唯一 ReleaseRun 与 pending OperationApproval。真实 MySQL 证明两个并发相同幂等请求只生成一条运行，配置指针漂移、跨项目制品和未知 Digest 全部拒绝；浏览器仅在生产步骤显式确认六类输入后创建 awaiting_approval 运行。
- 2026-08-03: F398 开始；环境版本只从已完成、可追溯的精确制品运行追加生成，升级和 recovery 回退创建新运行并以事务更新 current 指针，禁止任意版本/镜像输入和历史覆盖。
- 2026-08-03: F398 完成；成功 exact-artifact DeploymentRun 在事务中追加 EnvironmentVersion、previousVersion 链并更新环境 current 指针，首个运行锁定环境身份。升级只能选择同项目成功 Manifest，回退只能选择同环境非当前历史；Production 额外要求同 Manifest Staging 证明和未消费、已批准、配置未漂移的 ReleaseRun。真实浏览器形成 Staging deploy→upgrade→recovery 三版本链并经全局审批生成 Production 当前版本，4 个版本对应 4 个独立 DeploymentRun。
- 2026-08-03: F399 开始；复核 Manage Project 二级页面对仓库、环境、资源、Webhook 和通用设置的收敛完整性，并补齐普通用户入口与保留专业深链的可达性证据。
- 2026-08-03: F399 完成；Manage Project 默认仓库识别并以稳定 section 提供环境、资源、Webhook、项目资料五区，旧 tab=resources 与 tab=deployments 分别规范化到二级配置和只读专业运行且保留 focused ID。浏览器审查修复了 Webhook 标题的 ICU 双花括号错误，并让 release-artifact DeploymentRun 的专业详情显示其 ReleaseRun 审批而非错误声称未关联审批。
- 2026-08-03: F400 开始；在现有不可变 EnvironmentConfigRevision 和首个 DeploymentRun identity lock 上补齐服务端治理写模型、引用型 Secret/资源/路由/策略快照以及影响范围与审计边界。
- 2026-08-03: F400 完成；配置写入改为串行化不可变修订并用 expectedCurrentRevisionId 拒绝漂移，普通变量兼容镜像继续供现有部署注入。真实浏览器写入 R5，展示无明文 Secret 引用和跨 Staging/Production 的 Redis 共享范围、medium 风险与影响；真实并发从同一 R5 仅一个请求创建 R6，另一请求 409，跨项目资源和 Secret 明文字段均 400。
- 2026-08-03: F401 开始；建立版本化 51 项目录、统一检查状态与默认 unavailable 的 capability registry，先证明目录 10/11/20/10 计数和缺 Provider 不得成功。
- 2026-08-03: F401 完成；服务端版本化目录固定 Commit/Build/Deploy/Promote 为 10/11/20/10 共 51 项并映射 15 个 MVP 能力组，统一六态契约。未接 Provider 的 51 项全部 fail closed 为 unavailable；真实 API、跨项目 ACL 负例、17 项回归、API/Web 构建和浏览器默认摘要/专业展开均通过。
- 2026-08-03: F402 开始；接通 M01-M05 Commit/Build 的真实仓库、分析、构建测试、安全和不可变制品证据，并验证成功、失败、过期与缺 Provider 边界。
- 2026-08-03: F402 完成；门禁从真实 RepositoryConnection、精确 Commit RepositoryAnalysisRun、最新 BuildRun 和 Manifest 读取证据，并携带 evidenceRef、checkedAt、expiresAt 与 fresh。正例、失败阻断、过期转未检查和缺 Provider 不可用均有回归；真实浏览器为当前发布单显示 C01/C05/B02/B09 已检查、C08/B03 未检查及 45 项不可用，安全执行隔离不再误称 Secret/SAST/漏洞扫描通过。
- 2026-08-03: F403 开始；接通 M06-M09 的环境配置、Secret 引用、资源/部署目标连通、容量与迁移/备份真实证据，并严守环境归属、脱敏和过期边界。
- 2026-08-03: F403 完成；以 Staging 环境为显式目标读取不可变配置修订、安全 Secret 元数据、资源引用、同发布单精确制品 DeploymentRun、服务器/连接/容量/迁移/备份证据。真实浏览器中 D01-D03 已检查，当前无服务器、连接探测、容量快照、迁移差异和备份运行，因此 D05、D07-D12 均保持不可用；20 项回归证明明文、跨环境、失败和过期证据不会通过。
- 2026-08-03: F404 开始；接通生产审批、DNS/TLS/HTTP、可观测性、稳定制品恢复与策略能力证据，业务人工验证只留证不替代技术门禁。
- 2026-08-03: F404 完成；Production 审批、Site/DNS/TLS/路由、工作负载/HTTP、日志/指标/Trace/告警、上一稳定版本、恢复兼容和发布证据分别由独立 Provider 评估。正/负/过期/缺失回归通过；真实数据中 D13 因缺变更窗口/冻结期 Provider 为未检查，P03 为需人工，P10 发布证据链已检查，其余缺失技术 Provider 保持不可用，M15 无流量/中止/回切闭环时永不开放。
- 2026-08-03: F405 开始；固化标准发布为唯一真实可执行策略，并让金丝雀、蓝绿和自动放量通过服务端 Capability API 返回具体不可执行原因。
- 2026-08-03: F405 完成；新增项目级不可变 ReleasePolicyRevision 与 current 指针，串行化 CAS 并发只允许一个旧指针写入。标准策略被 Production v2 快照冻结并参与审批 inputHash；金丝雀、蓝绿和自动放量在服务端持久化前因缺真实流量、双工作负载、指标、暂停/终止和回滚 Provider 返回 422。真实浏览器创建 R1、显示三种能力未就绪原因并在 Production 预览中读取同一策略哈希，MySQL 审计为 immutable。
- 2026-08-03: F406 开始；盘点历史 backfill/archive/read adapter 与新 delivery path，证明新路径不再接受 branch-pull/build-on-deploy，并保留历史项目、环境、运行和日志。
- 2026-08-03: F406 完成；新增项目级只读兼容报告，旧运行缺 Manifest 时保持 legacy_unverified，观察到 Digest 也不合成制品。受管/已归档项目在旧 branch/commit 部署入口进入 DeploymentService 前返回具体拒绝；真实浏览器旧向导被阻断且未创建运行。项目 DELETE 改为串行化归档，环境/应用置归档但运行与日志不删除；集成测试归档后仍能读取历史。真实 6 条 Manifest 运行的 commandPlan 均为 checkout/pull/build=false。
- 2026-08-03: F407 开始；审计 zh/en key parity、发布单/发布版本号/Manifest/环境版本/归档/策略能力术语，并补用户与迁移文档。
- 2026-08-03: F407 完成；新增递归 zh/en key 与 ICU placeholder 对账脚本，2,796 条 leaf message 全量一致。运行时语言切换已在 Release Policy 与 Production 快照真实浏览器路径验证，策略能力理由按 locale 输出；用户指南和迁移指南覆盖发布单、不可变 Manifest、环境版本、归档/兼容和高级策略不可用边界。
- 2026-08-03: F408 开始；使用隔离 MySQL/Redis 和真实本地 Git fixture 串行执行接入、设置、发布、多构建、重复 Staging、Production 审批与 recovery 回退主链。
- 2026-08-03: F408 完成；真实浏览器创建 2.4.2 发布单，固定 `main@85fad682...` 后生成 2 个独立 BuildRun/Manifest；Build #2 精确 Manifest 两次 Staging、一次高风险审批后的 Production 和一次 Staging recovery 共形成 4 个新 EnvironmentVersion。MySQL 证明 4 个 DeploymentRun 均 completed、非 dry-run、无 checkout/pull/build，浏览器控制台无 error/warn。
- 2026-08-03: F409 开始；串行完成 ACL、并发/幂等、失败恢复、历史兼容、Provider 缺失及 Secret/日志脱敏负向 E2E，并保留 API/DB/browser 三层证据。
- 2026-08-03: F409 完成；跨团队 Project 对当前用户保持 0 membership、0 release/deployment 写入，浏览器只显示项目不存在。受控 Build #3 失败且无 Manifest，恢复配置后 Build #4 成功；并发/幂等、Production、兼容、Provider 正负/过期及 Secret/部署日志脱敏 11 suites/74 tests 通过。历史兼容仍只读且不合成 Manifest，Secret 只暴露 id/name/type 与掩码。修复预期 4xx 被重复写入 console.error 的噪声后，跨团队拒绝页控制台无 error/warn，网络/5xx 仍保留诊断。
- 2026-08-03: F410 开始；分别执行代码结构、领域不变量、UX/无障碍、安全审查，修复真实缺陷并完成 Prisma、全量测试/类型/构建、Docker/browser、提交链和主工作区保护最终验收。
- 2026-08-03: F410 完成；补齐 51 项 GateEvaluation 追加式持久化与证据版本，仓库 Git 子进程改为最小环境白名单和隔离 HOME。四类独立审查通过；API 38 suites/185 tests、真实 MySQL 9 suites/23 tests、Web 11 files/54 tests、Prisma validate/generate/migrate、API/Web type-check/build、2,798 条双语 parity 均通过。生产构建浏览器复核项目目录、51 项门禁、环境版本、恢复与中英文路径；最终 51 项最新结论为 9 passed、3 pending、1 needs_human、38 unavailable，Provider 缺失没有伪通过。主工作区 checkpoint 保持不变，任务 Docker 资源已删除，Git fixture 已可恢复地移入废纸篓。
