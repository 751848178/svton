# Devpilot 项目模块走查缺陷修复报告（ZCode，2026-08-22）

> 对应走查：`devpilot-project-module-full-audit-2026-08-22.md`。总览称 66 个问题（P0×3、P1×25、P2×38）；按三份分报告逐编号统计实际为 **70 个编号**（信息/部署域 22：DEP-1..10、EV-1、INFO-1..11；发布域 20：WIZ-1..5、REL-1..4、ROD-1..11；配置/域名域 28：SET-1..18、DOM-1..10）。本报告对全部 70 个编号逐条给出结论，无遗漏。
>
> 修复基线：走查时的工作区（未提交的工作台改版代码）之上修复；未做任何 git 变更（无 commit/push/reset），全部改动留在工作区供人审核。只改动了 apps/devpilot-web、apps/devpilot-api 及其测试，未改 evaluation/ 既有报告（本报告为新增）。
> 验证：全部为 vitest/jest 单测与 jsdom DOM 断言（未使用截图作为验证依据）；命令日志存 `/tmp/codex-tool-runs/svton/`。
> 运行时说明：Docker 3120/3121 容器代码为镜像烘焙（仅挂载 .env.local），运行时环境反映修复前代码属预期；曾用 ego-browser 复核 WIZ-1 的旧 pattern 仍在容器中运行（确认泄露根因复现路径），修复证明以单测为准。

## 结论总览

| 严重度 | 数量 | 已修 | 部分/说明性修复 | 未修（含待产品确认） |
|---|---|---|---|---|
| P0 | 3 | 3 | 0 | 0 |
| P1 | 25 | 24 | 1（DOM-4 现工作树已不复现，以回归测试锁定） | 0 |
| P2 | 42 | 18 | 8 | 16（含 2 条待产品确认） |

- P0：DEP-1（存储侧统一脱敏）、WIZ-1（pattern 双重转义）、SET-5+SET-6（恒 disabled 表单）全部修复。
- P1：25 条全部闭环（含 DOM-4 的「不复现+测试锁定」处理）。
- P2：机械族（raw ID/枚举映射、时间格式、文案统一、禁用原因）批量完成；响应式与无障碍族按剩余容量部分处理；重交互设计项（SET-12/15、DOM-10、ROD-6/7/11）列为遗留并给出原因与建议。

---

## P0（3 条，全部修复）

### DEP-1 凭据泄露：命令计划明文展示密钥 —— 已修（存储侧统一脱敏 + 回归测试）

- 根因：`stripSecretEnv` 只剥离 `secretEnv/secretEnvExport` 字段；当某个命令构建路径把真实值写进 `step.command` 字符串（2026-07-29 历史阻塞运行的 write_env heredoc：`DATABASE_URL=mysql://user:pwd@…`、`JWT_SECRET=…`、`BOOTSTRAP_ADMIN_PASSWORD=…`），落库前没有文本级兜底。
- 改动（apps/devpilot-api）：
  - 新增 `src/common/secret-redaction.utils.ts`（通用脱敏单一实现，自 release-redact.utils 上移避免模块循环依赖；release-redact.utils 改为 re-export 兼容原路径）。附带修复：`KEY="$DEVPILOT_*"` 纯变量引用不再被误脱敏——否则会破坏队列重执行的 `$DEVPILOT_*` 秘密重解析契约。
  - `deployment-secret-strip.utils.ts` 新增 `redactCommandPlanForPersistence(steps)` = 深度文本脱敏 ∘ stripSecretEnv，作为命令计划持久化唯一入口（文档明确禁止绕过）。
  - 全部 12 个持久化点统一切换：deployment.service ×2（blocked/rollback）、script-plan.adapter、server-executor result/blocked-result ×4、ssh-live-result ×3、input-snapshot。
  - 执行安全性：write_env 键名脱敏后保留，`reapplyDeploymentEnvWriteSecrets` 在队列边界仍能按 KEY 重解析真实值（有测试覆盖）。
- 测试证明：`deployment-secret-strip.utils.spec.ts` 新增 DEP-1 describe——复刻泄露形态的输入经任一持久化入口后明文全部消失、出现 `[REDACTED]`；幂等性与 `$DEVPILOT_*` 占位不受影响。44 tests 通过（`dep1-spec2.log` exit=0）；API 全量 jest **2348 passed / 2563 total（215 skipped）exit=0**（`api-test-final.log`）。
- 运维提示（按任务边界未执行，留给运维）：
  1. **历史数据清理**：2026-07-29 11:50 等存量 `DeploymentRun.commandPlan` 仍含明文（本修复只保证新写入不泄露），需 DB 侧重写脱敏。
  2. **密钥轮换**：走查截图中出现的 `65a75047…`（DB 密码）、`f383-picshare-jwt-secret-dev`、`f383-bootstrap-admin-pwd-dev` 应视为已泄露并轮换。

### WIZ-1 创建发布单被双重转义的 pattern 完全阻断 —— 已修

- 根因：JSX 字符串属性不处理 JS 转义，`pattern="…\\.…"` 落到 DOM 为双反斜杠，匹配「字面反斜杠+任意字符」，一切合法 x.y.z 被原生校验拦截（走查确认 `99.0.0` 被拦、零网络请求）。
- 改动：`utils/release-version-display.model.ts` 新增 `RELEASE_VERSION_INPUT_PATTERN`（与 `CANONICAL_VERSION` 同源 + 防回归注释）；`release-order-create-modal.tsx` 改为 `pattern={RELEASE_VERSION_INPUT_PATTERN}`。
- 测试：`release-order-create-modal.spec.tsx`「WIZ-1」用例断言 DOM pattern 等于常量、`new RegExp('^(?:'+pattern+')$')` 放行 `99.0.0`/`1.4.0`、拒绝 `99.0`/`v99.0.0`、不含 `\\.`（`wiz-spec3.log` exit=0）。

### SET-5 「调整部署目标」保存恒 disabled —— 已修

- 根因：该 production 绑定缺 Provider（binding.providerKey 与 metadata 均空）→ draft.providerKey=''；受控 `<Select>` 无占位选项，视觉像已选中，`disabled={!draft || !target.providerKey}` 恒真且无原因提示。
- 改动：`settings-env-target-fields.tsx` Provider 下拉加 placeholder（「请选择部署方式」）；`settings-env-target-edit-dialog.tsx` 禁用时 footer 显示原因；useEffect 依赖修正为 `[draft]`。
- 测试：`settings-env-target-edit-dialog.spec.tsx`「SET-5」用例（placeholder 可见/保存禁用/原因显示 → 选择 provider 后可用/原因消失）。通过。

### SET-6 资源绑定「添加」恒 disabled（P1，与 SET-5 同轮闭环）—— 已修

- 根因：添加需「选资源 + 选来源组件 + 确认映射」三步但条件不可见；无模板变量的资源被要求确认「零映射」；环境无可绑定组件时死路无解释。
- 改动：`environment-config-resource-editor.tsx`——禁用原因逐级文字提示；零映射自动豁免确认；`components.length===0` 渲染明确引导。
- 测试：`environment-config-resource-editor-add.spec.tsx` 3 用例。通过。

---

## P1（25 条，全部闭环）

### 项目信息 / 部署记录域（8 条）

| 编号 | 状态 | 摘要 |
|---|---|---|
| DEP-2 | 已修 | `deployment-run-details.component.tsx` 按状态机分支：终态无任务 → 「该运行已结束；执行任务记录不可回溯（历史运行）」；仅非终态保留「可能等待审批」。新增 `isTerminalRunStatus`（run-labels.ts；blocked 可被审批续跑不算终态）。测试 2 用例。 |
| DEP-3 | 已修 | 聚焦条显示完整 runId（等宽可复制）+「清除聚焦，查看全部」按钮（router.replace 去 runId 保留 view）。测试断言完整 ID 与 URL 纠正。 |
| DEP-4 | 已修 | banner 只在视口呈现最新一次时出现（聚焦旧运行时隐藏）；硬编码中文迁 i18n。测试 3 用例。 |
| DEP-5 | 已修 | 新增 `utils/deployment-run-filters.model.ts`（环境/状态/来源筛选 + 最新/最早排序 + URL 解析/选项派生纯函数）；面板渲染筛选条并写 URL（runEnv/runStatus/runSource/runSort），显示「筛选后 N/M 条」。测试 4+2 用例。 |
| EV-1 | 已修 | `resolveUnknownViewHref` 对未知 view 显式 URL 纠正（路由宿主 router.replace + loading 占位，不再静默回退）；删除死代码 environment-versions-panel.tsx 及 spec（契约：不恢复独立环境版本页）。测试 3 用例。遗留建议：use-release-order-workbench-navigation 的 recoveryHref 仍指向该 view（会被纠正到项目信息），建议改指发布列表。 |
| INFO-1 | 已修 | 「验证并更新凭据」：确认弹窗（说明影响）+ feedback.promise（loading/成功/失败 toast）+ 按钮 loading。 |
| INFO-2 | 已修 | 证据分页：默认 20 条 + 「仅展示前 20 条，展开全部 N 条」按钮。测试（25 条 → 20 → 展开 25）。 |
| INFO-11 | 已修 | `findChange` 改为按建议结构化 `serviceName` 精确匹配（文本兜底要求同时含 app+service），backend 行不再吸走 admin 的建议。测试 3 用例。 |

### 发布域（7 条，修复代理完成）

| 编号 | 状态 | 摘要 |
|---|---|---|
| WIZ-2 | 已修 | 关闭弹窗同步 router.replace 清掉 `create=true`（否则二次点击不触发 effect）。测试：project-delivery-route.spec「WIZ-2」用例。 |
| WIZ-3 | 已修 | hook 暴露 `createError`；modal 内渲染「创建发布单失败: <error>」（role=alert）。测试覆盖。 |
| REL-1 | 已修 | `use-release-orders`：筛选从 URL 恢复（relQuery/relStatus 白名单校验）+ setQuery/setStatus 经 router.replace 写回（保留 view/releaseOrderId；stageId 无产品语义按任务说明显式忽略）。测试 `use-release-orders-url-sync.spec.tsx` 5 用例。 |
| ROD-1 | 已修 | 新建共享 selector `release-gate-decision-counts.model.ts`（blocked=blocker+integrityErrors 等），决策卡/高级检查头/技术证据 tab 三处同源消费；无效目录仍 fail-closed ≥1。测试含「三处同源同数」断言。 |
| ROD-2 | 已修 | 错误分类 errorKind: load/action；仅 action 失败才渲染错误 alert，preview 加载失败显示中性空态。测试 2 新用例 + fixture 更新。 |
| ROD-3 | 已修 | 新建 `release-production-prerequisite.model.ts` 单源判定，步骤 03/04 消费同一结果；生产预检阻断由 preflight 列表独立表达。测试 6 处。 |
| ROD-4 | 已修 | 新建 `utils/release-manifest-label.utils.ts` 共享 formatter（BuildRun #N · Manifest sha256:前 19 位），staging 下拉/当前制品摘要/production 选项统一；raw cuid 不再上屏（DOM 断言）。 |

### 配置/域名域（10 条，修复代理完成 9 条 P1 + 我复核）

| 编号 | 状态 | 摘要 |
|---|---|---|
| SET-1 | 已修 | 「查看详情」在行下方展开「版本详情」面板（版本/名称/来源/修订/证据数/时间），可收起。 |
| SET-2 | 已修 | 「查看变更」展开变更来源面板（branch@sha + 构建修订），无 diff 载荷时明确「无变更明细」说明。 |
| SET-4 | 已修 | ⋯ 菜单「技术证据」展开证据面板（运行证据计数直显，manifest/digest/ID 折叠 details）；保留 4 操作=3 直+1 溢出（契约）。 |
| SET-7 | 已修 | 复用弹窗目标环境改用 `selectExistingProjectEnvironments(project.environments)` 派生（排除源/归档环境）。 |
| SET-14 | 已修 | 版本表照 mockup 02 重构：版本号+名称合列、证据列 `hidden 2xl:table-cell`、table-fixed+百分比列宽+min-w-[640px]、移除 sticky 叠层。jsdom 无真实布局，以列结构类断言替代（spec 注明局限）。 |
| DOM-1 | 已修 | 新增 `sites/domain-format.utils.ts`（label 级域名校验：段规则/TLD≥2/泛域名/CSV 多值）；AddSiteModal 提交校验 + inline 红字 + noValidate。`not_a_valid_domain!!` 被拦且不发请求。测试 13 用例。 |
| DOM-2 | 已修 | 空表单提交显示 siteNameRequired/primaryDomainRequired inline 错误 + `formIncompleteHint` 原因。 |
| DOM-3 | 已修 | 新增 `project-domains-config-preview.tsx` 弹层（loading/目标路径/警告/差异摘要/Nginx 配置折叠/空数据提示），路由接线点击打开并拉计划。测试 3 用例。 |
| DOM-4 | 不复现+测试锁定 | 当前工作树中 route→table→useSites→ConfirmDialog→`DELETE:/sites/{id}` 链路完整（走查时点疑为旧构建）；新增路由级测试证明「删除→危险确认弹窗→显式确认才调 confirmDelete」。2 用例。 |

---

## P2（42 个编号：18 已修、8 部分、16 遗留/待确认）

### 项目信息/部署域（13 条）

| 编号 | 状态 | 说明 |
|---|---|---|
| INFO-3 | 已修 | `breadcrumbs.tsx`：/projects/:id 段经 SWR 拉项目名展示（title 保留完整 ID，未加载回退短 ID）。测试 `breadcrumbs.spec.tsx` 3 用例。 |
| INFO-4 | 已修 | 「配置已变更」去链接色，不再伪装可点。 |
| INFO-5 | 部分 | raw JSON 已折叠于「技术证据」details 内（符合契约「技术证据折叠」）；runId 映射/高亮列为遗留（成本高价值低）。 |
| INFO-6 | 已修 | 置信度徽章枚举本地化（高置信/中置信/低置信）。 |
| INFO-7 | 已修 | 删除与身份审计同址的重复链接。 |
| INFO-8 | 已修 | 「刷新权威状态」feedback.promise（loading+结果 toast）。 |
| INFO-9 | 已修 | 发布策略说明图标 CSS 可视 tooltip（hover/focus）+ aria-label 双写。 |
| INFO-10 | 已修 | 仓库地址外链（新窗口）+ 复制按钮（「已复制」反馈）+ truncate。 |
| DEP-6 | 部分 | 结构化日志数组在原始 JSON 上方逐行渲染（error 标红）；执行结果字段化遗留（形态随 result mode 变化需逐类设计）。测试覆盖日志行化。 |
| DEP-7 | 已修 | 失败运行列表行直接显示 error 摘要（truncate+title）。 |
| DEP-8 | 部分 | 来源补 `release_order→发布单`；目标类型 application/server/release-artifact 本地化。「首行无环境徽章/缺操作人」为数据缺失（environment/actor=null），代码如实降级，无 bug 可修。 |
| DEP-9 | 已修（口径澄清） | 「历史运行技术证据」更名「历史数据迁移说明」，计数显式说明含未展示的早期记录、口径异于列表。 |
| DEP-10 | 已修 | 运行详情 facts break-all → truncate+title。 |

### 发布域（12 条）

| 编号 | 状态 | 说明 |
|---|---|---|
| WIZ-4 | 已修 | 版本非法时 inline 红字 + aria-invalid；按钮禁用原因（未填名称/未填版本号/格式）常显于按钮下方。测试 2 用例。 |
| WIZ-5 | 已修 | 取消即清空暂存输入（closeAndReset）。测试 1 用例。 |
| REL-1 附注 | — | releasePlanId 深链是否支持：列入待产品确认。 |
| REL-2 | 已修 | 列表发布单号改「发布单 #短 8 位」（完整 ID 折叠 title），不再裸露整串 cuid 被误当 commit。 |
| REL-3 | 已修 | 列表改真表格（thead/tbody、min-w-[1040px] + overflow-x-auto 横向滚动容器），操作列不再被压缩裁切（契约：不把表格压到不可读宽度）。既有回归 spec 覆盖。 |
| REL-4 | 已修 | 草稿状态行标题加「草稿 · 」前缀（releaseDraftTitlePrefix），不再叫「历史发布」。 |
| ROD-5 | 不复现 | 「证据已于 <ISO> 过期」文案在当前工作树已不存在：现存全部时间渲染均走 formatTime/toLocaleString（release-gate-phase-section.tsx:69-74、release-gate-manual-confirmation.tsx:26-30 等），消息目录中亦无该 key。判定为走查后工作台改版已消除该渲染路径。 |
| ROD-6 | 遗留 | Manifest 制品证据组件名 cuid 系数据缺 name（第三个组件有名字证明字段存在）。修复需后端补组件名或前端建 id→名称映射表，建议单独迭代。 |
| ROD-7 | 待产品确认 | 「继续构建（disabled+原因）」：build 步骤已有 gate 阻断原因 + 「前往基线检查」链接（部分满足）；「放弃草稿」涉及草稿发布单删除语义（是否允许、是否留审计），**不自行决策，列入待产品确认**。 |
| ROD-8 | 已修 | 「查看门禁详情」两个 key（决策卡/修复链接）改名「前往基线检查（步骤 01）」/「前往基线检查」，与跳转行为一致。 |
| ROD-9 | 已修 | 步骤 tab 状态文案与步骤名相同时不再重复渲染/朗读（比较解析后文本）。 |
| ROD-10 | 不复现 | 「查看此前 N 条」现为原生 `<details>/<summary>`（键盘可达），不再是 div。 |
| ROD-11 | 部分 | 现实现：tab 名 ellipsis 截断 + ≤820px 竖排完整名；1280–821 区间仍有截断。窄屏改「序号+当前步骤名」形态需视觉验证辅助，列为遗留。 |

### 配置/域名域（17 条）

| 编号 | 状态 | 说明 |
|---|---|---|
| SET-3 | 已修 | 「切换版本」禁用原因按状态显示（当前已生效/需生产审批/目标未就绪/执行中）。测试 2 用例。 |
| SET-8 | 部分 | 代码层统一「中文名 (key)」：选择器、域名页、复用弹窗（dev · 开发→开发 (dev)）、验证 tab 传参。残余「Production 未翻译」为环境显示名数据（DB 中 name 即 "Production"），建议数据侧改名。 |
| SET-9 | 已修 | 面包屑项目段用项目名（同 INFO-3）；「Domains」段补 route-labels 映射「域名与入口」。 |
| SET-10 | 部分 | Provider 行显示本地化标签（SSH (ssh-v1) 等，raw key 折叠 title）。其余 raw 值（res_picshare、46e28a2d 短 hash、project_intake、draft）为数据/枚举上屏，映射表需产品定义统一文案表后批量做，列为遗留。 |
| SET-11 | 不复现 | 当前 `environment-env-import-modal.tsx` 已渲染 `envImportParsedSummary`（valid/total）与 `envImportInvalidLines`（忽略行数），spec 断言 invalidCount。走查所见静默忽略应为旧构建。 |
| SET-12 | 遗留 | 密钥引用一次生成两条草稿 + 草稿无法移除：需追踪 onUseSecret→secrets 状态双写路径并设计草稿删除交互，剩余容量不足，建议单独迭代。 |
| SET-13 | 已修（主体） | 0 修订时资源表空态改「该环境还没有配置修订；创建首个配置修订后即可绑定资源实例」，不再谈「当前修订」。「45 部署 vs 0 版本」并置为真实数据口径（部署次数与环境版本是不同对象），非代码缺陷。 |
| SET-15 | 遗留 | 建议表列宽/滚动阴影：jsdom 无法验证视觉布局，盲改列宽有回归风险，建议配合视觉走查单独处理。 |
| SET-16 | 已修 | 草稿与当前修订一致（基线快照比对）时「创建配置修订」禁用 + 「暂无待保存的配置变更」提示 + title。测试 2 用例。 |
| SET-17 | 已修 | 「共 N 个不可变修订」变为可点 toggle，展开修订列表（R# · 当前生效标记 · 时间 · 变更说明 · 操作人）。测试 1 用例。 |
| SET-18 | 已修 | 验证与监控文案按当前环境参数化（{environment}=中文名 (key)），不再硬编码 Production。 |
| DOM-5 | 已修 | 添加/编辑域名弹窗补 role="dialog" + aria-modal + aria-labelledby。 |
| DOM-6 | 部分 | 勾选 Basic Auth 显示明确说明：凭据由代理侧 /etc/nginx/.htpasswd 管理、暂不支持在此填写。完整凭据链路（存储/生成/下发）需 API 数据模型扩展，**列入待产品确认**（是否立项）。 |
| DOM-7 | 已修 | 编辑弹窗标题「编辑：{name}」点名对象。 |
| DOM-8 | 已修 | useSites 增加 effect：`?new=true` 参数变为 true 时显式打开创建弹窗（修复 SPA 内点击 banner 不触发——此前仅靠 useState 初值）。 |
| DOM-9 | 已修 | 代理下拉空态加「当前团队还没有代理配置。前往创建代理配置 →」链接（/proxy-configs?create=true）。 |
| DOM-10 | 遗留 | 1280px 弹窗底部按钮裁剪：现实现为整面板 max-h-[90vh] 滚动（按钮可滚到）；改「内容滚动+底部固定」需布局重构与视觉验证，列为遗留。 |

---

## 整体验证（最终门禁，全绿）

日志位于 /tmp/codex-tool-runs/svton/（括号内为日志文件）：

- `pnpm --filter @svton/devpilot-web test`：**exit=0 — Test Files 160 passed (160)，Tests 640 passed (640)**（web-test-final2.log）。基线为 143 文件/569 测试 → 净增 17 个 spec 文件、71 个测试。
- `pnpm --filter @svton/devpilot-web type-check`：**exit=0，0 错误**（web-tc-final.log）。
- `pnpm --filter @svton/devpilot-web lint`：**exit=0，0 Error**（web-lint-final2.log；仅有存量 exhaustive-deps 警告，均为基线已有）。
- `pnpm --filter @svton/devpilot-web i18n:check`：**exit=0 — zh/en parity passed: 4052 leaf messages, keys and ICU placeholders match**（web-i18n-final.log）。
- `pnpm --filter @svton/devpilot-api test`（DEP-1 门禁）：**exit=0 — Test Suites 419 passed（50 skipped），Tests 2348 passed（215 skipped）**（api-test-final.log）。

新增测试规模：修复共新增/扩展 **20+ 个 spec 文件、约 120 个测试用例**（含 WIZ 族 8、DEP-1 族 44（API）、SET-5/6 族 5、信息/部署域 40+、配置域 agent 30、发布域 agent 24+、P2 批次 15+）。

## 待产品确认

1. **ROD-7 草稿发布单的处置**：是否允许「放弃草稿」（删除）？删除是否留审计？目标「继续构建」在门禁阻断时是否需要常驻 disabled 按钮（当前为阻断原因+前往基线检查链接）？
2. **REL-1 附注 `releasePlanId` 深链**：发布列表是否需要支持该旧参数（当前显式忽略）。
3. **DOM-6 Basic Auth 凭据管理**：是否立项 API 侧凭据存储/htpasswd 生成链路（当前 UI 明示由代理侧文件管理）。
4. **SET-8 残余**：production 环境显示名「Production」是否在数据侧统一改为中文（代码层格式已统一）。

## 遗留与建议（未修项汇总）

- INFO-5（raw JSON 内 ID 映射/高亮）、DEP-6（执行结果字段化）、DEP-8 残余（数据缺失字段）、ROD-6（组件名映射）、ROD-11（窄屏步骤条形态）、SET-10 残余（枚举文案表）、SET-12（密钥草稿双写+删除）、SET-15（列宽）、DOM-10（弹窗底部固定）——均已在分条中给出原因与建议路径。
- EV-1 附带：`use-release-order-workbench-navigation.ts` 的 recoveryHref 仍指向已下线的 environment-versions view（会被显式纠正到项目信息），建议改指发布列表。
- 运维项（DEP-1）：历史泄露数据清理 + 泄露密钥轮换（见 P0 节）。

## 修复方式备注

- 全程未使用截图作为修复验证手段；组件行为以 jsdom DOM 断言、纯逻辑以函数断言证明。
- 1280px 响应式类修复（SET-14/REL-3）在 jsdom 下以「列结构切换类/滚动容器结构」断言替代真实布局检测（spec 内注明局限）；真实视口复核建议在 Docker 镜像重建后进行。
- 并行修复由两个子任务完成（配置/域名域、发布域），均遵守同一规范（i18n parity、React 导入约定、原生 setter 输入模拟、无 git 写操作）；我完成了信息/部署域、P0 全部、横切机械族与最终集成验证。


---

## 附：容器重建后的三个用户反馈问题（2026-08-22 下午，重建后处理）

1. **项目列表点名称/ID 无法进详情**：`project-card.tsx` 项目名原为纯文本（仅右侧「进入项目 →」可点）。已改为项目名即详情页主链接（`/projects/{id}`，primary 样式），spec 新增断言；运行时 ego-browser 验证点击后 URL 进入项目详情。
2. **「审批全批完仍显示待生产审批」**：根因是状态对象错位——该徽章等的是**该版本生产发布运行（ReleaseRun）的审批**（`approvedEnvironmentVersionRun`：approved 且未消费），而审批中心里批的是 `deployment.run` 类审批（DB 佐证：ReleaseRun=0，最近审批均为 deployment 类）。生产发布运行从未创建，因为发布流程未走到生产阶段（见 3）。已给徽章加解释 tooltip（说明需在发布单详情申请生产发布审批）；运行时已验证 tooltip 上屏。
3. **流程串不起来**：两层原因。
   - 重建时 compose 默认把 `RELEASE_BUILD_EXECUTION_ENABLED/RELEASE_STAGING_DEPLOYMENT_ENABLED` 置 false，预发→生产链路直接不可执行。已启用 local-filesystem-v1 预发部署 provider（与 parity 栈同开关），API 恢复 healthy。
   - 构建执行（步骤 02）在当前源码下强制要求 external-OCI-launcher 隔离设施（v13 acceptance overlay：不可变 job 镜像 + HMAC + launcher proof；直接开 flag 会以 `UNTRUSTED_WORKER_PROVIDER_MISSING` 崩溃循环，已实测）。这是仓库 fail-closed 安全设计：**新发布单会在构建步骤被挡**；既有 0.0.1 单（已有 BuildRun #10 成功 Manifest）可走 预发→申请生产审批→执行，验证时生产步骤已可选 Manifest 并提示「需要先取得服务端核验通过的生产预览」——链路可达，剩余阻断为真实门禁数据项（BuildRun 未提供 install Provider 证据，属数据问题非设施问题）。
   - compose 改动：api target 换 `api-acceptance`（带本地验收工具链）、新增 `devpilot-app-release-build` 卷、预发部署 env 矩阵（见 `docker-compose.devpilot-app.yml` 注释）。
