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
- [x] **AC-004** 每张最终截图的 URL、viewport、commit、数据 fixture 和 SHA-256 可追溯。
- [x] **AC-005** 不接受空白、近白、重复 SHA、错误路由或只显示 loading 的截图。
- [x] **AC-006** 所有最终声明可从 manifest/board/result 文件定位到原始命令、日志和截图。

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
- [x] **AC-PROD-029** 浏览器可加载最终站点核心页面。 F460 evidence: the parity stack final site loads in a real browser — authenticated CDP capture `/tmp/codex-tool-runs/svton/f455/browser/03-final-site.png` (+ html/txt) at 1484x1324 renders the parity-target-workload core page ("Parity Target Workload … served on port 43992 … Probe path: /health") with document 200; the F438 route activation + site probe evidence bound the same DeploymentRun to this target (proxyTarget http://127.0.0.1:43992), so the production site is reachable and the final-URL browser load is proven on the parity stack (the F438 environment limitation was the manual fixture domain, now superseded by the parity target).
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
- [x] **AC-SET-025** 资源实例按环境查看和绑定。（F446 证据：资源绑定子区从当前不可变修订的 `resourceReferences`（`settingsDraftFromRevision` → `governance.current`）渲染该环境的绑定实例，并用项目实际 `ManagedResource/ResourceInstance/Site/CDN` 行联接展示实例名与生命周期状态（`buildBindingRows`）；六列表 + 每行校验（已验证/需重新绑定/共享范围外/违反生产隔离）；绑定/换绑/解除只走修订化保存（`POST config-revisions`），项目页无创建/释放入口。）
- [x] **AC-SET-026** 支持资源在指定多个环境复用并显式展示共享范围。（F446 证据：共享与隔离 列显式展示 环境专用 / 仅非生产共享·逻辑隔离 / Production 专用（强制）；每行 绑定方式 select（绑定已有实例/换绑到其他实例/解除绑定/使用允许共享的实例）与 共享与隔离 select 写回共享草稿（`applyBindingMethod/applySharingMode/applySharedEnvironmentToggle/applyRebind` 纯函数），由修订化保存提交；服务端 PRODUCTION ANTI-SHARE RULE——resolver 对 `baselineRole==='production'` 且 `sharedEnvironmentIds.length>1` 的引用 400 `Production 环境禁止与非生产环境共享资源`（`environment-config-reference-resolver.service.ts`，baselineRole 由 `EnvironmentConfigRevisionService.create` 传入）；非生产共享要求 risk≠low（原有规则保留）；web 生产环境行强制 环境专用 且 use-shared 选项禁用。）
- [x] **AC-SET-027** 基础设施模块拥有资源创建/释放，项目只拥有引用关系。（F446 证据：资源绑定子区只读引用 + 选择器写回修订引用；无任何 create/release/申请/创建云资源 文案与入口（subtab/table/editor spec 断言 `not.toMatch(/申请|创建云资源|release/i)`）；供应生命周期跳 `/resource-instances?projectId=` 模块链接；callout `MVP 不在项目页申请或创建云资源；解除绑定不会释放实例。供应、释放与扩缩容仍由全局“资源实例”负责。` 与 Demo 一致。）
- [x] **AC-SET-028** 跨项目资源引用被拒绝。（F446 证据：新增 `environment-config-reference-resolver.service.spec.ts` 直测 resolver 400——跨项目/跨团队的 managed_resource 与 resource_instance 引用 `无效或跨项目`；共享环境集合含非本项目环境 `共享环境 引用无效或越权`；资源所属环境未包含在共享范围 `所属环境未包含在共享范围`；共享范围必须包含当前环境；部署侧 drift 检查与 bulk-bind 项目作用域原有证据保持。）
- [x] **AC-SET-029** 资源健康/连接状态真实读取。（F446 证据：每行实例列接真实 `ManagedResource.status/endpoint/lastSyncAt`（项目详情 select），托管资源行再读取真实 `ResourceConnectionRun` 探测（`GET /resource-control/connection-runs?projectId=`，`use-resource-connection-health` 按 resourceId 取最近一次）显示 连接正常/连接失败 + 探测时间；无探测时诚实 无连接探测，读取失败诚实 连接状态不可用；resource_instance 行只有生命周期状态（无探测，诚实不编造）；lifecycle 状态标签保留。）
- [x] **AC-SET-030** 资源引用进入不可变配置修订。（F446 证据：引用只经 `EnvironmentConfigRevisionService.create` 追加式写入（serializable tx + `expectedCurrentRevisionId` CAS）；F446 spec 断言 stale create → ConflictException 且不落 revision/审计；引用解析（含 anti-share）在 revision 写路径执行；`snapshotHash` 覆盖引用。）
- [x] **AC-SET-031** 运行冻结精确资源 snapshot。（F446 证据：新增 `release-deployment-input-snapshot.utils.spec.ts` 钉住 F432 冻结语义——`buildReleaseDeploymentInputSnapshot` 冻结 id/kind/name/status/environmentId/sharedEnvironmentIds/versionHash；stateHash 覆盖 revision 的资源引用（引用变更 → stateHash 变）；确定性排序；冻结后实例变更不影响既有快照 inputHash。）
- [x] **AC-SET-032** 资源绑定页面与 Demo 信息结构对齐。（F446 证据：资源绑定子区 Demo 六列 资源需求/来源组件/绑定方式/资源实例/共享与隔离/校验（`envResourceTable*` i18n）；绑定方式与共享与隔离 按 Demo 选项文案（绑定已有实例/换绑到其他实例/解除绑定/使用允许共享的实例；环境专用/仅非生产共享·逻辑隔离/Production 专用（强制））；两条 Demo callout（`envResourceCalloutOwnership`/`envResourceCalloutFrozen`）；冻结修订徽标 `当前生效 · 修订 R{n} · {hash8}`；i18n +29 键 zh/en parity 3346。）
- [x] **AC-SET-033** 普通变量按环境维护。（F447 证据：普通变量按 `ProjectEnvironment.config.envVars` 按环境维护，变量与密钥子区六列表（`EnvironmentEnvVarsTable`）来源=环境值 行来自该环境 draft/落库值，`use-environment-env-vars` 保存只提交 plainVariables；`use-environment-env-copy.spec.tsx` 钉住 payload 契约（仅普通变量+CAS）。）
- [x] **AC-SET-034** Secret 只保存 key ID/name/type 引用。（F447 证据：`EnvironmentConfigRevision.secretReferences` 为 SafeSecretReference {id,name,type}；新增 `environment-config-revision.redaction.spec.ts` 钉住修订行/审计元数据/compat `config.envVars` 镜像永不含密钥值；UI 只渲染 `vault://name@id8 · ••••••••` 掩码与勾选引用，页面不读取或显示密钥明文。）
- [x] **AC-SET-035** `.env` 导入先预览和分类，再提交。（F447 证据：`env-file-parser.utils` 新增 `isSensitiveEnvKey` 敏感启发式（`*_SECRET/*_PASSWORD/*_TOKEN/*_KEY/CREDENTIAL` 等），解析结果分类 plainVars/sensitiveVars；导入弹窗预览普通项+疑似敏感项（疑似敏感 · 建议密钥中心 徽标+排除横幅），确认只把 plainVars 合入暂存区，invalid/dup/conflict 行保留提示；`env-file-parser.utils.spec.ts` 12 用例 + import-modal spec。）
- [x] **AC-SET-036** 支持变量/引用按选择的环境复用。（F447 证据：`POST /project-environments/:id/config-revisions/copy`——多选目标环境（仅同项目）逐环境创建新不可变修订，走同一 append-only+CAS+同事务审计写路径（目标 CAS 读取后传入，stale 逐环境报告不 abort 其余）；`EnvironmentEnvCopyDialog` 多选+预览将复制内容（普通变量数/密钥引用名）+逐环境结果；service spec 4 用例 + redaction 1 + web dialog spec 2 + hook spec 1。）
- [x] **AC-SET-037** 每次保存创建不可变 revision 和 snapshotHash。（F447 证据：保存路径唯一入口 `EnvironmentConfigRevisionService.create`（serializable tx + 行锁 + snapshotHash）+ `updateIdentity`/`copyToEnvironments` 复用同一写路径；既有 create/CAS/审计 spec 全绿（project-environment 9 suites/100 tests）。）
- [x] **AC-SET-038** 使用 expected revision/CAS 防止静默覆盖。（F447 证据：copy 逐环境读取目标当前修订作为 expected 传入，stale → 该环境 Conflict（spec `reports a stale target CAS as a per-env conflict`）；普通变量保存 `expectedCurrentRevisionId` 由 hook 传入（hook spec 断言 payload）；create stale → ConflictException 且不落 revision/审计（F446 spec 保持）。）
- [x] **AC-SET-039** 页面显示当前 revision、来源、时间和变更说明。（F447 证据：`changeSummary` 持久化到修订行（migration 20260809100000 additive，create/updateIdentity 写入，REVISION_SELECT 返回）；env-summary 修订条显示 R/来源/时间/变更说明/创建人；新增 `EnvironmentConfigRevisionHistory` 修订历史列表（R/当前徽标/来源/时间/变更说明/创建人）；web specs（summary 2 + history 2 + tabs 1）钉住。）
- [x] **AC-SET-040** API、DB、日志和 UI 不泄漏 Secret 明文。（F447 证据：新增 `environment-config-revision.redaction.spec.ts` 4 用例——修订行 JSON、审计元数据（只含 plainVariableKeys/secretReferenceIds）、compat `config.envVars` 镜像（仅普通变量）、copy 多环境调用链 JSON 均断言不含密钥值；UI 六列表掩码 + tabs/table spec 断言 `not.toMatch(/s3cr3t|plaintext/i)`。）
- [x] **AC-SET-041** 变量与密钥页面和 Demo 对齐。（F447 证据：变量与密钥子区 Demo 六列 键/组件作用域/来源/环境值·引用/要求/校验（`envVarsTable*` i18n）；来源严格三分类 环境值/密钥引用/资源绑定生成（示例行对齐 Demo：`DATABASE_URL` 资源绑定生成 `PostgreSQL / pg-shared-nonprod` 必填 有效、`S3_ACCESS_KEY` 密钥引用 `vault://…` 敏感、`PUBLIC_SITE_URL` 环境值）；当前生效 · 修订 R{n} 徽标；Demo 快照 callout `每次 DeploymentRun 都会引用独立配置快照，只保存普通变量摘要、密钥版本引用和资源绑定 ID。`；编辑器/导入/审查/Secret 勾选/跨环境复用编辑面保留；i18n +42 键 zh/en parity 3388。）
- [x] **AC-SET-042** 每个环境可管理站点和域名入口。（F448 证据：routeSnapshot 结构化 per-entry 模型 `entries[{domain,path,component,port,tlsMode}]`（`environment-config-revision.utils.ts normalizeRouteSnapshot` + `RouteEntry` 类型），保留 domains[]/proxyTarget 平铺向后兼容（无 entries 时按域名逐行派生）；settings 域名与入口子区 添加入口 弹窗（`settings-env-entry-modal.tsx`）写回草稿 entries，保存经创建配置修订 CAS 追加；runtime 证据：真实浏览器在 Production 环境用弹窗添加 `demo.f437.example → web : 3000` 并保存，config-revisions 从 R5 → R6 追加（`/tmp/codex-tool-runs/svton/f448/f448-browser-evidence.json`）。）
- [x] **AC-SET-043** 域名映射到明确组件、端口/路径和运行目标。（F448 证据：入口条目携带 component/port/path（`web : 3000` / `api : 8080` 目标选项，Demo 对齐）；表格 目标组件 列渲染 `component : port`，无映射时诚实 未指定；API normalize 校验 domain 必填、port 1-65535、tlsMode 枚举，非法条目 400。）
- [x] **AC-SET-044** DNS Provider 和验证状态真实可读。（F448 证据：表格 DNS 列取自真实 Site.dns 探测（F438）——`resolved → DNS 已生效 · 于 {checkedAt}`、`failed → DNS 未生效`、无探测/无站点 → 不可用；D14 门禁就绪按同一探测数据推导；web `ProjectSite` 类型补齐 `dns` 字段（API 项目详情本就返回）；runtime 证据表内 `DNS 已生效 · 于 2026-08-07 02:27`。）
- [x] **AC-SET-045** TLS 请求、证书和到期状态真实可读。（F448 证据：表格 TLS 列取自真实 Site.tls——probe valid → 托管证书 · 有效、probe invalid → 证书无效、`tls.status valid/active` + expiresAt 未来 → 证书有效（含到期时间），已过期 → 证书已过期，无证据 → 不可用；TLS 请求模式显示 绑定托管证书/绑定已有证书资产；D15 就绪按同一证据推导；runtime 证据表内 `证书有效 · 于 2026-09-07 08:00`（fixture 真实握手 probe 不可用故诚实显示证书状态有效、D15 不可用·TLS 探测未完成）。）
- [x] **AC-SET-046** 代理/Ingress 规则按 revision 保存。（F448 证据：entries 随 routeSnapshot 写入不可变 revision（append-only CAS 不变，spec：per-entry create 持久化 + stale CAS Conflict 不落 revision；审计 metadata 携带 routeSnapshot）；web 草稿经 `toConfigRevisionDraft` 携带 entries 走创建配置修订保存；runtime 证据：R5 → R6 追加且修订行 routeSnapshot.entries 包含 `web:3000` 条目。）
- [x] **AC-SET-047** 路由变更不反向修改历史运行快照。（F448 证据：revision service spec `editing routeSnapshot appends a new revision and never mutates the historical row`——两次 create 各自 revision 严格单调（R4→R5）、历史行快照逐字保留、`environmentConfigRevision` 客户端无 update/upsert/updateMany 调用（append-only）、审计链逐修订携带各自快照、对已取代修订的 stale CAS 写仍 Conflict；`updateIdentity` 追加修订逐字复制冻结快照（snapshotHash 不变）；ReleaseRun.routeSnapshot 冻结语义（F437/F439 既有 release-production-snapshot 路径）未被改动。）
- [x] **AC-SET-048** 入口未就绪时对应门禁阻断 Production。（F448 证据：每入口行渲染 D14/D15/D16 门禁就绪（就绪/阻断·原因/不可用），按与 D14/D15/D16 gate provider（release-gate-ingress-capability.provider.ts）相同的 fail-closed 策略从持久化 Site 探测数据推导（`settings-env-routes.model.ts` `dnsReadiness/tlsReadiness/routeReadiness`，无证据一律 unavailable 不视为通过）；runtime 证据表内 `D14 就绪 / D15 不可用 · TLS 探测未完成 / D16 就绪`；spec 钉住 blocked 原因（DNS 未解析/TLS 过期/TLS 无效/站点 error）与 unavailable 原因（无站点/无新鲜探测/无证书状态）。）
- [x] **AC-SET-049** 最终站点健康探测可从页面下钻。（F448 证据：外部探测列取最新生产 DeploymentRun `result.siteProbe.http`（HTTP 200 · 时间），渲染 探测证据 深链 `?view=deployments&runId=<deploymentRunId>`；落点 DeploymentRunDetails 复用 `ReleaseSiteProbeEvidence` 组件渲染 DNS/TLS/HTTP 结构化证据（spec 钉住有 siteProbe 时渲染、无则不出）；`latestRouteProbeEvidence/parseRunProbeEvidence` 把 run.result 解析为共享证据类型；runtime 证据：点击深链跳转部署记录视图并渲染 站点 / 路由切换 完整 DNS/TLS/HTTP 探测块。）
- [x] **AC-SET-050** 域名与入口页面和 Demo 对齐。（F448 证据：Demo 六列表 域名/Path/目标组件/TLS/DNS/外部探测（caption 域名与入口）+ 添加入口 按钮 + 当前生效 徽标 + 两条 Demo callout（供应、续期和回收由全局“站点与域名”负责… / 项目环境保留当前绑定、路由和诊断快照…）+ 添加入口 弹窗（Host/Path/目标组件与端口 select web : 3000|api : 8080/TLS select 绑定托管证书|绑定已有证书资产，Demo 对齐）；i18n +57 键 zh/en parity 3445；runtime 1484x1324 浏览器证据（6 列表头、行 `demo.f437.example / / / web : 3000 / 证书有效 / DNS 已生效 / HTTP 200 · 探测证据`、徽标、双 callout、弹窗字段、门禁行、深链落点），390x844 无横向溢出（scrollWidth=390），Console 0 / failed 0。）

## Release Policy And Advanced Strategies

- [x] **AC-POLICY-001** 项目设置显示当前生效策略 revision 和 snapshotHash。（F449 证据：设置 发布规则 区 Demo policySettingsV12 结构——生效徽标 `policy-r{n} · 当前生效`（无修订时为 `系统默认 · 当前生效`）+ 快照哈希 mono（真实修订为 sha256 hex，如 runtime `986e99904ce3…`，合成默认 `default-standard-policy-v1`）+ 生效条 `标准发布 · 日期 · 由 {启用人} 启用`；web spec 钉住徽标与哈希渲染，runtime 浏览器证据同页可见。）
- [x] **AC-POLICY-002** 普通发布页面不高频重复展示规则配置。（F449 证据：发布规则只在设置 `?section=release-policy` 区展示；交付页仍只有 发布单/环境版本 视图（F443 IA 证据保持），策略仅在生产确认弹窗中引用，无重复卡片/横幅。）
- [x] **AC-POLICY-003** 修改策略创建新 revision，不原地覆盖历史。（F449 证据：`ReleasePolicyRepository.create` append-only + serializable tx + 行锁 + `expectedCurrentRevisionId` CAS（stale → 409 发布策略已更新，请刷新后重试，不落 revision/审计）；`release-policy.integration.spec.ts` 并发双写只有 1 个成功且 revision 严格 R1→R2；runtime：真实 UI 点击 保存标准策略修订 追加 `policy-r1`（DB `ReleasePolicyRevision` 行 snapshotHash=`986e9990…` 与页面一致，项目指针更新）。）
- [x] **AC-POLICY-004** 标准发布要求同 Manifest Staging 证明。（F449 证据：`hasVerifiedStagingProof`（environment-version-policy.service.ts:72-77,112-128）在 Production 执行路径拒绝无证明 Manifest；门禁表首行 预发验证成功=已启用；F442 candidate 过滤证据保持。）
- [x] **AC-POLICY-005** Production 始终需要明确人工确认。（F449 证据：confirm 创建 `awaiting_approval` ReleaseRun + pending OperationApproval（risk high）；门禁表 人工审批=已启用；`environment-version-execution-policy.integration.spec.ts` 未批准/已拒绝/过期/已消费/漂移审批全部拒绝执行。）
- [x] **AC-POLICY-006** 环境并发和冻结规则服务端执行。（F449 证据：新增 per-env max-1-run 并发守卫（`release-run-concurrency.utils.ts`，production confirm 与 recovery confirm 两写路径）——事务内先对发布单行 FOR UPDATE、再对目标环境行 FOR UPDATE 串行化，存在 `awaiting_approval|running` ReleaseRun 时 409 `生产环境已有进行中的发布运行（标准发布/恢复发布 · status），同一环境同时只允许一个运行…`；同 idempotencyKey 重放返回既有运行（并发同键归并、不同键拒绝）；集成测试钉住：活跃运行阻断第二个 confirm（standard↔recovery 互相阻断）、运行解决后新 confirm 放行。冻结规则诚实执行：changeWindow/freezePolicy 字段保持 null（无真实 Provider），D13 门禁（M10 `release-gate-approval-capability.provider.ts` 读 `policySnapshot.releaseProtection`）——合成标准策略 `{changeWindowVerified:true,freezeVerified:true}` → 审批有效即 checked；真实策略行无显式结论 → fail-closed `{false,false}` → unchecked/release_protection_incomplete（新 spec `release-gate-approval-capability.provider.spec.ts` 3 用例 + 集成 pin：synthetic vs real 修订的 releaseProtection 快照断言）；Manifest/配置经不可变修订 CAS 冻结（既有 F438 证据保持）；设置页 目标规则 区块明示 `Provider 未接入（字段保持空值，不做假装生效）` 与 `当前实际执行：D13 生产门禁 fail-closed + 不可变修订 CAS`。）
- [x] **AC-POLICY-007** 回退创建新的恢复运行。（F449 证据：`EnvironmentVersionRecoveryRepository.confirm` 创建 mode=`recovery` 的新 ReleaseRun（sourceReleaseRunId 链到历史版本运行）+ 新 OperationApproval（`project.release_order.deploy_production_recovery`），同走 per-env max-1 守卫与幂等重放；`environment-version-recovery.integration.spec.ts` 6/6 保持（含并发收敛与新守卫交叉用例）。）
- [x] **AC-POLICY-008** 金丝雀/蓝绿/自动放量在缺真实 Provider 时显示具体不可用原因。（F449 证据：`release-strategy-capability.service.ts` 对三个进阶策略返回具体缺失能力清单（real_traffic_provider / candidate_and_stable_workloads / metric_analysis_provider / pause_and_abort_provider / automatic_rollback_provider）与本地化原因（需要流量路由/双工作负载/指标分析/暂停与自动中止/自动回滚）；设置页策略卡渲染 能力未就绪 徽标 + 原因 + `缺少能力: …` mono 清单 + `能力未就绪的进阶策略为只读，不可选择。`；web spec 钉住；runtime 浏览器证据可见金丝雀/蓝绿/自动放量三卡。）
- [x] **AC-POLICY-009** 不可用高级策略不能被 API 或 UI 选为可执行。（F449 证据：API `requireExecutable` 在策略 create 前抛 422（release-policy.service.spec 每策略断言 repository.create 未被调用）；生产 preview/confirm 快照只允许 standard（release-production-snapshot.utils.ts）；UI 无策略选择器（web spec 断言无 select/radio/checkbox、页面仅 1 个保存按钮）。）
- [x] **AC-POLICY-010** 未来高级策略从项目选择 stable/target Manifest 并进入独立运行管控，不污染普通发布单主链。（F449 证据：按 canonical spec 明确记录为 **deferred**——当前无任何 advanced-strategy scaffold（ReleaseRun 无 strategy 字段、无 stable/target 选择 API），真实流量/双工作负载/指标 Provider 未接入前保持 fail-closed；settings 目标规则区块与策略卡以只读+不可用原因呈现，不做假装生效。需真实 Provider 后才实现独立运行管控。）

## Copy, Visual And Accessibility

- [x] **AC-COPY-001** 用户可见主对象统一称“发布单”。
- [x] **AC-COPY-002** `releaseVersion` 统一称“发布版本号”。
- [x] **AC-COPY-003** `EnvironmentVersion` 统一称“环境版本”。
- [x] **AC-COPY-004** `BuildRun/Manifest/DeploymentRun/ReleaseRun` 在专业证据区保留准确术语。
- [x] **AC-COPY-005** 页面不出现“候选 xx”“默认路径”“需要处理”“正在交付”等无法指导动作的模糊词。
- [x] **AC-COPY-006** raw status code 不直接暴露给用户。
- [x] **AC-COPY-007** Staging/Production 技术名与“预发/生产”用户名组合一致。
- [x] **AC-COPY-008** zh/en key、ICU 参数和运行时切换 parity 通过。

- [x] **AC-UI-001** 项目目录页面布局与 Demo 对齐。F450 证据：目录 header 双入口收敛单主次（接入已有项目 primary 置首 + 生成新项目 outline，规范 §3.4 repo-first 决策）、行 project-avatar（Demo:732）、五列头 + cell-label/cell-main/cell-sub、directory-summary 紧凑形式（Demo:736）。证据 `/tmp/codex-tool-runs/svton/f450/f450-f451-browser-evidence.json` `facts.directory` + `browser/f450-directory.png`（1484x1324，Console 0）。
- [x] **AC-UI-002** 三步接入页面布局与 Demo 对齐。F450 证据：/projects/create 第一步（Demo:744 风格 h2+form-grid+small helpers+role=alert 内联错误），Demo 式图标 stepper（Demo:740），max-w-3xl 密度；3 步语义与 F415/F416 immutable-snapshot 契约未动；遗留 5 步 import 组件已删除（rg 验证无引用）。证据 `facts.create` + `browser/f450-create-step1.png`。
- [x] **AC-UI-003** 项目交付首页布局与 Demo 对齐。F450 证据（主会话 §4.3 裁决）：weak summary（项目形态/环境就绪/资源绑定/Site 入口）+ 发布单/环境版本 tabs + 创建发布单 primary；context strip 保持在生产步骤（F440），首页无结构变更。证据 `facts.home` + `browser/f450-delivery-home.png`。
- [x] **AC-UI-004** 发布单列表布局与 Demo 对齐。F450 证据：列头 发布单/构建/环境发布/最近执行步骤（Demo:653），8 项粒度状态筛选保留（规范 F419 允许）且 label 用户可理解（草稿/构建中/预发（Staging）发布/等待审批/生产（Production）发布中/已发布/失败/已撤回），行密度 1484 验证。证据 `facts.releaseList` + `browser/f450-release-list.png`。
- [x] **AC-UI-005** 四步详情壳与 Demo 对齐。F450/F451 证据：真实发布单 cmshheb5r0007vwrcaft5uhsx 四步 stepper（前置检查/构建制品/预发发布/生产发布）+ context strip + 审批卡。证据 `facts.detailShell` + `browser/f450-detail-shell.png`。
- [x] **AC-UI-006** 构建步骤布局与 Demo 对齐。F450/F451 证据：六列构建记录表（Demo:697 同构）+ 空态带 构建最新代码 下一动作（共享 EmptyState）。证据 `facts.buildStep` + `browser/f450-build-step.png`。
- [x] **AC-UI-007** 预发步骤布局与 Demo 对齐。F450/F451 证据：Manifest select + 部署到预发 + 五列部署记录表，空态共享 EmptyState。证据 `facts.stagingStep` + `browser/f450-staging-step.png`。
- [x] **AC-UI-008** 生产步骤布局与 Demo 对齐。F440 已对齐（context strip + stage-callout + stage-summary + 审批卡），F450 复验：真实 ReleaseRun 10 条 + 恢复审批卡（`facts.detailShell.body`，1484 密度验证）。
- [x] **AC-UI-009** 环境版本布局与 Demo 对齐。F441/F442 已对齐并留证据；F450 复验无回归（tabs 环境版本 在首页存在）。
- [x] **AC-UI-010** 管理项目各子页布局与 Demo 对齐。F443-F449 已对齐并留证据（settings 三区/五子区/发布规则/路由表），F450 复验无回归。
- [x] **AC-UI-011** 初始空态提供明确下一动作。F451：发布单列表空态新增 创建发布单 动作（打开既有 ReleaseOrderCreateModal）；build 步骤空态 构建最新代码；目录空态既有双入口。共享 `EmptyState`（action prop）。
- [x] **AC-UI-012** 加载状态不闪烁错误空态。F451：三步骤壳空态仅在 `loadedSuccessfully && !loading` 渲染（既有契约保持），gate panel loading 换共享 LoadingState；目录页 hydration 修复（mounted 门控 validating，消除 aria-busy 首帧不匹配，Console 0）。
- [x] **AC-UI-013** 阻断状态同时说明原因和恢复动作。F451：共享 `BlockedState`（reason + recovery action，role=alert）用于失败发布单行（原因=服务端 failureKind 本地化，恢复=查看发布单）；生产失败/拒绝态保持 恢复入口 深链（F440）。
- [x] **AC-UI-014** 执行中状态阻止重复危险提交。F451：运行中由 StatusTag progress 呼吸点 + 提交按钮 disabled/loading（header 构建中、生产 执行中 disabled data-primary）表达，真实构建/审批运行数据验证。
- [x] **AC-UI-015** 成功状态显示可追溯证据。F451：构建成功 Manifest、预发/生产 DeploymentRun/ReleaseRun 记录表 + 日志抽屉、审批卡证据字段，全部来自真实 hooks/SWR。
- [x] **AC-UI-016** 失败状态保留运行并提供日志/重试。F451：失败 BuildRun 保留行 + 查看日志抽屉（f428-seed-failed-r2 真实行证据 `facts.buildStep.body`），错误走 ErrorBanner 重试。
- [x] **AC-UI-017** 等待审批与能力未就绪状态不同。F451/F449：等待审批（warning 色调 + disabled 提交按钮）vs 能力未就绪（只读策略卡 + 缺少能力 mono 清单，F449 证据），StatusTag 六态映射区分。
- [x] **AC-UI-018** Demo 展示的主要状态都有真实 fixture 页面证据。F451：1484x1324 证据 JSON 覆盖 目录/创建/首页/发布单列表/详情壳/构建/预发 7 页面 21 artifacts + sha256，全部真实 F434 种子数据（Console 0/failed 0）。
- [x] **AC-UI-019** 参考 viewport 无横向溢出、裁切或遮挡。
- [x] **AC-UI-020** 常规桌面宽度无横向溢出。
- [x] **AC-UI-021** 窄屏保持主流程和关键操作可用。
- [x] **AC-UI-022** 长 Commit/Digest/域名可换行或截断并可查看完整值。
- [x] **AC-UI-023** Drawer/Dialog 有合理宽度和滚动边界。
- [x] **AC-UI-024** destructive action 不与普通编辑同级误触。
- [x] **AC-UI-025** 页面使用现有设计系统组件，不以硬编码截图复刻。

> F453 证据（本 worker 完成 F453 responsive）：认证 CDP Browser 在 1484x1324 / 1280x800 / 390x844 三 viewport 对全部 10 个页面
> （目录 /projects、/projects/create、交付首页、发布单列表、详情壳、build、staging、production、环境版本、settings）
> 断言 `documentElement.scrollWidth==clientWidth` —— 30/30 无页面级横向溢出（build/staging/production 表格在各自
> `overflow-x-auto` 容器内滚动，页面不溢出，逐容器 `tableWrappers` 记录；AC-UI-019/020/021），详见
> `/tmp/codex-tool-runs/svton/f453/f453-browser-evidence.json`（32 张截图 + sha256，web 3121/api 3131/devpilot-f434-mysql 3334，
> login n08uxlx08cj@f416-git.example，Console 对 parity 页面 0 错误；登录后 /dashboard 一次性的 5 个 dashboard-widget 403 已注明非 parity 页面）。
> 长值处理（AC-UI-022）：release-order-list-row 最近执行/环境发布行 `truncate`+`title`（完整值可 hover 查看），
> staging Manifest `<select>` 选项用 shortId 截断、select `title` 保留选中项完整值（原生 select 保留，F434 候选源 spec 未动，绿色）；
> 既有 break-all/truncate+title 全表/摘要保持。Drawer/Dialog 边界（AC-UI-023）：Drawer `min(760px,100vw)` + 内部 `overflow-auto`，
> Modal `max-w-[calc(100vw-32px)]` + `max-h-[calc(100vh-64px)]` + 内部滚动，390x844 实测 build 日志 Drawer 与门禁目录 Dialog
> 全宽 390px 打开且页面无溢出、内容在内部滚动。destructive 分离（AC-UI-024）：环境归档走 danger 按钮 + danger tone ConfirmDialog
> （L3 名称键入），项目归档同；Demo 发布单列表/详情无撤回按钮（仅状态筛选 已撤回，与 Demo:653/479 一致），withdraw 仅 API+筛选，无同级别误触。
> 设计系统（AC-UI-025）：全部页面复用 @svton/ui + @/components/ui（Button/Modal/Drawer/StatusTag/EmptyState/BlockedState/ConfirmDialog 等），
> 无硬编码截图复刻组件。focused Web spec `f453-responsive.spec.tsx`（7 tests：truncation+title、select shortId+title、Modal/Drawer 宽度与内部滚动、
> 目录 lg-only 网格、stepper 820px 堆叠、表格 overflow-x-auto 包裹）绿色；Web 全量 84 files/405 tests 绿、type-check、build、i18n parity 3485、diff --check 干净。

- [x] **AC-A11Y-001** 页面存在唯一、正确层级的 h1。
- [x] **AC-A11Y-002** 步进条、Tab、表格、Dialog、Drawer 使用正确语义。
- [x] **AC-A11Y-003** 所有图标按钮有本地化 accessible name。
- [x] **AC-A11Y-004** 表单控件有可关联 label、帮助文本和错误文本。
- [x] **AC-A11Y-005** 错误和运行状态通过合适 live region/role 反馈。
- [x] **AC-A11Y-006** 键盘可以完成创建、步骤切换、构建、部署和确认。
- [x] **AC-A11Y-007** Dialog/Drawer 正确锁焦、恢复焦点并支持 Escape。
- [x] **AC-A11Y-008** 不依赖颜色单独表达状态。
- [x] **AC-A11Y-009** 正文、次级文字、边框和状态色对比度通过。
- [x] **AC-A11Y-010** 缩放 200% 后核心流程仍可用。
- [x] **AC-A11Y-011** 中英文切换后无截断或 accessible name 漂移。
- [x] **AC-A11Y-012** 自动化 axe/可访问性检查和人工键盘路径均通过。

> F452 证据（本 worker 完成 F452 accessibility）：axe 4.13.0 经 CDP 注入对全部 12 个关键页面 + 门禁目录 Dialog 复扫，
> 结果 0 critical / 0 serious（详见 /tmp/codex-tool-runs/svton/f452/f452-browser-evidence-2.json；
> 首轮复扫发现并修复的遗留项：StatusTag/Tag 色调对比度、dlitem、scope-attr-valid、landmark-unique、
> scrollable-region-focusable、settings 导航 text-primary/bg-primary/10、muted-on-muted chips、dark: 变体混用）。
> 键盘路径（发布 stepper roving tabs、build 日志 Drawer 焦点圈闭 + Escape 还原、settings tablist）通过
> （f452-browser-evidence.json keyboardPaths）；200% 缩放（740x1324）detailShell/settings 无横向溢出
> （f452-browser-evidence-2.json zoomChecks）。

## Runtime, E2E And Final Verdict

- [x] **AC-E2E-001** 隔离 parity stack 使用命名空间化的 compose project/network/volume，以及独立端口、数据库、Redis、artifact/deployment 存储和目标运行时。F454：`docker-compose.devpilot-parity.yml` project `devpilot-parity`，自有默认网络 `devpilot-parity_default`，命名 volume `devpilot-parity-{mysql,redis,release-build,deployments,deploy-target-data}`，独立端口 web 4131/api 4132/mysql 4334/redis 4384/deploy-target 4222/target-workload 43992，独立 DB `devpilot_parity` 与 Redis；`docker compose -f docker-compose.devpilot-parity.yml config` 渲染干净且无任何 devpilot-g003 引用；spec `release-parity-compose.spec.ts`（3 tests）断言命名空间、端口、volume 与无 g003/无外部网络/无 docker.sock。运行时：parity-mysql/parity-redis/parity-api/parity-web/parity-deploy-target/parity-target-workload 全部 healthy（见 /tmp/codex-tool-runs/svton/f454/f454-stack-evidence.json stack 部分）。
- [x] **AC-E2E-002** fixture 仓库固定 commit 且包含可真实构建的前端/后端 monorepo。F454：committed `fixtures/parity-app/`（root package.json + pnpm-workspace.yaml + pnpm-lock.yaml + apps/web 静态站 + apps/api 健康服务，ZERO 依赖）；`scripts/parity-seed.mjs fixture` 以固定 author/date 在 `${PARITY_FIXTURE_GIT_ROOT:-/tmp/codex-tool-runs/svton/f454/parity-app-git}` 物化真实 git 仓库并钉住确定性 commit `2f0ec3246761537123c65ac415a14e503ebbfa38`（reset 间可复现）；spec `release-parity-fixture-build.spec.ts` 用真实 controlled-local-v1 executor 构建两 app 产出 Manifest（web dist/index.html + api dist/server.js，digest sha256:02bf376b…）；运行时 parity API 对固定 commit 的真实构建 BuildRun `cmsj988zt002enftzfab12xnb` succeeded + Manifest `cmsj9892u002hnftz6yna8fkr`。
- [x] **AC-E2E-003** fixture 提供 Staging/Production 目标、资源、Secret 引用和域名入口。F454：seed 固定 ID 行 —— Project parity-project-0001（onboardingStatus ready）、Staging/Production baseline（parity-env-staging/parity-env-production）、Server parity-server-0001 + 双环境绑定、SecretKey parity-secret-0001（CBC 加密，API 默认 ENCRYPTION_KEY 可解）、ResourceType+ResourceInstance parity-resource-0001（endpoint http://127.0.0.1:43992）、Site parity-site-0001（primaryDomain parity.example.test、TLS valid、routeSwitch → proxyTarget http://127.0.0.1:43992）、两环境 EnvironmentConfigRevision（plainVariables + secretReferences + resourceReferences + routeSnapshot domains staging.parity.example.test/parity.example.test → parity target）；target-workload 容器在 43992 提供真实可探测静态站。
- [x] **AC-E2E-004** seed/reset 幂等、目标 allowlist 可审计且不会删除非 parity 数据或资源。F454：`scripts/parity-seed.mjs`（reset/up/seed/down/inventory）——reset 打印 allowlist（DB=devpilot_parity + volume 硬白名单 devpilot-parity-{mysql,redis,release-build,deployments,deploy-target-data} + network devpilot-parity_default）后才动作，只 DROP/CREATE parity DB、只 prune 白名单 volume/network；运行时验证 reset+seed 两次 inventory 完全一致（counts 与 fixedIds 逐项相等），seed 二次运行幂等；parity DB 中 0 个 g003 表，`SHOW DATABASES` 仅 devpilot_parity（见 f454-stack-evidence.json 与 reset-idem-*.log）。
- [x] **AC-E2E-005** executor/provider 开关和运行限制显式记录。F454：`scripts/parity-switches.md` 记录完整 env 矩阵 —— 基座 fail-closed 默认（RELEASE_BUILD_EXECUTION_ENABLED=false/EXECUTOR_PROFILE=disabled/RELEASE_STAGING_DEPLOYMENT_ENABLED=false/DEPLOYMENT_PROVIDER_PROFILE=disabled，release-build-compose-profile.spec.ts 未改）vs parity 启用值（controlled-local-v1 + work/artifact 根 + timeouts + max-concurrency 2 + COMMAND_PATH 含 /pnpm；local-filesystem-v1 + deployment 根）；并记录 F454 修复的 build-stage gate 延后（C02/C03/C06/C07/C09/C10 provider-missing 显式 deferredReasons，镜像 F437 生产延后模式，实证据门禁 C01/C05/C08 仍真实检查）。
- [x] **AC-E2E-006** Browser/API/DB/log 证据使用同一 project/order/run IDs。F454：固定 ID 契约贯穿 seed/API/DB/log —— parity-project-0001 / parity-order-0001 / parity-user-0001 / parity-team-0001 / parity-env-staging / parity-env-production / parity-server-0001 / parity-secret-0001 / parity-resource-0001 / parity-site-0001；运行时 API 流程（login→connect→analyze→build）与 DB 行、BuildRun/Manifest 证据全部绑定这组 ID（f454-stack-evidence.json steps + db 字段）；构建日志 logSummary 与 DB BuildRun 一致（exact commit 2f0ec324、digest sha256:02bf376b…）。
- [x] **AC-E2E-007** 从项目目录进入三步仓库接入。F455：复用 F454 seed 已定稿的 ready 项目（parity-project-0001，intake 由 seed 定稿——已文档化复用）：`intake-state`（ready）+ `intake-connect`（POST /projects/…/repository-analysis/connect，真实 git ls-remote 校验 /read-only-repositories/parity-app main@2f0ec324）+ `intake-analyze`（复用 seed 的 commit-bound 成功分析 run parity-analysis-0001 —— 真实分析 worker 不产出 migrationEvidence，新建 run 会遮蔽 D10/D11 fixture 证据；已在证据中文档化）+ `intake-contract`（拉取识别契约）+ review/apply 与 finalize 均按不可变定稿记录为 409 `PROJECT_INTAKE_ALREADY_FINALIZED`（intake-review-refused/intake-finalize-refused）；证据见 /tmp/codex-tool-runs/svton/f455/f455-positive-e2e-evidence.json。
- [x] **AC-E2E-008** 应用识别结果并创建 Staging/Production baseline。F455：`baselines-verified` —— 恰好一个 active Staging（parity-env-staging）+ 恰好一个 active Production（parity-env-production）baseline，两环境均存在 R1 配置修订（parity-config-rev-staging-0001 / parity-config-rev-production-0001）；seed 定稿路径由 F454 建立，F455 以 API/DB 双层验证。
- [x] **AC-E2E-009** 完成环境目标、资源、变量/Secret 和域名入口配置。F455：`env-targets`（parity-server-0001 双环境绑定，provider local-filesystem-v1，targetRef filesystem-release-target）+ 两环境 CAS 保存 R2（`env-save-r2-staging`/`env-save-r2-production`，expectedCurrentRevisionId=R1 → revision 2 生效）：plainVariables（HTTP_PLAIN_PARITY/PARITY_DEPLOY_MARKER）+ secretReferenceIds [parity-secret-0001] + resourceReferences [parity-resource-0001（+ production 的 parity-resource-managed-0001）] + routeSnapshot（staging.parity.example.test / parity.example.test → 目标工作负载；production 冻结 proxyTarget http://parity-target-workload + tlsRequired=true，原因与容器内探测可达性说明见 parity-switches.md 与证据）。
- [x] **AC-E2E-010** 创建发布单且初始 0 BuildRun/Manifest。F455：`release-order` —— parity-order-0001（releaseVersion 1.0.0）API 列表 0 builds，DB 计数 buildRun=0 / manifest=0（reset 后全新状态）。
- [x] **AC-E2E-011** 构建主分支最新 Commit 并产生成功 Manifest。F455：`build` —— BuildRun `cmsjbdn2l00298truk56htvgm` succeeded，sourceCommitSha == 固定 commit `2f0ec3246761537123c65ac415a14e503ebbfa38`，Manifest `cmsjbdn5l002c8trui2pdz3q3` digest `sha256:02bf376b60b904da0a067c327f8b921581d6e98adf2c27b4e6fe8d35a4322ae3`，items=3（bundle + parity-svc-web + parity-svc-api），logSummary 显示两组件真实构建。
- [x] **AC-E2E-012** 同 Manifest 成功部署到 Staging。F455：`staging-deploy` —— DeploymentRun `cmsjbdn7h003z8truyuk8biel` completed，artifactManifestId == 同一 Manifest，result.artifactVerified=true，日志无 git checkout/pull/fetch、无 install/build 命令（仅 provider 物化日志）；staging 门禁 B01/B03/B06 provider-missing 按 F454 延后模式显式 deferred（release-staging.service.ts，spec 固定），B02/B09 实证据通过。
- [x] **AC-E2E-013** 在项目内确认、审批并部署同 Manifest 到 Production。F455：`production-preview`（inputHash 5230a747…）→ `production-confirm`（ReleaseRun `cmsjbdn9a00458tru5i6h9tbq` awaiting_approval + OperationApproval `cmsjbdn9c00478truxekvqok8` pending，verifiedDigest == manifest digest）→ `approval-review`（approved，审批人意见 "F455 positive e2e: approve production release 1.0.0"）→ `production-execute`（POST environment-versions/…/actions）→ Production DeploymentRun `cmsjbdnbn005t8trurrpvsz2p` completed：healthProbe passed（processChecks=2，managed-command 物化校验）+ siteProbe http **passed**（HTTP 200，bodySignature sha256:ddff5dd1…）+ routeSwitch switched（parity-site-0001）+ 生产门禁全绿（D01-D20 无 blocker，仅 D06/D09/D14/D17/D20 provider-missing 延后）；ReleaseRun 最终 succeeded，approval consumed。
- [x] **AC-E2E-014** Production current EnvironmentVersion 与运行/Manifest 一致。F455：`production-current-version` —— currentEnvironmentVersionId `cmsjbdnkl007d8tru8zj3g9z2`，artifactManifestId == `cmsjbdn5l002c8trui2pdz3q3`，digest == `sha256:02bf376b…`（matches=true）；`release-run-final` verifiedDigest 一致。
- [x] **AC-E2E-015** 最终域名从浏览器可访问核心页面。F455：域名 parity.example.test 在容器内 DNS 解析到 Docker 内嵌 DNS 的 502（fail-closed 正确拒绝），因此按 brief 约定加载 proxyTarget —— 浏览器（CDP 1484x1324）加载 `http://127.0.0.1:43992/`（parity-target-workload 宿主发布端口，与生产 route 的 parity-network 名是同一容器）：HTTP 200，title "Parity Target Site"，body signature `sha256:ddff5dd1…` 与生产 siteProbe bodySignature 逐字节一致；登录后 /projects/parity-project-0001?releaseOrderId=parity-order-0001 显示 发布单 1.0.0、预发部署成功、生产发布审批（含 F455 审批意见）、成功状态与 Manifest 部署记录表；screenshots/DOM/console/network 见 /tmp/codex-tool-runs/svton/f455/browser/（sha256 清单见 f455-positive-e2e-evidence.json browser 段）。
- [x] **AC-E2E-016** 同发布单第二次构建创建新 BuildRun/Manifest。F456：`build-2` —— parity-order-0001 第二次 `POST builds` 创建新 BuildRun `cmsjc7367008zfq99wqcbby09` + 新 Manifest `cmsjc738z0092fq99s3jm3vez`（distinct from B1 `cmsjc72gg0029fq99q4yr9nsa` / M1 `cmsjc72jn002cfq99q7k8tv8u`）；同 pinned commit `2f0ec324…` 下 digest 确定性一致（M2.digest === M1.digest，`digestDeterministic=true`）；DB BuildRun/Manifest 计数 2/2。
- [x] **AC-E2E-017** 同一 Manifest 两次 Staging 部署创建两个 DeploymentRun 且构建数不变。F456：`staging-deploy-repeat` —— 第一 Manifest M1 再次 `POST staging-deployments` 创建 DeploymentRun `cmsjc73bk00apfq995eqndlko`（distinct from `cmsjc72lj003zfq99gq6a1loc`），同一 Manifest 两个 Staging DeploymentRun，BuildRun 计数仍为 2（`buildRunCountUnchanged=true`）；artifactVerified=true、无 git/checkout/build 命令。
- [x] **AC-E2E-018** Staging 升级产生新环境版本。F456：`staging-upgrade` —— `actions {kind:"upgrade", manifestId:M2}` 创建 DeploymentRun `cmsjc73eg00ayh…`（completed）→ 新 EnvironmentVersion `cmsjc73eg00ayfq99qks5b9wk` kind=upgrade，staging current 指针移动，previousVersionId=`cmsjc73d100asfq99kt8z1rqd`（Vst2）。
- [x] **AC-E2E-019** Staging 回退产生新恢复环境版本。F456：`staging-recovery` —— `actions {kind:"recovery", sourceVersionId:Vst2}` 创建 DeploymentRun（completed）→ 新 EnvironmentVersion `cmsjc73fh00b4fq99mvq75api` kind=recovery（恢复 M1），staging current 移动，previousVersionId=`cmsjc73eg00ayfq99qks5b9wk`（Vst3）。
- [x] **AC-E2E-020** Production 升级经过新的确认/审批并成功。F456：`production-preview`（inputHash）→ `production-confirm` 新 ReleaseRun `cmsjc73gh00b7fq992duj6skw`（awaiting_approval）+ OperationApproval `cmsjc73gj00b9fq99y9x00a33` → `production-approve`（approved）→ `production-upgrade-execute` → Production DeploymentRun completed + 新 EnvironmentVersion `cmsjc73sc00effq99r5ej2v4m` kind=upgrade + current 指针移动；ReleaseRun succeeded、approval consumed。
- [x] **AC-E2E-021** Production 回退经过新的恢复确认/审批并成功。F456：`production-recovery-preview`（历史版本 Vprod1 `cmsjc72za007dfq990zomamkh`）→ `production-recovery-confirm` 新 recovery ReleaseRun `cmsjc73tr00ekfq994pye13i1`（mode=recovery, awaiting_approval）+ OperationApproval `cmsjc73ts00emfq99c12xkhlo`（action project.release_order.deploy_production_recovery）→ approve → `production-recovery-execute` → Production DeploymentRun completed + 新 EnvironmentVersion `cmsjc744h00hsfq99eba317db` kind=recovery + current 指针移动；ReleaseRun succeeded、approval consumed。
- [x] **AC-E2E-022** 所有 current/history/previousVersion 链正确。F456：`version-chains` —— Staging 链 `deploy→deploy→upgrade→recovery`（`cmsjc72me…→cmsjc73d1…→cmsjc73eg…→cmsjc73fh…`）、Production 链 `deploy→deploy→upgrade→upgrade→recovery`（`parity-env-version-prev-a…→prev-b…→cmsjc72za…→cmsjc73sc…→cmsjc744h…`）：每行 previousVersionId 指向链上前一 current（chainLinksValid=true、首版本 NULL），每个版本的 deploymentRun 均 completed，DB current 指针 == 链末，API list currentEnvironmentVersionId 与 DB 一致。
- [x] **AC-E2E-023** 所有运行日志可从对应发布单或环境版本打开。F456：浏览器（CDP 1484x1324，authenticated，4131）—— 发布单详情显示 BuildRun #1+#2 / Manifest 2 个、Staging 步骤 4 次部署（含同一 Manifest 两次部署）、Production ReleaseRun 记录 3 个（upgrade `cmsjc73gh…` + recovery `cmsjc73tr…` 回退审批卡）；`?view=environment-versions` 变更记录表显示 Staging/Production 的 发布/升级/回退 历史链；构建日志抽屉（`step=build&buildRunId=cmsjc7367…`）、Staging 运行日志（`step=staging&deploymentRunId=cmsjc73bk…`）、Production 运行日志（`step=production&releaseRunId=cmsjc73tr…`）、环境版本变更记录均打开。已知展示差异（非链路失败）：lifecycle 读模型只把 action=project.release_order.deploy_production 的审批计为有效生产证据，recovery 审批（deploy_production_recovery，AC-PROD-035 设计）不计，故订单 stepper 显示「生产证据与发布单不匹配」——所有运行均成功、审批已消费、指针已移动。全部截图/DOM/console/network + sha256 见 /tmp/codex-tool-runs/svton/f456/browser/ 与 f456-version-history-evidence.json。
- [x] **AC-E2E-024** 未连接仓库或无主分支时构建拒绝。 F457：`parity-negative-project-0001`（ready，无仓库连接/无主分支）`POST builds` → 422 `RELEASE_GATE_BLOCKED`（C01 `repository_not_connected`），DB BuildRun=0，ReleaseGateDecision 持久化 `allowed=false` blocker [C01]（inputSnapshot 证据）；见 /tmp/codex-tool-runs/svton/f457/f457-negative-e2e-evidence.json。
- [x] **AC-E2E-025** 必需门禁失败时对应阶段服务端拒绝。 F457：仓库连接 status=failed/errorCode=repository_verification_failed → build 阶段 422 `RELEASE_GATE_BLOCKED`，决策持久化 `allowed=false` blocker [C01] reasonCode `repository_verification_failed`，BuildRun=0；连接行随后删除（fixture 恢复）。
- [x] **AC-E2E-026** Provider 关闭时能力 unavailable 且执行拒绝。 F457：release-policy capabilities 列表 standard executable=true，canary/blue_green/automatic_traffic executable=false `release_strategy_capabilities_unavailable` + 5 项缺失能力；preview strategy=canary 与 confirm strategy=blue_green 均 422 同 code（能力检查先于输入校验）。
- [x] **AC-E2E-027** 跨项目/发布单 Manifest 拒绝。 F457：跨项目 Manifest（parity-negative-manifest-0001）与跨发布单 Manifest（parity-manifest-prev-b-0001）staging 部署均 404 `Manifest 不存在或不属于当前发布单`，DeploymentRun=0。
- [x] **AC-E2E-028** Digest 被篡改时部署拒绝。 F457：篡改 M1 project-bundle item digest → staging 部署 422 `Manifest 缺少可验证的项目制品`，DeploymentRun=0；digest 逐字节恢复。
- [x] **AC-E2E-029** 配置快照漂移时 Production 旧确认拒绝。 F457：当前 R2 确认后再 CAS 创建 R3（配置漂移）→ 旧确认 execute 422 `Production ReleaseRun 未批准、已使用或输入已漂移`，DeploymentRun=0，current 指针未移动。
- [x] **AC-E2E-030** 审批拒绝/过期/已消费时执行拒绝。 F457：审批 rejected → execute 422（无 DeploymentRun）；approved 后 expiresAt 置为过去 → 422；approved 后 consumedAt 置位 → 422；三次 ReleaseRun 均保持 awaiting_approval。
- [x] **AC-E2E-031** 两个使用相同或不同幂等键的并发生产确认/执行都不会双发。 F457：两个并发 confirm 同幂等键 → 均 201 且仅 1 个 ReleaseRun（幂等重放）；不同幂等键 → 1×201 + 1×409 `生产环境已有进行中的发布运行`（环境 max-1-run 守卫）；已批准 run 的两个并发 execute → 1×201 DeploymentRun completed（ReleaseRun succeeded、审批 consumed）+ 1×409，仅 1 个 DeploymentRun。
- [x] **AC-E2E-032** 健康检查失败不移动 current 指针。 F457：healthCheckUrl http://127.0.0.1:9/health（curl 拒绝连接）→ DeploymentRun failed `WORKLOAD_HEALTH_FAILED`，ReleaseRun failed `ENVIRONMENT_DEPLOYMENT_FAILED`，current 指针未移动（vs 031 后基线），门禁决策由失败 run 认领。
- [x] **AC-E2E-033** DNS/TLS/HTTP 探测失败不标记最终成功。 F457：routeSnapshot R4 proxyTarget → 404 路径：siteProbe http failed/404（result.siteProbe 记录），路由切换未应用（0 SiteRouteSwitchRun），DeploymentRun failed、ReleaseRun failed、不标记最终成功、指针未移动；R4 保留在 append-only 历史，current 配置恢复 R3。
- [x] **AC-E2E-034** 无权限用户看不到或不能执行受保护动作。 F457：MEMBER（parity-member-0001）读发布单 200，但 build/staging-deploy/confirm-production/execute-environment/审批 review 全部 403；跨团队用户（无 membership）读 → 403 `无权访问该团队`；任何尝试均未产生 BuildRun/DeploymentRun。
- [x] **AC-E2E-035** 全链 API/DB/log/截图/compose/runtime/evidence artifact 无 Secret、token、bootstrap 或认证凭据明文泄漏。 F457：全链 12 类证据扫描（API 证据 JSON、mysqldump db.dump.sql、api/web 容器日志、F455/F456 浏览器 DOM/HTML、compose、历史证据 JSON、runtime active.json、runtime.env（mode 600 校验）、DB 日志列）——bootstrap 密码、seed Secret 值、JWT 片段 0 意外敏感命中；仅账户邮箱标识符（文档化）与两个设计内位置：compose 声明的 bootstrap 配置 + 0600 runtime.env 工作负载交付文件。

- [x] **AC-VIS-001** 项目目录 Demo/实际同 viewport 对照已审查。 F458：1484x1324 对照 ALIGNED；摘要 3 卡/5 列表头/行字段/头像/单一进入动作一致；双入口「接入已有项目+生成新项目」由 canonical §4.2 明确批准；见 /tmp/codex-tool-runs/svton/f458/f458-visual-regression-evidence.json（下同）。
- [x] **AC-VIS-002** 项目接入三步 Demo/实际同 viewport 对照已审查。 F458：三步 stepper 一致；MINOR 已记录（step1 字段走 §4.2「填写」路径、step2/3 真实 contract+快照 SHA；step3 用 scratch 草稿截图后已清理还原 fixture）。
- [x] **AC-VIS-003** 发布单列表 Demo/实际同 viewport 对照已审查。 F458：ALIGNED；4 列表头/主操作/行状态一致；粒度状态筛选（F419）与 §4.3 弱摘要为 canonical 批准例外。
- [x] **AC-VIS-004** 前置检查 Demo/实际同 viewport 对照已审查。 F458：ALIGNED；callout+51 项目录+结论+4 组门禁卡结构一致，fixture 门禁状态为数据差异。
- [x] **AC-VIS-005** 构建步骤 Demo/实际同 viewport 对照已审查。 F458：修复 1 处后 ALIGNED——补齐步骤标题 `main · 自动取最新 Commit` pill（release-order-build-step.tsx + zh/en messages），重截图验证；6 列表头一致。
- [x] **AC-VIS-006** Staging 步骤 Demo/实际同 viewport 对照已审查。 F458：MINOR 已记录（验证结论列更丰富、不可变 DeploymentRun ID；结构/按钮一致）。
- [x] **AC-VIS-007** Production 步骤 Demo/实际同 viewport 对照已审查。 F458：ALIGNED；context strip（F440）、密集证据表、审批卡为 canonical 批准例外。
- [x] **AC-VIS-008** 环境版本 Demo/实际同 viewport 对照已审查。 F458：MINOR 已记录（实现额外提供目标 Manifest 选择器；卡片/变更记录表结构一致）。
- [x] **AC-VIS-009** 项目识别 Demo/实际同 viewport 对照已审查。 F458：MINOR 已记录（repository-identity 锁定卡模型；组件表因 fixture 无识别组件而缺失，数据驱动）。
- [x] **AC-VIS-010** 部署目标/资源/变量/入口/保护规则 Demo/实际对照已审查。 F458：MINOR 已记录（同 6 列表头+callout+修订条；实现更丰富：操作列/绑定控件/修订历史；保护规则表为 fixture 数据缺失空态）。
- [x] **AC-VIS-011** 发布规则 Demo/实际同 viewport 对照已审查。 F458：ALIGNED；facts+门禁表+修订 callout 一致；能力卡（F449 canonical）。
- [x] **AC-VIS-012** 所有可见结构差异已修复或由 canonical spec 明确批准。 F458：1 处 FIX REQUIRED（构建步骤 badge）已修复并重截图；其余为数据驱动或 canonical 批准例外（§4.2/§4.3/F419/F440/F449），无剩余结构差异。

- [x] **AC-REVIEW-001** 产品审查确认主链、边界和术语符合 canonical spec。
- [x] **AC-REVIEW-002** UX 审查确认新用户沿单一主动作可完成发布。
- [x] **AC-REVIEW-003** 专业用户可下钻门禁、制品、日志、资源、配置和审计。
- [x] **AC-REVIEW-004** 领域审查确认不可变运行/快照和 current read-model 边界正确。
- [x] **AC-REVIEW-005** 安全审查确认权限、审批、执行、Secret 和日志边界正确。
- [x] **AC-REVIEW-006** 无障碍审查确认键盘、语义、焦点和对比度通过。
- [x] **AC-REVIEW-007** 兼容审查确认旧深链/历史数据不被破坏或伪造迁移。
- [x] **AC-REVIEW-008** 最终 reviewer 与主要实现 worker 分离，所有有效发现已关闭。

F459 evidence: an independent review (this slice) separated from the F414-F458 implementers reviewed product (main chain/boundaries/terminology vs canonical spec), UX (single primary action per page), professional drill-down (51/15 gates, artifacts, logs, resources, config, audit), domain consistency (immutable runs/snapshots, current-from-successful-only, no back-mutation, frozen snapshots, no drift re-reads), security (permissions, approvals, execution, secrets, logs - zero plaintext), accessibility (keyboard, semantics, focus, contrast; axe re-run across all pages with 0 critical/0 serious), and compatibility (legacy deep links, F406 read-only). The review found and FIXED a real domain-consistency defect: the release-order lifecycle/evidence presenter only counted standard deploy_production approvals as valid production evidence, so after a successful Production recovery the stepper wrongly showed 生产证据与发布单不匹配. The fix (productionApprovalEvidenceForRun in release-order-production-evidence.query.ts) matches the approval action to the run mode (standard->deploy_production, recovery->deploy_production_recovery) across all production-evidence CTEs, with lifecycle/list/evidence spec updates (lifecycle integration 9/9 incl. recovery-evidence regression, list integration 13/13, list query spec asserting both action/mode pairs). F455+F456 chains re-ran clean on the parity stack with no mismatch, web suite 405/405, axe 0/0 across all pages, API/Web type-check + builds pass, git diff --check clean. Reviewer separation statement and per-domain findings in the F459 review report; all P0/P1/P2 findings closed (P3 notes documented).

## Final Completion Rule

只有同时满足以下条件才可将 F460 和 Goal 标记完成：

1. 本文件不存在未勾选条目；若 canonical spec 明确删除某项，必须记录批准依据而不是静默跳过。
2. V13 Demo 所有主要页面和状态均有同 viewport 实际实现对照。
3. 正向完整链路以真实构建、工作负载、路由和浏览器访问结束。
4. 负向、并发、权限、漂移和 Secret 泄漏验收通过。
5. TODO、progress、roadmap、board、worker result 和最终报告状态一致。
