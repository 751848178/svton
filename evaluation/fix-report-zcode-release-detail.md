# 发布单详情页修复报告（zcode · 2026-08-24）

- 对象：`/projects/cmrwxl1ks000k6enjiclutd5a/releases?releaseOrderId=cmsmzs63q00ek1700clhiytmj`（Picshare · 0.0.1）
- 输入：`evaluation/devpilot-release-detail-pixel-audit-2026-08-24.md`（PX-1~38）、`evaluation/devpilot-release-detail-review-2026-08-24.md`（结构评审 + ROD 返工）、`evaluation/mockups/03-release-list-gates.html`、workbench 契约与产品教训 skill
- 范围：仅 `apps/devpilot-web`（源码 + 测试 + messages）；未改 evaluation 既有报告；无 git 操作
- 验证手段：vitest/jsdom DOM 断言 + ego-browser 真实渲染（localhost:3120，1800×1009 与 1280×800，容器已用最新代码重建）+ getBoundingClientRect/scrollWidth 实测；全程未触发任何真实写操作（生产确认弹窗仅打开取证后点「取消」）

## 0. 返工项（优先）

| 项 | 结论 | 证据 |
|---|---|---|
| ROD-5 / PX-2 raw ISO 时间戳 | **已修** | 根因：后端 reason 文案内嵌 ISO。新建 `utils/release-display.utils.ts` 的 `humanizeGateReason`（ISO → 本地 `YYYY-MM-DD HH:mm`），接入 4 个渲染点：证据区组描述（`release-gate-summary.tsx`）、51 项弹窗原因（`release-gate-phase-section.tsx`）、发布钮禁用原因（`release-action-gate.model.ts`）。线上实测组描述为「证据已于 2026-08-17 17:11 过期，必须重新检查」，全页无 `T09:11` 形态；`release-display.utils.spec.ts` 用原文案做防回归锚点，`release-gate-counts-parity.spec.tsx` 断言 DOM 不含 raw ISO。PX-2（51 项弹窗 C05/C08/D10/D11 的原因文案）经同一清洗层覆盖 |
| ROD-4 回流（部署历史抽屉 raw cuid） | **已修** | `release-staging-evidence-row.tsx` 重写：构建列 `BuildRun #10` 为主 + `cmsn2fy8…`（title 全文），行首 `DeploymentRun cmsn5pyq…`，Manifest 只显短 digest。线上行文本实测 `DeploymentRun cmsn5pyq… local-filesystem BuildRun #10 BuildRun cmsn2fy8… sha256:32bf01d5cd4a…`；DOM 断言 `build-unbounded` 全串不再上屏 |

## 1. P0

| # | 结论 | 修复与证据 |
|---|---|---|
| PX-8 生产确认弹窗 | **已修** | `production-confirm-modal.tsx`：有 snapshot 时渲染环境/版本/制品/构建来源四行差异摘要且确认钮可点（spec：`production-confirm-modal.spec.tsx` 断言四行 + 按钮 enabled + onConfirm 触发）；无 snapshot 时中性空态卡（`productionConfirmSnapshotUnavailable` + loadError 明细）+ 确认钮禁用带常驻原因（`aria-describedby` 指向可见文案）。线上实测（打开取证后点取消）：空态「暂无法生成差异摘要（环境/版本/制品对比不可用），确认按钮已禁用。Production 没有可启动的活动服务」+「无法确认：Production 没有可启动的活动服务」，确认钮 disabled |
| PX-5 操作列被裁出视口 | **已修** | 两张历史表去掉固定 min-width（`w-full table-fixed` + 百分比列），ID/摘要短 ID 化后自然收窄；新建 `ReleaseScrollTable`（overflow-x-auto + 右缘渐隐提示，兜底 PX-25）。线上 1800×1009 实测：部署历史「日志」按钮 right=1731、「部署」right=1763（均 ≤1800），容器 scrollWidth=clientWidth=590 无溢出；构建历史「查看日志」right=1763，scrollWidth=clientWidth=750。jsdom 断言操作列仍为表格末列且按钮在表格内（`release-deploy-history-drawer.spec.tsx`） |
| PX-1 门禁计数 3 vs 5 | **已修**（口径=产品默认值，可调整） | 默认口径：**三处统一取「当前执行阶段决策」**。`buildReleaseGateSummary(catalog, stage)` 新增 stage 参数；步骤 01 证据区区头/组行与预警条同源（staging 决策 → 阻断 3），区头带阶段限定词「预发（Staging）发布准入 · 阻断 3 · 警告 0 · 待确认 0」（线上实测，与 banner「阻断 3」一致）；组行改为聚合能力组全部 MVP 检查、阻断数按该阶段决策 blocker 集合计（真实数据 M03=2+M04=1=3）。说明文案注明口径（`releaseWorkbenchAdvancedChecksSummary` 含 stage 限定）。兜底：阶段决策缺失时回退 build 决策。spec：`release-gate-counts-parity.spec.tsx`（还原真实 staging=3/build=5 数据形态，断言两处同为 3 且不出现 5） |

## 2. P1

| # | 结论 | 修复与证据 |
|---|---|---|
| PX-9 生产文案矛盾 | **已修** | `release-production-view.tsx` 按 `stagingTechnicalConclusion` 动态生成：通过→「已部署并验证通过」，否则中性版「预发环境已完成部署运行（技术验证结论以部署信息为准）…」；空态/等待文案同步中性化（`releaseProductionViewEmptyNeutral` / `releaseRoundProductionWaitingNeutral`）。线上实测文案为中性版 |
| PX-3 raw cuid 六处 | **已修** | ① 面包屑：友好名下不再挂 raw cuid title（`breadcrumbs.tsx`，spec 更新为断言 title 为 null）② 部署日志抽屉标题/字段短 ID（title 全文）③ 部署历史抽屉（见 ROD-4）④ 构建历史表 `#10` 主 + 短 cuid、Manifest 短 digest ⑤ 生产视图制品短哈希、预发验证短 ID ⑥ 51 项弹窗证据列 cuid 折叠（`foldTechnicalIds`）。线上全页文本实测不含 `cmsn2fy8t001v3nfoizc1zlcy`；生产运行表/日志抽屉同步短 ID |
| PX-10 步骤图标 | **已修（真实根因）** | 线上定位：步骤条状态词是 `completed`，而 `FlowNodeIcon` 只认 `done` → 完成步骤落入 CircleNotch（开口圆环）。修复：`completed` 归一为 done 渲染 CheckCircle。线上复测 01/02 图标 path 与链路 done 节点一致（`M173.66,98.34…` 即 CheckCircle），03（current）保持半环；spec `release-flow-nav.shared.spec.tsx` 断言 completed≡done≠current |
| PX-11 时间格式统一 | **已修** | `formatIso` 重写为 `YYYY-MM-DD HH:mm:ss`（去逗号），新增 `formatIsoMinute`；门禁 checkedAt/expiresAt/组行时间改 dayjs-free 统一格式（去 `2026/8/24` 斜杠形态）；日志抽屉「耗时:」半角冒号改「耗时 ·」。线上实测 `2026-08-10 19:37:27` / `2026-08-10 18:05:41` |
| PX-31 raw JSON 证据 | **已修** | 新建 `release-staging-technical-evidence.tsx`：部署地址/制品大小（40824690→38.9MB）/文件权限 0600/Git 执行/三探针状态提为表单项，完整 JSON 折叠进未展开 `<details>`。线上+spec 双证据（`staging-technical-raw-json` 在 details 内且默认收起） |
| PX-18 禁用原因 title-only | **已修** | 「发布」「构建最新代码」「发布到生产」禁用时均渲染常驻可见原因（小字 + `aria-describedby`）。线上实测发布钮下方「部署目标与当前 Provider 不匹配」 |
| PX-12 「目标上下文」 | **已修** | 51 项弹窗能力组列 `check.capabilityId || '—'`（`release-gate-phase-section.tsx`） |
| PX-30 部署历史告警无形态 | **已修** | 改 amber alert 卡片（图标+底色+边框）并补影响说明「因此『发布』与『部署』操作已禁用…」（`releaseWorkbenchDeployGateImpact`） |

## 3. P2

| # | 结论 | 说明 |
|---|---|---|
| PX-4 右栏与步骤详情重复 | **已修** | RoundPanel 接收 selectedStep：查看对应步骤时该侧信息卡压缩同名字段（Commit/摘要/时间/技术部署），只留状态+入口+动作；digest 全场短哈希（`shortDigest` 12 位）。线上实测：step=staging 时部署卡只剩状态行，step=build 时构建卡同理 |
| PX-6 抽屉宽度四档 | **已修** | 统一两档：历史抽屉 800px、日志抽屉 720px（构建/部署/生产日志均 720） |
| PX-7 单行大空白 | **已修** | 部署历史 ≤1 行时抽屉自适应 640px（线上该场景实测容器 590px 内容无溢出） |
| PX-13 徽章体系 | **已修（页面级）** | 新建 `FlowStatusTag`（border-transparent）统一本页徽章为无边框、同高；全站 Tag 策略未动（属 packages/ui，超出本轮边界） |
| PX-14 字段值 11px | **已修** | 右栏 Fact 值统一 `text-[13px] font-medium`（mono 值 text-xs） |
| PX-15 步骤盒 10px | **已修** | 序号 11px、副标题 12px |
| PX-16 阶段卡片状态灰字 | **已修** | 状态按语义着色（done=emerald、blocked=destructive、current=primary） |
| PX-17 无 H1 | **已修** | 页头 h2→h1（线上实测 h1=0.0.1）；步骤区 h3→h2、信息卡 h4→h3 顺移 |
| PX-19 CTA 无按钮感 | **已修** | 预警条「前往基线检查」与「重新检查」改 outline secondary |
| PX-20 日志入口三态 | **已修** | 步骤 02/03 面板与右栏部署卡统一「查看日志」+ outline sm 按钮（新 key `viewReleaseLogs`）；历史表行内保持紧凑「日志」文字链（表格操作列契约） |
| PX-21 弹窗双关闭 | **已修** | footer 仅留「关闭」；ariaCloseLabel 同步 common.close |
| PX-22 组过滤标题 | **已修** | 过滤时标题「{M 码} {组名} · N 项」+ 描述区分；chips 高亮当前过滤组（aria-pressed + 样式） |
| PX-23 cuid break-all | **已修** | 行首短 ID + truncate + title，不再折行 |
| PX-24 徽章折行 | **已修** | 基线卡徽章 `shrink-0 whitespace-nowrap`；1280 实测 3 个「已就绪」徽章 0 折行 |
| PX-25 滚动无提示 | **已修** | `ReleaseScrollTable` 右缘渐隐遮罩（pointer-events-none）；配合 PX-5 去溢出 |
| PX-26 红字无形态 | **已修** | 完整性告警改 destructive alert 卡片；文案见 PX-35 |
| PX-27 空态两种 | **已修（面板统一「暂无」）** | 面板/抽屉字段空值 `releaseWorkbenchValueEmpty`=暂无；表格空 cell 保留「—」（评审允许） |
| PX-28 「执行：部署」 | **已修** | 「当前步骤：03 部署」（线上实测） |
| PX-29 阶段名 4 处重复 | **已修** | meta 删「真实执行阶段」字段（4→3 列）；步骤 03 副标改状态文案「当前步骤」（resolveStateLabel 对阶段名状态回落）；标题徽章与预警条保留（预警条需阶段限定词解释口径，属必要信息非重复） |
| PX-32 错误枚举截断 | **已修** | `buildErrorText`：8 个已知构建 errorCode 映射中文标题（title 保留 `code: message` 原文）；≥1MB 字节数人性化。线上实测「制品含疑似秘密内容」「250MB（262144000 字节）」均在 |
| PX-33 chips 溢出 | **已修** | chips 区 flex-wrap 换行网格 |
| PX-34 红徽章嵌黄底 | **已修** | 预警条 blocked 改中性底 + 左侧红色状态条 + 红色图标（红警示单一来源） |
| PX-35 术语 | **已修 3/4** | 「已按失败关闭」→「已按不通过处理」（线上实测）、「当前 MVP」→「当前版本」、「按需查看阻断能力或全部证据」→含阶段口径的新文案；「该完整阶段能力尚未接入」为后端 reason 文案，前端未改写（见未修项） |
| PX-36 0s 耗时 | **已修** | `formatDuration` 0 秒 → `<1s`；线上实测 #1 行 `<1s` |
| PX-37 环境版本截断 | **已修** | meta 环境版本拆两行（Staging · 0.0.1 / Production · 暂无）；1280 实测两行完整、无横向溢出 |
| PX-38 禁用样式二态 | **已修** | Button 基类 `disabled:opacity-50` 单一禁用语言（两按钮同组件同 token） |

## 4. 结构评审项（第一/二/三章）

| 项 | 结论 |
|---|---|
| 阶段卡片改紧凑切换器 | **已修**：`ReleaseEnvironmentChain` 改一行式分段控件（内容自适应宽、p-1 容器），符合契约「不做两张大摘要卡」 |
| meta 行瘦身 | **已修**：5 → 4 字段（删真实执行阶段；环境版本两行），1280 无截断 |
| 右栏与步骤详情去重 | **已修**：按选中步骤压缩（见 PX-4）；查看当前步骤时右栏让位给状态+动作 |
| 历史抽屉列精简 + 宽度自适应 | **已修**：列短 ID 化 + 去固定宽 + 单行 640px（见 PX-5/7） |
| badge 文案中性化（「证据不可用」→「未采集」等） | **部分未修**：`releaseStagingVerificationUnavailable` 等状态词被多个模型 key 引用且与后端状态枚举对应，改名涉及跨页语义统一（环境版本页/部署记录同用）；本轮仅治理了页面内告警/说明文案。建议后续与后端 reasonCode 一起做状态词表 |
| 阻断与「发布到生产」强绑定 | **维持现状 + 说明**：生产按钮门禁来自服务端 production-preview 的 `preApprovalAllowed`（真实生产前置），不是 staging 决策——两阶段门禁本就独立；PX-1 口径统一 + 阶段限定词后，banner 明确表达「当前执行阶段」的阻断，不再与生产按钮状态矛盾。发布（预发）按钮仍受 staging gate + targetReadiness 约束（禁用+可见原因） |
| 预发「发布」零反馈 | **非本轮问题**：本轮实测按钮因 targetReadiness 禁用并显示原因；「已完成态重部署语义」建议单独立项 |
| 基线卡补锁定 commit/时间 | **未修**：`detail.preflight` 现有 payload 无锁定 commit/时间字段，前端无数据可显（需后端补字段） |

## 5. 未修项汇总（如实说明）

| 项 | 原因 | 建议 |
|---|---|---|
| 「该完整阶段能力尚未接入」等后端拼接 reason 文案的措辞 | 文案由 devpilot-api 生成；前端清洗层只处理 ISO/cuid/字节，不改写语句 | 后端侧统一文案模板（疑似「该阶段」笔误一并修） |
| badge 状态词中性化（证据不可用→未采集等） | 状态 key 与后端枚举、多页面共用，牵一发动全身 | 与后端 reasonCode 对齐出一份状态词表后统一替换 |
| 基线卡锁定 commit/时间 | API 未提供字段 | 后端在 preflight payload 补充后前端加两行 Fact |
| PX-13 全站徽章策略 | `packages/ui` Tag 属共享包，超出「只改 devpilot-web」边界 | 单独设计轮次处理 |

## 6. 口径决策记录

- **PX-1 默认口径**：banner / 步骤 01 区头 / 组行阻断数 = 当前执行阶段决策（resumeStep→stage）。此为产品口径默认值，可调整——若产品希望证据区展示「目录级阻断」（build 决策 5），只需给 `ReleaseGateCatalogView` 传 `stage='build'`，但需恢复 banner 拆分说明，否则会重新出现双口径。
- **PX-29 取舍**：预警条保留阶段名（口径解释必需），牺牲与标题徽章的重复；步骤 03 副标改为状态文案。
- **PX-7/PX-6 取舍**：部署历史单行 640px 是内容自适应，多行回到 800px 标准档。

## 7. 验证记录

- `pnpm test`：**149 files / 591 tests 全过**（exit 0，日志 `/tmp/codex-tool-runs/svton/zc-test-final2.log`）
- `pnpm type-check`：exit 0（`zc-typecheck-final2.log`）
- `pnpm lint`：exit 0（`zc-lint-final2.log`）
- `pnpm i18n:check`：exit 0，zh/en 3970 leaf parity（`zc-i18n-final.log`）
- 真实渲染（localhost:3120 容器已用本轮代码重建 3 次，最终镜像含全部修复）：
  - 1800×1009：H1、banner/区头双「阻断 3」、ROD-5 本地时间、发布禁用可见原因、两抽屉操作列 right ≤1800 且无溢出、PX-32 错误映射、PX-10 CheckCircle、PX-4 右栏压缩、PX-8 弹窗空态+禁用原因（未点确认，取消关闭）
  - 1280×800：环境版本两行完整、基线徽章 0 折行、无横向溢出
- 安全约束复核：全程未点击「确认发布到生产」「重新检查」「构建最新代码」；生产确认弹窗仅打开取证后取消；容器重建只涉及 web 服务（API/DB 卷未动）

## 8. 变更文件清单（apps/devpilot-web）

新增：`utils/release-display.utils.ts`(+spec)、`components/release-workbench/release-flow-status-tag.tsx`、`release-scroll-table.tsx`、`components/release-staging-technical-evidence.tsx`、`components/release-gate-counts-parity.spec.tsx`、`publish/components/production-confirm-modal.spec.tsx`、`release-workbench/release-flow-nav.shared.spec.tsx`

修改（源码）：`utils/release-time.utils.ts`、`components/layout/breadcrumbs.tsx`、`components/ui/button.tsx`、`release-gate-summary.model.ts`、`release-gate-summary.tsx`、`release-gate-catalog-panel.tsx`、`release-gate-catalog-dialog.tsx`、`release-gate-phase-section.tsx`、`release-action-gate.model.ts`、`release-build-history-table.tsx`、`release-staging-evidence-list.tsx`、`release-staging-evidence-row.tsx`、`release-build-log-drawer.tsx`、`release-staging-log-drawer.tsx`、`publish/components/production-confirm-modal.tsx`、`release-workbench/` 下 `release-order-detail-workbench.tsx`（未改，仅列依赖面）、`release-workbench-header.tsx`、`release-workbench-decision-card.tsx`、`release-workbench-steps.tsx`、`release-workbench-steps.model.ts`、`release-environment-chain.tsx`、`release-staging-view.tsx`、`release-round-panel.tsx`、`release-round-build-card.tsx`、`release-round-deploy-card.tsx`、`release-step-preflight-panel.tsx`、`release-step-build-panel.tsx`、`release-step-deploy-panel.tsx`、`release-production-view.tsx`、`release-production-run-history.tsx`、`release-production-run-log-drawer.tsx`、`release-build-history-drawer.tsx`、`release-deploy-history-drawer.tsx`、`release-flow-nav.shared.tsx`、`release-workbench-summary.model.ts`

修改（测试/i18n）：`breadcrumbs.spec.tsx`、`f453-responsive.spec.tsx`、`release-build-history-table.spec.tsx`、`release-build-log-drawer.spec.tsx`、`release-gate-catalog-panel.spec.tsx`、`release-staging-log-drawer.spec.tsx`、`release-order-evidence-lists.spec.tsx`、`release-workbench-header.spec.tsx`、`release-deploy-history-drawer.spec.tsx`、`messages/zh.json`、`messages/en.json`
