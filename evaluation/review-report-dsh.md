# DSH 独立复核报告：zcode 对项目模块走查缺陷的修复（2026-08-22）

> 复核人：DSH 独立评审者（不采信修复声明结论，只信可运行证据）
> 复核基线：`5d56bcd2` 之上的未提交工作区（含 zcode 全部改动 + 本次补漏改动）
> 复核时间：2026-08-22
> 与 zcode 结论冲突时，本报告并列双方证据，以可运行证据为准。

---

## 〇、范围与口径

- 主报告称「66 个问题」（P0×3、P1×25、P2×38）；按三份分报告逐编号统计实为 **70 个编号**（信息/部署域 22：DEP-1..10、EV-1、INFO-1..11；发布域 20：WIZ-1..5、REL-1..4、ROD-1..11；配置/域名域 28：SET-1..18、DOM-1..10）。zcode 修复报告亦按 70 编号逐条闭环。本报告按 **70 编号** 出具 verdict（与 zcode 口径一致），并注明主报告「66」为计数误差（P2 实为 42 而非 38）。
- 复核方法：全量测试套件独立重跑 + 分域逐条代码核验 + 关键项聚焦 spec 独立重跑 + diff 全量回归审查；P0/P1 另按分报告复现步骤以 DOM 断言/纯函数断言独立复验（本环境容器 3120/3121 为镜像烘焙旧代码，不反映修复，故以测试 + DOM 断言为准，与 zcode 声明一致）。

---

## 一、独立运行证据（全部本次重跑，非采信既有日志）

| 套件 | 命令 | 结果 | 日志 |
|---|---|---|---|
| Web 全量单测 | `pnpm --filter @svton/devpilot-web test` | **exit=0，160 文件 / 640 用例全过** | /tmp/codex-tool-runs/svton/dsh-web-test.log |
| Web 类型 | `pnpm --filter @svton/devpilot-web type-check` | **exit=0，0 错误** | dsh-web-tc.log |
| Web lint | `pnpm --filter @svton/devpilot-web lint` | **exit=0**（仅存量 exhaustive-deps 警告） | dsh-web-lint.log |
| i18n parity | `pnpm --filter @svton/devpilot-web i18n:check` | **exit=0，4052 条 zh/en 键与 ICU 占位符一致** | dsh-i18n.log |
| API 全量 | `pnpm --filter @svton/devpilot-api test` | **2347 过 / 215 跳过 / 1 失败**：`repository-git-inspection.service.spec.ts` 真实 git 操作超时（5000ms），**与 zcode 改动无关**（该目录零 diff），隔离重跑 **exit=0 通过**，判定为存量 flaky | dsh-api-test.log、dsh-git-inspection-rerun.log |
| API 类型 | `pnpm --filter @svton/devpilot-api type-check` | **exit=0**（补漏后重跑） | dsh-api-tc.log |
| DEP-1 聚焦 | `jest deployment-secret-strip.utils.spec.ts` | **18/18 通过**（补漏后含新增 server-agent 用例） | dsh-dep1-fix-verify.log |
| server-agent 回归 | `jest server-agent` | **13 套件 / 39 用例通过** | dsh-server-agent-specs.log |
| executor 回归 | `jest server-executor deployment-secret-strip` | **30 套件 / 168 用例通过** | dsh-executor-regression.log |

结论：zcode 声明的「web 160/640、type-check/lint/i18n 全绿、API 2348 过」**基本属实**（我实测 2347 过 + 1 条与其无关的存量 flaky 超时，隔离重跑通过）。但全绿之下仍存在下述旁路缺口与声明出入，逐条列于 verdict 表与遗留风险节。

---

## 二、70 条 verdict 表

图例：✅ 已修复（证据充分）｜🟡 部分修复（注明缺口）｜❌ 未修复｜➖ 无法核验。证据列给出「跑的命令 / DOM 或纯函数断言 / file:line」之一。

### 2.1 项目信息 / 环境版本 / 部署记录域（22 条）

| 编号 | 严重度 | Verdict | 核验证据 |
|---|---|---|---|
| INFO-1 | P1 | ✅ | `repository-locked-identity-card.tsx:35-53,145-172` 重连前弹确认 Modal + `feedback.promise`（loading/成功/失败 toast）+ 按钮 loading；`repository-identity-ui.spec.tsx` 通过 |
| INFO-2 | P1 | ✅ | `repository-run-panel.tsx:129-179` 默认 20 条 + 「仅展示前 20 条，展开全部 N 条」+ 收起；spec 断言 25 条 → 20 → 展开全量，通过 |
| INFO-3 | P2 | ✅ | `breadcrumbs.tsx:48-54,78-79` SWR 拉项目名、完整 ID 进 title；`breadcrumbs.spec.tsx` 3 用例通过 |
| INFO-4 | P2 | ✅ | `project-component-table.tsx:61-62` 「配置已变更」`text-primary` → `text-foreground`，不再伪装可点 |
| INFO-5 | P2 | 🟡 | `repository-suggestion-readable-value.tsx:23-30` raw JSON 已折叠进 `<details>` + 滚动，facts 可读化；**缺**：折叠内 raw runId 未映射/高亮（zcode 自述遗留属实） |
| INFO-6 | P2 | ✅ | `repository-suggestion-review.tsx:182-183` high/medium/low → 高置信/中置信/低置信 |
| INFO-7 | P2 | ✅ | 页底重复审计链接已删（全仓 grep 仅剩身份审计一处） |
| INFO-8 | P2 | ✅ | `repository-locked-identity-card.tsx:56-64` 刷新走 `feedback.promise` + 按钮 loading |
| INFO-9 | P2 | ✅ | `project-information-panel.tsx:45-59` `role="tooltip"` + hover/focus 可视 tooltip + aria-label 双写 |
| INFO-10 | P2 | ✅ | `project-workbench-header.tsx:57-89` 外链（新窗口）+ 复制按钮（「已复制」反馈）+ truncate |
| INFO-11 | P1 | ✅ | `project-component-table.tsx:95-116` `findChange` 按结构化 serviceName 精确匹配 + 文本兜底需同时含 app+service；`project-component-table.spec.ts` 断言 backend=3000/admin=3001/不得吸走他行，通过 |
| EV-1 | P1 | ✅ | `project-route.utils.ts:68-75` 未知 view 删参数返回纠正 href + `project-route-host.tsx:38-43` router.replace + LoadingState；`environment-versions-panel.tsx` 已删除、零引用；`project-route-host.spec.tsx` 通过。**残余**：`use-release-order-workbench-navigation.ts:98` recoveryHref 仍指该 view（会被纠正到项目信息），zcode 自述为遗留建议，属实 |
| DEP-1 | P0 | ✅（补漏后） | 存储侧统一脱敏（`redactCommandPlanForPersistence` = 深度文本脱敏 ∘ stripSecretEnv），12 个声明持久化点逐一核对全部收口；DEP-1 spec 18/18（含明文 DSN/JWT/BOOTSTRAP 全消失、幂等、`$DEVPILOT_*` 占位保留）。**但复核发现 server-agent 适配器为持久化旁路**（`buildServerAgentCommandPlan` 原样写 `steps: input.steps`，队列边界重解析后的真实 secretEnvExport 可落库），**已由本次补漏修复并补测试**（见第四节）。历史存量明文清理 + 泄露 dev 密钥轮换仍为运维遗留 |
| DEP-2 | P1 | ✅ | `deployment-run-details.component.tsx:126-131` + `run-labels.ts:54-58`（succeeded/failed/cancelled 终态，blocked 可续不算）；spec 2 用例断言终态不再显示「等待审批」文案 |
| DEP-3 | P1 | ✅ | `deployment-panel.tsx:76-90` 完整 runId（等宽）+「清除聚焦」按钮 → router.replace 去 runId 留 view；`deployment-panel-focus-filters.spec.tsx:132-146` 断言完整 ID + URL 纠正 |
| DEP-4 | P1 | ✅ | `deployments-tab.tsx:34-42` banner 仅「无聚焦或聚焦即最新」且最新失败时出现；`deployments-tab-banner.spec.tsx` 3 用例（聚焦旧失败运行隐藏 banner） |
| DEP-5 | P1 | ✅ | `deployment-run-filters.model.ts` 纯函数 + `deployment-panel.tsx` 筛选条写 URL（runEnv/runStatus/runSource/runSort）+ 「筛选后 N/M 条」；model spec 4 + panel spec 2 通过 |
| DEP-6 | P2 | 🟡 | `deployment-run-details.component.tsx:141-158` 结构化日志逐行渲染（error 标红），raw JSON 保留下方折叠；**缺**：执行结果（result）仍 raw JSON（manifestId/deploymentUri 字段化未做，zcode 自述遗留） |
| DEP-7 | P2 | ✅ | `deployment-run-list.tsx:89-96` 失败运行 error 摘要直显列表行（truncate+title） |
| DEP-8 | P2 | 🟡 | 来源/目标类型枚举已本地化（`release_order`→发布单、release-artifact/server→中文）；**残余**：首行无环境徽章/缺操作人系数据缺失（environment/actor=null），代码如实降级，zcode 判定合理 |
| DEP-9 | P2 | ✅ | `release-delivery-compatibility-banner.tsx` 更名「历史数据迁移说明」，口径说明「含未展示的早期记录」 |
| DEP-10 | P2 | ✅ | `deployment-run-details.component.tsx:50-56` facts break-all → truncate+title；`f453-long-values.spec.tsx` 2 用例通过 |

### 2.2 发布域（20 条）

| 编号 | 严重度 | Verdict | 核验证据 |
|---|---|---|---|
| WIZ-1 | P0 | ✅ | `release-version-display.model.ts:8-9` 常量单反斜杠 + `release-order-create-modal.tsx:93` `pattern={RELEASE_VERSION_INPUT_PATTERN}`（JS 表达式不再走 JSX 字符串转义）；spec 断言 DOM pattern==常量、不含 `\\.`、`99.0.0`/`1.4.0` 放行、`99.0`/`v99.0.0` 拦截——通过。API 侧 DTO 同规则校验（`release-order.dto.ts` @Matches 正则，`release-order.dto.spec.ts`） |
| WIZ-2 | P1 | ✅ | `project-delivery-route.tsx:42-49` closeCreateModal 同步删 `create=true`；spec「关闭后 router.replace → /projects/:id?view=releases 且可重开」通过 |
| WIZ-3 | P1 | ✅ | `use-release-orders.ts` 暴露 createError + `release-order-create-modal.tsx:114-122` role=alert 渲染；spec 断言 `boom-backend-4xx` 上屏 |
| WIZ-4 | P2 | ✅ | modal 内 inline 红字 + aria-invalid + 按钮禁用原因常显（nameEmpty/versionEmpty/versionInvalid 三态）；spec 2 用例 |
| WIZ-5 | P2 | ✅ | `closeAndReset` 清空三项 state；spec 断言取消后输入框为空 |
| REL-1 | P1 | ✅ | `use-release-orders.ts:34-40` 白名单（9 状态枚举，stageId→null）+ URL 写回（保留 view/releaseOrderId）+ 挂载恢复；`use-release-orders-url-sync.spec.tsx` 5 用例通过。`releasePlanId` 深链显式忽略待产品确认（zcode 自述） |
| REL-2 | P2 | ✅ | `release-order-list-row.tsx:69-76` 「发布单 #前 8 位」+ 完整 ID 折叠 title，不再裸露整串 cuid |
| REL-3 | P2 | ✅ | `release-orders-panel.tsx:67-68` 真表格 + `min-w-[1040px]` + overflow-x-auto 容器，操作列不再裁切。**声明小出入**：zcode 称「既有回归 spec 覆盖」，实测无 spec 断言 min-w 结构（仅代码成立） |
| REL-4 | P2 | ✅ | `release-order-list-row.tsx:53-57` 草稿标题加「草稿 · 」前缀（releaseDraftTitlePrefix） |
| ROD-1 | P1 | 🟡 | **定义级单源成立**：`release-gate-decision-counts.model.ts:16-25` 单一 selector（blocked=blocker+integrityErrors，manual 扣已确认），决策卡（`release-workbench-summary.model.ts:29`）、高级检查头（`release-gate-summary.tsx:51`）、技术证据 tab（`release-workbench-evidence.tsx:61`）三处消费同一函数，spec「三处同数」通过。**缺口**：三处输入的 decision **对象非同源**——决策卡按当前执行阶段取 `decisions.staging/production`（`release-workbench-summary.model.ts:75-79`），高级检查头与技术证据 tab 硬编码 `decisions.build`（gate-summary:44 / evidence:61）。走查对象（staging 执行中）仍可出现决策卡「阻断 3」vs 技术证据「阻断 0」同屏。属跨阶段口径问题，需产品决策（阶段限定词或输入对齐），本次未动 |
| ROD-2 | P1 | ✅ | `use-production-releases.ts:10` errorKind='load'/'action'；仅 action 失败渲染 alert，load 失败显中性空态；spec 2 用例（load 失败无 alert、action 失败有） |
| ROD-3 | P1 | ✅ | `release-production-prerequisite.model.ts:11-17` 单源判定，步骤 03（staging-step:121）与步骤 04（controller:116→stage-card:174）消费同一函数同一入参来源；spec 6 处通过（含 dry-run 不算成功部署） |
| ROD-4 | P1 | ✅ | `release-manifest-label.utils.ts:18-27` BuildRun #N · Manifest sha256:前19 位，staging 选择器/当前制品摘要/production 选项统一；spec 断言 `JSON.stringify` 不含 cmsn cuid |
| ROD-5 | P2 | ✅ | 「证据已于 <ISO> 过期」文案与消息 key 全仓 0 命中（该渲染路径已随工作台改版消失），现存时间渲染走 formatTime/toLocaleString。**声明不准确处**：`release-production-preflight-list.tsx:73` 仍直接渲染 `check.checkedAt` 原始 ISO（非走查原缺陷位置，严重度低，见遗留） |
| ROD-6 | P2 | ❌ | `release-manifest-evidence.tsx:22-24` 仍渲染 raw componentKey（组件缺 name 字段，类型层无映射）；zcode 如实标遗留，需后端补名或建 id→名称映射，建议单独迭代 |
| ROD-7 | P2 | 🟡 | 「继续构建」在门禁阻断时 disabled+title 原因 + 「前往基线检查（步骤 01）」链接已满足；「放弃草稿」无 UI（删除语义/审计待产品确认）——与 zcode 声明一致 |
| ROD-8 | P2 | ✅ | 按钮文案改「前往基线检查（步骤 01）」与跳转行为一致；消息目录无残留「查看门禁详情」 |
| ROD-9 | P2 | ✅ | `release-order-stepper.tsx:64-66` 状态文案与步骤名相同时不再重复渲染/朗读 |
| ROD-10 | P2 | ✅ | 「查看此前 N 条」为原生 `<details>/<summary>`（键盘可达），不再是 div |
| ROD-11 | P2 | 🟡 | 步骤名 ellipsis 截断 + ≤820px 竖排完整名；1280–821px 区间仍截断（zcode 自述部分，需视觉验证辅助） |

### 2.3 项目配置 / 域名与入口域（28 条）

| 编号 | 严重度 | Verdict | 核验证据 |
|---|---|---|---|
| SET-5 | P0 | ✅ | `settings-env-target-fields.tsx:33` Select placeholder（空值可见占位）+ `settings-env-target-edit-dialog.tsx:119` `disabled={!draft \|\| !target.providerKey}` + `:124-126` 禁用原因 + `:73-81` useEffect 依赖 `[draft]`；spec「SET-5」断言 空值占位/保存禁用/原因显示 → 选中 provider 后 `save.disabled===false` 且原因消失（5 用例通过） |
| SET-6 | P1 | ✅ | `environment-config-resource-editor.tsx:76-83` 逐级原因 addDisabledReason（缺资源/缺组件/未确认映射）+ `:76` 零映射豁免 + `:133-137` 无组件引导；spec 3 用例断言「合法输入下按钮可用且 onChange 收到正确绑定」 |
| SET-1 | P1 | ✅ | `environment-version-list.tsx:35-40,73-85` 行下展开「版本详情」面板（版本/名称/来源/修订/证据数/时间）可收起；spec 断言 colspan 面板出现 |
| SET-2 | P1 | ✅ | `row-panels.tsx:99-119` 变更面板（branch@sha + 构建修订），无 diff 时明确「无变更明细」；spec 通过 |
| SET-3 | P2 | ✅ | `environment-version-list.tsx:177-195` 禁用原因按 当前已生效/需生产审批/目标未就绪/执行中 渲染；spec 2 用例 |
| SET-4 | P1 | ✅ | 溢出菜单「技术证据」展开证据面板（计数直显 + manifest/digest/ID 折叠 details）；spec 断言面板出现且 ID 在折叠区内 |
| SET-7 | P1 | ✅ | `project-environment-list.ts:9-28` `selectExistingProjectEnvironments` 过滤遗留种子 + `environment-settings-detail.tsx:163` 复用目标改用派生；spec 断言只列同项目 staging、排除源/archived |
| SET-8 | P2 | 🟡 | 代码层统一「中文名 (key)」（选择器/域名页/复用弹窗/验证 tab）；**残余**：production 显示名「Production」为 DB 数据侧名称，需数据侧改名（zcode 自述待产品确认） |
| SET-9 | P2 | ✅ | 面包屑项目段用项目名（同 INFO-3）；`route-labels.ts:13` Domains→「域名与入口」 |
| SET-10 | P2 | 🟡 | Provider 行本地化标签（SSH (ssh-v1)/本地文件系统 (local-filesystem-v1)，raw key 折叠 title）；**残余**：资源 kind、修订 source、域名状态 draft、服务器 cuid 等仍上屏（需产品文案表，zcode 自述遗留） |
| SET-11 | P2 | ✅ | `environment-env-import-modal.tsx:99-108` 渲染 valid/total 摘要 + 忽略行数；spec 断言 invalidCount（zcode 判定不复现成立，现码有摘要） |
| SET-12 | P2 | ❌ | 密钥引用双草稿 + 草稿无法移除：zcode 如实标遗留（需追踪 onUseSecret→secrets 双写路径 + 设计删除交互）；本工作树无修复也无锁定 spec |
| SET-13 | P2 | ✅ | `environment-resource-binding-table.tsx:56-63` 无修订空态「该环境还没有配置修订；创建首个配置修订后即可绑定资源实例」；「45 部署 vs 0 版本」为不同对象口径，zcode 判定非代码缺陷合理。**注意**：无修订分支无专用 spec 断言（代码成立、锁定不全） |
| SET-14 | P1 | ✅ | `environment-version-list.tsx:47` table-fixed + min-w-[640px] + 证据列 `hidden 2xl:table-cell` + 百分比列宽；spec 以列结构类断言（jsdom 无真实布局，spec 已注明局限） |
| SET-15 | P2 | ❌ | 建议表列宽/滚动阴影：zcode 如实标遗留（jsdom 无法验证视觉布局，盲改有回归风险） |
| SET-16 | P2 | ✅ | `environment-settings-detail.tsx:86-107` 基线快照比对 + `revision-bar.tsx:25,50-55,64-67` 无变更禁用 + 「暂无待保存的配置变更」提示 + title；spec 2 用例（clean 禁用 / dirty 可用） |
| SET-17 | P2 | ✅ | `revision-bar.tsx:38-45,69-96` 计数变可点 toggle + 修订列表（R# · 当前标记 · 时间 · 说明 · 操作人）；spec 展开/收起通过 |
| SET-18 | P2 | ✅ | `settings-env-verification-tab.tsx:22-23,35-40` 文案 `{environment}` 参数化（environmentDisplayName），不再硬编码 Production |
| DOM-1 | P1 | ✅ | `sites/domain-format.utils.ts:17-46`（段规则/TLD≥2/泛域名/CSV 别名）+ `add-site-modal.tsx:74-75,94-97,152` 提交前校验 + noValidate；spec 17 用例（`not_a_valid_domain!!` 拦截且零请求、合法值仍走 POST） |
| DOM-2 | P1 | ✅ | `add-site-modal.tsx:76-90` 字段级错误 + `basic-fields:180-187` role=alert inline 红字 + aria-invalid + formIncompleteHint；spec 断言空提交零请求 + 提示上屏 |
| DOM-3 | P1 | ✅ | `project-domains-route.tsx:106-110` 点击开弹层 + `project-domains-config-preview.tsx`（loading/数据/空态三态）；spec 路由级断言点击开弹层并请求计划 |
| DOM-4 | P1 | ✅（不复现+测试锁定成立） | 链路完整：`project-domains-table.tsx:63-67` → `use-sites.ts:134-165` deleteTarget → ConfirmDialog（danger + 点名）→ 显式确认才 `DELETE:/sites/{id}`；spec 真断言「确认前 confirmDelete 零调用、确认后恰一次」 |
| DOM-5 | P2 | ✅ | `add-site-modal.tsx:131-134`/`edit-site-modal.tsx:120-122` role="dialog" + aria-modal + aria-labelledby；`modal-accessibility-contract.spec.ts` 4 用例通过 |
| DOM-6 | P2 | 🟡 | `runtime-config-fields.tsx:140-144` 勾选 Basic Auth 渲染说明（凭据由代理侧 /etc/nginx/.htpasswd 管理），不再「可开无处填」；完整凭据链路（存储/生成/下发）需 API 数据模型扩展，列入待产品确认（zcode 自述） |
| DOM-7 | P2 | ✅ | `edit-site-modal.tsx:130` 标题「编辑：{name}」点名对象 |
| DOM-8 | P2 | ✅ | `use-sites.ts:45-49` `?new=true` 参数变 true 时显式 setShowModal(true)（SPA 内点击可触发）；代码证据成立，无专用 spec（弱证据） |
| DOM-9 | P2 | ✅ | `runtime-config-fields.tsx:86-97` 空代理渲染「前往创建代理配置 →」（/proxy-configs?create=true） |
| DOM-10 | P2 | 🟡 | `add-site-modal.tsx:134` max-h-[90vh] + overflow-y-auto 整面板滚动（按钮可滚到，优于走查时被裁死）；「内容滚动+底部固定」布局重构未做（zcode 自述遗留） |

### 2.4 verdict 汇总

| 类别 | 已修复 | 部分修复 | 未修复 | 无法核验 | 合计 |
|---|---|---|---|---|---|
| 信息/部署域 | 19（含 DEP-1 补漏后） | 3（INFO-5、DEP-6、DEP-8） | 0 | 0 | 22 |
| 发布域 | 16 | 3（ROD-1、ROD-7、ROD-11） | 1（ROD-6） | 0 | 20 |
| 配置/域名域 | 22（含 DOM-4 不复现+锁定） | 4（SET-8、SET-10、DOM-6、DOM-10） | 2（SET-12、SET-15） | 0 | 28 |
| **合计** | **57** | **10** | **3** | **0** | **70** |

- **P0 × 3 全部闭环**：DEP-1（补漏后）、WIZ-1、SET-5（SET-6 同轮）。
- **P1 × 25**：24 条已修复；ROD-1 为部分修复（见 2.2 证据，跨阶段输入非同源，需产品决策）。
- **未修复 3 条均为 P2**（ROD-6、SET-12、SET-15），zcode 均如实标注遗留，无虚假修复。
- **未发现任何「声明已修但代码不存在或测试不通过」的虚假修复**；发现 3 处声明级出入：REL-3（spec 覆盖弱于声明）、ROD-5（「全部时间渲染走 formatTime」不准确，preflight-list 有 raw ISO）、ROD-1（「三处同源」仅定义级成立）。

---

## 三、diff 回归审查结论

### 3.1 改动范围（与越界检查）

- 改动文件分布：`apps/devpilot-web` 85、`apps/devpilot-api` 29、`packages/ui` 2、杂项 3（AGENTS.md +1 行 skill 引用、design-qa.md 工作台设计 QA 记录、docs-internal/todos/INDEX.md 索引更新）。
- **越界结论**：所有代码改动均落在项目模块工作台/修复相关文件上。API 侧 29 个文件全部映射到审计项（DEP-1 脱敏族 12 个、release-delivery 发布单/门禁族 14 个、schema.prisma 新增 `releaseName` 列 + 回填迁移）。`packages/ui`（useDialogFocus/useModalLayer）为 modal 无障碍/层级修复（DOM-5/模式 8 族）。杂项 3 个为文档/索引更新，无逻辑代码越界；`AGENTS.md` 增加「改 workbench UI 前必读两份 design skill」规则，属合理防护性文档。`.openpencil-mcp-setup.py`、evaluation/、mockups/ 为走查/评审既有产物，非 zcode 引入。
- 删除文件仅 2 个：`environment-versions-panel.tsx` + 其 spec（EV-1 死代码清除），全仓零残留引用。

### 3.2 raw ID 上屏检查（新增项）

- 对全部 46 个被改 .tsx 做 `{x.id}`/cuid 渲染扫描：**无新增裸 ID 上屏**。REL-2（短号）、ROD-4（BuildRun #N）、INFO-3/SET-9（项目名）均符合「技术 ID 折叠/映射」契约；DEP-3 聚焦条显示完整 runId 属修复需求本身。
- **复核新发现 2 处 P2 级 raw 展示**（均为存量或低风险，非本次引入）：① `settings-env-targets-tab.tsx:131` 平铺完整 `current.versionHash`（64 位十六进制，有「目标配置指纹」标签，与 SKILL「技术 ID 留 details/检查面板」轻度张力）；② `release-production-preflight-list.tsx:73` 直接渲染 `check.checkedAt` 原始 ISO 时间戳。

### 3.3 死按钮检查（新增项）

- 对全部被改 .tsx 做多行 `<Button` 扫描（onClick/type/href/disabled/loading 任一存在即非死按钮）：**未发现新增死按钮**。本域全部 enabled 按钮均有 handler 或带原因的禁用态。

### 3.4 workbench 契约冲突检查

- 对照 `project-skills/devpilot-project-workbench-design/references/workbench-contract.md`：表格专用操作列（3 直 + 溢出菜单）、单页主行动、环境选择器仅现存环境、技术证据折叠进 details、未恢复独立环境版本页（EV-1 符合「不恢复独立环境版本页」）、1280px 不横向压碎表格（REL-3/SET-14 用 min-w + 滚动容器）——**均符合，未发现冲突**。

### 3.5 回归风险提示

- jsdom 无真实布局：SET-14/REL-3 的「1280px 不重叠/不裁切」以列结构类断言替代（spec 已注明局限）；真实视口复核需在容器镜像重建后进行（zcode 自述一致）。
- API 全量 1 条 flaky（repository-git-inspection 超时）与本次改动无关，但建议后续加大该用例 timeout 或拆分。

---

## 四、补修清单（本次补漏，改动文件 + 测试）

复核发现 zcode 的 DEP-1 修复存在**一个真实旁路缺口**：server-agent 适配器路径未走 `redactCommandPlanForPersistence`，队列边界重解析后的真实 `secretEnvExport`/明文命令可随 `commandPlan` 落库。根因明确、改动 ≤50 行，按任务边界直接补修并补测试：

| 文件 | 改动 |
|---|---|
| `apps/devpilot-api/src/server-executor/adapters/server-agent-dispatch-plan.utils.ts` | `buildServerAgentCommandPlan` 的 `steps: input.steps` → `steps: redactCommandPlanForPersistence(input.steps)`（+ 防回归注释；agent 执行读 inputSnapshot，不受影响） |
| `apps/devpilot-api/src/server-executor/adapters/server-agent-dispatch-result.utils.ts` | 4 个 result builder（cancelled/dryRun/blocked/dispatchFailure）的 `commandSteps: input.steps` → 统一脱敏 |
| `apps/devpilot-api/src/server-executor/adapters/server-agent-dispatch-success-result.utils.ts` | dispatchSuccess builder 同上 |
| `apps/devpilot-api/src/server-executor/server-agent-task-pull-finish-sync-result.utils.ts` | task-pull finish sync builder 同上 |
| `apps/devpilot-api/src/deployment/deployment-secret-strip.utils.spec.ts` | 新增「server-agent adapter plan and result builders never persist plaintext secrets (DEP-1 bypass)」用例：明文 write_env 输入经 buildServerAgentCommandPlan + 6 个 result builder 后全部 `[REDACTED]`、键名保留、无 secretEnv/secretEnvExport 字段 |

验证（本次真实运行）：DEP-1 spec **18/18 通过**（原 17 + 新 1）；server-agent 全量 spec **39/39**；server-executor+deployment 回归 **168/168**；API type-check **0 错误**。未做任何 git 写操作（无 commit/push/reset）。

## 五、遗留风险与给人最终审核的重点提示

### 需人工/产品决策（3 项，本次未动）

1. **ROD-1 跨阶段计数口径**（P1，建议优先）：决策卡按当前阶段取数、高级检查头/技术证据 tab 固定取 build。staging 执行中的发布单仍可能「决策卡阻断 N」与「技术证据阻断 0」同屏。建议二选一：① 三处统一取「当前阶段」决策并在证据 tab 文案加阶段限定词（如「当前阶段阻断 N」）；② 证据 tab 改展示全目录阻断（build+staging+production 汇总）并明示口径。改动量小，但口径选择需产品拍板，故本次只列方案未动手。
2. **EV-1 残余 recoveryHref**：`use-release-order-workbench-navigation.ts:98` 的恢复链接仍指向已删除的 environment-versions view（会被显式纠正到项目信息，目的地误导）。建议改指发布列表 `?view=releases`，或评估直接在 production 步骤内联恢复（已有 `environment-recovery-dialog.tsx` 能力）后删除该外链。
3. **ROD-7「放弃草稿」删除语义**：是否允许删除草稿发布单、是否留审计，需产品确认（zcode 已列待确认项，本报告背书）。

### 遗留清单（P2，建议排期不阻塞）

- 未修复 3 条：ROD-6（组件名 cuid 映射，需后端补 name 或建映射表）、SET-12（密钥双草稿+删除交互）、SET-15（建议表列宽，需视觉走查配合）。
- 部分修复缺项：INFO-5（折叠内 runId 映射/高亮）、DEP-6（执行结果字段化）、DEP-8（数据缺失字段）、SET-8（production 显示名数据侧改名）、SET-10（枚举文案表）、DOM-6（Basic Auth 凭据链路立项）、DOM-10（弹窗底部固定）、ROD-11（1280–821px 步骤条形态，需视觉验证）。
- 复核新发现 P2 级展示：`settings-env-targets-tab.tsx:131` versionHash 平铺、`release-production-preflight-list.tsx:73` raw ISO 时间戳（均可 1 行折叠/格式化，随下次体验迭代处理）。

### 运维遗留（DEP-1 安全项，超出本任务边界，必须人工执行）

1. **历史明文数据清理**：2026-07-29 11:50 等存量 `DeploymentRun.commandPlan` 仍含明文（本次修复只保证新写入不泄露，含 server-agent 旁路补漏后），需 DB 侧重写脱敏。
2. **泄露密钥轮换**：走查截图暴露的 `65a75047…`（DB 密码）、`f383-picshare-jwt-secret-dev`、`f383-bootstrap-admin-pwd-dev` 应视为已泄露并轮换。
3. **存量 flaky**：`repository-git-inspection.service.spec.ts` 真实 git 超时（5000ms），建议加 timeout 或拆分，避免 CI 误红。

### 给最终审核人的一句总结

zcode 的 70 条修复中 **57 条证据充分、10 条部分修复均如实标注、3 条未修复均为 P2 遗留且声明诚实**，P0 三件套（DEP-1/WIZ-1/SET-5+SET-6）真实闭环；唯一需要**在合并前处理**的是本报告补修的 DEP-1 server-agent 持久化旁路（已修 + 测试锁定）与需产品拍板的 ROD-1 跨阶段计数口径；其余为可排期的 P2 体验项与必须人工执行的运维项（历史明文清理 + 密钥轮换）。
