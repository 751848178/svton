# Devpilot MVP Release Flow Closure

## Goal

在不改变现有视觉语言的前提下，把项目发布与配置主路径长期收敛为可恢复的最小闭环：用户只需创建版本、构建、部署并查看必要日志；所有约定修改必须在代码、测试、真实浏览器和可丢弃本地运行环境中得到一致证明，最终跑通一次真实的开发到部署流程后才允许关闭任务。

## Scope

- In scope：项目概览及所有项目子页的父级返回；发布创建、列表、输入、构建、部署、日志与状态回读；仓库摘要；项目配置与部署目标；`basic_v1` 门禁；桌面/移动端；本地可丢弃 Docker/parity 环境端到端验证。
- In scope：高级发布、访问权限、验证监控、环境版本、域名与治理能力暂离 MVP 主入口，但保留实现、数据和恢复边界。
- Out of scope：公网 DNS/TLS、真实云厂商生产凭据、外部生产 Provider 签收，以及未经用户授权的提交、推送、合并或生产部署。

## Clarifications And Assumptions

- Confirmed：页面继续使用当前组件、间距、颜色与交互样式，不重做视觉系统。
- Confirmed：真正完成必须包含一次创建发布、真实构建、真实预发部署、日志和最终状态回读；type-check、mock、截图或 dry-run 不能单独作为部署完成证据。
- Confirmed：项目概览返回项目列表；项目配置、发布详情及其他项目子页返回项目概览；配置页不增加右上角“项目概览”。
- Confirmed：发布单至少包含“预发 → 生产（线上）”两个一级阶段；预发只包含构建和部署，生产只包含部署并强制复用预发成功的不可变构建产物。
- Assumption：本轮“整个开发部署流程”指仓库自带的可丢弃本地环境闭环；外部生产环境只记录明确边界，不阻塞本地 MVP 关闭。

## Workflow Routing

`routing: long-goal + noisy-tools; 多模块、跨 Web/API/运行时且必须形成真实部署证据，使用唯一 orchestrator、单写者、长期进度板和隔离日志。`

`2026-09-03 extension routing: todo-plan; 团队前置状态是已关闭 MVP 的同域增量，复用本 TODO，以 Web 路由入口统一门控并做定向浏览器验证。`

`2026-09-03 action-hierarchy routing: todo-plan; 发布动作状态是 F7 两阶段流程的同域收口，复用本 TODO，通过定向组件测试、重新构建和浏览器回读验证。`

长期进度板：`/tmp/codex-tool-runs/svton/long-goals/devpilot-mvp-release-flow-closure/board.json`

## Functional TODO Breakdown

### F1. 固化最小产品合同

Purpose：把已确认的界面、流程、隐藏边界和可恢复策略变成唯一可追踪合同。

| ID   | Status | Atomic TODO                                    | Context Boundary                     | Evidence                                                                                                           |
| ---- | ------ | ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| F1.1 | done   | 复核 PMC073 已落地修改与用户当前目标一致。     | 只读核对项目工作台、发布和配置代码。 | `2026-08-27-devpilot-project-module-content-closure.md` PMC073；2026-09-03 浏览器证据。                            |
| F1.2 | done   | 建立长期目标、唯一进度板与本验收矩阵。         | 计划与编排文件，不修改产品行为。     | Codex goal active；long-goal board；本文。                                                                         |
| F1.3 | done   | 独立审计需求到代码、测试和运行证据的剩余缺口。 | S001 只读 worker；禁止修改。         | `workers/s001-result.json`：确认可见功能已覆盖，缺口为新真实运行、运行态 profile、组合测试和目标表断言，均已补齐。 |

### F2. 最小发布与项目配置实现

Purpose：确保实际可见产品只暴露跑通 MVP 所需的信息、动作和配置。

| ID   | Status     | Atomic TODO                                                                                       | Context Boundary                                        | Evidence                                |
| ---- | ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| F2.1 | done       | 发布创建只要求版本号；发布输入只展示版本、来源分支和目标预发环境。                                | Web 创建弹窗与发布详情。                                | focused/full Web tests；桌面浏览器。    |
| F2.2 | superseded | 可见发布流程仅为“构建 → 部署”，保留必要日志，隐藏历史、证据、生产与验证流程。                     | Web workbench；高级组件不删除。                         | 已由 F7 的“预发 → 生产”两阶段合同取代。 |
| F2.3 | done       | 发布列表与详情移除内部 ID、Commit、Manifest、digest 和旧治理说明。                                | Web 发布摘要与状态模型。                                | Web full suite；parity 数据浏览器回读。 |
| F2.4 | done       | 仓库摘要移除托管与可见性、当前 Commit。                                                           | 项目概览仓库折叠区。                                    | focused test；浏览器语义快照。          |
| F2.5 | done       | 配置默认进入部署目标，只显示部署目标、资源绑定、变量与密钥；目标表保留 Server、路径、状态和编辑。 | 项目配置环境区域。                                      | focused/full tests；桌面浏览器。        |
| F2.6 | done       | 项目页返回层级统一，配置页移除重复右上返回入口。                                                  | 共享 Header 与发布 Header。                             | navigation specs；浏览器点击回读。      |
| F2.7 | done       | `basic_v1` 仅保留源码可解析、成功组件制品和不可变摘要等最小门禁。                                 | API release-delivery policy；部署执行器安全检查不放宽。 | API focused tests/type-check/build。    |

### F3. 验证真实开发部署闭环

Purpose：证明当前 MVP 不只是能渲染，而是能真实创建、构建、部署并回读。

| ID   | Status | Atomic TODO                                                       | Context Boundary                                        | Evidence                                                                                                 |
| ---- | ------ | ----------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| F3.1 | done   | 选择并审计仓库内最安全、可重复、可清理的本地 E2E 路径。           | S002 只读 worker；只研究脚本、compose、API 和证据规范。 | `workers/s002-result.json`：选定 dirty-worktree aware local rehearsal，并补齐 manifest-bound destroy。   |
| F3.2 | done   | 建立隔离运行环境并记录镜像、端口、数据库、仓库与测试账号来源。    | 不触碰现有用户数据；环境必须可回收。                    | runtime `c5-47daa01d-73e487fe`；Web 4131、API 4132、目标 43992；8 个服务运行且 health 通过。             |
| F3.3 | done   | 通过真实 UI/API 创建新的发布版本并回读持久化发布单。              | 使用一次性版本；不复用旧成功记录。                      | project `cmtkeewhv000brnztxyb2u6x5`；releaseOrder `cmtkeey2j002rrnztedhofemz`；浏览器/API/DB 同一 ID。   |
| F3.4 | done   | 触发真实构建并验证非 dry-run 终态、Manifest 与日志。              | 必须由实际 worker/executor 完成。                       | BuildRun `cmtkeey8w0060rnztniusa5ql` succeeded；Manifest `cmtkefp33007mrnzth2c6io3o`；26 行脱敏日志。    |
| F3.5 | done   | 使用该构建触发真实预发部署并验证工作负载与健康结果。              | 必须复用同一 Manifest；禁止伪造运行。                   | DeploymentRun `cmtkefp790099rnztkxecyrpl` completed；sameManifest/artifactVerified true；目标 HTTP 200。 |
| F3.6 | done   | 在 MVP 页面回读同一发布的“已部署”、时间和日志，且不泄露隐藏字段。 | 桌面与 390px；不打开高级深链。                          | 桌面/390px 浏览器快照与 6 张截图；页面/Drawer `scrollWidth === innerWidth`。                             |
| F3.7 | done   | 执行失败判定、残留检查和环境清理/恢复。                           | 失败必须为 hard failure；恢复原有容器。                 | runtime manifest `destroyed`；`verified_zero_residuals`；原 Devpilot/deyi 服务状态未变。                 |

### F4. 最终一致性与关闭

Purpose：保证代码、产品、运行态、文档和长期目标状态一致。

| ID   | Status | Atomic TODO                                                                          | Context Boundary                               | Evidence                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| F4.1 | done   | 修复 F1/F3 审计发现的所有相关缺口并补定向测试。                                      | 单一 active writer；不处理无关 dirty changes。 | runtime profile、basic drawers、组合/目标表测试、隔离运行 destroy 均已补齐。 |
| F4.2 | done   | 执行最终 Web/API 全量测试、type-check、build、i18n、CodeGraph 与 scoped diff check。 | 高输出写入隔离日志。                           | 全部 exit 0；证据在 `final-regression/`。                                    |
| F4.3 | done   | 逐项复核验证矩阵，更新本文、PMC073 与 long-goal board。                              | 证据与状态必须一致。                           | V01-V46 全部 pass；board workers 全部 completed。                            |
| F4.4 | done   | 仅在无必需缺口、无本地残留且端到端闭环成功后完成 Codex goal。                        | 外部生产边界单独声明。                         | 本地 MVP goal 已满足关闭条件；外部生产仍为明确 out of scope。                |

### F5. 团队作用域前置引导

Purpose：把“尚未创建/选择团队”从业务请求失败改为进入团队模块前的可恢复引导，同时保持 API 租户隔离 fail-closed。

| ID   | Status | Atomic TODO                                                                                          | Context Boundary                                      | Evidence                                                                                             |
| ---- | ------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| F5.1 | done   | 建立团队作用域路由清单，在 Web 中间件中先鉴权、再校验团队 cookie，缺失时携带安全返回地址进入团队页。 | 只改 Web 路由门控；团队、文档和全局管理员页面不拦截。 | middleware/path focused tests；CodeGraph affected。                                                  |
| F5.2 | done   | 团队页在前置进入状态展示高优先级原因、影响和唯一创建动作；创建/恢复团队上下文后返回原页面。          | 保留当前页面样式；不重复创建动作。                    | TeamsContent/TeamSwitcher focused tests；i18n parity；桌面/390px 浏览器。                            |
| F5.3 | done   | 在无团队真实账号上验证 `/projects` 不再请求项目目录或展示加载失败，并完成 Web 回归与重新构建。       | 不放宽 API 权限；不伪造团队。                         | 浏览器与容器日志均为 0 次 project-directory；Web full tests/type-check/build 通过；3120 镜像已替换。 |

### F6. 创建并跑通持久化简单项目

Purpose：在当前 3120/3121 本地开发环境中留下一个可继续使用的最小项目，并以真实构建、真实预发部署和 HTTP 回读证明闭环。

| ID   | Status | Atomic TODO                                                                | Context Boundary                                    | Evidence                                                                                                               |
| ---- | ------ | -------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| F6.1 | done   | 审计当前持久化运行态、账号、团队、执行器和可复用的最小真实发布路径。       | 只读检查；不改动既有用户项目与外部生产资源。        | 发现 app 栈仅部署开启、构建 fail-closed；复用已验证的 external OCI worker 扩展后 Web/API/worker 均 healthy。           |
| F6.2 | done   | 创建团队、独立最小 Git 源码仓库和 Devpilot 项目，并回读持久化数据。        | 源码与主仓库隔离；仅创建本次明确授权的数据。        | 复用现有团队 `test`；项目 `Hello Devpilot`、Git commit `a7cb0ec…`、仓库分析与 staging/production baseline 均持久化。   |
| F6.3 | done   | 创建发布版本，执行非 dry-run 构建，并用同一 Manifest 完成预发部署。        | 保留基础构建/部署能力；不启用已下掉的高级治理步骤。 | Release `1.0.0`；BuildRun `cmtkys74a00463m8yoy72s7zt` succeeded；DeploymentRun `cmtkysxn6007f3m8yjlsqga39` completed。 |
| F6.4 | done   | 从 API、页面、日志与目标 HTTP 四个方向验证闭环，并保留项目供后续继续使用。 | 任一失败、blocked、timeout 或伪终态都不得标记完成。 | API/UI 同一 IDs；构建 26 行、部署 5 行日志；`http://localhost:4310` HTTP 200 且返回 `Hello Devpilot`。                 |

### F7. 恢复预发到生产的最小发布链

Purpose：让发布单保持完整的上线语义，同时只暴露 MVP 必需的构建与部署动作。

| ID   | Status | Atomic TODO                                                               | Context Boundary                                                      | Evidence                                                                                                |
| ---- | ------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| F7.1 | done   | 将基本发布导航改成“预发 → 生产（线上）”两个一级阶段，并建立真实状态推导。 | 只调整 `basic_v1` 可见模型；高级治理实现保持可恢复。                  | 阶段模型、深链和键盘测试通过；3120 浏览器显示两级阶段及真实完成态。                                     |
| F7.2 | done   | 预发阶段只展示“构建、部署”两个子步骤和必要日志。                          | 不恢复预检、预发验证、历史或技术证据入口。                            | Web focused/full tests；桌面与 390px 浏览器确认只有构建、部署。                                         |
| F7.3 | done   | 生产阶段只展示“生产部署”，入口必须使用预发成功的同一 Manifest。           | 保留后端生产门禁和确认边界，不新增生产构建或复制制品。                | ReleaseRun `cmtl26l1r001y12dzstk9cwku` 与 DeploymentRun `cmtl26l50003l12dz33y7bm3u` 复用同一 Manifest。 |
| F7.4 | done   | 完成模型、组件、路由、i18n、浏览器及真实预发到生产运行验证。              | 桌面/390px；失败、blocked、timeout 或 Manifest 不一致均不得标记完成。 | Web 219/796、API 430/2381、type-check/build/CodeGraph 均通过；3120/3121/4310/4311 均 HTTP 200。         |

### F8. 收口发布动作层级与完成态

Purpose：让发布详情只保留真实、稳定、低噪音的操作入口，并避免局部部署状态被误读为整张发布单状态。

| ID   | Status | Atomic TODO                                                                    | Context Boundary                                                 | Evidence                                                                                           |
| ---- | ------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| F8.1 | done   | 移除发布标题右侧由预发 DeploymentRun 推导的“已部署”等局部状态。                | 保留标题、父级返回与现有页面视觉语言；不改变 ReleaseOrder 数据。 | Header 不再接收或推导部署状态；focused/full Web tests 通过。                                       |
| F8.2 | done   | 预发和生产始终保留部署动作槽位，完成后原位禁用并显示“已部署”；日志降为弱操作。 | 不把打开 Drawer 的按钮伪装成导航链接；失败态不擅自增加重试能力。 | ready/running/completed 组件断言通过；日志保留 button 语义并改为 ghost。                           |
| F8.3 | done   | 补齐状态矩阵测试，重新构建 3120，并完成桌面/390px 与四端口回归。               | 仅重建 Web；不得中断 3121/4310/4311 的现有运行。                 | focused/full Web、type-check、build、i18n、CodeGraph 与设计检测通过；3120 已重建并完成浏览器回读。 |

### F9. 单子步骤阶段直接展示内容

Purpose：当一级阶段只有一个固定子步骤时，去掉没有选择价值的子步骤导航，直接呈现该步骤的真实状态与操作。

| ID   | Status | Atomic TODO                                                      | Context Boundary                                       | Evidence                                                                  |
| ---- | ------ | ---------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| F9.1 | done   | 生产阶段仅有“生产部署”时不渲染子步骤条，直接展示生产部署内容。   | 预发仍保留“构建、部署”两步；不改变阶段或运行状态模型。 | 生产阶段仅保留一级生命周期 Tab，部署状态与操作直接呈现。                  |
| F9.2 | done   | 补齐组合测试，重新构建 3120，并验证桌面/390px 的生产与预发展示。 | 保留当前页面样式、键盘语义和日志/部署能力。            | focused/full Web、type-check、build、设计检测、浏览器与四端口健康均通过。 |

## Verification Matrix

| ID  | Validation point | Pass criterion                                                                                         | Current                                                                                                  |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| V01 | 概览返回         | 左侧按钮到 `/projects`。                                                                               | pass                                                                                                     |
| V02 | 子页返回         | 配置、发布详情及项目子页左侧按钮到项目概览。                                                           | pass                                                                                                     |
| V03 | 配置重复入口     | 右上角不存在“项目概览”。                                                                               | pass                                                                                                     |
| V04 | 创建输入         | 仅版本号可见且可提交。                                                                                 | pass                                                                                                     |
| V05 | 发布输入         | 仅版本、来源分支、目标预发环境。                                                                       | pass                                                                                                     |
| V06 | 发布一级阶段     | 仅显示“预发 → 生产（线上）”两个一级阶段。                                                              | pass：桌面/390px 页面及阶段模型断言一致                                                                  |
| V07 | 最小子步骤       | 预发仅构建、部署；生产仅部署；无预检、验证、完成确认、历史或证据入口。                                 | pass：两阶段子步骤与组件 focused tests、真实页面均通过                                                   |
| V08 | 基础构建         | 有真实触发、运行、失败/成功状态与日志。                                                                | pass：新 BuildRun succeeded，API/Drawer 日志可读                                                         |
| V09 | 基础部署         | 有真实触发、运行、失败/成功状态与日志。                                                                | pass：新 DeploymentRun completed，API/Drawer 日志可读                                                    |
| V10 | 状态真实性       | 页面状态来自实际 BuildRun/DeploymentRun，不沿用隐藏阶段误导。                                          | pass：同一新运行在页面显示“已部署”                                                                       |
| V11 | 发布列表         | 无内部 ID、commit、digest；仅一个查看操作。                                                            | pass                                                                                                     |
| V12 | 仓库摘要         | 无托管/可见性和当前 Commit。                                                                           | pass                                                                                                     |
| V13 | 配置页签         | 仅部署目标、资源绑定、变量与密钥。                                                                     | pass                                                                                                     |
| V14 | 部署目标         | Server、路径/目标、状态、编辑；数据可保存并回读。                                                      | pass：表头/操作断言通过；staging/production binding API 回读匹配                                         |
| V15 | 高级能力可恢复   | 访问、验证监控、版本、域名、生产和证据实现未被破坏性删除。                                             | pass：高级组件仍在；`governed_v1` 可显式恢复且有测试                                                     |
| V16 | 最小门禁         | build C01；staging B02/B09；production D01/D02/D03；目标/凭据/执行安全仍 fail closed。                 | pass：basic_v1 真实运行通过；governed_v1/无效 profile 均有显式测试                                       |
| V17 | Web 回归         | focused 和全量 Web tests 全部通过。                                                                    | pass：219 files / 796 tests                                                                              |
| V18 | API 回归         | release-delivery focused/full relevant suites 通过。                                                   | pass：430 suites / 2381 tests（另 50 suites / 215 tests 按配置跳过）                                     |
| V19 | 类型与构建       | Web/API type-check、production build、i18n 全部 exit 0。                                               | pass：五项全部 exit 0                                                                                    |
| V20 | 影响与差异       | CodeGraph sync/affected、scoped `git diff --check` 通过。                                              | pass                                                                                                     |
| V21 | 桌面视觉         | 1440px 当前样式、层级和动作清晰。                                                                      | pass：1780×989 实测并截图                                                                                |
| V22 | 移动视觉         | 390px 无页面横向溢出，操作可达。                                                                       | pass：发布页及两个 Drawer 均 390/390                                                                     |
| V23 | 新发布持久化     | 新 release order 在 UI/API/DB 使用同一 ID。                                                            | pass：`cmtkeey2j002rrnztedhofemz`                                                                        |
| V24 | 真实构建         | 新 BuildRun 非 dry-run 成功并产生 Manifest。                                                           | pass：BuildRun succeeded；Manifest 3 items                                                               |
| V25 | 制品不可变       | Manifest digest 与部署输入完全一致。                                                                   | pass：sameManifest/artifactVerified/immutableInput 均 true                                               |
| V26 | 真实部署         | 新 DeploymentRun completed，目标工作负载实际启动。                                                     | pass：providerActivated true；目标容器 healthy                                                           |
| V27 | 健康验证         | 目标进程/HTTP 探针成功，非页面推测。                                                                   | pass：目标 `127.0.0.1:43992` HTTP 200                                                                    |
| V28 | 日志回读         | 构建和部署日志能从 API 与 MVP Drawer 回读。                                                            | pass：API 200（26/5 行）；桌面/390px Drawer 均单日志面                                                   |
| V29 | 失败硬判定       | 任一步失败、timeout、blocked 或假终态都使闭环失败。                                                    | pass：R1-R6 均非零终止并自动清理；R7 仅全部通过后为 0                                                    |
| V30 | 清理与恢复       | 一次性资源零残留，原本本地服务恢复健康。                                                               | pass：containers/networks/volumes/images/builder 全空；原服务状态未变                                    |
| V31 | 前置门控         | 已登录但无 teamId 时，团队作用域路由在页面/API 取数前进入 `/teams`。                                   | pass：真实 `/projects` 进入 `/teams?required=1...`；浏览器资源与 API 日志均无 project-directory 请求。   |
| V32 | 安全返回         | 前置门控保留站内原目标路径与查询参数，拒绝外部跳转。                                                   | pass：`/projects?view=delivery` 完整保留；外部/协议相对/非绝对路径测试回退 `/dashboard`。                |
| V33 | 非团队路由       | `/teams`、`/admin/*` 和文档等非团队页面不被团队门控。                                                  | pass：路径分类与 middleware 参数化测试通过。                                                             |
| V34 | 引导信息         | 无团队时明确说明原因、受影响能力和“创建团队”动作，页面不显示业务加载失败。                             | pass：真实页面仅一个创建动作；无项目加载失败；桌面/390px 无横向溢出。                                    |
| V35 | 创建后续流       | 创建团队会同步团队上下文并返回原目标；已有团队但未选择时可恢复上下文。                                 | pass：TeamsContent 交互与恢复状态测试通过；未向现有数据库写入测试团队。                                  |
| V36 | 权限边界         | API 缺少/无权团队仍保持 403，Web 前置校验不放宽租户隔离。                                              | pass：真实 API 无 X-Team-Id 请求返回 403 `缺少团队 ID`。                                                 |
| V37 | 团队与项目持久化 | 当前账号可在 3120 回读新团队与新项目，项目关联独立本地 Git 仓库。                                      | pass：团队 `test` 下项目 `cmtkyphmq000a3m8yn4upftc8`；页面显示 `Hello Devpilot` 与 1 个发布。            |
| V38 | 新版本真实构建   | 新发布与 BuildRun 非 dry-run，构建成功并产出 Manifest 和可读日志。                                     | pass：`1.0.0` / BuildRun succeeded / dryRun false / Manifest 3 items / 26 行日志。                       |
| V39 | 同制品真实部署   | DeploymentRun 非 dry-run 且复用构建 Manifest，目标工作负载和 HTTP 探针成功。                           | pass：预发/生产 DeploymentRun 均 completed、dryRun false、同 Manifest；4310/4311 HTTP 200。              |
| V40 | 四向闭环回读     | API、MVP 页面、运行日志和目标 HTTP 均指向同一项目/版本/运行结果。                                      | pass：API、持久化证据、3120 发布页与 4310/4311 内容一致；日志 Drawer 实测可读。                          |
| V41 | 两级导航语义     | 一级阶段和子步骤层级清楚，URL 深链及键盘切换保持可用。                                                 | pass：`release=staging                                                                                   | production` 深链、ARIA tab 与键盘模型测试通过 |
| V42 | 预发职责         | 预发阶段可以真实构建并以该 Manifest 完成预发部署。                                                     | pass：BuildRun `cmtkys74a00463m8yoy72s7zt`；最新预发 DeploymentRun `cmtl26k2d001s12dzlq0petde` completed |
| V43 | 生产复用制品     | 生产没有构建动作，创建的 ReleaseRun 和生产 DeploymentRun 使用预发同一 Manifest。                       | pass：预发、ReleaseRun、生产 DeploymentRun 均为 `cmtkysxiq005s3m8yqv7v8xrn`，digest 完全一致             |
| V44 | 生产基础反馈     | 生产部署有真实等待、运行、失败/成功状态和必要日志，不暴露机器证据墙。                                  | pass：页面显示“1 / 1 已完成/成功”；生产日志 Drawer 回读 5 行，无证据墙                                   |
| V45 | 两阶段视觉       | 当前样式在桌面与 390px 下无页面横向溢出，禁用原因和动作可读。                                          | pass：1440px 为 1440/1440，390px 为 390/390；桌面与移动截图均已保存                                      |
| V46 | 全链真实运行     | 新发布从构建、预发部署到生产部署全部非 dry-run 成功并完成 API/DB/UI/HTTP 回读。                        | pass：生产 ReleaseRun succeeded、DeploymentRun completed/basic_v1；3120/3121/4310/4311 均 HTTP 200       |
| V47 | 标题状态去重     | 发布标题右侧不展示由单个预发部署推导的整单“已部署”状态。                                               | pass：真实页面 Header 仅显示“版本 1.0.0”，无右侧整单状态。                                               |
| V48 | 动作状态矩阵     | 预发/生产的部署动作在 ready 时可用、running 时等待、completed 时原位禁用为“已部署”；日志为低强调按钮。 | pass：组件状态矩阵通过；真实预发/生产均为原生 disabled“已部署”，日志 ghost button 可打开 Drawer。        |
| V49 | 当前运行回归     | 3120 最新构建在桌面/390px 无横向溢出，3120/3121/4310/4311 均 HTTP 200。                                | pass：1440 为 1440/1440，390 为 390/390；四端口 HTTP 200；生产与预发日志均真实回读。                     |
| V50 | 单步阶段收纳     | 生产只有一步时无子步骤 Tab/步骤条并直接出现部署内容；预发两步导航保持可用。                            | pass：桌面/390px 生产仅有一级 Tab 且无嵌套 step panel；预发仍有“构建、部署”Tab。                         |

## Change Log

- 2026-09-03：创建长期目标、唯一进度板、任务分解和 V01-V30 验收矩阵；PMC073 作为已实现基线，真实本地端到端发布闭环开始验证。
- 2026-09-03：补齐 `basic_v1`/`governed_v1` 运行态切换、MVP 专用构建/部署日志 Drawer、组合与目标表测试，并为本地 rehearsal 增加 dirty-tree 隔离身份、失败自动清理和 manifest-bound `destroy`。
- 2026-09-03：R7 从当前工作树构建镜像并成功执行新项目 → 新发布 → 真实 BuildRun → 同 Manifest 预发 DeploymentRun → API/DB/浏览器日志和状态回读；证据为 `/tmp/codex-tool-runs/svton/long-goals/devpilot-mvp-release-flow-closure/runtime/svton-f537-20260903-mvp-r7/f455/f455-positive-e2e-evidence.json`。
- 2026-09-03：最终 Web/API tests、type-check、build、i18n、脚本自测、CodeGraph 和差异检查全部通过；浏览器截图在同一 long-goal 的 `browser/`；R7 清理收据为 `verified_zero_residuals`，外部公网生产验收仍明确不在本地 MVP 范围内。
- 2026-09-03：追加 F5/V31-V36，将无团队从项目列表错误态改为团队作用域路由的前置引导；API 租户隔离保持 fail-closed。
- 2026-09-03：F5/V31-V36 完成；3120 已更新，真实无团队访问项目页在业务请求前进入团队创建引导，桌面/390px、容器日志、Web 回归和 API fail-closed 均通过。
- 2026-09-03：追加 F6/V37-V40，开始在当前持久化本地环境中创建并跑通一个可继续使用的简单项目。
- 2026-09-03：F6/V37-V40 完成；`Hello Devpilot` 在 3120 持久化，`1.0.0` 经受控真实构建、同 Manifest 预发部署与 4310 HTTP 200 验证，证据为 `/tmp/codex-tool-runs/svton/simple-project/evidence.json`。
- 2026-09-03：用户补充发布单最低语义为“预发 → 生产（线上）”；追加 F7/V41-V46，原仅“构建 → 预发部署”的 F2.2/V06-V07 合同被新两阶段合同取代。
- 2026-09-03：F7/V06-V07/V41-V46 完成；`basic_v1` 页面保持现有视觉语言，预发仅构建/部署、生产仅部署并自动复用预发 Manifest。最新预发 `cmtl26k2d001s12dzlq0petde`、生产 `cmtl26l50003l12dz33y7bm3u` 均为非 dry-run completed，生产 ReleaseRun `cmtl26l1r001y12dzstk9cwku` succeeded；四个本地端口均 HTTP 200。
- 2026-09-03：F8/V47-V49 完成；移除标题局部“已部署”，预发和生产完成态均保留原位禁用“已部署”动作，日志降为 ghost button。3120 已重建；1440/390px、两类日志 Drawer、四端口健康均通过。
- 2026-09-03：F9/V50 完成；生产单子步骤阶段不再展示冗余步骤条，直接展示生产部署内容；预发双步骤导航保持不变。3120 已重建并通过桌面/390px 回读。
