# Devpilot V13 Demo 1:1 Acceptance Checklist

## Purpose

本清单是 Devpilot V13 project-delivery 最终验收事实源。所有条目必须在当前实现上重新验证；F386-F412 的历史测试或截图可以辅助定位，但不能自动勾选本清单。验收以真实 API、数据库、运行日志、同 viewport 页面和浏览器行为为准。

## Frozen Reference

- Demo: `/Users/zhaoxingbo/.codex/visualizations/2026/07/31/019fb7eb-9f49-77b0-af1d-f50f9c4316ce/delivery-center-html/delivery-versions-v9.html`
- Demo SHA-256: `523080f43d935dba737fdfc0013f5133dc140c6d19936077692dfa556b549b0a`
- Canonical spec: `/Users/zhaoxingbo/.codex/visualizations/2026/07/31/019fb7eb-9f49-77b0-af1d-f50f9c4316ce/delivery-center-html/devpilot-project-delivery-v13-canonical-spec.md`
- Canonical SHA-256: `a491e9f5e9f583bf92fc56ef804a0884f5ab65bd93156a318b809f2b5b605393`
- Implementation TODO: `../todos/2026-08-04-devpilot-v13-demo-parity.md`
- Reference viewport: `1484 × 1324`；额外验证常规桌面和窄屏。

## Acceptance Semantics

- `[ ]` 未验收；`[x]` 只有在 Evidence 列包含当前 commit 的可复现证据后才能使用。
- `UI parity` 指信息层级、布局、密度、控件、文案、状态、主次动作和交互结果对齐，不允许用截图背景或硬编码 mock 冒充。
- `Functional parity` 指同一动作在前端、API、服务端约束、数据库状态、审计/日志和真实运行目标上结果一致。
- `Deployment success` 必须包含真实工作负载、配置注入、健康检查、路由/入口和浏览器访问；ZIP 解压或数据库写入不构成成功。
- 动态 ID、时间和真实业务数据可以不同；字段语义、状态和行为不可不同。

## AC-000. Baseline And Evidence Integrity

- [x] **AC-000** Demo 与 canonical spec 路径和 SHA-256 已冻结。Evidence: F413 docs。
- [x] **AC-001** V13 worktree/branch 与 protected master 边界已记录。Evidence: F413 TODO。
- [x] **AC-002** 当前 build/staging executor 配置状态已用运行容器而非猜测确认。Evidence: 2026-08-04 audit。
- [x] **AC-003** 当前 ReleaseOrder/BuildRun/Manifest/DeploymentRun/ReleaseRun/EnvironmentVersion 数量已只读确认。Evidence: 2026-08-04 audit。
- [ ] **AC-004** 每张最终截图的 URL、viewport、commit、数据 fixture 和 SHA-256 可追溯。
- [ ] **AC-005** 不接受空白、近白、重复 SHA、错误路由或只显示 loading 的截图。
- [ ] **AC-006** 所有最终声明可从 manifest/board/result 文件定位到原始命令、日志和截图。

## Project Directory And Project Creation

- [x] **AC-DIR-001** Sidebar 只有一个项目模块入口，不固定任何具体项目。
- [x] **AC-DIR-002** `/projects` 默认显示项目总数、线上运行数和待配置数。
- [x] **AC-DIR-003** 支持按项目名称、仓库和域名搜索。
- [x] **AC-DIR-004** 状态是主要筛选项；筛选名称与用户可见项目状态一致。
- [x] **AC-DIR-005** 项目默认按最近活动排序，不要求用户手工调整顺序。
- [x] **AC-DIR-006** 每行显示名称、项目形态、环境基线、Production 版本/域名和最近活动。
- [x] **AC-DIR-007** 每个项目只有一个明确的“进入项目”动作。
- [x] **AC-DIR-008** 目录空态同时提供“生成新项目”和“接入已有项目”入口。
- [x] **AC-DIR-009** 运行状态与配置状态分别来源于真实关系，不由前端猜测。
- [x] **AC-DIR-010** 目录在参考 viewport 的结构、密度和主次层级与 Demo 对齐。

  F417 correction：`online` 同时要求 exact current-version chain 与同
  team/project/active Production environment 的 active、非空域名 Site；缺失、
  inactive 或任一 scope 漂移均 fail closed。旧 filtered-empty 同 SHA 的两份
  截图统一归为 rejected，authoritative accepted/rejected inventories 不交叉。
  服务端 authoritative `initialDirectory` 在 SWR 首次 hydration frame 保持可见，
  后续静默 revalidate；missing/online 两态的 1484×1324 认证截图均须 Console 0。

- [x] **AC-PROJ-001** 生成新项目和接入已有项目最终生成同一种 Project 治理对象。
- [x] **AC-PROJ-002** 两条路径都产生唯一活动 Staging baseline。
- [x] **AC-PROJ-003** 两条路径都产生唯一活动 Production baseline。
- [x] **AC-PROJ-004** 两条路径都产生首个不可变环境配置修订并设置 current 指针。
- [x] **AC-PROJ-005** finalize 事务失败后保持可恢复 draft，不产生半完成 READY 项目。
- [x] **AC-PROJ-006** 重复/并发创建不会产生重复仓库身份或 baseline。

F414 evidence: `f414/svton/f414-mysql-clean-integration-20260804-115818.log` records 3 suites/10 real-MySQL tests for generated and repository-intake entry paths, rollback/recovery, repeated and mismatched idempotency, and concurrent completion. `f414/svton/f414-mysql-clean-invariants-20260804-115838.log` records both converged projects as `ready`, each with exactly one active Staging, one active Production, two R1 revisions and two current pointers; the generated path has no fabricated repository identity and the imported path has exactly one locked identity. Focused unit, type-check and build evidence is in the sibling F414 logs.

## Repository Intake And Identity

- [x] **AC-INTAKE-001** 接入已有项目固定为连接仓库、确认识别、创建基线三步。
- [x] **AC-INTAKE-002** 第一步验证真实只读仓库、主分支和精确 Commit。
- [x] **AC-INTAKE-003** 私有仓库只保存受管凭据引用，不在页面/API/日志回显秘密。
- [x] **AC-INTAKE-004** 第二步结构化展示项目类型、架构、包管理器和部署方案。
- [x] **AC-INTAKE-005** 第二步结构化展示组件、路径、类型、构建输出和运行方式。
- [x] **AC-INTAKE-006** 用户可调整允许覆盖的识别字段，且应用后形成可追溯快照。
- [x] **AC-INTAKE-007** 分析失败、超时、重试、拒绝建议和必选依赖均有明确恢复动作。

F415 evidence: real Git `main@196d1de753ea34c822d11b1a8ed0a0937bce97dc` remained at tree `76970f2180aa60c131dfce9f979441509786f48c` with a clean status after connect/analyze/retry/review/finalize. Real MySQL persisted immutable snapshot `cmseajium0017pkx6q2l1vvux` / `acbfeada48e1df4fe661b53038c09ffcd63d93c9e968387f4fcbb29dcd8586ac`, and finalization bound that exact ID/hash. Browser screenshots `01`–`09` cover private credential intake, real failure/retry, structured overview/components, dependency blocker/recovery, frozen Step 3, post-finalization project, refresh/back read-only review, and English copy. Independent review rejected baseline `c53363ce` because the legacy generic apply route could mutate a run after snapshot creation. The correction serializes both apply routes on the analysis-run row, rejects post-snapshot generic apply before side effects, renders from snapshot decisions, and rejects finalization drift. A deterministic MySQL lock-wait race, exact no-mutation comparison, deliberate drift 409 with zero governance writes, then restored successful finalization now close that P1. Accepted and rejected evidence is recorded under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f415/`.

- [x] **AC-IDENTITY-001** finalize 后 canonical repository identity 只读可见。
- [x] **AC-IDENTITY-002** 修改仓库地址或 provider 不得使 connection 与 canonical identity 漂移。
- [x] **AC-IDENTITY-003** 主分支调整遵循显式权限、修订和审计策略。
- [x] **AC-IDENTITY-004** BuildRun 的 source repository/branch 必须与生效身份一致。
- [x] **AC-IDENTITY-005** 跨仓库、重复仓库、已锁定身份替换和活跃分析并发负例全部拒绝。

F416 evidence: canonical repository identity and append-only branch revisions are now the single source boundary for connection, intake, analysis and BuildRun reservation. Project-row locking, canonical key/provider/URL checks, current-revision ownership and CAS/idempotency reject replacement, duplicate, drift and active-analysis races before credentials, Git checkout or BuildRun creation. A fresh disposable MySQL database and real local Git repository passed the identity, release-build and adjacent intake regressions. The authenticated Browser flow visibly revised `main@0d18abd4...` R1 to `release@993ba4dd...` R2 and produced successful Build #1 pinned to R2. A direct locked replacement returned 409 with identical before/after connection, canonical identity, revision, analysis, BuildRun, audit and credential counts; the secret sentinel had zero hits in DB, API response, runtime logs and Browser DOM/HTML/console. Independent review rejected the first F416 commit because the audit summary/metadata dropped the operator reason, historical BuildRun presentation read provider/URL from a mutable joined identity, the migration could fabricate a zero-SHA R1, and accepted logs were not hash-bound. The correction retains the exact reason in the same-transaction high-risk audit and proves rollback on audit failure; presents validated v2 provider/URL/revision/branch/SHA only from the frozen input snapshot with exact numeric legacy v1/null fallback; and backfills R1 only for an exact/aligned connected+verified identity/connection with matching non-null branches, conservative canonical URL equivalence and a non-zero 40/64-hex commit. A second independent review found that v3, missing and malformed version shapes still borrowed mutable joined identity; the bounded follow-up fails those shapes closed and keeps only v1/null compatibility. A real pre-F416 MySQL upgrade matrix set only the verified 40/64 fixtures and left null/zero/invalid SHA, null/mismatched branch, URL/provider drift, unverified and disconnected fixtures without `currentRevisionId`. F463 still owns their inventory/collision-safe remediation. Accepted and rejected evidence plus SHA-256 inventory is indexed under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f416-correction/`.

## Project Delivery Home And Release List

- [x] **AC-HOME-001** 进入项目默认打开发布单，而不是环境进度或概览。
- [x] **AC-HOME-002** 高频一级只显示“发布单”和“环境版本”。
- [x] **AC-HOME-003** 顶部弱摘要显示项目形态、环境就绪、资源绑定和入口状态。
- [x] **AC-HOME-004** 顶部弱摘要显示 Staging 与 Production 当前环境版本。
- [x] **AC-HOME-005** “创建发布单”为主操作，“管理项目”为次操作，发布规则不占高频 Tab。
- [x] **AC-HOME-006** 发布单列表支持版本、Commit、Build 和 Manifest 搜索。
- [x] **AC-HOME-007** 发布单列表支持用户可理解的状态筛选。
- [x] **AC-HOME-008** 列表默认按最近执行时间排序。
- [x] **AC-HOME-009** 每行显示发布版本号、来源主分支/Commit 和说明。
- [x] **AC-HOME-010** 每行显示构建次数和当前/最近成功 Manifest。
- [x] **AC-HOME-011** 每行显示环境发布次数和最近发布环境/结果。
- [x] **AC-HOME-012** 每行显示最近执行步骤和一个明确的“查看发布单”动作。
- [x] **AC-HOME-013** 创建发布单只输入发布版本号和可选说明，不选环境、Commit 或构建说明。

F418 evidence: the authenticated, ACL-scoped `GET /projects/:projectId/delivery/summary` derives canonical repository identity and the frozen F415 intake snapshot, validates Staging/Production current versions through the exact completed non-dry-run release-order deployment chain, and counts only same-project environment resources plus explicit Site entries. The default SSR/SWR page renders the Release Orders tab first, exposes only Release Orders and Environment Versions at the high-frequency level, and keeps Manage Project secondary to Create Release Order without loading the legacy deployment/webhook detail graph. Focused API/Web tests, both type-checks, a fresh disposable MySQL integration run, authenticated API headers and a 1484×1324 Browser capture are indexed under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f418/`.

F418 correction evidence: independent review found that the Environment Versions tab could not open the create dialog with real active-child Tabs and that intake still read the newest mutable review/config instead of frozen finalization truth. The corrected route owns one release-order hook and one always-mounted create dialog above both tab children, while shared API/directory projection accepts only the deterministically selected succeeded finalization whose team/project, completed timestamp, analysis run, review snapshot ID/hash and result snapshot all agree; missing or drifting evidence fails the whole intake summary closed without config fallback. Focused API/Web regressions, two fresh real-MySQL suites, CodeGraph affected coverage, both type-checks/builds/lints, i18n and formatting passed. An authenticated 1484×1324 Browser flow opened the two-field dialog from Environment Versions with zero console issues, and sanitized MySQL/API counts proved that the Browser flow created no release order. Accepted correction evidence is indexed under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f418-correction/`.

F419 evidence: the ACL-scoped release-order read model performs literal-safe version/note/Commit/Build/Manifest search, five persisted-status filters, stable recent-execution ordering and total/count projection in one repeatable-read snapshot with a constant two database queries. Locked repository revisions, append-only BuildRun/Manifest/DeploymentRun/ReleaseRun facts and exact team/project/environment predicates supply source identity, build/deployment counts, the current or prior successful Manifest and the latest step; awaiting approval affects the latest step without inflating deployment counts. The Web list sends search/status/take to the server, keys cached data by actor/team/project/query, clears prior-scope rows and refetches after create instead of loading or prepending a client-side full set. Focused API/Web tests, a fresh disposable MySQL 8 run, CodeGraph affected coverage, both type-checks/builds/lints, i18n and formatting passed. Authenticated API proof returned total 52 with 50 bounded rows and private no-store/Vary headers. Five accepted 1484×1324 Browser captures proved default ordering/density, normal and escaped-literal search, active status count, exact detail action and team-switch isolation with zero JavaScript console errors; the isolation probe's expected ACL summary 404 retries are recorded rather than reported as zero network errors. Accepted/rejected evidence and SHA-256 inventories are indexed under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f419/`.

## Release Order Detail And Preflight

- [ ] **AC-ORDER-001** 产品统一使用“发布单”“发布版本号”“环境版本”，不把三者统称版本。
- [ ] **AC-ORDER-002** ReleaseOrder 状态与 BuildRun/DeploymentRun/EnvironmentVersion 状态分离。
- [ ] **AC-ORDER-003** 构建、预发、生产失败能够派生正确的发布单可见状态。
- [ ] **AC-ORDER-004** 成功生产发布后发布单进入成功/已发布状态。
- [ ] **AC-ORDER-005** 撤回/取消只影响后续动作，不覆盖历史运行。
- [ ] **AC-ORDER-006** 无执行证据默认打开前置检查。
- [ ] **AC-ORDER-007** 有 BuildRun、无 Staging 运行时默认打开构建制品。
- [ ] **AC-ORDER-008** 有 Staging DeploymentRun、无 Production ReleaseRun 时默认打开预发发布。
- [ ] **AC-ORDER-009** 有 Production ReleaseRun/DeploymentRun 时默认打开生产发布。
- [ ] **AC-ORDER-010** 查看其他步骤不改变真实 resumeStep，刷新恢复最远执行步骤。
- [ ] **AC-ORDER-011** 四步使用连接步进条而不是无状态普通 Tab。
- [ ] **AC-ORDER-012** 每步显示编号、名称、证据摘要和完成/当前/等待/阻断状态。
- [ ] **AC-ORDER-013** 步进条支持键盘导航、`aria-current`/selected 和稳定 URL。
- [ ] **AC-ORDER-014** 非法 step、跨项目 order/build ID fail closed 并规范化 URL。
- [ ] **AC-ORDER-015** 页面标题区显示发布单、发布版本号、主分支和最近执行步骤。
- [ ] **AC-ORDER-016** 页面只保留一个上下文相关主动作，不出现三个作用近似入口。
- [ ] **AC-ORDER-017** 构建记录归属发布单详情。
- [ ] **AC-ORDER-018** Manifest/制品证据归属对应 BuildRun。
- [ ] **AC-ORDER-019** Staging/Production 运行归属发布单详情。
- [ ] **AC-ORDER-020** 项目级专业部署深链可达，但不与发布单争夺主导航。
- [ ] **AC-ORDER-021** 所有运行记录只追加，历史不可覆盖。

- [ ] **AC-GATE-001** 前置检查首屏显示来源/CI、影响识别、Secret/安全和配置/资源等 MVP 摘要。
- [ ] **AC-GATE-002** 显示 15 个 MVP 能力组总数和整体是否允许进入下一步。
- [ ] **AC-GATE-003** 可下钻完整 51 项目录。
- [ ] **AC-GATE-004** 51 项按 Commit 10、Build 11、Deploy 20、Promote 10 分组。
- [ ] **AC-GATE-005** 每项显示状态、Provider、原因、证据引用、检查时间和过期时间。
- [ ] **AC-GATE-006** `unavailable`、`needs_human`、warning、failed 与 passed 视觉/语义不同。
- [ ] **AC-GATE-007** 必需来源/CI 门禁失败时服务端拒绝 Build。
- [ ] **AC-GATE-008** 必需构建/制品门禁失败时服务端拒绝 Staging。
- [ ] **AC-GATE-009** 必需部署/入口门禁失败时服务端拒绝 Production。
- [ ] **AC-GATE-010** 业务验证可以展示为非阻断证据，不伪装技术通过。
- [ ] **AC-GATE-011** 人工确认只满足定义为人工的门禁。
- [ ] **AC-GATE-012** 缺失、过期或关闭 Provider 默认 unavailable/failed，不得 pass。
- [ ] **AC-GATE-013** 门禁决定和对应输入快照持久化可审计。
- [ ] **AC-GATE-014** 页面展示状态和服务端实际阻断决定完全一致。

## Build And Artifact

- [ ] **AC-BUILD-001** “构建最新代码”位于发布单详情主要位置。
- [ ] **AC-BUILD-002** 点击后不要求选择版本、Commit、环境或构建说明。
- [ ] **AC-BUILD-003** 服务端每次重新解析生效主分支最新 Commit。
- [ ] **AC-BUILD-004** Production 制品冻结后当前发布单不能静默重建替换该制品。
- [ ] **AC-BUILD-005** 验收 Docker profile 显式启用受控构建 executor。
- [ ] **AC-BUILD-006** 非验收/生产默认配置继续 fail closed，不因缺配置隐式执行本地命令。
- [ ] **AC-BUILD-007** 每次构建创建独立 revision、输入快照、inputHash 和 BuildRun。
- [ ] **AC-BUILD-008** 构建并发分配 revision 无重复。
- [ ] **AC-BUILD-009** 超时、取消和失败形成独立失败运行。
- [ ] **AC-BUILD-010** 构建命令在受控目录、最小环境和明确并发边界内执行。
- [ ] **AC-BUILD-011** 成功 BuildRun 产生且只产生一个不可变 Artifact Manifest。
- [ ] **AC-BUILD-012** 失败 BuildRun 不产生 Manifest。
- [ ] **AC-BUILD-013** Manifest 包含组件项、URI、Digest、来源 Commit 和 provenance。
- [ ] **AC-BUILD-014** 制品只包含声明的构建输出，不把整个仓库误当运行制品。
- [ ] **AC-BUILD-015** `.env`、凭据、token、临时构建目录、绝对或父级越界 symlink 和特殊文件不进入制品。
- [ ] **AC-BUILD-016** 相同 Commit/输入产生可复现 Digest，差异有明确来源。
- [ ] **AC-BUILD-017** Staging 与 Production 复用同一 Manifest，环境差异来自配置快照。
- [ ] **AC-BUILD-018** 前端静态环境值若烘焙进输出，必须被识别为不同制品而非伪复用。
- [ ] **AC-BUILD-019** 构建表显示 Build ID/revision、Commit、结果、Manifest、耗时和时间。
- [ ] **AC-BUILD-020** 成功、失败、运行中、取消状态与 Demo 语义一致。
- [ ] **AC-BUILD-021** 每个 BuildRun 有独立“日志”入口。
- [ ] **AC-BUILD-022** 日志使用右侧 Drawer，刷新后仍可深链到精确 BuildRun。
- [ ] **AC-BUILD-023** 日志包含必要命令/结果且完成脱敏。
- [ ] **AC-BUILD-024** 多次构建不会覆盖旧日志、Manifest 或候选证据。
- [ ] **AC-BUILD-025** 构建页面视觉密度、表格结构和主动作与 Demo 对齐。

## Staging Deployment

- [ ] **AC-STG-001** Staging 只能选择当前发布单成功 BuildRun 的 Manifest。
- [ ] **AC-STG-002** 部署动作名称为“部署”，不叫“再次部署”或“部署候选构建”。
- [ ] **AC-STG-003** 重复部署同一 Manifest 每次创建新 DeploymentRun。
- [ ] **AC-STG-004** 重复部署不执行 Git、checkout、pull 或 build。
- [ ] **AC-STG-005** 服务端复算并验证 Manifest Digest。
- [ ] **AC-STG-006** 跨项目、跨发布单、失败 BuildRun 和未知 Manifest 均拒绝。
- [ ] **AC-STG-007** DeploymentRun 冻结环境配置 revision ID/hash。
- [ ] **AC-STG-008** 普通变量按目标环境注入。
- [ ] **AC-STG-009** Secret 通过受管引用在运行时解析，明文不写入 DB/API/log。
- [ ] **AC-STG-010** 资源实例连接信息按环境绑定注入。
- [ ] **AC-STG-011** 部署目标来自当前环境生效绑定。
- [ ] **AC-STG-012** 配置/资源/目标漂移在运行前被检测或形成新快照。
- [ ] **AC-STG-013** 部署输入可审计但不包含 Secret 明文。
- [ ] **AC-STG-014** Provider 启动真实前后端/worker/静态站点工作负载。
- [ ] **AC-STG-015** 工作负载使用精确 Manifest，不从源码目录直接运行替代制品。
- [ ] **AC-STG-016** 服务级进程/容器状态可读取。
- [ ] **AC-STG-017** HTTP/进程健康检查实际执行。
- [ ] **AC-STG-018** 健康检查失败时 DeploymentRun 失败且保留诊断日志。
- [ ] **AC-STG-019** 只有成功运行生成新的 Staging EnvironmentVersion。
- [ ] **AC-STG-020** 失败部署不移动 current environment version 指针。
- [ ] **AC-STG-021** 页面显示当前选中 Build/Manifest 和累计预发部署次数。
- [ ] **AC-STG-022** 页面显示每次 DeploymentRun、Manifest、结果、验证结论和耗时。
- [ ] **AC-STG-023** 每次运行有独立日志 Drawer。
- [ ] **AC-STG-024** 每条记录有明确的“部署”重复动作。
- [ ] **AC-STG-025** 页面能区分业务验证证据和技术部署结果。
- [ ] **AC-STG-026** 无 Manifest、失败、执行中、成功和阻断空态完整。
- [ ] **AC-STG-027** Staging 页面结构和视觉与 Demo 同状态对齐。

## Production Release

- [ ] **AC-PROD-001** 生产发布按钮只在生产步骤出现。
- [ ] **AC-PROD-002** 没有同 Manifest 的成功 Staging 技术证明时按钮禁用且 API 拒绝。
- [ ] **AC-PROD-003** 业务验证未完成不阻断当前 MVP，但状态明确展示。
- [ ] **AC-PROD-004** 点击生产发布始终打开确认 Dialog。
- [ ] **AC-PROD-005** Dialog 展示 Production 环境和发布版本号。
- [ ] **AC-PROD-006** Dialog 展示 Build/revision/Commit 和 Manifest/Digest。
- [ ] **AC-PROD-007** Dialog 展示配置 revision、资源/路由快照和发布策略。
- [ ] **AC-PROD-008** 关闭/取消 Dialog 不创建 ReleaseRun 或审批。
- [ ] **AC-PROD-009** 确认后创建唯一、幂等、不可变 Production ReleaseRun。
- [ ] **AC-PROD-010** 生产确认创建项目上下文可见的审批。
- [ ] **AC-PROD-011** 有权限用户可在项目发布上下文批准或拒绝。
- [ ] **AC-PROD-012** 批准后可在项目上下文继续执行，无需手工跳转全局审批再返回。
- [ ] **AC-PROD-013** 全局审批模块保留专业深链和同一状态。
- [ ] **AC-PROD-014** 拒绝、过期、已消费和输入漂移的审批均不可执行。
- [ ] **AC-PROD-015** 并发确认/执行收敛为一个有效运行。
- [ ] **AC-PROD-016** 审批人与执行权限由服务端校验。
- [ ] **AC-PROD-017** Production 使用与 Staging 相同的 exact-Manifest Deployment Provider 合同。
- [ ] **AC-PROD-018** Production 消费确认时冻结的配置/资源/路由/策略快照。
- [ ] **AC-PROD-019** Production 不读取确认后漂移的 current config 作为执行输入。
- [ ] **AC-PROD-020** Production 启动真实工作负载。
- [ ] **AC-PROD-021** Production 不执行 Git、checkout、pull 或 build。
- [ ] **AC-PROD-022** Production 健康检查失败时运行失败并可恢复。
- [ ] **AC-PROD-023** 成功运行创建 Production EnvironmentVersion 并移动 current 指针。
- [ ] **AC-PROD-024** 成功后 ReleaseRun、approval 和 DeploymentRun 状态一致。
- [ ] **AC-PROD-025** 站点/域名入口指向新 Production 运行目标。
- [ ] **AC-PROD-026** DNS 状态真实读取或明确 unavailable。
- [ ] **AC-PROD-027** TLS 状态真实读取或明确 unavailable。
- [ ] **AC-PROD-028** HTTP 探测实际访问最终站点 URL。
- [ ] **AC-PROD-029** 浏览器可加载最终站点核心页面。
- [ ] **AC-PROD-030** 探测/切换失败不标记 Production 成功。
- [ ] **AC-PROD-031** 路由切换、探测和结果证据归属精确 DeploymentRun。
- [ ] **AC-PROD-032** 页面显示当前线上版本、待发布 Manifest 和前置证明。
- [ ] **AC-PROD-033** 页面显示 Production ReleaseRun、审批、DeploymentRun 和结果。
- [ ] **AC-PROD-034** 每次 Production 运行有独立日志 Drawer。
- [ ] **AC-PROD-035** 等待审批、批准、拒绝、执行中、成功和失败状态完整。
- [ ] **AC-PROD-036** 页面不暴露 raw 内部状态码。
- [ ] **AC-PROD-037** 页面只有一个当前有效主动作。
- [ ] **AC-PROD-038** Production 页面结构和视觉与 Demo 同状态对齐。

## Environment Versions And Recovery

- [ ] **AC-ENVVER-001** Staging 和 Production 分卡显示当前环境版本。
- [ ] **AC-ENVVER-002** 每卡显示发布版本号和来源发布单。
- [ ] **AC-ENVVER-003** 每卡显示 Manifest/Digest 和 Build revision。
- [ ] **AC-ENVVER-004** 每卡显示最近运行和时间。
- [ ] **AC-ENVVER-005** 成功历史按时间倒序且保持 previous-version 链。
- [ ] **AC-ENVVER-006** current 指针只从成功 DeploymentRun 派生。
- [ ] **AC-ENVVER-007** 升级只列出同项目成功且可追溯 Manifest。
- [ ] **AC-ENVVER-008** Production 只列出具有同 Manifest Staging 证明的候选。
- [ ] **AC-ENVVER-009** 回退只列出该环境历史成功版本。
- [ ] **AC-ENVVER-010** 默认推荐上一次成功版本，不接受任意文本版本或镜像。
- [ ] **AC-ENVVER-011** Staging 升级/回退每次创建新 DeploymentRun 和 EnvironmentVersion。
- [ ] **AC-ENVVER-012** Production 升级创建新的 Production approval/ReleaseRun。
- [ ] **AC-ENVVER-013** Production 回退创建新的 recovery approval/ReleaseRun。
- [ ] **AC-ENVVER-014** 不复用历史已经消费的 approval。
- [ ] **AC-ENVVER-015** 配置漂移后必须重新确认新的快照。
- [ ] **AC-ENVVER-016** 升级、重复部署、回退历史均不覆盖。
- [ ] **AC-ENVVER-017** 每次环境版本变更有独立日志和证据入口。

## Manage Project And Environment Governance

- [ ] **AC-SET-001** 管理项目是独立页面/二级路由，不与发布单平铺。
- [ ] **AC-SET-002** 顶层只组织项目识别、环境配置和发布规则等低频域。
- [ ] **AC-SET-003** 环境先选择 Staging/Production，再显示该环境当前配置。
- [ ] **AC-SET-004** 环境内容分为部署目标、资源绑定、变量与密钥、域名与入口、保护规则。
- [ ] **AC-SET-005** 每个子区有稳定深链并在刷新后恢复。
- [ ] **AC-SET-006** 不用单个超长 Drawer 同时承载全部配置。
- [ ] **AC-SET-007** 配置状态、运行状态和环境版本状态分离。
- [ ] **AC-SET-008** 常用绑定/替换在项目内完成，高级生命周期可跳专业模块。
- [ ] **AC-SET-009** 页面结构、密度和子导航与 Demo 对齐。
- [ ] **AC-SET-010** 项目始终只有一个活动 Staging baseline。
- [ ] **AC-SET-011** 项目始终只有一个活动 Production baseline。
- [ ] **AC-SET-012** baseline 不允许无保护归档或创建重复角色。
- [ ] **AC-SET-013** 首个 DeploymentRun 后 environment key 不可修改。
- [ ] **AC-SET-014** 显示名、描述和配置可以按权限新建修订。
- [ ] **AC-SET-015** baseline/key/配置修改形成审计事件。
- [ ] **AC-SET-016** UI 不展示不适用于当前项目的环境模板选项。
- [ ] **AC-SET-017** 每个环境显示当前部署 Provider/服务器/集群目标。
- [ ] **AC-SET-018** 可以绑定、替换和解除未被运行冻结的目标。
- [ ] **AC-SET-019** 目标绑定支持环境隔离或显式共享声明。
- [ ] **AC-SET-020** 绑定前执行权限、归属和连通性检查。
- [ ] **AC-SET-021** 被历史运行引用的目标关系可追溯。
- [ ] **AC-SET-022** 目标不可用时发布门禁 fail closed。
- [ ] **AC-SET-023** 部署使用的目标与设置页当前生效目标一致。
- [ ] **AC-SET-024** 部署目标页面与 Demo 字段/状态对齐。
- [ ] **AC-SET-025** 资源实例按环境查看和绑定。
- [ ] **AC-SET-026** 支持资源在指定多个环境复用并显式展示共享范围。
- [ ] **AC-SET-027** 基础设施模块拥有资源创建/释放，项目只拥有引用关系。
- [ ] **AC-SET-028** 跨项目资源引用被拒绝。
- [ ] **AC-SET-029** 资源健康/连接状态真实读取。
- [ ] **AC-SET-030** 资源引用进入不可变配置修订。
- [ ] **AC-SET-031** 运行冻结精确资源 snapshot。
- [ ] **AC-SET-032** 资源绑定页面与 Demo 信息结构对齐。
- [ ] **AC-SET-033** 普通变量按环境维护。
- [ ] **AC-SET-034** Secret 只保存 key ID/name/type 引用。
- [ ] **AC-SET-035** `.env` 导入先预览和分类，再提交。
- [ ] **AC-SET-036** 支持变量/引用按选择的环境复用。
- [ ] **AC-SET-037** 每次保存创建不可变 revision 和 snapshotHash。
- [ ] **AC-SET-038** 使用 expected revision/CAS 防止静默覆盖。
- [ ] **AC-SET-039** 页面显示当前 revision、来源、时间和变更说明。
- [ ] **AC-SET-040** API、DB、日志和 UI 不泄漏 Secret 明文。
- [ ] **AC-SET-041** 变量与密钥页面和 Demo 对齐。
- [ ] **AC-SET-042** 每个环境可管理站点和域名入口。
- [ ] **AC-SET-043** 域名映射到明确组件、端口/路径和运行目标。
- [ ] **AC-SET-044** DNS Provider 和验证状态真实可读。
- [ ] **AC-SET-045** TLS 请求、证书和到期状态真实可读。
- [ ] **AC-SET-046** 代理/Ingress 规则按 revision 保存。
- [ ] **AC-SET-047** 路由变更不反向修改历史运行快照。
- [ ] **AC-SET-048** 入口未就绪时对应门禁阻断 Production。
- [ ] **AC-SET-049** 最终站点健康探测可从页面下钻。
- [ ] **AC-SET-050** 域名与入口页面和 Demo 对齐。

## Release Policy And Advanced Strategies

- [ ] **AC-POLICY-001** 项目设置显示当前生效策略 revision 和 snapshotHash。
- [ ] **AC-POLICY-002** 普通发布页面不高频重复展示规则配置。
- [ ] **AC-POLICY-003** 修改策略创建新 revision，不原地覆盖历史。
- [ ] **AC-POLICY-004** 标准发布要求同 Manifest Staging 证明。
- [ ] **AC-POLICY-005** Production 始终需要明确人工确认。
- [ ] **AC-POLICY-006** 环境并发和冻结规则服务端执行。
- [ ] **AC-POLICY-007** 回退创建新的恢复运行。
- [ ] **AC-POLICY-008** 金丝雀/蓝绿/自动放量在缺真实 Provider 时显示具体不可用原因。
- [ ] **AC-POLICY-009** 不可用高级策略不能被 API 或 UI 选为可执行。
- [ ] **AC-POLICY-010** 未来高级策略从项目选择 stable/target Manifest 并进入独立运行管控，不污染普通发布单主链。

## Copy, Visual And Accessibility

- [ ] **AC-COPY-001** 用户可见主对象统一称“发布单”。
- [ ] **AC-COPY-002** `releaseVersion` 统一称“发布版本号”。
- [ ] **AC-COPY-003** `EnvironmentVersion` 统一称“环境版本”。
- [ ] **AC-COPY-004** `BuildRun/Manifest/DeploymentRun/ReleaseRun` 在专业证据区保留准确术语。
- [ ] **AC-COPY-005** 页面不出现“候选 xx”“默认路径”“需要处理”“正在交付”等无法指导动作的模糊词。
- [ ] **AC-COPY-006** raw status code 不直接暴露给用户。
- [ ] **AC-COPY-007** Staging/Production 技术名与“预发/生产”用户名组合一致。
- [ ] **AC-COPY-008** zh/en key、ICU 参数和运行时切换 parity 通过。

- [ ] **AC-UI-001** 项目目录页面布局与 Demo 对齐。
- [ ] **AC-UI-002** 三步接入页面布局与 Demo 对齐。
- [ ] **AC-UI-003** 项目交付首页布局与 Demo 对齐。
- [ ] **AC-UI-004** 发布单列表布局与 Demo 对齐。
- [ ] **AC-UI-005** 四步详情壳与 Demo 对齐。
- [ ] **AC-UI-006** 构建步骤布局与 Demo 对齐。
- [ ] **AC-UI-007** 预发步骤布局与 Demo 对齐。
- [ ] **AC-UI-008** 生产步骤布局与 Demo 对齐。
- [ ] **AC-UI-009** 环境版本布局与 Demo 对齐。
- [ ] **AC-UI-010** 管理项目各子页布局与 Demo 对齐。
- [ ] **AC-UI-011** 初始空态提供明确下一动作。
- [ ] **AC-UI-012** 加载状态不闪烁错误空态。
- [ ] **AC-UI-013** 阻断状态同时说明原因和恢复动作。
- [ ] **AC-UI-014** 执行中状态阻止重复危险提交。
- [ ] **AC-UI-015** 成功状态显示可追溯证据。
- [ ] **AC-UI-016** 失败状态保留运行并提供日志/重试。
- [ ] **AC-UI-017** 等待审批与能力未就绪状态不同。
- [ ] **AC-UI-018** Demo 展示的主要状态都有真实 fixture 页面证据。
- [ ] **AC-UI-019** 参考 viewport 无横向溢出、裁切或遮挡。
- [ ] **AC-UI-020** 常规桌面宽度无横向溢出。
- [ ] **AC-UI-021** 窄屏保持主流程和关键操作可用。
- [ ] **AC-UI-022** 长 Commit/Digest/域名可换行或截断并可查看完整值。
- [ ] **AC-UI-023** Drawer/Dialog 有合理宽度和滚动边界。
- [ ] **AC-UI-024** destructive action 不与普通编辑同级误触。
- [ ] **AC-UI-025** 页面使用现有设计系统组件，不以硬编码截图复刻。

- [ ] **AC-A11Y-001** 页面存在唯一、正确层级的 h1。
- [ ] **AC-A11Y-002** 步进条、Tab、表格、Dialog、Drawer 使用正确语义。
- [ ] **AC-A11Y-003** 所有图标按钮有本地化 accessible name。
- [ ] **AC-A11Y-004** 表单控件有可关联 label、帮助文本和错误文本。
- [ ] **AC-A11Y-005** 错误和运行状态通过合适 live region/role 反馈。
- [ ] **AC-A11Y-006** 键盘可以完成创建、步骤切换、构建、部署和确认。
- [ ] **AC-A11Y-007** Dialog/Drawer 正确锁焦、恢复焦点并支持 Escape。
- [ ] **AC-A11Y-008** 不依赖颜色单独表达状态。
- [ ] **AC-A11Y-009** 正文、次级文字、边框和状态色对比度通过。
- [ ] **AC-A11Y-010** 缩放 200% 后核心流程仍可用。
- [ ] **AC-A11Y-011** 中英文切换后无截断或 accessible name 漂移。
- [ ] **AC-A11Y-012** 自动化 axe/可访问性检查和人工键盘路径均通过。

## Runtime, E2E And Final Verdict

- [ ] **AC-E2E-001** 隔离 parity stack 使用命名空间化的 compose project/network/volume，以及独立端口、数据库、Redis、artifact/deployment 存储和目标运行时。
- [ ] **AC-E2E-002** fixture 仓库固定 commit 且包含可真实构建的前端/后端 monorepo。
- [ ] **AC-E2E-003** fixture 提供 Staging/Production 目标、资源、Secret 引用和域名入口。
- [ ] **AC-E2E-004** seed/reset 幂等、目标 allowlist 可审计且不会删除非 parity 数据或资源。
- [ ] **AC-E2E-005** executor/provider 开关和运行限制显式记录。
- [ ] **AC-E2E-006** Browser/API/DB/log 证据使用同一 project/order/run IDs。
- [ ] **AC-E2E-007** 从项目目录进入三步仓库接入。
- [ ] **AC-E2E-008** 应用识别结果并创建 Staging/Production baseline。
- [ ] **AC-E2E-009** 完成环境目标、资源、变量/Secret 和域名入口配置。
- [ ] **AC-E2E-010** 创建发布单且初始 0 BuildRun/Manifest。
- [ ] **AC-E2E-011** 构建主分支最新 Commit 并产生成功 Manifest。
- [ ] **AC-E2E-012** 同 Manifest 成功部署到 Staging。
- [ ] **AC-E2E-013** 在项目内确认、审批并部署同 Manifest 到 Production。
- [ ] **AC-E2E-014** Production current EnvironmentVersion 与运行/Manifest 一致。
- [ ] **AC-E2E-015** 最终域名从浏览器可访问核心页面。
- [ ] **AC-E2E-016** 同发布单第二次构建创建新 BuildRun/Manifest。
- [ ] **AC-E2E-017** 同一 Manifest 两次 Staging 部署创建两个 DeploymentRun 且构建数不变。
- [ ] **AC-E2E-018** Staging 升级产生新环境版本。
- [ ] **AC-E2E-019** Staging 回退产生新恢复环境版本。
- [ ] **AC-E2E-020** Production 升级经过新的确认/审批并成功。
- [ ] **AC-E2E-021** Production 回退经过新的恢复确认/审批并成功。
- [ ] **AC-E2E-022** 所有 current/history/previousVersion 链正确。
- [ ] **AC-E2E-023** 所有运行日志可从对应发布单或环境版本打开。
- [ ] **AC-E2E-024** 未连接仓库或无主分支时构建拒绝。
- [ ] **AC-E2E-025** 必需门禁失败时对应阶段服务端拒绝。
- [ ] **AC-E2E-026** Provider 关闭时能力 unavailable 且执行拒绝。
- [ ] **AC-E2E-027** 跨项目/发布单 Manifest 拒绝。
- [ ] **AC-E2E-028** Digest 被篡改时部署拒绝。
- [ ] **AC-E2E-029** 配置快照漂移时 Production 旧确认拒绝。
- [ ] **AC-E2E-030** 审批拒绝/过期/已消费时执行拒绝。
- [ ] **AC-E2E-031** 两个使用相同或不同幂等键的并发生产确认/执行都不会双发。
- [ ] **AC-E2E-032** 健康检查失败不移动 current 指针。
- [ ] **AC-E2E-033** DNS/TLS/HTTP 探测失败不标记最终成功。
- [ ] **AC-E2E-034** 无权限用户看不到或不能执行受保护动作。
- [ ] **AC-E2E-035** 全链 API/DB/log/截图/compose/runtime/evidence artifact 无 Secret、token、bootstrap 或认证凭据明文泄漏。

- [ ] **AC-VIS-001** 项目目录 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-002** 项目接入三步 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-003** 发布单列表 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-004** 前置检查 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-005** 构建步骤 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-006** Staging 步骤 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-007** Production 步骤 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-008** 环境版本 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-009** 项目识别 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-010** 部署目标/资源/变量/入口/保护规则 Demo/实际对照已审查。
- [ ] **AC-VIS-011** 发布规则 Demo/实际同 viewport 对照已审查。
- [ ] **AC-VIS-012** 所有可见结构差异已修复或由 canonical spec 明确批准。

- [ ] **AC-REVIEW-001** 产品审查确认主链、边界和术语符合 canonical spec。
- [ ] **AC-REVIEW-002** UX 审查确认新用户沿单一主动作可完成发布。
- [ ] **AC-REVIEW-003** 专业用户可下钻门禁、制品、日志、资源、配置和审计。
- [ ] **AC-REVIEW-004** 领域审查确认不可变运行/快照和 current read-model 边界正确。
- [ ] **AC-REVIEW-005** 安全审查确认权限、审批、执行、Secret 和日志边界正确。
- [ ] **AC-REVIEW-006** 无障碍审查确认键盘、语义、焦点和对比度通过。
- [ ] **AC-REVIEW-007** 兼容审查确认旧深链/历史数据不被破坏或伪造迁移。
- [ ] **AC-REVIEW-008** 最终 reviewer 与主要实现 worker 分离，所有有效发现已关闭。

## Final Completion Rule

只有同时满足以下条件才可将 F460 和 Goal 标记完成：

1. 本文件不存在未勾选条目；若 canonical spec 明确删除某项，必须记录批准依据而不是静默跳过。
2. V13 Demo 所有主要页面和状态均有同 viewport 实际实现对照。
3. 正向完整链路以真实构建、工作负载、路由和浏览器访问结束。
4. 负向、并发、权限、漂移和 Secret 泄漏验收通过。
5. TODO、progress、roadmap、board、worker result 和最终报告状态一致。
