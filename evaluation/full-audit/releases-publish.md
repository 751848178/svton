# 发布域（Releases / 创建发布 / 发布单详情）穷尽式点击走查报告

- 日期：2026-08-22
- 环境：`http://localhost:3120`，项目 Picshare（`cmrwxl1ks000k6enjiclutd5a`），账号 System Administrator（Test Org）
- 视口：1800×1009（响应式复查用 CDP 切换到 1280×800，已恢复）
- 截图目录：`evaluation/screenshots/2026-08-22/full-audit/`
- 安全说明：全程未点击任何最终发布/审批/部署/取消确认。staging 行的「部署」按钮（aria-label 表明单击即从既有 DeploymentRun 重部署、无二次确认）按红线未点击。「申请生产发布审批」按钮当时为 disabled 不可点。走查中曾尝试用合法值提交创建表单以验证流程，因 WIZ-1 的 bug 提交从未到达后端；事后用后端 API（`GET /api/projects/:id/delivery/releases`，带 X-Team-Id）核实仍只有原有 2 条发布单，**无脏数据残留**。

---

## 交互元素覆盖清单

### A. 发布列表 view（`?view=releases`）

| 区域 | 元素 | 结果 |
|---|---|---|
| 页头 | 「创建发布」按钮（anchor → `?view=releases&create=true`） | 正常打开向导（但见 WIZ-2） |
| 筛选区 | 「搜索发布单」输入框 | 正常：搜 `0.0.1` 命中 1 条、搜 commit 前缀 `8e7c465d` 命中 1 条、搜不存在词显示空态（`rel-search-01-empty.png`）、清空后恢复 2 条（`rel-search-03-clear-recheck.png`）。注：中途一次"清空不恢复"经复核为工具未触发事件的假象，非产品 bug |
| 筛选区 | 「按状态筛选发布单」下拉（9 个选项：全部/草稿/构建中/预发/等待审批/生产中/已发布/失败/已撤回） | 筛选生效，选「已发布」正确显示空态文案（`rel-filter-01-empty-succeeded.png`）；但不写入 URL → REL-1 |
| 列表 | 「2 个发布单 · 最近执行优先」计数 | 正常，随筛选/搜索联动 |
| 行 1（草稿） | 「历史发布」标题按钮 | 正常跳转详情（step=preflight）；命名问题见 REL-4 |
| 行 1 | `cmt0s12ks00d7810y36nzocro` 按钮 | 点击跳转该发布单详情；raw ID 问题见 REL-2 |
| 行 1 | 「查看发布单」 | 正常跳转详情 |
| 行 2（0.0.1） | 「0.0.1」标题按钮 | 正常跳转详情（step=staging） |
| 行 2 | `cmsmzs63q00ek1700clhiytmj` 按钮（title 悬停显示完整 ID） | 同 REL-2 |
| 行 2 | 「查看构建」 | 正常：`?releaseOrderId=…&step=build&buildRunId=…` |
| 行 2 | 「查看部署」 | 正常：`?view=deployments&runId=…` |
| 行 2 | 「更多发布单操作」菜单 →「技术证据」 | 菜单仅 1 项；点击跳详情 step=build 并弹出 BuildRun #10 日志 dialog（`rel-row-01-more-menu.png` / `rel-row-02-tech-evidence.png`） |
| 行 hover | hover 出现的隐藏操作 | 无（hover 前后按钮数不变） |
| 深链 | `?view=releases&releaseOrderId=cmsmzs63q…`（含/不含 view 参数） | 正常打开详情 ✓ |
| 深链 | `?view=releases&stageId=draft` | **被忽略**，仍显示全部 → REL-1 |
| 深链 | `?view=releases&releasePlanId=…` | 被忽略，显示列表（该参数是否受支持未知，记为观察项） |
| 分页 | — | 不存在（仅 2 条；API 固定 take=50） |

### B. 创建发布向导（modal，非多步）

当前版本的「创建发布」是**单表单 modal**（版本名称 / 发布版本号 / 说明 + 取消 / 创建发布），不存在多步向导、候选源选择器或环境选择步骤；简报中预期的"候选源/Manifest 选择器"在此不出现（Manifest 选择器位于发布单详情的 staging 步骤，见 ROD-4）。

| 元素 | 结果 |
|---|---|
| 打开（点按钮 / 刷新 `create=true` 深链 / 跨页深链） | 均能打开（`wiz-step1-01.png` / `wiz-step1-02-after-reload.png`） |
| 空表单点「创建发布」 | 按钮 disabled，无任何提示说明原因 → WIZ-4（`wiz-step1-03-empty-validation.png`） |
| 非法版本号 `abc` | 按钮 disabled，无 inline 提示 → WIZ-4（`wiz-step1-04-invalid-version.png`） |
| 合法值（`walkthrough-temp-draft` / `99.0.0`）提交 | **被浏览器原生 pattern 校验拦截，任何版本号都无法提交** → WIZ-1（P0，`wiz-step1-09-native-validation-bubble.png`） |
| 「取消」按钮 / 「×」/ Esc | 均能关闭；但 URL 残留 `create=true`，再点「创建发布」无反应 → WIZ-2（`wiz-step1-10-reopen-fails.png`） |
| 取消后重开 | 表单残留上次输入（SPA 会话内） → WIZ-5 |
| 「保存草稿」类安全按钮 | 不存在 |
| 1280×800 复查 | modal 居中完整，无问题（`wiz-step1-1280-01.png`） |

### C. 发布单详情页（0.0.1，`?releaseOrderId=cmsmzs63q00ek1700clhiytmj`）

| 区域 | 元素 | 结果 |
|---|---|---|
| 头部 | 「← 返回发布单列表」 | 正常回列表 |
| 门禁决策卡 | 「查看门禁详情」 | 实际跳转 step=preflight，非打开门禁明细 → ROD-8（`rod-gate-01-detail.png`） |
| 门禁决策卡 | 「返回执行阶段」 | 正常跳回真实执行阶段 step=staging |
| 决策卡计数 | 「阻断 3 · 警告 0 · 待确认 0」 | 与 preflight 面板「阻断 5」、技术证据 tab「阻断 0」三处矛盾 → ROD-1 |
| 步骤 tab | 01 仓库与环境基线 / 02 构建制品 / 03 预发 / 04 生产 | 均可切换（步骤名与状态文案重复 → ROD-9） |
| 步骤 01 | 「高级检查与证据」折叠头 | 正常展开/收起 |
| 步骤 01 | 「重新检查」 | 正常，检查时间戳实时更新（`rod-preflight-06-recheck.png`） |
| 步骤 01 | 「查看全部 51 项」 | 正常打开「完整门禁目录」drawer（Commit 10/Build 11/Deploy 20/Promote 10 = 51 ✓，`rod-gate-02-catalog-drawer.png`），drawer 内「取消」可关闭 |
| 步骤 01 | 4 个能力组按钮（来源与必需 CI / 变更影响识别 / Secret 与高危漏洞 / 依赖与静态质量） | 有效：点击展示该组检查项明细卡片（`rod-preflight-08-group-detail-shown.png`）。注：中途一次"点击无响应"经 JS 复核为工具点击未命中的假象，非产品 bug |
| 步骤 01 | 证据过期文案 | ISO 原始时间戳裸露 → ROD-5 |
| 步骤 02 | 10 条构建记录行内「查看日志」 | 正常，下方技术详情区切换为对应 BuildRun 日志与证据（`rod-build-03-log-dialog.png`） |
| 步骤 02 | Manifest 制品证据 | 组件名裸露 cuid → ROD-6 |
| 步骤 03 | 「成功 Manifest」选择器（2 个选项） | 选项裸露 raw ID → ROD-4（历史问题重现） |
| 步骤 03 | 部署记录行「日志」 | 正常，展开 DeploymentRun 日志与证据（`rod-staging-02-deploy-log.png`） |
| 步骤 03 | 部署记录行「部署」（重部署） | **按红线未点击**（单击即创建新 DeploymentRun，无确认） |
| 步骤 03 | 「查看部署记录」链接 | 正常跳 `?view=deployments&runId=…` |
| 步骤 03 | 「生产前置条件：已满足」 | 与步骤 04「尚未满足」矛盾 → ROD-3 |
| 步骤 04 | 「已验证的 Manifest」选择器 | 文案较可读（`BuildRun #10 · Manifest sha256:32bf01d5cd4a`），与步骤 03 风格不一致 → ROD-4 |
| 步骤 04 | 「申请生产（Production）发布审批」 | disabled 且有不达标提示（正常）；未做最终提交 |
| 步骤 04 | 错误 alert「生产操作失败，请查看证据或重试」 | 用户未操作即显示失败态 → ROD-2（`rod-production-01.png`） |
| 发布动态 tab | 「Staging 部署」组 / 「构建」组 / 「发布单」组 | 均有效：点击展开对应证据（「发布单」组打开「完整门禁目录 · 2 项」drawer） |
| 发布动态 | 「查看此前 9 条」展开 toggle | 功能有效，但为非 button 元素、键盘不可达 → ROD-10 |
| 发布动态 | 历史构建条目（执行构建 17:17~18:00 共 9 个按钮） | 正常，切换技术详情到对应 BuildRun |
| 技术证据 tab | 「发布门禁 51 项检查 · 阻断 0 · 不可用 41」 | 计数与决策卡矛盾 → ROD-1（`rod-evidence-01-tab.png`） |
| 「技术详情」折叠 | 展开/收起 | 正常 |
| draft 发布单详情（历史发布） | 全部元素 | 只有查看类操作；无任何推进/放弃入口 → ROD-7（`rod-draft-01.png` / `rod-draft-02-build-step.png`）；此详情决策卡与面板计数一致（均为阻断 5） |
| 1280×800 复查 | 列表 / 向导 / 详情（preflight、build、staging） | 列表操作列裁切 → REL-3；详情步骤名截断 → ROD-11；其余正常 |

---

## 问题清单

### WIZ-1【P0】创建发布单被双重转义的 pattern 完全阻断，任何版本号都无法提交

- 位置：创建发布 modal →「发布版本号」输入框
- 复现：打开「创建发布」→ 填名称 `任意`、版本号 `99.0.0`（合法 x.y.z）→ 点「创建发布」
- 预期：提交创建草稿发布单
- 实际：浏览器原生校验气泡「请与所请求的格式保持一致。版本号必须使用 x.y.z 格式，例如 1.4.0」，提交被拦截，**零网络请求**。`99.0.0` 明显符合 x.y.z，气泡提示与实际矛盾，用户被困死
- 根因（代码定位）：`apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/release-order-create-modal.tsx:70`，JSX 字符串属性中写了 `pattern="(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)"`；JSX 属性字符串不处理 JS 转义，DOM 实际得到 `\\.`（匹配"字面反斜杠+任意字符"），导致只有形如 `99\x0\x0` 的输入才能通过。实测 DOM `pattern` 属性为双反斜杠、`new RegExp('^(?:'+p+')$').test('99.0.0') === false`
- 截图：`wiz-step1-09-native-validation-bubble.png`
- 严重度：**P0**（核心入口"创建发布"功能完全不可用）

### WIZ-2【P1】取消/关闭向导后 URL 残留 `create=true`，再点「创建发布」无反应

- 位置：发布列表 → 创建发布 modal
- 复现：打开向导 → 点「取消」（或 Esc / ×）→ 观察 URL 仍为 `?view=releases&create=true` → 再点「创建发布」
- 预期：再次打开向导
- 实际：无任何反应；必须刷新页面或先跳走再回来才能重新打开
- 根因（代码定位）：`project-delivery-route.tsx:34-36` 的 `useEffect` 依赖 `[searchParams]`，仅当 `create=true` **变化时**才 `setCreateOpen(true)`；而 `onClose`（:75）只 `setCreateOpen(false)`，不清理 URL query，URL 不变 → effect 不再触发
- 截图：`wiz-step1-10-reopen-fails.png`
- 严重度：P1

### WIZ-3【P1】创建失败完全静默：createError 被设置但 UI 从不渲染

- 位置：创建发布 modal
- 根因（代码定位）：`use-release-orders.ts:45-47` 中 `catch` 后 `setCreateError(...)` 并返回 `null`；`release-order-create-modal.tsx:28` 收到 falsy 直接 `return`，modal 内**没有任何地方渲染 `orders.error`**。后端 4xx/5xx 时用户看到的是"点了没反应"
- 预期：失败应在 modal 内显示错误文案
- 说明：因 WIZ-1 阻断，未能实际触发后端错误；此项为代码走查确认 + 提交行为观察（无请求、无提示、dialog 状态不定）双重佐证
- 严重度：P1

### WIZ-4【P2】表单校验只有按钮禁用，无任何原因提示

- 复现：留空或填非法版本号 →「创建发布」按钮变灰，但无 inline 错误、无文案说明哪个字段不合规（仅悬停 title/原生气泡）
- 截图：`wiz-step1-03-empty-validation.png`、`wiz-step1-04-invalid-version.png`
- 严重度：P2

### WIZ-5【P2】取消后重开向导残留上次输入

- 复现：填值 → 取消 → 同一 SPA 会话内重新打开 → 名称/版本号仍在
- 预期：取消应清空（或明确保留草稿语义）
- 严重度：P2

### REL-1【P1】筛选/搜索状态不进 URL，`stageId` 深链参数被忽略

- 复现：① 选状态筛选「已发布」→ URL 仍是 `?view=releases`，刷新后筛选丢失；② 直接打开 `?view=releases&stageId=draft` → 列表仍显示全部 2 条、筛选框停在「全部状态」
- 预期：筛选状态同步 URL 并可深链恢复
- 另：`releasePlanId` 参数同样被忽略（是否应支持待产品确认）；`releaseOrderId` 深链工作正常
- 严重度：P1

### REL-2【P2】列表「发布单」列裸露发布单 raw ID，且语义误导为 Commit

- 位置：列表每行标题下方的 `cmt0s12ks00d7810y36nzocro` / `cmsmzs63q00ek1700clhiytmj` 按钮
- 实测该值是 releaseOrderId 而非 Commit（与详情 URL 参数一致），但搜索框 placeholder 写着"搜索…Commit…"，列上下文极易让用户以为这是 commit hash
- 严重度：P2

### REL-3【P2】1280×800 下列表「操作」列被裁切

- 表现：操作列表头不可见；行内「查看部署」等按钮只显示一半（"查看部…"），需容器内横向滚动；首行操作按钮仅露出"查"字
- 截图：`rel-list-1280-01.png`
- 严重度：P2

### REL-4【P2】草稿发布单命名「历史发布 / 历史版本号 · v202608200822」语义误导

- 一条**当前草稿**被命名为"历史发布"，用户会误以为它是归档记录而非可继续的在制品
- 截图：`rel-list-01-overview.png`
- 严重度：P2

### ROD-1【P1】门禁计数三处自相矛盾：阻断 3 / 阻断 5 / 阻断 0

- 位置：发布单 0.0.1 详情
- 实测：顶部决策卡「阻断 3 · 警告 0 · 待确认 0」（当前决策 · 预发 STAGING 发布）；步骤 01「高级检查与证据」标题「阻断 5」（各组明细 2+2+0+1=5 自洽）；「技术证据」tab「51 项检查 · 阻断 0 · 不可用 41」
- 三处文案都叫"阻断"但数字互不相同，用户无法判断真实阻断数
- 截图：`rod-preflight-01.png`（3 vs 5 同屏）、`rod-evidence-01-tab.png`（阻断 0）
- 严重度：P1（历史问题"门禁决策卡计数与详情不一致"确认重现，且不止两处）

### ROD-2【P1】生产步骤未做任何操作即显示「生产操作失败，请查看证据或重试」

- 复现：打开发布单 0.0.1 → 切到步骤 04 → 页面底部即有红色错误 alert
- 预期：未操作时只应有"尚无生产 ReleaseRun"的中性提示；错误态应在真实失败后出现
- 截图：`rod-production-01.png`
- 严重度：P1（错误态误报，且"请重试"无对应可点操作）

### ROD-3【P1】「生产前置条件」状态自相矛盾 + 决策阶段停滞

- 实测：步骤 03 面板显示「生产前置条件：已满足」；步骤 04 面板显示「生产前置条件：尚未满足」。同时 staging 部署已完成（1 次部署、已完成），顶部决策卡却仍停在「当前决策 · 预发（STAGING）发布 · 当前准入阻断」
- 严重度：P1

### ROD-4【P1】Staging 的 Manifest 选择器裸露 raw ID（历史问题重现）

- 位置：步骤 03「成功 Manifest」下拉
- 实测选项：`BuildRun cmsn2fy8t001… · R10 · Manifest cmsn2i525003… · sha256:32bf01d5cd4a…`——cuid 直接暴露；而步骤 04 同类选择器为 `BuildRun #10 · Manifest sha256:32bf01d5cd4a`（用人类可读 revision 号）。同一页面两种风格，staging 侧明显是 raw ID
- 截图：`rod-staging-01.png`
- 严重度：P1（历史问题"Manifest 选择器 raw ID"确认重现）

### ROD-5【P2】证据过期文案裸露 ISO 原始时间戳

- 文案：`证据已于 2026-08-17T09:11:21.126Z 过期，必须重新检查`（同页其他时间均为本地化格式 `2026/8/10 17:11:21`）
- 截图：`rod-preflight-01.png`
- 严重度：P2

### ROD-6【P2】Manifest 制品证据的组件名裸露 cuid

- 位置：构建日志/证据的「Manifest 制品证据」区：`cmrwxm1tl000y6enjwoz2k2jq · zip`、`cmrwxma8100126enjsltztinh · zip`（第三个组件有名字 `project-bundle`，说明名字字段存在但前两个未映射）
- 截图：`rod-build-03-log-dialog.png`
- 严重度：P2

### ROD-7【P2】草稿发布单详情是死路：无推进入口、无放弃/删除入口

- 实测：draft（历史发布）详情的全部按钮只有返回/查看门禁/步骤 tab/动态 tab；步骤 02 只写"尚未构建"，门禁阻断时**连一个 disabled 的「开始构建」按钮或引导文案都没有**；也没有任何"放弃草稿"操作（配合「更多发布单操作」菜单在 draft 行干脆不存在，草稿无法从 UI 清除）
- 截图：`rod-draft-01.png`、`rod-draft-02-build-step.png`
- 严重度：P2（数据淤积风险，接近 P1）

### ROD-8【P2】「查看门禁详情」按钮文案与行为不符

- 实测：点击后跳转到 step=preflight 步骤页，而非打开"门禁详情"面板/drawer（真正的明细入口是步骤 01 里的「查看全部 51 项」）
- 严重度：P2

### ROD-9【P2】步骤 tab 状态文案与步骤名重复

- tab 文本为「步骤 03 预发（Staging）发布 预发（Staging）发布」「步骤 01 仓库与环境基线 基线已建立」尚可，但 03 的状态与名称完全重复，读屏软件亦重复朗读（tabpanel 名称 `步骤 03预发（Staging）发布预发（Staging）发布`）
- 严重度：P2

### ROD-10【P2】「查看此前 9 条」等展开 toggle 使用非 button 元素，键盘不可达

- 实测该 toggle 是 `container`（div）而非 button，无 aria-expanded、Tab 无法聚焦
- 严重度：P2

### ROD-11【P2】1280×800 下步骤 tab 名称截断严重

- 「仓库与环境…」「预发（Stagi…」「生产（Prod…」均截断；虽可用但信息不完整
- 截图：`rod-build-1280-01.png`
- 严重度：P2

---

## 历史问题复核结论

| 历史问题 | 结论 |
|---|---|
| 发布向导路由孤儿化（前进/后退/刷新状态） | **部分重现**：`create=true` 深链与刷新均能正确打开向导；但关闭后 URL 不清理导致同会话无法重开（WIZ-2） |
| 幽灵环境卡片 | **未重现**：当前版本创建 modal 无环境选择步骤；详情各环境卡片（Staging/Production 状态行）内容自洽，未见无数据幽灵卡 |
| 门禁决策卡计数与详情不一致 | **确认重现且更严重**：3 处数字互不相同（ROD-1） |
| Manifest 选择器 raw ID | **确认重现**：staging 步骤选择器（ROD-4）；production 步骤已改善 |

## 已复核排除的疑似问题（避免误报）

- "清空搜索后列表不恢复"：工具（fillInput 空值未触发 React 事件）造成的假象；原生事件复核清空后正常恢复 2 条。
- "preflight 能力组按钮点击无响应"：ego click 未命中造成的假象；JS 点击复核正常展开组明细卡片。
- "点「创建发布」无 dialog 打开（刷新后）"：检测选择器（`dialog[open]`）与实现（`div[role=dialog]`）不匹配造成的假象；深链/刷新实际均正常打开。
