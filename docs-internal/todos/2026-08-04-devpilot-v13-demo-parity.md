# Devpilot V13 Demo 1:1 Parity Closure

## Goal

在保留 F386-F412 已完成领域模型和历史证据的前提下，把当前 V13 worktree 的功能、页面结构、交互状态、真实执行链路和浏览器结果完整对齐 V13 canonical spec 与 `delivery-versions-v9.html?v=13.0`，最终让用户能够从项目接入开始，经发布单构建、Staging、Production、环境升级/回退和域名入口完成可审计、可从浏览器访问的真实闭环。

## Scope

- In scope: V13 项目目录/接入、项目交付首页、发布单四步、BuildRun/Manifest、Staging/Production、审批、环境版本、项目设置、51/15 门禁、真实构建/部署/路由、日志、UI/交互、无障碍、Docker/browser E2E、文档和最终验收。
- Out of scope: 未经用户授权的 push、PR、合并 master、外部生产环境变更；伪造 Provider/部署/健康检查成功；用静态截图或 mock API 替代真实行为。
- Protected checkout: `/Users/zhaoxingbo/Workspace/ai-driven/svton` 只读；实现只写 `/Users/zhaoxingbo/Workspace/ai-driven/svton-devpilot-project-delivery-v13`。
- Visual truth: V13 Demo 项目内容区、交互、状态和视觉层级 1:1 对标；平台仍可保留真实跨项目模块，但不得破坏 Demo 的项目中心 IA。

## Clarifications And Assumptions

- Confirmed: F386-F412 是历史实现范围完成记录，不代表本次严格 1:1 parity 验收通过。
- Confirmed: canonical spec 优先级高于 Demo 中的旧文案或纯 mock 行为；两者冲突时记录差异并按 canonical spec 实现。
- Confirmed: Demo HTML SHA-256 为 `523080f43d935dba737fdfc0013f5133dc140c6d19936077692dfa556b549b0a`。
- Confirmed: canonical spec SHA-256 为 `a491e9f5e9f583bf92fc56ef804a0884f5ab65bd93156a318b809f2b5b605393`。
- Confirmed: 当前 Docker 未配置 `RELEASE_BUILD_EXECUTION_ENABLED` 和 `RELEASE_STAGING_DEPLOYMENT_ENABLED`；当前 release-order 执行数据为 0 BuildRun/Manifest/DeploymentRun/ReleaseRun/EnvironmentVersion。
- Confirmed: 当前 exact-artifact executor 只验证并物化 ZIP，不启动工作负载、注入配置、配置入口或执行浏览器探测。
- Confirmed: 一个 checkout 同时只允许一个 write worker；可并行的只读审查或独立 worktree 写入必须由主会话明确调度。

## Workflow Routing

`routing: long-goal + orchestrator-board + atomic workers + single-writer + noisy-tools; 主会话维护目标、依赖和验收，worker 每次只处理一个 Fxxx，完整日志保存在 /tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/。`

## Authoritative Inputs

- V13 Demo: `/Users/zhaoxingbo/.codex/visualizations/2026/07/31/019fb7eb-9f49-77b0-af1d-f50f9c4316ce/delivery-center-html/delivery-versions-v9.html`
- Canonical spec: `/Users/zhaoxingbo/.codex/visualizations/2026/07/31/019fb7eb-9f49-77b0-af1d-f50f9c4316ce/delivery-center-html/devpilot-project-delivery-v13-canonical-spec.md`
- 1:1 acceptance: `../devpilot/project-delivery-v13-demo-parity-acceptance.md`
- Historical implementation ledger: `2026-08-03-devpilot-project-delivery-v13.md`
- Historical progress/evidence: `../devpilot/progress/project-delivery-v13.md`

## Dependency Rules

- F414-F419 establish project identity and project-home contracts before release UI consumes them.
- F420-F430 establish release state, gates and immutable build behavior before real Staging/Production execution.
- F431-F442 establish real runtime, approval and environment-version execution before positive E2E.
- F443-F451 may proceed after the referenced backend/read-model contract exists; visual workers must not invent data contracts.
- F452-F458 are closure gates and may not be marked done using mocked success states.

## Current Parity Verdict

- Verdict: **not accepted**. The current branch has the core additive domain model and
  several usable project/release screens, but it does not yet provide the complete
  real deployment chain or 1:1 V13 information/interaction/visual parity.
- Remaining execution scope: 47 pending atomic slices after F413 — project entry/home
  6, release/gates/build 11, real Staging/Production 10, environment governance 9,
  UI/accessibility 4, and runtime/E2E/final closure 7.
- Acceptance state at freeze: 350 checks total; 4 baseline-integrity checks recorded,
  346 functional/UI/runtime/final checks remain open. Historical F386-F412 evidence
  does not auto-satisfy any open check.

## Functional TODO Breakdown

### P0. Parity Contract And Project Entry

| ID   | Status | Atomic TODO                                                                                                       | Context Boundary                                                                                                                                                           | Acceptance                                                                                                                                                                                                                         |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F413 | done   | 固化本次审计差距、Demo/spec 哈希、剩余 TODO 和逐项验收清单。                                                      | Docs only；不改产品行为。                                                                                                                                                  | AC-000～AC-006；本文件与 parity acceptance 文件存在且互相引用。                                                                                                                                                                    |
| F414 | done   | 让“生成新项目”和“三步接入已有项目”最终创建同一种 READY Project、唯一 Staging/Production baseline 和首个配置修订。 | 单一 `ProjectGovernanceFinalizationService` owner；生成请求必须带持久 attempt key，数据库 claim 只选中一个唯一 attempt artifact，失败 sibling 不删除 winner；未改发布 UI。 | AC-PROJ-001～006；真实 MySQL 两条入口均为 READY、1+1 baseline、2 个 R1/current，响应丢失重放、异输入拒绝、artifact ownership、回滚/幂等/并发通过。                                                                                 |
| F415 | done   | 把仓库识别结果整理为项目类型、架构、部署方案、组件、路径、构建输出和运行方式的结构化可编辑合同。                  | Repository-analysis typed read/review model + race-safe immutable review snapshot；快照后 generic apply 无副作用 409，finalize 拒绝状态漂移；不改项目首页。                | AC-INTAKE-001～007；真实仓库分析可核对和调整，不显示原始 JSON；确定性 MySQL 竞态/无变更、Git/Browser 证据完成。                                                                                                                    |
| F416 | done   | 锁定 finalized 项目的 canonical repository identity，并拒绝构建来源与锁定身份漂移。                               | Repository connection/intake/build source policy；READY legacy 无可验证 current identity revision 时 fail closed。                                                         | AC-IDENTITY-001～005；独立修正已补齐 audit reason、冻结 BuildRun 展示、保守 migration 和全证据 hash inventory；二次复核后仅精确 v1/null 允许 legacy 展示回退，未知/畸形快照 fail closed；真实 MySQL/Git/runtime/Browser 通过。     |
| F417 | done   | 补齐项目目录的单一状态筛选语义、最近活动排序和 Demo 信息密度。                                                    | Project-directory query/presenter/Web list。                                                                                                                               | AC-DIR-001～010；后续修正要求 exact current version 与同 team/project/Production 的 active Site/domain 同时成立；真实 MySQL、hydration 首帧、认证 Browser Console 0、无交叉 evidence inventory 和 1484×1324 同 viewport 对照通过。 |
| F418 | done   | 纠偏项目首页 frozen intake 与跨 Tab 创建发布单主操作。                                                            | 单一 finalized-snapshot projector + always-mounted create modal owner；不进入 F419/F420+。                                                                                 | AC-HOME-001～005；active-child Tabs 两页签共享同一创建 owner，intake 只接受 exact succeeded finalization/result/review truth；两套真实 MySQL、认证 API/Browser、Console 0、no-create 计数及 1484×1324 截图通过。                   |
| F419 | done   | 实现发布单列表搜索、状态筛选、最近执行排序、构建/部署计数和最后执行步骤。                                         | ReleaseOrder list/read model/query/Web list；独立复核纠偏只收紧追加式关系，不进入 F420+。                                                                                  | AC-HOME-006～013；Deployment 验证 Manifest↔BuildRun 四维归属，ReleaseRun 验证 Manifest 四维归属与 frozen digest；fresh MySQL 对抗关系漂移、当前 tree 的逐截图 Browser raw evidence 绑定及 accepted/rejected inventory 通过。       |

### P1. Release Order State, Gates And Build

| ID   | Status | Atomic TODO                                                                                                           | Context Boundary                                                        | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F420 | done   | 建立 ReleaseOrder 追加式生命周期派生规则，分别表达草稿、构建、预发、待审批、生产中、生产成功、失败和撤回。            | 单一 list/detail projector + audited withdraw；不进入 F421 resumeStep。 | AC-ORDER-001～005；初审 P0=0/P1=2/P2=1 已按 active baseline、exact Production governance、canonical response 修正；7 suites/34 real-MySQL tests、16 accepted Browser captures、认证 create/withdraw/adversarial SHA inventories 通过，独立修正复审 P0/P1/P2=0/0/0。                                                                                                                                                                                                            |
| F421 | done   | 修复 `resumeStep`，按最远真实执行证据恢复到 preflight/build/staging/production。                                      | ReleaseOrder detail projection/route tests；不进入 F422。               | AC-ORDER-006～010；F420 valid lifecycle events 最大阶段 + strict presenter；fresh MySQL 11/11、认证 API、16 accepted Browser、duplicate-step P1 修正；final independent seal review P0/P1/P2/P3=0/0/0/0。                                                                                                                                                                                                                                                                      |
| F422 | done   | 将四个普通 Tab 改为连接步进条，并展示完成、当前、等待和阻断状态。                                                     | Release detail shell only。                                             | AC-ORDER-011～016；A→B stale-scope 与 same-scope list-after-POST 两个 P1 均已修正；9 files/61 tests、认证 Browser 10/10、同输入 Product Design QA、correction2 与 final independent reviews 全部通过，最终 P0/P1/P2/P3=0/0/0/0。                                                                                                                                                                                                                                               |
| F423 | done   | 把“构建最新代码”放到详情页主要位置，并按是否已冻结 Production 制品控制动作。                                          | Release detail header/action policy.                                    | AC-BUILD-001～004；单一共享 Build controller、服务端逐次解析默认分支、scoped `releaseRuns` 冻结事实；认证 Browser 证明双击 1 个空体 POST、冻结态 0 POST、1484/820 无溢出；9 files/64 tests 与最终源码门禁通过，独立复审 P0/P1/P2/P3=0/0/0/0。                                                                                                                                                                                                                                  |
| F424 | done   | 在前置检查首屏展示 15 个 MVP 能力组摘要，并保留 51 项完整目录下钻。                                                   | Gate catalog presenter/Web summary。                                    | AC-GATE-001～006；精确校验 15 组/51 项/39 MVP/12 Target、10-11-20-10、持久化六态与九项 Commit MVP 结论；首屏四类摘要、具名 51 项 Modal、逐项 Provider/原因/证据/时间完整；17 focused + 31 Web regression + 19 API tests、11 real-MySQL fixture、type/lint/i18n/build、1484/821/820 Browser 与同输入视觉对照通过；独立复审 8 files/33 tests、P0/P1/P2/P3=0/0/0/0；不进入 F425 服务端阻断。                                                                                      |
| F425 | done   | 将门禁结果接入 Build、Staging、Production 服务端阻断策略，区分技术阻断、业务证据、人工确认和 unavailable。            | Gate decision policy/API；不改视觉。                                    | AC-GATE-007～014；Build 9、Staging 5、Production 19 项 MVP 技术门禁由同一策略 fail closed，P03 仅作业务证据；精确输入/actor/决定快照追加持久化并在运行预留事务内单次 claim，人工确认仅作用于同输入的 canonical manual 门禁；Browser 证明页面与实际 Build 拒绝决定同为 8 项、同 inputHash，422 后 BuildRun 仍为 0；11 suites/51 API tests、7 suites/25 real-MySQL tests、3 files/18 Web tests、type/lint/format/Prisma/build/CodeGraph 通过，最终独立复审 P0/P1/P2/P3=0/0/0/0。 |
| F426 | done   | 为受控本地/隔离构建执行器建立明确的 runtime profile、存储卷、超时和并发配置，并在 V13 Docker 验收环境显式启用。       | Build executor/config/compose。                                         | AC-BUILD-005～010；`controlled-local-v1` 双开关与专用卷、整次运行/命令超时、取消、进程组、单进程并发 2、恢复与 CAS 终态已闭环；基础配置继续 fail closed。14 suites/44 focused、4 suites/11 real-MySQL、4 Docker runtime、1 authenticated HTTP composition、加固镜像启动与 CodeGraph 均通过；独立复审 P0/P1/P2/P3=0/0/0/0。                                                                                                                                                     |
| F427 | done   | 收敛环境无关制品合同，只打包声明的组件输出和 provenance，拒绝越界 symlink/特殊文件及把环境变量烘焙为伪同一 Manifest。 | Artifact packaging/build config。                                       | AC-BUILD-011～018；V4 输入快照、声明输出 create-once 聚合/组件 ZIP、内容索引与来源 provenance、结构化秘密/越界/symlink/特殊文件拒绝、稳定同输入 Digest 与 baked public env 区分已闭环；18 suites/67 focused、4 suites/33 repository、7 suites/19 real-MySQL、3 suites/9 hardened Docker、1 suite/2 authenticated HTTP 及静态/CodeGraph 全绿，独立纠错复审 P0/P1/P2/P3=0/0/0/0。                                                                                                |
| F428 | done   | 补齐构建记录的 revision、Commit、Manifest、结果、耗时和逐次日志抽屉 UI。                                              | Build step/read model/log drawer。                                      | AC-BUILD-019～025 全部通过；commit `92575cc2` 修复 scope 后六列四态（成功/失败/运行中/取消）表格、独立“日志”入口、右侧 Drawer（精确 BuildRun 元数据 + 脱敏日志）、`buildRunId` 深链刷新保留、非法 buildRunId fail closed、重复访问不覆盖日志/Manifest、390x844 无溢出均已 Browser 认证捕获；仅平台性 favicon.ico 404，0 unexpected console。证据 `/tmp/codex-tool-runs/svton/f428/f428-browser-evidence.json` 与 `f428/browser/f428-db-evidence.log`。                                                                                                                                                                                                                                                                                                       |
| F429 | done   | 为发布单详情聚合 BuildRun、Manifest、DeploymentRun、ReleaseRun 证据，移除项目一级重复的制品/部署主入口。              | Release detail read model/navigation。                                  | AC-ORDER-017～021；精确 team/project/order/Build/Manifest/approved Staging proof/ReleaseRun/Production DeploymentRun 聚合，重复 Staging/Production 历史只追加；专业 `view=deployments&runId` 深链与 legacy redirect 保留，项目一级仅保留发布单/环境版本；独立复审 P0/P1/P2/P3=0/0/0/0，fresh Browser 1484x1324、API 200/404、0 console error/warning 全部通过。                                                                                                                |
| F430 | done   | 统一发布相关状态和动作的中文语义，消除 raw `completed/upgrade/recovery` 与模糊词。                                    | Release/env-version messages and presenters。                           | AC-COPY-001～008；集中 presenter、稳定客户端错误键、精确 BuildRun/Manifest/DeploymentRun/ReleaseRun 与“预发（Staging）/生产（Production）”语义；3060 条 zh/en key/ICU parity、54 files/205 tests、生产构建、双语运行时切换与 7 张 Browser 截图通过；独立终审 P0/P1/P2/P3=0/0/0/0。                                                                                                                                                                                             |

### P2. Real Staging And Production Execution

| ID   | Status      | Atomic TODO                                                                                                        | Context Boundary                             | Acceptance                                                                                                                                                                                                                            |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F431 | done        | 定义并实现 exact-Manifest Deployment Provider port，使 DeploymentRun 能把制品交给真实目标而非只解压目录。          | Deployment provider contract/adapter。       | AC-STG-001～006；默认关闭的 filesystem/SSH profile、服务端与远端双 Digest 校验、同 Manifest 两次真实 SSH 激活、无 checkout/pull/build、完整 scope/failed/unknown 负向矩阵及独立 READY 复审通过。                                      |
| F432 | done        | 在部署执行时解析并注入当前环境配置修订、普通变量、Secret 引用和资源连接信息，且不泄漏明文。                        | Deployment input snapshot/config injection。 | AC-STG-007～013；冻结安全输入哈希，受管引用仅在门禁后解密，环境/资源/目标作用域重校验，配置/Secret/资源/目标漂移在 Provider 前阻断；8 个 CodeGraph 受影响套件 33/33（真实 MySQL、真实 SSH、认证 HTTP）及独立 READY 0/0/0/0 终审通过。 |
| F433 | done        | 让 Staging 启动真实工作负载并执行服务级健康检查，失败必须保留日志且不生成成功环境版本。                            | Staging runtime/health adapter。             | AC-STG-014～020；exact-Manifest 前后端/worker/静态服务、托管进程/命令生命周期、目标机回环 HTTP/进程探针、失败诊断与 EnvironmentVersion CAS 边界闭环；真实 MySQL 10/10、SSH 2/2、认证 HTTP 1/1，独立 READY 0/0/0/0。                   |
| F434 | done        | 为每个 Staging DeploymentRun 增加独立日志/证据抽屉和“部署”动作，禁止重新构建。                                     | Staging Web only。                           | AC-STG-021～027；按冻结 Demo 登记当前制品/部署次数/生产前置摘要、逐次技术结果与业务验证区分、日志 Drawer、行级重复部署及完整五态+空态矩阵与 390 响应式；浏览器证明部署次数 3→4、构建数不变；v2 独立复审 READY，P0/P1/P2=0。                                     |
| F435 | done        | 把 Production 确认改成始终弹出的快照确认 Dialog，展示环境、版本、Build、Manifest、配置和策略。                     | Production confirmation Web。                | AC-PROD-001～009。实现完成、单测/类型/构建/i18n/格式化全部通过（focused 9 测试、全量 57 文件 222 测试、3107 消息 parity）；AC-PROD-001～003 已勾选，AC-PROD-004～009 已用 commit bfbfc805 的认证 CDP Browser 证据勾选（dialog 六字段/取消不建行/确认仅建 1 ReleaseRun+1 审批/390x844 无溢出），见 /tmp/codex-tool-runs/svton/f435/f435-browser-evidence.json。 |
| F436 | done        | 在项目上下文内完成生产审批申请、批准/拒绝、执行和状态回流，不要求用户跳到全局模块再手工返回。                      | Release approval bridge/project UI。         | AC-PROD-009～016。项目上下文审批卡片（批准/拒绝+必填理由驳回、审批人/时间/意见、执行生产发布+双提交保护）、全局模块 release 类别本地化+禁用全局执行（请在项目发布上下文执行）+`?id=` 深链聚焦；服务端不变量测试（拒绝/过期/已消费/输入漂移不可执行、并发收敛 1 个 DeploymentRun、review 路由 team_admin 403）；认证 1484x1324 浏览器证据（pending→批准→approved→执行接线→全局同态→深链聚焦）；执行点击命中真实服务端 422 门禁拒绝并回显到卡片，DeploymentRun 创建属于 F437 生产执行门禁（D06/D09 硬编码 unavailable），F436 未改动。focused API 23 测试、focused Web 4 文件 19 测试、类型/构建/i18n(3120)/diff 全通过。 |
| F437 | done        | 让 Production 使用同一 Deployment Provider 启动真实工作负载，并消费冻结快照而非读取漂移后的当前配置。              | Production executor/transaction。            | AC-PROD-017～024。execute 从冻结 ReleaseRun（configRevisionId+resource/route/policy snapshot）构建 deploymentInput+workload 并透传给共享 exact-Manifest executor/provider（复用 ReleaseDeploymentInputService.prepare 的冻结路径 + ReleaseProductionWorkloadService）；D06/D09 在 admit+finalize 显式 deferral（preflight 仍 unavailable，D17 保持 finalize 真实、D20 也 finalize deferral）；confirm 冻结 policySnapshot 的 releaseProtection 对标准合成策略默认 verified、真实策略行无标记时 fail closed；真实门禁+真实 provider 集成测试（新 spec，RUN_F437_PRODUCTION_REAL_GATE_INTEGRATION=1，真实 MySQL）证明成功路径（DeploymentRun/healthProbe/EnvironmentVersion/指针/审批消费/ReleaseRun succeeded）、D06/D09 双端 deferral+preflight unavailable、健康失败（日志保留、指针不动、ReleaseRun failed）。运行栈认证 1484x1324 浏览器证据 `/tmp/codex-tool-runs/svton/f437/f437-browser-evidence.json`：生产步骤 execute→success，ReleaseRun cmshqi5xu… succeeded、DeploymentRun cmshqj5jb… 经 ssh-v1 真实启动工作负载并 healthProbe passed、审批消费、EnvironmentVersion 前进、指针移动；commandPlan checkout/pull/build=false。focused API（real-gate 3 + production 相关 16）全过；API/Web type-check+build 过；i18n 3120 parity；diff check 两次干净。 |
| F438 | pending     | 在生产部署后更新/切换真实站点路由并完成 TLS/HTTP 浏览器探测，失败不得标记发布成功。                                | Route activation/probe boundary。            | AC-PROD-025～031；最终 URL 可访问。                                                                                                                                                                                                   |
| F439 | pending     | 为 Production 创建独立恢复发布申请，允许从历史成功环境版本产生新的 approval、DeploymentRun 和 EnvironmentVersion。 | Recovery ReleaseRun/API/policy。             | AC-ENVVER-011～017；不复用已消费审批。                                                                                                                                                                                                |
| F440 | pending     | 补齐 Production ReleaseRun/DeploymentRun 的日志抽屉、审批证据和失败恢复动作。                                      | Production evidence Web。                    | AC-PROD-032～038；每次运行不可覆盖。                                                                                                                                                                                                  |

### P3. Environment Versions And Project Governance

| ID   | Status  | Atomic TODO                                                                                                | Context Boundary                                 | Acceptance                                        |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| F441 | pending | 完善环境版本读模型，展示当前版本、来源发布单、Manifest、最近运行和完整变更历史。                           | EnvironmentVersion read API/Web cards。          | AC-ENVVER-001～006。                              |
| F442 | pending | 按环境过滤可升级/可回退候选，默认推荐最新合格制品或上一次成功版本。                                        | EnvironmentVersion candidate policy/Web select。 | AC-ENVVER-007～010；不接受文本版本/未知镜像。     |
| F443 | pending | 将项目设置改为独立页面和环境内子导航：部署目标、资源绑定、变量与密钥、域名与入口、保护规则。               | Settings IA/routes/layout。                      | AC-SET-001～009；不再用单个超长抽屉承载全部内容。 |
| F444 | pending | 固化 Staging/Production baseline 身份和生命周期，阻止无保护归档、重复 baseline 或 finalized 后静默换 key。 | ProjectEnvironment CRUD/policy/UI。              | AC-SET-010～016；普通显示名/配置仍按修订维护。    |
| F445 | pending | 实现按环境绑定/替换/复用部署目标服务器或 Provider target，并给出连通性校验。                               | Environment target binding。                     | AC-SET-017～024。                                 |
| F446 | pending | 实现按环境绑定资源实例和共享范围，区分基础设施生命周期与项目引用所有权。                                   | Resource binding/control-plane bridge。          | AC-SET-025～032。                                 |
| F447 | pending | 完善普通变量、Secret 引用、配置 revision/CAS、导入预览和跨环境复用交互。                                   | Environment config governance。                  | AC-SET-033～041；Secret 只保存引用。              |
| F448 | pending | 完善站点、域名、DNS、TLS、代理目标和流量入口的真实绑定/验证状态。                                          | Site/route/DNS/TLS project settings。            | AC-SET-042～050；配置状态与运行状态分离。         |
| F449 | pending | 将当前生效发布策略作为只读主视图，修改通过新修订流程；标准发布可执行，高级策略真实缺失时 fail closed。     | Release policy settings/capability。             | AC-POLICY-001～010。                              |

### P4. Visual, Interaction And Accessibility Parity

| ID   | Status  | Atomic TODO                                                                                                                     | Context Boundary                     | Acceptance                             |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| F450 | pending | 统一项目目录、接入、交付首页、发布详情、环境版本和设置页的 V13 spacing、density、typography、radius、border、color 和主次动作。 | Project-delivery visual layer only。 | AC-UI-001～010；1484×1324 同状态对照。 |
| F451 | pending | 补齐所有空态、阻断、运行中、成功、失败、审批和能力未就绪状态，并使用真实 fixture 而非页面硬编码。                               | Web state components/fixtures。      | AC-UI-011～018。                       |
| F452 | pending | 完成键盘、焦点、ARIA、Dialog/Drawer、错误提示、对比度和中英文可访问名称验收。                                                   | Accessibility only。                 | AC-A11Y-001～012。                     |
| F453 | pending | 完成窄屏、常规桌面和 1484×1324 参考 viewport 的响应式与无横向溢出验收。                                                         | Responsive/layout tests。            | AC-UI-019～025。                       |

### P5. Runtime, E2E And Final Closure

| ID   | Status  | Atomic TODO                                                                                                                               | Context Boundary                      | Acceptance                                         |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| F454 | pending | 建立 project/network/volume 命名空间隔离的 V13 parity Docker stack、真实示例仓库、目标工作负载、域名和 allowlist 可重复 seed/reset 工具。 | Test infrastructure only。            | AC-E2E-001～006；不污染开发/生产数据。             |
| F455 | pending | 跑通“接入仓库→识别→配置→发布单→构建→Staging→Production→浏览器访问”正向 E2E。                                                              | Cross-layer positive E2E。            | AC-E2E-007～015；Browser/API/DB/log 四类证据一致。 |
| F456 | pending | 跑通同发布单多次构建、同 Manifest 多次预发、环境升级和 Staging/Production 回退 E2E。                                                      | Version/history E2E。                 | AC-E2E-016～023。                                  |
| F457 | pending | 跑通权限、重复、异幂等键并发、配置漂移、门禁失败、Provider 关闭、Digest 错误、审批拒绝、探测失败和全证据凭据扫描负向 E2E。                | Negative/security E2E。               | AC-E2E-024～035。                                  |
| F458 | pending | 逐页执行 V13 视觉回归，保存 Demo/实际同 viewport 对照、DOM、交互录屏或步骤证据并关闭所有结构差异。                                        | Browser visual acceptance only。      | AC-VIS-001～012；无近白/重复/错页截图。            |
| F459 | pending | 独立完成产品、UX、无障碍、安全、领域一致性和数据泄漏对抗审查，并修复有效发现。                                                            | Independent audit/review。            | AC-REVIEW-001～008；审查人与实现 worker 分离。     |
| F460 | pending | 同步用户指南、迁移说明、TODO/progress/roadmap/board，运行全量 gate 并形成最终 parity verdict。                                            | Docs/full verification/final report。 | 所有 AC 均 pass；不存在未解释 partial/missing。    |

### Registered Post-Parity Hardening

| ID   | Status  | Atomic TODO                                                                                                                                                                                                              | Context Boundary                                                                            | Acceptance                                                                                                                             |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F461 | pending | 建立 durable repository-analysis execution：原子 DB claim/lease（owner/attempt/expiry）、heartbeat、stale takeover、CAS terminalization、exactly-one suggestion snapshot，以及 restart/multi-replica recovery。          | Repository-analysis execution ownership only；排在既定 parity slices 之后，不在 F415 实现。 | 真实 MySQL 双 worker、cancel/timeout/retry/stale-writer 证明。                                                                         |
| F462 | pending | 建立 repository Git egress/SSRF policy：批准 provider/self-hosted allowlist、DNS/IP resolution and pinning、拦截 loopback/link-local/private/metadata/redirect/rebinding，并规范 SSH/scp URL。                           | Repository Git network boundary only；排在既定 parity slices 之后，不在 F415 实现。         | 真实负向网络与 URL 规范化测试。                                                                                                        |
| F463 | pending | 建立 legacy repository identity inventory 和 collision-safe remediation：先 dry-run 报告 canonical/alias/provider/current-revision 冲突，再以可审计、幂等、可恢复事务创建 identity + initial revision 并逐项 reconcile。 | 历史 READY/connected 项目迁移 only；F416 只 fail closed，不推断或自动修复 legacy 身份。     | fresh/upgrade MySQL inventory、collision stop、idempotent apply/replay、partial-failure recovery、audit 和 post-migration build 证明。 |

## Worker Granularity Contract

- 一个 worker 只领取一个 Fxxx；若 Fxxx 仍需要跨越两个独立上下文，先由主会话拆成 `Fxxx.a/Fxxx.b` 再启动。
- Worker prompt 必须写明：允许路径、禁止路径、依赖、验收 AC、验证命令、结果文件、停止条件。
- Worker 不读取旧会话，不递归创建后继 worker，不修改自己范围外的 TODO 状态。
- 同 checkout 任意时刻只允许一个 active write worker；只读产品/领域/测试审查最多可并行三个。
- 每个 Fxxx 的顺序固定为：标记 `in_progress` → 改动 → 聚焦验证 → 浏览器/运行时证据（如适用）→ 记录 evidence → 标记 `done` → 原子提交。

## Verification Plan

- 每个 Fxxx：聚焦测试、相关 type-check/build、`git diff --check`、变更文件职责检查；高噪声输出隔离到 `/tmp/codex-tool-runs/svton/long-goals/devpilot-v13-demo-parity/`。
- 跨层行为：不得以 unit/type-check 替代 Docker+API+DB+Browser 证据。
- 视觉：同 viewport、同业务状态、同数据语义比较 Demo 与实际实现；先确认页面正确再接受截图。
- 真实发布：必须证明工作负载启动、配置注入、路由生效、HTTP/TLS 探测和浏览器访问；仅物化 ZIP 不算部署成功。
- 安全：Secret/token/credential 不得进入日志、快照明文、页面或证据包。

## Change Log

- 2026-08-04: F413 完成；根据 V13 Demo/canonical spec 与当前 worktree/API/DB/Docker/browser 审计，建立严格 1:1 parity 后继计划和验收清单。三路独立只读审查确认无需新增 F-ID，并细化越界 symlink、隔离 reset、异幂等键并发和全证据凭据扫描验收。F386-F412 保留为历史完成范围，不再作为最终 parity verdict。
