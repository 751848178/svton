# Devpilot 项目模块设计稿提交后深度视觉 CR

- 审查基线：`c9e3afcb`（`docs(evaluation): add project module audit and design board`）
- 审查日期：2026-08-26
- 审查对象：OpenPencil 源脚本、`.op` 节点树、F00–F12 共 13 张 PNG、四份研究报告、两份 Devpilot project skill contract
- 结论：**REQUEST CHANGES**。F05/F06/F07 的环境语义已经一致，移动画板也不再复用桌面横向表；但 5 张桌面稿存在系统性操作列裁切/越界，F09/F10 存在真实文字叠压，尚不满足本次 brief 的 P0 验收。

## 1. 审查方法与证据边界

本次不是只读文档或看 OpenPencil 树：逐张以原始导出尺寸查看了 F00–F12，并回查：

1. [`2026-08-26-project-module-redesign.js`](../2026-08-26-project-module-redesign.js) 的 helper、尺寸、角色、字体与每个 frame 调用；
2. [`2026-08-26-project-module-redesign.op`](../2026-08-26-project-module-redesign.op) 的 13 个 root、1,308 个节点、角色与尺寸；节点 ID 无重复；
3. [产品评审与设计 brief](../../research/2026-08-26-product-review-and-design-brief.md)、[代码清单](../../research/2026-08-26-project-code-inventory.md)、[当前视觉审计](../../research/2026-08-26-current-visual-audit.md)、[竞品矩阵](../../research/2026-08-26-competitor-matrix.md)；
4. [Workbench contract](../../../project-skills/devpilot-project-workbench-design/references/workbench-contract.md) 与 [Problem-solution ledger](../../../project-skills/devpilot-product-design-lessons/references/problem-solution-ledger.md)。

静态稿不能证明真实浏览器中的键盘、读屏、200% zoom、焦点回归和权限拒绝路径；本报告只把节点树能证实的角色/尺寸问题写成 confirmed finding，其余保持为验收要求。

## 2. 逐屏视觉结论

| Frame | 实际查看的导出 | 结论 | 逐屏证据 |
|---|---|---|---|
| F00 | [Evidence, Interaction & Data Flow Board](../exports/01-F00%20Evidence,%20Interaction%20&%20Data%20Flow%20Board.png) | 基础通过 | 六段证据链、adopt/reject 和 A/D/S 注释均完整，无裁切；但“44px”仍只是声明，不能替代后续节点/运行态验收。 |
| F01 | [Project Directory / Desktop](../exports/02-F01%20Project%20Directory%20-%20Desktop.png) | **P0 失败** | 表格最右操作区只完整显示“进入项目”，后续动作在右边界被裁切；项目名实际使用 600，而 brief 明确要求当前测试契约的 14/400。 |
| F02 | [Project Directory / Mobile](../exports/03-F02%20Project%20Directory%20-%20Mobile.png) | 有条件通过 | 390px 无横向表格，卡片内主/次动作均在首屏；但 issue 行的“修复 →”不是 button/link 节点，且动作名仍偏泛。 |
| F03 | [Project Information / Desktop](../exports/04-F03%20Project%20Information%20-%20Desktop.png) | **P0 失败** | 组件行右侧“查看变更”被边界裁切；页头“创建发布”与内容区“创建发布单”同时为蓝色 primary。 |
| F04 | [Release Orders / Desktop](../exports/05-F04%20Release%20Orders%20-%20Desktop.png) | **P0 失败** | 操作区“进入发布 / 构建 / 证据”越出 frame，截图只保留局部；状态只有红字无图标；issue 动作“进入发布修复”没有命名真实修复对象。 |
| F05 | [Release Detail / Staging Blocked](../exports/06-F05%20Release%20Detail%20-%20Staging%20Blocked.png) | 视觉主链通过 | header badge、blocker、步骤、禁用 CTA 均为 Staging；原因紧贴禁用 CTA，结论优先于技术证据。次级“查看历史”仍是无角色文本节点。 |
| F06 | [Release Detail / Production Approval](../exports/07-F06%20Release%20Detail%20-%20Production%20Approval.png) | 视觉主链通过 | 画面只出现 Production scope，审批对象、不会创建 run 的影响与主 CTA 一致；但页头创建发布仍与生产确认竞争，且多处内部英文作为用户主文案。 |
| F07 | [Release Detail / Mobile](../exports/08-F07%20Release%20Detail%20-%20Mobile.png) | 有条件通过 | 390px 纵向顺序、禁用原因和三步骤清楚，无横向裁切；移动项目导航缺少“部署记录”，issue“修复 →”仍无 44px 交互节点。 |
| F08 | [Settings Version / Desktop](../exports/09-F08%20Settings%20Version%20-%20Desktop.png) | **P0 失败** | 表格操作文字直接压入右侧 inspector；第二行“切换版本 / 查看变更”互相拥挤；列模型没有 brief 要求的“配置变更”，当前版本仍与候选混在同一表。 |
| F09 | [Settings Version / Mobile](../exports/10-F09%20Settings%20Version%20-%20Mobile.png) | **P0 失败** | 顶部黄色 issue 行的“核对 →”压在“source 与证据”正文上；其余候选列表本身无横向裁切、44px 行动作在首屏。 |
| F10 | [Variables & Secrets / Staged](../exports/11-F10%20Variables%20&%20Secrets%20-%20Staged.png) | **P0 失败** | inspector 的 Collision 文案与“Reload current →”明显重叠；`[STATE/staged]`、`ConfigRevision`、`Collision` 等标注/模型名泄露为用户主文案；Review/Discard 是无角色文本。 |
| F11 | [Domains & Entries / Empty + Ready Row](../exports/12-F11%20Domains%20&%20Entries%20-%20Empty%20+%20Ready%20Row.png) | **P0 失败** | Production 行操作在右边界只剩“编辑”的局部；同屏有 3 个“添加入口”入口；Staging 空态与 Production 表并列却没有清晰 scope control。域名任务流也未承载 DNS 期望记录、复制、验证、传播时间与访问测试。 |
| F12 | [Deployment Evidence / Log Drawer](../exports/13-F12%20Deployment%20Evidence%20-%20Log%20Drawer.png) | 有条件通过 | 失败结论在原始日志前，drawer 几何未越界；但名为 “collapsed disclosure” 的 raw log 实际默认展开，关闭图标只是 20px 裸 icon，日志正文颜色对比不足。 |

## 3. P0 findings

### P0-01 — `simpleRow` 将操作列渲染两次，5 张桌面稿发生确定性越界

- **画板**：F01、F03、F04、F08、F11。
- **视觉证据**：F01/F03/F04/F11 的操作文字被 frame 右边界裁切；F08 的操作文字越过 main 区并覆盖 inspector。
- **代码证据**：脚本第 23 行 `simpleRow()` 先遍历包含最后一个操作占位 cell 的 `cells`，随后在 `actions.length` 分支再次创建 `widths[widths.length - 1]` 的操作 cell。也就是说，header 只占一份操作列，row 却占两份。
- **精确宽度证据**：
  - F01：header widths 合计 `1344`，row 实际 `1344 + 154 = 1498`，body 可用宽约 `1392`；
  - F03：row `1376 + 196 = 1572`，body 可用宽约 `1408`；
  - F04：row `1392 + 272 = 1664`，body 可用宽约 `1408`；
  - F08：row `854 + 168 = 1022`，main 固定 `854`，因此必然压入 inspector；
  - F11：row `1392 + 212 = 1604`，body 可用宽约 `1408`。
- **原因**：这是共用布局 helper 的结构错误，不是 OpenPencil 导出偶发抖动；继续只调某个 frame 的列宽会把缺陷留在其他表。
- **修法**：让 `simpleRow` 只接收 data cells；把 `actionWidth` 独立传入并只渲染一次。header 与 row 共用同一 column model；操作 cell 使用真实 button/link primitive，必要时在三项后加入 44px overflow，而不是扩大行宽。
- **验收**：
  1. 1440×1000 重新导出 F01/F03/F04/F08/F11，右边界无任何字符裁切；
  2. F08 main 保持 854px 时，header/row 总宽均恰好不超过 854px，且 inspector 左边界没有操作文字；
  3. 每行 1–3 项直出，4+ 才出现具名 ellipsis；
  4. 200% zoom/窄断点下改为可读响应式方案，不靠隐藏文本通过。

### P0-02 — 固定 48px `issue()` 没有动作保留区，F09/F10 已产生真实文字叠压

- **画板**：F09、F10；同一 helper 也服务 F01/F02/F04/F05/F06/F07/F08/F11/F12，存在传播风险。
- **视觉证据**：F09“核对 →”覆盖“source 与证据”；F10“Reload current →”覆盖 collision 说明。
- **代码证据**：脚本第 14 行把 issue 固定为 `height: 48`；`copy` 使用 `fill_container`，动作只是末尾普通 text，没有 `minWidth`、换行策略、button role 或 44px target。F10 又把同一横排 issue 放入仅 316px 的 inspector。
- **原因**：桌面全宽 issue 的单行假设被直接复用于 390px mobile 和 316px inspector；自动布局只能在文字与动作间抢空间。
- **修法**：至少拆成 `issueInline`、`issueMobile`、`issueAside` 三种密度边界。全宽版为动作保留固定槽；mobile/aside 允许两行或纵向堆叠，正文 `minWidth: 0` 且完整换行，动作使用 44px button/link 并保持原因—影响—动作的同一容器关系。
- **验收**：
  1. 390px、316px inspector、200% zoom 三种条件下无字符重叠、无截断、无横向 overflow；
  2. action 文案完整可见，命中盒 ≥44×44，节点 role 为 button/link；
  3. cause、impact、action 均能按阅读顺序读出，动作不先于原因；
  4. 重导 F09/F10 后对相同区域做像素级复核。

## 4. P1 findings

### P1-01 — 多类可见动作只是文字/图标，和“44px、键盘可达”的注释相冲突

- **画板**：F01/F03/F04/F08/F11 的 row actions；F02/F07/F09 的 issue actions；F05“查看历史”；F10 Review/Discard；F12 close；所有画板 topbar 的 search/bell。
- **证据**：`.op` 中这些动作多数是普通 `text` 或 `icon_font`；`simpleRow()` 与 `issue()` 都用 `T()` 直接输出动作。F12 close 是 20px `x` icon，未包 `icon-button`。相反，真正的 `button()` 才有 44px 高和 role。
- **原因**：视觉稿把蓝字误当成交互语义；A/D/S 注释声称“44px / focus return”，但节点树不能支持该结论。
- **修法**：所有可操作文案改为 link/button/overflow primitive；icon-only action 用 44×44 `icon-button`、具名 label；row action 在 62px 行内垂直居中，issue action 采用同样 primitive。
- **验收**：自动扫描所有 `[ACTION]`/可点击文案，必须有交互 role、可见 label 或 accessible name、最小 44×44；再运行 keyboard/focus/Escape/回焦验证，未运行前注释标 `[UNRESOLVED]`。

### P1-02 — project header 无条件保留蓝色“创建发布”，导致页面级主动作竞争

- **画板**：F03/F04 最明显；F05/F06/F08/F10/F11 也存在 header primary 与当前任务动作并列。
- **证据**：脚本第 18 行 `projectHeader()` 在所有 desktop frame 无条件调用 `button(..., true)`；F03/F04 内容区再次创建蓝色“创建发布单”，F06/F10/F11 分别又有“确认生产发布”“保存修订”“添加域名入口”。
- **原因**：shell 级默认动作没有根据当前页面的单一决策让位，违反“一页一个 page-level primary”。F04 还是同一创建结果的重复入口。
- **修法**：让 shell 接收 `primaryAction` 槽位和页面上下文；创建页/列表页保留一个创建动作，执行详情/高风险配置页则把当前任务作为唯一 filled primary，跨任务“创建发布”降为普通链接或移入 overflow。
- **验收**：逐张截图只允许一个 filled primary；disabled 主动作仍是当前任务焦点时，原因近场可见，不能用无关蓝色 CTA 抢走默认去向。

### P1-03 — F08 没有落实产品评审已确定的版本信息模型

- **画板**：F08，连带 F09 的移动对应关系。
- **证据**：F08 表头为“版本/名称、状态、Source、证据、操作”，缺少已确定的“配置变更”；顶部只用小 badge 显示当前版本，表内又重复一条 current row。技术证据占据主表列，而 config delta 被放到 inspector。
- **原因**：brief 的 P0-2 要求“当前版本 plain fact strip + 候选表”，并要求桌面主表可扫描配置变更、环境状态和切换动作；当前稿仍把 current/candidate 与 evidence 混在一个列表。
- **修法**：顶部改为 current version fact strip（name + x.y.z + source + runtime state）；表内只列 eligible candidates，列为版本/名称、来源、配置变更、环境状态、操作；BuildRun/approved evidence 进入 inspector 或 overflow。
- **验收**：当前版本不在候选表重复；候选一眼可比较 config delta；切换只有一个主动作，未经批准时禁用且给原因；F09 保持同一字段优先级。

### P1-04 — 移动项目导航静默删除“部署记录”

- **画板**：F07、F09。
- **证据**：截图只有“信息 / 发布 / 配置 / 域名”；脚本第 18 行 mobile 数组硬编码为四项，五个 contract destinations 中的“部署记录”没有入口或 overflow。
- **原因**：用减少导航项解决 390px 宽度，破坏了功能可达性；这不是响应式降噪，而是信息架构缺失。
- **修法**：采用“当前 destination + 具名配置/项目菜单”或四项 + 44px“更多”按钮；菜单必须包含全部五项并清楚标示当前项。
- **验收**：390px 下五个 destination 全部能用键盘/触控到达，焦点可见；不引入横向双滚动。

### P1-05 — 多个状态只靠彩色文字，注释却声称 icon/text/color 已满足

- **画板**：F01 row status、F04“预发受阻”、F08“运行中/可切换”、F10 staged/unchanged/effective、F11 TLS/Site 状态。
- **证据**：这些 table cell 均由 `T()` 输出彩色文字，没有 StatusTag/icon；F04 的注释却写着 `status uses icon/text/color`。
- **原因**：状态对扫描重要，但只用色彩/字重既降低可达性，也让同一产品里的 release step badge 与 table status 语法不一致。
- **修法**：建立 compact `StatusTag`：图标 + 文本 + 语义色，表内不必都加 pill 背景；把动作色与状态色分开。
- **验收**：关闭颜色后仍能区分运行中、可切换、阻断、staged、ready；对比度和 200% zoom 通过后才能把注释改为“verified”。

### P1-06 — F11 同屏重复三个创建入口，环境 scope 与默认动作不清楚

- **画板**：F11。
- **证据**：页头 primary“添加域名入口”、issue 行“添加域名入口 →”、Staging 空态“添加入口”同时出现；下方又直接进入 Production ready table，没有 selector 或“其他环境”语义。
- **原因**：相同 outcome 被复制到三个容器，用户不知道哪一个带 Staging scope；同时展示 Staging empty 和 Production ready 并非错误，但必须明确这是跨环境总览还是当前环境任务。
- **修法**：二选一：
  1. 环境 scoped：显示环境 selector，只渲染 Staging 空态，一个近场 primary；
  2. 跨环境总览：以环境分组，创建动作显式命名“为 Staging 添加入口”，只保留一次，Production row 属于“其他环境”。
- **验收**：同一 scope 只有一个默认创建动作；动作前已确定 environment；返回后列表定位到新 Site；不会创建第二套路由持久化模型。

### P1-07 — F11 没有把竞品调研确定为 P0 的域名任务流带进设计稿

- **画板**：F11。
- **证据**：ready row 只有受控 domain、target、TLS/Site、dry-run 和 actions；缺少竞品矩阵 P0 清单中的 DNS 期望记录/复制、验证状态、传播预期、访问测试/探测，国内区也没有备案/区域/证书前置的承载位置。
- **原因**：当前行只能回答“有一个 Site”，不能回答“要配什么、是否生效、多久生效、如何验证、失败去哪修”。
- **修法**：主表保持紧凑，只展示 domain、environment、target、TLS、DNS/probe coarse state、操作；点击详情打开 task drawer，按“期望记录 → 复制 → 验证 → 传播/重试 → 访问测试”编排，国内条件按区域逐步披露。
- **验收**：至少增加 empty/add flow 与 ready/detail state；每个 verification 状态同行有精确下一步，preview 明确不等于 live sync。

### P1-08 — F12 声称原始证据默认折叠，但画面与节点实际默认展开

- **画板**：F12。
- **证据**：节点名为 `Sanitized raw log / collapsed disclosure`，截图却直接展示四行 raw log，且没有展开/收起控件。
- **原因**：命名和可见状态不一致，使“结论 → 关键证据 → 原始证据按需展开”的信息层级只停留在文案。
- **修法**：默认只显示 disclosure header（可含行数、截断/脱敏状态）；用 44px disclosure button 展开 raw log。若需要展示展开态，另做 `[STATE/expanded]` variant，不要把 expanded 画面命名为 collapsed。
- **验收**：默认 frame 不出现原始日志正文；展开 variant 有有界滚动、Escape/关闭/回焦定义，截断和脱敏边界始终可见。

### P1-09 — 技术模型名与设计标注泄漏进用户主界面，修复动作也不够具体

- **画板**：F03/F04/F05/F06/F08/F10/F12，F10 最严重。
- **证据**：用户 UI 直接出现 `[STATE/staged]`、`Version governance`、`current pointer`、`ConfigRevision`、`Collision`、`Reload current`、`Evidence`、`Approval evidence`；F04 使用“进入发布修复”，F02/F07 使用“修复”。
- **原因**：违背“业务含义先于 backend identifier”和 `对象 + 问题 + 影响。具体动作 →`；`[STATE/*]` 本应是画板/节点标注，不应渲染成产品文案。
- **修法**：把状态标签留在图层名或底部 A/D/S 注释；产品文案改为“有待审阅的配置修订”“版本基线冲突”“重新加载当前版本”“查看技术证据”等；修复动作包含对象和目的地，例如“配置 Staging 入口”。
- **验收**：产品 UI 无 `[STATE/*]`；中文页面主任务不混用未解释英文模型名；每个 repair action 脱离上下文仍能识别对象和结果。

### P1-10 — F12 12px 日志正文颜色对比度不足

- **画板**：F12。
- **证据**：raw log 背景为 `#0F172A`，正文通过 `M()` 使用 `#64748B`；按 WCAG 相对亮度计算对比度约 **3.75:1**，低于 12px 正常文本的 4.5:1。标题 `#E2E8F0` 对同背景约 14.48:1。
- **原因**：为了降低原始证据层级而过度压暗正文；低层级不等于不可读。
- **修法**：正文至少提升到能达到 4.5:1 的中性浅色，并通过字号/折叠而非低对比度降噪。
- **验收**：所有 12px 日志文本对比度 ≥4.5:1；focus、错误和选择态不只靠颜色。

## 5. P2 findings

### P2-01 — F01 项目名字重违反已记录的字段级契约

- **画板**：F01。
- **证据**：brief 和代码清单都明确项目目录名称为 `14/400 + primary`，避免把列表对象伪装成主 CTA；设计源实际在 `simpleRow` 调用中使用 `14/600`。
- **修法**：桌面项目名恢复 14/400 蓝色链接；把 600 留给移动对象名、发布对象、阻断与下一步。
- **验收**：字段级 typography 表与 OpenPencil 节点值一致，不只在说明里写对。

### P2-02 — table helper 不能表达 mono 字段，SHA/key/reference 等排版与注释不一致

- **画板**：F03、F04、F08、F10、F11。
- **证据**：`simpleRow()` 始终调用 `T()`（Noto Sans SC）；因此 `master @ 8e7c465d`、Key、secret/resource reference、path 等并未使用 brief 要求的 11–12px mono。只有显式 `M()` 的区域才真正 mono。
- **修法**：cell schema 增加 `kind: text | mono | status | action`，mono 统一由 `M()`/mono token 生成，完整值仍进入 copy/disclosure。
- **验收**：逐字段抽查 SHA、Run ID、env key、reference、path、log 均为 mono，URL/时间/普通说明不被误加粗。

### P2-03 — F10 变量表缺少竞品清单中的运营辅助事实

- **画板**：F10。
- **证据**：当前只有 Key/type/value-reference/source/status；未呈现最近修改人/时间、是否进入当前 release 等帮助判断“这次部署会不会采用该修订”的事实。
- **修法**：不要继续横向加宽表。把“最近修改”和“当前 release 采用状态”放入 selected detail/revision review，并在 staged banner 给一条变更摘要。
- **验收**：用户无需查看 raw revision ID 即可判断改了什么、谁改、何时改、是否会进入下一次部署。

### P2-04 — `.op` 文档级名称缺失，交付识别只依赖文件名

- **证据**：`.op` 为 `0.8.4`，13 个 root/1,308 节点完整，但 document `name` 未设置；root frame 命名正常。
- **修法**：构建器写入稳定 document name，例如 `Devpilot Project Workbench Review — 2026-08-26`。
- **验收**：在 OpenPencil 最近文件、文档标题与导出元数据中能区分版本，不影响 root frame 名称。

## 6. 建议修复顺序

1. 先修共用 `simpleRow()` 与 `issue()`，重导全部 13 张，阻断所有裁切/重叠传播。
2. 修 F08 版本信息模型、F11 scope/域名任务流、F12 disclosure，完成产品 brief 的 P0/P1 闭环。
3. 统一 action primitive、StatusTag、primary slot 与移动导航，再做节点级 44px/role 扫描。
4. 最后收口中文文案、mono/字重、颜色对比与 document metadata。
5. 重新以 1440×1000、390×844、200% zoom、键盘顺序、focus return、color contrast 形成新的可验证证据；未实际运行的项不得在 A/D/S 注释里写成已通过。

## 7. 合入 gate

下一次 CR 至少应同时提供：

- F01/F03/F04/F08/F11 无裁切的新导出；
- F09/F10 无重叠的新导出；
- action/role/hitbox 与 status semantics 的 `.op` 节点扫描结果；
- F08 current fact strip + candidate list、F11 scoped add/detail flow、F12 collapsed + expanded variant；
- 全部 13 frame 的重新打开截图或导出校验；
- 任何未跑的 keyboard/200% zoom/contrast 项继续标 `[UNRESOLVED]`。
