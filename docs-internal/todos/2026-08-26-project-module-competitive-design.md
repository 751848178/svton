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
| PMD004 | completed | 按架构裁决完成 30-frame 单页设计、真实 shell、语义动作、状态矩阵、三条补充流程与移动验收帧。 | `.op` 30 roots / 3757 nodes；30 PNG 串行导出并逐图检查；无硬裁切、叠压或横向溢出。 |
| PMD005 | completed | 深度 CR、对抗审查和架构师 NO-GO 裁决均已落盘；P0/P1/P2 全部修正，并经独立代理按 14 Gate 复验为 GO。 | 两份 CR + architect verdict + final acceptance；不得用旧 13-root 证据替代最终证据。 |
| PMD006 | completed | 完成 lint、结构、30 PNG、原图缓存对抗校验、精确 commit + push，并在 OpenPencil 0.8.4 中以 10% 全景打开全部画板。 | 0 lint error；398 个 action、0 个小于 44px；`00-openpencil-all-frames-open.png`；远端 `origin/master` 对齐最终提交。 |

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
