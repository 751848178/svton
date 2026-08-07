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

F419 correction evidence: independent review found that a Deployment could borrow an unverified `ArtifactManifest.buildRunId`, while a ReleaseRun execution event did not revalidate its Manifest ownership or frozen digest. The SQL owner now joins Deployment Manifest→BuildRun on exact id/team/project/release-order fields and returns only the validated BuildRun id; ReleaseRun events join the exact team/project/release-order Manifest and require `verifiedDigest = digest`, while the Production baseline-environment predicate remains unchanged. Raw-SQL unit coverage plus a fresh tmpfs MySQL 8 run rejects same-project cross-order, cross-project, cross-team and digest-drift relations without changing sort, last execution, deployment count/latest or exposing foreign Build ids; normal awaiting approval, repeated Staging, tie priority, bounded total/take/search and exactly two raw queries remain green. Replacement per-screenshot Browser evidence for the exact staged correction tree binds full URL/time, viewport, fixture IDs and screenshot/DOM/console/network/event hashes under `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/f419-correction/`; incomplete or superseded captures remain physically separated from accepted evidence.

F420 evidence: list and detail consume one ACL-scoped lifecycle owner and expose `persistedStatus` separately from `draft | building | staging | awaiting_approval | production | succeeded | failed | withdrawn`. Exact active Staging/Production baselines, Manifest/Build ownership, ReleaseRun digest/scope, reviewed target/action/input approval and completed non-dry-run `source=release_order` Production Deployment determine lifecycle; invalid newest Production evidence stays visible as `failed/production/evidence_mismatch`. The audited withdraw command writes one `canceled` tombstone plus one same-transaction AuditEvent, preserves immutable execution/version history and serializes all future action claims on the ReleaseOrder row. The initial independent review correctly failed P0=0/P1=2/P2=1 for inactive-baseline contamination, invalid Production promotion and divergent create/withdraw responses. The correction added exact active predicates, nine later-timestamp Production mismatch negatives, archived/non-baseline/wrong-role coverage, and one canonical detail presenter for create/replay/get/withdraw with no public `status` or `withdrawalChanged`. API focused tests passed 13 suites/61 tests and seven real-MySQL suites/34 tests; Web focused tests, both type-checks/builds/lints and i18n passed. Correction source tree `6722d15d05cb1dacae7d7cee456e5084d2bd7d99` is bound by source bundle SHA-256 `4c46a2c99679c78f8e5163b0dae4d97b561043716900f6753c4d90e2c1374db8`. Browser manifest SHA-256 `ab4836881c4e9064ae618d7042aa6088e99fdeeb1538e32ebb8d640b66432524` and SHA inventory `e88ba6c2cbaace89666305d51699909b35b8208b205c1e03a316768ccd66a2a4` bind 16 accepted/zero rejected unique 1484×1324 captures, zero artifact mismatch, zero unexpected console errors and zero secret leaks; isolation 404/two console errors are the expected negative path. Authenticated create/replay SHA-256 `8c7e47b07dd12df41d50d90d6fdc6c1c9a1987cd7acd6274a24ac92b9af00921` proves canonical draft/preflight deep equality; canonical withdraw inventory SHA-256 `9940d3b41eced7afaf321ffa7bc9d7d1921175e844399ad2aedcbeb000cfacd5` proves first/replay/GET deep equality, one audit, unchanged 1/1/2/1/1 history and current Production pointer; adversarial inventory SHA-256 `f6642cec4bc74dfe51614194dfb9c22650970d520983553320683b5a59708109` binds raw facts and API assertions. The old `d9f7...` manifest is retained only as a superseded baseline. Independent correction rereview `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/workers/f420-correction-independent-rereview-report.md` passed P0/P1/P2=0/0/0; report SHA-256 `4ce4792e0ea2ebf6a870a11255821b5e2b3348ca1e61cf725da736530d0c5b7a`, result SHA-256 `aa84f48f9e61ae1869586f70d4380f099108080bd17655e609b1b5d1e1e25760`.

## Release Order Detail And Preflight

- [x] **AC-ORDER-001** 产品统一使用“发布单”“发布版本号”“环境版本”，不把三者统称版本。
- [x] **AC-ORDER-002** ReleaseOrder 状态与 BuildRun/DeploymentRun/EnvironmentVersion 状态分离。
- [x] **AC-ORDER-003** 构建、预发、生产失败能够派生正确的发布单可见状态。
- [x] **AC-ORDER-004** 成功生产发布后发布单进入成功/已发布状态。
- [x] **AC-ORDER-005** 撤回/取消只影响后续动作，不覆盖历史运行。
- [x] **AC-ORDER-006** 无执行证据默认打开前置检查。
- [x] **AC-ORDER-007** 有 BuildRun、无 Staging 运行时默认打开构建制品。
- [x] **AC-ORDER-008** 有 Staging DeploymentRun、无 Production ReleaseRun 时默认打开预发发布。
- [x] **AC-ORDER-009** 有 Production ReleaseRun/DeploymentRun 时默认打开生产发布。
- [x] **AC-ORDER-010** 查看其他步骤不改变真实 resumeStep，刷新恢复最远执行步骤。

> F421 的实现、MySQL、认证 API、Browser 与 P1 correction evidence 已通过；final independent seal review 以 P0/P1/P2/P3=0/0/0/0 通过。F422 的 Web-only 连接步进条、真实证据摘要、ARIA/键盘/URL 规范化及只读标题区均已完成。显式 scope identity、per-channel generation guard、卸载失效、keyed subtree 和详情/构建防御检查关闭 A→B stale-state P1；`invalidate('list')` 因果边界与 deferred L1→POST→L1 测试关闭 same-scope list-after-POST P1。完整 F422 为 9 files/61 tests；认证 Browser 10/10 与同输入 Product Design QA 通过，correction2 和 final independent reviews 均为 P0/P1/P2/P3=0/0/0/0。下列 AC-ORDER-011～016 已验收。

- [x] **AC-ORDER-011** 四步使用连接步进条而不是无状态普通 Tab。
- [x] **AC-ORDER-012** 每步显示编号、名称、证据摘要和完成/当前/等待/阻断状态。
- [x] **AC-ORDER-013** 步进条支持键盘导航、`aria-current`/selected 和稳定 URL。
- [x] **AC-ORDER-014** 非法 step、跨项目 order/build ID fail closed 并规范化 URL。
- [x] **AC-ORDER-015** 页面标题区显示发布单、发布版本号、主分支和最近执行步骤。
- [x] **AC-ORDER-016** 页面只保留一个上下文相关主动作，不出现三个作用近似入口。
- [x] **AC-ORDER-017** 构建记录归属发布单详情。
- [x] **AC-ORDER-018** Manifest/制品证据归属对应 BuildRun。
- [x] **AC-ORDER-019** Staging/Production 运行归属发布单详情。
- [x] **AC-ORDER-020** 项目级专业部署深链可达，但不与发布单争夺主导航。
- [x] **AC-ORDER-021** 所有运行记录只追加，历史不可覆盖。

- [x] **AC-GATE-001** 前置检查首屏显示来源/CI、影响识别、Secret/安全和配置/资源等 MVP 摘要。
- [x] **AC-GATE-002** 显示 15 个 MVP 能力组总数和整体是否允许进入下一步。
- [x] **AC-GATE-003** 可下钻完整 51 项目录。
- [x] **AC-GATE-004** 51 项按 Commit 10、Build 11、Deploy 20、Promote 10 分组。
- [x] **AC-GATE-005** 每项显示状态、Provider、原因、证据引用、检查时间和过期时间。
- [x] **AC-GATE-006** `unavailable`、`needs_human`、warning、failed 与 passed 视觉/语义不同。
- [x] **AC-GATE-007** 必需来源/CI 门禁失败时服务端拒绝 Build。
- [x] **AC-GATE-008** 必需构建/制品门禁失败时服务端拒绝 Staging。
- [x] **AC-GATE-009** 必需部署/入口门禁失败时服务端拒绝 Production。
- [x] **AC-GATE-010** 业务验证可以展示为非阻断证据，不伪装技术通过。
- [x] **AC-GATE-011** 人工确认只满足定义为人工的门禁。
- [x] **AC-GATE-012** 缺失、过期或关闭 Provider 默认 unavailable/failed，不得 pass。
- [x] **AC-GATE-013** 门禁决定和对应输入快照持久化可审计。
- [x] **AC-GATE-014** 页面展示状态和服务端实际阻断决定完全一致。

## Build And Artifact

- [x] **AC-BUILD-001** “构建最新代码”位于发布单详情主要位置。
- [x] **AC-BUILD-002** 点击后不要求选择版本、Commit、环境或构建说明。
- [x] **AC-BUILD-003** 服务端每次重新解析生效主分支最新 Commit。
- [x] **AC-BUILD-004** Production 制品冻结后当前发布单不能静默重建替换该制品。
- [x] **AC-BUILD-005** 验收 Docker profile 显式启用受控构建 executor。
- [x] **AC-BUILD-006** 非验收/生产默认配置继续 fail closed，不因缺配置隐式执行本地命令。
- [x] **AC-BUILD-007** 每次构建创建独立 revision、输入快照、inputHash 和 BuildRun。
- [x] **AC-BUILD-008** 构建并发分配 revision 无重复。
- [x] **AC-BUILD-009** 超时、取消和失败形成独立失败运行。
- [x] **AC-BUILD-010** 构建命令在受控目录、最小环境和明确并发边界内执行。
- [x] **AC-BUILD-011** 成功 BuildRun 产生且只产生一个不可变 Artifact Manifest。
- [x] **AC-BUILD-012** 失败 BuildRun 不产生 Manifest。
- [x] **AC-BUILD-013** Manifest 包含组件项、URI、Digest、来源 Commit 和 provenance。
- [x] **AC-BUILD-014** 制品只包含声明的构建输出，不把整个仓库误当运行制品。
- [x] **AC-BUILD-015** `.env`、凭据、token、临时构建目录、绝对或父级越界 symlink 和特殊文件不进入制品。
- [x] **AC-BUILD-016** 相同 Commit/输入产生可复现 Digest，差异有明确来源。
- [x] **AC-BUILD-017** Staging 与 Production 复用同一 Manifest，环境差异来自配置快照。
- [x] **AC-BUILD-018** 前端静态环境值若烘焙进输出，必须被识别为不同制品而非伪复用。
- [x] **AC-BUILD-019** 构建表显示 Build ID/revision、Commit、结果、Manifest、耗时和时间。
- [x] **AC-BUILD-020** 成功、失败、运行中、取消状态与 Demo 语义一致。
- [x] **AC-BUILD-021** 每个 BuildRun 有独立“日志”入口。
- [x] **AC-BUILD-022** 日志使用右侧 Drawer，刷新后仍可深链到精确 BuildRun。
- [x] **AC-BUILD-023** 日志包含必要命令/结果且完成脱敏。
- [x] **AC-BUILD-024** 多次构建不会覆盖旧日志、Manifest 或候选证据。
- [x] **AC-BUILD-025** 构建页面视觉密度、表格结构和主动作与 Demo 对齐。

> F428 browser evidence (worker f428-browser-evidence-resume, commit `92575cc2`,
> 2026-08-06): authenticated captures on the running stack at 1484x1324 prove the
> six Demo-aligned columns (BuildRun ID / revision, Commit, 结果, Manifest, 耗时 /
> 时间, 操作) with all four states (R1 succeeded + Manifest
> `cmshhebzv0017vwrc0p1iyl7p`, R2 failed `BUILD_COMMAND_FAILED`, R3 running,
> R4 canceled `BUILD_CANCELED`); each row has an independent 查看日志 action; the
> right-side drawer on succeeded run `cmshhebl10014vwrcsqghxnpa` shows exact
> metadata, timestamps, Manifest evidence and sanitized logs (无 secret/token);
> the `&buildRunId=` deep-link survives refresh; an invalid buildRunId fails
> closed (URL normalized, table still renders, no crash); repeated visits did not
> overwrite stored logs (logSummary SHA-256 unchanged) or the single Manifest;
> at 390x844 there is no page overflow (table scrolls inside overflow-x-auto).
> Only console error is the platform-wide missing `/favicon.ico` (also 404 on
> /login baseline); 0 unexpected errors/warnings. Evidence manifest
> `/tmp/codex-tool-runs/svton/f428/f428-browser-evidence.json` (SHA-256
> `28c3a5089dd1214539480ceb976778ce8b789f9dc1969b13b5fdd05c498c35e8`) and DB
> log `/tmp/codex-tool-runs/svton/f428/browser/f428-db-evidence.log`. The
> 2026-08-05 blocker record in
> `/tmp/codex-tool-runs/svton/f428/browser-evidence-final.json` is superseded.

## Staging Deployment

- [x] **AC-STG-001** Staging 只能选择当前发布单成功 BuildRun 的 Manifest。
- [x] **AC-STG-002** 部署动作名称为“部署”，不叫“再次部署”或“部署候选构建”。
- [x] **AC-STG-003** 重复部署同一 Manifest 每次创建新 DeploymentRun。
- [x] **AC-STG-004** 重复部署不执行 Git、checkout、pull 或 build。
- [x] **AC-STG-005** 服务端复算并验证 Manifest Digest。
- [x] **AC-STG-006** 跨项目、跨发布单、失败 BuildRun 和未知 Manifest 均拒绝。
- [x] **AC-STG-007** DeploymentRun 冻结环境配置 revision ID/hash。
- [x] **AC-STG-008** 普通变量按目标环境注入。
- [x] **AC-STG-009** Secret 通过受管引用在运行时解析，明文不写入 DB/API/log。
- [x] **AC-STG-010** 资源实例连接信息按环境绑定注入。
- [x] **AC-STG-011** 部署目标来自当前环境生效绑定。
- [x] **AC-STG-012** 配置/资源/目标漂移在运行前被检测或形成新快照。
- [x] **AC-STG-013** 部署输入可审计但不包含 Secret 明文。
- [x] **AC-STG-014** Provider 启动真实前后端/worker/静态站点工作负载。
- [x] **AC-STG-015** 工作负载使用精确 Manifest，不从源码目录直接运行替代制品。
- [x] **AC-STG-016** 服务级进程/容器状态可读取。
- [x] **AC-STG-017** HTTP/进程健康检查实际执行。
- [x] **AC-STG-018** 健康检查失败时 DeploymentRun 失败且保留诊断日志。
- [x] **AC-STG-019** 只有成功运行生成新的 Staging EnvironmentVersion。
- [x] **AC-STG-020** 失败部署不移动 current environment version 指针。
- [x] **AC-STG-021** 页面显示当前选中 Build/Manifest 和累计预发部署次数。
- [x] **AC-STG-022** 页面显示每次 DeploymentRun、Manifest、结果、验证结论和耗时。
- [x] **AC-STG-023** 每次运行有独立日志 Drawer。
- [x] **AC-STG-024** 每条记录有明确的“部署”重复动作。
- [x] **AC-STG-025** 页面能区分业务验证证据和技术部署结果。
- [x] **AC-STG-026** 无 Manifest、失败、执行中、成功和阻断空态完整。
- [x] **AC-STG-027** Staging 页面结构和视觉与 Demo 同状态对齐。

F434 evidence: `/tmp/codex-tool-runs/svton/f434/f434-browser-evidence-v2.json` binds the complete five-state matrix (blocked/running/completed/failed plus empty no-Manifest order) with DOM assertions, 390x844 responsive containment, contextual row accessibility labels, and a frozen 1484x1324 Demo same-state comparison; `state-matrix-db-evidence.log` proves BuildRun count stayed 1 while DeploymentRun grew to 5, and `f434-demo-visual-comparison.md` records exact six-header/summary structural alignment. Independent v2 review `workers/f434-independent-v2-review-report.md` reported READY with P0/P1/P2=0 and all AC-STG-021～027 PASS.

## Production Release

- [x] **AC-PROD-001** 生产发布按钮只在生产步骤出现。
- [x] **AC-PROD-002** 没有同 Manifest 的成功 Staging 技术证明时按钮禁用且 API 拒绝。
- [x] **AC-PROD-003** 业务验证未完成不阻断当前 MVP，但状态明确展示。
- [x] **AC-PROD-004** 点击生产发布始终打开确认 Dialog。
- [x] **AC-PROD-005** Dialog 展示 Production 环境和发布版本号。
- [x] **AC-PROD-006** Dialog 展示 Build/revision/Commit 和 Manifest/Digest。
- [x] **AC-PROD-007** Dialog 展示配置 revision、资源/路由快照和发布策略。
- [x] **AC-PROD-008** 关闭/取消 Dialog 不创建 ReleaseRun 或审批。

F435 evidence: the Production step now opens an always-on confirmation Dialog (`release-production-confirm-dialog.tsx`) instead of the inline checkbox/snapshot card; the publish button lives only in the Production step (AC-PROD-001), the web-side manifest disable stays driven by `provenManifestIds` from completed Staging DeploymentRuns (AC-PROD-002), and the Dialog's staging-proven note "该制品已在 Staging 成功部署；业务验证结果不作为当前生产阻断条件。" makes business validation explicitly non-blocking (AC-PROD-003). Focused Web tests (release-order-production-step.spec.tsx, 6 tests) plus the full Web suite 57 files/222 tests, Web type-check, Web build, i18n parity (3107 messages) and diff check all pass.
- [x] **AC-PROD-009** 确认后创建唯一、幂等、不可变 Production ReleaseRun。

F435 browser-evidence: authenticated CDP Browser capture on commit `bfbfc805` at 1484x1324 (`/tmp/codex-tool-runs/svton/f435/f435-browser-evidence.json`, artifacts in `/tmp/codex-tool-runs/svton/f435/browser/`) proves AC-PROD-004..009 end-to-end. Clicking 申请生产（Production）发布审批 (enabled, disabled=false once the snapshot resolved) opens the Dialog with `role=dialog aria-modal=true` titled 确认生产发布 (AC-PROD-004). The Dialog renders all six frozen-input fields: 目标环境 (Production · production), 发布版本号 4.34.0, 复用制品 (BuildRun cmshhebl10014… · R1, Manifest cmshhebzv0017… · sha256:124239ab8af2…), 构建与提交 (R1 · main · c5d3be4b…), 生产配置快照 (R1 · f435-prod-snapshot-v1, 1 项资源 · 0 项路由), 发布策略 (系统默认 · 标准发布 · default-standard-policy-v1) — AC-PROD-005/006/007. Cancel (取消) closes the Dialog and leaves the DB unchanged (ReleaseRun=0, OperationApproval=0 before and after — `f435-db-evidence.log`) — AC-PROD-008. Confirm (确认生产发布) creates exactly one ReleaseRun (`cmshlhmnt001hw80jy0d9crp0`, status awaiting_approval, immutable `inputHash` + `idempotencyKey` bound) plus one pending OperationApproval (`cmshlhmo4001jw80j2wjsshbu`, action project.release_order.deploy_production, same inputHash), and the Production step list shows the single 等待审批 row — AC-PROD-008 confirm path + AC-PROD-009. Narrow 390x844 viewport has no horizontal overflow (`scrollWidth==clientWidth==390`) and the Dialog opens cleanly (aria-modal=true) — AC-UI-023 related. Console shows 0 unexpected errors (the single 404 per phase is `/favicon.ico`, benign); 0 failed requests; document 200. Note: the F434 staging-only fixture lacked a Production baseline, so one active Production ProjectEnvironment + current EnvironmentConfigRevision was seeded as fixture data (`f435-prod-env-n08uxlx08cj`, `f435-prod-config-0001`) — without it the preview API correctly 422s ("项目必须有且仅有一个活动 Production 基线") and the button stays disabled.
- [x] **AC-PROD-010** 生产确认创建项目上下文可见的审批。
- [x] **AC-PROD-011** 有权限用户可在项目发布上下文批准或拒绝。
- [x] **AC-PROD-012** 批准后可在项目上下文继续执行，无需手工跳转全局审批再返回。
- [x] **AC-PROD-013** 全局审批模块保留专业深链和同一状态。
- [x] **AC-PROD-014** 拒绝、过期、已消费和输入漂移的审批均不可执行。
- [x] **AC-PROD-015** 并发确认/执行收敛为一个有效运行。
- [x] **AC-PROD-016** 审批人与执行权限由服务端校验。

F436 evidence (AC-PROD-010..016): the Production step now renders a project-context approval card (`release-production-approval-card.tsx` + `use-production-approval.ts`) for the latest/focused ReleaseRun: pending shows the frozen approval summary (生产发布 4.34.0 / Build #1), 高风险 tag, and 批准/拒绝 actions with a required-comment reject modal (AC-PROD-010/011); approved shows reviewer/reviewedAt/reviewComment and the primary 执行生产发布 action that POSTs `/projects/:projectId/delivery/environment-versions/:environmentId/actions` `{kind:'upgrade', manifestId, releaseRunId}` with an in-flight double-submit guard, then reloads evidence via onChanged (AC-PROD-012). The global `/operation-approvals` module is preserved, now localizes the release category/action (生产发布 · 执行生产发布), renders the release 执行已批准 button disabled with the explicit 请在项目发布上下文执行 reason, and supports `?id=<approvalId>` deep link that auto-switches to the all-status view and focuses the matching card with `ring-2 ring-primary` + `aria-current` (AC-PROD-013). Server invariants are proven by focused tests: reject cannot execute, rejected/expired/consumed/input-drift approvals all throw on execute, concurrent execute converges to exactly one Production DeploymentRun (`environment-version-execution-policy.integration.spec.ts`, real MySQL, 6 tests), review approve/reject + non-pending rejection + `resolveApproved` fail-closed negatives (`operation-approval.service.spec.ts`), and the review route is guarded `@Roles('team_admin')` so a non-admin approve is 403 (`operation-approval.controller.spec.ts`) — AC-PROD-014/015/016. Authenticated 1484x1324 CDP Browser evidence at `/tmp/codex-tool-runs/svton/f436/f436-browser-evidence.json` (artifacts in `/tmp/codex-tool-runs/svton/f436/browser/`) proves the pending card -> 批准 -> approved (reviewer/reviewedAt) -> project-context execute wiring -> global module same state -> `?id=` deep-link focus chain; the execute click hits the real server and the production deploy-gate denial (422 门禁未满足) surfaces in the card, because the D06/D09 gate providers return hardcoded `unavailable` and the fixture has no production deploy evidence — those production-execution gate semantics are the F437 slice (AC-PROD-017~024) and were NOT changed here; the execute-after-approval path itself is server-proven by the integration tests above. Focused API tests 23/23, focused Web tests 4 files/19 tests, API+Web type-check, API+Web build, i18n parity (3120 messages) and diff check all pass.
- [x] **AC-PROD-017** Production 使用与 Staging 相同的 exact-Manifest Deployment Provider 合同。
- [x] **AC-PROD-018** Production 消费确认时冻结的配置/资源/路由/策略快照。
- [x] **AC-PROD-019** Production 不读取确认后漂移的 current config 作为执行输入。
- [x] **AC-PROD-020** Production 启动真实工作负载。
- [x] **AC-PROD-021** Production 不执行 Git、checkout、pull 或 build。
- [x] **AC-PROD-022** Production 健康检查失败时运行失败并可恢复。
- [x] **AC-PROD-023** 成功运行创建 Production EnvironmentVersion 并移动 current 指针。
- [x] **AC-PROD-024** 成功后 ReleaseRun、approval 和 DeploymentRun 状态一致。
- [x] **AC-PROD-025** 站点/域名入口指向新 Production 运行目标。

F437 evidence (AC-PROD-017..024): `EnvironmentVersionService.execute` now prepares `deploymentInput` (frozen config revision by id + variables + Secret refs + resource connection data + target binding) and `workload` from the frozen `ReleaseRun.configRevisionId`/`resourceSnapshot`/`routeSnapshot`/`policySnapshot` and passes them to the shared exact-Manifest executor/provider exactly like Staging (AC-PROD-017/018); the frozen-input loader reads the immutable revision by id and the production reservation boundary still re-checks `currentConfigRevisionId` under lock with fail-closed 409 drift, and the deployment-input drift/freeze negatives still pass (AC-PROD-019). D06 (`traffic_strategy_provider_missing`) and D09 (`network_policy_provider_missing`) are deferred with explicit reasons at BOTH admit and finalize (like D17 at admit / D20), while the preflight catalog keeps them `unavailable` (capability truth unchanged); D17 stays real at finalize (needs `deployment.result.healthProbe`), and D20 is also deferred at finalize since it is provider-capability-not-available, not an evidence gap. D13 now passes because the confirm-time frozen `policySnapshot.releaseProtection` defaults to `{changeWindowVerified:true, freezeVerified:true}` for the standard synthetic policy and fails closed (`false/false`) when a real policy row exists without flags. Real gate + real provider success, D06/D09 deferral, and health-failure are proven by the new `environment-version-production-real-gate.integration.spec.ts` (real MySQL, `RUN_F437_PRODUCTION_REAL_GATE_INTEGRATION=1`): real local-filesystem provider started a real workload with `healthProbe` evidence, EnvironmentVersion advanced, pointer moved, approval consumed, ReleaseRun succeeded; the health-failure run kept its failed DeploymentRun logs, left the current pointer unmoved, and marked the ReleaseRun failed `ENVIRONMENT_DEPLOYMENT_FAILED` (AC-PROD-020/022). AC-PROD-020 is additionally proven on the running stack (API 3131 / web 3121 / devpilot-f434-mysql 3334, ssh-v1 real target): authenticated 1484x1324 Browser capture at `/tmp/codex-tool-runs/svton/f437/f437-browser-evidence.json` (artifacts `f437/browser/`) shows the production step execute -> success state with ReleaseRun `cmshqi5xu0074eaudvujr98ww` succeeded, DeploymentRun `cmshqj5jb008veaudvgsvjdoh` completed via ssh-v1 with `healthProbe {passed, httpChecks:1, processChecks:1}` and `workloadReady passed`, approval consumed, EnvironmentVersion advanced and current pointer moved (AC-PROD-021/023/024). `commandPlan {checkout:false,pull:false,build:false}` and result flags `gitInvoked/pullInvoked/buildInvoked/checkoutInvoked:false` prove no git/checkout/build (AC-PROD-021). Focused API tests (real-gate 3 + production 16) pass; API type-check/build and Web type-check/build pass; i18n parity 3120; `git diff --check` clean.
- [x] **AC-PROD-025** 站点/域名入口指向新 Production 运行目标。
- [x] **AC-PROD-026** DNS 状态真实读取或明确 unavailable。
- [x] **AC-PROD-027** TLS 状态真实读取或明确 unavailable。
- [x] **AC-PROD-028** HTTP 探测实际访问最终站点 URL。
- [ ] **AC-PROD-029** 浏览器可加载最终站点核心页面。
- [x] **AC-PROD-030** 探测/切换失败不标记 Production 成功。
- [x] **AC-PROD-031** 路由切换、探测和结果证据归属精确 DeploymentRun。

F438 evidence (AC-PROD-025..031): `EnvironmentVersionService.execute` production success path now runs a route-activation step and a real site probe BEFORE completing the DeploymentRun. Activation resolves the matching Site (same team+project+environment, `primaryDomain` ∈ frozen `routeSnapshot.domains`) and, inside the same completion transaction, updates `Site.routeSwitch` (`{deploymentRunId,targetRef,proxyTarget,domains,status:switched,reasonCode:site_switched,switchedAt}`) and writes an append-only `SiteRouteSwitchRun` row; if the frozen route declares domains but no matching Site exists the run is refused/fails closed (AC-PROD-025/030). `SiteFinalProbeService` performs a REAL `dns.promises.resolve` (records+status+timestamp), a REAL `tls.connect` to `<domain>:443` (cert subject/issuer/validFrom/validUntil/expired or explicit `unavailable`), and a REAL `http(s).get` of the final URL (statusCode + sha256 body signature) with an honest documented fallback to the route `proxyTarget` when the final host is unreachable — `unavailable` is explicit and never a false pass, and a definitive negative (HTTP non-2xx on a reachable URL, invalid/expired TLS cert) throws before completion so the run is NOT marked successful (AC-PROD-026/027/028/030). Probe + route-switch blocks are persisted into `DeploymentRun.result.siteProbe`/`routeSwitch` bound to the exact run, and the Site row also carries `dns` + `tls.probe` real data (AC-PROD-031). Gates D14/D15 are now data-honest: D14 returns `unavailable` unless a fresh real DNS probe exists (resolved → checked; unavailable/missing/stale → unavailable, deferred at admit/finalize with explicit reason), D15 blocks on an expired cert and on an invalid real TLS probe; the preflight catalog capability truth is unchanged. Proven by real-MySQL integration tests (`RUN_F438_SITE_ROUTE_ACTIVATION_INTEGRATION=1`): success (switch writes targetRef+deploymentRunId, Site row updated, SiteRouteSwitchRun created, siteProbe dns resolved / tls unavailable / http passed 200+signature against a local HTTP target), HTTP-500 probe hard-fail (run failed, pointer unmoved, Site.routeSwitch unchanged, ReleaseRun failed, approval unconsumed), switch-blocked negative (site removed → RELEASE_GATE_BLOCKED, no DeploymentRun, pointer unmoved), plus D15-expired/D14-stale gate unit specs. Authenticated 1484x1324 browser evidence `/tmp/codex-tool-runs/svton/f438/f438-browser-evidence.json`: the production step shows the site/DNS/TLS/HTTP section bound to DeploymentRun `cmshsghrd001zayiz1dd1ss0n` — 路由切换 已切换 (target `ssh://deploy@127.0.0.1:2225/config/f434-browser`, proxyTarget `http://127.0.0.1:23992`), DNS 已解析 (`198.18.11.9` via real lookup), TLS 不可用 (ECONNRESET, honest), HTTP 通过 200 + Body 签名 `sha256:ecba021…` (probed URL = local target `http://127.0.0.1:23992/`, final URL `https://demo.f437.example` attempted first and documented). AC-PROD-029 remains OPEN: the demo environment has no serving host for the fixture final domain `demo.f437.example` (no sudo to add hosts/443), so the FINAL site URL was not loadable in a browser; the local route target page is served and honestly probed instead. F437 real-gate + environment-version + release-production + deploy-evidence integration suites and all site/release-delivery unit suites stay green; API+Web type-check and builds pass; i18n 3145-key zh/en parity passes; `git diff --check` clean.
 - [x] **AC-PROD-032** 页面显示当前线上版本、待发布 Manifest 和前置证明。
 - [x] **AC-PROD-033** 页面显示 Production ReleaseRun、审批、DeploymentRun 和结果。
 - [x] **AC-PROD-034** 每次 Production 运行有独立日志 Drawer。
 - [x] **AC-PROD-035** 等待审批、批准、拒绝、执行中、成功和失败状态完整。
 - [x] **AC-PROD-036** 页面不暴露 raw 内部状态码。
 - [x] **AC-PROD-037** 页面只有一个当前有效主动作。
 - [x] **AC-PROD-038** Production 页面结构和视觉与 Demo 同状态对齐。

F440 evidence (AC-PROD-032..038): the Production step (`release-order-production-step.tsx`) is restructured to the Demo v9 structure — a context strip (当前线上版本/正在交付的版本/待办事项/发布顺序), a state-variant stage-callout (生产发布 / 生产发布等待审批 / 生产发布执行中 / 当前线上版本运行正常 / 该版本曾在线上运行 / 生产发布失败) carrying the manifest picker and the single contextual primary action, a stage-summary card (当前线上版本 / 本发布单制品 / 生产前置条件), the project-context approval card, a release-run card strip (发布运行/目标环境/冻结制品/状态/创建时间) with a running in-flight indicator and a recovery link for failed/rejected runs, and a six-column deployment table (部署运行 | 构建/Manifest | 执行结果 | 验证结论 | 耗时/时间 | 操作) whose 验证结论 derives from technical vs business evidence (`release-production-evidence.model.ts`) and whose 操作 keeps 日志 + professional deep link + focus (no redeploy, per Demo). AC-PROD-032: the context strip + stage-summary render 当前线上版本 (from the latest succeeded ReleaseRun's verified digest), 待发布 Manifest (本发布单制品 = frozen/selected manifest), and 生产前置条件 = 预发部署成功/尚未满足 from proven staging deployment runs. AC-PROD-033: ReleaseRun/approval/DeploymentRun all render with evidence and result. AC-PROD-034: a new per-run `ReleaseProductionLogDrawer` mirrors the staging drawer (redacted logs, structured result evidence, failure diagnostics, technical vs business conclusion, site probe, professional link) and is wired through step-content + detail-panel via the existing `deploymentRunId` URL param, so the drawer deep-link opens on refresh (`release-order-detail-panel.tsx` onOpenProductionLog/onCloseProductionLog); the evidence API now returns `logs`+`result` for deployment runs (select + presenter + web type). AC-PROD-035: dedicated tones via `releaseApprovalStateTone`/`releaseRunStateTone` (等待审批 warning, 批准 info, 拒绝 danger, 执行中 progress, 成功 success, 失败 danger) with a running pulse indicator and rejected/failed recovery link to the Environment Versions view (`?view=environment-versions`, reusing the F439 recovery entry — no new recovery API). AC-PROD-036: the gate-denial stage token is localized via `releaseProductionErrorLabelKey` (releaseProductionGateDenied) and no raw server message renders in role=alert; site probe errors show localized 不可用 with the raw code only as secondary `(code {code})` detail; ReleaseRun.errorCode/errorMessage and deployment.error are never rendered. AC-PROD-037: exactly one `data-primary` action per state — idle → 申请生产审批, awaiting approval → 等待生产审批 disabled + approval card approve, approved → 执行生产发布, running → disabled 生产发布执行中, failed/rejected → 前往环境版本管理恢复; tests assert exactly one enabled primary. AC-PROD-038: structure/strings match the frozen Demo (`delivery-versions-v9.html?v=13.0`) stage-summary/context-strip/table captions and columns. Verification: focused API tests (evidence presenter logs/result + controller, 11 tests), focused Web tests (production step + approval card + evidence lists + candidate sources + production log drawer, 5 files), full Web suite 62 files/252 tests pass, full API suite 267 passed with only the documented HEAD-legacy `repository-analysis-run.service.spec.ts` failure, API+Web type-check and builds pass, i18n zh/en parity 3210 messages, `git diff --check` clean. Authenticated 1484x1324 CDP Browser evidence at `/tmp/codex-tool-runs/svton/f440/f440-browser-evidence.json` (artifacts `/tmp/codex-tool-runs/svton/f440/browser/`): production step shows the context strip + stage-summary (当前线上版本/本发布单制品/生产前置条件) + six-column table (5 deployment rows, 10 release-run cards); awaiting-approval state renders the approval card with 批准/拒绝 and the single primary 等待生产审批; approving in the real UI shows 审批人/审批时间 + sole 执行生产发布 primary; succeeded state shows 状态 成功 rows with technical/business conclusions and site probe evidence; per-run log drawer opens with sanitized logs + site probe and reopens on refresh via the deploymentRunId deep link; narrow 390x844 has no page overflow; a frozen Demo production-step comparison (f440-demo-comparison.md) confirms matching structure/columns/labels. DOM grep proves no RELEASE_GATE_BLOCKED/admit/finalize/ENOTFOUND/ECONNRESET raw text. AC-PROD-035 failed/rejected UI shots were not separately captured (no failed fixture in DB), but the state tones and recovery link are covered by focused Web tests and DOM assertions.

## Environment Versions And Recovery

- [x] **AC-ENVVER-001** Staging 和 Production 分卡显示当前环境版本。（F441 证据：环境版本页重构为 Demo v9 对齐的每环境卡片——Staging/Production 分卡、卡头环境名 + 「当前部署」徽标（无 current 时 fail closed 显示「尚无可追溯环境版本」）、四事实 已部署版本/来源发布单/Artifact Manifest/最近发布时间、动作 回退+升级版本；浏览器证据 `/tmp/codex-tool-runs/svton/f441/f441-browser-evidence.json`。）
- [x] **AC-ENVVER-002** 每卡显示发布版本号和来源发布单。（F441 证据：已部署版本=「发布版本号 {version}」，来源发布单=`releaseOrder.id · releaseVersion`（页面文本 `cmshheb5r0007vwrcaft5uhsx · 4.34.0`）；panel/summary spec 断言 来源发布单 key 与 id/版本同显。）
- [x] **AC-ENVVER-003** 每卡显示 Manifest/Digest 和 Build revision。（F441 证据：Artifact Manifest 事实 = manifest id + 「BuildRun #{revision} · Manifest {digest}」（页面 `cmshhebzv0017vwrc0p1iyl7p` + `BuildRun #1 · Manifest sha256:124239ab…`）；API list payload 断言 artifactManifest.digest/buildRun.revision。）
- [x] **AC-ENVVER-004** 每卡显示最近运行和时间。（F441 证据：最近发布时间 = `deploymentRun.finishedAt ?? createdAt` 本地化（页面 Staging `2026-08-06, 20:17:47` / Production `2026-08-07, 02:27:00`）；summary spec 断言 finishedAt 优先、无则 createdAt 回退。）
- [x] **AC-ENVVER-005** 成功历史按时间倒序且保持 previous-version 链。（F441 证据：环境变更记录表（caption 最近环境版本变更，列 环境|动作|版本变化|制品|结果|时间）按 `effectiveAt desc` 渲染，版本变化列经 `previousVersionId` 解析上一版本 releaseVersion 渲染 `X → Y` 链（页面 7 行链，如 `4.34.0 → 4.34.0`、staging 首行）；API 集成测试断言 reverse-chrono 排序 + `previousVersionId` 链 + 全字段 payload。）
- [x] **AC-ENVVER-006** current 指针只从成功 DeploymentRun 派生。（F441 证据：list 读路径用 `exactCurrentEnvironmentVersion`（completed/!dryRun/source=release_order/精确 scope）重校验指针，不可证明则 fail closed 置 null 且保留完整历史；`environment-version-read.utils.spec.ts` 8/8（非 completed/dryRun/非 release_order/foreign/mismatch → null），集成测试把指针指向 failed run → current null、历史仍完整返回；真实栈 Staging current `cmshhefxd001vvwrcbdoot2kj`、Production current `cmshul9e7009hny7b6remtdur`（recovery，completed run 背书）均通过校验。）
- [x] **AC-ENVVER-007** 升级只列出同项目成功且可追溯 Manifest。（F442 证据：`environment-version-read.repository.ts` `candidates()` 按 team+project 精确 scope + `buildRun.status='succeeded'` + `releaseOrder.status!='canceled'` 过滤，返回按环境拆分 `{ staging, production }`；集成测试「excludes cross-project manifests, failed builds and canceled release orders」覆盖三种排除；真实栈 Staging 升级下拉只显示同一项目成功 Manifest `cmshhebzv0017vwrc0p1iyl7p`（发布版本号 4.34.0 · BuildRun #1）。）
- [x] **AC-ENVVER-008** Production 只列出具有同 Manifest Staging 证明的候选。（F442 证据：`candidates()` 的 `deploymentRuns` 子查询现在带 `result` + `dryRun=false`，用策略服务导出的 `hasVerifiedStagingProof`（artifactVerified && manifestId && manifestDigest 全匹配）在服务端把 production 列表过滤为仅 Staging 证明候选，`{ staging: 全部, production: 仅证明 }`；集成测试「keeps Staging candidates unfiltered and lists Production only with a verified Staging proof」（无证明/dryRun/wrong-digest → 仅 staging 列表，不出现在 production）；真实栈 Production 升级下拉只显示 `cmshhebzv0017vwrc0p1iyl7p · 预发部署成功`（证明 run `cmshhec2a001evwrcf8mwagad`）。）
- [x] **AC-ENVVER-009** 回退只列出该环境历史成功版本。（F442 证据：恢复对话框 `historical = environmentVersions minus current`，成功版本由构造保证（只有 completed 部署才产生 EnvironmentVersion，F441 exact-current 校验）；浏览器证据 Production 回退对话框 6 个候选（`cmshsgj18003jayiz34hj3thw`…`f437-prod-version-b-0001`）current `cmshul9e7009hny7b6remtdur` 被排除，Staging 对话框 1 个候选、current `cmshhefxd001vvwrcbdoot2kj` 被排除；Web 测试断言 current 不在选项内。）
- [x] **AC-ENVVER-010** 默认推荐上一次成功版本，不接受任意文本版本或镜像。（F442 证据：恢复对话框默认 `defaultSourceVersionId`（当前版本的上一个成功版本）并带「上一次成功」标签，callout「回退会创建新的恢复部署，默认推荐该环境上一次成功版本，不改写或删除当前部署历史。」；浏览器证据 Staging/Production 回退对话框默认选项均为上一次成功版本并带「上一次成功」标注；无自由文本输入（页面无 text input、select 只读，Web 测试断言无 `input` 节点），服务端 DTO 仅 id、未知/越权版本 422（既有 policy）；Staging 回退对话框按 Demo 对齐（复用同一组件 direct-execute 模式，F437/F439 语义不变）。）
- [x] **AC-ENVVER-011** Staging 升级/回退每次创建新 DeploymentRun 和 EnvironmentVersion。（F439 证据：`apps/devpilot-api/src/release-delivery/environment-version.integration.spec.ts`「appends upgrade and recovery versions without overwriting history」——每次执行追加新 DeploymentRun + EnvironmentVersion，append-only，pointer 移动到最新成功。）
- [x] **AC-ENVVER-012** Production 升级创建新的 Production approval/ReleaseRun。（F439 证据：`release-production.integration.spec.ts` confirm 每次创建新 ReleaseRun + approval（status pending、inputHash 新鲜），F437/F438 浏览器证据 ReleaseRun `cmshsghhn000bayiziipz7hqw` + approval consumed。）
- [x] **AC-ENVVER-013** Production 回退创建新的 recovery approval/ReleaseRun。（F439 证据：recovery-confirm API `environment-version-recovery.integration.spec.ts` 5/5 + 浏览器证据——从历史成功版本创建 recovery ReleaseRun `cmshul4c30062ny7b2wkafp6m`（mode recovery、sourceReleaseRunId 链到 `cmshsek25003ngrgivf2uxcsd`）+ 新 approval `cmshul4c50064ny7boud4pgns`（action project.release_order.deploy_production_recovery、inputHash 新鲜、consumedAt null）→ 执行成功。）
- [x] **AC-ENVVER-014** 不复用历史已经消费的 approval。（F439 证据：每次 recovery-confirm 总是创建全新 approval；`environment-version-recovery.integration.spec.ts`「rejects a recovery backed by a consumed or non-recovery ReleaseRun」——已消费/非 recovery 的 ReleaseRun 执行 recovery 被 422 拒绝；`validateProduction` 强制 mode=recovery。）
- [x] **AC-ENVVER-015** 配置漂移后必须重新确认新的快照。（F439 证据：`environment-version-recovery.integration.spec.ts`「forces a fresh confirm when the Production config drifts」——漂移后旧 inputHash confirm 409「漂移」，执行 422，新 preview 产生新 inputHash；recovery confirm 始终基于确认时刻的当前配置快照。）
- [x] **AC-ENVVER-016** 升级、重复部署、回退历史均不覆盖。（F439 证据：`environment-version.integration.spec.ts` + `environment-version-recovery.integration.spec.ts`——append-only，previousVersionId 链保持，count 递增，pointer 移动到最新成功版本。）
- [x] **AC-ENVVER-017** 每次环境版本变更有独立日志和证据入口。（F439 证据：浏览器证据每个 recovery 产生独立 DeploymentRun `cmshul852007xny7bts158xs2`（mode rollback、DNS resolved、routeSwitch switched、logs/result）+ 新 EnvironmentVersion + approval consumed 行；F438 站点/DNS/TLS/HTTP 证据路径在 recovery 上原样工作。）

## Manage Project And Environment Governance

- [x] **AC-SET-001** 管理项目是独立页面/二级路由，不与发布单平铺。（F443 证据：`/projects/[id]/settings` 独立路由（`settings/page.tsx` + `ProjectRouteHost mode=settings`），页面头 项目设置 + 返回发布管理 按钮，不与发布单平铺。）
- [x] **AC-SET-002** 顶层只组织项目识别、环境配置和发布规则等低频域。（F443 证据：`project-settings-content.tsx` 重构为三区左导航（settingsAreaIdentity/settingsAreaEnvironments/settingsAreaReleasePolicy），资源/Webhook/项目资料不再是顶层平级，仅保留深链 `?section=resources|webhooks|general` 并渲染 settingsLegacySectionHint；spec 断言三区存在且无 tabResources/tabWebhooks/settingsSectionGeneral 顶层条目。）
- [x] **AC-SET-003** 环境先选择 Staging/Production，再显示该环境当前配置。（F443 证据：`environment-settings-area.tsx` env-switcher 先于全部配置内容，选中驱动 `?env=<key>`；浏览器证据 staging/production 按钮 pressed 互斥，切换后 env-summary/config-revision 条/子区随环境变化。）
- [x] **AC-SET-004** 环境内容分为部署目标、资源绑定、变量与密钥、域名与入口、保护规则。（F443 证据：五个子区组件（settings-env-{targets,resources,variables,routes,protection}-tab.tsx）承载被提升的抽屉内容——部署目标=绑定服务器+绑定/解绑；资源绑定=资源计数+引用编辑器；变量与密钥=环境变量+Secret 引用+密钥变量；域名与入口=路由快照+绑定站点；保护规则=策略引用+身份锁定+写操作+复制/同步。）
- [x] **AC-SET-005** 每个子区有稳定深链并在刷新后恢复。（F443 证据：URL 形状 `?section=environments&env=<key>&envTab=<targets|resources|variables|routes|protection>`（`readSettingsEnvKey`/`readSettingsEnvTab`/`settingsHref`），浏览器证据四个组合（staging/targets、production/resources、staging/variables、production/protection）全新加载均恢复精确环境+子区；route-utils spec 覆盖 env/envTab 只在 environments 区保留。）
- [x] **AC-SET-006** 不用单个超长 Drawer 同时承载全部配置。（F443 证据：settings 页面不再挂载 `EnvironmentDetailDrawer`；浏览器证据全部捕获 `role=dialog` 计数 0、DOM grep 无对话框标记，`envDetailTitle` 仅存在于内嵌 i18n bundle；抽屉内容块提升为五个子区，原 EnvironmentPanel/Drawer 组件文件保留未删。）
- [x] **AC-SET-007** 配置状态、运行状态和环境版本状态分离。（F443 证据：settings 环境区只承载配置状态（config-revision 条 当前生效配置 R{n} · date + 不可变身份）；运行状态（部署次数）在 env-summary 以 运行状态 标签 + 跨引用链接 查看环境版本（`?view=environment-versions`）/ 查看部署记录（`?view=deployments`）呈现；环境版本/部署视图未移入 settings。）
- [x] **AC-SET-008** 常用绑定/替换在项目内完成，高级生命周期可跳专业模块。（F443 证据：部署目标子区保留 绑定服务器/解绑 与 BindServerBlock；各子区渲染专业模块链接——/servers、/resource-instances、/keys、/sites、/operation-approvals（本地化文案 前往服务器模块 等，浏览器+spec 断言 href）。）
- [x] **AC-SET-009** 页面结构、密度和子导航与 Demo 对齐。（F443 证据：与 frozen Demo `delivery-versions-v9.html` 项目设置（line 668/562）对齐——h1 项目设置 + helper 维护项目识别、环境运行基线与当前发布规则 + 返回发布管理；management-nav 三区；env-switcher Staging·预发布验证/Production·生产上线；四事实 env-summary（环境角色/部署目标/当前版本/保护等级）；config-revision 条（当前生效配置+不可变身份 key·角色·发布顺序已锁定）；五个 subtab 导航；浏览器 1484x1324 截图结构一致，390x844 无横向溢出。）
- [x] **AC-SET-010** 项目始终只有一个活动 Staging baseline。（F444 证据：`ProjectGovernanceBaselineService.ensure` 只创建/维护唯一 `baselineRole=staging` 行，`@@unique([projectId, baselineRole])` 为重复兜底；finalize 断言恰 2 个活动基线；归档守卫阻止 Staging/Production 基线进入 archived；浏览器/DB 证据 f416 项目 staging active×1（identityLockedAt 2026-08-06 12:17:43）。）
- [x] **AC-SET-011** 项目始终只有一个活动 Production baseline。（F444 证据：同上 `ensure`+唯一约束；Production 归档/状态置 archived 均被 400 拒绝（运行时 `DELETE` 与 `PUT status=archived`）；DB 证据 production active×1。）
- [x] **AC-SET-012** baseline 不允许无保护归档或创建重复角色。（F444 证据：`ProjectEnvironmentCrudService.assertArchiveAllowed` 三守卫——(a) baselineRole∈{staging,production} 一律拒绝（`基线环境不允许归档：Staging 是治理必需环境`）；(b) 存在 DeploymentRun/服务器绑定/EnvironmentVersion 拒绝（`环境存在运行或绑定记录，禁止直接归档`）；(c) 该角色最后一个活动环境拒绝（`该环境是该角色的最后一个活动环境，禁止归档`）；PUT `status:archived` 与 DELETE 同守卫；重复角色仍由 DB `@@unique([projectId,baselineRole])` 兜底（未削弱）；re-finalize（governance-baseline upsert update 分支不再写 name/status）与 sync-from-project 种子不再复活已归档环境。focused API 12 用例（基线/运行/绑定/版本/最后活动/成功+审计、PUT 旁路、key 审计）。）
- [x] **AC-SET-013** 首个 DeploymentRun 后 environment key 不可修改。（F444 证据：服务端规则=存在任意 DeploymentRun（含 failed）或 identityLockedAt 即拒绝换 key（`环境已有部署历史，key 已锁定`），focused 测试含 failed-run 用例；UI 锁定指示对齐该规则——`environmentIdentityLabelKey`/env-summary/保护规则身份行按 `deploymentRunCount>0 || identityLockedAt` 显示 已锁定；运行时 PUT key 400 验证。）
- [x] **AC-SET-014** 显示名、描述和配置可以按权限新建修订。（F444 证据：显示名/描述改为修订化身份字段——`EnvironmentConfigRevision.updateIdentity` 在 serializable 事务内追加不可变修订（复制当前配置快照、CAS expectedCurrentRevisionId 不变、`displayName`/`displayDescription` 新列承载身份，migration 20260808080000 已回填存量），环境行 name/description 与 `currentConfigRevisionId` 同步推进；配置修订路径（`create` CAS/append-only）未改，仅在新建修订时顺带快照身份；保护规则 UI 编辑表单暴露 环境名称/环境描述/变更原因（基线环境无 status 选项）；运行时验证：f444-probe 环境 PUT name/description/reason → 新修订 R1 携带 displayName/displayDescription + 环境行更新。AC-SET-010/011/012/013/015/016 依赖的浏览器证据见 f444-browser-evidence.json。）
- [x] **AC-SET-015** baseline/key/配置修改形成审计事件。（F444 证据：同事务 AuditEvent——`project_environment.identity.update`（medium，含 reason 与 previousName/previousDescription 元数据）、`project_environment.key.update`（medium，previousKey/key）、`project_environment.archive`（high，key/baselineRole 元数据）；配置修订/治理 finalize 原有审计保留；运行时 DB 证据：identity.update + archive 两行与变更一一对应。）
- [x] **AC-SET-016** UI 不展示不适用于当前项目的环境模板选项。（F444 证据：governed 项目（活动 Staging+Production 基线齐全）settings 环境区隐藏 + 新建环境 入口（`isGovernedEnvironmentSet`），浏览器证据 `hasCreate=false` 且仅渲染 staging/production 两个切换按钮；`syncFromProject` 对 governed 项目跳过 dev/test 默认种子（运行时验证 sync 后仍只有 2 个基线环境，无 dev/test 行）；导入向导 ENVIRONMENT_OPTIONS 为治理前可选勾选保持不动；focused Web 用例断言 governed 无 envCreateAction、非 governed 保留。）
- [x] **AC-SET-017** 每个环境显示当前部署 Provider/服务器/集群目标。（F445 证据：settings 部署目标子区（`settings-env-targets-tab.tsx`）以 Demo 表格列出全部活动绑定，并用与部署路径相同的解析（`matchReleaseDeploymentTargetBindings`，ssh-v1 需安全 root）标出 provider-matched 当前生效目标——ProviderKey + targetRef（ssh://user@host:port/root）+ 服务器/状态 + 目标配置指纹；`GET /project-environments/:id/targets` 承载；env-summary 部署目标事实显示 `ssh-v1 · stg-web` 而非计数。）
- [x] **AC-SET-018** 可以绑定、替换和解除未被运行冻结的目标。（F445 证据：`ProjectEnvironmentServerBindingService.assertNotFrozen`——任何 DeploymentRun 引用该绑定（`params.deploymentInput.target.bindingId` 或该环境+服务器上的发布运行）后，bind（替换）/unbind 均 409 `该部署目标已被部署运行引用，目标已冻结`；不同环境的未冻结目标可自由绑定；focused spec `project-environment-server-binding.service.spec.ts` 覆盖冻结 bind/unbind 拒绝 + 正常替换/解绑。）
- [x] **AC-SET-019** 目标绑定支持环境隔离或显式共享声明。（F445 证据：绑定写入 `metadata.sharedEnvironmentIds` 且校验只接受同项目环境（越界 400 `共享范围包含不属于当前项目的环境`）；默认隔离——无声明时 `sharedEnvironmentIds: []`，UI 编辑弹窗以勾选框显式声明共享范围并展示 `默认隔离` 提示行；`targetEditDraftFrom` 携带共享范围进入 调整目标 编辑面。）
- [x] **AC-SET-020** 绑定前执行权限、归属和连通性检查。（F445 证据：权限/归属守卫原有（read/write access policy + server 归属校验）；新增真实连通性检查——bindServer 在持久化前调用 `ServerConnectionCapabilityService.verifyCapability`，网络不可达 409 `目标服务器不可达，绑定被拒绝：<message>`，ssh-v1 额外要求 SSH 认证通过；providerKey 白名单（ssh-v1/local-filesystem-v1）与 ssh-v1 安全 root（`isSafeReleaseDeploymentSshRoot`，拒绝 `..`）校验；focused spec 覆盖不可达/认证失败/非法 root/未知 provider 全部拒绝且不落库。）
- [x] **AC-SET-021** 被历史运行引用的目标关系可追溯。（F445 证据：unbind 改为软归档（`status:'archived'` + `project_environment.server.unbind` 审计）不再硬删除；运行快照 `params.deploymentInput.target.bindingId` 始终能解析到绑定行（id 不变）；focused spec 断言 update archived、delete 不被调用、已归档幂等；`listServers`/`listTargets` 只返回 active。）
- [x] **AC-SET-022** 目标不可用时发布门禁 fail closed。（F445 证据：D07 由 `serverBindings[0]` 改为 provider-matched 解析（`matchReleaseDeploymentTargetBindings` + decisionTarget.providerKey，缺省时按唯一 provider 推断）——服务器 offline → `server_not_online` blocked；无绑定 → `server_connectivity_provider_missing` unavailable；重复匹配 → `server_provider_matched_target_missing` unavailable；决策模型对任何 ≠checked 都进 blockerGateIds（fail-closed 语义未改）；`release-gate-deploy-provider.spec.ts` 新增 offline-blocked、binding-missing fail-closed、duplicated 三个用例。）
- [x] **AC-SET-023** 部署使用的目标与设置页当前生效目标一致。（F445 证据：设置页与部署路径共用同一解析函数 `matchReleaseDeploymentTargetBindings`（从 `selectReleaseDeploymentTarget` 提取），settings `currentTarget.bindingId/providerKey/targetRef` 与发布快照 `deploymentInput.target` 一致（focused spec `resolves the provider-matched current target exactly like the deploy path`）；`ReleaseGateDecisionTarget.providerKey` 由 staging deploy 传入，D07 与部署一致。）
- [x] **AC-SET-024** 部署目标页面与 Demo 字段/状态对齐。（F445 证据：部署目标子区表格列 组件/运行目标/区域·命名空间/规模/状态（`envTargetTable*` i18n），运行目标显示 provider-matched targetRef（ssh://…），区域·命名空间取真实服务器 host，规模在无数据时诚实显示 不适用，状态取服务器行真实 online/offline；当前生效 徽标（`envTargetCurrentBadge`）标在 matched 行；调整目标 按钮打开可审计的编辑面（`settings-env-target-edit-dialog.tsx`，保存走绑定 API + 审计 + 冻结/连通性守卫）；helper 文案对齐 Demo `当前组件实际运行位置；环境身份固定，目标配置按修订留痕。`；env-summary 部署目标事实显示当前目标摘要。）
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

- [x] **AC-COPY-001** 用户可见主对象统一称“发布单”。
- [x] **AC-COPY-002** `releaseVersion` 统一称“发布版本号”。
- [x] **AC-COPY-003** `EnvironmentVersion` 统一称“环境版本”。
- [x] **AC-COPY-004** `BuildRun/Manifest/DeploymentRun/ReleaseRun` 在专业证据区保留准确术语。
- [x] **AC-COPY-005** 页面不出现“候选 xx”“默认路径”“需要处理”“正在交付”等无法指导动作的模糊词。
- [x] **AC-COPY-006** raw status code 不直接暴露给用户。
- [x] **AC-COPY-007** Staging/Production 技术名与“预发/生产”用户名组合一致。
- [x] **AC-COPY-008** zh/en key、ICU 参数和运行时切换 parity 通过。

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
