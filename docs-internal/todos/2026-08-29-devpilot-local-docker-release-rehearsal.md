# Devpilot 本地 Docker 发布全流程演练 TODO

> 状态：Done（Local Technical Acceptance）
> 路由：todo-plan
> 建立日期：2026-08-29
> 边界：只使用本机隔离 Docker 资源，不连接真实云、生产 DNS、生产凭据或生产流量；本地通过只代表 production-like technical acceptance。

## 目标

在保留当前脏工作树和既有 3120/3121 Devpilot 开发栈的前提下，搭建一套独立、可重复启动的 Docker 发布验收环境，并用当前代码真实执行：项目接入与冻结 → 环境配置 → 发布单创建 → 构建与 Manifest → Staging 部署与验证 → Production 预览、审批、执行与验证 → EnvironmentVersion 指针更新 → 路由/最终站点探测。

## 验收条件

- [x] **LDR001 隔离运行矩阵**：独立 Compose project、网络、数据库、Redis、构建/部署存储、只读 Git fixture、SSH 部署目标、路由控制器和目标工作负载均运行；端口与现有 3120/3121 栈不冲突。
- [x] **LDR002 可重复控制**：存在明确的启动、重置、状态、验证和停止入口；重置/停止只作用于 allowlist 内的 parity 资源，不修改用户其他容器和卷。
- [x] **LDR003 当前代码构建**：API、Web、route-control、deploy-target、target-workload 使用当前工作树构建；完整高输出日志写入 `/tmp/codex-tool-runs/svton/local-docker-release-rehearsal/`。
- [x] **LDR004 真实正向发布链**：通过真实 HTTP API 和持久化模型创建新项目事实与 ReleaseOrder，产生 succeeded BuildRun 与 ArtifactManifest，使用同一 Manifest 完成 Staging DeploymentRun，完成 Production preview/confirm/approval/execute，并产生 succeeded ReleaseRun、Production DeploymentRun 与当前 EnvironmentVersion。
- [x] **LDR005 验证与证据**：健康探测、workload probe、route-control apply/readback、最终站点 HTTP 200、日志/审计/运行记录均来自本次运行；禁止用 seed 的旧成功状态替代执行结果。
- [x] **LDR006 浏览器验收**：使用本次运行产生的项目与发布单，在桌面和 390px 页面核对发布生命周期、构建、预发、生产、验证与部署证据；截图保存到 `evaluation/screenshots/2026-08-29/local-docker-release-rehearsal/`。
- [x] **LDR007 诚实边界**：报告本地模拟覆盖、实际命令、通过/失败证据、修复项和仍需真实 Provider/生产环境验收的项目；本地环境在交付时保持运行，除非失败后必须安全清理。

## 当前切片

- [x] 复核工作树、仓库规则、项目技能、现有 G003 staging 与 V13 parity 资产。
- [x] 确认选用 `docker-compose.devpilot-parity.yml` 与 `scripts/parity-positive-e2e.mjs` 作为当前发布单模型的基线，而不是扩展旧 G003 控制面 runner。
- [x] 构建并启动隔离 parity 栈，记录运行矩阵与容器证据。
- [x] 运行 seed/reset 与本次正向发布链，修复当前代码漂移导致的本地问题。
- [x] **LDR004-R1 生产路由目标闭环**：结构化入口继续冻结真实服务名与端口；本地 route-control 必须通过显式 allowlist 将该组件目标解析到本次 Compose 内真实 workload，未知目标 fail-closed；生产 promotion 必须经 P03 独立审批后完成 apply/readback、最终站点探测与 EnvironmentVersion 提交。验收证据包括失败根因记录、定向单测、自测和一次全新 reset 后的完整正向运行。
- [x] **LDR006-R1 入口证据语义**：浏览器必须把 `siteProbe.tls.status=not_required` 显示为“无需 TLS”而非“不可用”，并保持中性状态；缺少阶段、日志或精确审计关联时继续展示如实空态，不使用推导或演示数据补齐。验收证据包括组件定向测试、i18n 校验和重建后 Drawer 截图。
- [x] **LDR006-R2 已完成发布的决策告警收口**：发布已由独立 ReleaseRun、DeploymentRun、EnvironmentVersion 与发布后验证证据确认 `succeeded` 时，页面不再渲染“当前准入决策”告警；生产检查面板仍展示本次精确 Preview 的 D01-D20 结果。活动、失败或阻断发布仍必须 fail-closed 展示决策告警。
- [x] 完成浏览器、截图、静态/结构检查并更新本 TODO。

## 已确认调用链

- 运行环境：`docker-compose.devpilot-parity.yml` → MySQL / Redis / API / Web / route-control / deploy-target / target-workload。
- 数据与隔离：`scripts/parity-seed.mjs` → fixture Git → migrate → deterministic seed/reset/inventory。
- 发布链：`scripts/parity-positive-e2e.mjs` → project intake/config revisions → `/projects/:projectId/delivery/releases` → BuildRun/ArtifactManifest → Staging DeploymentRun → Production ReleaseRun/OperationApproval/DeploymentRun → EnvironmentVersion → route/site probe。
- 影响验证：`release-parity-compose.spec.ts`、parity self-tests、API/Web type-check/build、Compose config、CodeGraph affected、浏览器交互。

## 完成证据（2026-08-30）

- **最终全链**：`local-release-current-worktree-full-run-v29-20260830-030653.log` exit 0，用时 263965ms。新建 Project `cmter9vlk000bhyld5ntx7g6s`、ReleaseOrder `cmter9x8m002rhyld44nqfun7`、Production DeploymentRun `cmterarh400cthyldnv0zb6qt`；最后一条路由结果为 `switched`。完整日志位于 `/tmp/codex-tool-runs/svton/local-docker-release-rehearsal/final/svton/`。
- **真实门禁与运行**：Production Preview 页面展示 19 项全部通过，P03 先阻断、后由 reviewer 针对精确 evaluation 复核；二次 resume 后 ReleaseRun、OperationApproval、Production DeploymentRun、EnvironmentVersion、route apply/readback 和站点 HTTP 200 全部持久化并回读。
- **页面修复**：`siteProbe.tls.status=not_required` 改为“无需 TLS”；已完成发布不再显示过期的“当前准入决策 / 检查不可用”告警，生产检查历史仍展示 D01-D20 的精确结果。探测展示由 296 行拆分为 91/178/35 行的组合、视图和状态模型。
- **浏览器**：桌面截图为 `project-overview-desktop.png`、`release-production-check-desktop.png`、`release-production-deployment-desktop.png`、`release-validation-desktop.png`、`release-completion-desktop.png`、`deployment-evidence-drawer-desktop.png`；390px 为 `release-validation-mobile-390.png`、`deployment-evidence-drawer-mobile-390.png`。发布后验证为 `1 / 1` 与 `6 / 6`；桌面和移动页面的 document/body 均未超出 viewport，部署表在 390px 时为 `clientWidth=356 / scrollWidth=1080` 的内部滚动。
- **验证**：Web 全量测试、Web/API type-check、i18n、CodeGraph sync/affected 和本次 7 个 route/promotion/gate/evidence 自测均 exit 0；Web/API production build 包含在 v29 全链。全量 `parity-selftest-suite` 仍有一个与本切片无关的历史浏览器正则断言失败：目标 `realpath(...)` 代码存在但被换行；未越界改写该用户文件。
- **运行与磁盘**：Web/API/build-launcher/route-control/MySQL/Redis/target-workload/deploy-target 八容器保持运行，具有 healthcheck 的六个服务均 healthy。最终又清理了未使用镜像和 BuildKit 缓存，Build Cache 为 0，主机可用空间约 74GiB；未删除任何卷或运行中容器。

## 真实限制

- 当前工作树包含大量用户与此前改造的未提交内容，因此不能使用要求 clean git identity 的 `scripts/parity-isolated-c5.mjs`；本切片会使用独立固定 parity namespace 构建当前工作树，并明确标记为本地 technical acceptance，而不是 C5 clean-source provenance 或真实生产签收。
- 公网 DNS/TLS、真实云容量/资源供给、外部可观测 Provider、真实生产备份恢复与真实流量切换不在本地模拟结论内。
