# 项目模块全量审计、竞品研究与设计稿

`routing: specialized — multi-agent research + product review + OpenPencil implementation + adversarial review; one active writer in the shared checkout.`

## Goal

基于当前真实代码与浏览器页面，逐项盘点 Devpilot 项目模块的功能、流程、页面内容、交互和信息层级；对照国内外同类产品形成截图化竞品矩阵；收敛适合 Devpilot 的借鉴方案，并产出含状态、交互和数据流标注的可打开设计稿。

## Scope and constraints

- 覆盖项目列表、项目信息、发布单列表、发布详情、项目配置、域名与入口、部署记录与发布向导。
- 结论必须回指当前代码、当前浏览器截图或竞品官方产品界面/文档；不从旧截图直接推断当前实现。
- 复用仓库 Devpilot 设计规范；不发明后端不存在的字段、状态、操作或修复路径。
- 当前工作区已有未提交的项目页面改动；本任务只提交自己新增或明确修订的审计、设计和证据文件。
- AskUserQuestion 前先由独立 subagent 深挖和对抗审查；可从证据恢复的答案不打扰用户。

## Atomic checklist

| ID | Status | Expected result | Verification |
| --- | --- | --- | --- |
| PMD001 | completed | 建立当前项目模块路由、组件、状态、操作、字段、视觉层级与数据流清单。 | 源码索引 + 当前运行截图逐项对应。 |
| PMD002 | completed | 调研 Vercel、Cloudflare 及国内外同类产品，形成逐项截图化对比矩阵。 | 每个对比主题至少包含 Devpilot 当前截图；竞品截图或明确访问限制。 |
| PMD003 | completed | 产品 subagent 评审审计和竞品结论，收敛可借鉴/不借鉴/需后端支持的方案。 | 逐项 verdict 与真实能力边界。 |
| PMD004 | rejected | 历史 30-frame 产物完成了覆盖与工程状态表达，但用户拒绝其视觉设计；仅保留为审计/规格历史，不再作为当前设计稿。 | 用户反馈 + 独立设计复盘确认：规格板、状态矩阵与产品页面混排，现有页面构图全部重做。 |
| PMD005 | superseded | 历史深度 CR 与 14 Gate 只验证完整性、裁切和语义合同，未能验证成熟产品视觉质量。 | 新一轮视觉门禁以选定方向的同屏参考对比为准，不沿用历史 GO。 |
| PMD006 | superseded | 历史 30 PNG、lint、commit/push/open 作为交付记录保留，但不代表用户接受设计。 | 旧 `.op` 不继续修补；新稿使用独立目录和独立 OpenPencil 文件。 |
| PMD007 | completed | 按用户选定方向重做：方向 1 的主体布局 + 方向 3 的紧凑 Header，完成项目目录、版本配置、生产预检阻断三张高保真代表页。 | 3 个 1440×1024 roots / 855 唯一节点；页面内无 A/D/S、路由、API、状态标本；最终 PNG 原图通过。 |
| PMD008 | completed | 独立视觉设计 subagent 对三张代表页完成对抗性复核并关闭全部阻塞项。 | 19/19 门禁 GO；修复表格串位、Tab 粘连、Header 构图、图标、品牌资产、状态语义与 44px CTA。 |
| PMD009 | completed | 按已通过视觉系统扩展项目概览与核心发布连续任务流，完成最终逐图复核、OpenPencil 打开、精确提交和推送。 | 10 个 1440×1024 根画板；2713 个节点 ID 全部唯一；视觉与领域/流程两路独立终验均 GO、0 blocker。 |

## Evidence log

- 2026-08-26: 已读取仓库 Project Workbench Contract、Problem-Solution Ledger 与 approved configuration image；确认主干存在其他未提交项目页面改动，建立精确提交边界。
- 2026-08-26: 完成 10 个路由入口、240 个可达源码单元和字段级排版规则盘点；完成 23 张当前页面证据与桌面/移动端问题分级。
- 2026-08-26: 完成 Vercel、Cloudflare Pages、Netlify、Railway、Render、Zeabur、EdgeOne Makers 官方证据对比及产品 subagent 收敛。
- 2026-08-26: OpenPencil 0.8.4 原生引擎生成 F00–F12 共 13 个顶层画板、1308 个节点和 13 张 PNG；首次视觉检查已记录待 CR 的操作列与状态文案布局问题。
- 2026-08-26: 深度 CR 与 architect verdict 判定旧 13-root 设计 NO-GO；PMD004 重新打开，原因包括 shell 不真实、F06/F12 数据模型错误、语义动作缺失、移动/inspector 叠压与三条流程缺帧。
- 2026-08-26: 强制修订改为精确 30 roots（F00-A–F00-D、F01–F26），补齐 17-action ledger、四泳道真实模型链、F06 四态、F12 当前 DeploymentRun 及 `/projects/create`、`/projects/new`、`/projects/:id/publish` 全流程；最终完成状态仍以 lint/export/30 PNG 逐图证据为准。
- 2026-08-26: 最终 `.op` 为 0.8.4 / 30 roots / 3757 唯一节点，包含 398 个命名 action、29 个 44px checkbox 与 15 个可见 `✓ 已选` 状态；30 PNG 为 24 张 2880×2000 与 6 张 780×1688。
- 2026-08-26: OpenPencil lint 为 0 error、521 warning、32 info，contrast 与 overflow/clip 均为 0；启发式 warning 分类及接受理由记录于最终验收报告。
- 2026-08-26: 对原路径预览缓存造成的 F21/F26 误报使用新路径和 SHA256 对抗复验，最终 14 Gate 全部 GO；匹配版本 OpenPencil 0.8.4 已打开目标 `.op` 并以 10% 全景展示全部 30 帧。
- 2026-08-26: 用户明确拒绝历史 30-frame 视觉结果；独立设计、产品与竞品视觉复盘一致认定其为“工程说明图”而非成熟页面设计，历史 GO 作废。
- 2026-08-26: 用户选定方向 1 主体，并要求替换为方向 3 Header；已生成单一合成视觉基准，PMD007 开始，旧 30 帧不再增量修补。
- 2026-08-26: V2 三张代表页完成全量空白重建；唯一 canonical `.op`、3 张 1440×1024 PNG、Header 3 真实构图与品牌资产、方向 1 主体均通过独立 19/19 视觉门禁，PMD009 开始扩展连续发布任务。
- 2026-08-26: V2 扩展为 10 张连续画板，覆盖项目目录、版本配置、生产预检、项目概览及“发布列表 → 预发运行 → 生产核对 → 等待审批 → 生产成功 → 同页证据 Drawer”。最终结构为 10 roots / 2713 唯一节点 / 10 张 1440×1024 PNG；视觉与领域/流程对抗审阅均 GO、0 blocker，OpenPencil 0.8.4 已打开唯一 canonical 文件。
