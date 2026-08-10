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
| F669.1 | pending | 独立 CR 审查公共契约、状态机、安全与回归。 | 只读 diff + affected tests。 | P0-P3 finding ledger |
| F669.2 | pending | 架构师综合调研/CR 并裁决最终边界。 | 跨层依赖、单一职责、文件 <= 200 行。 | architecture verdict |
| F669.3 | pending | 运行 focused/full risk-matched 检查和真实 Browser/E2E。 | 隔离日志，不触碰共享生产栈。 | commands/logs/screenshots |
| F669.4 | pending | 同步 TODO/progress/acceptance，提交并推送。 | 仅本任务路径和明确保留的既有改动。 | commit/push evidence |

## Verification Plan

- API/Web focused unit and integration tests for every changed policy/presenter/action path.
- API/Web type-check, production build, i18n parity and `git diff --check`, with noisy output stored under `/tmp/codex-tool-runs/svton/f665-f669/`.
- Current-run Browser evidence for project settings, gate detail, Build/Staging blocked states, Environment Versions deploy/recovery layout at 1484x1324, 1280x800 and 390x844.
- Negative E2E must prove a missing/mismatched deployment target and a required failed/unavailable gate create no downstream BuildRun/DeploymentRun/EnvironmentVersion.

## Change Log

- 2026-08-10 20:15: Created initial plan; investigation only, no business-code edits yet.
- 2026-08-10 20:20: Renumbered the plan to globally unique F665-F669 after checking the current OpenCode acceptance ledger through F664.
- 2026-08-10 21:10: Completed three independent read-only audits, current-stack browser reproduction, five architecture maps and the source-backed root-cause matrix. Confirmed P0 EnvironmentVersion Staging global-target bypass and global gate deferrals.
- 2026-08-10 21:53: Completed implementation slices for fail-closed delivery, target readiness, canonical baselines, resource/Secret variable ownership, safe repository requirement suggestions, real service-port routes, structured route activation, phase-accurate preflight and EnvironmentVersion action UX. Full API tests (306 suites/1861 tests) and full Web tests (104 files/461 tests) passed; API/Web builds and i18n parity passed.
