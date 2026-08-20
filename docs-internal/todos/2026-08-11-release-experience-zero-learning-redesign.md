# Release Experience Zero-learning Redesign

## Goal

以已合入 `master` 的 F665-F673 代码与当前 Docker 运行态为唯一事实来源，重新验证项目创建、环境配置、前置检查、构建、预发、生产发布、环境版本与恢复链路；保留历史迁移样本并用任务自有的新项目验证干净路径，随后将已确认能力重构为接近零学习成本、逐步显露复杂度的发布体验。

## Scope

- In scope: 新旧项目数据策略；项目创建到 Production 的全链路 Browser/API/DB 验证；原始问题逐项回归；页面信息架构、交互、视觉、响应式与可访问性；真实截图驱动的三套设计方向与完整交互画板；选定方案的 Web/API 最小必要实现；Draft MR、独立 CR、架构复核、提交与推送。
- Out of scope: 外部公网 DNS/TLS 与未配置云 Provider 的真实生产签收；删除非本任务创建的数据；与本链路无关的全站视觉改版。

## Confirmed Constraints

- 基线：`master@3e5cc991`，F665-F673 已合入并已重建 Docker；本任务在 `codex/f674-release-ux-redesign` 独立 worktree 内进行。
- 旧项目在调研结论前不得删除；默认将其作为 legacy/migration 回归样本，只清理本任务创建且已经完成证据留存的可回收数据。
- 视觉设计必须基于当前运行态截图与现有 design tokens/components，不从文字猜测产品样式。
- 实现遵循 invest -> 单 writer impl -> Draft MR -> 独立 product/frontend/backend/test CR -> architect -> 修复 -> commit/push。

## Functional TODO Breakdown

| ID | Status | Atomic TODO | Evidence |
| --- | --- | --- | --- |
| F674 | in_progress | 逐项复核原始问题在 API/Web/Prisma/Provider 与当前 Docker 运行态的真实状态，并裁决旧项目保留、迁移或清理策略。 | 调用图、issue matrix、Browser/API/DB 证据 |
| F675 | pending | 完整走查新项目从创建到生产/恢复的链路，建立业务逻辑图、组织架构图、功能地图、数据流图、页面结构图与页面/状态覆盖矩阵。 | 架构文档、逐页截图、响应式/a11y 审计 |
| F676 | pending | 基于真实截图产出三套视觉/交互方向，通过对抗性设计复核选择一套并完成可交互画板。 | `visualize` 画板与选择记录 |
| F677 | completed | 由唯一 impl writer 按选定方案实施，保持单一职责、依赖无环、源文件不超过 200 行。 | S1-S6 原子 diff；`/tmp/codex-tool-runs/svton/f674-impl-*` focused tests/type-check |
| F678 | in_progress | 创建 Draft MR，完成 product/frontend/backend/test 独立 CR 与架构师裁决，修复后执行全量、Docker、Browser、API/DB 验证并 commit/push。 | MR、CR ledger、日志、最终截图 |
| F679 | completed | 将现有 Step 0 发布进度页升级为真实数据驱动的发布工作台：摘要、阶段流水线、阻断/下一动作、证据与活动侧栏，并保留生产预览、审批、重试和恢复能力。 | 减法式重排、工程验证与 Browser 设计复验完成；见 `design-qa.md` 和 `docs-internal/devpilot/audits/2026-08-20-release-workbench-reaudit/15-reference-vs-final-focused.jpg`。 |

### F679 减法式重排

- [x] 合并发布身份、执行状态与关键事实，移除 Header/Summary 重复和首屏技术 ID 噪声。
- [x] 只保留一个当前执行态，并以中性样式表达“正在查看”的历史阶段。
- [x] 将阻断结论、首要原因和真实修复入口收敛为唯一决策卡，校正 CTA 优先级。
- [x] 降低当前阶段容器与检查卡密度，高级检查和技术标识渐进披露。
- [x] 右栏默认聚合最近运行与同类历史尝试，证据绑定真实 Run 并可下钻。
- [x] 完成 focused tests、type-check、i18n、production build、Docker 和 Browser 桌面/390px/键盘/axe/视觉对照复验。

## Acceptance Rules

- 原始问题每项只能标为 `verified_fixed`、`partially_fixed`、`not_fixed` 或 `not_applicable`，且必须给出当前源码与运行证据。
- 新旧项目必须分别覆盖 legacy compatibility 与 clean creation；不以删除旧数据掩盖迁移问题。
- UI 必须默认回答“当前在哪一步、为何阻断、下一步做什么、执行后发生什么”，高级证据按需展开。
- 桌面与 390px 主链均无信息溢出、不可见操作、仅颜色表达状态或小于 44px 的主交互目标。

## Change Log

- 2026-08-11: 创建 F674-F678；完成 master/Docker 基线确认并开始三路只读 invest 与当前运行态截图审计。
- 2026-08-11: F677 实施完成：服务端 checkpoint/两阶段 Build/Production post+promote、双基线组件身份、统一变量与路由要求、readiness v2，以及方向 A 的 blocker-first/渐进披露 UI；外部 Provider 缺口继续 fail-closed，转入 F678 独立 CR 与运行态验收。
- 2026-08-11: F678 架构 CR 的最终源码修复已完成：收紧迁移索引、host launcher 目录与供应证明、只读源码/可写构建副本、launcher 停机回收、legacy promotion 唯一反查和 UI 领域阻断展示。Docker、迁移应用、Browser/API/DB 运行态验收仍未执行，因此 F674/F678 保持 `in_progress`，不得视为生产签收。
- 2026-08-12: F678 供应链源码收口：Semgrep 固定为已验证可解析的 26 个 OSS 规则子树并对不支持扩展前置 fail-closed；新增 lockfile-bound pnpm dependency-store 的签名策略、持久化 CAS、不可变逐文件证明、受信 fetcher 与离线 build 消费链。固定 npm registry 是应用层 allowlist，不冒充网络防火墙；Docker/DB/Browser 运行态仍未执行，F674/F678 继续 `in_progress`。
- 2026-08-12: dependency-store CR 闭环移除 fetcher 普通 bridge 直出，改为每任务 internal network 与固定 registry CONNECT proxy；锁文件改为严格 YAML AST，租约只持久化 hash/expiry/heartbeat，损坏缓存隔离重取，BuildRun 与成功 store 同事务冻结且制品提交复验。Docker/DB 仍未执行，运行签收继续 fail-closed。
- 2026-08-12: dependency-store 最终 CR 修复 cold-create ID、无状态变更的 succeeded probe、signed dependency-ready 提前释放 lease、坏缓存 quarantine+CAS invalidation、历史 BuildRun/evidence 不变量、完整 npm auth/DNS special-use 拒绝与 launcher stale network 回收。focused/typecheck/Prisma 源码验证完成；Docker/MySQL 运行态仍待签收。
- 2026-08-12: dependency-store cache generation 以 additive `230000` migration 落地；claim 单调递增，reuse/ready/final/BuildRun/制品证明均冻结同一 generation，阻断相同 digest 的 G1/G2 ABA。运行态迁移证据仅到 `c8f200000`，`220000` 从未被 runtime 应用，因此未修改 `220000`；Docker/MySQL 仍未在本切片执行。
- 2026-08-12: dependency fetch 网络按 Docker engine 证明分为 native direct-public-DNS 与 exact Docker Desktop engine-proxy；mode/evidence 已冻结到 launcher、worker、fetch identity 和 manifest，engine tuple 漂移即撤销 proof。Acceptance image 同时提供受供应摘要约束的 regular `/usr/local/bin/pnpm`；源码测试通过，Docker 运行仍待签收。
- 2026-08-19: 启动 F679。选定参考图二的发布工作台为主结构、参考图一的活动栏为辅；不复制竞品模糊迭代状态，所有阶段与 CTA 必须来自当前 ReleaseOrder、Gate Catalog、BuildRun、DeploymentRun、ReleaseRun、OperationApproval 和 EnvironmentVersion 事实。
- 2026-08-20: F679 完成。canonical 项目发布路由已形成真实数据驱动的发布工作台，旧发布详情路由统一重定向；生产门禁缺失按失败关闭，活动/证据支持阶段深链。29 项 focused tests、type-check、i18n、production build 与 Docker 当前产物通过；Browser 验证桌面、390px、键盘、深链、旧路由重定向和 axe 0 违规，设计对照见 `docs-internal/devpilot/audits/2026-08-19-release-workbench/release-workbench-design-comparison.png`。
- 2026-08-20: F679 视觉层级复审撤销设计通过结论并恢复为 `in_progress`。当前工程与数据真实性保持通过，但实际页面仍存在双当前态、同一阻断多处重复、Header/Summary/Stepper/Stage/Rail 同屏争夺、右栏重复运行噪声等 P0；证据与减法式重排骨架见 `docs-internal/devpilot/audits/2026-08-20-release-workbench-reaudit/audit.md`。
- 2026-08-20: F679 减法式重排开始实施；验收顺序固定为紧凑发布头、唯一执行态、唯一决策卡、低噪声阶段区、分组活动/证据栏，且不补造负责人、变更数或操作者。
- 2026-08-20: F679 减法式重排完成。运行态只保留一个服务端执行阶段，历史查看态独立表达；阻断收敛为唯一决策卡，Gate Catalog 改为单一 controller，活动按 Run 分组、证据按真实 Run 下钻，技术细节默认折叠。10 个 focused test 文件共 41 项、type-check、i18n 3,854 条、production build、Docker 重建与 Browser 桌面/390px/键盘/深链/axe 0 违规均通过，最终设计 QA 为 passed。
