# 发布单详情页修复 独立视觉复核报告（2026-08-24）

- 复核者：独立评审（视觉复核版），不信任 zcode 修复报告结论，全部结论基于可运行证据 + 截图目测
- 对象：`/projects/cmrwxl1ks000k6enjiclutd5a/releases?releaseOrderId=cmsmzs63q00ek1700clhiytmj`（Picshare · 0.0.1），localhost:3120 容器
- 视口：1800×1009 主测 + 1280×800 响应式
- 截图：`evaluation/screenshots/2026-08-24/review/`（rv-*.png，均经目测）
- 安全约束：全程未点「确认发布到生产」「重新检查」「构建最新代码」「部署」；确认弹窗打开取证后已点「取消」；复核中会话过期重新登录一次（DemoPass123!，无写操作）

---

## 〇、总结论

**38 项 PX 问题：33 已修复 · 3 部分修复（本轮已补修）· 2 如实声明未修（超边界）· 0 虚假声明**。
ROD-4 / ROD-5 两个返工项**真实修复**（上轮「不复现」的不实声明本轮已纠正）。回归全绿（150 files / 596 tests，type-check / lint / i18n 均 exit 0）。视觉质量整体达标：信息层级清晰、徽章语义同色、紧凑切换器符合契约、与 approved-project-config.png 风格一致。

zcode 本轮声明**可信度高**：所有「已修」声明均在线上复现，未发现类似上轮 ROD-5 的不实声明；未修项（badge 状态词中性化、基线卡锁定 commit）均如实说明且理由成立（跨页语义 / 后端无字段）。

发现 3 处声明与实际有出入的缺口（均 ≤50 行，**本轮已直接补修 + 补测试**）：

| # | 缺口 | 性质 |
|---|------|------|
| G1 | PX-13「同高」声明不实：`FlowStatusTag` 只加了 `border-transparent`，灰徽章仍 26px（1px 透明边框盒）vs 绿/橙 24px | 声明部分不实，已补修（`h-6`） |
| G2 | 51 项弹窗 reason 文案残留完整 cuid：「Manifest cmsn2i52500383nfoe8ayoeiu 以 Digest 绑定…」（后端拼接，清洗层只过了 ISO） | PX-3 漏点，已补修（改走 `humanizeEvidenceText`） |
| G3 | 组行空检查时间渲染「检查于 -」，与 PX-27 统一「暂无」口径相悖（时间格式统一时引入的小回归） | 已补修（回退 `releaseWorkbenchValueEmpty`） |

> 注意：容器为构建镜像、无热更新，G1–G3 已由单测验证（596 过），**线上目测需下次容器重建后确认**。

---

## 一、P0 与返工项复验（线上实测 + 截图双证据）

| 项 | verdict | 行为证据（DOM/实测） | 视觉证据（截图） |
|---|---------|---------------------|------------------|
| PX-8 生产确认弹窗 | **已修复** | 打开弹窗：正文为中性空态卡「暂无法生成差异摘要（环境/版本/制品对比不可用），确认按钮已禁用。」+ 原因「Production 没有可启动的活动服务」；确认钮 `disabled=true`，禁用原因常驻可见（非 title）；已点「取消」成功关闭。有 snapshot 的四行差异摘要路径线上无该数据场景，由 `production-confirm-modal.spec.tsx` 单测覆盖（四行 + enabled + onConfirm） | rv-promote-confirm-modal.png：空态卡、原因文案、禁用确认钮目测清晰 |
| PX-5 历史抽屉操作列 | **已修复** | 1800×1009：部署历史「日志」right=1695、「部署」right=1727；构建历史「查看日志」right=1727；两表 scrollWidth=clientWidth（590/750）无溢出。1280×800：1211/1243/1243，均 ≤1280，无溢出 | rv-deploy-history-1800.png、rv-build-history-1800.png：6 列含「操作」全部完整可见；rv-*-1280.png 同验 |
| PX-1 门禁计数 | **已修复（口径=产品默认值，已声明可调）** | banner「阻断 3」；区头「预发（Staging）发布准入 · 阻断 3 · 警告 0 · 待确认 0」；四组行阻断数 0+0+1+2=3，与阶段决策一致；parity spec 断言两处同 3 且不出现 5。实现与声明一致 | rv-step01-banner-1800.png：banner 与区头同屏，两个「阻断 3」目测一致 |
| ROD-5 raw ISO | **已修复（真实修复，非「不复现」）** | 全页 innerText 正则 `\d{4}-\d{2}-\d{2}T` 0 命中；组描述实测「证据已于 2026-08-17 17:11 过期」；51 项弹窗 4 条过期文案全部本地化；parity spec 以原文案做防回归锚点 | rv-step01-gates-1800.png：组 2/4 描述目测为本地时间 |
| ROD-4 部署历史 cuid 回流 | **已修复** | 部署历史抽屉 text 无任何 25 位 cuid；行内为「BuildRun #10 / BuildRun cmsn2fy8… / sha256:32bf01d5cd4a…」短 ID（title 留全文） | rv-deploy-history-1800.png：无 break-all、无全长 cuid |

---

## 二、PX-1~38 逐条 verdict

证据类型标注：【测】单测断言 /【DOM】线上 DOM 实测 /【图】截图目测（文件见 review/ 目录）。

### 操作/行为类

| # | verdict | 证据 |
|---|---------|------|
| PX-1 | 已修复 | 【DOM+图】见上表；【测】release-gate-counts-parity.spec |
| PX-5 | 已修复 | 【DOM+图】见上表 |
| PX-8 | 已修复 | 【DOM+图+测】见上表 |
| PX-18 禁用原因 title-only | 已修复 | 【DOM】「发布」「构建最新代码」均带 `aria-describedby` 指向常驻可见小字；【图】rv-full-1800-01.png 两处原因文案可见 |
| PX-19 CTA 无按钮感 | 已修复 | 【图】「前往基线检查」「重新检查」「查看全部 51 项」均为带边框按钮形态（rv-step01-banner / rv-step01-gates） |
| PX-20 日志入口三态 | 已修复 | 【DOM】面板/右栏入口统一「查看日志」44px 边框按钮（实测 2 处一致）；【DOM】历史表行内保留紧凑「日志」文字链（符合表格操作列契约，声明如实） |
| PX-21 弹窗双关闭 | 已修复 | 【DOM】51 项弹窗 footer 仅「关闭」；【测】catalog panel spec |
| PX-22 组过滤标题 | 已修复 | 【DOM+图】点组行打开弹窗标题「M01 来源与必需 CI · 3 项」+ 专属描述；M01 chip 高亮（border-primary/40）、其余 opacity-60（rv-gate-group1-dialog.png）。注：chips 为纯展示 div，不可点击过滤（审计未要求可点；见遗留 N3） |
| PX-30 告警无形态 | 已修复 | 【DOM+图】amber alert 卡（图标+底色+边框）+ 影响说明「因此「发布」与「部署」操作已禁用，请先修复部署目标。」（rv-deploy-history-1800.png） |
| PX-36 0s 耗时 | 已修复 | 【图】构建历史 #1 行「<1s」（rv-build-history-1800.png 末行）；【测】formatDuration |
| PX-38 禁用样式二态 | 已修复 | 【DOM】发布钮禁用实测 opacity 0.5；确认钮同组件同 token |

### 字段/文案类

| # | verdict | 证据 |
|---|---------|------|
| PX-2（=ROD-5） | 已修复 | 【DOM】见上表；51 项弹窗 C05/C08/D10/D11 同一清洗层覆盖 |
| PX-3 raw cuid 六处 | **部分修复 → 本轮补漏后完整** | 【DOM】面包屑 title=""（原 raw cuid）、部署日志标题短 ID、历史表短 ID、生产视图短哈希、51 项证据列折叠均验证 ✓；**缺口**：51 弹窗 reason 残留完整 cuid（G2，已补修）；另部署日志「部署地址」URI 内含 cuid（技术证据 URI，可接受，见遗留 N4） |
| PX-4 右栏重复 | 已修复（留有小残余） | 【DOM+图】选步骤 03 时部署卡压缩为「已完成 · 1s + 查看日志」；选步骤 02 时构建卡压缩为状态+动作（rv-step02-dedup-1800.png）。残余：digest 在「步骤 03 详情 + 构建卡」同屏出现 2 次（声明只承诺短哈希，未承诺同屏 1 次，不算不实） |
| PX-9 生产文案矛盾 | 已修复 | 【DOM+图】「预发环境已完成部署运行（技术验证结论以部署信息为准）…」；空态「完成预发部署后可直接发布到生产」；旧「验证通过」文案 0 命中（rv-production-view-1800.png） |
| PX-11 时间格式 | 已修复 | 【DOM】全页 `,` 日期 0、`2026/` 斜杠 0、「耗时:」0；实测 `2026-08-10 19:37:27` / `耗时 · 1s` |
| PX-12 目标上下文 | 已修复 | 【DOM】51 弹窗「目标上下文」0 命中，能力组列显示 M 码或「—」 |
| PX-23 cuid break-all | 已修复 | 【图】部署历史行首短 ID truncate + 省略号，无断词折行（rv-deploy-history-1800.png） |
| PX-27 空态两种 | **部分修复 → 本轮补漏后完整** | 【DOM】面板/抽屉空值统一「暂无」；**缺口**：组行「检查于 -」（G3，已补修）；表格空 cell 保留「—」（评审允许） |
| PX-29 阶段名 4 处 | 已修复 | 【DOM】meta 删「真实执行阶段」（4 字段：版本号/候选代码/环境版本/最近运行）；步骤 03 副标改「当前步骤」；保留标题徽章+banner（banner 需口径限定词，声明合理） |
| PX-32 错误枚举截断 | 已修复 | 【DOM+图】「制品含疑似秘密内容」「制品超出大小上限：构建制品超过 250MB（262144000 字节）上限」等中文标题全量上屏（rv-build-history-1800.png） |
| PX-35 术语 | 部分修复（3/4，声明如实） | 【DOM】「已按不通过处理」「当前版本」「按需查看各能力组或全部证据」均上屏；「该完整阶段能力尚未接入」为后端 reason，前端不改写（声明如实，需后端修） |

### 样式/布局/响应式类

| # | verdict | 证据 |
|---|---------|------|
| PX-6 抽屉宽度 | 已修复 | 【DOM】部署历史 640（单行自适应）/ 构建历史 800 / 日志抽屉 720，两档+自适应 |
| PX-7 单行大空白 | 已修复 | 【图】部署历史 640px 装 1 行，空白大幅减少（rv-deploy-history-1800.png） |
| PX-10 步骤图标 | 已修复 | 【DOM】01/02 图标 path=`M173.66,98.34…`（CheckCircle 勾），03 为半环；【图】rv-step-icons-2x.png 2x 放大目测：01/02 实心绿勾 ✓、03 蓝色半环（进行中） |
| PX-13 徽章体系 | **部分修复 → 本轮补漏后完整** | 【DOM】灰徽章实测 26px+1px（透明）边框 vs 绿/橙 24px 无边框——「同高」声明不实（G1，已补修 `h-6`）；同语义同色目测 ✓（见视觉专项） |
| PX-14 字段值 11px | 已修复 | 【DOM】面板值 13px；mono 值 12px（声明内例外，不再低于 12px 标签） |
| PX-15 步骤盒 10px | 已修复 | 【DOM】步骤盒最小字号 11px（原 10px） |
| PX-16 阶段卡状态灰字 | 已修复 | 【DOM】切换器「已完成」rgb(5,150,105) emerald 绿；blocked/current 各按语义着色 |
| PX-17 无 H1 | 已修复 | 【DOM】h1=「0.0.1」，层级 H1→H2→H3 |
| PX-24 1280 徽章折行 | 已修复 | 【DOM】1280 下 3 个「已就绪」均 h=24 单行 nowrap。残余：基线卡描述 1280 下仍省略号截断（119px，有 ellipsis，可接受） |
| PX-25 滚动无提示 | 已修复 | 【DOM】两视口两表均 sw=cw 无溢出（渐隐遮罩为兜底，未触发）；ReleaseScrollTable 组件在 |
| PX-26 红字无形态 | 已修复 | 【图】destructive alert 卡片（红底+边框+图标），rv-step01-gates-1800.png 底部 |
| PX-28 执行：部署 | 已修复 | 【DOM+图】「当前步骤：03 部署」 |
| PX-33 chips 溢出 | 已修复 | 【图】M01–M15 flex-wrap 换行网格，15 组全可见（rv-gate51-dialog-1800.png） |
| PX-34 红徽章嵌黄底 | 已修复 | 【图】banner 改中性底+左侧红色状态条+红图标（rv-full-1800-01.png） |
| PX-37 环境版本截断 | 已修复 | 【DOM】1280 下「Staging · 0.0.1 / Production · 暂无」两行完整，scrollWidth=1280 无溢出 |
| PX-31 raw JSON | 已修复 | 【DOM+图】部署地址/38.9MB（40824690 字节）/0600/Git 执行提为表单项；raw JSON 收进未展开 `<details>`「查看原始证据」（rv-deploy-log-drawer.png） |
| PX-17 之外的 H 级顺移 | 已修复 | 【DOM】步骤区 H2、信息卡 H3 |

### 结构评审项

| 项 | verdict | 说明 |
|---|---------|------|
| 阶段卡片改紧凑切换器 | 已修复 | 【图】一行式分段控件（预发发布 已完成 ｜ 生产发布 等待中），符合契约「环境是范围选择器，不做两张大摘要卡」 |
| meta 行瘦身 | 已修复 | 【图】4 字段，1280 无截断 |
| 右栏与步骤详情去重 | 已修复 | 见 PX-4 |
| 历史抽屉列精简+宽度自适应 | 已修复 | 见 PX-5/6/7 |
| badge 状态词中性化（证据不可用→未采集） | 未修（声明如实） | 跨页状态词表，需与后端 reasonCode 对齐，本轮超边界 |
| 阻断与「发布到生产」强绑定 | 维持现状+说明（接受） | banner 现明确限定「预发（Staging）发布准入」，与生产按钮（独立生产前置门禁）不再矛盾；生产确认弹窗有真实禁用原因兜底 |
| 决策阶段指针 | 部分修复 | banner 显式命名阶段（口径已明示）；「预发完成后指针推进到生产准入」未做（产品决策项） |
| 预发「发布」零反馈 | 不适用/维持 | 线上该按钮因 targetReadiness 禁用+可见原因；「已完成态重部署语义」声明另行立项 |
| 基线卡锁定 commit/时间 | 未修（声明如实） | API preflight 无字段，前端无数据可显 |

---

## 三、视觉专项结论（仅视觉复核能做的部分）

1. **步骤图标（PX-10）**：rv-step-icons-2x.png（2x 放大）——01/02 为绿底实心勾（CheckCircle），03 为蓝色半环（进行中）。完成/进行中视觉语言正确，与阶段切换器的勾形一致。
2. **徽章配色语义**：同语义同色目测通过——绿（构建成功/已完成/已就绪/通过）、橙（待完成（不阻断）/警告）、灰（不可用/证据不可用）、红（当前准入阻断/阻断 N/构建失败）在 rv-full-1800-01、rv-step01-gates、rv-build-history 中一致。唯一形态残留为灰徽章 26px 高度差（G1，已补修待容器重建）。
3. **阶段卡片形态**：紧凑切换器与契约对照——「不做两张大摘要卡」✓，一行式、内容自适应宽、选中态浅底描边，省出的纵向空间给了执行内容，符合契约意图。
4. **右栏去重后信息完整性**：选步骤 03 时右栏部署卡压缩为状态+入口，无信息丢失（该信息在步骤 03 详情完整存在）；选步骤 01 时部署卡恢复完整字段。无突兀留白。
5. **1280×800 全视图走查**：rv-full-1280.png / rv-1280-step01.png——无截断/重叠/挤压；meta 两行环境版本完整；基线徽章 0 折行；唯一截断为基线卡描述省略号（可接受）。
6. **整体视觉质量**：信息层级（H1 版本 → banner 决策 → 切换器 → 步骤 → 详情）清晰；视觉噪音显著下降（告警均有形态、CTA 统一、徽章统一）；与 approved-project-config.png 风格一致（白底/蓝主色/近黑标题/绿状态语言/右栏检查面板模式）；与 mockup 03 的门禁卡语言（红阻断徽章、本地时间、短 ID 折叠）方向一致。

## 四、回归与 diff 审查结论

- `pnpm --filter @svton/devpilot-web test`：**exit 0，150 files / 596 tests**（补漏后；zcode 基线 149/591 + 本轮 +1 文件 3 测试 +2 测试）日志 `/tmp/codex-tool-runs/svton/rv-test-final.log`
- `type-check` exit 0（rv-typecheck2.log）· `lint` exit 0（rv-lint2.log）· `i18n:check` exit 0，zh/en 3970 leaf parity（rv-i18n2.log）
- **diff 归因说明**：工作区含大量跨轮次未提交改动（329 文件，含 devpilot-api、packages/ui、pnpm-lock 等），git 无法归因到单一代理。本轮复核以「zcode 声明清单」为基准：其声明的 8 个新增文件全部存在、40+ 修改文件与发布详情相关改动一一对应；未发现声明清单之外的发布详情相关越界改动。packages/ui 的改动（index.css/tailwind-preset）非 zcode 本轮声明范围，判定为其他轮次遗留，不计入本次越界。
- 死按钮扫描：【DOM】main 内无可点击但无行为的新增按钮；raw ID 扫描：【DOM】主视图/抽屉/弹窗可见文本 0 命中 25 位 cuid（G2 修复后含 reason 路径，待容器重建线上确认）；契约冲突：未发现（紧凑切换器/操作列/抽屉形态均符合 workbench-contract）。

## 五、补修清单（本轮已提交到工作区，未 commit）

| # | 文件 | 改动 | 测试 |
|---|------|------|------|
| G1 | `components/release-workbench/release-flow-status-tag.tsx` | className 增加 `h-6`（twMerge 覆盖，24px 总高含透明边框盒） | 新增 `release-flow-status-tag.spec.tsx`（3 断言：border-transparent + h-6 × 3 语义） |
| G2 | `components/release-gate-phase-section.tsx` | reason 渲染 `humanizeGateReason` → `humanizeEvidenceText`（ISO+cuid+字节组合清洗） | `release-gate-catalog-panel.spec.tsx` 新增用例：reason 含完整 cuid → 弹窗仅见 `cmsn2i52…` |
| G3 | `components/release-gate-summary.tsx` | 组行 time 空值回退 `t('releaseWorkbenchValueEmpty')`（暂无） | `release-gate-counts-parity.spec.tsx` 新增用例：checkedAt 全 null → 无 `"time":"-"` |

## 六、遗留风险与提示

- **N1（需产品决策）**：PX-1 口径为「当前执行阶段决策」（staging=3）。若产品要目录级口径（build=5），改 `ReleaseGateCatalogView` stage 参数即可，但需同步恢复 banner 拆分说明，否则双口径复发（zcode 已留切换说明）。
- **N2（后端依赖）**：①「该完整阶段能力尚未接入」措辞（疑笔误）与 reason 模板需后端统一；② 基线卡锁定 commit/时间需 preflight payload 补字段；③ badge 状态词表（证据不可用→未采集）需与 reasonCode 对齐后跨页统一。
- **N3（a11y 小疵）**：51 弹窗 chips 为 `div[aria-pressed]` 纯展示元素——aria-pressed 语义上仅适用于可交互控件。建议后续加 `role="button"`+真实过滤行为，或去掉 aria-pressed 改用 `data-active`。
- **N4（可接受残留）**：部署日志「部署地址」`release-target://…` URI 路径含 projectId/environmentId/deploymentRunId cuid——属技术证据原文，建议保持现状；部署历史 640px 窄抽屉下「部署运行」单元格仅显「Deploy...」，短 ID 被省略号完全遮蔽（title 有全文），多行数据回到 800px 后自愈。
- **N5（给最终审核人）**：① G1–G3 补修仅单测验证，**合并前请重建 web 容器后线上复看三处**（徽章同高 / 51 弹窗 B02 reason / Secret 组「检查于 暂无」）；② PX-8 的「有 snapshot 四行摘要」路径线上无数据，靠 spec 覆盖，若生产预览接口日后返回 snapshot，建议人工开一次弹窗目检；③ 工作区跨轮次改动未 commit，归因以 zcode 声明清单为准，最终提交前建议按模块拆分 commit。

## 七、验证记录

- 浏览器：ego-browser 任务空间 `release detail visual review`（id 54），1800×1009 与 1280×800，全程无写操作，弹窗取证后取消
- 截图 12 张：rv-full-1800-01 / rv-step01-banner-1800 / rv-step01-gates-1800 / rv-gate51-dialog-1800 / rv-gate-group1-dialog / rv-deploy-history-1800 / rv-build-history-1800 / rv-production-view-1800 / rv-promote-confirm-modal / rv-deploy-log-drawer / rv-step02-dedup-1800 / rv-full-1280 / rv-1280-step01 / rv-step-icons-2x / rv-mockup-03
- 回归日志：`/tmp/codex-tool-runs/svton/rv-{test,test-final,typecheck,typecheck2,lint,lint2,i18n,i18n2,gapfix-test}.log`
