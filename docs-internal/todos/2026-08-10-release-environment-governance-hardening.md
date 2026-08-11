# Release Environment Governance Hardening

## Goal

以当前代码、运行页面和真实服务端行为为依据，统一项目环境、环境版本与发布步骤的产品口径；补齐部署目标、资源/变量/入口自动化与前置检查的可解释性和不可绕过门禁，并修复环境版本操作区的交互层级与组件一致性。

## Scope

- In scope: 项目环境设置、环境版本、发布单前置检查/构建/预发、部署目标与 Provider 绑定、资源/变量/Secret/入口识别和映射、服务端门禁、相关 API/Web 测试及当前运行实例的浏览器证据。
- Out of scope: Production 外部 DNS/TLS/云 Provider 签收、现有 intake/secret/source-gate 未提交改动的重写、无证据支撑的新部署策略。

## Clarifications And Assumptions

- Confirmed: 仓库既有 F424-F449/F441-F448 验收将这些能力记录为已完成，但当前用户实测结果与该结论冲突，必须以当前源码和新运行证据重新裁决。
- Confirmed: 当前 checkout 有未提交的 intake/release-delivery/repository-analysis/application-service-config 改动，视为既有并行工作，禁止覆盖或重置。
- Confirmed: 仅 Staging/Production 是发布基线环境；其他项目环境是否展示以及如何映射到发布基线，必须由当前域模型和调用链裁决，不凭文案猜测。
- Assumption: 在调研完成前不修改业务代码；发现与既有 dirty 路径重叠时优先拆分边界，无法安全拆分才请求协调。

## Workflow Routing

`routing: specialized-workflow + noisy-tools; 跨 Web/API/持久化/Provider/浏览器行为，使用 invest -> 单 writer impl -> review -> architect -> verify。`

## Functional TODO Breakdown

### F665. 现状、域模型与可观测证据

Purpose: 逐项证明当前行为、代码根因和跨层影响，作为唯一实现输入。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F665.1 | completed | 建立环境、环境版本、发布与设置的路由/组件/API/服务/数据模型调用图。 | 只读 Web/API/Prisma/测试。 | `docs-internal/devpilot/release-environment-governance-architecture.md` |
| F665.2 | completed | 在当前运行实例逐步复现并截图记录用户列出的页面与动作。 | 只读浏览器；不提交生产性动作。 | `/tmp/codex-tool-runs/svton/f665-f669/browser/01-11*.png` |
| F665.3 | completed | 对照 F424-F449/F441-F448 验收与当前代码，列出事实冲突、根因和修复边界。 | TODO/progress/acceptance + 当前源码。 | 架构文档 Root Cause And Acceptance Matrix |
| F665.4 | completed | 产出业务逻辑图、组织架构图、功能地图、数据流图、页面结构图。 | 仅使用 F665.1-F665.3 已确认事实。 | 架构文档五张 Mermaid 图 |

### F666. 环境口径与配置自动化

Purpose: 让环境身份、部署目标、资源、变量/Secret 和入口配置可理解、可完成且不产生假成功。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F666.1 | completed | 统一项目环境与发布基线环境的展示、映射和说明。 | ProjectEnvironment/EnvironmentVersion/Web IA。 | 新项目双基线 tests + Web 分组 tests |
| F666.2 | completed | 补齐部署目标必需约束及 Provider 匹配的前后端一致校验。 | Target binding + staging/upgrade/recovery execution。 | target readiness + zero-side-effect tests |
| F666.3 | completed | 补齐资源申请到绑定、变量引用/替换和配置快照的闭环。 | ResourceBinding/ConfigRevision/DeploymentInput。 | 资源映射/跨源 collision/API+Web tests |
| F666.4 | completed | 补齐 `.env` 识别/导入预览与变量/Secret 分类交互，不落库明文 Secret。 | Repository analysis/intake + config import。 | safe requirement suggestion tests |
| F666.5 | completed | 补齐组件/端口识别到域名入口候选的可审查映射。 | Component metadata + routeSnapshot。 | real service port + route activation tests |

### F667. 前置检查可解释门禁

Purpose: 用户能看到状态来源、检查过程和逐项证据，且任何后续动作都不能绕过必需门禁。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F667.1 | completed | 统一六态定义、Provider 可用性和不可用原因展示。 | Gate catalog/read model/Web。 | phase summary + readiness tests |
| F667.2 | completed | 提供逐项执行过程、结果、证据时间和恢复动作。 | Gate evidence presenter/Web detail。 | filtered catalog/refresh/manual confirm tests |
| F667.3 | completed | Build/Staging/EnvironmentVersion 动作共享服务端 fail-closed 决策。 | Gate policy + command services；禁止仅 UI 门禁。 | full API/Web tests + negative focused tests |

### F668. 环境版本操作交互

Purpose: 让部署、回退和候选选择遵循一个清晰动作层级并保持尺寸一致。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F668.1 | completed | 将“升级版本”动作统一为用户任务导向的“部署”，消除二次同义确认。 | EnvironmentVersion card/dialog copy。 | focused Web tests |
| F668.2 | completed | 重排部署/回退动作层级和同行布局。 | EnvironmentVersion action group only。 | shared responsive toolbar |
| F668.3 | completed | 统一按钮与选择框高度、密度、焦点和窄屏行为。 | Existing design system components。 | min-h-11 + responsive source checks |

### F669. 审阅、验证与交付

Purpose: 通过独立复核和真实行为证据关闭回归风险。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F669.1 | completed | 独立 CR 审查公共契约、状态机、安全与回归。 | 只读 diff + affected tests。 | 多轮 P0-P3 ledger；最终限定范围 GO |
| F669.2 | completed | 架构师综合调研/CR 并裁决最终边界。 | 跨层依赖、单一职责、文件 <= 200 行。 | Saga、幂等、组件隔离和就绪度综合裁决 |
| F669.3 | completed | 运行 focused/full risk-matched 检查和真实 Browser/E2E。 | 隔离日志，不触碰共享生产栈。 | API 314/1903、Web 107/479；`f665-browser-final/01-07` |
| F669.4 | completed | 同步 TODO/architecture，提交并推送。 | 仅本任务路径和明确保留的既有改动。 | `codex/f665-release-environment-governance` + Draft PR #2 |

### F670. 动作真实性与冻结输入

Purpose: 环境版本动作必须具备动作级幂等、先冻结后门禁、且终态门禁只读取 ReleaseRun 冻结事实。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F670.1 | completed | 为部署/回退 DTO、Web action 与 DeploymentRun reservation 增加动作级幂等键和输入漂移冲突。 | EnvironmentVersion action only。 | reservation focused specs |
| F670.2 | completed | 将 prepare/freeze 前置，并把 Provider、bindingId、inputHash 写入 gate target/action context。 | EnvironmentVersion execution/gates。 | execution focused specs + API type-check |
| F670.3 | completed | D14/D15/D16、activation 与 final promote 统一解析 ReleaseRun 冻结 route/config 和唯一 active Site。 | Frozen route/site resolution。 | `f672-frozen-site-final-20260810.log` |

### F671. 组件级运行环境隔离

Purpose: 资源变量只能注入其声明组件，plain/Secret 保持全局，并保证运行文件与证据无明文泄露。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F671.1 | completed | 输入契约拆分 globalEnvironment 与 componentEnvironments，资源绑定必须提供真实 componentKey。 | Deployment input preparation/snapshot。 | 5 suites / 37 tests |
| F671.2 | completed | workload/local/SSH 为每个组件生成独立 0600 环境文件。 | Provider adapters/workload runtime。 | workload/local/SSH focused specs（5 suites / 37 tests） |
| F671.3 | completed | 快照只记录 componentKey、envBindings、key/hash，不记录变量或凭据值。 | Persisted deployment evidence。 | snapshot/no-plaintext assertions |

### F672. 就绪度与路由编辑真实性

Purpose: 每个发布基线环境返回自己的目标就绪度；路由编辑只使用真实组件目标并提供完整草稿操作。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F672.1 | completed | 目标 readiness 纳入唯一绑定、Provider、SSH root、server online 与连接字段，形成六态。 | API readiness/read model。 | 2 suites / 28 tests + API type-check |
| F672.2 | completed | EnvironmentVersion 未 ready 时禁用部署/回退并链接精确环境 Targets。 | EnvironmentVersion Web。 | 2 files / 23 tests + Web type-check |
| F672.3 | completed | 路由编辑器使用真实目标默认值、domain+path identity、编辑/删除、完整校验、draft/current 与 44px 触控动作。 | Routes settings Web。 | 4 files focused tests + Web type-check |

### F673. Production 路由切换事务与恢复

Purpose: Production 切流必须可观测、可补偿、可恢复，并在路由状态未知时阻断新的生产动作。

| ID | Status | Atomic TODO | Context Boundary | Evidence |
|----|--------|-------------|------------------|----------|
| F673.1 | completed | 将切流建模为 prepare/apply/probe/final-gate/commit-or-compensate 的持久化 Saga。 | Site route switch + EnvironmentVersion finalization。 | switch/probe/gate/completion failure focused specs |
| F673.2 | completed | Provider 先握手并 observe 当前路由，apply/compensate 均使用 expectedCurrent CAS。 | Configured HTTP route Provider。 | HTTP 409 fail-close + provider drift specs |
| F673.3 | completed | 标准上线、恢复、门禁、执行和 reservation 共用非终态 Saga guard 与环境行锁。 | Production command boundaries。 | confirm/recovery/no-side-effect specs |
| F673.4 | completed | 周期恢复使用 lease、退避、次数上限和带完整责任上下文的精确 CAS 告警。 | Recovery worker/repository。 | 2 suites / 8 tests + API type-check |

## Verification Plan

- API/Web focused unit and integration tests for every changed policy/presenter/action path.
- API/Web type-check, production build, i18n parity and `git diff --check`, with noisy output stored under `/tmp/codex-tool-runs/svton/`.
- Current-run Browser evidence for project settings, gate detail, Build/Staging blocked states, Environment Versions deploy/recovery layout at 1484x1324, 1280x800 and 390x844.
- Negative E2E must prove a missing/mismatched deployment target and a required failed/unavailable gate create no downstream BuildRun/DeploymentRun/EnvironmentVersion.

## Change Log

- 2026-08-10 20:15: Created initial plan; investigation only, no business-code edits yet.
- 2026-08-10 20:20: Renumbered the plan to globally unique F665-F669 after checking the current OpenCode acceptance ledger through F664.
- 2026-08-10 21:10: Completed three independent read-only audits, current-stack browser reproduction, five architecture maps and the source-backed root-cause matrix. Confirmed P0 EnvironmentVersion Staging global-target bypass and global gate deferrals.
- 2026-08-10 21:53: Completed implementation slices for fail-closed delivery, target readiness, canonical baselines, resource/Secret variable ownership, safe repository requirement suggestions, real service-port routes, structured route activation, phase-accurate preflight and EnvironmentVersion action UX. Full API tests (306 suites/1861 tests) and full Web tests (104 files/461 tests) passed; API/Web builds and i18n parity passed.
- 2026-08-10 23:10: Registered F670-F672 after Draft PR architecture review. Completed action idempotency/frozen truth, component-scoped 0600 environment injection, six-state per-environment readiness, EnvironmentVersion repair links and the real-target route editor. This follow-up has focused tests and API/Web type-check evidence; full-suite/browser rerun remains F669.3.
- 2026-08-11 00:35: Closed all adversarial P0-P2 findings, including actor-bound early idempotent replay, truthful legacy resource repair, all-owner Site resolution and the durable Production route-switch Saga with Provider CAS, compensation, periodic recovery and guarded follow-up actions. Final review verdict is GO.
- 2026-08-11 00:40: Final verification passed: API 314 suites / 1903 tests, Web 107 files / 479 tests, API/Web type-check and build, i18n parity and diff-check. Current-source Browser evidence at desktop and 390px confirms fail-closed preflight, per-environment target readiness, baseline/custom grouping, component resource mapping, real service ports and the EnvironmentVersion toolbar.
