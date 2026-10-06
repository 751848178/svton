# Devpilot 项目模块内容级收口 TODO

> 状态：Local Closure Done / External Production Sign-off Pending
> 建立日期：2026-08-27
> 范围：项目 Header、概览与发布列表、独立发布详情、发布一级/二级步骤、项目配置七个子区、独立部署证据页、弹窗/抽屉、响应式与可访问性。
> 结论：所有已定义 PMC 均已完成能够在本地取得真实证据的闭环；PMC015-PMC018 已由隔离 Docker parity 环境中新建的 Project / ReleaseOrder 真实执行 Production Preview、审批、ReleaseRun、DeploymentRun、EnvironmentVersion、入口探测和完成证据闭环。这不等同外部生产 Provider、公网 DNS/TLS 或真实流量签收。PMC038/PMC039 为权威 TODO 明确记录的编号空洞。本文是唯一当前验收结论，旧文档只保留历史。

## 当前收口状态

- **已完成（2026-09-01）**：PMC001-PMC007、PMC010-PMC022、PMC030-PMC037、PMC040-PMC043、PMC050-PMC072。
- **已完成（2026-09-03）**：PMC073 基础发布模式收敛；保留现有视觉语言，把当前可见交付流程缩减为最小可跑通的构建与部署闭环。
- **本地闭环**：所有已定义 PMC 均已有与任务匹配的代码/API/测试/浏览器/截图或只读审计证据并如实关闭；PMC015-PMC018 的成功态证据来自当前代码构建的隔离 parity 环境和本次新执行链，不是旧 seed 成功状态。
- **信息架构闭环**：PMC062 以项目概览为默认工作区，把项目配置收敛为 Header 次级路由入口；PMC069 进一步把概览内容收敛为“发布记录 / 环境 / 组件”三个 URL-backed Tab。项目警告使用浅色语义面，部署记录继续保留独立深链并从发布上下文进入。
- **概览细节闭环**：PMC063 已把发布筛选放到列表左侧、部署记录放到右侧；Header 与基本信息之间只保留父级 `24px` 间距；仓库分析作为紧跟“基本信息”的上下文证据操作，不占用 Header 或第三个 Tab。
- **基本信息语义网格闭环**：PMC064 已把基本信息收敛为桌面两行三列、390px 两列的稳定阅读顺序；主要项目事实与审计元数据不再通过四列跨度拼成互不相关的左右块，且未改变 Project、ReleasePolicy、RepositoryAnalysisRun、环境/组件计数或任何写入语义。
- **仓库分析闭环**：PMC065 已把仓库分析改为基本信息下方默认折叠的渐进式证据面板；连接/凭据/默认分支等仓库身份维护写操作进入项目级仓库设置，运行、阶段、证据、建议审核及失败恢复仍留在所属 branch/commit 分析上下文，旧混合 Modal 和卡片套卡片结构已移除。
- **仓库分析最终闭环**：PMC066 已把概览与运行工作拆开：`仓库与分析` 标题本身展开/收起，折叠态不显示最近解析；展开态只显示真实最新摘要与精确去向。分析记录、阶段/日志证据与识别到的变更进入独立 `仓库分析` 二级页，连接/凭据/默认分支仍归项目配置。
- **全页面视觉审计闭环**：PMC067 已对当前容器中项目概览、配置七子区、仓库设置、仓库分析、域名、部署、发布详情、代表性 Modal/Drawer 和兼容路由完成 1440px/390px 组合审计；报告记录 8 个 P1、5 个 P2 与真实不可达状态，不把审计自动扩大为修改授权。
- **高级信息归属纠正闭环**：PMC068 已将上一版“仓库与分析”折叠区改为低频技术事实的“高级信息”；展开后先显示只读仓库概览，再把最近一次真实分析状态与其实际解析结果放在同一分析概览中，并只保留“查看仓库分析”入口。连接、凭据与默认分支等维护继续仅归项目配置。
- **仓库详情与组件上下文最终闭环**：PMC069 已取代 PMC068 的混合折叠结构：默认折叠的“仓库详情”只展示仓库地址、托管/可见性、分支、Commit 与最近验证时间；最近真实 `application_service` 识别摘要及完整分析入口进入“组件”Tab，仓库维护仍只归项目配置。
- **默认折叠与 Tab 表格去卡片化闭环**：PMC070 已把仓库详情改为每次挂载从折叠态开始，普通 disclosure 不再读写 URL；项目概览的发布、环境、组件表格使用无圆角、无外边框、无阴影的嵌入式表面，独立部署、域名等表格不受影响。
- **组件识别操作归组闭环**：PMC071 已移除摘要整行 `justify-between`，把“查看完整仓库分析”紧跟“最近组件识别”标题；真实解析状态、branch/commit、时间、识别数量与空态仍来自原有分析运行和 `application_service` 建议，未改变 API 或推导虚构状态。
- **发布运行信息分层闭环**：PMC072 已按“人读结论优先、机器证据按需查看”收敛预发部署、部署历史、日志证据、生产检查与生产部署；历史和证据 Drawer 扩宽且 390px 不溢出，技术 ID/digest 仅保留短值。managed-process 现在能识别僵尸进程组并恢复旧 `.stop` 遗留状态，不再把已退出服务误判为存活。
- **视觉复核闭环**：PMC056/PMC060 已收敛项目配置七子区的原型视觉差异，部署目标、资源绑定、变量与密钥、访问权限、验证与监控、域名与入口不再使用“外层卡片套内容卡片”样式。
- **部署表格复核闭环**：PMC057/PMC059/PMC060 已把部署记录宽表的横向和纵向滚动在桌面与 390px 都收敛到表格视口；筛选器在 390px 使用自身横向视口，错误/空态和分页保持在页面内容区，20 行数据不再把外层 `main` 撑长。
- **发布动作区复核闭环**：PMC058 已把真实状态/阻断原因、历史与当前主操作收敛为同一响应式动作条；桌面左右对齐，390px 按说明与操作自然分行，不再出现右侧独占空行、悬挂说明或重复无构建空态。
- **外部签收边界**：PMC015-PMC018 已在本地真实 API/持久化/浏览器链中关闭；当前 Picshare 本身仍没有真实外部生产 Provider、公网 DNS/TLS、生产流量、备份恢复演练与外部可观测证据；这些属于 Production Ready 签收，不用本地 technical acceptance 伪装替代。
- **编号空洞**：权威 TODO 中不存在 PMC038、PMC039 的标题、验收条件或清单项；它们不是待办，不能被发明或标记为完成。
- **本切片边界**：共同 Header / Surface、发布生命周期、八个发布子步骤、设置写操作、域名入口、部署记录及 390px 关键点击区域。
- **真相来源**：项目详情、DeploymentRun 结构化探针结果、ReleaseRun `awaiting_validation / succeeded` 状态；不使用原型样例值补齐产品数据。
- **完成门槛**：定向模型/组件测试、Web 构建、桌面与 390px 浏览器截图均通过后，才把对应条目标记 Done；未覆盖状态矩阵或交互证据的实现继续标 Partial。

### 2026-08-27 实施证据

- 发布生命周期已改为预发技术验证、生产 DeploymentRun 与发布后验证证据驱动；预发验证、生产检查、发布后验证、完成确认已拆成独立组件，公共发布输入只出现一次。
- 资源、变量与密钥、访问策略、验证配置的编辑已迁入 Modal；创建配置修订新增统一审阅 Modal，展示目标环境、完整差异、影响、阻断项和必填原因，确认后才写入。
- 域名表使用真实 Site aliases/runtimeConfig/DNS/TLS/routeSwitch 证据；无证据显示“暂无证据”，不生成样例通过状态。
- 部署记录增加服务端环境/状态/发布/日期筛选、20 条分页、运行态 5 秒轮询、失败原因首屏、`?runId=` 深链和右侧 Drawer；旧 API 滚动升级期间使用 30 条兼容读链，不把兼容结果宣称为全量分页。
- Web/API type-check、i18n、定向 Vitest/Jest 与 Web build 通过；浏览器完成部署筛选、失败 Drawer、域名真实空态和 390px 部署页验收。
- 新截图：`evaluation/screenshots/2026-08-27/project-module-content-closure/`。
- PMC036 已以真实 `EnvironmentConfigRevision.observabilitySnapshot`、项目 Site 与精确归属的 `DeploymentRun.result.siteProbe` 重构验证证据表；缺少配置、结果或证据时间时分别显示“未配置”“不可用”“暂无证据”，不从 profile、站点或部署整体成功状态推导通过。
- PMC036 定向模型/组件测试、Web type-check、i18n 和 production build 均通过；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc036/`，容器启动日志为 `svton/pmc036-compose-start-20260827-224823.log`。
- PMC036 浏览器在真实 Picshare 数据完成登录、桌面与 390px 验收：预发无配置显示 3 条不可用证据，生产 Site `picshare.localtest.me` 显示 DNS/TLS/HTTP 三个真实目标但明确“没有可归属到此对象的运行证据”；配置 Modal 桌面/移动端可开关，390px 表格实测可横向滚动（330/820px）。
- PMC036 截图：`pmc036-verification-monitoring-desktop.png`、`pmc036-verification-site-evidence-desktop.png`、`pmc036-verification-config-modal-desktop.png`、`pmc036-verification-monitoring-mobile-390.png`、`pmc036-verification-monitoring-mobile-evidence-390.png`、`pmc036-verification-config-modal-mobile-390.png`。
- PMC041 已把项目域名入口改为锁定项目/环境的三步 Modal：真实 `ApplicationService` 组件/端口与路径 → Site 域名与路由修订 TLS 意图 → DNS/配置预览和变更原因；环境筛选写回 `environmentId`，表格只保留“查看详情”，编辑/删除进入 Overflow。
- PMC041 写入链按真实模型顺序执行 `POST /sites`、`PUT /applications/:applicationId/services/:serviceId`、`POST /project-environments/:environmentId/config-revisions`；定向测试验证了部分成功后保留 Site id，重试只更新既有 Site、不重复创建。后端仍没有原子跨聚合入口，也不支持原子清空/迁移 `ApplicationService.siteId`，因此编辑时锁定既有绑定并如实记录此能力缺口。
- PMC041 证据 Drawer 展示真实 Site 配置计划、DNS、TLS、routeSwitch 和精确域名匹配的 `DeploymentRun.result.siteProbe`；Production 的 `picshare.localtest.me` 当前没有组件绑定和探测证据，页面显示“暂无证据”，dry-run 真实返回缺少 Server、upstream/host/port 两项阻断。
- PMC041 浏览器验收同时发现并修复共享 Select 的 Modal Portal 被 `inert` 隔离、共享 Drawer 在 390px 下仍保持 680px 两个真实交互问题；运行态复核 Select 可点击选择“平台托管证书”，Drawer 边界为 `left=0,width=390`。
- PMC041 测试证据：`pmc041-focused-tests-closure-20260827-235013.log`、`pmc041-web-typecheck-closure-20260827-235013.log`、`pmc041-api-typecheck-closure-20260827-235216.log`、`pmc041-i18n-closure-20260827-235013.log`、`pmc041-ui-overlay-responsive-tests-20260827-234538.log`、`pmc041-ui-typecheck-final-20260827-234538.log`、`pmc041-ui-build-final-20260827-234954.log`、`pmc041-web-build-closure-20260827-235022.log`、`pmc041-codegraph-affected-closure-20260827-235057.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc041/`。
- PMC041 截图：`pmc041-domains-production-desktop.png`、`pmc041-domain-evidence-drawer-desktop.png`、`pmc041-domain-workflow-step1-desktop.png`、`pmc041-domain-workflow-preview-desktop.png`、`pmc041-domain-workflow-mobile-390.png`、`pmc041-domain-evidence-drawer-mobile-390.png`。
- PMC057 代码把项目路由与表面补齐 `min-w-0/max-w-full`，并新增 `ProjectTableViewport`；DeploymentRun 表格保留 1080px 可读最小宽度，筛选、错误/空态与分页不进入该滚动视口。发布关联仍来自 ArtifactManifest/ReleaseStageAttempt 的真实 `releaseOrderId`，未改 API、筛选、分页、轮询或 Drawer 状态。
- PMC057 真实浏览器实测：1440px 的 `body/root/main=1440/1440/1184` 且无页面级横向溢出；390px 的 `body/root/main=390/390/390`，表面/筛选/分页为 358/356/356px，只有表格视口为 `clientWidth=356, scrollWidth=1080`，`scrollLeft` 可从 0 独立变为 260，外层和 main 仍为 0。
- PMC057 测试证据：`pmc057-focused-tests-final-20260828-151632.log`、`pmc057-web-typecheck-after-build-20260828-151703.log`、`pmc057-i18n-final-20260828-151632.log`、`pmc057-web-build-final-20260828-151632.log`、`pmc057-format-check-final-20260828-151632.log`、`pmc057-codegraph-sync-20260828-151711.log`、`pmc057-codegraph-affected-20260828-151718.log`；Docker 重建为 `pmc057-compose-build-web-20260828-151157.log`，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc057/`。
- PMC057 截图：`pmc057-deployments-table-desktop-final.png`、`pmc057-deployments-table-mobile-390-final.png`。
- PMC058 代码新增共享 `release-lifecycle-step-action-bar.tsx`，构建与预发部署都使用“左侧真实上下文 + 右侧历史/当前操作”的紧凑动作条；`release-lifecycle-step-panel.tsx` 不再创建独占空行或重复无 BuildRun 空态。禁用条件、`aria-describedby`、BuildRun/DeploymentRun API、门禁、权限、历史 Drawer 和构建/发布回调均未改变。
- PMC058 真实浏览器实测：1440px 动作条为 `1086×32`，原因左对齐并与两个操作同一行；390px 为 `316×96`，原因先于操作，两个按钮均为 44px，`html/body/main` 横向溢出均为 0。构建历史打开后 URL 为 `?step=build&history=builds`，关闭恢复 `?step=build` 并把焦点返回“查看历史”；全程未触发构建或部署写操作。
- PMC058 测试证据：`pmc058-focused-tests-final-20260828-153038.log`、`pmc058-i18n-final-20260828-153038.log`、`pmc058-format-check-20260828-153038.log`、`pmc058-web-build-20260828-153046.log`、`pmc058-web-typecheck-after-build-20260828-153114.log`、`pmc058-codegraph-sync-20260828-153122.log`、`pmc058-codegraph-affected-20260828-153129.log`、`pmc058-scoped-diff-final-20260828-154123.diff`、`pmc058-untracked-diff-check-final-20260828-154145.log`；Docker 重建为 `pmc058-compose-build-web-20260828-153146.log`，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc058/`。
- PMC058 截图：`pmc058-release-build-actions-desktop-final.png`、`pmc058-release-build-actions-mobile-390-final.png`、`pmc058-release-build-history-desktop.png`。
- PMC059 代码把部署路由改为 1024px 以上的剩余高度布局，`ProjectTableSurface` 逐层传递 `min-height: 0 / flex: 1`，筛选器、表面标题与分页固定占位，`ProjectTableViewport` 承接横向与纵向滚动；部署表头在内部纵向滚动时保持固定。DeploymentRun API、服务端筛选/分页、轮询、发布关联、Drawer 与行操作均未改变。
- PMC059 真实浏览器实测：修复前 1440×900 的 `main clientHeight/scrollHeight=844/2046`、表格表面高 1587px；修复后为 `844/844`，路由高 736px、表面高 384.6px、表格视口 `clientHeight/scrollHeight=141/1344`。表格滚到 `scrollTop=220` 时 `main.scrollTop=0`，表头仍位于视口顶部。390px 保持自然流，`body/html` 横向溢出均为 0，表格 `clientWidth/scrollWidth=356/1080` 且可独立滚到 `scrollLeft=240`。
- PMC059 测试证据：`pmc059-focused-tests-final-20260828-160744.log`、`pmc059-format-check-final-20260828-160744.log`、`pmc059-i18n-20260828-160358.log`、`pmc059-web-build-final-20260828-160752.log`、`pmc059-web-typecheck-final-20260828-160820.log`、`pmc059-codegraph-sync-final-20260828-161229.log`、`pmc059-codegraph-affected-final-20260828-161230.log`、`pmc059-untracked-diff-check-final-20260828-161508.log`；Docker 重建为 `pmc059-compose-build-web-final-20260828-160835.log`，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc059/`。
- PMC059 截图：`pmc059-deployments-table-fill-desktop-final.png`、`pmc059-deployments-table-mobile-390-final.png`。

### PMC058 发布步骤紧凑动作区验收条件（已完成）

路由：`direct`。只修改发布详情当前步骤的动作呈现、响应式排列与相关文案，不修改 BuildRun/DeploymentRun API、门禁计算、权限、历史 Drawer、构建或预发发布回调。

1. 构建和预发部署步骤使用同一动作条：桌面端真实状态/阻断原因在左，历史与主操作在右；不再为少量按钮保留整行空白。
2. 禁用原因及真实修复链接位于动作所属上下文内并左对齐，不再嵌在主按钮下方使用右对齐；`aria-describedby` 继续精确关联原因。
3. 尚无 BuildRun 时，空态说明合并到动作条且只出现一次；已有运行时继续显示真实构建/部署内容，不复制状态或发明进度。
4. 390px 动作条按“说明 → 操作”自然纵向排列，按钮保持至少 44px 点击高度、DOM/焦点顺序与视觉顺序一致；桌面维持紧凑按钮密度。
5. 完成定向测试、Web type-check、i18n、production build、CodeGraph、scoped diff/`git diff --check`、容器重建，以及桌面与 390px 真实浏览器交互和截图后，PMC058 才可标记 Done。

### PMC059 部署表格剩余高度与内部纵向滚动验收条件（已完成）

路由：`todo-plan`。只修改部署记录页面的响应式高度传递和表格视口滚动边界，不修改 DeploymentRun API、服务端筛选/分页、轮询、发布关联、Drawer 深链或行操作。

1. 1024px 及以上视口中，项目 Header、项目警告、页面标题、表面标题、筛选器和分页占用固定内容高度；DeploymentRun 表格视口填满其余可用高度，外层 `main` 不再因 20 行数据增长而纵向滚动。
2. 表格横向与纵向滚动都只发生在 `ProjectTableViewport`；表头、行与 1080px 可读最小宽度保持不变，筛选器和分页不进入滚动视口。
3. 空态、加载态和错误态仍填充剩余内容区域，但不能制造无意义的内部滚动；Drawer、`runId`、焦点恢复和筛选状态保持原行为。
4. 390px 因筛选器纵向堆叠继续使用自然页面流，表格仅在自身视口横向滚动；页面无横向溢出，按钮与筛选器保持既有触控尺寸。
5. 完成定向测试、Web type-check、i18n、production build、CodeGraph、scoped diff/`git diff --check`、容器重建，以及桌面与 390px 真实浏览器尺寸/滚动测量和截图后，PMC059 才可标记 Done。

### PMC060 项目工作台信息架构与共享 Header 收敛验收条件（已完成）

路由：`todo-plan`。调整项目工作台导航、共享 Header、概览内容与配置侧栏；不修改项目、发布、环境配置、Site 或 DeploymentRun 的 API、数据模型、服务端状态与写入语义。

1. 面包屑和项目 Header 只保留一套连续垂直节奏：移除面包屑下外边距与 Header 固定大高度的叠加，仍保留可读层级、44px 键盘/触控目标和现有 Navbar。
2. 项目级准入/配置警告只在项目标题元数据下、一级导航上方展示一次；发布阶段、配置子区和部署证据自身的警告继续留在所属内容顶部，不把真实局部问题提升为项目警告。
3. 一级导航收敛为“概览 / 配置”。概览合并精简项目事实与真实发布单列表；仓库、分支、Commit 不在基本信息中重复，基本信息去掉外层卡片。各入口不再使用与导航文案重复的页面级大标题或通用描述。
4. 配置侧栏在现有版本、部署目标、资源绑定、变量与密钥、访问权限、验证与监控之后增加“域名与入口”，复用现有 EnvironmentConfigRevision、Site、TLS、DNS 和 DeploymentRun 探测证据，不创建第二套数据或演示状态。
5. 部署记录保持独立 `/projects/:id/deployments` 深链、筛选、轮询、内部滚动和 `runId` Drawer；从一级导航移除后，必须从概览发布上下文保留明确入口，旧 URL 继续可直接访问和关闭返回。
6. 桌面与 390px 下仅有一个页面级主操作“创建发布”；概览、配置侧栏、发布/部署入口、项目警告和表格均可键盘访问，页面无横向溢出，部署表格仍填充剩余高度并只在自身视口滚动。
7. 定向测试、Web type-check、i18n、production build、Impeccable detector、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面/390px 真实浏览器交互与截图齐全后，PMC060 才可标记 Done。

PMC060 完成证据（2026-08-28）：

- **代码与职责**：`project-workbench-header.tsx` 统一项目身份、项目级警告、一个主操作和双入口导航；`project-overview-content.tsx` 组合精简基本事实、真实发布单、环境版本与组件证据；设置路由新增 `domains` 子区并复用既有域名内容；部署路由保留独立 `/deployments` 与 `runId` Drawer，同时在所有断点把剩余高度和横纵滚动交给表格视口。相关源文件均未超过 200 行。
- **API / 模型依据**：本切片没有新增或改写业务 API、字段和状态。概览继续读取 Project、Repository Analysis、ReleaseOrder、EnvironmentVersion 与 ApplicationService；域名子区继续读取 Site aliases/runtimeConfig、TLS、DNS、EnvironmentConfigRevision 与按域名精确归属的 DeploymentRun 探测；部署页继续使用真实 DeploymentRun 服务端筛选、分页、轮询和精确 `deploymentRunId` 证据。缺少端口、DNS、探测或健康结果时分别显示真实阻断或“暂无证据”。
- **测试与静态验证**：Web/API type-check、i18n、Web 全量测试、production build、Impeccable layout detector、CodeGraph sync/affected、scoped diff、tracked/untracked whitespace check 均通过。最终日志为 `pmc060-final-web-typecheck-20260828-174154.log`、`pmc060-final-api-typecheck-20260828-174154.log`、`pmc060-final-i18n-20260828-174154.log`、`pmc060-final-web-tests-20260828-174154.log`、`pmc060-final-web-build-20260828-174224.log`、`pmc060-final-impeccable-layout-20260828-174259.log`、`pmc060-codegraph-sync-20260828-174130.log`、`pmc060-codegraph-affected-20260828-174140.log`、`pmc060-scoped-tracked-diff-20260828-174809.diff`、`pmc060-final-git-diff-check-20260828-174733.log`、`pmc060-untracked-diff-check-20260828-174753.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc060/`。
- **容器与浏览器**：最终 Docker build/force-recreate 为 `pmc060-final-compose-rebuild-20260828-173742.log`，API healthy、Web 返回 200。task space 78 的已登录 Picshare 实测 Header 警告只出现一次、概览/配置双入口、七个配置子区、Production 域名真实 draft 行、三步域名 Modal 的环境锁定与端口阻断、部署五区证据 Drawer、`runId` 关闭返回与精确焦点恢复；未提交任何写操作。完整交互记录为 `pmc060-browser-acceptance-20260828.md`。
- **尺寸与滚动证据**：1440×900 下 main `844/844`、路由 `736/736`、表格 `290/1344`，表格滚到 320 时 main 保持 0；390×844 下 html/body/main 宽度均 `390/390`，main `739/739`、路由 `663/663`、表格 `356/1080 × 57/1344`，表格横移 240、纵移 280 时页面仍为 0。页面级横纵溢出均为 0。
- **截图**：`pmc060-overview-desktop.png`、`pmc060-overview-mobile-390.png`、`pmc060-configuration-domains-desktop.png`、`pmc060-configuration-domains-mobile-390.png`、`pmc060-domain-flow-modal-desktop.png`、`pmc060-deployments-desktop.png`、`pmc060-deployments-mobile-390.png`、`pmc060-deployment-evidence-drawer-desktop.png`。
- **真实缺口**：PMC060 无剩余本地缺口；生产检查、生产部署、发布后验证与完成的合法成功运行事实仍属于 PMC015-PMC018 外部 blocker，未因信息架构完成而改成 Done。

### PMC061 概览信息层级与配置环境作用域验收条件（已完成）

路由：`todo-plan`。只调整项目概览与配置框架的内容编排、渐进披露和响应式布局；不修改 Project、ReleaseOrder、EnvironmentVersion、ApplicationService、EnvironmentConfigRevision、Site 或 DeploymentRun 的 API、状态和写入语义。

1. 概览必须在独立“基本信息”区域展示真实 Project 基础字段：描述、创建者、创建时间、更新时间、发布策略、已有环境数与真实组件数；仓库、分支和 Commit 继续只在共享 Header 展示，不重复、不填充样例值。
2. 发布列表保持概览的主要集合，使用独立表面与既有服务端筛选/状态/操作；基本信息不得与发布表混成同一视觉容器，也不得用同权重卡片墙抢占发布任务。
3. 环境运行版本与项目组件继续留在同一概览页面，但收进默认关闭、键盘可达的“环境与组件详情”披露区；展开后继续使用真实表格、Modal/Drawer 和写入边界，关闭时不卸载或伪造摘要数据。
4. 当前环境是配置作用域选择器：桌面放在左侧配置导航顶部，390px 与“配置类型”在同一紧凑作用域工具栏中；不得继续以右对齐控件单独占满一行，长环境名称和英文文案必须可收缩且页面无横向溢出。
5. `devpilot-project-workbench-design` Skill 与 workbench contract 必须记录“概览主次分层/支持信息渐进披露”和“作用域选择器不得独占空行”的持久规则，后续改造不得回退。
6. 定向组件/路由测试、Web type-check、i18n、production build、Impeccable detector、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面/390px 真实浏览器展开/收起、环境切换布局与截图齐全后，PMC061 才可标记 Done。

PMC061 完成证据（2026-08-28）：

- **代码与内容层级**：`project-overview-summary.tsx` 使用真实 `Project.description`、`createdBy`、`createdAt`、`updatedAt`、发布策略、环境和应用服务计数组成独立紧凑基本信息带；仓库、分支、Commit 仍只在共享 Header 出现。`project-overview-content.tsx` 继续把真实发布列表作为主要集合；`project-information-panel.tsx` 把环境运行版本和项目组件收进默认关闭的原生 `details/summary`，展开后继续复用原表格、Modal 与写入链。390px 下描述占整行，其余基础事实双列呈现。
- **配置作用域**：新增 `environment-settings-scope-selector.tsx`；`environment-settings-detail.tsx` 在桌面把当前环境放到 190px 配置左轨顶部，在窄屏把环境和配置类型组成同一双列工具栏。`environment-settings-area.tsx` 仍只通过 `settingsHref` 写回真实 `env/envTab/section` URL 状态，不新增环境、不改配置修订写入。
- **API / 模型依据**：本切片没有新增 API、字段、状态或派生成功态。基本信息来自既有 Project 详情响应；发布集合继续使用 ReleaseOrder；支持详情继续使用真实 EnvironmentVersion / ArtifactManifest / BuildRun / DeploymentRun 与 ApplicationService；配置作用域只枚举 `selectExistingProjectEnvironments` 返回的既有环境。当前 Picshare 仅有 Production 满足配置选择条件，因此浏览器未伪造跨环境切换。
- **Skill 固化**：`devpilot-project-workbench-design/SKILL.md` 与 `workbench-contract.md` 已写入“基本信息与发布集合分层、环境/组件渐进披露、环境作用域归属配置轨道/移动工具栏且不得独占空行”；`devpilot-product-design-lessons` 同步记录两个问题与解决规则，`apps/devpilot-web/DESIGN.md` 保持产品实现约束一致。
- **测试与静态验证**：新增 `project-overview-information.spec.tsx`，并更新环境路由与可访问性测试。Web 全量测试、Web/API type-check、i18n、production build、Impeccable detector、CodeGraph sync/affected、scoped diff 与全局 `git diff --check` 均通过；CodeGraph 识别的受影响测试为 `project-overview-information.spec.tsx`、`environment-settings-area.spec.tsx`、`f452-accessibility.spec.tsx`。最终日志为 `pmc061-web-tests-20260828-183202.log`、`pmc061-final-focused-tests-20260828-195554.log`、`pmc061-final2-web-typecheck-20260828-195554.log`、`pmc061-api-typecheck-20260828-183015.log`、`pmc061-final2-i18n-20260828-195554.log`、`pmc061-final-web-build-20260828-195605.log`、`pmc061-final2-impeccable-20260828-195554.log`、`pmc061-final-codegraph-sync-20260828-200604.log`、`pmc061-final-codegraph-affected-20260828-200619.log`、`pmc061-final-git-diff-check-20260828-200604.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc061/`。
- **容器与运行态**：并行 BuildKit 首次在 Web 镜像导出时遇到 Docker Desktop `lease does not exist`，未把失败写成成功；随后分别执行 API/Web BuildKit build 均成功，再 force-recreate Web/API，最终 API health 为 200、Web 登录页为 200。最后移动端压缩调整后再次构建 Web 并 force-recreate，运行路由可正常登录访问。完整构建日志为 `docker-compose-build-api.log`、`docker-compose-build-web-final.log`、`docker-compose-recreate.log`、`docker-compose-recreate-web-final.log`。
- **浏览器交互**：已登录 task space 79 在真实 Picshare 完成 1440×1000 与 390×844 验收并关闭。`details` 初始 `open=false`，聚焦 `SUMMARY` 后按 Enter 得到 `open=true` 且焦点保留；390px 概览 `clientWidth/scrollWidth=390/390`，配置页环境与配置类型同 y、各宽 173px且无横向溢出；可见配置类型控件的真实 `change` 事件把 URL 从 `envTab=versions` 切到 `envTab=domains` 后恢复。完整记录为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc061/pmc061-browser-acceptance.md`。
- **截图**：`pmc061-overview-desktop.png`、`pmc061-overview-mobile-390.png`、`pmc061-overview-supporting-closed-desktop.png`、`pmc061-overview-supporting-open-desktop.png`、`pmc061-settings-scope-desktop.png`、`pmc061-settings-scope-mobile-390.png`。
- **真实缺口**：PMC061 无剩余本地代码或交互缺口；当前项目没有第二个可配置既有环境，因此跨环境浏览器切换不可产生真实证据，定向测试以两环境真实模型形态验证 URL 切换。PMC015-PMC018 的合法生产运行事实仍为外部证据 blocker，未因本切片完成而关闭。

### PMC062 项目概览内容模式与 Header 操作收口验收条件（已完成）

路由：`todo-plan`。只调整共享项目 Header、概览基本信息、同页内容切换与项目警告视觉；不修改 Project、ReleaseOrder、EnvironmentVersion、ApplicationService、EnvironmentConfigRevision、Site 或 DeploymentRun 的 API、状态与写入语义。

1. 基本信息使用无上下边框、无内部横线的紧凑事实布局；基本信息与下方内容不再额外叠加分割线，由内容 Tab 自身的单一底边建立层级。
2. 基本信息增加由真实 Project 环境集合与 ApplicationService 集合计数得到的“环境与组件”概览；不得生成演示环境、组件或运行状态。
3. 基本信息下方使用同页“发布记录 / 环境与组件详情”Tab；默认展示发布记录，切换后复用真实环境版本与组件表格，支持键盘方向键/Home/End、正确 ARIA 关系和 390px 无横向溢出。
4. 移除共享 Header 的“概览 / 配置”第二条路由导航；概览、发布与部署上下文在右上角提供次级“项目配置”按钮，配置/域名上下文提供次级“项目概览”返回入口，“创建发布”仍是唯一页面级主操作。
5. 项目标题左侧提供至少 44px、可键盘访问且有可读标签的返回按钮，确定性返回 `/projects`，不依赖不可预测的浏览器历史。
6. 项目级警告继续只在共享 Header 展示一次，并使用语义 warning 的浅色底、边框、图标、问题与修复入口；不得把阶段或字段警告提升到项目层。
7. 同步更新项目 Workbench Skill、设计 lessons、PRODUCT/DESIGN 契约；完成定向/全量测试、Web/API type-check、i18n、production build、Impeccable detector、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面与 390px 真实浏览器返回、配置入口、Tab 键盘交互、警告视觉和截图后，PMC062 才可标记 Done。

PMC062 完成证据（2026-08-28）：

- **代码与职责**：`project-workbench-header.tsx` 增加确定性 `/projects` 返回按钮，移除“概览 / 配置”路由 Tab，在交付/部署上下文展示次级“项目配置”、配置/域名上下文展示次级“项目概览”，并保留唯一主操作“创建发布”。`project-overview-summary.tsx` 去掉基本信息的外层、网格与事实行上下边框，使用真实环境/组件计数形成合并概览；`project-overview-tabs.tsx` 在其下建立“发布记录 / 环境与组件详情”同页 Tab，发布默认展示，详情复用原环境版本与组件表格。`project-context-issue.tsx` 使用现有 warning token 的浅底、边框与图标。相关源文件均不超过 200 行。
- **API / 模型依据**：本切片没有新增或修改业务 API、数据库字段、发布状态或成功推导。基本信息继续来自 Project 详情、发布策略与 `Project.environments` / `Application.services` 真实集合；发布 Tab 继续使用 ReleaseOrder/BuildRun/DeploymentRun；详情 Tab 继续使用 EnvironmentVersion、ArtifactManifest 与 ApplicationService。当前 Picshare 浏览器实测为 5 个环境、4 个组件、3 个发布单，没有填充演示状态。
- **测试与静态验证**：新增 Header、内容 Tab 与键盘模型测试，并更新基本信息/警告/路由动作测试。首次新增 SSR 测试因测试环境缺少全局 React 失败，修正测试桩后最终定向测试和 Web 全量测试通过；Web/API type-check、i18n、production build、格式检查、Impeccable detector、CodeGraph sync/affected 与全局 `git diff --check` 均通过。CodeGraph 精确识别 6 个对应测试。最终日志为 `pmc062-final-focused-tests-20260828-204352.log`、`pmc062-web-tests-20260828-202710.log`、`pmc062-final-web-typecheck-20260828-204352.log`、`pmc062-api-typecheck-20260828-202710.log`、`pmc062-i18n-20260828-202710.log`、`pmc062-web-build-20260828-202826.log`、`pmc062-final-format-check-20260828-204352.log`、`pmc062-impeccable-final2-20260828-203039.log`、`pmc062-codegraph-sync-final-20260828-204232.log`、`pmc062-codegraph-affected-final-20260828-204316.log`、`pmc062-git-diff-check-20260828-204352.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc062/`。
- **容器与运行态**：Docker Web 镜像按当前源码重建为 `a14eb342c47e`，再 force-recreate `devpilot-app-web`；Web `/login` 返回 200，API 容器保持 healthy。构建/重建日志为 `pmc062-docker-build-web-20260828-203108.log`、`pmc062-docker-recreate-web-20260828-203347.log`。
- **桌面浏览器**：已登录 System Administrator 的隔离 task space 80 在真实 Picshare 1440×1000 页面验证返回按钮 `44×44` 且 href 为 `/projects`；项目配置、配置页项目概览与返回项目列表均真实点击成功；旧项目路由导航不存在。警告计算样式为 10% warning 底色、40% warning 边框、1px/8px；基本信息区和 6 个事实块上下边框均为 0。Tab 默认为 3 条发布记录，点击详情后只出现“环境运行版本 / 项目组件”，ArrowLeft 与 End 自动切换选中项并保持焦点。
- **390px 浏览器**：`html/body/main=390/390/390` 且页面横向溢出为 0；返回按钮、项目配置与创建发布均为 44px 高。Tab 轨道 `390/390` 且两个 Tab 都为 44px；发布表格视口 `356/1095`，详情两表为 `356/820`、`356/920`，表格滚到 `scrollLeft=180` 时页面仍为 0。完整交互记录为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc062/pmc062-browser-acceptance.md`，未触发任何发布、配置、版本切换或仓库分析写操作。
- **截图**：`pmc062-overview-releases-desktop.png`、`pmc062-overview-details-desktop.png`、`pmc062-settings-entry-desktop.png`、`pmc062-overview-releases-mobile-390.png`、`pmc062-overview-details-mobile-390.png`。
- **Skill 固化与真实缺口**：Workbench Skill、contract、产品设计 lessons、PRODUCT/DESIGN 已记录“配置为 Header 次级入口、基本信息无横线、同页内容 Tab、确定性返回、语义警告面”的规则。PMC062 无剩余本地代码或交互缺口；PMC015-PMC018 的合法生产运行事实仍是唯一外部证据 blocker，未被本切片伪造关闭。

### PMC063 概览工具栏、垂直节奏与仓库分析入口验收条件（已完成）

路由：`todo-plan`。只调整共享项目 Header、概览基本信息标题操作与发布列表工具栏的布局和响应式秩序；不修改 Project、RepositoryAnalysisRun、ReleaseOrder、BuildRun、DeploymentRun 或任何写入 API、状态、权限和持久化语义。

1. 发布记录搜索框与状态筛选作为集合控制，在桌面端位于列表表面左侧；“部署记录”作为跨页面出口位于同一工具栏右侧。390px 下允许自然换行，但 DOM、键盘和视觉阅读顺序必须先筛选、后跨页出口，且不得产生页面级横向溢出。
2. Header 与基本信息之间只保留一个垂直间距所有者：共享 Header 不再叠加下内边距，页面父级 gap 负责相邻区块节奏；不得用负 margin 或页面特例掩盖重复空白。
3. “查看仓库分析”是基本信息的上下文证据操作，必须紧跟“基本信息”标题并使用低强调链接式按钮；不得与 Header 的项目配置竞争、不得右侧悬挂，也不得占用“发布记录 / 环境与组件详情”的第三个持久内容 Tab。
4. 仓库分析 Modal 的真实 RepositoryAnalysisRun 数据、URL 查询参数、关闭返回和运行详情选择行为保持不变；无数据、错误、加载状态继续由现有真实模型展示，不补样例或虚构通过状态。
5. Workbench Skill、contract、设计 lessons 与 Web DESIGN 契约必须固化“集合控制左、跨页出口右”“上下文证据操作贴近所属标题”“Header/内容垂直间距单一所有者”三条规则。
6. 定向组件测试、Web/API type-check、i18n、Web 全量测试、production build、Impeccable detector、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面/390px 真实浏览器位置、键盘顺序、Modal、无溢出和截图证据齐全后，PMC063 才可标记 Done。

PMC063 完成证据（2026-08-28）：

- **代码与布局职责**：`release-orders-panel.tsx` 把 `ReleaseOrderListToolbar` 放在工具栏 DOM 首位、部署记录深链放在末位，并在桌面以 `justify-between` 分居左右；`release-order-list-toolbar.tsx` 改为从阅读起点排列且限制桌面搜索宽度，390px 搜索/状态自然堆叠。`project-workbench-header.tsx` 移除下内边距，只保留顶部 inset；`project-overview-summary.tsx` 把仓库分析改成紧跟“基本信息”的链接式上下文按钮，仍打开原 RepositoryAnalysisRun Modal。四个实现文件均低于 200 行。
- **API / 模型依据**：本切片没有新增 API、字段、成功状态或写入路径。发布列表继续使用真实 ReleaseOrder 服务端搜索/筛选，部署入口仍指向独立 DeploymentRun 路由；仓库分析继续读取真实规范仓库身份、分支/Commit、RepositoryAnalysisRun、阶段、证据与建议，URL 仍使用 `analysis=true/analysisRunId`。
- **Skill 与设计契约**：Workbench Skill、workbench contract、product-design lessons、problem-solution ledger 与 Web DESIGN 已固化“集合控制左、跨页出口右”“Header/内容间距单一所有者”“上下文证据操作贴近所属标题”的规则。
- **测试与静态验证**：定向测试、Web 全量测试、Web/API type-check、i18n、production build、Prettier、Impeccable final detector、CodeGraph sync/affected、scoped 与全局 `git diff --check` 均通过；CodeGraph 精确命中 `project-overview-information.spec.tsx`、`project-workbench-header.spec.tsx`、`release-orders-panel.spec.tsx`。最终日志为 `pmc063-focused-tests-20260828-223137.log`、`pmc063-web-tests-20260828-223214.log`、`pmc063-web-typecheck-20260828-223214.log`、`pmc063-api-typecheck-20260828-223214.log`、`pmc063-i18n-20260828-223214.log`、`pmc063-web-build-20260828-223252.log`、`pmc063-impeccable-final-20260828-223449.log`、`pmc063-codegraph-sync-final-20260828-223413.log`、`pmc063-codegraph-affected-20260828-223432.log`、`pmc063-final2-format-check-20260828-224823.log`、`pmc063-final2-scoped-diff-check-20260828-224823.log`、`pmc063-final2-global-diff-check-20260828-224823.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc063/`。
- **容器与运行态**：沙箱内首次 Docker build 因无权写 Buildx activity 目录失败，未写成成功；按允许的 Docker 权限重试后 Web 镜像成功重建为 `sha256:ff2b991cb49e763f277ce813321270249eb2cdbee1f5e130593fd442b72be48b`，并 force-recreate `devpilot-app-web`。Web `/login` 与 API `/api/health` 均返回 200，API 保持 healthy。成功日志为 `pmc063-docker-build-web-final-20260828-223605.log`、`pmc063-docker-recreate-web-20260828-223828.log`。
- **桌面浏览器**：1440×1000 下页面 `1440/1440` 无横向溢出；Header `padding-bottom=0px`，Header bottom `252` 到基本信息 top `276` 仅保留父级 `24px`；标题到分析操作间距 `4px`。发布表面 `280..1416`，搜索 `297..577`、部署入口 `1311..1399`，DOM 顺序为搜索/状态/部署。真实分析 Modal 展示 commit `8e7c465d`、运行历史、阶段和证据；关闭后 URL 清理并把焦点恢复到触发按钮。
- **390px 浏览器**：`html/body/main=390/390` 且页面横向溢出为 0；Header 下内边距仍为 0、Header 到基本信息仍为 `24px`，分析操作保持 `44px` 高。搜索/状态均为 `324×44`，部署入口右对齐且 `44px` 高；真实 Tab 顺序为搜索 Input → 状态控件 → 部署链接。发布表格视口 `356/1095`，表格横移 180 时 main/window 仍为 0；分析 Modal 宽 358px，显示真实运行且关闭恢复 URL/焦点。完整记录为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc063/pmc063-browser-acceptance.md`，未提交任何写操作。
- **截图与真实缺口**：截图为 `pmc063-overview-toolbar-desktop.png`、`pmc063-repository-analysis-modal-desktop.png`、`pmc063-basic-analysis-mobile-390.png`、`pmc063-overview-toolbar-mobile-390.png`、`pmc063-repository-analysis-modal-mobile-390.png`。PMC063 无剩余本地缺口；PMC015-PMC018 仍只缺合法生产运行事实，未被本切片伪造关闭。

### PMC064 基本信息语义分组与响应式网格验收条件（已完成）

路由：`todo-plan`。只调整 `ProjectOverviewSummary` 中六项真实事实的 DOM 顺序、网格跨度与响应式布局；不修改 Project、ReleasePolicy、RepositoryAnalysisRun、环境/组件计数、URL 状态或任何 API/写入语义。

1. 桌面端使用稳定的两行三列语义网格：第一行依次为“项目描述 / 发布策略 / 环境与组件”，第二行依次为“创建人 / 创建时间 / 最近更新”；不得继续用四列和跨两列拼接出互不相关的左右块。
2. 390px 使用两列阅读顺序：“项目描述”整行，“发布策略 / 环境与组件”同排，“创建人”整行，“创建时间 / 最近更新”同排；较长描述、创建人、策略说明和环境提示必须自然换行且不产生页面横向溢出。
3. 基本信息继续保持无卡片、无内部上下横线、无灰底的连续白底事实带；通过 DOM 顺序、列宽与间距建立分组，不增加装饰容器、分组标题或重复字段。
4. 所有值继续来自真实 Project、ReleasePolicy、Environment 与 ApplicationService 集合；缺失描述或创建人继续使用既有真实空值文案，不制造状态、人员或计数。“查看仓库分析”的位置、URL、Modal 和焦点行为保持不变。
5. Workbench Skill、contract、product-design lessons 与 Web DESIGN 必须固化“主要项目事实在首行、审计元数据在次行；窄屏按阅读顺序重排”的规则。
6. 定向测试、Web/API type-check、i18n、Web 全量测试、production build、Impeccable detector、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面/390px 真实浏览器顺序、网格几何、长文本/空值、无溢出和截图证据齐全后，PMC064 才可标记 Done。

PMC064 完成证据（2026-08-28）：

- **代码与布局职责**：`project-overview-summary.tsx` 用 `lg:grid-cols-3` 和真实 DOM 顺序建立两行三列语义网格：项目描述、发布策略、环境与组件在首行，创建人、创建时间、最近更新在次行；390px 下项目描述与创建人各跨两列，其余真实事实成对同排。没有新增卡片、分割线、底色或重复标题，源文件仍为 154 行。
- **API / 模型依据**：PMC065 没有新增 API、字段、状态或权限推断。面板继续读取真实 `RepositoryAnalysisState/Run/Stage/Suggestion` 与日志/证据；接入、凭据、分支修订、运行、重试/取消和建议应用继续调用既有 connect、identity branch-revisions、runs/retry/cancel/apply 端点及既有 read/write access policy，仍把每次分析限定为明确 branch/commit 快照。
- **Skill 与设计契约**：Workbench Skill、workbench contract、product-design lessons、problem-solution ledger 与 Web DESIGN 已同时固化“概览负责渐进披露分析证据、项目配置负责仓库身份维护、运行审核不等于持续扫描、折叠面板内部不再嵌套卡片”；PMC064 的语义事实网格规则继续保留。
- **测试与静态验证**：Web 全量测试、Web/API type-check、i18n、production build、Prettier、两次有界 Impeccable detector、CodeGraph sync/affected、源文件 200 行上限、scoped diff 与全局 `git diff --check` 均通过。最终日志为 `pmc065-web-tests-post-touch-targets-20260829-003335.log`、`pmc065-web-typecheck-post-touch-targets-20260829-003335.log`、`pmc065-api-typecheck-final-20260829-002156.log`、`pmc065-i18n-final-20260829-002156.log`、`pmc065-web-build-post-touch-targets-20260829-003409.log`、`pmc065-impeccable-final-20260829-002132.log`、`pmc065-impeccable-touch-targets-20260829-003327.log`、`pmc065-codegraph-sync-final-20260829-002310.log`、`pmc065-codegraph-affected-final-20260829-002320.log`、`pmc065-scoped-diff-20260829-004234.diff`、`pmc065-git-diff-check-20260829-004243.log`；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc065/`。
- **容器与运行态**：最终 `docker compose -f docker-compose.devpilot-app.yml build web` 与 `up -d --force-recreate web` 均通过，运行容器与本地镜像共同指向 `sha256:a823a06ff6ab08d95b82ffa1c2033dc4255772250086a6177e21e1208d037dd7`；Web `/login` 与 API `/api/health` 均返回 200，API 报告 `status=ok` 且 Compose 报告 API healthy。最终日志为 `pmc065-docker-web-build-touch-targets-20260829-003452.log`、`pmc065-docker-web-recreate-touch-targets-20260829-003702.log`。
- **桌面浏览器**：1440×1000 下仓库分析默认折叠；展开后面板高 962px，建议审核保持二级折叠，页面宽度与 viewport 均为 1440px。选择真实第二次运行后 URL 精确写入 `analysisRunId=cmsn0ecpy000berwtzp7dzt2r` 且选中行 `aria-current=true`；折叠清理参数。仓库设置不含环境选择器或分析运行列表；凭据重连 Modal 已打开并取消，未提交写操作。
- **390px 与键盘浏览器**：概览折叠/展开及仓库设置均为 `body/viewport=390/390`；展开面板宽 356px，分析对象动作与设置四个维护/审计动作均为 44px，建议审核默认折叠。Enter 键展开/折叠时 `aria-expanded`、URL 和焦点均正确。完整记录为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc065/pmc065-browser-acceptance.md`。
- **截图与真实缺口**：证据为 `pmc065-repository-analysis-collapsed-desktop.png`、`pmc065-repository-analysis-expanded-desktop.png`、`pmc065-repository-settings-desktop.png`、`pmc065-repository-settings-confirm-desktop.png`、`pmc065-repository-analysis-collapsed-mobile-390.png`、`pmc065-repository-analysis-expanded-mobile-390.png`、`pmc065-repository-settings-mobile-390.png`。PMC065 无剩余本地缺口；PMC015-PMC018 仍只缺合法生产运行事实，未被本切片伪造关闭。

### PMC065 仓库分析折叠面板与项目级仓库设置验收条件（已完成）

路由：`todo-plan`。真实问题是当前 `RepositoryTab` 把仓库身份查看、凭据/默认分支维护、分析运行、阶段证据和建议审核全部塞进由标题链接打开的 Modal；对象、查看证据和配置写入职责混杂，且 `Card → Card → stage border` 形成明显的卡片套卡片视觉。现有 API 已把读取、连接、分支修订、运行、重试/取消和建议应用分成独立端点，前端应按真实职责重新编排而不是复制原 Modal。

1. 项目概览必须在基本信息事实带正下方展示一个独立的“仓库分析”折叠面板，默认折叠；折叠标题显示真实连接/最近运行摘要，缺失时明确“未连接”或“暂无分析记录”，不得推导成功。不得继续把 `查看仓库分析` 放在基本信息标题后或使用 Modal 承载整套内容。
2. `analysis=true` 与 `analysisRunId` 继续作为可刷新、可返回的深链状态：`analysis=true` 展开面板，指定 Run 时加载并选中精确记录；折叠时清理面板查询参数，浏览器返回、刷新和运行选择保持一致。
3. 展开内容只承载仓库规范身份只读摘要、重新解析当前 Commit、分析运行历史、所选运行概览/阶段/日志/证据、建议审核及运行级取消/重试。运行和建议属于某次明确 branch/commit 分析，继续在此处完成；不得挪进环境配置或伪装成自动持续扫描。
4. 仓库连接/初次接入、凭据重连、默认分支修订及其高风险原因输入属于项目级配置写操作，迁入 `/projects/:id/settings?section=repository`。该页面明确为项目级“仓库设置”，不显示环境选择器；默认 `/settings` 仍进入环境配置，概览面板提供精确“管理仓库设置”入口，仓库设置提供返回环境配置入口。
5. 仓库分析面板只有一个外层轻量边界；运行列表、运行详情、阶段和建议使用分区、行或细分隔线，不得继续使用多层 Card/阴影/底色嵌套。桌面可用左侧运行列表与右侧详情，390px 必须按摘要、动作、记录、详情、建议自然纵向排列且无页面横向溢出。
6. 加载、读取失败、无连接、无运行、运行中、失败、取消、成功但无建议、待审核、已审核以及写入失败均使用真实 Hook/API 状态。页面只保留“创建发布”作为页面级主操作；重新解析、重试、取消、审核应用和配置入口均保持对象级层级与明确文案。
7. 连接与修订继续调用现有 `POST /repository-analysis/connect`、`POST /identity/branch-revisions`；运行与审核继续调用现有 runs/retry/cancel/apply 端点，后端访问策略与审计语义不变。本切片不新增后台字段、权限结论、负责人、自动扫描状态或成功兜底。
8. Workbench Skill、contract、product-design lessons、problem-solution ledger 与 Web DESIGN 必须固化“证据在概览渐进披露、项目级身份维护在项目配置、运行审核不等于持续扫描、折叠面板不嵌套卡片”的规则。
9. 定向测试、Web/API type-check、i18n、Web 全量测试、production build、Impeccable detector、CodeGraph sync/affected、源文件 200 行上限、scoped diff/`git diff --check`、容器重建，以及桌面/390px 折叠、深链、键盘、运行选择、配置路由、Modal 写操作、无溢出和截图证据齐全后，PMC065 才可标记 Done。

PMC065 完成证据（2026-08-29）：

- **代码与职责**：`project-overview-content.tsx` 在无横线基本事实后、内容 Tab 前挂载受 URL 控制的 `repository-analysis-panel.tsx`；只读身份、运行列表、运行详情/阶段/日志/证据与建议审核拆为单责组件。`project-settings-content.tsx` 仅在 `section=repository` 渲染项目级 `repository-settings-panel.tsx`，接入、凭据重连和默认分支修订不再与分析运行混在一个 Modal。旧 `tabs/repository-tab.tsx` 已删除；所有本切片源码均不超过 200 行。
- **真实 API / 权限**：仓库连接、身份修订、分析运行、重试/取消和建议应用端点及 Controller access policy 均未改变；按钮仍以 API 返回的 `allowedActions` 与真实运行状态决定可见/可用性。页面没有新增“自动持续扫描”、虚构成功态、负责人或恢复路径。
- **交互与状态**：干净概览 URL 默认折叠；`analysis=true` 展开，`analysisRunId` 加载并选中精确运行，折叠清理两项参数。读取错误可重试，无连接/无运行/运行失败/运行中/无建议/待审核/已审核均继续来自 Hook 状态；建议审核再使用默认折叠的二级 disclosure，避免证据展开造成超长页面。
- **视觉与响应式**：仓库分析只保留一层轻边界，内部使用列表、分区和 `divide-y`；仓库设置使用连续白底与横向事实带，没有卡片套卡片或环境选择行。1440px 无页面横向溢出；390px 自然纵排且所有新维护动作达到 44px。
- **静态、容器与浏览器**：最终日志、镜像 ID、浏览器尺寸、键盘/深链/Modal 记录及七张截图均已登记在“当前收口状态”PMC065 对应证据项和 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc065/pmc065-browser-acceptance.md`。凭据 Modal 只打开并取消；未对真实项目执行仓库重连、分支修订、重新分析或建议应用写操作。

### PMC066 仓库对象章节与分析证据阅读路径验收条件（已完成）

路由：`todo-plan`。真实问题是 PMC065 虽已拆除旧 Modal 与内部嵌套卡片，但概览仍用一个独立“展开详情”动作分裂了标题与 disclosure 语义，且折叠态仍占用一行展示最近解析。更重要的是，分析记录、阶段/日志证据与识别到的变更属于针对 branch/commit 的运行工作台和审核队列，不属于项目概览事实；继续留在概览会把低频技术操作混入日常发布阅读路径。

1. 一级标题必须描述真实对象且可预测其内容，采用“仓库与分析”而不是含义模糊的“更多信息”；标题文字与同一控件内的 chevron 直接承担展开/收起，具备 `aria-expanded`、`aria-controls`、键盘与至少 44px 触控目标，不再出现独立“展开详情 / 收起详情”按钮，也不把整块内容面无差别做成按钮。
2. 折叠态只保留“仓库与分析”标题，不单独占行展示最近解析结果。展开后才显示最近一次真实 RepositoryAnalysisRun 的状态、branch/commit 与时间；未连接、无运行、运行中、失败和读取错误必须使用真实状态文案，不得根据项目或发布成功状态推导解析成功。
3. 概览展开内容只承担只读摘要与去向：展示最新真实分析摘要，并提供精确的“查看仓库分析”和“管理仓库设置”次级入口。仓库 URL、凭据、默认分支等身份配置继续归 `项目配置 → 仓库设置`；概览不得继续承载运行操作、分析历史、阶段/日志证据、建议审核或建议应用。
4. 新增独立项目二级页“仓库分析”。`RepositoryAnalysisRun` 历史、所选运行概览、阶段与日志/证据属于运行工作台；`RepositorySuggestion` 的“识别到的变更”属于绑定该 branch/commit 分析运行的审核队列。二者在此页按“运行选择 → 运行证据 → 识别结果与审核”建立上下文，不进入项目配置，也不与概览事实混排。
5. 桌面使用紧凑的运行主从布局并强化所选记录关联；390px 使用运行选择器而不是先铺满全部历史。大量历史、长 SHA/URL、长日志、多建议、200% 缩放和英文文案均不能造成页面级横向溢出或失去操作上下文。
6. 概览 `analysis=true` 继续作为 disclosure 深链；历史 `analysisRunId` 必须显式迁移到独立仓库分析页，独立页的运行选择、刷新、轮询、允许动作和所有 run/retry/cancel/apply API 语义保持不变。不新增自动扫描、成功兜底、负责人、ETA、恢复路径或后台字段。
7. Workbench Skill、contract、product-design lessons、problem-solution ledger 与 Web DESIGN 同步固化“概览只读摘要、运行证据归独立工作台、身份维护归配置”的规则。
8. 定向/全量测试、Web/API type-check、i18n、production build、Impeccable detector、CodeGraph sync/affected、200 行上限、scoped diff/`git diff --check`、容器重建，以及桌面/390px 的概览折叠/展开、独立页、深链、键盘、无溢出和当前运行态截图齐全后，PMC066 才可标记 Done。

验收记录（2026-08-29）：

- **代码与状态模型**：`repository-analysis-panel.tsx` 只负责标题 disclosure、最新真实摘要与两个精确入口；`project-repository-analysis-route.tsx` / `repository-analysis-workbench.tsx` 承载运行选择、所选运行、阶段证据与建议审核；`project-repository-analysis-route.ts` 将旧 `analysisRunId` 显式迁移到 `/repository-analysis`。Hook 继续读取 `GET /projects/:id/repository-analysis`、`/runs`、`/runs/:runId` 并使用既有 start/retry/cancel/apply 写入，没有新增后台字段或成功兜底。
- **真实归属**：`RepositoryAnalysisRun` 历史、Stage/Log/Evidence 是 branch/commit 运行证据；`RepositorySuggestion` 是绑定所选运行的审核队列；RepositoryConnection、凭据和默认分支仍在 `项目配置 → 仓库设置`。概览 DOM 中不再出现“分析记录”或“识别到的变更”。
- **测试与构建**：focused tests `pmc066-focused-latest-rerun-20260829-121057.log` 通过；Web 全量 `pmc066-web-full-tests-latest-20260829-121121.log` 通过；Web type-check、API type-check、i18n、最终 production build 分别通过 `pmc066-typecheck-after-breadcrumb-20260829-121802.log`、`pmc066-api-typecheck-latest-confirm-20260829-121201.log`、`pmc066-i18n-after-breadcrumb-20260829-121802.log`、`pmc066-web-build-final-20260829-121818.log`。最终 Impeccable detector 返回空数组，CodeGraph sync/affected 和 scoped diff/`git diff --check` 均通过；所有新增主要职责文件不超过 117 行。
- **容器与浏览器**：`pmc066-compose-rebuild-final-20260829-121856.log` 通过；最终容器 `devpilot-app-web` 使用镜像 `sha256:9379e0b2ddcc27f8002374025bcf3fb6b7d10d5b52fa1233d26e3ddd8cb65a5b` 且为 running，`http://localhost:3120` 返回 200。1440px 与 390px 均无页面级横向溢出；标题控件为原生 `button`、`aria-expanded/controls` 正确、390px 高度 44px，点击展开/收起与 `analysis=true` 同步。运行选择产生 `analysisRunId`，刷新保持 `aria-current=true`；旧概览深链迁移到独立页，`项目概览` 返回清理运行焦点。浏览器后端的单键模拟未触发原生按钮，但活动焦点、原生 button 语义、静态组件测试和实际点击状态均已验证；没有把工具模拟限制写成产品成功证据。
- **截图**：`pmc066-repository-overview-collapsed-desktop.png`、`pmc066-repository-overview-expanded-desktop.png`、`pmc066-repository-analysis-desktop.png`、`pmc066-repository-overview-collapsed-mobile-390.png`、`pmc066-repository-overview-expanded-mobile-390.png`、`pmc066-repository-overview-expanded-mobile-390-content.png`、`pmc066-repository-analysis-mobile-390.png`、`pmc066-repository-analysis-mobile-390-review.png`。本地数据只有已审核建议，未伪造 pending 审核状态。

### PMC067 项目工作台全页面组合视觉审计验收条件（已完成）

路由：`todo-plan`。审计范围是当前 Devpilot 项目工作台的项目概览、发布列表与发布详情、环境与组件、项目配置全部子区、仓库设置、域名与入口、部署记录及部署证据 Drawer；必须从当前容器中的真实页面、真实数据与实际可达状态出发，不复用旧截图代替本轮证据。

1. 先建立实际路由、子区、弹层、空/错/加载/权限与桌面/移动状态清单，再按真实入口顺序截图；每张用于结论的截图都保存到 `evaluation/screenshots/2026-08-29/project-module-visual-audit/` 并完成视觉检查。
2. 审计以编号页面/步骤记录可用状态、优点、视觉层级、信息架构、密度、对齐、间距、卡片/边界、表格/滚动、操作层级、状态色、空错态、响应式和可访问性问题；结论必须能指向具体页面、对象和截图，不能只写泛化原则。
3. 问题按 P0/P1/P2 标注影响和修复方向，并区分本地视觉/交互缺口、需要真实数据才能覆盖的状态和外部生产证据 blocker；不得把未运行、未截图或不可达状态描述为已验证。
4. PMC067 本身是只读组合审计，不自动授权对 PMC066 之外的页面批量修改。审计报告、截图索引、浏览器尺寸/溢出/键盘记录以及真实限制写入同一权威 TODO 后，才能将 PMC067 标记 Done。

验收记录（2026-08-29）：

- 报告：`docs-internal/reviews/2026-08-29-devpilot-project-module-visual-audit.md`。
- 截图：`evaluation/screenshots/2026-08-29/project-module-visual-audit/` 共 51 张（`00-50`），覆盖概览、创建发布、配置七子区、仓库设置、仓库分析、域名列表/Drawer/流程、部署表格/五区 Drawer、发布生命周期/日志与兼容路由的桌面和代表性 390px 状态。
- 结论：未发现 P0；记录 8 个 P1（双域名入口、独立域名 scope 空行、域名/部署 Drawer 嵌套、移动发布输入过长、变量 Modal 页脚、生命周期状态、兼容发布路由）和 5 个 P2。当前缺少运行中 Deployment/Build、合法 Production/回滚、非管理员和新 pending repository suggestions，均明确标注为未覆盖而非已验证。

### PMC068 高级信息、仓库概览与分析入口归属纠正验收条件（已完成）

路由：`todo-plan`。真实问题是 PMC066 把整个折叠区命名为“仓库与分析”，却只展示一行分析运行摘要，导致标题、内容范围和用户预期不一致；同时把“管理仓库设置”作为概览入口，混淆了只读项目事实与身份维护。最新明确要求把折叠区定义为低频“高级信息”，在其中直接展示真实仓库概览，并让最近解析时间与解析产物处于同一分析上下文。

1. 折叠区标题改为“高级信息”；标题与 chevron 继续作为唯一 disclosure 控件，默认折叠，保留 `aria-expanded`、`aria-controls`、键盘与至少 44px 触控目标，不新增独立展开按钮。
2. 展开后首先使用无卡片嵌套的紧凑事实布局显示真实仓库概览：仓库地址、provider/visibility、默认或当前分支、当前 commit 与最近连接验证时间；字段缺失必须显示真实空态，不从项目发布状态推导。
3. 仓库分析仅以一个只读概览区出现。最近一次运行状态、branch/commit、解析时间必须与该次运行的真实解析产物放在一起；解析产物只可使用 `RepositoryAnalysisRun`、stage 与 suggestion 的实际字段和数量，没有运行或没有识别结果时明确显示暂无数据。
4. 概览只保留低强调的“查看仓库分析”入口，进入现有独立二级页；不得在高级信息中出现“管理仓库设置”、运行恢复、建议审核或其他写操作。仓库连接、凭据重连和默认分支修订继续仅归 `项目配置 → 仓库设置`。
5. 不新增后台字段、分析成功兜底、自动扫描、负责人、ETA 或推测性结论。独立仓库分析页及 `analysisRunId` 深链继续承载运行历史、阶段/日志/证据和识别结果审核。
6. 桌面端使用清晰的仓库概览/最近分析两段线性信息层级；390px 自然纵排，长 URL/SHA 不造成页面横向溢出，不出现卡片套卡片或大块空白。
7. 更新中英文文案、组件测试、项目专用 Workbench/lessons/contract 与视觉审计结论；定向测试、Web/API type-check、i18n、production build、Impeccable detector、CodeGraph sync/affected、200 行上限、scoped diff/`git diff --check`、容器重建、桌面/390px 浏览器交互和截图齐全后，PMC068 才可标记 Done。

验收记录（2026-08-29）：

- **代码与职责**：`project-advanced-information.tsx` 只负责 disclosure 与读取错误边界；`repository-overview.tsx` 只投影 `RepositoryConnection/canonicalIdentity` 的仓库事实；`repository-latest-analysis-overview.tsx` 只投影最新 `RepositoryAnalysisRun` 的状态、时间、阶段与 suggestion 结果。`project-overview-content.tsx` 不再构造或传入仓库设置链接，旧 `repository-analysis-panel.tsx` 已移除。所有新增生产源码均不超过 185 行。
- **真实 API / 模型**：仓库地址、provider/visibility、默认分支、commit、`verifiedAt` 来自既有 `GET /projects/:id/repository-analysis`；最新运行、stage 和 `_count/suggestions` 来自既有 `/runs` 与 `/runs/:runId`。Picshare 当前真实页面为 `file:///read-only-repositories/picshare`、`master@8e7c465d56e6`、6/6 阶段、6 条识别结果、0 条待审核；没有从发布成功推导分析状态，也没有新增字段或写操作。
- **交互与归属**：`高级信息` 标题/chevron 是唯一展开控件，默认折叠；展开后按 `仓库概览 → 最近仓库分析` 线性阅读，最近成功、完成时间和实际识别内容处于同一区域。概览仅保留 `查看仓库分析`，DOM 中 `section=repository` 设置链接数量为 0；独立仓库分析页继续承担运行历史、阶段证据与审核，连接/凭据/默认分支仍只在项目配置维护。
- **测试与静态证据**：定向组件测试 `pmc068-focused-tests-after-model-20260829-141817.log`、Web 全量 207 文件/741 测试 `pmc068-web-full-tests-20260829-141912.log`、Web type-check `pmc068-web-typecheck-after-model-20260829-141817.log`、API type-check `pmc068-api-typecheck-20260829-141912.log`、i18n `pmc068-i18n-after-model-20260829-141817.log`、production build `pmc068-web-production-build-20260829-142008.log` 均通过。Impeccable detector 返回空数组；CodeGraph sync 和四个 affected 查询通过。
- **容器**：首次全 compose BuildKit 尝试因无关 API 基础镜像 registry metadata 长时间无响应而中止，legacy builder 因 Dockerfile 必需的 BuildKit cache mount 明确失败；随后只构建本切片涉及的 Web 镜像并 `--no-deps --force-recreate web` 成功。新镜像为 `sha256:a4b0ae777709b591abecc7b5892fb85997cd14e8fdf036e12f48463791bdc0aa`，Web 与既有健康 API 均返回 200。
- **浏览器与截图**：System Administrator 真实登录态下，1440px 和 390px 均完成折叠、展开、分析页跳转、返回与收起；390px 文档宽度等于视口 390、面板宽 358、触控高度 44，长 URL/SHA 无页面级横向溢出。截图为 `pmc068-advanced-information-collapsed-desktop.png`、`pmc068-advanced-information-expanded-desktop.png`、`pmc068-advanced-information-collapsed-mobile-390.png`、`pmc068-advanced-information-expanded-mobile-390-final.png`；完整记录见 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc068/pmc068-browser-acceptance.md`。
- **真实缺口**：PMC068 无剩余本地缺口；当前数据没有待审核 suggestion，页面如实显示 0，未伪造 pending 状态。PMC015-PMC018 的合法生产运行事实仍是独立外部 blocker。

### PMC069 仓库详情与环境/组件内容模式重组验收条件（已完成）

路由：`todo-plan`。真实问题是 PMC068 的“高级信息”不能预告其中只读仓库事实，且把仓库身份事实与分析运行概览并列后扩大了低频折叠区；概览内容模式又把运行态环境版本与代码结构组件叠在同一个 Tab，组件识别来源和完整仓库分析之间缺少清晰分层。“查看组件差异”也应进入组件上下文，而不是借由仓库详情 disclosure 承担导航。

1. 将概览折叠区改名为“仓库详情”，标题与 chevron 继续作为唯一 disclosure 控件；普通项目 URL 默认折叠，只有用户主动展开或兼容的显式 disclosure 深链才展开，保留键盘、ARIA 与至少 44px 触控目标。
2. 仓库详情只展示真实只读仓库事实：仓库地址、provider/visibility、默认或当前分支、当前 commit 与最近连接验证时间；移除最近分析概览和分析入口，不新增仓库维护写操作，连接、凭据与默认分支仍只归 `项目配置 → 仓库设置`。
3. 把“环境与组件详情”拆为同级“环境”和“组件”两个内容 Tab，与“发布记录”组成三个短标签；默认仍为发布记录，三个 Tab 均使用 URL 状态支持刷新、前进/后退、项目问题深链与正确焦点/ARIA 关系。
4. 环境 Tab 只承载真实 `EnvironmentVersion` 运行态表格；组件 Tab 只承载真实 `ApplicationService` 表格，并在表格前使用无嵌套卡片的紧凑“最近组件识别”摘要展示最新 `RepositoryAnalysisRun` 的状态、branch/commit、时间、真实 `application_service` 结果数及待审核数。
5. 组件摘要只保留低强调“查看完整仓库分析”入口，进入既有独立二级页。运行历史、阶段/日志/证据、重试/取消、完整建议审核以及 `project_repository / environment / resource_requirement` 结果不得进入组件 Tab。
6. 项目级“查看组件差异”动作必须深链到组件 Tab；不得通过发布成功、旧状态或总 suggestion 数推导组件识别成功/数量，缺少运行或组件识别结果时展示真实空态。
7. 桌面端三个短 Tab、摘要和表格保持一条清晰阅读路径；390px 不出现页面级横向溢出，宽表格仍只在自己的视口滚动，不重复 Tab 名作为面板标题，不出现卡片套卡片。
8. 同步更新中英文文案、项目 Workbench/lessons/contract 与 Web DESIGN 契约；完成定向/全量测试、Web/API type-check、i18n、production build、Impeccable detector、CodeGraph sync/affected、200 行上限、scoped diff/`git diff --check`、容器重建、桌面/390px 浏览器交互和截图后，PMC069 才可标记 Done。

PMC069 验收记录（2026-08-29）：

- **代码与职责**：`project-repository-details.tsx` 只编排 disclosure 与仓库读取错误态，`repository-overview.tsx` 直接渲染真实只读事实；`project-overview-tabs.tsx` 与 model 提供三组 URL-backed Tab；环境、组件表格和最近组件识别摘要分别由独立组件承担。所有本切片源文件均不超过 200 行，没有新增循环依赖或重复分析模型。
- **API 与真实模型**：仓库详情使用现有 `RepositoryConnection/canonicalIdentity`；环境与组件分别使用 `EnvironmentVersion`、`ApplicationService`；最近组件识别使用最新 `RepositoryAnalysisRun`，并只统计详情中 `kind=application_service` 的 suggestion。API 的 `configure_services` 修复动作现在返回 `?view=components`，仓库检查动作继续进入独立 `/repository-analysis`；未用总 suggestion 数或发布成功状态推导组件数量/成功。
- **路由与交互**：发现并修复旧 unknown-view guard 会清除 `view=environments/components` 的真实缺陷。浏览器已验证普通 URL 默认折叠、`repository=true` 展开、旧 `analysis=true` 兼容、三个 Tab 的刷新/前进/后退、项目“查看组件差异”深链，以及“查看完整仓库分析”进入独立页。
- **测试与静态证据**：Web 定向测试见 `pmc069-web-focused-20260829-152353.log`，API 定向测试见 `pmc069-api-focused-20260829-152401.log`；Web 全量 `208 files / 747 tests`、Web/API type-check、i18n、Web/API production build、Prettier、Impeccable detector、CodeGraph sync/四个 affected 查询、scoped diff 与 `git diff --check` 均通过。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc069/svton/`。
- **运行态与浏览器证据**：Web/API 镜像已重新构建并运行，最终镜像分别为 `sha256:877365fbc9f5208c50ae9710b35023f206336ed32701c888da471de5c22969ac` 与 `sha256:99d285b2364497cfb0b0c7f45a53bc268e9b8082abad38a8624003edf3e77c43`；API 运行态已返回 `configure_services → ?view=components`。1440px 与 390px 均无页面级横向溢出；移动环境表格为 `356/820`、组件表格为 `356/920`，只在各自表格视口滚动，完整分析入口触控高度为 44px。
- **截图证据**：`pmc069-overview-desktop.png`、`pmc069-repository-details-desktop.png`、`pmc069-components-desktop.png`、`pmc069-overview-mobile-390.png`、`pmc069-repository-details-mobile-390.png`、`pmc069-environments-mobile-390.png`、`pmc069-components-mobile-390.png`。
- **真实缺口**：PMC069 无剩余本地缺口。当前 Picshare 最新运行真实包含 4 条 `application_service` 结果、0 条待审核组件结果；没有可用于展示待审核态的当前数据，因此页面如实显示 0，未伪造示例。PMC015-PMC018 的合法生产运行事实仍是独立外部 blocker。

### PMC070 仓库详情默认状态与概览 Tab 表格去卡片化验收条件（已完成）

路由：`todo-plan`。真实问题是“仓库详情”的展开状态写入 `repository=true` 后会在刷新或返回项目概览时继续生效，导致 disclosure 没有稳定的默认折叠状态；同时发布、环境和组件三个 Tab 均复用带圆角、外边框与阴影的 `ProjectTableSurface`，在已有 Tab 内容层级中形成多余的独立卡片外壳。

1. “仓库详情”由组件持有当前页面会话内的 disclosure 状态，并始终以 `false` 初始化；用户点击标题后仍可展开/收起，保留 `aria-expanded`、`aria-controls`、键盘与至少 44px 触控目标。
2. 普通 disclosure 展开不再写入或依赖 `repository=true` / `analysis=true`；独立仓库分析页及合法 `analysisRunId` 迁移仍保持原有深链能力。
3. `ProjectTableSurface` 增加职责明确的嵌入式视觉变体；只在项目概览的发布、环境、组件三个 Tab 使用，去掉圆角、外边框和阴影，部署记录、域名与其他独立表格继续保持现有卡片表面。
4. 去卡片化后保留工具栏、表头、行分隔、错误/加载/空态、操作列及表格自身横向滚动，不给页面主体新增横向溢出。
5. 完成定向组件/路由测试、Web type-check、i18n、production build、Impeccable detector、CodeGraph affected、200 行上限、scoped diff/`git diff --check`、容器重建与桌面/390px 浏览器交互截图后，PMC070 才可标记 Done。

PMC070 验收记录（2026-08-29）：

- **代码与状态**：`ProjectRepositoryDetails` 现在以组件本地 `useState(false)` 持有展开状态，父级 `ProjectOverviewContent` 不再读取、写入或保留 `repository/analysis` disclosure 查询参数；`project-repository-analysis-route.ts` 只保留独立仓库分析页和合法旧 `analysisRunId` 迁移。重新挂载以及带旧 `repository=true` 的实际页面均为 `aria-expanded=false`。
- **表格视觉职责**：共享 `ProjectTableSurface` 新增 `card / embedded` 变体。只有 embedded 概览中的发布表、环境表和组件表去掉圆角、外边框与阴影；工具栏、表头、行分隔、空错加载态、操作和 `overflow-x-auto` 保留。部署、域名等未传 embedded 的独立表格继续使用原有 card 变体。
- **测试与静态证据**：6 个定向文件测试通过，日志为 `pmc070-web-focused-20260829-161849.log`；i18n、production build、build 后独立 type-check、Prettier、Impeccable detector `[]`、CodeGraph sync/affected 和 200 行检查均通过。首轮并行 type-check 仅因 Next build 同时重建 `.next/types` 报 TS6053，串行重跑 `pmc070-web-typecheck-after-build-20260829-161937.log` 已通过；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc070/svton/`。
- **容器与浏览器证据**：Web 镜像 `sha256:0de0e84f6726c2c80943af7788ff7ff17f4da6ef4d4efd34ffaa9c0c5d232440` 已重建并替换运行容器，API 继续保持 healthy。桌面发布/环境/组件三个表面均为 `embedded / border 0px / radius 0px / shadow none / pageOverflow 0`；390px 三表内部视口/内容宽分别为 `358/1095`、`358/820`、`358/920`，设置 `scrollLeft=180` 生效而页面保持 `390/390`。
- **截图证据**：`pmc070-overview-collapsed-desktop.png`、`pmc070-environments-flat-desktop.png`、`pmc070-components-flat-desktop.png`、`pmc070-overview-collapsed-mobile-390.png`、`pmc070-environments-flat-mobile-390.png`、`pmc070-components-flat-mobile-390.png`。
- **真实缺口**：PMC070 无剩余本地缺口；本切片只改变 disclosure 临时 UI 状态与表格外层视觉，不改变仓库、发布、环境、组件或分析数据模型/API。PMC015-PMC018 的合法生产运行事实仍是独立外部 blocker。

### PMC071 最近组件识别摘要与完整分析入口收敛验收条件（已完成）

路由：`todo-plan`。真实问题是组件 Tab 的最近识别摘要使用 `justify-between` 横跨整个内容宽度，识别对象与唯一的“查看完整仓库分析”入口被放在左右两个极端；宽屏下中间形成大块无信息空白，入口看起来像与摘要无关的工具栏动作。

1. “查看完整仓库分析”作为低强调上下文链接紧跟“最近组件识别”标题，不再占据内容区最右端；标题与入口保持同一 DOM、视觉和键盘阅读组。
2. 真实状态、branch/commit、完成/创建时间和组件识别数量继续按现有事实顺序呈现，不改动 `RepositoryAnalysisRun` 或 `application_service` suggestion 的筛选和空/错态语义。
3. 摘要保持无卡片、无额外底色和边框；桌面形成紧凑左对齐信息块，390px 下标题/入口可自然换行且入口保留至少 44px 触控高度，不产生页面横向溢出。
4. 更新项目 Workbench/设计经验契约并完成定向测试、Web type-check、i18n、production build、Impeccable detector、CodeGraph affected、200 行、scoped diff/`git diff --check`、容器重建与桌面/390px 浏览器截图后，PMC071 才可标记 Done。

PMC071 验收记录（2026-08-29）：

- **代码与真实状态**：`ProjectComponentAnalysisOverview` 不再用整行 `justify-between` 分离对象与动作；上下文 Link 紧跟标题，运行状态、branch/commit、完成/创建时间、真实 `application_service` 数量和空态顺序保持不变。没有新增字段、状态、API 或卡片表面。
- **契约与测试**：WorkBench skill/contract、产品设计 skill/ledger 与 Web `DESIGN.md` 已固定“短摘要的唯一查看动作必须邻近对象标题”规则。2 个定向测试文件通过，日志为 `pmc071-web-focused-20260829-165634.log`；Web type-check、i18n、production build、Prettier、Impeccable detector `[]`、CodeGraph sync/affected、108 行组件上限与 scoped diff/`git diff --check` 均通过。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc071/svton/`。
- **容器与浏览器证据**：Web 镜像 `sha256:f6f2f66df8008b09f02c1fcfca24d8c6b008e8d3e6d95f25e48293cbc39c9bc1` 已重建并替换运行容器，API 为 healthy。桌面标题与入口横向间距为 `12px`、同一行且 `pageOverflow=0`；390px 下属于同一紧凑标题组、入口触控高度为 `44px` 且 `pageOverflow=0`。点击真实 Link 已进入 `/projects/cmrwxl1ks000k6enjiclutd5a/repository-analysis`。
- **截图证据**：`pmc071-component-analysis-compact-desktop.png`、`pmc071-component-analysis-compact-mobile-390.png`。
- **真实缺口**：PMC071 无剩余本地缺口；当前页面继续如实展示 `4` 条已识别组件与 `0` 条待审核，不从其他 suggestion 类型或分析整体状态推导组件结果。PMC015-PMC018 的合法生产运行事实仍是独立外部 blocker。

### PMC002 / PMC004 / PMC005 / PMC007 共享页面收口验收条件（已完成）

1. 项目信息、发布列表、项目配置、域名与入口、部署记录的标题、内容宽度、白底轻表面和表格密度必须来自实际路由组件，Navbar 与面包屑保持现状。
2. 页面只保留一个页面级主操作；表格行内详情、证据、版本及 Overflow 属于对象级操作，不使用竞争性主按钮。
3. 项目级警告位于所属内容顶部，同时告知对象、问题与精确修复入口；修复入口在 390px 下具有至少 44px 可点区域。
4. 共享表格和行内操作覆盖标题栏、状态、空/错/加载态、直接操作与 Overflow；在 390px 下项目级关键操作的触控高度至少 44px，桌面端可保持紧凑密度。
5. 五个实际二级入口在 390px 下 `body/main/viewport` 等宽、无页面级横向溢出；完成 CodeGraph 影响面、定向测试、Web type-check、i18n、production build、容器重建、桌面/390px 交互和截图后，再分别将 PMC002/004/005/007 标记 Done。

PMC002 / PMC004 / PMC005 / PMC007 完成证据（2026-08-28）：

- **代码与职责**：`project-workbench-surface.tsx` 统一连续白底轻表面、标题节奏、表格密度及移动/桌面响应式紧凑操作。项目警告、环境版本、组件、发布行、设置修订、配置专业模块入口、部署目标修复入口和发布阻断修复入口均复用该规则；移动端为 44px，`sm` 以上回到 32/36px 桌面密度。源文件最长 200 行，未把共享样式复制到业务组件。
- **API / 模型边界**：本切片没有新增业务字段或状态推导；项目信息、EnvironmentVersion、ApplicationService、ReleaseOrder/BuildRun/DeploymentRun、EnvironmentConfigRevision、Site 和部署列表继续使用现有真实 API 投影。资源、变量、访问策略在当前 Production 无记录时展示真实空态，没有生成样例表格行。
- **表格与状态矩阵**：桌面端逐页复核项目信息、发布、项目配置、域名、部署五个入口；项目配置又逐一切换版本、部署目标、资源、变量、访问、验证六个子区。现有数据展示紧凑表格与真实状态，无数据展示空态；直接详情/证据和 Overflow 没有变成第二个页面级主操作。
- **警告层级**：项目组件差异警告保持在项目内容顶部；发布准入决策作为预发阶段级警告仅出现一次，“当前环境目标不满足”只位于预检内容区，构建/部署/验证内容未重复该环境警告。“前往基线检查”“前往部署目标设置”均与阻断原因同区域并为 44px。
- **测试与构建**：定向测试 `pmc002-007-focused-tests-release-final-20260828-054428.log`、Web type-check `pmc002-007-web-typecheck-release-final-20260828-054439.log`、i18n `pmc002-007-i18n-release-final-20260828-054439.log`、production build `pmc002-007-web-build-release-final-20260828-054446.log` 均通过。CodeGraph 初始影响面、sync/affected 和完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc002-007/`。
- **容器与交互**：最终镜像构建 `pmc002-007-compose-build-web-release-final-20260828-054519.log`、强制重建 `pmc002-007-compose-force-recreate-web-release-final-20260828-054720.log` 通过。五个项目入口和六个设置子区均实测 `body/main/viewport=390`，项目模块内未再出现低于 44px 的关键操作；Navbar/面包屑按要求保持不动。组件 Modal、BuildRun 证据 Drawer、修订历史打开/关闭均通过；四个可达预发子步骤逐一切换，生产/验证/完成阻断步骤点击后 URL 不变。
- **截图**：桌面五入口为 `pmc002-project-information-desktop-final.png`、`pmc004-releases-desktop-final.png`、`pmc004-settings-versions-desktop-final.png`、`pmc005-domains-desktop-final.png`、`pmc004-deployments-desktop-final.png`；六个配置子区为 `pmc004-settings-*-desktop.png` / `pmc004-settings-*-mobile-390*.png`；行操作与弹层为 `pmc004-component-actions-mobile-390.png`、`pmc004-release-actions-mobile-390.png`、`pmc004-component-details-modal-mobile-390.png`、`pmc004-release-evidence-drawer-mobile-390.png`；警告修复为 `pmc005-warning-action-mobile-390.png`、`pmc005-release-repair-actions-mobile-390.png`。

### PMC003 操作层收口验收条件（已完成）

1. 项目五个二级入口与配置六个子区建立实际渲染链的操作矩阵：视图范围/当前环境/列表筛选可直接 Select/Input；业务写入必须进入 Modal，详情与证据进入 Modal/Drawer，危险删除使用 ConfirmDialog。
2. 项目信息的版本切换、仓库分析，发布创建，六子区的目标/资源/变量密钥/策略/验证/修订写入，域名添加编辑与删除，以及部署证据必须全部映射到实际弹层组件，不保留页面主体内联保存。
3. `ProjectDeliverySummary.checkpoints[].action` 必须指向当前真实存在的修复界面；`review_repository / repair_baselines / configure_services` 通过 URL 打开项目信息仓库分析 Modal，不得继续指向已删除的设置子区。
4. URL 打开的 Modal/Drawer 必须支持刷新保留、关闭清理参数和页面内触发器焦点返回；失败、空态与权限边界继续由实际 Hook/API 提供，不伪造可写操作。
5. 完成 API/Web 定向测试、type-check、i18n、production build、CodeGraph、scoped diff、容器重建及桌面/390px 浏览器操作矩阵和截图后，PMC003 才可标记 Done。

PMC003 完成证据（2026-08-28）：

- 代码 / API：`project-delivery-readiness.presenter.ts` 不再把 `review_repository / repair_baselines / configure_services` 指向已删除的 `settings?section=repository`，而是统一生成 `/projects/:id?analysis=true`；`project-delivery-checkpoint.presenter.ts` 分离检查点与动作映射职责，新增路由契约测试固定真实入口。`project-information-panel.tsx` 使用 URL 驱动仓库分析 Modal，保留 `analysisRunId` 并只在关闭时清理 `analysis`。
- 部署深链 / 焦点：`project-deployments-route.tsx` 不再把 `runId` 传给整页 `useProjectDetail`；精确运行仍由 `ProjectDeploymentRunsTable -> loadProjectDeploymentRun -> GET /deployments/runs/:runId?projectId=...` 加载。表格关闭时等待路由清除 `runId` 再卸载 Drawer，稳定触发器键由 `ProjectDeploymentRunRow` 提供，`useDeploymentRunFocusRestore` 在退出动画后恢复焦点。
- 操作矩阵：真实登录项目 `cmrwxl1ks000k6enjiclutd5a` 逐项打开仓库分析、环境版本切换、创建发布、部署目标、资源绑定、变量密钥、访问策略、验证配置、域名新增和部署证据共 10 个实际弹层；业务写入均位于 Modal，详情/证据位于 Modal/Drawer，目标解绑与域名删除继续使用 ConfirmDialog。未提交任何写操作。
- 390px 页面矩阵：项目信息、发布、配置、域名、部署五个入口均实测 `body/main/viewport = 390`；配置六子区通过真实视图 Select 切换到 `versions / targets / resources / variables / access / verification`，页面只保留当前环境、子区切换、筛选等直接 Select/Input，写操作按钮进入弹层。
- 真实交互：仓库分析 URL 直接打开与刷新均保留 Modal，关闭只清理 `analysis`；部署 `runId=cmt4j73po006ylmcmji3cnvw6` 打开 Drawer，关闭后 URL 清除、Drawer 消失、焦点精确返回 `data-deployment-run-trigger="cmt4j73po006ylmcmji3cnvw6:evidence"` 的“查看证据”按钮，直接深链与刷新均重新打开同一运行。桌面 Drawer 与 390px Drawer / Modal 均实测。
- 测试 / 构建：API 定向测试 `pmc003-api-focused-tests-final-20260828-060548.log`、API type-check `pmc003-api-typecheck-final-20260828-060601.log`、API build `pmc003-api-build-20260828-055809.log`；Web 定向测试 `pmc003-web-focused-tests-close-race-20260828-063007.log`、Web type-check `pmc003-web-typecheck-close-race-20260828-063007.log`、i18n `pmc003-i18n-final-after-focus-20260828-063746.log`、production build `pmc003-web-build-final-20260828-063746.log` 全部通过。
- 容器 / 影响面：Web 镜像构建 `pmc003-compose-build-web-close-race-20260828-063019.log`、服务重建 `pmc003-compose-force-recreate-web-close-race-20260828-063220.log` 通过；CodeGraph sync / affected 为 `pmc003-codegraph-sync-final-20260828-063813.log`、`pmc003-codegraph-affected-final-20260828-063819.log`；`git diff --check` 为 `pmc003-git-diff-check-final-20260828-063823.log`，scoped diff 为 `pmc003-scoped-diff-final-20260828-063906.diff`。
- 截图：`pmc003-repository-analysis-modal-desktop.png`、`pmc003-repository-analysis-modal-mobile-390.png`、`pmc003-deployment-evidence-drawer-desktop.png`、`pmc003-deployment-evidence-drawer-mobile-390.png`、`pmc003-resource-binding-modal-mobile-390.png`。
- 真实缺口：PMC003 操作层本身无剩余本地缺口；生产步骤不可达、真实生产验证证据不足等问题仍分别保留在 PMC015-PMC018，不借由弹层骨架标记完成。

### PMC021 环境版本与组件操作验收条件（已完成）

1. 项目信息环境表的“切换版本”必须由真实 `/environment-versions` 候选与执行 API 驱动，在 Modal 中展示目标环境、候选版本、提交中与失败反馈；无候选时保持禁用，不制造可切换版本。
2. 按 4.3 的产品边界，“版本配置”从项目信息进入带 `env` / `envTab=versions` 的项目配置子区；该子区的详情、变更和技术证据进入统一 Modal，实际切换写操作使用带影响说明的 ConfirmDialog，并分别恢复触发器焦点。
3. “查看组件”和“仓库分析”使用统一 Modal，字段只来自 Project / RepositoryAnalysis；关闭后回到原按钮，仓库分析 URL 入口继续支持刷新和关闭清参。
4. 桌面与 390px 验证环境表/组件表的水平滚动、44px 操作目标、Modal 宽度、键盘焦点、失败/空态/禁用态；不提交环境版本切换等真实写操作。
5. 定向测试、Web type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器页面交互和截图齐全后，PMC021 才标记 Done。

PMC021 完成证据（2026-08-28）：

- API / 状态模型：项目信息环境表继续读取 `GET /projects/:projectId/delivery/environment-versions` 的真实 environments、currentEnvironmentVersionId、ArtifactManifest、BuildRun 与 DeploymentRun；切换只调用 `POST /projects/:projectId/delivery/environment-versions/:environmentId/actions`。当前预发有真实候选，Production 无当前版本时显示 `—`；设置区候选因 `targetReadiness.matchState !== ready` 保持禁用并显示“环境部署目标未就绪”，未伪造可切换状态。
- 操作边界：项目信息“切换版本”使用 Modal；“版本配置”实际进入带 `section=environments&envTab=versions&env=staging` 的配置子区；版本详情、变更、技术证据使用 Modal，版本写入继续使用带后果说明的 ConfirmDialog；组件详情与仓库分析均为 Modal。
- 失败闭环：`ProjectEnvironmentVersionsTable` 在切换 Modal 内直接显示真实执行错误与重试入口，解决错误只出现在被遮挡表格后的问题；失败时保留选择与弹层，不虚构成功。
- 焦点闭环：`ReleaseOrderActions` 把实际直接按钮或稳定 Overflow 按钮传给调用方；`EnvironmentVersionRowDialog`、`EnvironmentUpgradeDialog` 与 `ConfirmDialog` 使用显式 `restoreFocusRef`。真实页面中切换版本关闭回到“切换版本”，组件详情关闭回到“查看组件”，仓库分析关闭回到“查看仓库分析”，详情/变更各回到原按钮，Overflow 技术证据关闭回到同一行 `aria-label="更多发布单操作"` 按钮。
- 浏览器：真实登录项目在 1440px 打开预发切换 Modal，候选只显示后端返回的 `0.0.1`；390px 组件 Modal 宽 358px，字段来自项目服务；项目信息实际点击“版本配置”后 URL 与两个 Select 均锁定 staging / versions；390px 技术证据 Modal 宽 358px，关闭后 `aria-expanded=false` 且焦点恢复。当前设置区写入因真实目标未就绪不可执行，未绕过禁用门禁、未提交任何版本操作。
- 测试 / 构建：定向测试 `pmc021-focus-ref-tests-20260828-065140.log`（并包含先前完整矩阵 `pmc021-focus-and-feedback-focused-tests-20260828-064647.log`）、Web type-check `pmc021-focus-ref-typecheck-20260828-065140.log`、i18n `pmc021-i18n-final-20260828-065451.log`、production build `pmc021-web-build-final-20260828-065451.log` 全部通过。
- 容器 / 影响面：镜像构建 `pmc021-compose-build-web-focus-ref-20260828-065158.log`、服务重建 `pmc021-compose-force-recreate-web-focus-ref-20260828-065359.log` 通过；CodeGraph sync / affected 为 `pmc021-codegraph-sync-final-20260828-065520.log`、`pmc021-codegraph-affected-final-20260828-065529.log`；`git diff --check` 为 `pmc021-git-diff-check-final-20260828-065529.log`，scoped diff 为 `pmc021-scoped-diff-final-20260828-065547.diff`。
- 截图：`pmc021-version-switch-modal-desktop.png`、`pmc021-component-details-modal-mobile-390.png`、`pmc021-version-evidence-modal-mobile-390.png`；仓库分析沿用同状态的 `pmc003-repository-analysis-modal-desktop.png` / `pmc003-repository-analysis-modal-mobile-390.png`，配置版本页沿用 `pmc004-settings-versions-desktop-final.png` / `pmc004-settings-versions-mobile-390-final.png`。
- 真实缺口：当前数据没有满足目标就绪条件的设置区切换候选，因此 ConfirmDialog 的真实提交链未执行；禁用理由、API/模型、引用传递和测试已验证。该外部状态不影响 PMC021 的本地 UI 闭环，也不会被记录为成功切换证据。

### PMC022 发布列表与创建验收条件（已完成）

1. 列表只读取真实 `GET /projects/:projectId/delivery/releases` rich list；主标题优先人类发布名称/规范版本，历史时间戳版本只作为次级“历史版本号”，发布单 cuid 仅显示明确短号。
2. “当前阶段”使用后端生命周期 `lifecycle.phase`，状态使用 `lifecycle.status`；不得用最后一次执行步骤、目标环境或整体成功状态替代当前生命周期阶段。
3. 搜索和状态筛选由服务端 query/status 处理并写入 URL，刷新可恢复；行内只显示有对应 BuildRun、DeploymentRun 或 Manifest 证据的动作，超过三个进入 Overflow。
4. 创建 Modal 校验名称与规范版本；服务端错误留在 Modal，提交中所有提交入口禁用，Hook 必须阻止并发重复 POST；取消/关闭清空草稿、清理 `create=true` 并恢复 Header 触发器焦点。
5. 完成定向 API/Web 测试、type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器重建、1440/390px 真实浏览器筛选/创建/焦点验收与截图后，PMC022 才标记 Done。

PMC022 完成证据（2026-08-28）：

- API / 模型：列表来自 `GET /projects/:projectId/delivery/releases?take=50&query=&status=`；API `release-order-list.presenter.ts` 返回独立 `lifecycle.phase/status`、`lastExecution`、BuildRun、Manifest 和最新 DeploymentRun。列表“当前阶段”改为 `item.lifecycle.phase`，重试构建不会把已经到达的发布阶段错误倒退为 `lastExecution.step`。
- 标题 / 动作：规范版本显示版本并以真实 releaseName 为次级名称；历史 `v202608200822` 主标题显示“历史发布”，原始时间戳只作为“历史版本号”次级事实；cuid 仅以“发布单 #短号”显示。BuildRun、DeploymentRun、Manifest 不存在时不显示对应动作，现有 `0.0.1` 行的三个真实动作分别打开精确证据 Drawer。
- 筛选：真实页面搜索 `zz-pmc022-no-match` 写入 `relQuery`、服务端返回 0 行，刷新后输入与 0 行状态保持；组合框选择“草稿”写入 `relStatus=draft`，只返回草稿行，直接刷新后隐藏 Select value 与可见组合框均恢复为 draft / 草稿。
- 创建闭环：名称必填、版本 `x.y.z` 原生 pattern、内联字段错误、服务端 `createError`、提交 loading 与取消清空均在 Modal 内。`useReleaseOrders` 增加同步 in-flight ref，两个并发 create 调用只发出一个 POST；提交按钮显式包含 `orders.creating` 禁用条件。
- 真实写入：在本地测试项目通过真实 `POST /projects/cmrwxl1ks000k6enjiclutd5a/delivery/releases` 创建 `PMC022 本地交互验收 / 0.0.2`，返回并刷新为草稿发布单 `cmtc4ur7r01n6k7kr30wes95n`；未触发构建或部署。创建成功后 Modal 关闭、`create=true` 清除、列表增至 3 行、焦点回到 Header“创建发布”。
- 390px 交互：创建 Modal 宽 358px；`2.4` 显示“版本号必须使用 x.y.z 格式”且提交禁用，修正为 `2.4.1` 后启用；取消后 URL 清理、输入清空、焦点回到 Header Link；直接 `create=true` 刷新仍打开空白 Modal，关闭后清参。
- 行证据：真实“查看构建”“查看部署”“技术证据”分别打开 BuildRun #10、DeploymentRun `cmsn5pyq…` 与 Manifest/构建证据 Drawer；关闭后焦点分别回到原按钮。
- 测试 / 构建：API 列表 presenter/repository/integration 测试 `pmc022-api-release-list-focused-tests-20260828-065907.log`；Web 定向测试 `pmc022-release-list-create-focused-tests-20260828-065853.log`、创建回归 `pmc022-create-modal-test-rerun-20260828-065944.log`、Web type-check `pmc022-web-typecheck-rerun-20260828-065944.log`、API type-check `pmc022-api-typecheck-20260828-070559.log`、i18n `pmc022-i18n-final-20260828-070559.log`、production build `pmc022-web-build-final-20260828-070559.log` 全部通过。
- 容器 / 影响面：镜像构建 `pmc022-compose-build-web-20260828-065956.log`、服务重建 `pmc022-compose-force-recreate-web-20260828-070158.log`；CodeGraph sync / affected 为 `pmc022-codegraph-sync-final-20260828-070628.log`、`pmc022-codegraph-affected-final-20260828-070636.log`；`git diff --check` 为 `pmc022-git-diff-check-final-20260828-070636.log`，scoped diff 为 `pmc022-scoped-diff-final-20260828-070653.diff`。
- 截图：`pmc022-release-list-desktop.png`、`pmc022-create-release-invalid-mobile-390.png`、`pmc022-release-created-desktop.png`。
- 真实缺口：PMC022 无剩余本地缺口；新建对象仅为明确标记的本地验收草稿，不构成构建、部署或生产成功证据。

### PMC030 / PMC031 项目配置框架与版本子区验收条件（已完成）

1. 配置入口必须把 `section=environments`、现有环境 `env` 与六子区 `envTab` 规范化写入 URL；缺失或非法值使用真实默认环境 / versions 并替换为可刷新、可分享的规范地址。
2. 桌面保持左侧六子区 vertical tablist、右侧当前内容与同一右列共享修订区；390px 使用环境 Select + 子区 Select，URL、选中态、tabpanel ARIA 与桌面一致，不产生页面级横向溢出。
3. 版本子区展示真实当前 EnvironmentVersion、候选 ArtifactManifest/BuildRun、发布/部署证据、来源、状态、切换禁用原因；详情、变更、证据与切换继续使用已验收的弹层与焦点闭环。
4. 只有 `environment.environmentVersions` 中存在非当前历史成功版本时才显示“回退版本”；Staging 使用真实 environment-version recovery action，Production 使用已有 recovery preview/confirm + ReleaseRun/approval，不展示无历史、无权限或无后端支持的恢复路径。
5. 定向 API/Web 测试、type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器重建、桌面/390px URL/键盘/弹层交互与截图齐全后，PMC030 / PMC031 才可标记 Done。

PMC030 / PMC031 完成证据（2026-08-28）：

- URL / 共同框架：`EnvironmentSettingsArea` 会把缺失或非法的 `section / env / envTab` 规范化为现有 Production 环境与 `versions`，环境切换保留当前子区；桌面保持六项 vertical tablist、右侧 tabpanel 与共享“环境摘要与配置修订”，390px 改为环境与配置类型两个 Select。真实浏览器从裸 `/settings` 和 `env=missing&envTab=missing` 均替换为 `?env=production&envTab=versions&section=environments`。
- 键盘 / 响应式：桌面焦点置于“版本”后按 `ArrowDown`，焦点、`aria-selected` 和 URL 同步切到“部署目标”；390px 选择“验证与监控”后 URL 写入 `envTab=verification`，刷新后 Select 仍为 verification。390px 的 `innerWidth / body.scrollWidth / documentElement.scrollWidth` 均为 390，无页面级横向溢出。
- 版本真相：版本区继续读取 `GET /projects/:projectId/delivery/environment-versions` 的 EnvironmentVersion、ArtifactManifest、BuildRun、DeploymentRun、ReleaseRun 和 targetReadiness；真实项目当前没有已生效 EnvironmentVersion，因此显示“当前环境版本：暂无”，候选 `0.0.1` 保持“待生产审批”及精确禁用原因，不用候选或生命周期状态伪造当前版本。
- 恢复闭环：新增 `EnvironmentVersionRecoveryControl`，仅在 `environment.environmentVersions` 存在非当前历史版本时显示。Staging 调用真实 `POST .../environment-versions/:environmentId/actions` 且 `kind=recovery/sourceVersionId`；Production 复用 `recovery/preview` + `recovery/confirm`，创建新的 recovery ReleaseRun / approval。直接恢复失败时对话框保持打开并显示错误；成功后刷新环境版本。真实项目无历史版本，所以浏览器中正确不显示恢复按钮。
- 定向验证：API recovery integration / reservation / execution 为 `pmc031-api-recovery-tests-20260828-072806.log`；Web focused tests 为 `pmc030-pmc031-focused-tests-final-20260828-071923.log`，设置矩阵回归为 `pmc030-pmc031-settings-suite-20260828-071746.log`；Web type-check、i18n、production build 分别为 `pmc030-pmc031-web-typecheck-final-20260828-071923.log`、`pmc030-pmc031-i18n-20260828-071755.log`、`pmc030-pmc031-production-build-final-20260828-071931.log`。
- 容器 / 影响面：Web 镜像与容器重建为 `pmc030-pmc031-compose-build-web-20260828-072009.log`、`pmc030-pmc031-compose-recreate-web-20260828-072209.log`；CodeGraph sync / affected 为 `pmc030-pmc031-codegraph-sync-final-20260828-072657.log`、`pmc030-pmc031-codegraph-affected-20260828-072704.log`；tracked scoped diff 与 `git diff --check` 为 `pmc030-pmc031-scoped-diff-20260828-072924.log`、`pmc030-pmc031-git-diff-check-20260828-072908.log`，两个新增 recovery control 文件及本 TODO 另经 `git diff --no-index --check` 验证为空输出。
- 截图：`pmc030-environment-verification-desktop.png`、`pmc030-environment-verification-mobile-390.png`、`pmc031-environment-versions-desktop.png`、`pmc031-environment-versions-mobile-390.png`。
- 真实缺口：当前本地项目没有历史 EnvironmentVersion，故没有对真实数据执行恢复写入；API 集成测试、前端 wiring 测试与页面条件缺席共同证明能力边界。缺少历史版本不能通过造数或虚构入口弥补，不影响 PMC030 / PMC031 的本地完成结论。

### PMC032 / PMC033 部署目标与资源绑定验收条件（已完成）

1. 部署目标表只读取 `GET /project-environments/:id/targets` 的环境级 binding/currentTarget，以及项目当前环境的 active ApplicationService/ports；组件与端口只表达“该环境可部署组件”，不得伪造 binding 与单组件之间后端不存在的独占关系。
2. 部署方式、目录/targetRef、Server、连接状态、绑定时检查依据、最近更新时间、共享范围和 versionHash 均来自真实字段；缺 provider/path、Server 离线或 currentTarget 不唯一时在所属行顶部/下方明确阻断与发布影响。
3. 页面只保留“绑定部署目标”一个子区主操作；行内最多两个直接动作，解绑收进 Overflow 并继续使用 ConfirmDialog，关闭后焦点回到稳定 Overflow 触发器。创建/调整继续使用 Modal，字段只写真实 bind API。
4. 资源子区主体只展示当前不可变 `EnvironmentConfigRevision.resourceReferences` 的组件、实例、类型、绑定方式、共享/隔离、生命周期、连接探测与逐行校验；不存在修订或绑定时显示对应真实空态。
5. “编辑资源绑定”作为唯一子区主操作进入 Modal，资源/组件/环境变量映射先形成共享草稿，再经 PMC037 统一 Diff/原因/审计提交；项目页不创建、释放或扩缩容实例，也不保留页面内 Select/Add。
6. 定向 API/Web 测试、type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器重建、桌面与 390px 表格/Modal/Overflow/焦点/空态及截图齐全后，PMC032 / PMC033 才可标记 Done。

PMC032 / PMC033 完成证据（2026-08-28）：

- 部署目标 API / 模型：`useEnvironmentDeploymentTargets` 读取 `GET /project-environments/:id/targets`；后端 `ProjectEnvironmentServerBindingService.listTargets` 返回 binding、Provider、sharedEnvironmentIds、Server 状态和与发布选择同源的唯一 currentTarget/versionHash。组件列单独从项目详情中筛选当前环境 active ApplicationService 并解析持久化 ports，明确标为“环境级目标”，不声称 Server binding 独占某组件。
- 真实阻断：Production 真实 binding `F383 Picshare Deploy` 缺 Provider 与路径且 Server 离线；表格如实显示“暂无活动组件或端口证据”“未配置部署方式”“未配置部署目录 / 目标”“离线”“切换后验证”，所属行紧邻提示发布校验将阻止使用。没有把历史 binding 或整体项目状态补成 ready。
- 动作层级：子区只保留“绑定部署目标”一个主操作；“检查服务器 / 完善部署配置”是两项直接上下文动作，解绑收进“更多目标操作” Overflow，并继续使用危险 ConfirmDialog。真实浏览器只打开未确认解绑，Escape 关闭后 `activeElement=更多目标操作`、`aria-expanded=false`，未执行解绑；调整 Modal 取消 / Escape 后焦点回到“完善部署配置”。
- 资源绑定：主体只展示当前不可变修订的 `resourceReferences` 六列事实与真实连接探针；`EnvironmentConfigRevision` response 对旧引用给出 `bindingStatus=needs_configuration`，有 `componentKey/envBindings` 才显示已配置。移除统计 Chip、正文内编辑按钮和重复冻结说明，“编辑资源绑定”作为唯一子区主操作进入 Modal，草稿仍由 PMC037 统一修订提交。
- 当前真实资源边界：Production 当前生效修订 R1 (`46e28a2d…`) 没有资源引用，页面显示“当前修订未绑定资源实例”。编辑 Modal 显示项目当前环境没有可绑定服务组件，故无法添加引用；项目页没有申请、创建、释放或扩缩容入口，也没有为了截图制造资源。
- 测试 / 构建：Web target scope、target table、resource table、action hierarchy 与 Overflow focus contract 为 `pmc032-pmc033-focused-tests-rerun-20260828-073523.log`；API binding / reference resolver / response normalization 为 `pmc032-pmc033-api-contract-tests-20260828-073534.log`；Web type-check、i18n、production build 为 `pmc032-pmc033-web-typecheck-rerun-20260828-073523.log`、`pmc032-pmc033-i18n-20260828-073534.log`、`pmc032-pmc033-production-build-20260828-073534.log`。
- 容器 / 影响面：镜像与 Web 容器重建为 `pmc032-pmc033-compose-build-web-20260828-073611.log`、`pmc032-pmc033-compose-recreate-web-20260828-073810.log`；CodeGraph sync / affected 为 `pmc032-pmc033-codegraph-sync-20260828-074225.log`、`pmc032-pmc033-codegraph-affected-20260828-074230.log`；tracked scoped diff / `git diff --check` 为 `pmc032-pmc033-scoped-diff-20260828-074442.log`、`pmc032-pmc033-git-diff-check-20260828-074428.log`，新增模型/测试与本 TODO 的 `git diff --no-index --check` 为空输出。
- 390px：页面 `body/root=390`；目标表在 332px 局部容器内滚动 760px，不造成页面级横向溢出；两个 Modal 宽 358px。目标调整可在表格横向区域用键盘 Enter 打开并返回焦点；资源 Modal 取消后焦点回到“编辑资源绑定”。
- 截图：`pmc032-targets-desktop.png`、`pmc032-targets-mobile-390.png`、`pmc032-target-edit-modal-desktop.png`、`pmc032-target-edit-modal-mobile-390.png`、`pmc033-resource-bindings-desktop.png`、`pmc033-resource-bindings-mobile-390.png`、`pmc033-resource-bindings-modal-desktop.png`、`pmc033-resource-bindings-modal-mobile-390.png`。
- 真实缺口：本地 Production 没有 active service/ports 和资源引用，无法通过现有真实数据展示非空组件/资源行；纯模型/组件与 API 契约测试覆盖非空路径，浏览器保持真实空态。本切片没有创建部署目标或资源绑定，不把“可配置”误写为“已配置”。

### PMC034 / PMC035 变量密钥与访问权限验收条件（已完成）

1. 变量主体只读当前共享草稿 / 当前不可变修订中的 plainVariables、secretReferences 与资源注入；六列表展示 Key、环境/组件作用域、来源、值或脱敏引用、要求和真实校验，不展示 Secret 明文。
2. “编辑变量与密钥”是变量子区唯一主操作并位于子区 Header；新增/编辑/删除、`.env` 导入、Secret 映射、需求建议与跨环境复用入口均在 Modal 内。取消必须还原 plain/secret 快照；暂存后仍经 PMC037 的 Diff/原因/审计提交。
3. 跨环境复用继续调用真实 `POST /project-environments/:id/config-revisions/copy`，每个目标环境使用 current revision CAS 并展示逐环境结果；没有目标/内容或 API 失败时明确禁用/错误，不把部分成功显示为整体成功。
4. 访问主体使用当前修订 `policyReferences` 与真实 policy catalog，表格展示策略名、Effect、Action、Category、适用环境对象和“当前生效/待修订”状态；无附加策略时明确说明默认团队角色与发布审批仍生效。
5. “配置访问策略”是访问子区唯一主操作并进入 Modal；Checkbox 不留在页面主体。Header 深链到访问策略模块，所属说明区提供操作审批深链，不能把策略引用冒充生产发布审批。
6. 定向 API/Web 测试、type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器重建、桌面与 390px 表格/Modal/取消恢复/深链/空态及截图齐全后，PMC034 / PMC035 才可标记 Done。

PMC034 / PMC035 完成证据（2026-08-28）：

- **变量 API / 模型**：读态继续只使用共享草稿与当前不可变 `EnvironmentConfigRevision.plainVariables / secretReferences / resourceReferences`；跨环境复用由 `useEnvironmentEnvCopy` 调用真实 `POST /project-environments/:id/config-revisions/copy`，逐目标传递 `expectedCurrentRevisionId` 做 CAS 并展示逐环境结果。Secret 仅按 id/name/type 引用展示，不读取或输出明文。
- **变量操作层级**：正文移除“新增变量 / .env 导入 / 复用配置”等写入口，“编辑变量与密钥”成为子区 Header 唯一操作；新增、编辑、删除、`.env` 导入、Secret 引用、仓库需求建议与跨环境复制均收敛到 Modal，暂存后仍进入 PMC037 的统一 Diff/原因/审计闭环。取消恢复 plain/secret 打开快照；导入与复制关闭编辑器后再打开独立 Modal，并显式把焦点返回仍存在的页头触发器。
- **访问 API / 模型**：主体以当前修订 `policyReferences` 与 `ProjectGovernanceBaseline.controlPolicies` catalog 的真实交集渲染；表格六列按策略名、Effect、Action、Category、环境对象和当前生效/待修订顺序对应，非空列映射由测试固定。策略引用继续作为配置修订事实，不冒充生产发布审批。
- **访问操作层级**：“配置访问策略”是 Header 唯一操作，Checkbox 只在 Modal 内；Header 深链 `/access-policies`，所属说明区单独深链 `/operation-approvals`。真实 Production 当前没有附加策略或可引用 catalog，页面与 Modal 均明确平台默认团队角色权限和发布流程审批仍生效，没有构造策略行。
- **测试 / 构建**：变量弹层、草稿恢复与单一动作层级为 `pmc034-variable-modal-tests-focus-final-20260828-20260828-075918.log`；访问非空列顺序为 `pmc035-access-column-test-final-20260828-20260828-080832.log`；API config redaction/copy/revision/policy 契约为 `pmc034-pmc035-api-contract-tests-20260828-074932.log`。最终 Web type-check 与 production build 为 `pmc034-pmc035-web-typecheck-column-final-20260828-20260828-080834.log`、`pmc034-pmc035-production-build-column-final-20260828-20260828-080837.log`，i18n 为 `pmc034-pmc035-i18n-20260828-074931.log`。
- **容器 / 影响面**：最终镜像构建与 Web 容器重建为 `pmc034-pmc035-compose-build-column-final-20260828-20260828-080909.log`、`pmc034-pmc035-compose-recreate-column-final-20260828-20260828-081108.log`；CodeGraph sync / affected 为 `pmc034-pmc035-codegraph-sync-column-final-20260828-20260828-081130.log`、`pmc034-pmc035-codegraph-affected-column-final-20260828-20260828-081132.log`；tracked scoped diff / whitespace check 为 `pmc034-pmc035-scoped-diff-final-20260828-20260828-081244.log`、`pmc034-pmc035-git-diff-check-final-20260828-20260828-081244.log`，新增源码与本 TODO 的 no-index whitespace check 为 `pmc034-pmc035-untracked-diff-check-final-20260828-20260828-081304.log`（空输出）。本切片源文件最长 194 行。
- **浏览器交互**：最终容器复核登录用户为 System Administrator。桌面变量页只有一个编辑入口；`.env` 导入实测只保留一个标题为“从 .env 批量导入”的 dialog，编辑器已卸载，Escape 后焦点回到“编辑变量与密钥”。访问页只有一个策略入口，两个治理深链准确；策略 Modal 关闭后焦点回到“配置访问策略”。390px 页面 `body/root/viewport=390`，两个 Modal 均为 `left=16,width=358,right=374`，无页面级横向溢出，未提交任何写操作。
- **截图**：`pmc034-variables-desktop.png`、`pmc034-variable-editor-modal-desktop.png`、`pmc034-env-import-modal-desktop.png`、`pmc034-variables-mobile-390.png`、`pmc034-variable-editor-modal-mobile-390.png`、`pmc034-env-import-modal-mobile-390.png`、`pmc035-access-desktop.png`、`pmc035-policy-modal-desktop.png`、`pmc035-access-mobile-390.png`、`pmc035-policy-modal-mobile-390.png`。
- **真实缺口**：当前 Production R1 没有普通变量、Secret 引用、资源注入或附加策略，因此浏览器只可证明真实空态与只读/弹层交互；非空变量/策略和跨环境 CAS 由模型/组件/API 契约测试覆盖。没有为截图制造配置，也没有把“可选择/可复制”记录为已提交事实。

### PMC040 / PMC042 域名表与部署列表验收条件（已完成）

1. 域名表逐列展示真实 Site 主域名/aliases、环境、组件/路径/端口或 runtime target、TLS、DNS/探测、Site 状态和动作；缺失字段显示“暂无证据/未配置/—”，不得把配置意图或整体部署成功推导为 DNS/TLS/探测通过。
2. Production 无 Site 时，所属警告除影响与添加入口外，必须从当前不可变路由修订或当前环境 active `ApplicationService`/ports 展示可验证的组件、路径、端口和已配置域名事实；两者均无数据时明确“没有组件或路由配置证据”，不得虚构缺失域名。环境选择继续写入 `environmentId`，Site 引用的真实环境不能因初始化统计缺失而消失。
3. 域名行只保留“查看详情”一个直接动作，编辑/删除进入 Overflow，危险删除继续使用 ConfirmDialog；配置计划、DNS、TLS、routeSwitch 和精确 `siteProbe` 继续只在 Drawer 展示，390px 页面和 Drawer 不产生页面级溢出。
4. 部署列表默认通过真实服务端 `skip/take` 分页，并由 API 对需要关注的 `queued/running/blocked/failed` 记录做跨页优先排序；显式状态筛选后按该状态最近时间排序。状态筛选必须使用后端真实 `queued/running/blocked/completed/failed/cancelled` 值，不能继续提交不存在的 `succeeded`。
5. 环境、状态、发布和起止时间筛选均传到 API；表格展示真实 ReleaseOrder/阶段关联、运行状态、失败原因或 ServerExecutionJob 轨迹、耗时、发起人和证据深链，不发明百分比、ETA 或恢复操作。活跃运行每 5 秒轮询，终态停止；分页文案只表达当前页，不声称“最近 N 次”。
6. 定向 API/Web 测试、type-check、i18n、production build、CodeGraph、scoped diff、`git diff --check`、容器重建、桌面与 390px 筛选/分页/Overflow/Drawer/空态及截图齐全后，PMC040 / PMC042 才可标记 Done。

PMC040 / PMC042 完成证据（2026-08-28）：

- **域名表真相**：`ProjectDomainsTable` 逐列读取 Site `primaryDomain/aliases/environment/runtimeConfig/tls/dns/status`，并以当前环境路由修订和 active ApplicationService/ports 补充真实组件、路径、端口目标；没有 DNS/TLS/probe 字段时显示“暂无证据/—”，不从 Site draft 或配置计划 completed 推导通过。行内只保留“查看详情”，编辑/删除进入 Overflow，删除继续走 ConfirmDialog。
- **Production 缺口事实**：新增 `buildProjectDomainGapFacts`。仅当 Production 当前没有真实 Site 时，优先展示当前不可变 `routeSnapshot.entries` 中持久化的域名、组件、路径和端口；没有路由条目时只展示 active service/ports，并把域名和路径明确标为未配置；两种证据都不存在时显示“当前没有活动组件或路由修订证据”，不会生成样例域名。真实当前 Production 已存在 Site，因此没有为了截图删除入口；另两张本地项目没有 `baselineRole=production`，缺口分支由模型测试覆盖。
- **环境连续性 / 证据 Drawer**：环境筛选继续把 `environmentId` 写入 URL，`selectProjectDomainEnvironments` 保留被真实 Site 引用的活动环境。Production `picshare.localtest.me` 当前无 aliases、组件/路径/端口、TLS、DNS 或 probe 证据且状态为 draft，表格和 Drawer 均如实显示“暂无证据”；真实配置计划还显示未关联 Server、缺 upstream/host/port 两项阻断。
- **部署服务端分页**：`ListDeploymentRunsQueryDto` 新增布尔 `attentionFirst` 并把 status 限定为持久化生命周期 `queued/running/blocked/completed/failed/cancelled`；`succeeded` 返回 400。`listDeploymentRuns` 在无显式状态筛选时先按同一查询条件统计并分页 `queued/running/blocked/failed`，再用剩余 take 补最近终态，确保注意项不会在后续页重新出现；显式状态筛选仍按 `startedAt desc`。
- **部署 UI / 运行态**：项目列表请求为 `attentionFirst=true&skip=0&take=21`，第二页为 `skip=20&take=21`；状态筛选实际请求 `status=completed`，并提供六个真实状态选项，不再发送 `succeeded`。当前真实 47 条运行中，前 33 条全为 failed/blocked 等注意项，首个其他终态之后没有再次出现注意项；第二页前 13 条仍为注意项，随后才出现 completed。失败行首屏展示真实原因，证据 Drawer 绑定同一 runId；未展示百分比、ETA 或后端未授权恢复动作。
- **API / Web 验证**：API list repository/query/service 定向测试为 `pmc040-pmc042-api-focused-tests-20260828-20260828-082031.log`，DTO/注意分页回归为 `pmc042-api-dto-tests-rerun-20260828-20260828-082210.log`；Web 域名、筛选、分页、行、路由、Drawer 回归为 `pmc040-pmc042-web-regression-tests-final-20260828-20260828-095446.log`。最终 API/Web type-check 为 `pmc040-pmc042-api-typecheck-final-20260828-20260828-095446.log`、`pmc040-pmc042-web-typecheck-final-20260828-20260828-095446.log`，i18n 为 `pmc040-pmc042-i18n-final-20260828-20260828-095446.log`，API/Web build 为 `pmc040-pmc042-api-build-20260828-20260828-082215.log`、`pmc040-pmc042-web-build-20260828-20260828-082231.log`。
- **容器 / 影响面**：API/Web 镜像构建与重建为 `pmc040-pmc042-compose-build-api-web-20260828-20260828-082307.log`、`pmc040-pmc042-compose-recreate-api-web-20260828-20260828-082611.log`；CodeGraph 初始影响图为 `pmc040-codegraph-explore-initial-20260828-20260828-081426.log`、`pmc042-codegraph-explore-initial-20260828-20260828-081428.log`，最终 sync/affected 为 `pmc040-pmc042-codegraph-sync-final-20260828-20260828-095504.log`、`pmc040-pmc042-codegraph-affected-final-20260828-20260828-095506.log`；tracked scoped diff / whitespace check 为 `pmc040-pmc042-scoped-diff-final2-20260828-20260828-095558.log`、`pmc040-pmc042-git-diff-check-final2-20260828-20260828-095558.log`，新增源码与本 TODO 的 no-index check 为 `pmc040-pmc042-untracked-diff-check-final-20260828-20260828-095617.log`（空输出）。新增/相关页面源文件不超过 200 行。
- **浏览器 / 响应式**：桌面域名 Overflow 实测只含编辑/删除，Escape 后焦点回到 `aria-expanded=false` 的“更多操作”；域名 Drawer 宽 680px。390px 域名表在 356px 局部容器内滚动 1120px，Drawer `left=0,width=390,right=390`。部署桌面/390px 页面 `body/root/viewport` 等宽，表格分别局部横向滚动；真实 completed 筛选、第二页点击、失败 Drawer 深链均通过，未执行写操作。
- **截图**：PMC040 为 `pmc040-domains-desktop-final.png`、`pmc040-domain-evidence-drawer-desktop-final.png`、`pmc040-domains-mobile-390-final.png`、`pmc040-domain-evidence-drawer-mobile-390-final.png`；PMC042 为 `pmc042-deployments-desktop-final.png`、`pmc042-deployments-completed-filter-desktop.png`、`pmc042-deployments-page2-attention-boundary-desktop.png`、`pmc042-deployment-failure-drawer-desktop.png`、`pmc042-deployments-mobile-390-final.png`、`pmc042-deployments-completed-filter-mobile-390.png`、`pmc042-deployment-failure-drawer-mobile-390.png`。
- **真实缺口**：当前真实 Production 有 Site 但没有可归属组件、DNS/TLS/probe 证据，因此不能在浏览器展示非空目标或探测成功；本地也没有另一张带 `baselineRole=production` 且缺 Site 的项目可运行空态分支。对应非空/缺口路径由真实字段模型与组件/API 测试覆盖，浏览器保持当前数据事实，不删除 Site、不造探测结果。

### PMC050 / PMC051 状态矩阵、响应式与可访问性验收条件（已完成）

1. 以真实业务适用性建立项目模块状态矩阵：加载/请求错误/权限不足属于所有远程读链；空/正常属于列表与配置；运行中/失败/阻断/成功属于 BuildRun、DeploymentRun、ReleaseRun 和证据；禁用属于门禁与无候选写操作。某状态对某模型不适用时标记 N/A，不用演示数据凑齐。
2. 项目信息、发布列表、发布详情、项目配置、域名与入口、部署记录在 1440/1024/768/390 四个视口不得产生页面级横向溢出；宽表仅在所属表面局部滚动。390px 的页面级关键按钮、修复动作、tab/select、行详情和弹层关闭/提交目标高度至少 44px。
3. 项目五入口、发布一级/二级步骤、设置六子区、表格行/Overflow、Modal/Drawer/ConfirmDialog 必须具备与状态一致的 ARIA role/selected/disabled/expanded；桌面键盘切换、Escape 关闭、焦点陷阱与精确返回触发器均可在真实页面执行。
4. 状态色必须同时有文案或图标，不单靠颜色；selected/done/available/disabled/blocked 使用现有语义 token 并保持可辨。警告继续位于所属区域顶部，表格、空态、错误、禁用和权限不足不使用虚构成功色。
5. 状态矩阵以现有定向模型/组件/API 测试与真实浏览器对象交叉证明；当前本地数据无法产生的状态明确写入缺口，不能因有静态测试就声称完成运行态。发现的本地代码缺陷必须修复并回归。
6. 汇总定向 tests/type-check/i18n/build、CodeGraph、scoped diff、`git diff --check`、最终容器、四视口浏览器指标、键盘/焦点交互和截图后，PMC050 / PMC051 才可标记 Done。

### PMC050 / PMC051 完成证据（2026-08-28）

- **真实问题与修复**：六路由四视口首轮矩阵确认没有页面级横向溢出，但 390px 全局面包屑链接只有 20px 高，且路径型发布详情仍把 `releaseOrderId` 显示为短 ID。`components/layout/breadcrumbs.tsx` 现从 `/releases/[releaseOrderId]` 读取真实发布单显示名，并把所有可导航面包屑统一为 `min-h-11`；对应回归在 `breadcrumbs.spec.tsx`。设置修订写操作迁入 Modal 后，旧 F452 测试仍假设原因输入在页面内，现已把陈旧断言移到 `environment-settings-revision-modal.spec.tsx`，不再用过时 DOM 结构证明可访问性。

| 状态            | 适用真实模型                                          | 本地真实对象 / 页面证据                                                                                                               | 验证边界                                                                                    |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 加载 / 请求错误 | 所有远程项目读链                                      | `LoadingState role=status`、`ErrorBanner role=alert`、项目路由错误分支由 F452、route/model 定向测试覆盖                               | 容器保持健康，未人为断开 API 制造截图；不把业务失败当请求错误                               |
| 权限不足        | 项目、部署、发布、配置写入的 team/policy 守卫         | Project/Deployment/Release controller 与 `ControlAccessPolicyService` 测试验证真实 team、scope、policy 调用                           | 当前浏览器用户为 System Administrator，本地没有可复用的非管理员登录态；无权限浏览器态未伪造 |
| 空 / 未配置     | 环境版本、变量/密钥/资源/策略、域名证据、生产发布证据 | Production 当前有 1 个配置修订，但无当前环境版本；真实 Site 无 aliases/TLS/DNS/probe/目标；生产 ReleaseRun 为 0                       | 以“暂无证据/未配置”展示，不补样例数据                                                       |
| 正常            | 项目信息、发布列表/详情、项目配置、域名、部署列表     | 六个路由均由当前 Picshare 项目真实 API 返回 200 并在浏览器渲染                                                                        | 管理员只读验收未执行额外写操作                                                              |
| 运行中          | BuildRun、DeploymentRun、ReleaseRun                   | 当前 47 条 DeploymentRun 中没有 queued/running；当前 10 条 BuildRun 也没有 running                                                    | 轮询与运行态渲染由既有 hook/model 测试覆盖，但没有运行中浏览器对象，明确不声明运行态截图    |
| 失败            | BuildRun、DeploymentRun、请求提交错误                 | 当前真实 DeploymentRun `failed=11`，BuildRun `failed=8`；列表首屏与失败证据 Drawer 展示原始原因                                       | 写入提交失败由 Modal/route 组件测试覆盖                                                     |
| 阻断 / 禁用     | DeploymentRun、发布门禁、无候选写操作                 | 当前真实 DeploymentRun `blocked=22`；发布 0.0.1 的生产/验证/完成一级步骤为原生 disabled + `aria-disabled=true`，Production 无生产证据 | 不用整体 lifecycle 成功推导后续步骤                                                         |
| 成功            | BuildRun、DeploymentRun、预发部署                     | 当前真实 DeploymentRun `completed=14`、BuildRun `succeeded=2`、预发部署 `completed=1`                                                 | 当前生产 ReleaseRun 为 0，因此没有生产成功/发布后验证/完成证据                              |

- **响应式矩阵**：`pmc051-four-viewport-browser-matrix-20260828-100201.log` 对项目信息、发布列表、发布详情、项目配置、域名与入口、部署记录执行 1440×900、1024×800、768×800、390×844 共 24 个真实路由/视口组合；`body/root/main` 均未产生页面级横向溢出，宽表只在所属容器滚动。修复后 390px 六路由全页扫描没有小于 44px 的 button/link/tab/combobox；路径型发布详情面包屑实测为“项目 / Picshare / 发布 / 0.0.1”，前三个链接高 44px，当前页文本不是交互目标。
- **键盘 / ARIA / Focus**：真实项目配置六个 tab 使用一个 `tablist`、roving `tabIndex`、`aria-selected` 与关联 panel；从“版本”按 ArrowDown 后焦点和 URL 均切到“部署目标”。真实发布详情一级/二级步骤有两个 tablist，当前“预发”和“预发部署”分别 `aria-selected=true/tabIndex=0`，生产/验证/完成同时为原生 disabled 与 `aria-disabled=true`，panel 由 `aria-labelledby` 关联；记录见 `pmc051-browser-keyboard-aria-20260828-101306.log`。Modal/Drawer 的焦点陷阱、Escape 关闭和精确返回触发器继续由本轮 F452/ActionMenu/Drawer 测试及 PMC034/PMC040 的真实浏览器交互共同证明。
- **状态色与文案**：真实截图中 selected/current、失败、阻断、禁用和成功均同时包含状态文案、图标或形态，未只用颜色表达；项目级组件差异警告位于项目内容区顶部，发布阻断位于当前步骤顶部，空态/错误态没有虚构成功色。
- **API / 测试**：真实 API 结构与状态汇总保存在 `pmc050-browser-api-state-matrix-final-20260828-101654.log`，读取 DeploymentRun、ReleaseOrder、发布证据、Site 与环境配置修订，未输出登录令牌。Web 状态/路由/Modal/Drawer/axe/响应式/键盘定向回归为 `pmc050-pmc051-web-state-a11y-tests-final-20260828-101728.log`；API team/scope/policy、部署分页、发布与监控回归为 `pmc050-api-state-permission-tests-20260828-101739.log`。Web type-check、i18n、production build 分别为 `pmc050-pmc051-web-typecheck-final-20260828-101758.log`、`pmc050-pmc051-i18n-check-final-20260828-101824.log`、`pmc050-pmc051-web-build-breadcrumb-fix-20260828-100527.log`。
- **容器 / 影响面**：Web 新镜像已重建并以 `pmc050-pmc051-compose-recreate-web-20260828-100805.log` 重新创建；CodeGraph 初始 Explore 为 `pmc050-codegraph-state-matrix-initial-20260828-20260828-095915.log`、`pmc051-codegraph-accessibility-initial-20260828-20260828-095917.log`，最终 sync/affected 为 `pmc050-pmc051-codegraph-sync-final-20260828-101833.log`、`pmc050-pmc051-codegraph-affected-final-20260828-101835.log`。新增生产源文件仍低于 200 行（`breadcrumbs.tsx` 177 行）。
- **截图**：四视口补充证据为 `pmc051-settings-tablet-1024-final.png`、`pmc051-release-detail-tablet-768-final.png`、`pmc051-project-info-mobile-390-final.png`；1440 与 390 的域名/部署/Drawer 状态继续使用本 TODO PMC040/PMC042 所列最终截图。三张新增截图均已人工检查，无裁切、页面级横向溢出或浮层越界。
- **如实缺口**：当前本地数据没有运行中 DeploymentRun/BuildRun、没有生产 ReleaseRun，也没有非管理员浏览器登录态；这些状态只保留模型/API/权限守卫测试证据，不声明真实浏览器截图。上述缺口不需要且不得通过演示数据补齐。

### PMC052 / PMC053 字段契约与视觉对照验收条件（已完成）

1. 对项目信息、发布列表/详情、配置六子区、域名与入口、部署记录逐组建立“UI 字段 → Web 类型/模型 → 真实 API/持久化模型 → 缺失语义”矩阵；原型中的样例版本、域名、负责人、耗时、状态、TLS/DNS/探测或生产证据不得进入产品默认值。
2. 复用并补齐 presenter/repository/model/component 契约测试，至少固定项目/环境版本、ReleaseOrder/BuildRun/DeploymentRun、EnvironmentConfigRevision/目标/资源/策略、Site/runtimeConfig/TLS/DNS 和部署证据五组投影；不能只用文档表格声称字段已绑定。
3. 使用 `apps/devpilot-web/.impeccable/audit-2026-08-27-project-module-todo/P01-P18` 原型与本目录最终浏览器截图，按相同页面和视口成对检查 Header、内容宽度/留白、字体层级、表格密度、一级箭头/二级连接线、警告、Modal/Drawer。真实对象状态不同的对照必须标明，不能把原型样例状态当成运行时目标。
4. 发现仍可在本地修复的视觉/字段偏差就改代码并补回归；因现有 Navbar、真实数据缺失、筛选/审计等已确认产品约束而必须偏离原型的部分，逐项记录原因和证据，不以“1:1”名义删除真实能力或造数。
5. 定向 Web/API 契约测试、type-check、i18n、production build、CodeGraph、scoped diff/`git diff --check`、最终容器与桌面/390px 浏览器截图全部完成后，PMC052 / PMC053 才可标记 Done。

### PMC052 / PMC053 完成证据（2026-08-28）

| 页面字段组                                | Web 类型 / 投影                                                                                      | 真实 API / 持久化依据                                                                                                                                                                              | 缺失值口径                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 项目 Header、基本信息、环境运行版本、组件 | `useProjectDetail`、delivery summary、`EnvironmentVersion` 与项目组件投影                            | `GET /projects/:id`、`GET /projects/:id/delivery/summary`、`GET /projects/:id/delivery/environment-versions`；Project / ProjectEnvironment / ApplicationService / ArtifactManifest / DeploymentRun | 无当前版本、端口或分析结果时显示 `—`/“暂无”，不使用原型 `1.3.2`、`3000` 或样例 commit            |
| 发布列表 / 独立详情 / 生命周期            | `ReleaseOrderListItem`、`ReleaseOrderDetail`、release lifecycle/evidence models                      | `GET /projects/:id/delivery/releases`、详情、`/evidence`；ReleaseOrder / BuildRun / ArtifactManifest / DeploymentRun / ReleaseRun                                                                  | 没有 BuildRun/DeploymentRun/Manifest 就不生成对应证据；生产、验证、完成只由各自独立记录解锁      |
| 配置六子区                                | `EnvironmentConfigRevision`、environment version/target/resource/variable/policy/verification models | 项目环境详情、`/config-revisions`、`/targets`、`/delivery/environment-versions` 及 policy/resource/secret catalog；EnvironmentConfigRevision 与审计事件                                            | 当前 R1 的空变量、空 Secret/资源/策略、无版本均按真实空态；Secret 只显示引用元数据，不读明文     |
| 域名与入口                                | Site/runtime target/domain entry/workflow/gap/evidence models                                        | `GET /sites?projectId=`、Site sync-runs、项目环境 routeSnapshot、ApplicationService ports、精确 siteProbe；Site `primaryDomain/aliases/runtimeConfig/tls/dns/status`                               | TLS/DNS/probe/目标缺失时为“未配置/暂无证据”，不从 Site draft 或 DeploymentRun completed 推导通过 |
| 部署列表与证据 Drawer                     | DeploymentRun list/detail/evidence projection                                                        | `GET /deployments/runs` 与 run detail；DeploymentRun、ServerExecutionJob、stage attempts、logs/result、validation、audit                                                                           | error/result/logs/验证/恢复审计各读自己的字段；没有授权能力时不显示重试/回滚/恢复                |
| 验证与监控                                | settings verification + site evidence model                                                          | 环境 revision observability/validation、Site DNS/TLS、精确 `DeploymentRun.result.siteProbe` 与时间                                                                                                 | 当前无归属证据即“暂无证据/当前不可用”，不生成通过状态、负责人、ETA 或百分比                      |

- **真实字段运行检查**：`pmc052-browser-api-field-contract-final-20260828-102602.log` 使用当前登录态只读检查 project、deliverySummary、environmentVersions、targets、releaseList、releaseDetail、releaseEvidence、configRevisions、sites、deployments 十组 API；全部 HTTP 200。抽样 Project、3 条 ReleaseOrder、Production R1、2 条 Site、47 条 DeploymentRun 的要求字段 `missing=[]`，过程中未输出 token/Cookie 值。
- **契约测试**：Web 18 个 environment version/component/release/settings/domain/deployment 投影与空态测试为 `pmc052-web-field-contract-tests-20260828-102454.log`；API delivery summary/environment version/release list/config revision/Site/deployment detail/monitoring 的 12 组 presenter/repository/service/controller 测试为 `pmc052-api-field-contract-tests-20260828-102507.log`。没有发现产品生产代码中的原型样例字段；搜索到的计算进度组件属于未被当前 ProjectRoute 调用的旧 `OverviewTab`，未作为当前页面证据。

| 成对视觉对象     | 原型                                                 | 当前最终截图                                                                          | 结论 / 有证据偏差                                                                                                                                            |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 项目信息 1440    | `P01-project-information.png`                        | `pmc002-project-information-desktop-final.png`                                        | Header、五入口、警告、白底内容面、基本信息/版本/组件层级一致；仓库、版本与组件值使用当前 Picshare 实体                                                       |
| 发布列表 1440    | `P02-releases-list.png`                              | `pmc053-current-releases-1440.png`                                                    | 标题、筛选卡、表格密度与状态层级一致；当前为 3 条真实发布单，并保留服务端 query/status 与有对象才出现的 Build/Deployment/Manifest 证据动作                   |
| 发布预发 / 构建  | `P04-release-preflight.png`、`P05-release-build.png` | `pmc011-preflight-desktop.png`、`pmc012-build-desktop.png`                            | 一级箭头、二级连接线、阻断区、步骤证据结构一致；当前 0.0.1 只有真实预发证据，ReleaseInput 作为发布单共享事实在详情页级只出现一次，不复制进子步骤             |
| 配置版本         | `P07-settings-version.png`                           | `pmc004-settings-versions-desktop-final.png`、`pmc051-settings-tablet-1024-final.png` | 左侧六子区、右侧事实区和白色表面一致；当前 Production 没有 EnvironmentVersion，故展示真实空态而非原型 1.3.x 样例                                             |
| 域名与入口       | `P13-domains-production.png`                         | `pmc040-domains-desktop-final.png`                                                    | 表头、单详情动作和证据层级一致；原型为“缺入口”，当前 Production 已有 `picshare.localtest.me`，所以不能做同状态像素比较，保留真实 draft/无 TLS-DNS-probe 事实 |
| 部署记录         | `P14-deployments-list.png`                           | `pmc042-deployments-desktop-final.png`                                                | 标题、白色表格面、状态与单详情动作一致；当前按要求增加真实环境/状态/发布/日期服务端筛选、分页和注意项优先，不能退回原型两条虚构成功记录                      |
| 部署证据 Drawer  | `P15-deployment-evidence.png`                        | `pmc043-deployment-evidence-overview-desktop.png`                                     | P15 文件本身没有出现 Drawer，无法作为弹层像素基准；当前按 PMC043 的五区真实证据、680px Drawer、遮罩与焦点合同验收，不把错误的参考文件伪报为同状态对照        |
| 移动项目信息 390 | `P16-project-mobile.png`                             | `pmc051-project-info-mobile-390-final.png`                                            | 标题、主操作、横向项目入口、区域警告、纵向事实卡一致；按用户要求保留现有可展开 Navbar，不迁移原型 hamburger/search/bell                                      |
| 移动发布详情 390 | `P18-release-detail-mobile.png`                      | `pmc053-current-release-detail-mobile-390.png`                                        | 面包屑、返回、发布标题/状态、单列卡片和 390px 边界一致；当前真实共享输入证据较多且位于详情页级，首屏不伪造 P18 的生产阻断对象                                |

- **视觉复核结论**：逐对人工查看 Header、内容宽度与留白、标题/正文比例、表格行高、箭头/连接线、所属区域警告、Modal/Drawer 遮罩及 390px 裁切；没有发现新的页面级溢出、竞争性页面主操作或可通过本地代码修复却未处理的视觉缺陷。原型中的全局搜索/铃铛、样例环境版本/域名/负责人/成功运行，以及 P15 缺失的 Drawer 都不是当前产品应复制的事实。
- **验证 / 构建 / 影响面**：Web/API type-check 为 `pmc052-pmc053-web-typecheck-20260828-102735.log`、`pmc052-pmc053-api-typecheck-20260828-102735.log`，i18n 为 `pmc052-pmc053-i18n-20260828-102735.log`，Web/API production build 为 `pmc052-pmc053-web-build-20260828-102754.log`、`pmc052-pmc053-api-build-20260828-102754.log`；四条入口的初始 CodeGraph Explore 为 `pmc052-codegraph-project-info-20260828-102111.log`、`pmc052-codegraph-release-detail-20260828-102111.log`、`pmc052-codegraph-domains-20260828-102111.log`、`pmc052-codegraph-deployments-20260828-102111.log`，最终 affected 为 `pmc052-pmc053-codegraph-affected-final-20260828-102822.log`。浏览器继续使用已重建且健康的最终 Web/API 容器。
- **新增截图**：`pmc053-current-releases-1440.png`、`pmc053-current-release-detail-mobile-390.png`；其余成对证据复用各已关闭 PMC 的最终截图，避免为同一真实状态重复造证据。

### PMC054 / PMC055 核心 E2E 与完成口径验收条件（已完成）

1. 使用当前 Picshare 真实对象串联发布列表/已创建草稿、独立发布详情、一级/二级步骤与门禁、环境版本入口、六个配置子区、域名三步流程、部署 runId 深链和五区证据 Drawer；已有真实写入证据不得为“再验一次”重复创建或修改对象。
2. E2E 必须记录 URL、对象 ID/状态、禁用理由、Modal/Drawer 开关与焦点返回；当前数据阻止提交的操作只验证到真实门禁，不绕过 disabled、不把打开弹层当作写入成功。
3. 逐条复核所有已定义 PMC 的代码位置、API/Model、测试、浏览器和截图；没有代码/API/模型、运行交互或截图证据的条目不得改为 Done。PMC015-PMC018 已在 2026-08-30 隔离 parity 全链中补齐证据，外部生产签收边界仍需单独列出。
4. 复核 R01-R25 的当前状态，清理旧文档中的过时 Partial/Open；PMC038/PMC039 若权威 TODO 没有定义、验收条件或清单项，必须明确记录为不存在的编号空洞，不能伪造任务或假装完成。
5. 最终 tests/type-check/i18n/build、CodeGraph、scoped diff/`git diff --check`、容器健康、桌面与 390px E2E 截图完成后，PMC054 才可 Done；PMC055 只有在所有本地可完成项已关闭并如实保留外部 blocker 时才可 Done。

### PMC054 / PMC055 完成证据（2026-08-28）

- **真实链路**：在 task space 74 的已登录 System Administrator/Test Org 会话中，复用已持久化的真实草稿 `0.0.2`，没有重复创建发布或执行任何其他写操作。断言脚本依次验证发布列表、`0.0.1` 详情、二级步骤键盘切换、生产/验证/完成门禁、六设置子区与 `envTab` URL、锁定 Production 的域名渐进式 Modal、部署 `runId` 五区 Drawer、关闭 URL 清理和焦点返回。日志：`/tmp/codex-tool-runs/svton/project-module-content-closure/svton/pmc054-core-browser-e2e-assertions-final3-20260828-103338.log`。
- **浏览器结果**：真实 Picshare 页面中后续三个一级阶段同时具备原生 `disabled` 与 ARIA 禁用；设置 `End` 键切到验证子区并写入 `envTab=verification`；域名 Modal 显示“组件与端口”且环境为只读 `Production (production)`；部署 Drawer 精确包含“概览 / 阶段 / 日志 / 验证 / 恢复与审计”，Escape 关闭后移除 `runId`。截图：`pmc054-domain-workflow-mobile-390.png`、`pmc054-deployment-drawer-desktop.png`。
- **定向测试**：Web 5 个核心文件通过，日志 `pmc054-final-web-tests-20260828-103927.log`；API 的配置修订、Site、DeploymentRun controller/service 4 个 Jest 文件通过，日志 `pmc054-final-api-jest-20260828-103957.log`。误用 Vitest 运行 API 的一次命令仅暴露“API 使用 Jest”的测试命令差异，不计作产品失败，也不作为通过证据。
- **静态与构建**：Web/API type-check、i18n、Web/API production build 全部 exit 0，日志分别为 `pmc054-final-web-typecheck-20260828-104015.log`、`pmc054-final-api-typecheck-20260828-104015.log`、`pmc054-final-i18n-20260828-104015.log`、`pmc054-final-web-build-20260828-104029.log`、`pmc054-final-api-build-20260828-104029.log`。
- **调用链与运行态**：CodeGraph sync/affected 均通过（`pmc054-final-codegraph-sync-20260828-104056.log`、`pmc054-final-codegraph-affected-20260828-104102.log`）；Compose 中 API 为 healthy、Web 为 Up（`pmc054-final-compose-health-20260828-104139.log`），`GET /login` 返回 200、未带凭据的 `GET /api/auth/profile` 返回预期 401，证明两个监听端真实可用。
- **范围与文档完整性**：PMC 范围 diff 保存为 `pmc055-final-scoped-diff-20260828-104414.diff`，其内置 `git diff --check` 与仓库级 `git diff --check`（`pmc055-final-git-diff-check-20260828-104423.log`）均 exit 0；权威 TODO 作为未跟踪文件使用 `git diff --no-index --check /dev/null ...` 检查，exit 1 仅表示存在新增 diff 且输出为空；九组 Markdown 表的未转义列数检查无异常。PMC 临界实现文件最终为 198/197/200/200 行，未超过 200 行；注释压缩后的 Web type-check 仍通过（`pmc055-post-linecap-web-typecheck-20260828-104724.log`），格式检查通过（`pmc055-final-prettier-check-pass-20260828-104704.log`）。
- **完成边界**：所有本地可完成 PMC 已关闭；PMC015-PMC018 后续只剩外部 Production Ready 签收，不是本地待实现项。当前权威 TODO 全文只有本段与顶部状态曾引用 PMC038/PMC039，且没有对应标题、验收条件或清单项，因此将其记录为编号空洞，不发明工作。

### PMC056 项目配置子区扁平化验收条件（已完成）

1. 以批准原型 `approved-project-config.png`、当前真实 Picshare 页面与现有六子区实现为依据：保留环境选择、左侧子区导航和各子区真实 API/状态模型，不删除功能或用样例数据填充视觉。
2. 六个配置子区统一为“标题/说明/局部动作 + 单一内容面”的扁平结构；共享壳层不得再无条件包裹圆角边框。表格、列表或独立对象最多保留一层边界，修订控制与主内容使用分隔线而不是第二张外层卡片。
3. 部署目标、资源绑定、变量与密钥、访问权限、验证与监控逐一复核真实状态、空态、警告、操作层级与 390px 行为；每个子区只保留一个局部主要动作，次要入口使用次级按钮或文本动作。
4. 左侧导航对齐批准原型的信息层级，并保持 `tablist`、roving focus、键盘方向键、移动端选择器和 URL `envTab` 状态不变；不得因视觉调整破坏可访问性或深链。
5. 完成定向组件测试、Web type-check、i18n、production build、CodeGraph affected、scoped diff/`git diff --check`、容器重建，以及桌面和 390px 真实浏览器交互与截图后，PMC056 才可标记 Done。

### PMC056 完成证据（2026-08-28）

- **真实问题与实现**：批准原型使用左侧图标导航、扁平内容分区和单一表格边界；当前代码虽然已完成六子区真实数据与写操作，但 `SubtabShell` 无条件使用 `rounded-lg border p-3`，访问权限再嵌三张边框块，底部修订控制又使用带阴影的边框卡片。现由 `settings-subtab-shell.tsx` 统一移除外层卡片，`environment-settings-tablist.tsx` 使用现有 Phosphor 图标对齐原型；部署目标保留一层表格边界，资源/权限/修订历史改为分隔式信息区，验证表继续保留唯一数据表面，修订控制移除圆角、背景与阴影。
- **API / 模型边界**：本切片只调整已有真实 `EnvironmentDeploymentTargetBinding`、`EnvironmentConfigRevision`、资源引用、Secret 引用、访问策略和 `observabilitySnapshot` 的呈现层；读取、暂存、Modal 写入、修订提交、空态和不可用证据语义均未改变，没有新增 API、字段、状态或演示数据。
- **测试 / 构建**：8 个设置定向 spec 通过，日志 `pmc056-settings-tests-final-20260828-145800.log`；Web type-check、i18n 与 production build 分别为 `pmc056-web-typecheck-20260828-144853.log`、`pmc056-i18n-20260828-144958.log`、`pmc056-web-build-20260828-144958.log`。Impeccable detector 最终为 0 项，所有本切片生产源文件不超过 200 行。
- **调用链 / 范围 / 运行态**：CodeGraph sync/affected 通过（`pmc056-codegraph-sync-20260828-145740.log`、`pmc056-codegraph-affected-final-20260828-145800.log`）；scoped diff 与仓库级 `git diff --check` 通过（`pmc056-scoped-diff-20260828-145800.diff`、`pmc056-git-diff-check-final-20260828-150005.log`）。Web 容器已从当前源码重建，API 为 healthy、Web 为 Up，`/login` 与 `/api/health` 均返回 200；容器日志为 `pmc056-compose-web-rebuild-escalated-20260828-145120.log`。
- **真实浏览器交互**：task space 74 的已登录 Picshare 页面逐一验证五个子区。桌面 `ArrowDown` 从部署目标切到资源绑定，焦点、`aria-selected` 和 `envTab=resources` 同步；390px 资源绑定 Modal 可打开、Escape 关闭并把焦点还给“编辑资源绑定”，移动下拉切到验证与监控后 URL 为 `envTab=verification`。日志 `pmc056-browser-interactions-final-20260828.log`；五个页面均无页面级横向溢出，局部按钮实测 44px。
- **截图**：桌面为 `pmc056-settings-{targets,resources,variables,access,verification}-desktop-final.png`；390px 内容截图为 `pmc056-settings-{targets,resources,variables,access,verification}-mobile-390-content-final.png`。与 `approved-project-config.png` 同轮视觉对照后，左侧信息层级、内容起点、边界数量和修订区均已进入同一原型体系；真实 Picshare 数据与原型样例状态不同的部分保持真实显示。

### 最终逐条 PMC 验收表

| PMC    | 状态             | 实现位置                                                                                              | API / 模型依据                                                                                                 | 测试证据                                                                                                                          | 浏览器截图                                                                                                                        | 真实缺口                                                                     |
| ------ | ---------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| PMC001 | Done             | `project-workbench-header.tsx`、`project-detail-header.tsx`                                           | `GET /projects/:id`、Project/Repository Analysis                                                               | 本文 PMC001 与 PMC050/051 定向证据                                                                                                | `pmc002-project-information-desktop-final.png`、`pmc051-project-info-mobile-390-final.png`                                        | 无                                                                           |
| PMC002 | Done             | `project-workbench-surface.tsx`、五入口 route/table surface                                           | 项目五入口真实 query state                                                                                     | 本文 PMC002、PMC050/051 状态矩阵                                                                                                  | `pmc002-project-information-desktop-final.png`、`pmc002-settings-desktop.png`                                                     | 无                                                                           |
| PMC003 | Done             | `modal.tsx`、各设置 Modal、域名/部署 Drawer                                                           | 写 API 与只读证据 API 分层                                                                                     | `modal-accessibility-contract.spec.ts`；PMC050 Web 状态测试                                                                       | `pmc003-resource-binding-modal-mobile-390.png`、`pmc003-deployment-evidence-drawer-desktop.png`                                   | 无                                                                           |
| PMC004 | Done             | 项目/发布/设置/域名/部署表与统一状态组件                                                              | 各列表 DTO、真实 loading/error/empty state                                                                     | 本文 PMC004；PMC050 Web/API 状态测试                                                                                              | `pmc004-releases-desktop-final.png`、`pmc004-settings-variables-mobile-390.png`                                                   | 无                                                                           |
| PMC005 | Done             | `project-context-issue.tsx`、`project-delivery-issue.tsx`                                             | scoped issue/action model                                                                                      | 本文 PMC005 定向测试                                                                                                              | `pmc005-warning-action-mobile-390.png`、`pmc005-domains-desktop-final.png`                                                        | 无                                                                           |
| PMC006 | Done             | `release-lifecycle-evidence.model.ts`、`release-lifecycle.model.ts`                                   | 预发验证、生产 DeploymentRun、发布后验证、完成审计独立证据                                                     | `release-lifecycle.model.spec.ts`；parity v29 全链与 Web 全量测试                                                                 | `release-validation-desktop.png`、`release-completion-desktop.png`                                                                | 本地无；外部 Production Ready 签收另行处理                                   |
| PMC007 | Done             | release rail/substeps CSS、响应式表格/Drawer、breadcrumbs                                             | UI/ARIA contract                                                                                               | `f452-accessibility.spec.tsx`、`f453-responsive.spec.tsx`；PMC051 四视口矩阵                                                      | `pmc051-project-info-mobile-390-final.png`                                                                                        | 无                                                                           |
| PMC010 | Done             | `release-workbench-header.tsx`、`release-lifecycle-rail.tsx`、`release-lifecycle-substeps.tsx`        | release detail + lifecycle evidence models                                                                     | release header/navigation/model specs；PMC054 断言                                                                                | `pmc051-release-detail-tablet-768-final.png`、`pmc006-lifecycle-disabled-desktop.png`                                             | 无                                                                           |
| PMC011 | Done             | `release-step-preflight-panel.tsx`、`release-preflight-evidence-drawer.tsx`                           | `/gates` evaluation/confirm 与 gate decision                                                                   | PMC011 model/component tests                                                                                                      | `pmc011-preflight-desktop.png`、`pmc011-preflight-evidence-drawer.png`                                                            | 无                                                                           |
| PMC012 | Done             | `release-step-build-panel.tsx`、build resources/history/log layers                                    | BuildRun、Manifest、artifact/log API                                                                           | PMC012 build model/panel/drawer tests                                                                                             | `pmc012-build-desktop.png`、`pmc012-build-log-drawer.png`                                                                         | 无                                                                           |
| PMC013 | Done             | `release-step-deploy-panel.tsx`、staging summary/stages/history/log                                   | `/staging-deployments`、DeploymentRun/Manifest evidence                                                        | PMC013 staging model/drawer tests                                                                                                 | `pmc013-staging-deploy-desktop.png`、`pmc013-staging-log-drawer-mobile-390.png`                                                   | 无                                                                           |
| PMC014 | Done             | `release-step-staging-validation-panel.tsx`、validation model/Drawer                                  | 独立 staging validation evidence + Site probe                                                                  | staging validation model/drawer tests                                                                                             | `pmc014-staging-validation-drawer-desktop.png`                                                                                    | 无                                                                           |
| PMC015 | Done（本地口径） | `release-step-production-check-panel.tsx`、production check model/guards                              | 精确 `production-preview`、production gate/TLS/target/revision                                                 | production-check specs；parity v29 D01-D20 真实 HTTP/持久化链                                                                     | `release-production-check-desktop.png`                                                                                            | 外部 Provider、公网 DNS/TLS 与生产流量签收未在本地模拟                       |
| PMC016 | Done（本地口径） | `release-step-deploy-panel.tsx`、production preview/current run/history                               | production preview/confirm、P03 review、ReleaseRun、OperationApproval、DeploymentRun                           | production run/panel/model specs；parity v29 全链                                                                                 | `release-production-deployment-desktop.png`                                                                                       | 页面如实隐藏后端未授权的恢复/重试/回滚；外部恢复演练未签收                   |
| PMC017 | Done（本地口径） | `release-step-post-validation-panel.tsx`、`release-production-validation.model.ts`                    | 精确 production DeploymentRun + health/entry/version/Manifest/route evidence                                   | post-validation model/panel specs；Web 全量测试；parity v29                                                                       | `release-validation-desktop.png`、`release-validation-mobile-390.png`                                                             | 外部 DNS/TLS/流量探测仍需真实生产签收                                        |
| PMC018 | Done（本地口径） | `release-step-completion-panel.tsx`、`release-completion-record.model.ts`                             | 精确 ReleaseRun + DeploymentRun + EnvironmentVersion + six validations                                         | completion panel/record specs；Web 全量测试；parity v29                                                                           | `release-completion-desktop.png`、`deployment-evidence-drawer-desktop.png`                                                        | 审计页只支持项目+类别范围，未伪装成精确 Run 审计；外部生产签收未执行         |
| PMC019 | Done             | `release-input-summary.tsx`、`release-input.model.ts`                                                 | ReleaseOrder 共享 release input                                                                                | release input model/component specs                                                                                               | `pmc019-release-input-desktop.png`、`pmc019-release-input-mobile-390.png`                                                         | 无                                                                           |
| PMC020 | Done             | `project-information-panel.tsx`、环境版本/组件表                                                      | Project、delivery environment versions、Repository Analysis                                                    | project detail/version/component specs；PMC052 契约测试                                                                           | `pmc002-project-information-desktop-final.png`                                                                                    | 无                                                                           |
| PMC021 | Done             | `environment-version-row-dialog.tsx`、`project-component-details-modal.tsx`                           | environment version evidence/switch 与 component model                                                         | environment version/component Modal specs                                                                                         | `pmc021-version-switch-modal-desktop.png`、`pmc021-component-details-modal-mobile-390.png`                                        | 无                                                                           |
| PMC022 | Done             | `release-orders-panel.tsx`、`release-order-create-modal.tsx`                                          | `GET/POST /projects/:id/delivery/releases`、ReleaseOrder                                                       | release list/create Modal specs；真实草稿持久化                                                                                   | `pmc022-release-list-desktop.png`、`pmc022-release-created-desktop.png`                                                           | 无                                                                           |
| PMC030 | Done             | `environment-settings-area.tsx`、`environment-settings-tablist.tsx`                                   | project environments + six scoped settings models                                                              | settings area/tablist specs；PMC054 URL/键盘断言                                                                                  | `pmc030-environment-verification-desktop.png`、`pmc030-environment-verification-mobile-390.png`                                   | 无                                                                           |
| PMC031 | Done             | `environment-version-list.tsx`、version detail/recovery control                                       | environment-versions/config revision evidence                                                                  | version list/recovery specs                                                                                                       | `pmc031-environment-versions-desktop.png`、`pmc031-environment-versions-mobile-390.png`                                           | 无                                                                           |
| PMC032 | Done             | `settings-env-targets-tab.tsx`、target create/edit Modal                                              | `/project-environments/:id/targets`、target DTO                                                                | target scope/edit/tab specs                                                                                                       | `pmc032-targets-desktop.png`、`pmc032-target-edit-modal-mobile-390.png`                                                           | 无                                                                           |
| PMC033 | Done             | `settings-env-resources-tab.tsx`、`settings-resource-binding-modal.tsx`                               | resource instance injections/bindings API                                                                      | resource table/modal/preview specs                                                                                                | `pmc033-resource-bindings-desktop.png`、`pmc033-resource-bindings-modal-mobile-390.png`                                           | 无                                                                           |
| PMC034 | Done             | `settings-env-variables-tab.tsx`、variable/import/review Modal                                        | env vars, secret references, immutable revision diff                                                           | variable/import/modal specs                                                                                                       | `pmc034-variables-desktop.png`、`pmc034-variable-editor-modal-mobile-390.png`                                                     | 无                                                                           |
| PMC035 | Done             | `settings-env-access-tab.tsx`、`settings-policy-selection-modal.tsx`                                  | environment access policy/effect/action/object                                                                 | access/policy component specs                                                                                                     | `pmc035-access-desktop.png`、`pmc035-policy-modal-mobile-390.png`                                                                 | 无                                                                           |
| PMC036 | Done             | `settings-env-verification-tab.tsx`、verification evidence/probe models、observability Modal          | config revision rules +真实 Site/TLS/DNS/probe evidence                                                        | verification evidence/model/tab specs；PMC052 API 契约                                                                            | `pmc036-verification-monitoring-desktop.png`、`pmc036-verification-monitoring-mobile-evidence-390.png`                            | 后端没有结果的对象明确显示“未配置/暂无证据/当前不可用”，不是遗漏             |
| PMC037 | Done             | `environment-settings-revision-modal.tsx`、revision diff/result                                       | config revision CAS write/response/audit persistence                                                           | revision model/Modal Web specs + API service specs                                                                                | `pmc037-config-revision-review-desktop.png`、`pmc037-config-revision-result-mobile-390.png`                                       | 无                                                                           |
| PMC038 | N/A              | 权威 TODO 无此任务                                                                                    | 无标题、模型或验收条件                                                                                         | `rg` 仅命中状态说明与终审说明                                                                                                     | 不适用                                                                                                                            | 编号空洞；不发明、不标 Done                                                  |
| PMC039 | N/A              | 权威 TODO 无此任务                                                                                    | 无标题、模型或验收条件                                                                                         | `rg` 仅命中状态说明与终审说明                                                                                                     | 不适用                                                                                                                            | 编号空洞；不发明、不标 Done                                                  |
| PMC040 | Done             | `project-domains-route.tsx`、domains table/details Drawer                                             | Site aliases/runtimeConfig/TLS/DNS/probe                                                                       | domain entry/gap/route specs + Site API tests                                                                                     | `pmc040-domains-desktop-final.png`、`pmc040-domain-evidence-drawer-mobile-390-final.png`                                          | 无；缺字段使用真实空态                                                       |
| PMC041 | Done             | `project-domain-workflow-modal.tsx`、workflow steps/model/submit                                      | Site create/update/delete 与 locked environment/runtimeConfig                                                  | workflow model/submit/route specs；PMC054 断言                                                                                    | `pmc041-domain-workflow-preview-desktop.png`、`pmc054-domain-workflow-mobile-390.png`                                             | 当前项目没有可配置服务端口时“下一步”真实禁用                                 |
| PMC042 | Done             | `project-deployments-route.tsx`、filters/table/row                                                    | `GET /deployments/runs` 服务端 filter/page、ReleaseOrder relation                                              | filter/route/row specs + API list query specs                                                                                     | `pmc042-deployments-desktop-final.png`、`pmc042-deployments-mobile-390-final.png`                                                 | 无                                                                           |
| PMC043 | Done             | `project-deployment-run-drawer.tsx` 及 overview/stages/logs/validation/recovery-audit                 | DeploymentRun detail/stages/log stream/validation/audit/capability                                             | Drawer/loader/model Web specs + API detail controller/service specs                                                               | `pmc043-deployment-evidence-overview-desktop.png`、`pmc043-deployment-evidence-recovery-audit-mobile-390.png`                     | 后端或权限不支持的恢复动作不展示                                             |
| PMC050 | Done             | 全模块 state models、request states 与 permission boundaries                                          | 真实发布/构建/部署/修订状态矩阵                                                                                | `pmc050-pmc051-web-state-a11y-tests-final-20260828-101728.log`、`pmc050-api-state-permission-tests-20260828-101739.log`           | PMC002-PMC043 各状态截图                                                                                                          | 当前数据没有 queued/running deployment；由模型/API 测试覆盖，不伪造浏览器态  |
| PMC051 | Done             | 响应式 layout/CSS、ARIA/focus、`breadcrumbs.tsx`                                                      | DOM/ARIA contract                                                                                              | 四视口矩阵 `pmc051-four-viewport-browser-matrix-20260828-100201.log`；键盘日志 `pmc051-browser-keyboard-aria-20260828-101306.log` | `pmc051-settings-tablet-1024-final.png`、`pmc051-release-detail-tablet-768-final.png`、`pmc051-project-info-mobile-390-final.png` | 无                                                                           |
| PMC052 | Done             | Web service types、各 model/DTO adapter、API response DTO                                             | Project、ReleaseOrder、ConfigRevision、Site、DeploymentRun 等十个真实端点                                      | Web 18 文件与 API 12 suites；`pmc052-browser-api-field-contract-final-20260828-102602.log`                                        | 由对应字段页面截图覆盖                                                                                                            | 无字段时必须显式空态；未扩造后台字段                                         |
| PMC053 | Done             | 当前页面与 P01-P18 原型逐视口对照                                                                     | 同项目/同可获得状态的真实 API 数据                                                                             | production build + 手工视觉对照记录                                                                                               | `pmc053-current-releases-1440.png`、`pmc053-current-release-detail-mobile-390.png`                                                | P15 原型自身未显示 Drawer；域名/生产状态无法无写操作构造同态，已如实记录     |
| PMC054 | Done             | release/settings/domain/deployment 核心 route 与交互模型                                              | 真实 Picshare、`envTab`、`runId`、disabled/ARIA/focus contracts                                                | `pmc054-core-browser-e2e-assertions-final3-20260828-103338.log`；final Web/API tests                                              | `pmc054-domain-workflow-mobile-390.png`、`pmc054-deployment-drawer-desktop.png`                                                   | 无本地缺口；未重复执行写操作                                                 |
| PMC055 | Done（本地口径） | 本权威 TODO 的 R01-R25、状态表与逐条 PMC 表                                                           | 代码/API/测试/浏览器/截图五类证据交叉复核                                                                      | final type/i18n/build/CodeGraph/diff/health 证据                                                                                  | PMC001-PMC054 所列截图                                                                                                            | PMC015-PMC018 的外部运行事实继续保留，未因本地收口而改成 Done                |
| PMC056 | Done             | `settings-subtab-shell.tsx`、`environment-settings-tablist.tsx`、五子区与修订控制                     | 既有目标/修订/资源/变量/策略/观测模型，未改变 API                                                              | `pmc056-settings-tests-final-20260828-145800.log`；type/i18n/build/CodeGraph/diff/browser 证据                                    | 五张 desktop final + 五张 mobile-390-content final                                                                                | 无；原型样例值未进入真实页面                                                 |
| PMC057 | Done             | `project-deployments-route.tsx`、`project-workbench-surface.tsx`、`project-deployment-runs-table.tsx` | 既有 DeploymentRun 与 ReleaseOrder 关联，未改变 API/状态                                                       | focused tests + type/i18n/build/format/CodeGraph/Docker/browser metrics                                                           | `pmc057-deployments-table-desktop-final.png`、`pmc057-deployments-table-mobile-390-final.png`                                     | 无；宽表只在所属表格视口滚动                                                 |
| PMC058 | Done             | `release-lifecycle-step-action-bar.tsx`、`release-lifecycle-step-panel.tsx`、动作条组件测试           | 既有 BuildRun/DeploymentRun、发布门禁原因与回调，未改变 API/权限/状态                                          | focused tests + type/i18n/build/format/CodeGraph/Docker/browser metrics                                                           | `pmc058-release-build-actions-desktop-final.png`、`pmc058-release-build-actions-mobile-390-final.png`                             | 无；历史 Drawer 深链、关闭返回与焦点恢复继续沿用真实状态                     |
| PMC059 | Done             | `project-deployments-route.tsx`、`project-workbench-surface.tsx`、`project-deployment-runs-table.tsx` | 既有 DeploymentRun list/filter/page/polling 与 Drawer 状态，未改变 API                                         | focused tests + type/i18n/build/format/CodeGraph/Docker/browser height/scroll metrics                                             | `pmc059-deployments-table-fill-desktop-final.png`、`pmc059-deployments-table-mobile-390-final.png`                                | 无；其 390px 自然流结论已由 PMC060 的全断点剩余高度布局取代                  |
| PMC060 | Done             | 共享 Header/navigation、overview composition、settings domains tab、deployment route/surface          | Project、ReleaseOrder、EnvironmentVersion、ApplicationService、Site、ConfigRevision、DeploymentRun；未改变 API | final Web/API type-check、i18n、全量 tests、build、Impeccable、CodeGraph、Docker、浏览器尺寸/交互                                 | `pmc060-overview-desktop.png`、`pmc060-configuration-domains-desktop.png`、`pmc060-deployments-mobile-390.png`                    | 无本地缺口；PMC015-PMC018 仍由外部生产运行事实阻断                           |
| PMC061 | Done             | `project-overview-summary.tsx`、配置环境 scope selector 与配置 rail                                   | Project、ReleasePolicy、既有环境集合与配置 URL 状态                                                            | focused/full tests、type/i18n/build、Impeccable、CodeGraph、Docker、浏览器作用域布局                                              | `pmc061-overview-desktop.png`、`pmc061-settings-scope-mobile-390.png`                                                             | 无；其默认折叠详情与双路由 Tab 结论已由 PMC062 的最新明确要求取代            |
| PMC062 | Done             | Header/context issue、borderless overview facts、overview content tabs                                | Project 环境/组件真实计数、ReleaseOrder、EnvironmentVersion、ApplicationService；未改变 API                    | final focused/full tests、Web/API type-check、i18n、build、Impeccable、CodeGraph、Docker、浏览器键盘/尺寸                         | `pmc062-overview-releases-desktop.png`、`pmc062-overview-details-mobile-390.png`                                                  | 无本地缺口；PMC015-PMC018 仍仅缺合法生产运行事实                             |
| PMC063 | Done             | Header spacing、overview analysis action、release collection toolbar                                  | Project、RepositoryAnalysisRun、ReleaseOrder；不改变 API/状态                                                  | focused/full tests、Web/API type-check、i18n、build、Impeccable、CodeGraph、Docker、desktop/390 browser                           | `pmc063-overview-toolbar-desktop.png`、`pmc063-basic-analysis-mobile-390.png`、`pmc063-overview-toolbar-mobile-390.png`           | 无本地缺口；PMC015-PMC018 仍仅缺合法生产运行事实                             |
| PMC064 | Done             | `project-overview-summary.tsx` semantic fact grid                                                     | Project、ReleasePolicy、Environment、ApplicationService；不改变 API/状态                                       | focused/full tests、type/i18n/build、Impeccable、CodeGraph、Docker、desktop/390 browser                                           | `pmc064-basic-information-desktop.png`、`pmc064-basic-information-mobile-390.png`                                                 | 无本地缺口；PMC015-PMC018 仍仅缺合法生产运行事实                             |
| PMC065 | Done             | overview repository disclosure、repository settings、flat run/review sections                         | RepositoryAnalysisState/Run/Stage/Suggestion 与既有 connect/revise/run/apply API                               | full tests、Web/API type-check、i18n、build、Impeccable、CodeGraph、Docker、desktop/390 browser                                   | overview collapsed/expanded、repository settings/confirm、mobile-390 七张截图                                                     | 无本地缺口；PMC015-PMC018 外部 blocker 不在本切片范围                        |
| PMC066 | Done             | overview repository disclosure、independent repository analysis workbench                             | RepositoryAnalysisState/Run/Stage/Suggestion 与既有 URL/allowedActions/API                                     | focused/full tests、Web/API type-check、i18n、build、Impeccable、CodeGraph、Docker、desktop/390 browser                           | `pmc066-repository-overview-*`、`pmc066-repository-analysis-*` 八张当前运行态截图                                                 | 无本地代码缺口；pending suggestion 状态因当前真实数据不存在而未伪造          |
| PMC067 | Done             | 全部项目工作台实际路由、子区、弹层与代表性状态                                                        | 当前容器真实页面、API 返回与可达交互                                                                           | route/state inventory、browser dimensions/interaction、51 张逐页视觉检查、审计报告                                                | `evaluation/screenshots/2026-08-29/project-module-visual-audit/00-50`                                                             | 审计记录的 P1/P2 是后续候选切片；不可达运行/权限/生产状态已单独标注          |
| PMC068 | Done             | `高级信息` disclosure、仓库概览、最近分析概览                                                         | RepositoryConnection/canonicalIdentity/RepositoryAnalysisRun/Stage/Suggestion                                  | focused/full tests、Web/API type-check、i18n、build、Impeccable、CodeGraph、Docker、desktop/390 browser                           | `pmc068-advanced-information-*` 四张当前运行态截图                                                                                | 无本地缺口；当前真实待审核 suggestion 为 0，未伪造状态                       |
| PMC069 | Done             | `仓库详情` disclosure、三组 overview Tab、最近组件识别摘要、组件差异深链                              | RepositoryConnection/EnvironmentVersion/ApplicationService/RepositoryAnalysisRun/Suggestion                    | focused/full tests、Web/API type-check、i18n、build、Prettier、Impeccable、CodeGraph、Docker、desktop/390 browser                 | `pmc069-overview-*`、`pmc069-repository-details-*`、`pmc069-environments-*`、`pmc069-components-*` 七张当前运行态截图             | 无本地缺口；当前真实组件识别为 4 条、待审核为 0，未从总 suggestion 数推导    |
| PMC070 | Done             | `ProjectRepositoryDetails` 本地默认折叠、`ProjectTableSurface` embedded 变体及三个概览 Tab            | 不改变 API/模型；只移除普通 disclosure URL 状态并保留独立仓库分析深链                                          | focused tests、Web type-check、i18n、build、Prettier、Impeccable、CodeGraph、Docker、desktop/390 browser                          | `pmc070-overview-collapsed-*`、`pmc070-environments-flat-*`、`pmc070-components-flat-*` 六张当前运行态截图                        | 无本地缺口；旧 `repository=true` 不再强制展开，独立 `analysisRunId` 迁移不变 |
| PMC071 | Done             | `ProjectComponentAnalysisOverview` 紧凑标题操作组与相邻完整分析深链                                   | RepositoryAnalysisRun/Suggestion；只统计真实 `application_service` 建议，不改变 API/状态                       | focused tests、Web type-check、i18n、build、Prettier、Impeccable、CodeGraph、Docker、desktop/390 browser                          | `pmc071-component-analysis-compact-desktop.png`、`pmc071-component-analysis-compact-mobile-390.png`                               | 无本地缺口；入口已验证进入独立仓库分析页，未伪造待审核结果                   |

## 1. 本轮验收口径

本轮不以“页面已经存在”作为完成条件。一个模块只有同时满足以下条件才可标记 Done：

1. 使用真实 API、真实字段和真实状态，不把原型样例数据复制进产品。
2. 信息架构、视觉层级、组件形态、操作入口与已确认原型一致。
3. 所有业务写操作使用 Modal、Drawer 或 ConfirmDialog；仅“当前环境”等即时视图切换保留下拉框。
4. 桌面端和移动端均有同状态截图对照；不是只通过静态测试。
5. 核心交互有浏览器运行证据，加载、空、失败、阻断、运行中、完成等状态均覆盖。
6. 警告与修复动作紧邻所属对象，文案明确“对象、问题、影响、具体动作”。

状态定义：

- **Done**：当前代码、真实页面和交互均符合已确认要求。
- **Partial**：实现已经落地，但仍缺合法运行事实、浏览器状态或其他完成证据；不得用 fixture 或推导状态代替。
- **Open**：尚未按原型和真实数据重新设计。
- **Keep**：经过产品判断，当前放置方式正确，不应迁入其他子区。

## 2. 总体结论

| 区域                | 当前状态         | 结论                                                                                                                                 |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 全局 Navbar         | Done / Keep      | 保留现有 Devpilot 项目 Navbar，不把原型侧栏整体搬回项目。                                                                            |
| 项目 Header         | Done             | 保留现有 Navbar；项目名、真实仓库/分支/Commit、项目级警告、一个页面级主操作和“概览 / 配置”双入口均已完成。                           |
| 白底与页面色调      | Done             | 概览、配置和独立运行证据页统一为连续白底、轻边框/小阴影、统一内容宽度与标题节奏，不再依赖大面积异色 Card 分割。                      |
| 项目概览            | Done             | 精简基本事实、真实发布列表、环境版本和仓库组件已合并；仓库/分支/Commit 不重复，桌面和 390px 均有真实证据。                           |
| 发布列表与创建      | Done             | 真实发布名称/状态/时间、服务端数据、筛选、创建 Modal、校验、失败反馈和独立详情路由均已闭环。                                         |
| 发布详情路由        | Done             | 已是 `/projects/:id/releases/:releaseOrderId` 独立二级页面，不再嵌在项目 Tab 内容里。                                                |
| 一级箭头步骤条      | Done（本地模型） | “预发 / 生产 / 验证 / 完成”的独立证据门禁、四种色阶、键盘操作和移动端均已验证；生产成功态已由 parity v29 真实运行证据验收。          |
| 二级步骤条          | Done             | 八个步骤均有独立内容与 URL 状态；键盘可切换可用步骤，后续步骤保持原生与 ARIA 禁用，不复用整体成功状态。                              |
| 项目配置            | Done             | 真实环境下拉、七个子区、共享修订条、写操作 Modal、审计结果、错误/空态及 URL/键盘状态均已完成。                                       |
| 域名与入口          | Done             | 已进入配置第七子区；真实 Site/alias/runtimeConfig/TLS/DNS/探测、渐进式 Modal、证据 Drawer、删除确认及环境继承均已完成。              |
| 部署记录            | Done             | 保留独立深链与概览上下文入口；服务端筛选/分页、轮询、`runId` 五区 Drawer 完成，桌面与 390px 宽表均填满剩余高度并在自身视口横纵滚动。 |
| Modal / Drawer 统一 | Done             | 所有 PMC 范围内写操作进入 Modal/ConfirmDialog，详情证据进入 Drawer；关闭返回、刷新、URL 与焦点恢复已有测试和浏览器证据。             |
| 响应式与可访问性    | Done             | 1440/1024/768/390 无页面级横向溢出；关键控件 44px、键盘、Focus、ARIA、表格局部滚动和弹层返回焦点均已验证。                           |

## 3. 用户已确认细节逐条复核

| ID  | 用户要求                                 | 状态         | 终审结论                                                                                                               |
| --- | ---------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| R01 | 使用已设计的 Devpilot Icon               | Keep         | 保留现有 Navbar 品牌表达，不在项目标题旁重复放 Icon。                                                                  |
| R02 | Navbar、Header、内容区域底色一致         | Done         | 项目概览、配置和独立运行证据页为连续白底、轻边框/小阴影和统一宽度。                                                    |
| R03 | 所有操作使用弹窗/抽屉                    | Done         | PMC 范围写操作使用 Modal/ConfirmDialog，证据详情使用 Drawer；仅环境/查看范围可直接 Select。                            |
| R04 | 发布详情是独立二级页面                   | Done         | `/projects/:id/releases/:releaseOrderId` 独立路由、面包屑与关闭返回均已验证。                                          |
| R05 | 项目页面标题旁不要 Icon                  | Done         | 项目标题只显示文本，仓库/分支/Commit 的语义图标保留。                                                                  |
| R06 | 预检/构建归预发，生产检查/部署归生产     | Done         | 四个一级阶段与八个独立二级步骤已按事实域分组。                                                                         |
| R07 | 一级步骤使用连接箭头与蓝色状态           | Done         | 连接箭头、选中/完成/可用/禁用语义已完成桌面、平板和 390px 证明。                                                       |
| R08 | 子步骤使用当前步骤条形式                 | Done         | 当前子步骤条可点击、可键盘切换，并保持 URL 状态。                                                                      |
| R09 | 选中深蓝、已完成浅蓝、可选浅灰、禁用更浅 | Done         | 四种状态色与 blocked/selected 边界已有模型、浏览器和截图证据。                                                         |
| R10 | 子步骤可点击并切换详细信息               | Done         | 八个子步骤各自渲染独立内容，不再复用旧面板。                                                                           |
| R11 | 构建步骤展示构建资源和构建信息           | Done         | BuildRun、Commit、时间、Manifest、资源、历史、失败和日志均绑定同一真实运行。                                           |
| R12 | 警告位于所属内容最上方                   | Done         | 项目/环境/阶段/字段警告均位于所属区域顶部，并提供精确影响与动作。                                                      |
| R13 | “验证 / 完成”拆成两个一级步骤            | Done         | 发布后验证与完成是独立一级阶段。                                                                                       |
| R14 | 生产在预发完成前不可点                   | Done         | 不再存在 `stagingValidated \|\| releaseSucceeded` 或整体成功兜底；当前真实 Picshare 页面生产阶段保持 disabled。        |
| R15 | 验证在生产部署前不可点                   | Done（门禁） | 仅精确生产 DeploymentRun 可解锁；当前本地没有生产运行，故真实页面保持 disabled，成功态运行证据归 PMC017 外部 blocker。 |
| R16 | 完成在验证完成后才可点                   | Done（门禁） | 仅生产运行、发布后验证与完成审计的独立证据可解锁；当前页面保持 disabled，成功态运行证据归 PMC018 外部 blocker。        |
| R17 | 项目配置 / 域名入口 / 部署记录放哪里     | Done         | 一级入口收敛为“概览 / 配置”；域名进入配置第七子区，DeploymentRun 保持独立可深链证据页并从概览发布上下文进入。          |
| R18 | 当前环境直接下拉选择                     | Done         | 使用项目真实环境 Select；环境继承在域名工作流中明确锁定。                                                              |
| R19 | 表格及其他组件一致                       | Done         | `ProjectTableSurface`、统一空/错/加载/状态、Modal/Drawer 与 Overflow 已覆盖概览、运行证据和七个设置子区。              |
| R20 | 项目信息展示真实项目信息                 | Done         | 概览基本事实、发布列表、环境版本、组件及真实空态均来自 Project/Delivery/Repository Analysis。                          |
| R21 | 各环境版本修改应在详情页                 | Done         | 项目信息保留版本证据入口；项目配置提供修订、切换与恢复的统一弹层闭环。                                                 |
| R22 | 原型字段和真实字段对齐                   | Done         | 字段契约逐项绑定 API/Model；无 DNS/探测/验证证据时明确显示“未配置/暂无证据/当前不可用”。                               |
| R23 | Navbar 保持现有项目                      | Keep         | 未重做全局 Navbar。                                                                                                    |
| R24 | Header 改为原型形式                      | Done         | 项目标题、真实元信息、单次项目警告、一个主操作、双入口、面包屑与移动层级均按当前原型方向完成。                         |
| R25 | 内容白底，小阴影，不用不同底色分区       | Done         | 项目主体连续白底，仅以轻边框/小阴影组织内容；未使用大面积异色 Card 分割。                                              |

## 4. 产品放置决策

### 4.1 “步骤检查与治理证据”放哪里

应放在**当前选中的二级步骤详情内部**。这是步骤特有内容，必须随“预检 / 构建 / 预发部署 / 预发验证 / 生产检查 / 生产部署 / 发布后验证 / 完成确认”切换，不能放成脱离步骤的公共卡片。

### 4.2 “发布输入”放哪里

保持为**发布详情页级共享事实**，不要复制到每个二级步骤。候选版本、来源、目标环境、Manifest、发布策略是整张发布单的不可变输入；重复放到各步骤会造成噪音和口径漂移。可以压缩为底部共享区或桌面端侧栏，但必须只出现一次。

### 4.3 项目概览与项目配置的边界

- 项目概览：共享 Header 承担项目身份、仓库、默认分支和 Commit；内容区合并精简发布策略/环境/组件计数、真实发布单、各环境当前运行版本和已确认组件。
- 项目配置：某个已有环境的版本候选、部署目标、资源绑定、变量与密钥、访问权限、验证与监控、域名与入口及不可变配置修订。
- 概览可以发起“切换版本”和进入部署记录，但详细版本选择、技术证据、修订历史和域名写入仍属于配置或独立证据页。

### 4.4 域名与部署记录的边界

域名入口是环境配置的一部分，作为配置侧栏第七子区并锁定/继承当前项目环境。DeploymentRun 是运行证据，不收进配置；保留 `/projects/:id/deployments` 与 `runId` 独立深链，从概览的发布上下文进入，不再占用项目一级导航。

## 5. 模块内容级差异

### 5.1 项目 Header

**已经完成**

- 使用真实项目名、仓库、默认分支和 Commit。
- 仅保留一个页面级主操作“创建发布”。
- 一级入口已收敛为“概览 / 配置”；部署记录保留独立深链。
- 项目标题旁没有 Icon。
- 项目级警告只在元信息下、一级导航上方展示一次。
- 面包屑下外边距和 Header 固定大高度已移除。

**需要修改**：无本地项；上述桌面与 390px 证据已由 PMC060 补齐。

### 5.2 项目信息

**已经完成**

- 基本信息、环境版本、项目组件来自真实 Project、Delivery Summary 和 Repository Analysis。
- 项目阻断与基本信息分离。
- 环境版本切换使用弹窗入口。
- 组件详情使用 Modal，而不是页面内展开新“子页面”。

**需要修改**

- 复原原型三段结构：基本信息事实带、环境运行版本表、项目组件表。
- 基本信息至少稳定展示：仓库、默认分支、发布策略、最近分析分支/Commit/时间；缺失值显示真实空态。
- 环境版本表稳定展示：环境、当前版本、来源、最近部署、状态、操作；生产暂无版本时明确“尚未运行”，不显示假版本。
- 组件表稳定展示：组件、路径、运行时、端口、分析来源/变化、状态、操作；字段只使用真实分析或配置结果。
- 修正移动端基本信息 Card 过窄、环境/组件表缺列且缺少水平滚动提示的问题。

### 5.3 发布列表与创建

**已经完成**

- 列表读取真实 `/delivery/releases` 数据。
- 发布名称/版本/ID 可进入独立详情。
- 创建发布使用 Modal。
- 已有搜索和状态筛选。

**需要修改**

- 复原原型的列表宽度、表头、行高、状态图标、来源、当前阶段、更新时间和唯一详情操作。
- 草稿发布应显示清晰的人类名称和版本；禁止用 `v202608200822`、截断数据库 ID 作为主标题。
- 当前阶段必须由真实发布阶段/运行证据推导，不用目标环境标签替代阶段。
- 仅在有实际可执行动作时显示行操作；更多动作超过三个进入 Overflow。
- 创建弹窗补齐字段错误、关闭恢复焦点、重复提交和服务端阻断状态验收。

### 5.4 独立发布详情 Header 与一级步骤

**已经完成**

- 独立二级路由和返回发布列表入口。
- 一级步骤已拆分为预发、生产、验证、完成。
- 已有选中、已完成、可用、阻断和禁用外观。

**需要修改**

- Header 使用发布名 + 版本为主标题，发布 ID、来源分支、Commit、最近执行为次要事实；数据库 ID 不作为标题。
- 修正一级箭头交界处毛边、重叠边框和圆角；同状态截图必须与原型并排验收。
- 修正状态模型：生产必须在“预发验证真实完成”后才可用，不能只因已有预发 DeploymentRun 或 release succeeded 就把预发显示为 4/4。
- 验证只在生产 DeploymentRun 成功后可用；完成只在发布后验证证据通过后可用。
- 禁用状态要比普通可选灰色再淡一级，同时保持 WCAG 可读性。

PMC006 验收条件（已完成）：

1. 删除 `stagingValidated || releaseSucceeded` 以及所有用发布单整体 `succeeded` 替代预发验证、生产部署或发布后验证证据的路径；证据未加载、加载失败或缺失时不得显示绿色完成态。
2. 预发验证只能由本发布关联的精确 staging DeploymentRun 验证结果解锁；存在 production run 时优先使用其冻结 `stagingProof.deploymentRunId`，不得拿其他或更新的预发运行代替。
3. 生产部署必须同时存在最新 production ReleaseRun 及其精确关联、非 dry-run、状态完成的 production DeploymentRun；只存在 ReleaseRun 成功状态不得解锁验证。
4. 发布后验证必须由同一 production DeploymentRun 的健康、入口探测、路由切换和 Manifest/环境一致性等独立真实检查结论驱动；失败、不可用或暂无证据均不得解锁完成。
5. 完成必须同时满足精确 ReleaseRun 成功、精确 DeploymentRun 完成、发布后验证独立通过和发布单生命周期一致；完成面板必须展示同一组证据，不能在缺少 DeploymentRun 时宣称完成。
6. 覆盖假绿反向测试、冻结预发证据归属、生产 run/DeploymentRun 错配、验证缺失/失败、evidence loading/error、完整通过路径，并完成 Web type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 浏览器验收后才标记 Done。

PMC006 完成证据（2026-08-28）：

- **状态真相**：删除 `stagingValidated || releaseSucceeded` 和整体 `releaseSucceeded` 对预发、生产、验证的替代。新的单一证据模型依次要求：冻结或当前 staging DeploymentRun 的独立技术验证通过；与最新 production ReleaseRun 精确匹配、`source=release_order`、`dryRun=false`、同环境/Manifest 且 `status=completed` 的 DeploymentRun；该 DeploymentRun 的 Manifest、工作负载、健康、入口、路由切换五项检查全部通过；最后再与 ReleaseRun 和 ReleaseOrder 的 `succeeded` 一致，才允许“完成”变绿。
- **API / 模型依据**：evidence presenter 现在返回 DeploymentRun 的真实 `source / targetType / dryRun`，并把 production run 冻结的 staging proof 的 `artifactManifestId / status / dryRun / result / finishedAt` 一并投影，前端不必从最多 50 条预发历史中猜冻结证据。生产 DeploymentRun 仍由后端 ownership 查询先做项目、发布单、ReleaseRun、环境和 Manifest 精确过滤，前端再次 fail-closed 校验。
- **失败与加载闭环**：evidence loading 阶段不渲染生命周期；请求失败或 scope 不一致时显示稳定错误和重试，不再把空数组送入整体成功兜底。完成面板只有同一证据模型 `completed=true` 且精确 DeploymentRun 存在时展示成功；发布后验证状态 Tag 来自五项独立检查结论，不再读取 ReleaseRun 总状态染色。
- **反向测试**：Web 覆盖“整体 succeeded 但无证据不变绿”、真实预发通过才解锁、冻结预发失败不被后来运行覆盖、production DeploymentRun 错配、生产验证失败、检查全通过但持久化总状态尚未一致、完整证据链、evidence loading/error 与完成面板缺 DeploymentRun；最终日志为 `pmc006-web-related-tests-2-20260828-014927.log`、`pmc006-completion-panel-test-2-20260828-013000.log`。API presenter/ownership/service 测试通过 `pmc006-api-related-tests-final-20260828-015746.log`。
- **类型、i18n 与构建**：API/Web type-check、i18n、API/Web production build 分别通过 `pmc006-api-typecheck-final-20260828-015746.log`、`pmc006-web-typecheck-3-20260828-014927.log`、`pmc006-i18n-1-20260828-014927.log`、`pmc006-api-build-final-20260828-015803.log`、`pmc006-web-build-1-20260828-014935.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc006/svton/`。
- **真实 Docker / API 证据**：先发现 API Dockerfile 只复制宿主 `dist`，因此没有把首轮镜像成功误报成新运行态；在 `pmc006-api-build-1-20260828-013757.log` 生成新 dist 后用 `pmc006-compose-api-after-build-20260828-013825.log` 重建。真实发布 `cmsmzs63q00ek1700clhiytmj` 的 evidence 返回 staging run `cmsn5pyqs01bd3nfoljnee97t`、`source=release_order`、`targetType=release-artifact`、`dryRun=false`、`status=completed`，但 `workloadReady / healthProbe / httpProbe` 均无结果且 production total 为 0；页面因此只显示 `2 / 4`，生产/验证/完成三个一级页签 `aria-disabled=true`，四项预发验证均为“证据不可用”。
- **响应式与截图**：运行验收发现 390px 表格把结果和时间挤出首屏，已抽取统一证据列表，桌面保持表格、移动端使用四张纵向卡片；实测 `body/main scrollWidth=390`、四张卡宽 316px、结果和证据时间同卡可见。Web 容器重建日志为 `pmc006-compose-web-responsive-20260828-015010.log`；截图为 `pmc006-lifecycle-disabled-desktop.png`、`pmc006-staging-evidence-unavailable-desktop.png`、`pmc006-staging-evidence-unavailable-mobile-390.png`。
- **影响面与差异**：`codegraph sync`、scoped affected、scoped diff 与 `git diff --check` 通过 `pmc006-codegraph-sync-20260828-015725.log`、`pmc006-codegraph-affected-final-20260828-015737.log`、`pmc006-scoped-diff-20260828-015858.diff`；所有本切片生产源文件均不超过 200 行。当前本地数据没有 production run，故没有伪造“完整成功”浏览器截图；完整成功与所有假绿边界由纯证据模型测试覆盖。

PMC014 验收条件（已完成）：

1. 预发验证保持独立二级步骤，只读取当前发布单所选 staging DeploymentRun；工作负载、健康探针、入口访问和业务验证分别映射到 `result.workloadReady / healthProbe / httpProbe / businessValidation`，不得从 DeploymentRun 整体完成、结束时间或发布单状态推导通过。
2. 每项必须展示验证对象、规范化结论、证据时间和来源字段；结构化块缺失时明确“证据不可用”，没有证据块自身的 `checkedAt` 时留空，不得用运行结束时间伪装检查发生时间。
3. “查看证据”进入预发验证专用 Drawer，展示精确 DeploymentRun、Manifest、四项原始证据、日志与真实缺口，不再把通用部署日志详情原样当作验证证据。
4. Drawer 复用 `deploymentRunId` 深链，打开、关闭、刷新和焦点恢复正确；移动端宽度不超过 390px，验证卡片、状态与证据时间同屏可读。
5. 覆盖通过、失败、运行中、未配置、不可用和错误字段，完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 浏览器验收后才标记 Done。

PMC014 完成证据（2026-08-28）：

- **代码与状态闭环**：`release-staging-validation.model.ts` 将四项检查逐一绑定到 `DeploymentRun.result.workloadReady / healthProbe / httpProbe / businessValidation`，同时保留 raw block、精确来源路径与块内 `checkedAt`；`release-step-staging-validation-panel.tsx` 已删除 `finishedAt || startedAt` 的时间替代。缺块统一为“证据不可用”和 `-`，运行整体 `completed` 不会让任何检查变绿。
- **专用 Drawer**：新增 `release-staging-validation-drawer.tsx` 与独立证据卡片，展示精确 DeploymentRun、环境、Manifest ID/Digest、四项原始证据、真实日志和证据缺口；`ReleaseStagingLogLayer` 只负责按 URL 模式选择日志 Drawer 或验证 Drawer，不再把旧日志详情原样当验证页。
- **API / 模型依据与真实缺口**：前端只消费 `GET /projects/:projectId/delivery/releases/:releaseOrderId/staging-deployments` 返回的 `ReleaseStagingDeploymentItem`。当前真实运行 `cmsn5pyqs01bd3nfoljnee97t` 为 `completed`，但四个结构化块均未写入，后端 staging workload evidence 也没有块级 `checkedAt`，因此真实页面四项均显示“证据不可用”、时间 `-`；没有为缺失的业务验证或时间创建演示字段。
- **路由与交互**：新增 `stagingStep=validation` 和 `deploymentEvidence=validation` 规范态。真实点击“预发验证”后 URL 保持二级步骤，点击“查看证据”聚焦同一 `deploymentRunId`；整页刷新后 Drawer 仍打开，抽屉刷新新增一次真实 staging-deployments 请求且 URL 不变，关闭后回到验证步骤并把焦点恢复到“查看证据”按钮。该问题是在首轮浏览器点击验收中发现并修复，未用手工深链替代真实入口。
- **测试与构建**：模型、专用 Drawer、规范路由与 route utility 定向测试通过 `pmc014-web-related-tests-after-runtime-fix-20260828-022035.log`；Web type-check、i18n、production build 分别通过 `pmc014-web-typecheck-after-runtime-fix-20260828-022035.log`、`pmc014-i18n-after-runtime-fix-20260828-022035.log`、`pmc014-web-build-after-runtime-fix-20260828-022045.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc014/svton/`。
- **Docker 与响应式**：最终 Web 容器重建通过 `pmc014-compose-web-after-runtime-fix-20260828-022120.log`。390px 实测 `body/dialog scrollWidth=390`、四张验证卡均为 342px 单列，关闭按钮、状态、来源与时间可读；最终截图为 `pmc014-staging-validation-drawer-desktop.png`、`pmc014-staging-validation-drawer-mobile-390.png`。
- **影响面与差异**：最终 `codegraph sync`、affected、scoped diff 与全工作树 `git diff --check` 通过 `pmc014-codegraph-sync-final-20260828-022447.log`、`pmc014-codegraph-affected-final-20260828-022448.log`、`pmc014-scoped-diff-final-20260828-022501.log`、`pmc014-git-diff-check-final-20260828-022449.log`；本切片生产源文件均不超过 200 行。

PMC015 验收条件（已实现，运行验收阻断）：

1. 生产检查是独立二级步骤，必须加载与当前发布单、精确 Manifest 绑定的 `production-preview`；不得继续用发布详情 `preflight.production.ready` 或通用 Gate Catalog 摘要替代生产准入事实。
2. 首屏展示真实目标环境、配置修订、Manifest 与预发证明；目标组件来自 `snapshot.workload.services`，入口、路径、端口和 TLS 只来自 `snapshot.config.routeSnapshot`，缺少配置时明确“未配置”。
3. 审批必须区分“策略要求审批”和“已经存在审批”；创建 Production ReleaseRun 前只能展示 `releasePolicy.requireProductionApproval` 与 D13 延后检查，不得虚构审批人或已批准状态。
4. 并发保护必须展示 `preflight.concurrency.limit / state / checkedAt / activeRun`；配置与策略修订展示真实 ID、revision、snapshotHash 与 synthetic 状态，不从页面状态推导。
5. D01-D20 生产检查逐项展示真实 status、reason、evidenceRef、checkedAt、expiresAt、fresh、localOnly 与 deferredUntilApproval；只有服务端提供 `repairHref` 时才显示修复动作。重新检查调用真实 `production-preflight-refresh`，错误和无预览均 fail-closed。
6. 覆盖通过、阻断、manual、unavailable、未配置入口、并发占用、加载/刷新错误、scope mismatch 与 390px；完成 type-check、i18n、build、CodeGraph、scoped diff、Docker 和真实浏览器截图后才标记 Done。当前真实数据若仍因缺少可启动服务或预发证据无法进入该步骤，必须保留 Partial 并记录阻断，不得用 fixture 截图冒充运行态。

PMC015 实施证据与运行阻断（2026-08-28，保持 Partial）：

- **独立实现**：`release-step-production-check-panel.tsx` 已删除 `detail.preflight.production.ready` 三 Fact 与通用 `ReleaseGateCatalogView` 复用，改为只在精确 Manifest 的真实预发验证通过后加载 `useProductionReleases` 对应的 `production-preview`；加载、空结果、scope mismatch 和 422 均 fail-closed，唯一主操作“重新检查”调用真实 `production-preflight-refresh`。
- **真实内容映射**：目标环境、配置 revision/ID/hash、Manifest、预发 DeploymentRun、工作负载组件均来自 `ProductionReleaseSnapshot`；入口、路径、组件、端口、TLS 只解析 `config.routeSnapshot.entries` 或 legacy `domains/tlsRequired`，缺字段显示“未配置”。审批区区分 `requireProductionApproval`、D13 `deferredUntilApproval` 与真实 ReleaseRun `operationApproval`；并发区展示 `limit/state/checkedAt/activeRun`；D01-D20 列表展示服务端 status/reason/provider/evidenceRef/checkedAt/expiresAt/fresh/localOnly/deferredUntilApproval，且仅渲染服务端 `repairHref`。
- **测试与静态验证**：结构化/legacy 入口、TLS 空值、状态归一、计数、D13、并发占用、无审批、Preview 失败和刷新调用的定向测试通过 `pmc015-web-related-tests-final-20260828-024428.log`；Web type-check、i18n、production build 通过 `pmc015-web-typecheck-final-20260828-024428.log`、`pmc015-i18n-final-20260828-024428.log`、`pmc015-web-build-final-20260828-024437.log`。
- **Docker / 影响面**：最终 Web 容器重建通过 `pmc015-compose-web-final-20260828-024514.log`；CodeGraph sync/affected、scoped diff 与 `git diff --check` 通过 `pmc015-codegraph-sync-final-20260828-024804.log`、`pmc015-codegraph-affected-final-20260828-024806.log`、`pmc015-scoped-diff-final-20260828-024820.log`、`pmc015-git-diff-check-final-20260828-024806.log`。本切片生产和测试源文件均不超过 200 行；完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc015/svton/`。
- **真实运行阻断**：当前唯一有构建的发布单 `cmsmzs63q00ek1700clhiytmj` 的四项预发验证均无结构化证据，因此生产一级步骤真实 `aria-disabled=true`；点击后 URL 和选中阶段均不变，`production-check-panel` 不会越权渲染。即使直接以已登录管理员上下文只读调用精确 Manifest `cmsn2i52500383nfoe8ayoeiu` 的 `production-preview`，API 仍返回 HTTP 422“Production 没有可启动的活动服务”。另两张本地项目没有发布单，另一张真实发布单没有 Build/Manifest，无法提供合法 Preview。
- **浏览器与截图**：桌面及 390px 均验证生产页签不可绕过，移动端 `body/main scrollWidth=390`；截图为 `pmc015-production-check-blocked-desktop.png`、`pmc015-production-check-blocked-mobile-390.png`。由于没有可合法进入生产检查的真实本地数据，本项缺少独立面板的真实页面/390px 截图，严格保持 `[ ]` 与 Partial；未使用组件 fixture 或数据库伪造截图冒充验收。

PMC016 验收条件（已实现，运行验收阻断）：

1. 生产部署首屏以最新的真实 `ReleaseRun` 为主；没有运行时才展示精确 `production-preview` 的待发布目标。目标环境、版本、Manifest、配置修订、预发证明、组件与入口均来自 Snapshot/Evidence，禁止复用页面整体状态或静态文案伪造运行事实。
2. 确认 Modal 必须展示本次冻结的目标、Manifest、配置/策略修订、工作负载、入口/TLS、审批要求、并发状态和真实前置检查摘要；Preview 不存在、scope 不匹配、并发占用或 `preApprovalAllowed=false` 时 fail-closed，并常驻解释不能确认的原因。
3. 当前 Run 必须分别展示 ReleaseRun 状态、OperationApproval 请求/复核/消费事实、精确 DeploymentRun 阶段、错误码/错误原因、开始/结束时间与日志入口；不得把审批通过等同于部署成功，也不得用 ReleaseRun 成功替代 DeploymentRun 证据。
4. 只有服务端已经提供且当前响应明确携带能力时，才显示审批、重试、回滚或恢复操作。现有 evidence 未携带审批 `capabilities.review`，发布页不得擅自提供审批按钮；部署级 retry/rollback 不能伪装成 ReleaseRun 通用恢复。历史 reconciliation/manual gate 仅展示服务端 `legacyPromotionRecovery / promotionBlocker` 给出的真实边界与精确入口。
5. 运行历史保留同 Manifest、审批和状态事实；日志 Drawer 必须按精确 Run 展示其 DeploymentRun，而不是把旧历史摘要当当前运行。URL 深链、关闭返回、刷新、运行中轮询和 390px 单层滚动必须正确。
6. 覆盖无运行、待审批、被拒绝、运行中、失败、成功、无 DeploymentRun、Preview 阻断和 scope mismatch；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与真实浏览器验收后才可标记 Done。若本地真实数据仍被 PMC015 的预发证据/可启动服务阻断，必须保留 Partial 并记录运行缺口，不得以 fixture 截图冒充生产运行。

PMC016 实施证据与运行阻断（2026-08-28，保持 Partial）：

- **Preview / Confirm 真相**：`release-production-view.tsx` 已把“尚未创建运行”和“已有当前运行”拆成互斥内容；无 Run 时只展示精确 `production-preview`，加载失败、无 Preview、`preApprovalAllowed=false` 或 `preflight.concurrency.state=occupied` 均 fail-closed。`production-confirm-summary.tsx` 的确认 Modal 展示目标环境、版本、Manifest/构建、配置修订、预发 DeploymentRun、工作负载、入口/TLS、审批要求、并发检查时间与 D01-D20 计数，确认仍只提交服务端要求的 `manifestId / expectedInputHash / idempotencyKey`。
- **当前 Run 与审批事实**：新增 `release-production-current-run.tsx`，首屏以最新 `ReleaseEvidenceProductionRun` 为主，分别展示 ReleaseRun 状态、冻结 Manifest、预发证明、开始/结束时间、验收模式、错误码/错误原因；`release-production-run-approval.tsx` 展示 OperationApproval 申请人、复核人、申请/复核/消费/过期时间、风险和意见，不把 pending/approved 当成部署成功。evidence 未返回 `capabilities.review`，因此生产发布页没有审批按钮，并明确只读原因。
- **阶段、日志与恢复边界**：`release-production-run-stages.tsx` 逐条展示精确关联的生产 DeploymentRun、`source / targetType / dryRun`、executor/adapter、状态、时间与错误；已有日志 Drawer 继续按精确 ReleaseRun 展开其 DeploymentRun。`release-production-recovery-boundary.tsx` 只读展示服务端 `legacyPromotionRecovery / promotionBlocker`，没有把 DeploymentRun 的 retry/rollback 伪装成 ReleaseRun 通用恢复，也没有为无 capability 的人工门禁提供按钮。历史表在桌面保持表格、390px 改为独立卡片；活动 ReleaseRun 或 DeploymentRun 由证据状态驱动 5 秒刷新。
- **API / 权限依据**：`GET production-preview` 只需 read 权限，`POST production-releases` 与 `POST production-preflight-refresh` 均经 `assertConfirmProduction`；后端 `ReleaseProductionService.confirm` 会重新计算 Preview/inputHash/前置检查，只有 `preApprovalAllowed=true` 才创建 ReleaseRun 与审批。审批复核另由 `POST /operation-approvals/:id/review`、`team_admin` 与响应 `capabilities.review` 控制；当前发布 evidence 不携带该 capability，因此前端未越权复用。部署 service 虽有 retry/rollback，但它们是 DeploymentRun 能力，不是当前 ReleaseRun evidence 保证的恢复操作。
- **测试与静态验证**：确认摘要/空态/前置阻断/并发占用、当前 Run 的待审批/失败/精确 DeploymentRun/只读人工门禁、活动状态轮询模型、Production Preview scope 和既有检查模型的定向测试通过 `pmc016-web-tests-post-split-20260828-031412.log`；Web type-check、i18n、production build 通过 `pmc016-web-typecheck-post-split-20260828-031412.log`、`pmc016-i18n-post-split-20260828-031412.log`、`pmc016-web-build-post-split-20260828-031420.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc016/svton/`。
- **Docker / 浏览器与真实缺口**：最终 Web 容器重建通过 `pmc016-compose-web-post-split-20260828-031453.log`，容器使用新镜像且为 `running`。已登录管理员的真实发布仍因四项预发结构化证据缺失而把生产一级步骤设为 `aria-disabled=true`；桌面和 390px 实际点击后 URL 仍为 `step=staging&stagingStep=validation`、选中步骤不变、生产 Preview/Run 面板均未渲染。移动端 `body/main/viewport=390`；截图为 `pmc016-production-deploy-blocked-desktop.png`、`pmc016-production-deploy-blocked-mobile-390.png`。因此缺少合法 Production Preview/ReleaseRun/审批/部署运行的真实页面截图，本项继续为 Partial，未使用 fixture 或数据库伪造运行证据。
- **影响面与结构**：最终 CodeGraph sync/affected 通过 `pmc016-codegraph-sync-post-split-20260828-031721.log`、`pmc016-codegraph-affected-post-split-20260828-031732.log`；高输出 scoped diff 保存在 `pmc016-scoped-diff-final-20260828-031308.log`。生产历史桌面表格与移动卡片拆分后分别 144/88 行，本切片生产和测试源文件均不超过 200 行；scoped 与全工作树 `git diff --check` 通过。

PMC017 验收条件（已实现，运行验收阻断）：

1. 发布后验证只读取最新 Production ReleaseRun 与其精确关联、非 dry-run 的 production DeploymentRun；ReleaseRun 成功、发布单整体 succeeded 或旧运行不得替代当前 DeploymentRun 证据。
2. Manifest 一致性必须同时核对 ReleaseRun `verifiedDigest / artifactManifestId`、DeploymentRun `artifactManifestId / manifest.digest`；当前版本一致性必须核对 Project Delivery Summary 的 `currentVersions.production` 中 releaseOrder、Manifest、Digest、DeploymentRun 与本次生产运行全部相同，缺任一事实显示“证据不可用”。
3. 工作负载、健康和入口分别读取 DeploymentRun 自己的结构化证据；检查时间只允许来自对应 block 的 `checkedAt`、`siteProbe.probedAt/http.checkedAt`、`routeSwitch.switchedAt` 或 EnvironmentVersion `effectiveAt`，不得用 Run 创建/结束时间伪装。
4. 入口结论必须保留 DNS、TLS、HTTP 与 route switch 的真实状态、域名、URL、证书/错误和时间；部分证据缺失不得显示完整通过。路由切换的 deploymentRunId/releaseRunId 若与当前链路不一致必须失败。
5. 当前步骤首屏展示验证对象、结论、来源和证据时间；专用 Drawer 展示精确 ReleaseRun、DeploymentRun、当前 EnvironmentVersion、siteProbe、routeSwitch 与结构化 result。加载/缺失/失败/运行中均有独立状态，失败时完成阶段保持锁定。
6. 覆盖完整通过、Digest/Manifest/版本错配、错误 ProductionRun 关联、健康失败、DNS/TLS/HTTP 部分缺失、route switch 错配、运行中与无证据；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 真实浏览器验收后才可标记 Done。若本地仍无合法 ProductionRun，保持 Partial 并记录阻断，不得用 fixture 截图冒充运行态。

PMC017 实施证据与运行阻断（2026-08-28，保持 Partial）：

- **证据真相模型**：新增 `release-production-validation-evidence.model.ts`，发布后六项检查只接受最新 Production ReleaseRun 及其精确关联、非 dry-run 的 production DeploymentRun。制品完整性同时核对 ReleaseRun `verifiedDigest / artifactManifestId` 与 DeploymentRun `artifactManifestId / manifest.digest`；当前版本同时核对 Delivery Summary `currentVersions.production` 的 releaseOrder、Manifest、Digest 与 deploymentRun。`release-lifecycle-evidence.model.ts` 也读取同一当前生产 EnvironmentVersion，缺失或错配不会解锁完成。
- **独立检查与时间边界**：`release-production-validation.model.ts` 独立生成制品完整性、当前版本、工作负载、健康探针、入口探测与路由切换六项结论。工作负载/健康只读取各自结构化 block 和 `checkedAt`；入口只有 DNS、TLS、HTTP 全部通过才通过，并读取 `siteProbe.probedAt/http.checkedAt`；路由切换核对 deploymentRunId/releaseRunId 并读取 `switchedAt`。没有任何检查以 ReleaseRun/DeploymentRun 的 createdAt/finishedAt 伪装检查时间。
- **内容与交互**：`release-step-post-validation-panel.tsx` 提供专用摘要、失败/不可用警告、桌面表格、390px 卡片和独立证据 Drawer；`release-post-validation-drawer.tsx` 与 `release-post-validation-drawer-evidence.tsx` 展示精确 ReleaseRun、DeploymentRun、当前 EnvironmentVersion、DNS/TLS/HTTP、route switch、工作负载和健康原始证据，关闭后焦点返回触发按钮。结果、对象、来源与证据时间在首屏同列展示，不再复用通用 Outcome 染色。
- **测试与静态验证**：完整通过、无运行、Digest/Manifest/版本错配、健康失败、DNS/TLS/HTTP 部分缺失、route switch 错配、时间不得兜底、Drawer 内容与关闭焦点、生命周期和完成锁定共 13 项定向测试通过 `pmc017-web-related-tests-final-20260828-032910.log`；Web type-check、i18n、production build 通过 `pmc017-web-typecheck-final-20260828-032910.log`、`pmc017-i18n-final-20260828-032910.log`、`pmc017-web-build-final-20260828-032917.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc017/svton/`。
- **Docker / 浏览器与真实缺口**：Web 容器最终重建通过 `pmc017-compose-web-final-20260828-032950.log`。已登录管理员的真实发布仍因 PMC015/PMC016 所述预发结构化证据缺失而把生产“验证/完成”一级步骤设为 `aria-disabled=true`；桌面和 390px 实际点击后 URL 均仍为 `step=staging&stagingStep=validation`，精确标题“发布后验证详情”未渲染，移动端 `body/main/viewport=390`。截图为 `pmc017-post-validation-blocked-desktop.png`、`pmc017-post-validation-blocked-mobile-390.png`。因此缺少合法 ProductionRun 的发布后验证首屏/Drawer 真实运行截图，本项继续为 Partial，未用 fixture 或数据库伪造证据。
- **影响面与差异**：最终 CodeGraph sync/affected 通过 `pmc017-codegraph-sync-final-20260828-033420.log`、`pmc017-codegraph-affected-final-20260828-033436.log`；scoped diff 保存于 `pmc017-scoped-diff-final-20260828-033511.diff`。本切片新增模型、组件和测试文件均不超过 200 行；scoped 与全工作树 `git diff --check` 通过。

PMC018 验收条件（已实现，运行验收阻断）：

1. 完成面板必须从同一条精确证据链生成不可变完成记录：当前 Production EnvironmentVersion、最新 Production ReleaseRun、其精确关联且非 dry-run 的 production DeploymentRun，以及六项独立发布后验证全部通过；`lifecycleEvidence.completed=true`、ReleaseRun succeeded、发布单 lifecycle succeeded 任一单独事实均不得显示完成。
2. 最终版本必须来自 Delivery Summary `currentVersions.production.releaseVersion`，并与当前 ReleaseOrder 的 id/version、Manifest id/digest、DeploymentRun id 全部一致；缺失或错配时显示阻断原因，不得退回使用发布单标题或旧版本。
3. 环境、Manifest、ReleaseRun、DeploymentRun 均展示可追溯原始标识；ReleaseRun 结束时间、DeploymentRun 完成时间、EnvironmentVersion 生效时间分别展示且不互相兜底。缺少任一成功/生效时间时保持未完成。
4. 验证结论必须展示 PMC017 六项独立检查及 API 实际提供的各自证据时间；任何 failed/running/unavailable 均阻断完成。结构一致性检查若没有独立时间字段，必须如实显示“暂无独立时间证据”，不得使用 Run 创建/结束时间填充，也不能用总状态或绿色标签替代。
5. DeploymentRun 证据入口使用项目部署页真实 `runId` 深链；审计入口只使用审计页真实支持的 `projectId + category=release` 筛选，并明确是项目发布审计范围，不得虚构审计 API 不支持的 ReleaseRun/DeploymentRun 精确过滤。
6. 覆盖完整链路、completed 布尔值与证据矛盾、当前版本缺失/错配、时间缺失、验证失败/无时间和深链；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 真实浏览器验收后才可标记 Done。若本地仍无合法 ProductionRun，保持 Partial 并记录阻断，不得用 fixture 截图冒充完成态。

PMC018 实施证据与运行阻断（2026-08-28，保持 Partial）：

- **完成记录真相**：新增 `release-completion-record.model.ts`，不再从 `run.deploymentRuns` 临时重取一条运行，也不信任单独的 `completed=true`。只有当前 Production EnvironmentVersion、最新 Production ReleaseRun、`lifecycleEvidence.productionDeployment`、发布单 id/version、生产环境、Manifest id/digest、版本 deploymentRunId、成功状态和六项验证全部属于同一条精确链路时才生成完成记录；任一矛盾返回具体 blocker。
- **版本、时间与验证**：最终版本只读取 `ProjectDeliverySummary.currentVersions.production.releaseVersion`；`release-completion-facts.tsx` 分别展示 EnvironmentVersion、Manifest ID/Digest、ReleaseRun、DeploymentRun、ReleaseRun 成功时间、DeploymentRun 完成时间和版本生效时间，三类时间缺失时 fail-closed 且不互相兜底。完成面板复用 PMC017 的六项独立检查表，结构一致性项没有独立时间字段时继续显示“-”，没有借用 Run 时间伪装。
- **可追溯入口与真实 API 边界**：DeploymentRun 链接使用 `/projects/:projectId/deployments?runId=:deploymentRunId` 打开精确证据 Drawer；审计链接使用审计页和 `GET /audit-events` 当前真实支持的 `projectId + category=release` 范围，并改名为“项目发布审计”。审计查询模型目前不支持 ReleaseRun/DeploymentRun 精确 target 过滤，前端没有添加无效参数或声称是精确运行审计。
- **错误态、响应式与结构**：证据未闭合时在步骤内容顶部展示“对象 + 原因 + 影响”的阻断区及逐项原因；闭合后展示一个紧凑事实区、最终验证表和两个次级证据链接，没有新增竞争性主操作。桌面使用三列事实和表格，移动端退化为两列/单列事实与验证卡片；新增生产/测试文件最大 133 行，均不超过 200 行。
- **测试与静态验证**：完整证据链、completed 布尔值矛盾、当前版本错配、成功时间缺失、验证失败、显式 DeploymentRun/EnvironmentVersion 缺失、无独立检查时间不伪造，以及完成事实/六项检查/两个真实深链共 16 项定向测试通过 `pmc018-web-related-tests-final-20260828-034149.log`；Web type-check、i18n、production build 通过 `pmc018-web-typecheck-20260828-034116.log`、`pmc018-i18n-20260828-034116.log`、`pmc018-web-build-20260828-034159.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc018/svton/`。
- **Docker / 浏览器与真实缺口**：API/Web 容器最终重建通过 `pmc018-compose-web-20260828-034251.log`，随后 API 为 healthy、Web 为 running。已登录管理员的真实发布仍因预发结构化证据缺失而把“完成”设为 `aria-disabled=true`；桌面和 390px 实际点击后 URL/选中步骤不变、精确标题“发布完成”和完成阻断面板均未渲染，移动端 `body/main/viewport=390`。截图为 `pmc018-completion-blocked-desktop.png`、`pmc018-completion-blocked-mobile-390.png`。因此缺少合法 ProductionRun 的真实完成态、证据深链点击与审计返回截图，本项继续为 Partial，未使用 fixture 或数据库伪造运行态。
- **影响面与差异**：最终 CodeGraph sync/affected 通过 `pmc018-codegraph-sync-final-20260828-034641.log`、`pmc018-codegraph-affected-final-20260828-034654.log`；scoped diff 保存于 `pmc018-scoped-diff-final-20260828-034654.diff`。scoped 与全工作树 `git diff --check` 通过。

### PMC015-PMC018 本地运行闭环（2026-08-30，取代上述历史 Partial 结论）

- **当前代码与真实数据链**：`scripts/devpilot-local-release-rehearsal.mjs run` 在隔离 Compose project 中从当前工作树构建 API/Web/route-control/deploy-target/target-workload，reset 后通过真实 HTTP API 新建 Project `cmter9vlk000bhyld5ntx7g6s` 和 ReleaseOrder `cmter9x8m002rhyld44nqfun7`。最终 v29 全链 exit 0，日志 `/tmp/codex-tool-runs/svton/local-docker-release-rehearsal/final/svton/local-release-current-worktree-full-run-v29-20260830-030653.log`。
- **PMC015**：生产检查页真实展示 Preview 19 项、通过 19、阻断 0、不可用 0，包含冻结环境/配置/Manifest/预发证据、组件、HTTP 入口、“不要求 TLS”、P03 审批、并发、D01-D20 对象/时间/修复边界；完成发布不再显示过期的“检查不可用”页级告警。截图 `release-production-check-desktop.png`。
- **PMC016**：首次 resume 被 P03 阻断，reviewer 对精确 evaluation 复核后再次 resume 成功；页面分别展示 ReleaseRun `cmterardp00b4hyldlm3lyxth`、OperationApproval 的申请/复核/消费时间、Production DeploymentRun `cmterarh400cthyldnv0zb6qt` 和真实恢复能力缺失边界。截图 `release-production-deployment-desktop.png`。
- **PMC017**：发布后验证在桌面与 390px 同时显示 `1 / 1 已完成`、`6 / 6 通过`，六项分别取自 ReleaseRun/Manifest、Production EnvironmentVersion、DeploymentRun workload/health/siteProbe/routeSwitch。`siteProbe.tls.status=not_required` 显示为“无需 TLS”而非“不可用”。截图 `release-validation-desktop.png`、`release-validation-mobile-390.png`。
- **PMC018**：完成页展示同一链的 ReleaseRun、DeploymentRun、EnvironmentVersion、Manifest、三类时间和六项最终验证；DeploymentRun 深链打开五区 Drawer，阶段/日志/精确审计缺失时显示如实空态，未返回能力时隐藏恢复/重试/回滚。截图 `release-completion-desktop.png`、`deployment-evidence-drawer-desktop.png`、`deployment-evidence-drawer-mobile-390.png`。
- **测试与边界**：Web 全量测试、Web/API type-check、i18n、CodeGraph sync/affected 与 7 个 route/promotion/gate/evidence 自测通过；Web/API production build 包含在 v29。本地链使用 local-filesystem provider、显式 route-control allowlist 和 HTTP-only 入口，因此只关闭本地 PMC 验收，不声称公网 DNS/TLS、真实云资源、生产流量或外部备份恢复已签收。

PMC019 验收条件（已完成）：

1. “发布输入”在发布详情页级只渲染一次，位置固定在 Header 之后、生命周期步骤之前；Header 只保留发布标识、最近执行和状态，不再重复分支/Commit。各步骤可以展示本步骤的 BuildRun/DeploymentRun 证据，但不得再创建第二个共享输入摘要。
2. 共享输入只读取 `ReleaseOrderDetail`、`ReleaseOrderEvidence` 与 `ProjectDeliverySummary`：发布版本/ReleaseOrder、分支/完整 Commit/BuildRun、Manifest ID/Digest、Staging/Production 环境均能追溯到这些 API 模型，不从页面颜色、步骤状态或展示文案反推。
3. 一旦存在 Production ReleaseRun，其冻结 Manifest 必须优先于后续 BuildRun；即使构建列表无法反查对应 build item，也必须使用 Production evidence 自带的 Manifest/buildRun 事实。尚无 ProductionRun 时才读取最新有 Manifest 的 BuildRun。
4. 环境链固定展示 Staging → Production 两个位置；任一 baseline 缺失时在原位显示“—”，不能通过 `filter(Boolean)` 把不完整链伪装成单环境链。Manifest、Commit 或环境事实缺失时均显示真实空值，不发明冻结状态或来源。
5. 共享输入采用连续白底、轻边框和紧凑事实表，不提供页面级主操作；桌面与 390px 均无截断关键信息或横向溢出，长 Commit/Digest 可换行并保留完整 title。
6. 覆盖 ProductionRun 冻结 Manifest 优先、BuildRun fallback、缺 Manifest/Commit、缺单侧 baseline、单实例和 Header 去重；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 真实浏览器验收后才可标记 Done。

PMC019 实施证据（2026-08-28，Done）：

- **单一位置与去重**：`release-order-detail-workbench.tsx` 只渲染一次 `ReleaseInputSummary`，并把它固定到 `ReleaseWorkbenchHeader` 之后、生命周期箭头步骤之前。`release-workbench-header.tsx` 删除分支/Commit 推导与展示，只保留 ReleaseOrder 短标识、最近真实运行时间和 lifecycle 状态；浏览器 DOM 精确统计“发布输入”标题为 1，且该 section 位于 lifecycle tablist 之前。
- **单一证据模型**：新增 `release-input.model.ts`，只接收 `ReleaseOrderDetail`、`ReleaseOrderEvidence` 与 `ProjectDeliverySummary`。Production ReleaseRun 存在时直接使用其 evidence 自带的 Manifest/buildRun/分支/完整 Commit，并优先于更新的 BuildRun；无 ProductionRun 时才读取 evidence 中最新有 Manifest 的 BuildRun。摘要不再依赖 `manifestBuild` 在构建列表中反查，因此不会丢失已经冻结的 Manifest。
- **真实字段与缺失表达**：共享输入展示候选版本、ReleaseOrder、完整分支/Commit、BuildRun、Manifest ID/Digest、Manifest 冻结来源和固定 `Staging → Production` 环境链。任一 Commit、Manifest 或 baseline 缺失时在所属 section 顶部列出具体缺口；环境链缺单侧时保留位置并显示“—”，没有再使用 `filter(Boolean)` 掩盖不完整链路。长技术值使用 `break-all` 与完整 `title`，页面没有新增操作。
- **测试与静态验证**：ProductionRun 冻结 Manifest 优先、BuildRun fallback、缺 Commit/Manifest、单侧环境缺失、单标题、Header 去重和既有 summary 选择共 12 项定向测试通过 `pmc019-web-related-tests-20260828-035226.log`；Web type-check、i18n、production build 通过 `pmc019-web-typecheck-20260828-035226.log`、`pmc019-i18n-20260828-035226.log`、`pmc019-web-build-20260828-035238.log`。新增/修改的组件、模型和测试源文件均不超过 200 行，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc019/svton/`。
- **Docker / 浏览器**：API/Web 最终容器重建通过 `pmc019-compose-web-20260828-035316.log`，随后 API 为 healthy、Web 为 running。已登录管理员真实发布显示唯一输入：版本 `0.0.1`、ReleaseOrder `cmsmzs63…`、完整 Commit `8e7c465d56e68dafcef0dfbc480fe721044b0fb3`、BuildRun `#10`、Manifest ID/Digest、来源 `BuildRun` 与 `预发 → Production`；Header 不再包含 `master/Commit`。桌面与 390px 的 `body/main/viewport` 分别精确等宽，移动端完整 Commit 正常换行且无横向溢出。截图为 `pmc019-release-input-desktop.png`、`pmc019-release-input-mobile-390.png`。
- **影响面与差异**：最终 CodeGraph sync/affected 通过 `pmc019-codegraph-sync-final-20260828-035658.log`、`pmc019-codegraph-affected-final-20260828-035713.log`；scoped diff 保存于 `pmc019-scoped-diff-final-20260828-035713.diff`。scoped 与全工作树 `git diff --check` 通过。

PMC011 验收条件（已完成）：

1. 预检首屏必须展示当前执行阶段 `ReleaseGateDecision` 的精确 checks；优先使用后端 `decision.evaluations[].gateId` 关联 `catalog.checks`，从而同时保留通过、阻断、待人工、警告与 evidence-only 项，不得用全目录能力组或 blocker id 并集近似替代当前决策。
2. Web 类型补齐真实 Gate API 已返回的 `checkpoint / approvalSubjectHash / actionInputHash / requesterActorId / evaluations`；决策摘要展示 stage/checkpoint、allowed、decidedAt 与 blocker/warning/manual 计数，scope 或完整性错误时 fail-closed。
3. 检查表逐项展示 Gate id/title、真实 status、对当前决策的影响、provider/source 和 checkedAt；缺 evidence/check 时间显示“暂无证据”，不得用 persistedAt 或 decidedAt 填充检查时间。桌面为紧凑表格，390px 为单列卡片。
4. 单项高级证据收敛到专用 Drawer，完整展示 reasonCode/reason、evidenceRef、evaluationId/inputHash、definition/catalog/capability version、persisted status/time、expires/fresh、dispositions 与 waiver；关闭后焦点返回原行。只有当前 decision 的 manualGateIds 且 API 允许的项才显示真实 confirm 写操作。
5. 只有 API 明确返回修复语义时显示修复动作：当前 `targetReadiness.remediation=environment_targets` 映射到对应环境的部署目标配置；其余 unavailable reason 只如实说明缺口并提供重新检查，不发明 Provider 安装、自动修复或绕过路径。
6. 覆盖 evaluations 精确筛选与 fallback、passed/blocker/manual/evidence-only 影响、缺时间/证据、target repair、Drawer 内容/焦点/人工确认边界、加载/错误/空态；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与桌面/390px 真实浏览器验收后才可标记 Done。

PMC011 实施证据（2026-08-28，Done）：

- **真实决策与调用链**：`release-gate.types.ts` 补齐 Gate API 已返回的 checkpoint、决策哈希、requester 与 evaluations；`release-preflight-checks.model.ts` 只按当前阶段 `ReleaseGateDecision.evaluations[].gateId` 建立行，并用该 evaluation 的 status、Provider、原因、证据、时间、hash 与 waiver 覆盖目录快照。只有 evaluations 字段完全缺失时才按同一 decision phase 兼容旧响应；显式空数组保持真实空态，不回退到 build 或其他阶段。`ReleaseStepPreflightPanel` 的调用链经 `release-lifecycle-step-panel.tsx` / `release-staging-view.tsx` 传入项目上下文，CodeGraph sync/affected 证据为 `pmc011-codegraph-sync-final-20260828-042304.log`、`pmc011-codegraph-affected-final-20260828-042306.log`；含新增文件的 scoped diff 为 `pmc011-scoped-diff-final.diff`，全工作树 `git diff --check` 通过 `pmc011-git-diff-check-post-todo-20260828-042535.log`。
- **内容与交互**：新增紧凑桌面表格和 390px 单列卡片，逐项展示 Gate ID/标题、真实结果、当前决策影响、Provider/source 与 `checkedAt`；空时间只显示“暂无”。决策区展示真实 `staging_pre_execution`、decidedAt、allowed 与阻断/警告/人工数。当前 API 的 `targetReadiness.remediation=environment_targets` 映射到真实环境目标配置；B01/B03/B06 等 Provider 缺口没有虚构安装或绕过操作，仅能重新检查。
- **证据 Drawer**：`release-preflight-evidence-drawer.tsx` 展示 reason/reasonCode、evidenceRef、evaluationId/inputHash、definition/catalog/capability version、persisted status/time、expires/fresh、dispositions 与 waiver。人工确认组件只在当前决策确属 manual 且该检查声明 manual disposition 时出现；关闭 Drawer 后焦点精确返回触发它的 B02“查看证据”按钮。
- **测试与静态验证**：精确 evaluation 筛选、同阶段 fallback、显式空 evaluations、审计字段、人工确认边界以及既有阶段计数共 8 项定向测试通过 `pmc011-related-tests-final2-20260828-041743.log`；Web type-check、i18n 与 production build 分别通过 `pmc011-web-typecheck-final-20260828-041743.log`、`pmc011-i18n-final-20260828-041743.log`、`pmc011-web-build-final-20260828-041752.log`。所有新增生产/测试源文件不超过 200 行，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc011/svton/`。
- **Docker 与真实浏览器**：最终 Web 镜像构建证据为 `pmc011-compose-web-final-evidence-20260828-042348.log`，当前容器使用最终镜像。已登录管理员真实发布只展示当前 staging decision 的 B01/B02/B03/B06/B09；B02 Drawer 显示真实 evaluation `cmsrkl5720b4wr7hash29r0yk`、输入哈希、BuildRun evidence 与 `v13.2026-08-03 · mvp15.2026-08-03`。桌面截图为 `pmc011-preflight-checks-desktop.png`、`pmc011-preflight-evidence-drawer.png`；390px 截图为 `pmc011-preflight-mobile-390.png`、`pmc011-preflight-evidence-drawer-mobile-390.png`，浏览器实测 `body/main/viewport=390`，无横向溢出。

PMC012 验收条件（已完成）：

1. 构建步骤只读取当前发布单 `GET .../builds` 与精确 `GET .../builds/:buildRunId` 返回的 BuildRun/ArtifactManifest，不发明 CPU、内存、缓存命中率、阶段百分比、ETA 或外部制品地址；当前运行、历史行与日志 Drawer 必须按 exact buildRunId 保持同一事实。
2. 首屏展示 BuildRun revision/status、完整分支/Commit、开始/结束时间、真实耗时，以及 Manifest ID/Digest/资源条目数；运行中或后端未返回时间/Manifest 时显示真实空值或进行中，不用 createdAt、当前时间或 ReleaseOrder 整体状态替代。
3. Manifest 资源使用紧凑桌面表格与 390px 卡片展示 componentKey、artifactType、URI、Digest；Manifest 存在但 items 为空时仍展示 Manifest 摘要并明确“没有资源条目”，不能把它误写成没有 Manifest。
4. 失败 BuildRun 在步骤、历史和日志 Drawer 使用同一 errorCode/errorMessage 失败摘要；没有错误结构时不猜原因。日志只展示 `logSummary` 已返回且按现有解析规则脱敏/截断的行，缺日志明确为空，不虚构日志流。
5. 历史 Drawer 展示当前已加载范围与服务端 total，行可按 exact buildRunId 打开二层日志；直接日志深链、关闭返回、加载/错误/空态和运行态轮询继续正确。页面不新增第二个构建主操作。
6. 覆盖成功/运行中/失败、Manifest 有/无/空资源、时间缺失、历史与日志入口、390px 无横向溢出及焦点返回；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 和真实浏览器验收后才可标记 Done。

PMC012 实施证据（2026-08-28，Done）：

- **API 投影与真实调用链**：`GET .../builds` 的 `presentBuildHistory()` 只返回 Manifest ID/Digest 并按契约将 `items` 置空；精确 `GET .../builds/:buildRunId` 才返回完整 `ArtifactManifest.items`、logSummary 与来源证据。新增 `release-step-build-layer.tsx` 在当前 `release-lifecycle-step-panel.tsx` 真实渲染链上按 exact buildRunId 调用 `useReleaseBuildDetail`，加载/错误/404 均显式展示，未再把列表摘要的空 items 当作零制品。实施前 CodeGraph node 证据为 `pmc012-codegraph-node-before-20260828-042746.log`，最终 sync/affected 为 `pmc012-codegraph-sync-final-20260828-044536.log`、`pmc012-codegraph-affected-final-20260828-044537.log`。
- **当前 BuildRun 与 Manifest**：`release-build-current-summary.tsx` 展示真实 revision/status、完整分支/40 位 Commit、开始/完成、耗时、Manifest ID/Digest 和资源条目数；运行中完成时间明确为“尚未完成”，缺 Manifest 显示 API 证据未返回。`release-build-resources.tsx` 在桌面用紧凑表格、390px 用单列卡片展示 componentKey、artifactType、完整 release-artifact URI 与完整 Digest；没有添加 CPU、内存、缓存、百分比或 ETA。
- **失败、历史与日志闭环**：失败继续只使用 BuildRun 的 errorCode/errorMessage，并与历史表、日志 Drawer 共用既有映射。历史 Drawer 展示服务端 total/已加载范围和 #1–#10 的真实状态/失败摘要；行内日志把 URL 更新为 `step=build&history=builds&buildRunId=...`，精确详情成功后展示隔离、脱敏的 logSummary。关闭二层日志保留历史，关闭历史保留 `step=build` 且焦点返回“查看历史”；没有创建第二个构建主操作。
- **影响面与差异**：含新增文件的 scoped diff 保存为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc012/pmc012-scoped-diff-final.diff`；全工作树 `git diff --check` 通过 `pmc012-git-diff-check-post-todo-20260828-044631.log`。实现过程中通过真实浏览器发现并修正了旧 `ReleaseStagingView` 与当前 `ReleaseLifecycleStepPanel` 的调用链分岔，未把未命中的初版实现计为完成证据。
- **测试与静态验证**：成功空 Manifest-items、运行中缺完成/Manifest、失败原始 errorCode/message，以及既有历史表和日志 Drawer 的三份定向测试通过 `pmc012-related-tests-final-20260828-043950.log`；Web type-check、i18n、production build 通过 `pmc012-web-typecheck-final-20260828-043950.log`、`pmc012-i18n-final-20260828-043950.log`、`pmc012-web-build-final2-20260828-044001.log`。新增生产/测试文件均不超过 200 行，完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc012/svton/`。
- **Docker 与真实浏览器**：最终镜像构建通过 `pmc012-compose-build-web-final2-20260828-044033.log`。已登录管理员真实 BuildRun #10 首屏与日志 Drawer 均显示 Manifest `cmsn2i52500383nfoe8ayoeiu`、同一 Digest 和三项制品（包括 `project-bundle`）；先前“首屏 0 项 / Drawer 3 项”的投影矛盾已消失。桌面截图为 `pmc012-build-desktop.png`、`pmc012-build-history-drawer.png`、`pmc012-build-log-drawer.png`；390px 截图为 `pmc012-build-mobile-390.png`、`pmc012-build-resources-mobile-390.png`、`pmc012-build-log-drawer-mobile-390.png`，浏览器实测 `body/main/viewport=390`。

PMC013 验收条件（已完成）：

1. 预发部署只读取 `GET .../staging-deployments` 返回的 DeploymentRun 及其冻结 `params.deploymentInput/workload/gateDecision`、commandPlan、result/logs/error；补齐 Web 类型但不为 JSON 中不存在的字段建立展示事实。
2. 当前运行展示 exact DeploymentRun/status、Staging 环境（优先匹配 ProjectDeliverySummary baseline name，至少保留 environmentId）、真实 Provider/targetRef/serverId、工作负载组件/端口、完整 Manifest ID/Digest、开始/完成/耗时和 dry-run；缺失字段保持“暂无”。
3. 阶段只来自 `commandPlan.steps` 以及 result 中同 key 的真实结果；不得用数组顺序、整体 completed 或前端颜色把尚无 step result 的阶段标为通过。入口只展示真实 healthCheckUrl/result.httpProbe/siteProbe/routeSwitch 证据，不把 DeploymentRun 成功冒充入口探测成功。
4. 失败摘要只使用 DeploymentRun.error 和结构化 result；恢复/重试/回滚操作只有 Release Staging API 明确支持且服务端可判定权限时才出现。当前 release staging API 只有部署创建与读取，因此失败态只提供证据、日志和可重新发起的既有发布动作，不发明 run-level 恢复。
5. 历史 Drawer 继续展示服务端 total 与 exact run 日志深链；当前页、历史行与日志 Drawer 必须使用同一 DeploymentRun/Manifest/时间/失败事实，关闭二层日志返回历史，关闭历史保留步骤并恢复焦点。
6. 桌面/390px 覆盖工作负载表/卡片、阶段、入口空态、失败、历史与日志；完成定向测试、type-check、i18n、build、CodeGraph、scoped diff、Docker 与真实浏览器验收后才可标记 Done。

PMC013 实施证据（2026-08-28，Done）：

- **真实 API 与当前数据边界**：`ReleaseStagingService.list()` 经 `release-staging-select.ts` 返回 exact DeploymentRun 的 `params`、`commandPlan`、`logs`、`result`、`error` 与时间；Web `ReleaseStagingDeploymentItem` 已补齐此前丢失的 `params`/`commandPlan`。当前真实运行 `cmsn5pyqs01bd3nfoljnee97t` 的冻结计划只有 `verify_manifest_digest`、`deploy_exact_manifest`，对应持久化字段是 `result.artifactVerified=true`、`result.providerActivated=true` 和 exact providerDeploymentId；其旧版 params 没有 `deploymentInput.workload/target`，result 也没有 workload/health/http/siteProbe/routeSwitch，因此页面明确显示工作负载快照和入口证据未持久化，没有用整体 `completed` 补绿。
- **当前运行、阶段与内容层级**：`release-staging-deployment.model.ts` 只解析冻结 JSON 中实际存在的 Provider、targetRef、server/binding、Manifest、workload、逐阶段结果与五类探测字段；未知阶段和缺结果统一为“暂无证据”。`release-staging-deployment-summary.tsx` 展示 exact runId、匹配 ProjectDeliverySummary 的预发环境名与 environmentId、完整 Manifest ID/Digest、Provider/目标、服务器/绑定、开始/完成/耗时、dry-run、target/executor/adapter；`release-staging-deployment-stages.tsx`、`release-staging-workloads.tsx` 与 `release-staging-entry-evidence.tsx` 分别承担阶段、桌面表格/390px 卡片和真实入口证据，当前旧运行展示所属空态而不是样例组件。
- **失败与恢复边界**：失败警告仍只读取 `DeploymentRun.error`，日志 Drawer 展示当前 run 的结构化 result 与真实日志。Release Staging Controller 只有 list/create，没有 exact run retry/rollback/recovery 端点，页面没有新增恢复、重试或回滚按钮；既有“发布”动作继续由真实 Gate 与目标兼容性控制，当前页面因目标类型不一致保持禁用并给出所属修复入口。
- **调用链、测试与静态验证**：CodeGraph 实施前 query、最终 sync/affected 证据为 `pmc013-codegraph-query-before.log`、`pmc013-codegraph-sync-final-20260828-051115.log`、`pmc013-codegraph-affected-final2-20260828-051137.log`；新增模型测试覆盖 legacy 冻结字段、completed 不补绿、新版 workload/target/probe 解析，组件测试覆盖 exact facts 与真实空态，连同既有预发验证模型通过 `pmc013-related-tests-post-copy-20260828-051147.log`。Web type-check、i18n、production build 分别通过 `pmc013-web-typecheck-post-copy-20260828-051147.log`、`pmc013-i18n-post-copy-20260828-051147.log`、`pmc013-web-build-post-copy-20260828-051154.log`；所有新增生产/测试文件均不超过 200 行。
- **Docker 与真实浏览器**：新镜像构建通过 `pmc013-compose-build-web-final-20260828-050222.log`；只读镜像核对发现 Compose 未自动重建仍运行旧 image 的 Web 容器，随后通过 `pmc013-compose-force-recreate-web-20260828-050608.log` 切到新镜像。管理员真实页面在桌面和 390px 均显示同一 run、完整 Manifest 与两条有字段依据的阶段证据，`body/main/viewport=390` 无横向溢出；直接日志 URL 精确加入 `deploymentRunId`，关闭回到 `stagingStep=deploy` 且焦点返回“查看日志”。历史 URL 为 `history=deploys`，历史中打开日志叠加 exact runId，关闭二层日志保留历史并聚焦行内“日志”，关闭历史聚焦“查看历史”。截图为 `pmc013-staging-deploy-desktop.png`、`pmc013-staging-deploy-evidence-desktop.png`、`pmc013-staging-deploy-history-desktop.png`、`pmc013-staging-log-drawer-desktop.png`、`pmc013-staging-deploy-mobile-390.png`、`pmc013-staging-deploy-evidence-mobile-390.png`、`pmc013-staging-deploy-stages-mobile-390.png`、`pmc013-staging-log-drawer-mobile-390.png`。
- **差异与仍存在的真实缺口**：含新增文件的 scoped diff 保存为 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc013/pmc013-scoped-diff-final.diff`；全工作树 `git diff --check` 通过 `pmc013-git-diff-check-post-todo.log`。当前已存在运行早于新版 `deploymentInput.workload` 冻结模型，无法从真实数据展示组件表/卡片；这是持久化证据缺口而不是前端回退。后续新 DeploymentRun 若携带 workload/target/probe，页面按同一解析链展示；本切片没有为完成截图而修改项目部署目标或制造运行数据。

### 5.5 发布二级步骤内容

| 二级步骤   | 当前状态     | 已有真实内容                                                                                     | 需要补齐                                                                                                     |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 预检       | Done         | 当前决策精确检查、逐项结果/影响/来源/时间、真实修复动作和专用证据 Drawer                         | 后端未接入的 Provider 检查保持不可用，不在前端补造通过状态或修复路径。                                       |
| 构建       | Done         | 精确 BuildRun、完整 Commit/时间、Manifest 摘要与资源、失败、历史和日志 Drawer                    | 列表摘要省略资源条目，页面已按 exact buildRunId 自动读取详情，不把摘要空数组当作零制品。                     |
| 预发部署   | Done         | exact DeploymentRun、环境/目标、完整 Manifest、冻结阶段、工作负载/入口真实空态、失败、历史与日志 | 当前既有运行早于 workload/target/probe 冻结模型；缺失字段保持不可用，不补造组件、入口通过或 run-level 恢复。 |
| 预发验证   | Done         | 四项真实检查、对象、来源、块级时间、专用证据 Drawer                                              | 后端当前运行未写入四个结构化验证块或块级时间，页面已如实显示不可用，不在前端补造。                           |
| 生产检查   | Done（本地） | 独立 Production Preview、入口/TLS、组件、审批、并发、修订与 D01-D20                              | parity v29 实际展示 19/19 通过；外部 Production Ready 签收未包含在本地结论。                                 |
| 生产部署   | Done（本地） | 精确 Preview/Confirm；当前 Run、审批审计、DeploymentRun、失败、日志、只读恢复边界                | parity v29 完成 P03 复核、ReleaseRun、OperationApproval 和 DeploymentRun；未授权能力保持隐藏。               |
| 发布后验证 | Done（本地） | 六项独立真实检查、当前生产版本、精确 Run、证据时间和专用 Drawer                                  | 桌面与 390px 真实页面同时验收 `1 / 1` 和 `6 / 6`。                                                           |
| 完成确认   | Done（本地） | 精确完成记录、当前版本、三类时间、六项验证、DeploymentRun 与项目审计链接                         | parity v29 真实完成页与 DeploymentRun 深链 Drawer 已验收；审计查询边界保持如实。                             |

### 5.6 项目配置共同框架

**已经完成**

- 当前环境使用直接下拉，并只读取项目已有环境。
- 已拆分版本、部署目标、资源绑定、变量与密钥、访问权限、验证与监控、域名与入口七个子区。
- URL 保留 `env` 与 `tab`/`section` 状态，刷新可恢复。
- 左侧子区导航、右侧读态/表格与共享修订区已统一；390px 使用环境 Select + 配置类型 Select。
- 所有写操作进入 Modal/Drawer/ConfirmDialog，页面内只保留读态、筛选、环境切换和对象级查看操作。
- 域名子区复用真实 Site/TLS/DNS/探测与 EnvironmentConfigRevision，不创建第二套状态。

**需要修改**：无本地项；七个子区的状态、写入边界、URL、桌面与 390px 已完成证据闭环。

#### 版本

- Done：真实当前版本、候选、来源、状态、证据、切换禁用原因和条件式恢复闭环已经完成；历史旧名称仍按兼容事实显示，不以候选伪造当前版本。

#### 部署目标

- Done：真实环境级 binding、可部署 active service/ports、Provider、路径/targetRef、Server、连接/绑定检查、共享范围、指纹、阻断影响和 Modal/Overflow/ConfirmDialog 动作层级已经完成。

#### 资源绑定

- Done：当前不可变修订的资源引用、来源组件、绑定实例/方式、共享隔离、生命周期、连接探针与校验已经表格化；唯一编辑入口进入 Modal 并由共享修订闭环提交，项目页不创建或释放资源。

#### 变量与密钥

- Done：主体只读当前草稿/不可变修订的普通变量、Secret 引用与资源注入；唯一编辑入口位于子区 Header，新增/编辑/删除、`.env` 导入、Secret 映射、需求建议和跨环境 CAS 复用均在 Modal 内，并由共享修订 Diff 闭环提交。
- 真相边界：真实 Production R1 当前没有变量、Secret 或资源注入，页面保持空态；Secret 不展示明文，跨环境复制未执行真实写入。

#### 访问权限

- Done：策略表按当前修订与真实 catalog 展示名称、Effect、Action、Category、环境对象和生效状态；唯一配置入口进入 Modal，页面正文无 Checkbox，访问策略与操作审批使用两个明确深链。
- 真相边界：当前环境没有可引用附加策略，故浏览器展示默认团队角色与发布审批仍生效的真实空态，不构造策略行或审批状态。

#### 验证与监控

- Done（本地内容级闭环）：已建立健康检查、日志与告警目的地、DNS/TLS/HTTP 入口探测的真实证据表，以及独立编辑 Modal。
- 真相边界：配置只来自当前环境不可变修订的 `observabilitySnapshot`；入口目标来自项目 Site；运行结果只接受环境、域名和时间均可精确归属的 `DeploymentRun.result.siteProbe`。
- 后端真实缺口：当前没有通用健康检查结果、日志/指标目的地运行状态的统一读模型；现有本地项目也没有可精确归属到该生产 Site 的 `siteProbe` 运行证据，因此页面如实显示“当前不可用/暂无证据”，未补演示数据。
- 实现位置：`settings-verification-evidence.model.ts`、`settings-site-probe-evidence.model.ts`、`settings-verification-evidence-table.tsx`、`settings-env-verification-tab.tsx`。
- 测试证据：`pmc036-focused-tests-rerun-20260827-214909.log`、`pmc036-web-typecheck-rerun-20260827-214909.log`、`pmc036-i18n-20260827-214758.log`、`pmc036-web-build-20260827-214917.log`。
- PMC036 验收条件（已完成）：
  1. 已配置规则只读取环境配置修订中的 `observabilitySnapshot`，缺少规则定义时明确显示“未配置”，不从 profile 名称推导通过状态。
  2. 入口探测只读取项目 Site 的 TLS/routeSwitch 与 DeploymentRun `result.siteProbe` 持久化证据；每条展示目标对象、真实结论、最近时间和证据入口，缺少结果时显示“暂无证据”。
  3. 健康检查、日志与指标目的地只展示 API/模型真实提供的配置；当前后端没有通用健康结果读模型时显示“当前不可用”，并记录为真实能力缺口。
  4. 编辑继续使用 Modal，并通过统一配置修订审阅/提交链写入；页面主体保持只读，一个子区只保留一个主要编辑入口。
  5. 定向模型/组件测试、Web type-check、i18n、build、桌面与 390px 浏览器交互及截图齐全后，PMC036 才可标记 Done。

### 5.7 域名与入口

**已经完成**

- 独立项目 Tab 和环境筛选。
- 数据来自真实 Site API；添加/编辑使用项目上下文三步 Modal，删除使用 ConfirmDialog。
- 生产环境无入口时已有项目/环境上下文阻断。
- 环境选择连续保存在 URL；真实 Site 引用的活动环境不会因初始化统计缺失而从筛选器消失。
- 表格、Overflow、证据 Drawer、部分保存重试、Modal 内 Select 和 390px Drawer 已完成运行态闭环。

**PMC040 / PMC041 本地内容级闭环**

- 表格已对齐域名/别名、环境、真实目标组件/路径/端口或 runtime target、TLS、DNS/探测、状态和操作；没有证据的字段保持“暂无证据/—”。
- Production 无 Site 时只从当前路由修订或 active component/ports 展示缺口事实，两者均不存在时明确无可推导证据；当前真实 Production 有 Site，未为截图删除。
- 添加/编辑继续使用锁定项目环境的三步 Modal；详情使用 Drawer；单行只直接查看详情，编辑/删除在 Overflow，危险删除保留 ConfirmDialog。

PMC041 验收条件（已完成）：

1. 项目与环境来自当前项目工作台上下文；环境切换继续只改变查看范围，新增/编辑流程内项目与环境不可改写，URL 保留 `environmentId`。
2. 新增流程按“组件/路径/端口 → 域名/TLS → DNS 与配置预览”三步组织；组件和端口只来自当前环境活跃 `ApplicationService`，路径和 TLS 意图写入新的 `EnvironmentConfigRevision.routeSnapshot.entries`，Site 字段只写 `CreateSiteDto/UpdateSiteDto` 支持的字段。
3. 新增提交真实串联 `POST /sites`、`PUT /applications/:applicationId/services/:serviceId` 和 `POST /project-environments/:environmentId/config-revisions`；若后续步骤失败，保留已完成步骤与 Site id，明确显示部分完成状态并允许继续重试，不重复创建 Site。
4. 编辑已有入口时复用已绑定服务；后端不支持清空/迁移 `ApplicationService.siteId`，因此不伪造“更换组件”能力。TLS 只展示路由修订意图与 Site/探针真实观测，不再把未被 Site CRUD 接收的 TLS 字段作为保存成功。
5. 表格只保留“查看详情”直接动作，编辑/删除收进 Overflow；删除继续使用 ConfirmDialog。配置计划、DNS、TLS、routeSwitch 与精确域名匹配的 `DeploymentRun.result.siteProbe` 收敛到右侧 Drawer。
6. 定向模型/组件测试、Web/API type-check、i18n、build、桌面与 390px 浏览器交互及截图齐全后，PMC041 才可标记 Done；没有真实探测结果时保持“暂无证据”。

### 5.8 部署记录

**已经完成**

- 独立项目 Tab。
- 列表读取真实 `GET /deployments/runs?projectId=...`。
- 版本通过 ReleaseOrder 关联，环境、状态、耗时、发起人来自真实运行。
- 已有查看证据入口。

**PMC042 / PMC043 本地内容级闭环**

- 列表使用服务端 `skip/take` 和 look-ahead 分页，默认跨页优先需关注的 queued/running/blocked/failed，显式状态筛选按最近时间；页面没有“最近 N 次”不实文案。
- 环境、真实状态、发布/版本、起止时间筛选均进入 API；表格展示发布/阶段关联、失败摘要或执行轨迹、耗时、发起人和 runId 证据入口。
- 证据 Drawer 已拆成概览、阶段、日志、验证、恢复与审计五区；活跃运行轮询，终态停止，深链、刷新、关闭和筛选状态保持正确。

PMC037 验收条件（已完成）：

1. 创建配置修订前必须展示锁定的目标环境、包含普通变量/密钥/资源完整属性/访问策略语义/路由目标与 TLS/DNS/代理/验证配置的完整 Diff、每类变更的真实影响、阻断项和必填变更原因。
2. `POST /project-environments/:id/config-revisions` 必须继续在同一 Serializable transaction 中完成不可变修订、环境 current pointer、普通变量镜像与 AuditEvent；响应必须返回本次事务实际创建的审计事件，不允许前端二次按项目列表猜测。
3. 提交成功后 Modal 不立即关闭，进入真实结果态，展示 revision、snapshot hash、创建时间/创建人及 audit event 的 id、状态、风险、时间和摘要；用户明确完成后才关闭。
4. CAS 冲突、权限或后端校验失败时保留草稿与变更原因，在所属 Modal 顶部显示稳定内联错误并允许安全重试，不只依赖瞬时 toast。
5. 普通变量必须纳入共享配置草稿与同一审阅/提交/结果链路，不得以硬编码摘要绕过完整 Diff；版本切换和部署目标继续使用其真实独立 API，不得伪装为 EnvironmentConfigRevision。
6. API/Web 定向测试、type-check、i18n、production build、CodeGraph、scoped diff、Docker 运行态及桌面/390px 浏览器证据齐备后，PMC037 才可标记 Done。

PMC037 完成证据（2026-08-28）：

- **代码与事务模型**：普通变量已并入资源、密钥、策略、路由和验证配置共用的修订草稿与审阅链；完整语义 Diff 覆盖资源共享/风险/影响/环境绑定、策略 effect/actions、路由 DNS/代理/TLS/组件/路径/端口和验证快照。后端把不可变 revision、environment current pointer、普通变量镜像与 `AuditEvent` 保持在同一 Serializable transaction，并把本次实际写入的审计事件随创建响应返回。
- **提交闭环与错误态**：成功后 Modal 保持打开，真实展示 revision、snapshot hash、创建时间/创建人以及审计 id、状态、风险、时间、摘要、动作和目标；用户点击“完成”后才刷新项目并关闭。CAS、权限和校验失败保留草稿及原因，在 Modal 顶部稳定显示错误并允许重试；`expectedCurrentRevisionId: null` 明确表达“期望尚无当前修订”，不再被丢失为未启用 CAS。
- **真实 API 能力边界**：环境版本切换和部署目标绑定继续走其各自真实 API，没有伪装成 `EnvironmentConfigRevision`。空 `{}` 验证快照保持“未配置”语义，部分或非法快照仍拒绝；这不会制造健康检查或验证通过证据。
- **测试、类型与构建**：API 定向测试、Web 定向测试、API/Web type-check、i18n、API build、Web build 分别通过 `pmc037-api-focused-tests-final-20260828-011353.log`、`pmc037-web-focused-tests-final-20260828-011353.log`、`pmc037-api-typecheck-closure-20260828-011353.log`、`pmc037-web-typecheck-closure-20260828-011353.log`、`pmc037-i18n-closure-20260828-011543.log`、`pmc037-api-build-after-runtime-fixes-20260828-005749.log`、`pmc037-web-build-responsive-20260828-010958.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc037/svton/`。
- **Docker 与真实运行态**：API/Web 重建通过 `pmc037-compose-api-web-after-runtime-fixes-20260828-005830.log`、`pmc037-compose-web-result-persistence-20260828-010425.log`、`pmc037-compose-web-responsive-20260828-011033.log`。真实 development 环境先创建 R1，再用 R1 前打开的旧审阅提交触发 HTTP 409，确认草稿/原因/重试入口均保留；随后 R3 成功结果在刷新前持续可见，点击“完成”后才关闭并刷新。R4 清理临时变量后 API 复核 `currentRevision=4`、`plainVariables={}`，没有遗留验收配置。
- **审计响应证据**：R3 hash `9d8797146bf55726a07f6efa10aa798eda1a56bbebe85fd8210be6e73f1d53fc`，audit id `cmtbrz3f4000d6ikvj6tuim57` 精确指向 revision `cmtbrz3ey000b6ikv0m49yp5f`；清理用 R4 hash `dbd23f7ad6e8b2fe23ac0dcab860819f54c55f07089b94c8d5b69c1c63f7af57`，audit id `cmtbs0f14001e6ikvus2bolfp` 精确指向 revision `cmtbs0f0x001c6ikv7rmp2djw`，两次状态均为 `completed`。
- **浏览器与截图**：桌面审阅、真实 CAS 错误、真实 R3 结果及 390px 审阅/结果均完成交互验收；移动 Modal 实测 `x=16 / width=358 / right=374`，Diff 使用纵向语义卡片且无页面横向溢出。截图为 `pmc037-config-revision-review-desktop.png`、`pmc037-config-revision-cas-error-desktop.png`、`pmc037-config-revision-result-desktop.png`、`pmc037-config-revision-review-mobile-390.png`、`pmc037-config-revision-result-mobile-390.png`。
- **影响面与差异**：`codegraph affected`、scoped diff 和 `git diff --check` 通过 `pmc037-codegraph-affected-closure-20260828-011550.log`、`pmc037-scoped-diff-20260828-011627.diff`；scoped diff summary 内 `check.exit_code=0`。

PMC043 验收条件（已完成）：

1. Drawer 不再嵌套旧 `DeploymentRunDetails`，拆成“概览 / 阶段 / 日志 / 验证 / 恢复与审计”五个独立内容区；每个内容区只读取精确 run 详情或以 `deploymentRunId` 关联的真实记录。
2. 精确详情 API 同时返回列表所需的 `artifactManifest`、`releaseStageAttempts`、`sourceRun` 和详情所需的 `releaseRun`；从列表打开也必须重新读取精确详情，不能停留在不完整列表投影。
3. 日志区读取 DeploymentRun 持久化 `logs`，并补齐 `GET /logs/streams?deploymentRunId=`、`GET /logs/entries?deploymentRunId=` 的精确过滤；审计区补齐 `GET /audit-events?deploymentRunId=`，禁止仅按项目拉取后在前端猜测归属。
4. 阶段使用 `commandPlan` 与 `result` 中同 key 的真实执行证据；验证仅展示 `healthCheckUrl`、`siteProbe`、`routeSwitch` 等实际结果，缺少时显示“暂无证据”，不从整体成功状态推导验证通过。
5. 恢复、重试、回滚、烟测等写操作只有在后端返回当前用户的 run-specific capability 后才展示；当前详情 API 没有 capability 投影时保持隐藏，并在恢复区明确说明不可用原因。
6. `runId` 深链、关闭返回、刷新、加载错误和轮询闭环：`queued/running/blocked` 每 5 秒刷新详情/日志/审计，`completed/failed/cancelled` 停止；切换 run 时清除旧错误和旧证据，筛选参数保持不变。
7. Web/API type-check、i18n、定向测试、production build、CodeGraph、scoped diff、桌面与 390px 浏览器截图全部有证据后，PMC043 才可标记 Done。

PMC043 完成证据（2026-08-28）：

- **代码与模型**：部署详情仓储统一返回 `DEPLOYMENT_RUN_INCLUDE` 加 `releaseRun`；日志流、日志条目和审计查询 DTO/Service 新增精确 `deploymentRunId` 过滤。前端拆出证据 loader/hook 与五个内容区，不再嵌套旧 `DeploymentRunDetails`；`queued / running / blocked` 轮询，`completed / failed / cancelled` 停止。
- **真实能力边界**：当前详情 API 没有 run-specific capability 投影，恢复、重试、回滚和烟测按钮保持隐藏；真实失败运行只有持久化错误日志、健康目标和一条精确审计事件，没有验证结果或日志流，因此界面分别显示真实日志与“暂无证据”，没有推导通过。
- **API / 测试 / 构建**：API 定向测试、type-check、build 分别通过 `pmc043-api-focused-tests-1-20260828-000535.log`、`pmc043-api-typecheck-1-20260828-000446.log`、`pmc043-api-build-1-20260828-000626.log`；Web 定向测试、type-check、i18n、build 分别通过 `pmc043-web-focused-tests-2-20260828-000615.log`、`pmc043-web-typecheck-2-20260828-000535.log`、`pmc043-i18n-1-20260828-000446.log`、`pmc043-web-build-1-20260828-000626.log`。完整日志位于 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc043/svton/`。
- **运行态与交互**：Docker API/Web 重建通过 `pmc043-compose-api-web-1-20260828-000708.log`。真实失败运行深链 `cmt4j73po006ylmcmji3cnvw6` 验证五个标签、刷新保留当前标签、关闭移除 `runId`、终态 5.5 秒内精确详情请求为 0；真实阻塞运行 `cms5jqsem0058gypm67qvp573` 在 5 秒窗口触发 1 次精确详情刷新。恢复区展示精确 `deployment.queue · queued` 审计事件，且不存在未经授权的恢复类按钮。
- **截图**：`pmc043-deployment-evidence-overview-desktop.png`、`pmc043-deployment-evidence-stages-desktop.png`、`pmc043-deployment-evidence-logs-desktop.png`、`pmc043-deployment-evidence-validation-desktop.png`、`pmc043-deployment-evidence-recovery-audit-desktop.png`、`pmc043-deployment-evidence-mobile-390.png`、`pmc043-deployment-evidence-recovery-audit-mobile-390.png`。390px Drawer 实测 `x=0 / width=390 / right=390`。
- **影响面与差异**：`codegraph affected`、scoped diff 和 `git diff --check` 分别通过 `pmc043-codegraph-affected-closure-20260828-001924.log`、`pmc043-scoped-diff-20260828-001946.diff`、`pmc043-git-diff-check-20260828-001936.log`。

## 6. 真实字段与 API 对齐表

| UI 事实                            | 当前真实来源                                                           | 使用规则                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 项目名、仓库、描述、环境、应用服务 | `GET /projects/:projectId`                                             | 原型只决定表达方式，不替换真实值。                                                                 |
| 默认分支、Commit、组件识别         | Repository Analysis                                                    | 只显示已应用或明确标记待审核的分析结果。                                                           |
| 环境当前版本与候选                 | `GET /projects/:id/delivery/environment-versions`、Delivery Summary    | 生产无当前版本时显示真实空态。                                                                     |
| 发布列表/创建                      | `GET/POST /projects/:id/delivery/releases`                             | 名称/版本优先，数据库 ID 只作为次级标识。                                                          |
| 发布详情                           | `GET /projects/:id/delivery/releases/:releaseOrderId`                  | 一级/二级步骤状态必须来自持久化生命周期和真实运行。                                                |
| 预检 Gate                          | `/gates` 及 evaluation/confirm                                         | 检查结果、阻断和人工确认均保留证据。                                                               |
| 构建                               | `/builds` 与 Manifest/BuildRun                                         | 资源、Digest、日志、时间和失败来自同一 BuildRun。                                                  |
| 预发部署                           | `/staging-deployments`                                                 | 不把“部署成功”自动等同于“预发验证完成”。                                                           |
| 生产部署                           | `/production-preview`、`/production-releases`、production run evidence | 预览、确认和运行分离；生产操作保持审批边界。                                                       |
| 部署目标                           | `GET /project-environments/:id/targets`                                | 组件覆盖、Server、路径、认证只显示真实配置。                                                       |
| 环境修订、资源、Secret、策略、监控 | `/project-environments/:id/config-revisions` 及相关服务                | 写操作形成不可变修订；无字段则显示空态或补 API。                                                   |
| 域名入口                           | Site API / `useSites(projectId)`                                       | 当前真实字段包括 primaryDomain、environment、server、tls、status；DNS/探测没有真实数据时不得伪造。 |
| 部署运行                           | `GET /deployments/runs` + `projectId`                                  | 服务端分页；ReleaseOrder 关联失败时版本显示“—”。                                                   |

## 7. 实施 TODO

### P0：先解决共同外壳和状态真相

- [x] **PMC001 — Header 1:1 重构**：在保留现有 Navbar 的前提下，复原项目 Header 的桌面/移动布局、可用宽度、一个主操作、五个 Tab 和项目警告。
- [x] **PMC002 — 页面 Surface 与密度统一**：连续白底、小阴影、统一圆角、标题节奏、表格行高和最大内容宽度；移除旧灰底 Card 堆叠。
- [x] **PMC003 — 操作层统一**：建立项目模块 Modal/Drawer/ConfirmDialog 使用矩阵，把所有设置写操作迁出页面内编辑。
- [x] **PMC004 — 表格与状态组件统一**：项目五个入口、六类设置和八个发布步骤统一表头、空态、错误、加载、状态 Tag、行操作和 Overflow。
- [x] **PMC005 — 警告与修复动作统一**：项目、环境、阶段、步骤四层分别绑定自己的警告；去除重复与模糊动作。
- [x] **PMC006 — 发布生命周期真相修正**：以预发验证、生产 DeploymentRun、发布后验证的真实证据控制一级步骤可用性；修复 `stagingDone` 近似推导。
- [x] **PMC007 — 移动端基础收口**：Header、一级步骤、二级步骤、表格和 Drawer 在 390px 可读；所有关键点击目标至少 44px。

### P0：发布详情内容级重构

- [x] **PMC010 — 发布详情 Header 与一级箭头精修**：标题/元信息/状态、箭头边界、色阶、Focus 与移动端同状态对照通过。
- [x] **PMC011 — 预检步骤重构**：真实 Gate 检查表、治理证据、阻断影响、修复动作和证据 Drawer。
- [x] **PMC012 — 构建步骤重构**：真实构建资源、Manifest、制品摘要、时间、历史、失败和日志 Drawer。
- [x] **PMC013 — 预发部署步骤重构**：目标、组件、Manifest、运行阶段、入口、失败恢复、历史与日志。
- [x] **PMC014 — 预发验证独立实现**：不再复用 Deploy Panel；建立检查、结果、对象、证据时间和证据 Drawer。
- [x] **PMC015 — 生产检查独立实现**：不再复用 Preflight Panel；建立生产入口、TLS、目标、审批、并发、修订检查。
- [x] **PMC016 — 生产部署步骤重构**：真实 Preview/Confirm/Run，审批、运行、失败和恢复闭环。
- [x] **PMC017 — 发布后验证独立实现**：生产健康、入口、版本/Manifest 一致性和失败阻断。
- [x] **PMC018 — 完成确认独立实现**：最终版本、Manifest、DeploymentRun、验证、时间和审计链接。
- [x] **PMC019 — 发布输入与公共事实收口**：只在发布详情页出现一次，减少重复 Card，并保持与所有步骤同一真实来源。

### P1：项目信息、列表与创建

- [x] **PMC020 — 项目信息三段式复原**：基本事实、环境版本表、组件表完整对齐并保留真实空态。
- [x] **PMC021 — 环境版本与组件操作统一**：切换版本、版本配置、查看组件、仓库分析均使用统一 Modal/Drawer 和返回焦点。
- [x] **PMC022 — 发布列表与创建收口**：人类名称、真实阶段、筛选、行操作、创建校验和错误状态与原型对齐。

### P1：项目配置七个子区

- [x] **PMC030 — 项目配置共同框架重构**：左侧子区、右侧表格/详情、URL 状态和共享修订条统一。
- [x] **PMC031 — 版本子区**：当前版本、候选、来源、环境状态、证据、切换和恢复。
- [x] **PMC032 — 部署目标子区**：组件覆盖、方式、路径、端口、Server、认证、最近检查与动作层级。
- [x] **PMC033 — 资源绑定子区**：表格化绑定事实；新增/编辑迁入 Drawer；删除页面内 Select/Add。
- [x] **PMC034 — 变量与密钥子区**：读态表 + 新增/编辑/导入/Secret/跨环境复用弹层 + Diff 审阅。
- [x] **PMC035 — 访问权限子区**：策略表、适用动作/对象、Effect、选择 Modal 和审批模块深链。
- [x] **PMC036 — 验证与监控子区**：健康检查、入口探测、规则、对象、最近结果、证据和编辑 Modal；缺少后端结果模型时保持真实不可用状态并记录能力缺口。
- [x] **PMC037 — 配置修订提交闭环**：七个子区复用修订预览、变更摘要、影响、原因、确认和审计结果。

### P1：域名与部署

- [x] **PMC040 — 域名表与真实缺口重构**：完整字段、生产缺失入口、真实空态、Overflow 和环境连续性。
- [x] **PMC041 — 域名渐进式操作**：项目上下文 Add/Edit Modal、配置计划与 DNS/TLS/探测 Drawer、删除确认。
- [x] **PMC042 — 部署列表重构**：服务端分页、筛选、运行/失败优先、发布/阶段关联和准确分页文案。
- [x] **PMC043 — 部署证据 Drawer**：概览、阶段、日志、验证、恢复与审计；深链与轮询闭环。

### P2：全量验收与证据

- [x] **PMC050 — 状态矩阵**：每个模块覆盖加载、空、正常、运行中、失败、阻断、禁用、成功和权限不足。
- [x] **PMC051 — 响应式与可访问性**：1440/1024/768/390；键盘、Focus、ARIA、对比度、44px 触控和表格滚动。
- [x] **PMC052 — 真实字段契约测试**：每个原型字段绑定 API/Model；新增字段必须先有后端或明确真实空态。
- [x] **PMC053 — 浏览器 1:1 对照**：同项目、同状态、同视口，把原型与产品截图成对检查 Header、间距、字体、表格、箭头、连接线、警告和弹层。
- [x] **PMC054 — 核心交互 E2E**：创建发布、子步骤切换、各门禁、版本切换、六类设置、域名流程、部署证据深链。
- [x] **PMC055 — 完成口径复核**：逐项关闭 R01-R25 和 PMC001-PMC054；未有截图/API/交互证据的项不得标 Done。
- [x] **PMC056 — 项目配置子区扁平化**：六子区统一原型导航和扁平内容面，消除外层卡片、内部内容卡片与修订卡片的重复嵌套。
- [x] **PMC057 — 部署记录表格局部滚动**：路由内容列和表格表面可收缩；筛选与分页不参与宽表滚动；表格保留可读最小宽度并只在自身视口横向滚动。1440/390px 页面边界、表格实际 `scrollLeft`、测试、构建、容器和截图证据均已完成。
- [x] **PMC058 — 发布步骤紧凑动作区**：把真实状态/阻断原因、历史和当前主操作收敛为同一响应式动作条，消除右侧独占行和说明错位；代码、测试、浏览器与截图证据均已完成。
- [x] **PMC059 — 部署表格剩余高度与内部纵向滚动**：桌面表格填满部署页剩余高度并独立纵向滚动，外层 main 不随数据行增长；其 390px 自然流结论已由 PMC060 的全断点剩余高度与内部横纵滚动取代。代码、测试、浏览器与截图证据均已完成。
- [x] **PMC060 — 项目工作台信息架构与共享 Header 收敛**：一级入口收敛为概览/配置，项目警告归属共享 Header，概览合并项目事实与发布，域名进入配置第七子区，部署记录保留独立深链并在桌面/390px 只于表格视口滚动；代码、API、测试、浏览器与截图证据均已完成。
- [x] **PMC072 — 发布运行信息分层与失败诊断收口**：以预检、构建步骤的“人读结论优先、技术证据按需展开”为基线，预发部署主面只保留状态、对象、影响、时间与下一步；部署历史为高信息列提供稳定宽度，技术 ID / digest 限宽省略并保留完整值；日志与证据按概览、执行记录、日志、技术详情分组；发布页证据/历史 Drawer 统一扩宽并保持 390px 边界；生产检查与生产部署默认只展示决策、阻断、关键对象和可执行动作，完整检查、运行阶段与原始事实进入 Tab。修复 managed-process 停止脚本把僵尸进程组误判为存活的真实故障，并以定向测试、type-check、build、CodeGraph、Docker 运行态及桌面/390px 截图关闭。
  - 失败复现：`cmthffbr900s7hyld2yqbam19` 因旧 PID `291` 已为 `Zs [node] <defunct>`，但旧 `.stop` 的 `kill -0` 仍返回成功，最终产生 `WORKLOAD_START_FAILED`。修复后新运行 `cmthitphs003qofkdux7cnt33` 为 `completed`，Web 进程 PID/PGID `657` 状态 `Ssl`。
  - 静态与测试：API managed-process 定向测试、API/Web type-check 与 build、Web 定向/相关组件测试、i18n 和 Impeccable detector 均通过；完整日志在 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc072/`。
  - 运行与视觉：本地 parity API/Web 健康检查均为 200；预发概要、部署历史、四 Tab 证据抽屉、生产检查、生产部署及 390px 边界截图均位于同一证据目录。这是本地可丢弃 parity 证据，不代表外部生产 Provider 或公网签收。
- [x] **PMC073 — 基础发布模式与项目子页层级收敛**：保留当前页面样式，把发布详情的可见流程收敛为“构建 → 部署”，发布输入只保留版本、来源分支和目标环境；隐藏预检、预发验证、生产检查、生产部署、发布后验证、完成确认及其历史/证据入口，但保留底层能力和数据模型以便后续重新接入。创建发布只要求版本；仓库详情移除托管与可见性、当前 commit；项目配置默认进入部署目标，并只展示部署目标、资源绑定、变量与密钥；访问权限、验证与监控、环境版本、域名暂离主流程。部署目标表只保留 Server、路径、可用状态与编辑能力。项目概览左侧返回项目列表，所有项目子页左侧返回项目概览，项目配置不再显示右上角“项目概览”。服务端启用显式 `basic_v1` 门禁策略，只保留源码可解析、成功组件制品与不可变摘要等最小交付约束；完整治理策略继续保留为可恢复配置。
  - 静态与测试：Web 全量测试、Web/API type-check、Web/API production build、i18n、API 门禁定向测试、CodeGraph sync/affected 与 scoped `git diff --check` 均通过；日志在 `/tmp/codex-tool-runs/svton/project-module-content-closure/pmc073/`。
  - 运行与视觉：使用本地 parity 数据验证创建发布单字段、项目概览/配置返回层级、仓库字段、配置页签与两步发布详情；1440px 与 390px 均通过，390px `scrollWidth === innerWidth`，截图在同目录 `screenshots/`。这是本地验收证据，不代表外部生产 Provider 或公网签收。
  - 最终本地闭环：long goal `devpilot-mvp-release-flow-closure` 从当前工作树创建隔离 runtime `c5-47daa01d-73e487fe`，新建 releaseOrder `cmtkeey2j002rrnztedhofemz`，完成 BuildRun `cmtkeey8w0060rnztniusa5ql`、Manifest `cmtkefp33007mrnzth2c6io3o` 与同 Manifest DeploymentRun `cmtkefp790099rnztkxecyrpl`；目标工作负载 HTTP 200，API/DB/桌面/390px 日志和终态回读一致。Web 214 files / 764 tests、API 428 suites / 2377 tests、两端 type-check/build、i18n、脚本自测、CodeGraph 与差异检查全部通过。销毁后 manifest 记录 `verified_zero_residuals`，容器、网络、卷、镜像和 builder 均无本次运行残留；证据位于 `/tmp/codex-tool-runs/svton/long-goals/devpilot-mvp-release-flow-closure/`。

## 8. 验收证据清单

本轮审计截图位于：

- 实际产品：`apps/devpilot-web/.impeccable/audit-2026-08-27-project-module-todo/A01-A17`
- 当前原型：`apps/devpilot-web/.impeccable/audit-2026-08-27-project-module-todo/P01-P18`

关键成对证据：

| 对照         | 实际产品                          | 原型                            |
| ------------ | --------------------------------- | ------------------------------- |
| 项目信息     | `A02-project-information.png`     | `P01-project-information.png`   |
| 发布列表     | `A01-releases-list.png`           | `P02-releases-list.png`         |
| 发布预检     | `A03-release-draft-preflight.png` | `P04-release-preflight.png`     |
| 构建步骤     | `A04-release-build-step.png`      | `P05-release-build.png`         |
| 项目配置版本 | `A06-settings-version.png`        | `P07-settings-version.png`      |
| 项目配置资源 | `A08-settings-resources.png`      | `P09-settings-resources.png`    |
| 项目配置变量 | `A09-settings-variables.png`      | `P10-settings-variables.png`    |
| 验证与监控   | `A11-settings-verification.png`   | `P12-settings-verification.png` |
| 域名与入口   | `A12-domains-dev.png`             | `P13-domains-production.png`    |
| 部署记录     | `A14-deployments-list.png`        | `P14-deployments-list.png`      |
| 移动项目信息 | `A16-project-mobile.png`          | `P16-project-mobile.png`        |
| 移动发布详情 | `A17-release-mobile.png`          | `P18-release-detail-mobile.png` |

## 9. 当前代码锚点

- 项目 Header：`project-workbench-header.tsx`
- 项目信息：`project-information-panel.tsx`
- 发布列表/创建：`project-delivery-route.tsx`、`release-orders-panel.tsx`
- 独立发布详情：`project-release-detail-route.tsx`、`release-order-detail-panel.tsx`
- 一级/二级步骤：`release-workbench/release-lifecycle-*.tsx|css`
- 旧步骤内容复用点：`release-lifecycle-step-panel.tsx`、`release-lifecycle-active-panel.tsx`
- 项目配置：`project-settings-content.tsx`、`settings/environment-settings-*.tsx`
- 六类设置分发：`settings/settings-env-tab-switch.tsx`
- 域名：`project-domains-route.tsx`、`project-domains-table.tsx`
- 部署记录：`project-deployments-route.tsx`、`project-deployment-runs-table.tsx`
- 真实项目/部署加载：`hooks/use-project-detail.ts`

## 10. 推荐实施顺序

1. PMC001-PMC007：先修共同 Header、Surface、交互层和状态模型。
2. PMC010-PMC019：一次完成发布详情八个二级步骤，禁止再用一个旧面板覆盖多个不同步骤。
3. PMC020-PMC022：收口项目信息与发布列表/创建。
4. PMC030-PMC037：按六类设置逐区完成，保持一套修订提交闭环。
5. PMC040-PMC043：域名和部署记录内容级重构。
6. PMC050-PMC056：真实状态、移动端、可访问性、字段契约、浏览器 1:1 与设置子区扁平化验收。
