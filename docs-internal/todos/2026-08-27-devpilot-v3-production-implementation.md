# Devpilot V3 原型生产落地验收合同

- 状态：`completed`
- 路由：`todo-plan`
- 冻结日期：2026-08-27
- 实现范围：`apps/devpilot-web` 项目工作台
- 原型范围：`evaluation/design/devpilot-design-system-v3/prototype`
- 对应总任务：`PMD020`

## 1. 目标

把已经确认的 Devpilot Guided Control Plane 原型落地到真实 Devpilot Web，复用真实项目、仓库分析、环境版本、发布单、部署运行、Site、权限与审批数据；不维护第二套设计稿字段，不改写服务端发布真相。

“100% 复原”在本任务中的含义：

1. 同一视口、同一数据状态下，生产页面与原型在信息层级、区域尺寸、间距、颜色、字体层级、圆角、阴影、表格密度、步骤条和弹层形态上无可见 P0/P1/P2 差异。
2. 原型中的核心导航、主操作、页签、列表进入详情、步骤选择、环境选择、弹窗、抽屉、禁用门禁和焦点恢复全部可操作。
3. 页面只展示真实接口字段或 `FIELD_CONTRACT.md` 中可重复计算的派生表达；原型示例值不得写入生产业务逻辑。
4. 真实服务端门禁、权限、审批、并发、制品完整性和审计语义优先于原型静态状态。视觉状态必须由真实响应驱动。

## 2. 真相优先级

发生冲突时按以下顺序裁决：

1. 当前 Devpilot API、类型、服务端状态机和权限边界。
2. `prototype/FIELD_CONTRACT.md` 的字段转换规则。
3. 本验收合同的路由与交互要求。
4. 原型运行页面和冻结截图的视觉构图。

允许的差异只有：真实数据长度造成的换行、真实权限造成的动作缺失、真实状态造成的语义色/禁用态变化，以及生产全局外壳中已经存在且本任务明确要求保留的部分。所有差异都必须有代码或运行证据。

## 3. 冻结视觉基准

### 桌面 1440 × 1024

- 项目信息：`prototype/audit-2026-08-27-field-contract/overview-desktop.png`
- 独立发布详情：`prototype/audit-2026-08-27-field-contract/release-detail-desktop.png`
- 配置构图补充：`project-skills/devpilot-project-workbench-design/assets/approved-project-config.png`

### 移动 390 × 844

- 项目 Header 与内容：`prototype/audit-2026-08-27-field-contract/overview-mobile.png`
- 全局导航：`prototype/audit-2026-08-27-field-contract/mobile-navigation.png`

### 视觉数值

- 页面、导航、Header、内容工作区和静态卡片：`#ffffff`。
- 选中/主操作：沿用原型 cobalt/当前产品 primary；发布步骤使用 `#1677ff` 家族。
- 静态表面阴影：`0 1px 2px rgba(20,24,36,.05), 0 6px 18px rgba(20,24,36,.045)`。
- 静态表面不通过灰底或不同底色建立层级；只使用间距、分隔线和小阴影。
- 控件圆角 7–8px，标准表面 12px；禁用、警告、成功均同时提供文字或图标。
- 1440px 内容对齐、主区域宽度、Header/页签高度和表格行高与原型关键边界相差不超过 2px；字体渲染造成的单字符差异不作为失败。

## 4. 路由与页面层级验收

| 目的地 | 生产路由 | 验收结果 |
| --- | --- | --- |
| 项目信息 | `/projects/:id` | 共享项目 Header + 项目信息内容 |
| 发布 | `/projects/:id/releases` | 共享项目 Header + 发布列表 |
| 项目配置 | `/projects/:id/settings` | 共享项目 Header + 环境选择 + 六类配置 |
| 域名与入口 | `/projects/:id/domains` | 共享项目 Header + 项目/环境锁定的 Site 数据 |
| 部署记录 | `/projects/:id/deployments` | 共享项目 Header + 真实 DeploymentRun 列表 |
| 发布详情 | `/projects/:id/releases/:releaseOrderId` | 独立二级页面，不出现项目 Header、项目页签和项目级告警 |

旧的 `?view=`、`?releaseOrderId=` 和 `/publish/:releaseOrderId` 深链必须显式重定向到新路由；不得静默展示错误页面。

## 5. 全局导航与项目 Header

- 全局 Navbar 的分组、名称、权限过滤、折叠和移动端行为保持当前 `navigation-items.ts` 实现；本任务不复制原型的演示导航代码。
- 项目 Header 100% 采用原型信息结构：面包屑、项目名称、仓库、默认分支、最近分析提交、唯一页面级主操作 `创建发布`。
- 项目标题旁不显示项目 icon。
- Header 下方固定五个项目目的地；活动项使用 primary 文本和 2px 下划线。
- 项目级阻断位于页签下、页面内容上，格式为 `对象 + 问题 + 影响。具体动作 →`。
- 390px 下项目 Header 纵向排列，仓库文本截断但可读取，五个目的地横向滚动，主操作保持可见。

## 6. 字段合同验收

生产实现必须逐项满足 `prototype/FIELD_CONTRACT.md`：

- 项目身份：`Project.name/gitRepo`、真实默认分支、最近分析提交、当前发布策略和生产审批要求。
- 环境版本：由 `currentEnvironmentVersionId` 关联版本项；显示真实版本名、语义版本、来源、有效时间和部署状态。
- 项目组件：名称、工作目录、运行时、端口、服务状态与最近已应用分析；待审核建议不得覆盖当前服务状态。
- 发布列表：名称/版本、来源、生命周期阶段、真实状态、最近执行时间与操作。
- 部署记录：DeploymentRun ID、关联发布版本、环境、状态、时长、执行人和可打开的运行证据。
- 缺失可选字段显示 `—` 或明确空态；不得生成百分比、ETA、负责人、变更数量或恢复路径。

## 7. 各页面内容验收

### 项目信息

- 内容第一项是项目级阻断；基本信息不与阻断混排。
- 基本信息、各环境当前运行版本、已确认项目组件按原型顺序展示。
- 环境版本切换从详情页发起受审计动作；完整版本与技术证据仍归项目配置。
- 仓库分析从 `查看仓库分析` 进入抽屉/独立检查层，不在首页铺开原始 JSON。

### 发布列表

- 使用紧凑表格，发布名称/版本可进入独立详情。
- 操作列最多直接展示三个动作，更多动作进入可访问溢出菜单。
- 构建、部署和技术证据在抽屉中查看，不把列表替换成卡片。

### 项目配置

- 当前环境使用原生下拉选择，只包含已有环境，不打开抽屉、不允许创建环境。
- 左侧配置项固定为 `版本 / 部署目标 / 资源绑定 / 变量与密钥 / 访问权限 / 验证与监控`。
- 版本列表、详情检查栏和操作行为与 approved configuration screen 对齐。
- 修改、绑定、切换、查看证据等业务操作使用现有弹窗/抽屉；普通环境筛选保留下拉交互。

### 域名与入口

- 使用 `GET /sites?projectId&environmentId` 对应真实项目/环境数据。
- 新增、编辑、删除、预览保持现有 Site API、确认和审计行为。
- 生产环境无入口时，告警在该页面内容顶部并提供 `配置生产入口`。

### 部署记录

- 列表由真实 DeploymentRun 数据生成；运行中状态可打开运行详情/日志抽屉。
- 不虚构阶段进度百分比；阶段只来自真实 run/step/evidence。

## 8. 发布详情与状态机验收

- 一级步骤固定为相连箭头：`预发 → 生产 → 验证 → 完成`。
- 选中步骤为 primary blue；已完成未选中为浅蓝；可选未选中为浅灰；禁用态比可选灰再淡一级。
- 预发未完成时生产、验证、完成不可点击；生产未完成时验证、完成不可点击；验证未完成时完成不可点击。
- 禁用步骤使用原生 `disabled`、`aria-disabled`，不可进入 Tab 序列；方向键导航跳过禁用项。
- 预检、构建、预发验证属于预发；生产检查、生产部署属于生产；发布后检查属于验证；结果确认属于完成。
- 二级步骤可点击并切换真实步骤详情；连接线不经过文字，桌面与移动端均无重叠。
- 构建步骤展示真实 ArtifactManifest/构建资源；技术 ID 默认折叠。
- 项目告警不进入详情；阶段告警位于该阶段内容最上方。
- 所有修复、审批、部署、重试、证据和日志操作使用现有弹窗/抽屉，关闭后恢复触发按钮焦点。

## 9. 响应式、可访问性与国际化

- 验收视口：1440 × 1024、1280 × 800、390 × 844。
- 页面级不得横向溢出；宽表格只能在自身容器中横向滚动。
- 键盘覆盖：全局/项目导航、环境选择、表格操作、溢出菜单、一级/二级步骤、弹窗、抽屉。
- Esc 关闭弹层并恢复焦点；焦点环可见；状态不只依靠颜色。
- 中英文消息键完全一致，不在 JSX 中新增不可翻译的生产文案。
- 关键文本和控件满足 WCAG AA；移动端触控目标不小于 44px（紧凑文字链接除外）。

## 10. 设计 QA 通过标准

必须把原型基准图与真实实现截图放入同一比较输入，不能凭代码或记忆判断。

- Fonts/typography、spacing/layout、colors/tokens、image/icon quality、copy/content 五类逐项检查。
- 同一视口、同一状态、同一数据语义进行对比。
- 所有 P0/P1/P2 差异修复后才能通过；P3 可记录为后续微调。
- `apps/devpilot-web/design-qa.md` 必须写明基准、实现截图、视口、状态、对比历史和 `final result: passed`。

## 11. 验证命令与运行证据

所有高输出命令保存到 `/tmp/codex-tool-runs/svton/devpilot-v3-production/`：

1. 受影响组件与模型的 Vitest。
2. `pnpm --filter @svton/devpilot-web type-check`。
3. `pnpm --filter @svton/devpilot-web i18n:check`。
4. `pnpm --filter @svton/devpilot-web build`。
5. `git diff --check` 和所有改动源码 ≤200 行。
6. 浏览器覆盖五个项目目的地、独立发布详情、主要弹层、桌面/移动端、console error。
7. Impeccable detector 只在 UI 完成后运行一次。
8. Product Design `design-qa.md` 最终为 `passed`。

## 12. 明确不改

- 不改变全局导航 IA、名称、路由、权限过滤或全局 Site/资源/运维模块。
- 不改变 API schema、数据库结构、服务端发布状态机、审批/并发/保护规则。
- 不为了匹配截图添加虚假项目、版本、状态、指标或 AI 自动化能力。
- 不覆盖或回退工作树中已有的相关/无关修改；实施仅在确认的项目工作台边界内追加和整合。

## 13. 执行清单

| ID | 状态 | 工作项 | 完成证据 |
| --- | --- | --- | --- |
| DPV3-01 | completed | 冻结验收合同、路由图、字段映射和基准截图 | 本文 + `FIELD_CONTRACT.md` + 基准图 + 源码图 |
| DPV3-02 | completed | 建立共享项目 Header、五目的地导航与新部署/发布详情路由 | 路由/组件测试；1440、1280、390 截图 |
| DPV3-03 | completed | 落地项目信息、发布列表、项目配置、域名与入口、部署记录 | 全量页面测试；真实 Picshare 浏览器交互 |
| DPV3-04 | completed | 落地独立发布详情、四阶段门禁、子步骤与弹层 | 门禁模型、production blocker、roving tab、tabpanel 测试 |
| DPV3-05 | completed | 完成构建、运行态、视觉对照和最终设计 QA | 全量 test/type/i18n/build；finish review `ship`；`design-qa.md: passed`；生产截图 |

## 14. 开始实现的门槛

只有同时满足以下条件才进入 DPV3-02：

- 本合同已落盘。
- 原型基准图和字段合同可读取。
- 当前路由、组件、API hook 和受影响测试已建立源代码地图。
- 工作树已有改动已记录，实施不会覆盖其所有权。

## 15. 开始前源码图

- 入口：`projects/[id]/page.tsx`、`releases/page.tsx`、`settings/page.tsx`、`domains/page.tsx`。
- 当前路由编排：`project-route-host.tsx` 负责信息/设置兼容；`project-delivery-route.tsx` 负责发布列表与查询参数详情；`project-domains-route.tsx` 负责项目 Site。
- 共享项目身份：`project-workbench-header.tsx`，当前只接收名称，需要扩展为真实仓库、分支、提交和五目的地。
- 项目数据：`use-project-detail.ts → GET /projects/:id + GET /deployments/runs?projectId`。
- 仓库数据：`use-repository-analysis.hooks.ts → repository-analysis state/runs/detail`。
- 发布数据：`use-project-delivery-summary.ts + use-release-orders.ts`；详情由 `release-order-detail-panel.tsx` 和 release-workbench 子组件渲染。
- 环境版本：现有 `EnvironmentVersionsResponse` 与设置组件继续持有切换/恢复写路径。
- 域名入口：`project-domains-route.tsx → useSites(projectId) → Site API`，保留项目/环境锁定。
- 受影响测试：`project-route-host.spec.tsx`、`project-workbench-header` 新测试、`release-orders-panel-routing.spec.tsx`、发布工作台阶段/门禁测试、设置与域名现有测试、响应式测试。
- 路由迁移：新增 `/deployments` 和 `/releases/[releaseOrderId]`；旧 query 与 `/publish/[releaseOrderId]` 只负责重定向。
- 结构边界：Header/页签只负责项目身份和导航；页面组件负责真实数据；view model 只做无副作用显示转换；服务端状态不在组件中重新推断。

2026-08-27：DPV3-01 完成，验收合同在任何生产 UI 修改前落盘；进入 DPV3-02。

2026-08-27：DPV3-02～04 完成。真实项目工作台、五个目的地、独立发布详情、四阶段/子步骤、生产检查与部署失败分离、弹层交互和键盘语义均已落地；桌面、1280、390、展开导航与同屏对照证据位于 `apps/devpilot-web/.impeccable/review/`。DPV3-05 等待最终 finish review 与生产设计文档。

2026-08-27：DPV3-05 完成。最终生产截图覆盖 1440×1024、1280×800、390×844、移动子步骤与展开导航；同屏对照关闭全部 P0/P1/P2，第二轮独立 finish review 结论为 `ship` 且 P0～P3 均无。`pnpm --filter @svton/devpilot-web test`、`type-check`、`i18n:check`、`build`、`git diff --check` 通过，所有本任务新增/改动生产源码不超过 200 行；`apps/devpilot-web/design-qa.md` 最终为 `passed`。
