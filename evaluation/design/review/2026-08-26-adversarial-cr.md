# Devpilot 项目模块：提交后对抗性产品 / 系统 CR

审查对象：`c9e3afcb`

日期：2026-08-26
结论：**NO-GO，需先关闭 5 个 P0。** 研究底稿总体严谨，但当前设计稿仍有错误的数据流、运行对象混淆、生产确认状态矛盾、可见布局碰撞，以及原始目标范围未完全闭合。它可以作为讨论稿，不能作为实现验收基线。

## 1. 审查范围与证据边界

- 研究：`2026-08-26-project-code-inventory.md`、`2026-08-26-current-visual-audit.md`、`2026-08-26-competitor-matrix.md`、`2026-08-26-product-review-and-design-brief.md`。
- 设计：OpenPencil F00–F12 的脚本、`.op` 和 13 张导出 PNG；逐张检查了裁切、重叠、对象语义、动作、状态与 A/D/S 标注。
- 代码复核：当前可达 route、release/settings/domain hooks、production confirm modal、Build/Deployment drawers、Prisma/AuditEvent 结论。
- 竞品：本轮素材绝大多数是官方文档与文档内控制台截图，证据等级为 B/C；Vercel Dashboard 只有登录墙 D。它们能证明产品模型或官方流程，不能证明登录后实时交互、键盘、响应式或异常恢复。
- 本 CR 不修改设计源、`.op`、导出、research 或 TODO；也不把静态设计稿上的 a11y 注释当作已实现证据。

## 2. 已通过的关键检查

1. F06 已消除错误的 `Staging` badge，画面只显示 Production scope。
2. F02/F07/F09 使用 390×844 紧凑列表/纵向顺序，未复用桌面横向表格；高频按钮大多画成 44px。
3. F10 未展示 secret value，只展示 reference metadata；报告也正确说明 plain value 与 secret value 的真实边界。
4. F12 把失败摘要放在 raw log 之前，保留脱敏/截断声明，方向正确。
5. 竞品矩阵明确区分 A/B/C/D 证据等级，并正确区分 rollback、redeploy、promote 的大部分语义；产品 brief 也明确删除了当前后端不支持的可点击能力。
6. 当前视觉审计明确承认未完成完整键盘、focus、200% zoom、颜色数值与读屏验证，没有伪称 WCAG 通过。

## 3. P0 findings

### P0-1 — F00 把并行领域误画成一条串行写链

- **画板 / 报告证据**：F00 把 `ReleaseOrder → BuildRun → ReleaseRun → EnvironmentVersion → ConfigRevision → Site → AuditEvent` 画成单向链；代码清单 §10.2/§11 则说明 release、config revision、Site 是不同写路径，AuditEvent 关联每次写。真实发布链还缺少 `ArtifactManifest`、production preview/confirm 和 staging/production 分叉。
- **对抗理由**：实现方若按此图建状态机会错误地认为 EnvironmentVersion 之后才产生 ConfigRevision/Site，并把一个 AuditEvent 当成全流程终点。它也掩盖了 `expectedInputHash + idempotencyKey` 只属于 production confirm，而不是所有写动作。
- **最小修复**：把 F00 改为三条分支：
  1. `ReleaseOrder → BuildRun → ArtifactManifest → staging ReleaseRun → production preview → production confirm → production Run/EnvironmentVersion`；
  2. `Environment config draft → POST config revision (CAS) → ConfigRevision + current pointer`；
  3. `Site CRUD / dry-run sync → Site / SiteSyncRun`。
  每个写节点分别连到自己的 `AuditEvent(actor, target, risk, result, time)`。
- **验收**：图中不再存在 `EnvironmentVersion → ConfigRevision → Site`；preview 明确为只读确认快照，不标成功；ArtifactManifest、CAS、idempotency 和独立 AuditEvent 均可见。

### P0-2 — F06 混淆“打开生产确认”“预览”“待审批”“最终确认”

- **画板 / 报告证据**：F06 同时显示“待生产审批 / 待核对 / Audit result pending”，却把 `确认生产发布` 画成启用 primary；A 标注又写成 `confirm → production preview → expectedInputHash/idempotencyKey → success`。当前代码实际先由 `ReleaseProductionView` 打开 `ProductionConfirmModal`，Modal 加载 `GET .../production-preview`，只有 snapshot 存在时才允许 `POST .../production-releases`；preflight `preApprovalAllowed=false` 时入口必须禁用（`release-production-view.tsx:52-78, 132-168`；`production-confirm-modal.tsx:38-88`；`use-production-releases.ts:48,89`）。
- **对抗理由**：pending approval 与可直接确认相互矛盾；把 preview 画在 confirm 之后还会导致操作者在未看到 snapshot 时执行高风险写入。前端又没有统一 capability matrix，API 仍可能返回 forbidden/approval-required。
- **最小修复**：F06 主页面动作改为 `核对生产发布`（打开 Modal）；Modal 单独画出 loading / load error + retry / empty snapshot / stale input / approval-required / ready 六态。最终 `确认生产发布` 只在 snapshot、gate、permission 均满足时启用，旁边显示 expected input hash 的短值和结果说明。
- **验收**：任何 `pending approval` 画面都没有启用的最终确认；preview 必须先于 POST；409/stale、403/approval-required、重复 idempotency 均有命名结果；关闭 Modal 后焦点回到 `核对生产发布`。

### P0-3 — F12 把成功 BuildRun #10 错写为失败部署/路由验证对象

- **画板 / 报告证据**：F12 的 Drawer 标题/事实使用 `BuildRun #10`，状态写 `failed`，provider 写 `server-executor`，A 标注用 `buildRunId=10`；但当前视觉证据 `09-release-deployment-log-drawer-desktop.png` 显示的是已完成 DeploymentRun，provider 为 `release-artifact / local-filesystem`，且 BuildRun #10 在当前页面为构建成功。代码中 `buildRunId` 打开 `ReleaseBuildLogDrawer`，staging 部署日志应由 `deploymentRunId` 打开，路由验证结论属于 DeploymentRun/verification evidence，不应改写 BuildRun 状态（代码清单 §5B.4/§5B.7；`release-step-deploy-panel.tsx:31-88`；`release-build-log-drawer.tsx:43-130`）。
- **对抗理由**：这是 domain identity 错误，不是文案问题。它会把构建成功误报成失败、把 provider 和日志类型串错，并让 deep link 打开错误 Drawer。
- **最小修复**：F12 选择一种真实对象并保持到底：
  - 若审查构建：`BuildRun #10 / succeeded / build log`，不附加 route verification failed；
  - 若审查部署：使用真实 `DeploymentRun <id>`、真实 provider/status，并用 `deploymentRunId`；BuildRun #10 只作为 source evidence。
  route verification 作为 deployment/business verification 子结论，不回写 BuildRun status。
- **验收**：Drawer title、query key、API response type、status、provider、日志和 repair action 指向同一 run；现有 BuildRun #10 不再显示 `failed`。

### P0-4 — F08/F10 仍有实际碰撞，且 F10 collision 时“保存修订”仍启用

- **画板 / 报告证据**：`09-F08 Settings Version - Desktop.png` 中操作链接越过 table action column，与 inspector 的 `Config delta/CreatedAt` 重叠；`11-F10 Variables & Secrets - Staged.png` 中 Collision 文案与 `Reload current` 重叠。F10 同时显示 CAS collision 和启用的 `保存修订`。TODO PMD004 写“无裁切/布局错误”，Evidence log 又承认操作列与状态文案仍待 CR，前后矛盾。
- **对抗理由**：F08 正是本轮 P0“消除状态/时间/操作碰撞”的验收页，当前导出直接失败；F10 则在 stale revision 下诱导提交必然失败的写动作。
- **最小修复**：F08 将 center table/inspector 改成不互穿的固定 grid，操作列保留足够宽度并检查所有行；F10 collision row 改为纵向 cause/impact/action，collision 存在时禁用 save，并提供 `重新载入当前修订`。
- **验收**：1440×1000 导出中任何文字、按钮、状态都不越界；F08 所有 action 完整可见；F10 stale/collision 时 save disabled、原因可见、reload 44px，reload 后 staged diff 可重新计算。

### P0-5 — 原始“所有功能/流程/页面”范围未闭合

- **画板 / 报告证据**：代码清单确认项目模块有 `/projects/create` 三步 intake、`/projects/new` 五步 ZIP 生成和 `/projects/:id/publish` 三步快捷发布；TODO scope 也包含发布向导。当前视觉审计 22 张图没有这三条完整流程，F00–F12 也没有它们的交互/状态设计。`18-release-wizard-step1-desktop.png` 是 ReleaseOrder 创建 Modal，不是 `/publish` 三步快捷发布。
- **对抗理由**：仅代码清单不能满足“视觉以及代码检查所有功能、流程、页面内容”；更不能用 workbench 12 帧代表 intake/generator/publish 的 loading/error/idempotency/download/retry 状态。发布向导还存在“文案列出 production，但自动状态机只到 staging”的 source-confirmed 风险，恰好未被视觉设计覆盖。
- **最小修复**：新增一份范围补齐 appendices（不必污染 workbench F01–F12）：对三条流程逐步截图、动作/API/model/audit、loading/error/empty/permission/idempotency、mobile 与 recovery 清单；若产品决定不改这些流程，也必须由用户明确确认 out-of-scope。
- **验收**：目标 1 的 route 清单 10/10 都有代码与视觉证据或 named blocker；目标 3 对每个发现有“改/不改/需后端”结论；`/publish` 明确“自动止于 staging，production 在详情另行确认”。

## 4. P1 findings

### P1-1 — A/D/S 注释不是逐动作 traceability ledger

多个 frame 只有一条泛化 A/D 注释，无法覆盖画面内所有控制：

| Frame | 画面动作 | 当前真实目标 | CR 结论 |
|---|---|---|---|
| F01 | `连接已有仓库` | route `/projects/create`；无本页写 API | A 未标主动作；也遗漏 `/projects/new` 第二入口 |
| F02 | `发布 / 详情 / 更多` | 发布应到 canonical `/projects/:id/releases`；overflow 需 menu/focus-return | 只标 Tap row/repair，三个动作未逐项落地 |
| F03 | `创建发布单` | `/projects/:id/releases?create=true` → `POST /projects/:id/delivery/releases` → ReleaseOrder + audit | 只写 `?create=true`，canonical route/API/model/audit 不完整 |
| F04 | `构建 / 证据` | `releaseStep=build` + POST builds；evidence 用 build/deployment/release run query 打开对应 Drawer | A 只覆盖进入详情和 create |
| F05/F07 | `修复入口` | `/projects/:id/domains`；环境 query 当前 unresolved，不能伪称精确 scope | 只写相对 `/domains`，未保留环境或承认 unresolved |
| F06 | `核对并确认 / 查看环境版本` | open Modal → preview GET → confirm POST；settings version route | 打开 Modal 与最终写入合并为一个动作 |
| F08/F09 | `切换版本` | `POST /projects/:id/delivery/environment-versions/:environmentId/actions`，production 还需 approved run | 只写“audited confirm”，未标 body/eligibility/error |
| F10 | `Review staged / Discard / 保存 / Reload current` | review/discard 是前端 draft；保存 POST config-revisions(CAS) | review/discard/reload 无明确结果；保存 endpoint 被缩写 |
| F11 | `Add/Edit/Delete/Preview` | POST/PUT/DELETE `/sites`; POST `/sites/:id/sync-plan {dryRun:true}` | 未标 delete high risk、preview team_admin、各自 AuditEvent |
| F12 | close/repair/log | query 与 run type 必须同源；close return-focus | 当前 run/query 错误，close 只有图标无可见 44px 容器 |

**最小修复**：在 F00 增加逐动作 ledger（Action → route/query → API → permission/risk → success model → named error → AuditEvent）；各 frame 只引用 action ID，避免把长说明塞进画面。
**验收**：所有可见 control 100% 有 action ID；无 destination 的 control 删除或标 `[UNRESOLVED/disabled]`。

### P1-2 — 多数必要状态只写在注释，没有画出可实现的变体

- F01/F02/F04/F08/F09 未画 loading/error/empty；F06 未画 preview load error、stale input、permission/approval rejection；F10 未画 save error 和 reload 后 diff；F11 未画 CRUD permission、validation asymmetry、sync polling/error；F12 未画 loading/error/empty/真正的 truncated disclosure。
- brief §8 要求每 frame 对 empty/loading/error/blocked/approval/staged 给明确变体或 `N/A + 原因`，当前 PNG 只覆盖一个主状态，S 注释不足以证明 interaction-ready。
- **最小修复**：F00 增加状态矩阵，关键高风险交互另加 state strip；无需把每个状态复制成完整屏。
- **验收**：每 frame 六态都有 visible variant ID 或 N/A 原因；mutation error 保留输入；polling/stale/permission 有命名结果。

### P1-3 — F11 同时制造双主动作、虚构 ready 数据并裁切操作

- 顶部 `添加域名入口` 与 empty row 内 `添加入口` 同时作为强动作，违背“一页一个 page primary”；ready row 的操作在右边被裁切。
- 当前 Picshare dev 页面实际为空；设计却显示 `Production · ready entries / TLS 自动·已就绪 / sync plan available`，没有标 specimen/hypothetical，也没有真实 domain/server/path。此状态可用于模式演示，但不能标成当前 Picshare 事实。
- **最小修复**：保留 empty state 的唯一近场 primary，顶部降为 secondary 或删除；ready row 标 `[STATE/specimen]` 并使用 API fixture/seed 中可追溯值，否则用字段占位而非“已就绪”。
- **验收**：操作列完整；empty 只有一个主动作；任何 Ready/TLS 状态都能回指 Site API/fixture。

### P1-4 — F03/F10/F11 的“真实 Picshare 数据”口径不成立

- 当前截图的 Picshare 组件是 `@picshare/mobile`、`picshare-proxy`、`admin`、`backend`，含真实 runtime/path/port；F03 改成单一 `Picshare web` 并写 `path/port 未返回`。
- 当前 vars 页面为空；F10 使用 `NODE_ENV / DATABASE_URL / PORT` 和具体 secret/resource URI，但未标 prototype draft source。
- 当前 domains 页面为空；F11 使用 Ready/TLS 数据但无 fixture 来源。
- **最小修复**：运行态已存在的字段直接复用；为展示 future state 而造的 draft/fixture 必须明显标 `[SPECIMEN/not current data]`，并禁止拿它证明当前能力。
- **验收**：每个示例值都能回到当前截图、API fixture/seed 或明确 specimen 标签。

### P1-5 — F01/F03/F04/F08/F10/F11 的裁切与碰撞说明 QA gate 失效

- F01/F03/F04/F11 的操作列在导出图右侧被截断；F08/F10 有重叠；F09 issue row 的 `核对 →` 与“source 与证据”发生视觉碰撞。
- README 宣称 desktop configuration 使用 190px rail + fixed main + 316px inspector，但实际中间列没有为 action text 保留边界。
- **最小修复**：对所有 13 张导出运行相同尺寸的 visual diff/checklist；表格宽度之和不得大于 parent；长动作收敛为 1–3 个 + overflow；issue row 在窄宽度切为两行。
- **验收**：13/13 PNG 人工复核无裁切/重叠；F08/F09 是专项 gate；TODO PMD004 只有在这一步后才能 completed。

### P1-6 — 设计稿的 dashboard shell 不是当前 Devpilot shell

- 当前运行截图使用左侧全局导航、组织/账号头部和现有 wordmark；F01–F12 改成顶栏 `项目 / 资源 / 审计`，去掉左侧 dashboard 导航，并新增 layers 图标。
- 这与输入要求“当前 Devpilot dashboard shell、repo token 语义、不造品牌皮肤”不一致，也会改变桌面有效内容宽度，掩盖真实断点问题。
- **最小修复**：桌面 frame 复用当前 shell 或 approved config 的明确无-shell画板，但不能混合成第三种 shell；若为聚焦设计而隐藏 shell，必须在画板标题标 `content-only`。
- **验收**：与 1440×1000 当前截图同 viewport 对比时，全局导航/顶部栏/内容起点一致，或被明确排除而不参与实现尺寸验收。

### P1-7 — a11y 注释把“设计目标”写成“当前已验证事实”

- F11 写 `focus returns after drawer/modal`，但代码清单明确 Add/Edit Site 自绘 modal 没有 Escape、focus trap、回焦；F08 写 keyboard row selection，但静态画板没有 selection/focus order spec；F12 只放 20px `x` icon，未画 44px icon-button 容器，却注释 close 44px。
- **最小修复**：S 注释分成 `current verified`、`design requirement`、`runtime unresolved`；画出 trigger ID、initial focus、trap boundary、Escape、return-focus target 和 44px hitbox。
- **验收**：未在真实实现验证的项目不再使用完成式；Site modal 缺口进入实现/测试清单。

### P1-8 — 竞品“直接纳入 P0”与产品 brief 的后端边界冲突

- competitor matrix §10 把 Render 的三种 save/deploy 分支、rollback 影响矩阵、事故锁定、DNS 记录组/传播/访问测试列为“P0 直接纳入设计稿”；product brief §3/§11 又正确标为“需后端/不画可点击”。
- **对抗理由**：研究读者可能把竞品成熟模式误解成当前 iteration 的实现承诺，尤其容易混淆 rollback、redeploy、promote 的重建与配置来源。
- **最小修复**：矩阵把这几项改为 `system proposal / needs backend contract`；仅把信息层级、禁用原因、差异摘要作为可直接借鉴的 UI 模式。
- **验收**：研究矩阵、brief、F00 三处优先级一致；任何 rollback/promote/redeploy/save branch 都带“是否重建、变量来源、目标资格、持久结果”的明确契约。

### P1-9 — F12 的 raw log 默认展开，和“渐进披露”目标矛盾

- F12 节点名写 `collapsed disclosure`，但 PNG 直接显示 4 行 raw log；关闭/展开 affordance 不存在。
- **最小修复**：默认只显示 `原始日志（4 行摘要，已脱敏/截断）` disclosure；展开后才显示 log，并维持 Drawer 单一 scroll boundary。
- **验收**：默认首屏只含结论、原因、关键证据；键盘可展开/收起；关闭 Drawer 回到原 trigger。

## 5. P2 findings

1. **中英文混排过多**：`Evidence / Selected detail / Review staged / Production ready entries / Source / Gate` 与当前中文产品不一致。保留 machine term 可用，但用户任务与状态应统一中文。
2. **F00 缺少可追溯 evidence ID**：只写“Audit / Competitors”，未列当前截图路径、竞品证据等级或报告 section。建议用 `E-CURRENT-05 / E-CODE-5B.6 / E-COMP-Railway-B` 这类短 ID。
3. **F01 信息量与当前目录不一致**：当前截图有 3 个 Picshare 项目和三项 summary；设计只画 1 个项目且去掉 summary。可作为重构方案，但需说明这是筛选结果/聚焦态，否则不能用来验证全目录扫视。
4. **F06/F08/F10 机器字段未全部使用稳定短值规则**：`expectedInputHash/idempotencyKey` 作为概念出现在主文案，但没有真实短值、copy affordance 或完整值 disclosure；应避免让实现方把字段名当用户文案。

## 6. 用户四项目标覆盖结论

| 用户目标 | 当前覆盖 | CR 结论 | 关闭条件 |
|---|---|---|---|
| 1. 视觉+代码检查所有功能/流程/页面/字段细节并列清单 | 代码清单强；workbench 视觉强；intake/generator/快捷 publish 缺视觉全流程 | **Partial** | 10/10 route 有视觉证据或 named blocker；三条缺失流程补状态/交互清单 |
| 2. 对 Vercel/Cloudflare 等逐项对比，最好每项截图、至少 Devpilot 截图 | 7 产品、官方 B/C 截图与 Devpilot 22 图已提供，证据边界写得清楚 | **Mostly met** | 把 backend-dependent P0 降级；每个“直接借鉴”绑定证据等级/截图 ID |
| 3. 收敛可抄部分并创建含交互/数据流的设计稿 | 13 frame 已交付；方向正确，但 P0 状态/模型/布局未过 | **Partial / NO-GO** | 关闭 P0-1~P0-4；逐动作 ledger 100%；13/13 PNG 无重叠裁切 |
| 4. 完成后打开所有设计稿 | commit 只能证明 `.op`/PNG 存在，不能证明 OpenPencil 当前打开状态；TODO PMD006 仍 pending | **Pending runtime acceptance** | 在兼容 OpenPencil 0.8.4 中打开单一 `.op`，确认 13 个 top-level frame 全部可见并记录打开状态 |

## 7. 修复顺序与最终验收

1. **系统语义先行**：修 F00 数据流、F06 preview/approval/confirm、F12 run identity。
2. **布局 gate**：修 F08/F10/F09 和所有操作列；重新导出 13 图逐张 QA。
3. **动作 ledger**：逐 control 绑定 canonical route/query、API、permission/risk、model、AuditEvent、named errors。
4. **状态/范围补齐**：关键变体 + intake/generator/quick publish 视觉 appendix。
5. **一致性复核**：competitor matrix 与 brief 的“直接借鉴 / 需后端 / 拒绝”标签一致。
6. **最终 GO 条件**：P0=0；P1 均有 owner/acceptance；13 top-level frame 名称/尺寸正确；13/13 导出无裁切重叠；OpenPencil 实际打开；commit/push 后再更新 PMD004/PMD006。

## 8. 关键视觉证据

### F06：pending approval 与启用确认并存

![F06 Production Approval](<../exports/07-F06 Release Detail - Production Approval.png>)

### F08：操作与 inspector 实际重叠

![F08 Settings Version Desktop](<../exports/09-F08 Settings Version - Desktop.png>)

### F10：collision 文案重叠且 save 仍启用

![F10 Variables Secrets Staged](<../exports/11-F10 Variables & Secrets - Staged.png>)

### F12：BuildRun / DeploymentRun / route verification 混淆

![F12 Deployment Evidence](<../exports/13-F12 Deployment Evidence - Log Drawer.png>)

### 当前真实部署 Drawer：completed DeploymentRun + release-artifact/local-filesystem

![Current deployment log drawer](<../../screenshots/2026-08-26/current/09-release-deployment-log-drawer-desktop.png>)
