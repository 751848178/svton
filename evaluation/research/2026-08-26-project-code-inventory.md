# Devpilot 项目模块当前代码全量清单（2026-08-26）

> 审计方式：只读检查当前工作树中的 Next.js 路由、可达组件/Hook、API controller/service 与 Prisma 模型；未运行浏览器。本文是后续视觉截图与竞品对比的代码底稿，不以历史审计文档作为真实性证据。

## 0. 口径、证据等级与覆盖量

- **[source-confirmed] 当前快照**：工作树含未提交修改；本文记录的是 2026-08-26 审计时磁盘上的当前源码，不等同于任一既有 commit。
- **[source-confirmed] 路由覆盖**：10 个项目模块页面入口，其中 8 个渲染页面、2 个兼容重定向；没有独立 deployments 页面，部署记录在 release workbench 的步骤、历史表和 Drawer 中。
- **[source-confirmed] 依赖闭包**：从 10 个 `page.tsx` 递归解析当前相对 import，得到 240 个项目模块源码单元：10 page、153 component、33 hook、42 model/type/util、2 other。该数字表示路由可达的源码闭包，不表示 153 个组件都同时出现在一屏。
- **[source-confirmed] 设计语义**：颜色由 `foreground / muted-foreground / primary / destructive / success / warning / border / ring` 等语义 token 控制，亮暗主题分别赋值；组件中 `text-* / font-* / font-mono / tabular-nums` 是本文所有字体层级结论的唯一依据（`apps/devpilot-web/src/app/globals.css:5-80`，`apps/devpilot-web/tailwind.config.js:1-68`，`packages/ui/tailwind-preset.js:1-70`）。
- **[source-confirmed] 图谱限制**：CodeGraph 索引日期为 2026-08-21，审计时显示 22 added / 26 modified，故它只用于定位候选调用链；所有结论均回到当前源码重新确认。
- **[unresolved] 视觉像素结果**：本子任务按要求未启动浏览器，因此 hover 延时、真实折行、暗色对比度、不同 viewport 的像素级表现和截图证据不在本文确认范围；由视觉审计产物补齐。

## 1. 路由、任务与导航编排总表

| # | URL | 当前任务 | 入口/结果 | 证据 |
|---|---|---|---|---|
| 1 | `/projects` | 搜索、筛选、总览、进入项目/发布/配置/域名 | SSR 首屏拉 100 条，客户端 SWR 接管 | `apps/devpilot-web/src/app/(dashboard)/projects/page.tsx:6-27`；`projects/components/ProjectsContent.tsx:24-66` |
| 2 | `/projects/new` | 从模板/功能/资源配置生成新工程 ZIP | 五步向导；成功下载 ZIP、读取响应头中的项目 ID、回列表 | `projects/new/page.tsx:23-89` |
| 3 | `/projects/create` | 连接已有仓库、解析、人工确认、生成项目基线 | 三步 intake；完成后进入项目详情 | `projects/create/page.tsx:14-104` |
| 4 | `/projects/import` | 兼容旧导入入口 | 服务端重定向 `/projects/create?source=existing` | `projects/import/page.tsx:1-5` |
| 5 | `/projects/[id]` | 项目信息；兼容 query 深链到 release detail | 服务器预取 delivery summary；客户端 route host 决定信息或发布详情 | `projects/[id]/page.tsx:6-24`；`components/project-route-host.tsx:22-163` |
| 6 | `/projects/[id]/releases` | 发布单列表、搜索/筛选、创建、进入发布 workbench | `releaseOrderId` 决定列表/详情；run query 决定 Drawer | `projects/[id]/releases/page.tsx:1-5`；`components/release-orders-panel.tsx:21-148` |
| 7 | `/projects/[id]/settings` | 选择环境并配置版本/目标/资源/变量/访问/验证 | 环境、子区写 URL query；保存生成不可变修订 | `projects/[id]/settings/page.tsx:1-5`；`components/settings/environment-settings-area.tsx:15-77` |
| 8 | `/projects/[id]/domains` | 按环境管理域名/站点、预览 Nginx 变更 | 站点 CRUD + dry-run sync plan | `projects/[id]/domains/page.tsx:1-5`；`components/project-domains-route.tsx:18-179` |
| 9 | `/projects/[id]/publish` | 选预发环境、确认生效配置、创建发布并自动部署预发 | 三步向导；成功跳发布详情 | `projects/[id]/publish/page.tsx:1-127` |
| 10 | `/projects/[id]/publish/[releaseOrderId]` | 兼容旧发布详情链接 | 重定向到 `/projects/[id]?releaseOrderId=…` | `projects/[id]/publish/[releaseOrderId]/page.tsx:1-11` |

### 1.1 当前规范流

`/projects` → `/projects/create`（已有仓库）或 `/projects/new`（生成 ZIP） → `/projects/[id]` 项目信息 → `/projects/[id]/releases?create=true` 创建发布单 → `?releaseOrderId=…&releaseStep=preflight|build|deploy` → 预发部署 → 生产确认。

- **[source-confirmed]** `ProjectWorkbenchHeader` 的主 CTA 是 `/releases?create=true`，配置下拉只有“项目配置”和“域名”；标题为项目名（`text-xl font-semibold`）（`components/project-workbench-header.tsx:20-98`）。
- **[source-confirmed]** `/publish` 仍是可达的另一套快捷编排；项目 delivery summary 可链接它（`components/project-delivery-summary.tsx:64-75`）。它不是 header 主 CTA。
- **[source-confirmed]** 列表行的发布入口仍先写旧 query `?view=releases`，`ProjectRouteHost` 再替换为 `/releases`；用户会经历一次客户端纠正（`projects/components/project-card.tsx:43-65`，`components/project-route-host.tsx:34-56`）。
- **[source-confirmed]** 部署没有独立 route。`deploymentRunId / buildRunId / releaseRunId` 由发布详情导航 Hook 写入 URL，并打开对应历史/日志 Drawer（`hooks/use-release-order-workbench-navigation.ts:20-192`，`utils/release-run-deep-links.utils.ts:1-91`）。

## 2. `/projects` 项目目录

### 2.1 页面内容与字段

1. PageHeader：标题、说明；主动作进入 `/projects/create`。主体最大宽度继承 dashboard，不在本页单独收窄（`ProjectsContent.tsx:24-44`）。
2. 汇总区：**项目总数、在线、待配置**。label 为 `text-xs text-muted-foreground`，数字为 `text-lg font-semibold tabular-nums`；原因只能由结构推出：label 是度量说明，数字是需比较的主值，等宽数字保证列间视觉稳定（`directory-summary.tsx:4-26`）。
3. 工具栏：搜索框、状态 select（全部/在线/待配置）、结果总数；总数带 `aria-live="polite"`（`directory-toolbar.tsx:13-43`）。
4. 表头：项目、状态、组件、线上版本、最新发布时间、用户勾选的环境版本列、操作；`text-xs font-medium uppercase tracking-wide text-muted-foreground`，表格 `min-w-[900px]` 横向滚动（`project-directory-panel.tsx:44-100`）。
5. 项目列：项目名链接特意保持**正常字重** `text-sm text-primary`，副行是项目类型 · 架构，`text-xs muted`；测试明确断言不得 `font-semibold`，所以不能把名称加粗视为遗漏（`project-card.tsx:64-82`，`project-card.spec.tsx:28-29`）。
6. 状态列：纯文字，不用 badge；在线 `emerald-700`，待配置 `amber-700`（`project-card.tsx:83-98`）。
7. 组件列：收窄到 `max-w-[8.5rem]`，默认显示聚合文本，`font-mono text-xs muted`；hover 或 focus-within 展开可移入 tooltip，一行一个 `name[:port]`（`project-card.tsx:99-129`）。
8. 线上版本：生产当前版本 `font-medium`，生产域名 `text-xs muted`。结构上版本是主值、域名是定位副证据（`project-card.tsx:130-142`）。
9. 最新发布时间：分钟级日期，`text-sm muted`（`project-card.tsx:143-147`）。
10. 动态环境列：版本文本、可选 readiness 圆点、完整说明写入 `title`；无版本用 muted；单击到相应环境设置（`project-card.tsx:166-212`）。
11. 操作：若 delivery summary 有 `nextAction`，先出现“立即修复”；之后进入项目、发布、配置、域名。前三项直接展示，多余项进入 overflow menu（`project-card.tsx:39-65`，`components/release-order-actions.tsx:14-181`）。

### 2.2 交互与状态

- hover：行背景 `muted/20`；项目名/版本链接下划线；组件 tooltip 可跨越悬停桥进入（`project-card.tsx:67-129`）。
- focus/keyboard：搜索与 select 使用原生控件；组件 tooltip 支持 `focus-within`，但外层聚合文本本身没有 `tabIndex`，只有单元格内若出现可聚焦子元素时才能触发，纯组件文本的键盘用户无法主动打开该 tooltip——**[source-confirmed risk]**。
- 列设置 popover：点击开关；document `mousedown` 点外关闭；Escape 关闭并把焦点还给触发器；`role="dialog"`，列表可滚动；“全部显示/恢复默认”（`project-directory-panel.tsx:103-204`）。未实现 focus trap——**[source-confirmed risk]**。
- loading：table 区域 `aria-busy`；首屏 skeleton/加载态由 panel 展示。
- error：SSR 错误标记或 SWR 错误展示 ErrorBanner + retry。
- empty：有筛选时解释“无匹配”并提供重置；全空时引导创建项目（`project-directory-empty.tsx:14-38`）。
- 响应式：表格不折成卡片，而是 `overflow-x-auto + min-width`；列设置可隐藏非默认环境列。

### 2.3 数据与写路径

- SSR：`GET:/project-directory?take=100`；401/403 跳登录，其余错误降级给客户端（`projects/page.tsx:6-27`）。
- 客户端：SWR key 含 actor/team；搜索 deferred 后写 `query/status/take=100`；不保留上一页陈旧数据（`hooks/use-projects.ts:9-105`）。
- 后端：`ProjectDirectoryController` 统一 JWT + Authz + `team_member`，service 额外接收 teamId/actorId；查询只返回当前可读项目（`apps/devpilot-api/src/project-directory/project-directory.controller.ts:10-24`）。
- Prisma 主题：Project 的 onboarding、环境、应用服务、站点、发布、运行和审计关系（`apps/devpilot-api/prisma/schema.prisma:725-803`）。

## 3. 创建/导入：两条入口

## 3A. `/projects/create` 已有仓库 Intake

### 3A.1 三步及所有表单字段

**Step 1 连接仓库**（`connect-repository-step.tsx:5-180`）：

- 仓库地址（required、autoFocus）。
- 可见性：公开 / 私有。
- 私有仓库凭据模式：托管凭据 / 本次输入。
- 托管模式：凭据引用 select。
- 本次输入：HTTPS Token / SSH Key；凭据名称、用户名、密码/密钥；敏感 input `autoComplete="off"`。
- 可展开“项目详情”：项目名、默认分支、描述。
- 若已有 draft `projectId`，显示蓝色提示说明草稿会续用。
- 字段 label 统一 `text-sm font-medium`；helper 是 `text-xs font-normal muted`，即输入名是操作对象，提示降级为补充约束（`connect-repository-step.tsx:172-177`）。

**Step 2 分析与确认**：

- 运行状态、当前阶段；queued/running 显示 `role=status`。
- failed/cancelled 显示 `role=alert`、错误原因、重新连接/重试。
- 成功事实：仓库地址、默认分支、选择分支、精确 commit、凭据引用；事实 value `font-medium`（`review-analysis-step.tsx:9-82`）。
- 总览决策：项目类型、架构、包管理器、部署方案，全部 required select；snapshot 后禁用（`repository-intake-overview.tsx:6-40`）。
- 组件决策：接受/编辑/拒绝；名称、路径、类型、build output、run method、警告。组件名用 `<strong>`，其余是属性（`repository-intake-components.tsx:6-55`）。
- 依赖决策：环境/资源要求、requiredBy 数量、接受/拒绝；依赖被拒绝但仍有接受组件依赖时显示 blocker alert，并提供接受依赖或拒绝相关组件（`repository-intake-dependencies.tsx:6-47`）。

**Step 3 基线确认**：

- Staging / Production 默认基线卡。
- 仓库、项目名、分支、commit、snapshot ID/hash。
- 确认后的 overview、组件表、暂缓配置提示。
- label muted，事实 value medium，路径/哈希 mono，组件名 medium（`finalize-baseline-step.tsx:5-109`）。

### 3A.2 流程、异常与恢复

- 页面 stepper 是 `nav > ol`，当前项 `aria-current=step`；移动端隐藏非当前项；微标签 `10px bold tracking`，标题 `text-sm medium`（`project-intake-stepper.tsx:4-60`）。
- “下一步”条件：Step1 submit 会依次创建/续用 draft、连接仓库、启动分析；Step2 必须分析成功且 review 可提交；Step3 finalize 后 `router.push(/projects/:id)`（`projects/create/page.tsx:14-104`）。
- 页脚后退在 mutation 时 disabled；主按钮同时展示 working 文案和 disabled 条件；错误 `role=alert`。
- query `projectId/runId` 支持刷新续跑；恢复服务端状态和 run，凭据只恢复 managed 引用，不恢复 inline secret（`hooks/use-project-intake-resume.ts:24-61`）。
- active run 每 2 秒 polling；连接成功后立即清空内存中的 inline secret（`hooks/use-project-intake.ts:22-164`）。
- review snapshot 锁定后进入 Step3；依赖 blocker 在 client 和 server review 均验证（`hooks/use-repository-intake-review.ts:21-75`）。

### 3A.3 API、模型、权限、审计

| 动作 | API | 结果/边界 |
|---|---|---|
| 凭据选项 | `GET /project-intake/credential-options` | create access 后返回 actor/team 可见引用 |
| 创建草稿 | `POST /project-intake/drafts` | `project.intake.create` |
| 连接仓库 | `POST /project-intake/:projectId/repository` | write action `project.intake.repository.connect` |
| 启动/重试分析 | `POST .../analysis-runs`、`.../:runId/retry` | 分析 run 状态 queued/running/succeeded/failed/cancelled |
| 读/提交 review | `GET .../contract`、`POST .../review` | 服务端生成并冻结 intake contract/snapshot |
| finalize | `POST /project-intake/:projectId/finalize` | 幂等 finalize，建立默认环境/基线并更新 onboarding |

统一 JWT + Authz + `team_member`，每个项目动作再走 `ProjectIntakeAccessService`（`apps/devpilot-api/src/project-intake/project-intake.controller.ts:18-142`）。仓库连接、分析成功/失败、建议应用写 audit event；建议应用与业务修改同 transaction（`repository-analysis/repository-connection-audit.utils.ts:11-30`，`repository-analysis/repository-suggestion-apply.repository.ts:65-95`）。项目 intake 持久模型包括 repository identity revision、review snapshot、finalization（`schema.prisma:976-1060`）。

## 3B. `/projects/new` 生成 ZIP 向导

### 3B.1 五步字段

1. 基本信息：项目名（required，包名格式校验）、组织名（空时回退项目名）、描述、包管理器 radio；通过后才可下一步（`new/step-basic-info.tsx:15-95`）。
2. 子项目：backend/admin/mobile 卡片开关；每项可选 UI lib/hooks；至少一个必选（`new/step-sub-projects.tsx:70-179`）。
3. 功能：服务端 registry 的分类/功能；按已选子项目过滤；每项显示需要的资源和 packages（`new/step-features.tsx:30-172`）。
4. 资源：资源类型、资源、实例、资源池；数据库 engine；每项配置模式 manual/credential/instance/pool/skipped（`new/step-resources.tsx:26-211`）。
5. 预览：基本信息、子项目、数据库、UI libs/hooks、功能、packages、资源配置、文件结构（`new/step-preview.tsx:35-163`）。

### 3B.2 交互、下载与风险

- 顶部 5 步按钮：已完成可回退；未来步骤 disabled；圆点 8×8，当前/完成使用 primary，文本 `text-sm font-medium`（`new/page.tsx:94-186`）。数字按钮没有 `aria-current`/显式可读 label——**[source-confirmed a11y risk]**。
- 子项目与功能卡用可点击 `div` 包裹 Checkbox，而 Checkbox 自身 `onChange={() => {}}`；视觉点击有效，但 checkbox 键盘切换语义与状态处理并不自洽——**[source-confirmed a11y risk]**（`step-sub-projects.tsx:92-154`，`step-features.tsx:72-145`）。
- 功能加载失败、资源 registry 加载失败会展示错误并阻断前进。
- 提交 `POST /projects/generate`，带 sessionStorage idempotency key；响应为 ZIP，同时读取 `X-Project-Id`，下载、清理 attempt key、重置表单、跳项目列表（`new/page.tsx:38-89`）。
- API 统一 `team_member`，再走 self-service write `project.generate`、risk=medium；响应暴露临时下载 URL/过期时间（`apps/devpilot-api/src/generator/generated-project.controller.ts:10-50`）。后续 `/projects/:id/download` 另走 read access 并写 `project.artifact.download` audit（`generator/generator.controller.ts:23-88`）。

## 4. `/projects/[id]` 项目信息

### 4.1 RouteHost 与页面骨架

- query 中若有旧 `tab/view`，先 canonicalize；有 `releaseOrderId` 或 `create=true` 时渲染 delivery；settings mode 渲染设置，否则渲染项目资料（`project-route-host.tsx:22-95`）。
- detail 状态：loading、not found、error/retry；成功才显示 header + 当前 route 内容（`project-route-host.tsx:98-163`）。
- header：返回、项目名、配置下拉、主 CTA“创建发布单”。返回优先 `history.back()`，无 history 回 `/projects`；标题 `text-xl font-semibold`（`project-workbench-header.tsx:20-98`）。

### 4.2 项目信息字段与层级

- “项目信息” section 标题 `text-lg font-semibold`。
- 仓库地址：`font-mono text-xs break-all`，因为代码把它标记为机器标识/长字符串，不是正文。
- 默认分支：`font-medium`。
- 发布策略：`font-medium`，旁有可 hover/focus 的解释 tooltip。
- 发布入口摘要：标题 `text-sm font-semibold`、说明 `text-xs muted`、链接 `text-sm font-medium primary`。
- 组件 table：名称、运行信息、状态、最近变更。服务名 `font-medium`；应用名 `text-xs muted`；分支@SHA `font-mono text-xs`；变更类型 `text-xs font-medium`；摘要 `text-xs muted truncate + title`（`project-information-panel.tsx:16-142`，`project-component-table.tsx:15-89`）。
- 仓库分析：默认折叠在 `<details>`；summary `text-sm medium`，展开后显示连接/重跑、运行历史和建议（`components/tabs/repository-tab.tsx:10-51`）。

### 4.3 数据、写动作和边界

- server 先取 `GET /projects/:id/delivery/summary`；client `useProjectDetail` 取 `/projects/:id`，并按 actor/team scope 取 deployments/webhooks（`[id]/page.tsx:6-24`，`hooks/use-project-detail.ts:21-193`）。
- `/projects/:id` 后端先 project read，再逐类过滤 environments/sites/applications/resources/keys 等子记录，避免父项目可见即自动泄露全部子对象（`apps/devpilot-api/src/project/project.controller.ts:53-205`）。
- 仓库分析读 state/runs/detail，active run 2 秒 poll；写 connect/start/retry/cancel/apply/branch revision（`hooks/use-repository-analysis.hooks.ts:24-168`；`repository-analysis.controller.ts:26-164`）。branch revision 是 `risk=high`；普通仓库写为 medium。
- 发布策略 Hook 支持 `POST standard`，但当前信息面板只读取，不提供保存控件——**[source-confirmed scope boundary]**（`hooks/use-release-policy.ts:7-49`）。

## 5. Releases 列表与详情 workbench（含 deployments）

## 5A. 发布单列表

### 字段与状态

- 顶部项目 header + delivery checkpoint issue；`create=true` 打开创建 Modal（`project-delivery-route.tsx:19-123`）。
- 搜索、状态筛选；状态枚举全部/draft/active/succeeded/failed/canceled；写入 URL（`release-order-list-toolbar.tsx:1-85`）。
- table `min-w-[1040px]`：发布单、状态、来源、阶段、更新时间、操作。
- 行：发布名称 `font-semibold`，版本、短 ID `font-mono text-[11px]`，status tag，branch@shortSHA、当前 stage、更新时间（`release-order-list-row.tsx:13-103`）。
- 操作：详情、构建、部署、证据；最多 3 个直出，其余 overflow（`release-order-actions.tsx:14-181`）。
- loading/error/empty 都有独立状态；错误可 retry；空态 CTA 创建发布单（`release-orders-panel.tsx:21-148`）。

### 创建 Modal

- 字段：发布名称、版本、备注。名称/版本 required；版本必须 canonical `x.y.z`；名称 autoFocus。
- disabled 时同时给出可见原因；取消会 reset；提交成功后关闭并进入详情（`release-order-create-modal.tsx:13-150`）。
- 数据：SWR key 含 actor/team，`GET .../delivery/releases?take=50&query&status`；POST 创建（`hooks/use-release-orders.ts:42-186`）。

## 5B. 发布详情 workbench

### 5B.1 总体编排

`ReleaseOrderDetailPanel` 并行读 detail/evidence/gates/builds/staging；执行 scoped ownership guard；存在 release run 后冻结继续 build（`release-order-detail-panel.tsx:26-94`）。主 workbench 顺序为：

1. Header：返回列表、发布名/版本/状态、错误/备注、来源、最新 run；`h1 text-2xl font-semibold tracking[-0.4px]`，事实 label `text-xs muted`、value `font-medium`、机器值 `font-mono text-xs`（`release-workbench-header.tsx:25-145`）。
2. Decision card：总状态、blocking 原因、gate 数量、下一动作；blocked 用红色左边界，CTA 精确到 gate/修复目的地（`release-workbench-decision-card.tsx:31-138`）。
3. Environment chain：预发/生产是 `tablist`，状态颜色由 waiting/running/succeeded/failed 决定；Arrow/Home/End 支持键盘（`release-environment-chain.tsx:20-125`）。
4. Staging：preflight/build/deploy 三个步骤 + sticky 轮次侧栏 + 日志层（`release-staging-view.tsx:28-194`）。
5. Production：预发证据、artifact/proof、冻结原因、生产确认、生产运行历史（`release-production-view.tsx:50-226`）。

### 5B.2 Preflight

- step bar 是 tablist，点击或 Arrow/Home/End 切换；选中项 underline + semibold。
- 字段：source baseline、config revision、artifact/build/staging evidence，阻断项及修复链接。
- gate summary 打开 gate catalog dialog；发布按钮 disabled 时在按钮旁显示具体 reason，而非只靠 `title`（`release-workbench-steps.tsx:42-186`，`release-step-preflight-panel.tsx:14-91`）。

### 5B.3 Build

- 主面板字段：状态、revision、duration、时间、commit、错误、日志入口；空态明确尚未构建。
- 轮次卡：状态/revision/duration；宽模式加 commit/digest/time；构建动作、历史入口和 disabled reason。事实 value 用 `text-[13px] font-medium`，ID/digest mono（`release-step-build-panel.tsx:20-98`，`release-round-build-card.tsx:33-152`）。
- GET builds 支持 take=50；active 每 5 秒 poll；POST build 有 in-flight guard 和 ownership 检查（`hooks/use-release-builds.ts:20-183`）。

### 5B.4 Deploy / deployment records

- 主面板字段：技术结论、业务结论、manifest digest、时间、错误、日志（`release-step-deploy-panel.tsx:26-109`）。
- 轮次卡：状态/duration、verification/digest/time、部署动作、历史/日志；同样显示禁用原因（`release-round-deploy-card.tsx:32-134`）。
- staging deployment：GET/POST，POST body `{manifestId}`；active 每 5 秒 poll（`hooks/use-release-staging-deployments.ts:20-155`）。
- 生产运行表：run、时间、状态、approval/reviewer、artifact、revision、日志；table `min-w-[820px]`，run 主值 semibold、ID/digest mono、说明 muted（`release-production-run-history.tsx:20-123`）。
- 因此“deployments 模块”在当前项目 UI 的真实边界是 staging/prod run 历史、详情、日志；不是独立列表页。

### 5B.5 Gates、确认与权限

- gate catalog 按 commit/build/deploy/promote phase 分组；每项包含 ID、标题、status、provider、reason、evidence、时间、capability。
- 可手工确认的 gate 要输入 reason（min 3 / max 500）；dialog 内部焦点区域和单一滚动层；提交后刷新 catalog（`release-gate-catalog-dialog.tsx:25-238`，`hooks/use-release-gate-catalog.ts:21-120`）。
- 后端先 resolve gate 的 permission；production gate 走 `assertConfirmProduction`，其余走 `assertBuild`（`apps/devpilot-api/src/release-delivery/release-gate-catalog.controller.ts:22-85`）。
- 发布读 risk=low；创建 medium；构建、预发部署、生产确认、withdraw、环境版本 deploy 都是 high（`release-order-access.service.ts:12-105`）。
- 所有 controller 均 JWT + Authz + `team_member`，再走 control access policy；前端没有在渲染前拿到统一的每动作 capability matrix，故按钮可能先显示、点击后才被 API policy/approval 拒绝——**[source-confirmed boundary]**。

### 5B.6 Production

- production preview：带 manifestId/strategy；确认提交 expectedInputHash + idempotencyKey，避免用户确认前后输入漂移。
- 生产确认 Modal 显示环境、版本、artifact、build source、警告、loading/empty/error；机器字段 mono（`publish/components/production-confirm-modal.tsx:21-159`）。
- 后端 `GET production-preview` 只需 read；`POST production-releases` 必须 high-risk `assertConfirmProduction`（`apps/devpilot-api/src/release-delivery/release-order.controller.ts:139-190`）。
- Environment version 切换/恢复：普通动作走 high-risk deploy；production reconcile/resume/recovery confirm 走 high-risk production confirm（`release-delivery/environment-version.controller.ts:31-136`）。

### 5B.7 Overflow、Drawer、日志与 a11y

- overflow menu portal 支持 ArrowUp/Down、Home/End、Tab 进入、Escape 关闭并回焦、延迟 mouse-leave；menu/menuitem role（`release-order-actions.tsx:48-181`）。
- build/deploy history Drawer 含 loading/error/retry/empty；可从 run 打开第二层日志 Drawer。
- 日志按“人可读事实 / 技术详情”分组；ID/digest 显示短值且 `title` 保留完整值；正文 `role=log`、mono、pre-wrap；仅显示受控截断/脱敏摘要（`release-production-run-log-drawer.tsx:21-125`，`release-build-log-drawer.tsx:20-130`）。
- shared Drawer：portal + mask、Escape、焦点陷阱、关闭后回焦、`aria-modal/labelledby/describedby`、44px close target（`packages/ui/src/Drawer/index.tsx:39-96`）。
- 历史表固定 min-width，窄屏横向滚动；workbench 主栅格在宽屏显示 sticky aside，窄屏堆叠。

## 6. Settings：一个环境选择器 + 六个当前可达配置区

### 6.1 页面和环境选择

- 标题“项目配置”；环境 select 最小宽 16rem；默认优先 production；URL `env` 保存当前环境（`environment-settings-area.tsx:15-77`）。
- 环境无数据时显示 empty；detail 会按 tab 按需加载 governance/targets，避免所有子域一起请求（`environment-settings-detail.tsx:58-204`）。
- 桌面 `lg`：190px 左侧竖 tab + 内容；移动端 select。当前 tab 写 `envTab`；content `role=tabpanel`。
- 六区仅为：**版本、部署目标、资源、变量、访问控制、验证**。代码中 routes/protection 文件仍存在，但 `SettingsEnvTabSwitch` 不 dispatch，不能列为当前第七/第八区（`environment-settings-tablist.tsx:8-15`，`settings-env-tab-switch.tsx:58-115`）。
- 桌面 tablist 支持 ArrowUp/Down/Home/End + roving tabindex；active 为左 primary 边、muted 背景、`font-medium`（`environment-settings-tablist.tsx:20-96`）。

## 6A. 版本

- current version + candidate list；production 切换要求已批准 run（`environment-version-config.tsx:15-85`）。
- list 字段：版本、来源、证据（<2xl 隐藏）、创建时间、状态、操作；详情 panel：名称、状态、版本、release evidence、source、created。
- 版本号是 `text-xl font-semibold`；列表主版本 `font-semibold`，来源/证据 ID mono；说明 muted（`environment-version-list.tsx:25-196`，`environment-version-detail.tsx:11-97`）。
- 布局：table min 640px；xl 双列，窄屏纵向。
- API：`GET /projects/:id/delivery/environment-versions`；`POST .../:environmentId/actions`；生产 reconcile/resume/recovery preview/confirm。读 low，动作 high（`hooks/use-environment-versions.ts:20-142`；`environment-version.controller.ts:42-130`）。

## 6B. 部署目标

- table 字段：服务器、provider、部署路径/targetRef、连接状态、凭据、操作；顶部显示当前 version hash（mono 11px）。
- 服务器名 `font-medium`，role/current 用 microtag；host、path、targetRef mono；online/offline 状态色；credential 显示 configured/missing/invalid；问题在 amber 行内说明 impact（`settings-env-targets-tab.tsx:32-183`，`settings-env-target-rows.tsx:8-165`）。
- 操作：连接检查、调整、解绑；loading/error/empty；add/edit dialog、unbind ConfirmDialog。
- Add/Edit 字段：server、provider（ssh-v1/local-filesystem-v1）、root path 或 targetRef、共享环境开关（`settings-env-target-fields.tsx:7-112`）。
- GET `/project-environments/:id/targets`；POST `/project-environments/:id/servers`；DELETE `.../servers/:serverId`（`hooks/use-environment-deployment-targets.ts:15-43`，`hooks/use-environment-actions.ts:35-141`）。后端先查环境 access scope，再 assert bind/unbind；成功写 server bind/unbind audit（`project-environment-write.controller.ts:130-178`，`project-environment-server-binding.service.ts:231-267`）。

## 6C. 资源

- count chips；当前不可变 revision/hash；六列表：资源需求、来源组件、绑定方式、资源实例、共享与隔离、校验；健康/连接状态。
- 编辑器字段：资源候选（managed resource/resource instance/site/CDN）、组件、env key mapping、确认映射、risk/impact、共享环境 IDs；production 默认 risk=high（`environment-config-resource-editor.tsx:15-187`）。
- disabled reason：未选资源、未选组件、mapping 未确认；无组件显示 amber；旧引用无 component/env mapping 时显示 repair（同文件 `:72-175`）。
- 保存不是直接改实例，而是写入当前环境的 config revision；资源创建/释放明确跳 `/resource-instances`，不在项目页（`settings-env-resources-tab.tsx:27-82`）。
- `useProjectDetail` 另保留 `POST /project-environments/resources/bulk-bind` dryRun/confirm 能力，但当前六区主保存路径是 revision——**[source-confirmed distinction]**（`hooks/use-project-detail.ts:96-185`）。

## 6D. 变量

- 汇总建议 + plain/secret/resource injection table；字段：key、value/reference、source、冲突、action。
- plain：新增、删除、导入 `.env`、保存；key 必须 `^[A-Z_][A-Z0-9_]*$`。
- secret：只选 secret reference，并设置 target env key；显示 effective/draft/current revision；不显示 secret value（`settings-secret-reference-editor.tsx:13-70`）。
- resource injection：由资源 envBindings 注入，不能当 plain 直接覆盖。
- collision 显示 `role=alert`；staged banner 支持 review/discard；复制流程有 Modal。
- plain/secret/resource key 用 mono；表头与帮助 `text-xs muted`；冲突/destructive 用语义色（`settings-env-variables-tab.tsx:32-197`）。
- 保存 POST config revision，body 含 expected current revision（CAS）和 changeSummary（`hooks/use-environment-env-vars.ts:51-107`）。

## 6E. 访问控制

- 蓝色 scope callout；策略列表 checkbox；字段：policy name、effect tag、action 集合；无 policy/未选择均有 empty copy。
- identity key 以 `<b className="font-mono">` 展示；policy name `font-medium`，effect `10px` microtag，说明/动作 `text-xs muted`（`settings-env-access-tab.tsx:18-96`）。
- 仅此 tab 额外 GET access policies；过滤 enabled 和环境/project scope；保存仍归入 config revision 的 `policyReferences`（`hooks/use-environment-config-governance.ts:33-127`）。

## 6F. 验证

- select 只有 `unconfigured` 与 `local_acceptance_v1`；本地验收模式伴随 warning。没有“生产真实验证”选项（`settings-env-verification-tab.tsx:9-46`）。
- 值写入 observability snapshot，随 revision 保存。
- **[source-confirmed product boundary]** 页面文案/控件只承诺 local acceptance，不应在设计稿中扩写成 production verification 已支持。

### 6.2 修订保存、错误和审计

- 顶部/底部 revision bar：change summary 输入、历史开关、保存；disabled 条件为 saving/loading/invalid/noChanges，并展示原因/title；历史字段 R 编号、current、日期、summary、createdBy（`environment-settings-revision-bar.tsx:10-101`）。
- POST `/project-environments/:id/config-revisions` body 同时携带 plain/secret/resource/route/observability/policy + expected current revision；后端 assert create revision（`project-environment-config.controller.ts:20-82`）。
- 数据库是 append-only revision；`@@unique([environmentId, revision])`，环境只保存 current pointer（`schema.prisma:1146-1245`）。
- config revision 创建与 audit 同 transaction；audit metadata 只保留 key/reference，不保留 plain/secret values（`environment-config-revision.service.ts:100-139`）。
- **[source-confirmed risk]** `useEnvironmentConfigGovernance` 暴露 load error，但 `EnvironmentSettingsDetail` 的主渲染未提供与 targets 同等级的常驻 governance ErrorBanner；保存失败依赖 toast/局部反馈，初始 revision 读取失败的恢复路径不够显式（`use-environment-config-governance.ts:33-127`，`environment-settings-detail.tsx:58-204`）。

## 7. Domains / Sites

### 7.1 页面字段与操作

- 环境 select；站点列表按 project 拉取后在 client 按 environment 过滤；production 无站点时显示上下文 issue（`project-domains-route.tsx:18-179`）。
- table `min-w-[900px]`：域名、名称、环境、目标、TLS、状态、操作。
- 域名 `font-medium`，名称 `text-xs muted`；目标显示 server/上游；TLS 显示类型/状态；操作编辑、预览、删除（`project-domains-table.tsx:8-104`）。
- Add（scope 锁定 project/environment）：名称、主域名、aliases、runtime type、server；高级字段按 runtime 展开：
  - static：目录；
  - reverse proxy/runtime：upstream；
  - docker：container name + port；
  - proxy config（含创建链接）、CIDR、WebSocket、TLS、basic auth；
  - TLS type/email。
  （`sites/components/add-site-modal.tsx:19-207`，`sites/components/add-site-basic-fields.component.tsx:27-171`，`sites/components/runtime-config-fields.tsx:17-164`）
- Edit：同类字段但 project/environment 锁定；Delete 用 destructive ConfirmDialog。
- Preview：POST dry-run sync plan；Modal 显示站点、target config path（mono）、warnings、diff、Nginx config (`pre font-mono text-[11px]`)（`project-domains-config-preview.tsx:15-93`）。

### 7.2 状态、轮询和风险

- loading/error/retry/empty 均有；preview 期间相应按钮 disabled。
- `useSites(projectId)` GET sites/servers/projects/environments/proxy configs/sync runs；active sync run 每 5 秒 poll（`sites/hooks/use-sites.ts:27-202`）。当前 domains route 没把 environmentId 传到 server query，而是 client filter——数据虽经后端 record-level read filter，仍多取同项目其它环境站点。
- Add 调 `POST /sites`，Edit 调 `PUT /sites/:id`，Delete 调 DELETE；Preview 调 `POST /sites/:id/sync-plan {dryRun:true}`（`sites/hooks/use-site-actions.ts:23-160`）。
- 后端基础 CRUD 是 team_member + per-site write policy；delete risk=high。sync-plan 额外 `team_admin`；dry-run risk=low，live sync risk=medium（`apps/devpilot-api/src/site/site.controller.ts:17-116`）。
- site model 字段 project/environment/server/proxyConfig/name/domain/aliases/runtime/tls/accessPolicy/status/syncError/dns/routeSwitch（`schema.prisma:458-500`）。同步/回滚写 SiteSyncRun + audit（`site/site-sync-execution.service.ts:118-167`）。
- **[source-confirmed a11y risk]** Add/Edit 使用自绘 overlay/dialog；有 `role=dialog aria-modal labelledby`、点击遮罩关闭，但组件内未实现 Escape、focus trap、打开/关闭回焦；不等同 shared Drawer/Modal 的可访问性（`add-site-modal.tsx:98-207`，`edit-site-modal.tsx:104-174`）。
- **[source-confirmed validation asymmetry]** Add 在提交前调用 `validateSiteEntryForm`，Edit 的提交路径直接 PUT，未调用同一 client validator；最终仍由 DTO/server 兜底，但两套前端即时反馈不一致（`add-site-modal.tsx:45-82`，`edit-site-modal.tsx:61-94`）。

## 8. `/publish` 三步快捷发布向导

### 8.1 步骤和字段

1. 选环境：只允许 staging；环境卡显示名称、role、baseline version/readiness；非 staging 卡 `aria-disabled`；staging baseline 不是恰好 1 个时 warning + 配置链接（`publish/components/publish-environment-step.tsx:28-126`）。
2. 生效配置：表字段 key、value、source、action；plain value 真实显示并 mono；secret 只显示 configured/unknown；resource 显示 injected；冲突 amber 且阻断，unknown secret 是 warning 不阻断（`effective-config-table.tsx:20-171`，`effective-config-conflict-banner.tsx:20-70`）。
3. 确认：环境、配置条数/冲突数、发布名称、canonical 版本、备注；按钮 working/失败/字段无效时 disabled（`publish-confirm-step.tsx:34-142`）。

### 8.2 执行状态机

- `usePublishWizard` 只在选中 1 个 staging 且配置无 conflicts 时允许前进（`hooks/use-publish-wizard.ts:19-75`）。
- 执行严格是：创建发布单 → 触发 build → 5 秒 poll 最多 120 次（10 分钟）→ 取本次成功 manifest → POST staging deployment → succeeded；重试 build/deploy 可复用已有成功 manifest（`hooks/use-publish-submit.ts:1-196`）。
- 成功后跳 `/projects/:id?releaseOrderId=…`；RouteHost 接管为详情（`publish/page.tsx:20-45`）。
- loading 用 `role=status`；失败用 `role=alert`，展示阶段化人话错误与 retry；导航 footer 所有主按钮 `min-h-11`。
- **[source-confirmed information risk]** 确认页“接下来”列出 preflight/build/staging/production 四步，但此 Hook 自动执行到 staging 即结束，production 必须在详情另行确认。当前文字可能让用户误解“发布”会自动上线生产（`publish-confirm-step.tsx:96-105` 对比 `use-publish-submit.ts:105-145`）。

## 9. 字体、字重、颜色：字段级清单与可证理由

> “理由”只描述源码中的结构/语义映射，不推断业务团队主观意图。

| 字段主题 | 当前样式 | 当前出现位置 | 可由源码推出的层级理由 |
|---|---|---|---|
| 页面/工作台主标题 | `text-xl/2xl font-semibold` | 项目 header、发布 workbench header、intake step title | heading 元素 + 最大字号/较重字重，结构上是当前对象/任务标题 |
| section 标题 | `text-lg font-semibold` | 项目信息、组件 | 比 h1 小一级，仍是区域入口 |
| card/步骤标题 | `text-sm font-semibold/medium` | build/deploy 卡、settings subtab | 同一页面内部对象名，不争夺 h1 层级 |
| 项目目录名称 | `text-sm` 正常字重 + primary | 项目行 | 代码注释与测试明确要求正常字重；可点击性由颜色/underline 表达，不靠加粗 |
| 发布名/版本 | `font-semibold`；详情版本可 `text-xl` | release list/detail | 行主对象或当前详情主事实 |
| 表头/事实 label | `text-xs font-medium/muted`，部分 uppercase/tracking | 所有 table/dl | label 是分类辅助；uppercase/tracking 只用于目录表头扫描 |
| 人类可读事实 value | `text-sm font-medium` | 分支、策略、环境、server、结果 | 与 muted label 成对，medium 提升值而非整卡 |
| 机器标识 | `font-mono text-xs`，常 `break-all/truncate + title` | repo、commit、ID、hash、digest、path、env key | 字段在组件中显式标为 mono；小号控制长串密度，title 保存完整值 |
| 数量 | `tabular-nums` + semibold | 项目汇总 | 等宽数字便于跨卡比较；semibold 标出 KPI 主值 |
| 时间/备注/域名副行 | `text-xs/sm muted` | 列表更新时间、说明、副证据 | 是主对象的补充上下文 |
| 状态 | 语义色 / StatusTag | 在线、待配置、run/gate | success/warning/destructive token 传达状态，不统一靠粗体 |
| 阻断标题 | `font-medium` + destructive/amber | alert、gate、conflict | alert 内第一信息；颜色来自语义 token |
| 操作链接 | primary + hover underline | 修复、模块跳转、详情 | primary 是 control token；hover 提供交互反馈 |
| microtag | `text-[10px]/[11px]` + medium/bold | step 序号、effect、短 ID、revision/hash | 只承载短、局部、非正文元信息；不能用于长说明 |
| 日志 | `font-mono text-xs whitespace-pre-wrap` | run log Drawer | 保留技术文本形态并控制密度 |

对应实例：`directory-summary.tsx:21-22`、`project-card.tsx:68-147`、`project-information-panel.tsx:33-136`、`release-workbench-header.tsx:50-130`、`settings-env-access-tab.tsx:39-90`、`release-production-run-log-drawer.tsx:86-115`。

## 10. 全局交互/反馈矩阵

| 维度 | 已确认实现 | 仍需视觉/对抗验证 |
|---|---|---|
| hover | 表格行、链接、环境版本、组件 tooltip、overflow、header dropdown 均有 hover class | tooltip 是否被表格 overflow 裁切；暗色状态色对比 |
| focus | header、settings tabs、Drawer、gate dialog、原生 input/select 明确 focus；部分 tooltip 支持 focus-within | 项目组件 tooltip 触发器不可聚焦；列设置 dialog 无 trap；Add/Edit Site 无 trap |
| click | 路由、筛选、CRUD、dry-run、build/deploy/production confirm 均映射真实 handler/API | 旧 query 到 canonical route 的闪动 |
| keyboard | settings tab、release env/step、overflow、Drawer 支持方向键/Escape/回焦 | generator 卡片与 Checkbox；自绘 site modal；列设置 popover |
| loading | SSR fallback、SWR loading/validating、run polling、submit phase、preview loading | 多请求 workbench 是否造成局部抖动 |
| error | list/detail/release/domain 多数有 ErrorBanner+retry；mutation 有 alert/toast | settings governance 初始 load error 缺常驻恢复动作 |
| empty | 项目、发布、站点、target、policy、history/log 均有空态 | 个别空态 CTA 是否与真实权限一致 |
| disabled | 表单校验、mutation、gate/readiness、生产批准、preview 均使用 disabled；发布/设置多处显示原因 | 少数仅 `title` 或颜色说明的 disabled 需截图确认可见性 |
| overflow | 表格横滚；列表操作 portal menu；日志/长 ID truncate/title/break-all；Drawer 单滚层 | 320/375px 视口下 sticky/portal 定位 |
| drawer/modal | Drawer 有完整 focus/escape；release create/production/gates/confirm 使用共享 primitive | Add/Edit Site 自绘 modal 是明显例外 |
| responsive | 项目/release/site 表 min-width 横滚；settings mobile select；workbench grid 堆叠；intake stepper 移动端只露当前 | 实际断点下信息是否过密、固定宽度是否引起双滚动 |
| a11y | 多数 alert/status/tablist/dialog 标明 role；`aria-live` 结果数；Drawer 标题关系完整 | generator step buttons、clickable div checkbox、tooltip、site modal、popover focus |

## 11. 数据来源、写结果、权限和审计总账

| 子域 | 主要读源 | 主要写源 | 权限/风险 | 持久结果/审计 |
|---|---|---|---|---|
| 项目目录 | `/project-directory` | 无直接写 | team_member + per-project read | 聚合 Project/Environment/Run/Site |
| 生成项目 | registry + local form | `/projects/generate` | self-service write, medium | Project + artifact claim；下载 audit |
| 仓库 intake | intake state/contract/analysis | draft/connect/run/review/finalize | team_member + project read/write；branch revise high | repository identity/revision/snapshot/finalization；连接/分析/应用 audit |
| 项目信息 | `/projects/:id` + delivery summary | repo connect/run/apply；资源 bulk-bind 辅助 | 子对象逐项 read filter；写 medium/high | Project relations、analysis runs、audit |
| 发布 | delivery release/detail/build/deploy/prod/evidence/gates | create/build/staging/production/manual confirm | read low、create medium、执行 high | ReleaseOrder、BuildRun、ArtifactManifest、ReleaseRun、EnvironmentVersion、GateDecision、AuditEvent |
| settings | project environments/revisions/targets/versions/policies | append config revision、bind/unbind server、version action | environment scoped read/write；动作 risk 分级 | current pointer + append-only revision；audit 同 transaction |
| domains | sites/targets/proxy/sync runs | site CRUD、dry-run plan | CRUD team_member scoped；sync team_admin；delete high | Site、SiteSyncRun、audit |
| publish 快捷向导 | environments/effective config | create → build → staging | 沿用 release 三层 access | 与 release workbench 同一模型，不是独立发布模型 |

共同边界：

- controller 第一层为 JWT + Authz + `team_member`；高风险子动作可能再要求 `team_admin` 或 control access policy/operation approval。
- 前端 actor/team 写入 SWR key 并在 actor/team 缺失时不发请求；Hook 还检查响应对象 `projectId/releaseOrderId` ownership（如 `use-release-builds.ts`、`use-production-releases.ts`）。
- `AuditEvent` 统一字段：team/actor/project/environment/site/deployment 等外键、category/action/target/risk/status/summary/metadata/time（`schema.prisma:2929-2975`）。
- 机密边界：inline repo secret 连接后清内存；环境 revision 保存 secret reference，不保存 value；audit metadata key-only；日志由 server presenter 截断/脱敏。前端仍可能显示普通 plain config value，这是当前产品行为，不应把它描述成所有配置均隐藏。

## 12. 当前可达/不可达与遗留边界

### 当前明确可达

- 项目目录、两类创建、项目信息、仓库分析、发布列表/详情、部署记录/日志、settings 六区、domains、publish 三步。
- `project-delivery-summary` 到 `/publish` 的链接使快捷向导仍可达。
- `/projects/[id]?releaseOrderId=…` 与 `/projects/[id]/releases?releaseOrderId=…` 都能进入详情；后者是当前列表侧规范 URL。

### 存在源码但当前路由未 dispatch（不得当成功能清单）

- settings routes/protection subtab；`environment-settings-summary`。
- 旧 project detail tabs：overview/environments/deployments/releases/release-policy/webhooks/resources/settings 中多数组件已被 RouteHost 新分区替代。
- 旧 release create wizard/dialog 及若干旧 deployment panel。当前创建路径是 `release-order-create-modal`，当前部署详情是 release-workbench。
- `project-detail-header` 已不是当前 RouteHost header。

判定方式：从 10 个 route page 的当前 import 闭包反查；同名文件存在但无当前 dispatch/import 的，不纳入现状。相关入口证据：`project-route-host.tsx:22-163`、`settings-env-tab-switch.tsx:58-115`、`project-delivery-route.tsx:19-123`。

## 13. 最大风险与未解析项

### Source-confirmed 风险（可直接进入产品/设计评审）

1. **发布向导承诺边界不一致**：确认页列出 production，但自动状态机只到 staging；可能把“创建发布并部署预发”误解为“自动上线生产”。
2. **权限反馈后置**：高风险按钮没有统一 capability 预检矩阵，部分用户会先看到 CTA，再从 API 获得 forbidden/approval-required；设计稿需明确 unavailable/approval-required 状态。
3. **三处键盘/焦点缺口**：generator clickable div + noop Checkbox；项目组件 tooltip 无可聚焦触发；site Add/Edit modal 无 Escape/focus trap/回焦。
4. **Settings 读取错误恢复不对称**：target 有显式 error，governance initial load 更依赖 toast/局部结果。
5. **前端验证不对称**：site Add 有统一 validator，Edit 没有同一即时校验。
6. **路由兼容层仍暴露**：项目列表把发布动作写成旧 `?view=releases` 再替换，会增加 URL/导航实现复杂度。
7. **环境验证能力真实边界较窄**：当前只有 unconfigured/local acceptance，不能在设计上暗示 production verification 已实现。

### Unresolved（必须由运行时/视觉/产品证据补齐）

1. 153 个路由可达组件中，受真实数据 capability/gate 分支控制的条件节点在当前账号/种子数据下是否全部可触发。
2. 所有状态色在亮/暗主题、WCAG 对比度和色盲模式下是否达标。
3. 表格在 320/375/768/1024/1440px 的真实滚动、sticky、portal、tooltip 遮挡。
4. 浏览器原生 download 对 ZIP 响应头、失败重试、重复 idempotency 的真实体验。
5. API operation approval 被触发时，当前页面实际返回的错误结构能否被每个局部 ErrorBanner 翻译为可执行动作。
6. runtime logs 的 12k 截断/脱敏在 UI 中是否有明确“已截断”标记（代码存在受控摘要，但需真实响应验证）。
7. site/domain 表中的 TLS/DNS/route-switch 各状态在实际数据下的全部文案与组合。

## 14. 后续截图/竞品对比的最小场景矩阵

为保证对比不是只截 happy path，视觉阶段至少应覆盖：

1. 项目目录：有数据、搜索无结果、全空、error、loading、动态环境列、组件 tooltip、overflow menu。
2. Intake：公开仓库、私有托管凭据、inline token/SSH、分析中、失败、依赖冲突、final baseline。
3. 生成向导：5 步、registry loading/error、资源各模式、校验 disabled、ZIP 生成中。
4. 项目信息：仓库已连接/未连接、分析折叠/展开、delivery blocker。
5. Release：空列表、创建 modal 校验、active/succeeded/failed；preflight/build/deploy/production；gate dialog；两层日志 Drawer；approval-required。
6. Settings：六个 tab 各一张；mobile tab select；no revision、dirty、collision、save error、target empty/error、resource mapping repair、local acceptance warning。
7. Domains：production empty issue、add/edit、preview diff/warning/config、delete confirm、sync loading/error。
8. Publish：staging 0/1/多基线、config conflict、unknown secret、create/build/deploy failure retry、成功跳 workbench。
