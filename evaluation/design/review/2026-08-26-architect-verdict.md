# Devpilot 项目模块设计：最终架构裁决

- 日期：2026-08-26
- 角色：独立产品 / 系统 / 视觉架构评审
- 基线：当前工作树、当前运行截图、OpenPencil F00–F12 导出、两份提交后 CR
- 裁决：**NO-GO**。当前稿可作为方向稿，不得作为实现或验收基线；完成本文的强制修订并重新验证后，才可转 GO。

## 1. 一页结论

当前稿保留了正确的产品方向：任务型五分区、单一环境 scope、问题—影响—动作同行、配置修订、日志前置结论与技术证据渐进披露。但它同时存在四类阻断：

1. **系统语义错误**：F00 把并行写域串成一条链；F06 把“预览、提交审批、等待审批、生产执行”合并；F12 把 BuildRun、DeploymentRun 与路由验证混成同一运行对象。
2. **可见布局错误**：共用 `simpleRow()` 重复渲染操作列，`issue()` 无动作保留区，已在导出中产生裁切和重叠。
3. **范围未闭合**：当前 10 个项目 route 中，`/projects/create`、`/projects/new`、`/projects/:id/publish` 三条真实流程没有逐步视觉稿；代码清单不能替代页面和状态设计。
4. **能力边界失真**：第三种 dashboard shell 不是当前 Devpilot；竞品的三种保存/部署、回滚影响矩阵、事故锁定和完整 DNS 任务流仍缺当前后端契约。

允许直接保留的核心模式只有：紧凑表/列表、当前对象与状态优先、精确禁用原因、一个空态一个动作、日志前先给结论、技术值后置、移动端 compact list、每页一个主动作。其余必须按本文重画或降级。

## 2. 证据边界

本裁决完整交叉检查了：

- 两份 CR：[`2026-08-26-deep-visual-cr.md`](./2026-08-26-deep-visual-cr.md)、[`2026-08-26-adversarial-cr.md`](./2026-08-26-adversarial-cr.md)；
- 代码与产品底稿：[`2026-08-26-project-code-inventory.md`](../../research/2026-08-26-project-code-inventory.md)、[`2026-08-26-current-visual-audit.md`](../../research/2026-08-26-current-visual-audit.md)、[`2026-08-26-competitor-matrix.md`](../../research/2026-08-26-competitor-matrix.md)、[`2026-08-26-product-review-and-design-brief.md`](../../research/2026-08-26-product-review-and-design-brief.md)；
- 设计源与交付说明：[`2026-08-26-project-module-redesign.js`](../2026-08-26-project-module-redesign.js)、[`README.md`](../README.md)；
- 项目设计契约与批准参考图：`project-skills/devpilot-project-workbench-design`、`project-skills/devpilot-product-design-lessons`；
- 关键真实源码：production preview/confirm、ReleaseRun/OperationApproval、staging DeploymentRun、EnvironmentVersion、ConfigRevision、Site、intake、generator、quick publish；
- 当前截图：项目目录、生产发布、版本设置、DeploymentRun 日志抽屉；设计导出：F00、F06、F08、F10、F12 等。

竞品证据主要为官方文档和官方文档截图（B/C），不是已登录控制台的实时交互证据。它只能证明模式，不得升级为 Devpilot 已有能力。

## 3. 两份 CR 的逐项裁决与去重

### 3.1 深度视觉 CR

| Finding | 裁决 | 架构理由 / 最终归并 |
|---|---|---|
| P0-01 `simpleRow` 双操作列 | **接受，P0** | 导出与脚本共同证明。归入 `G-LAYOUT-01`，必须修 helper，禁止逐屏调宽掩盖结构错误。 |
| P0-02 固定 `issue()` 导致 F09/F10 叠压 | **接受，P0** | 316px aside、390px mobile 与桌面不能共用固定单行模型。归入 `G-LAYOUT-02`。 |
| P1-01 可见动作只是 text/icon | **接受，P1** | 设计注释不能替代 role、命中盒和焦点契约。归入 `G-INTERACTION-01`。 |
| P1-02 shell 无条件“创建发布” | **接受，P1** | 当前页的唯一主任务必须占 primary slot；shell 动作不能与高风险确认或保存竞争。 |
| P1-03 F08 版本模型不符 brief | **接受，P1** | 当前版本必须是 fact strip，候选表只放 eligible candidates；技术证据退出主比较列。 |
| P1-04 移动导航漏“部署记录” | **接受，P1** | 响应式不能以功能不可达换取宽度。用具名“更多/项目菜单”承载完整五分区。 |
| P1-05 状态只靠颜色 | **接受，P1** | 建立 compact StatusTag：图标/形状 + 文本 + 语义色。 |
| P1-06 F11 三个创建入口 | **接受，P1** | 同一 environment scope 只保留一个默认创建动作。 |
| P1-07 F11 应补完整 DNS 任务流 | **部分接受，强形式驳回** | 可补“已有 Site 字段 + dry-run + 当前 dns/status”承载位；DNS 记录组、传播 ETA、备案、访问测试不得画成已可用，归入需后端。 |
| P1-08 F12 collapsed 名称与展开画面矛盾 | **接受，P1** | 默认只显示 disclosure header；展开态作为同对象的 state variant。 |
| P1-09 模型名/标注泄漏用户界面 | **接受，P1** | `[STATE/*]`、ConfigRevision、current pointer 等只留图层/技术说明；用户文案使用业务结果。 |
| P1-10 F12 日志对比度不足 | **接受，P1** | 低层级用折叠、字号和层次表达，不能牺牲 12px 正文可读性。 |
| P2-01 F01 项目名字重错误 | **接受，P2** | 桌面目录保持当前测试契约 `14/400 + primary`；移动对象名可 16/600。 |
| P2-02 table helper 不能表达 mono | **接受，P2** | cell schema 必须有 `text/mono/status/action` 类型，不得用统一 `T()`。 |
| P2-03 F10 缺最近修改/当前 release 采用状态 | **部分接受，强形式驳回** | 已有 `createdAt/createdBy/revision` 可进入详情；“当前 Release 是否采用”若无真实聚合字段只能标 unresolved，不能造状态。 |
| P2-04 `.op` document name 缺失 | **接受，P2** | 加稳定 document name，不影响业务语义。 |

### 3.2 对抗性产品 / 系统 CR

| Finding | 裁决 | 架构理由 / 最终归并 |
|---|---|---|
| P0-1 F00 错误串行写链 | **接受并加强，P0** | Staging 的真实运行是 `DeploymentRun`；Production confirm 先创建 `ReleaseRun + OperationApproval`，不是立即得到 EnvironmentVersion。见 §4。 |
| P0-2 F06 混淆 preview/approval/confirm | **接受并加强，P0** | POST 成功模型是 `ReleaseRun.status=awaiting_approval` 与 `OperationApproval.status=pending`；当前设计“确认后创建 EnvironmentVersion”是确定错误。 |
| P0-3 F12 把 BuildRun #10 写成失败部署 | **接受，P0** | 当前真实截图是 completed `DeploymentRun`，provider 为 `release-artifact / local-filesystem`；BuildRun #10 仅为 source evidence。 |
| P0-4 F08/F10 碰撞且 collision 时 save 可用 | **接受，P0** | 与视觉 CR P0-01/P0-02 去重；collision/stale 时保存必须禁用，重新加载后重新计算 draft。 |
| P0-5 三条 route 未视觉闭合 | **接受，P0** | `/projects/create`、`/projects/new`、`/projects/:id/publish` 必须补帧，不能声明 out-of-scope。精确帧图见 §7。 |
| P1-1 缺逐动作 traceability ledger | **接受，P1** | 新 F00-C 维护 action ID 总账；业务 frame 只引用 action ID。 |
| P1-2 六态仅写注释 | **部分接受** | 高风险状态必须画；普通页面可在 F00-D 状态矩阵用 variant ID 或 `N/A + 理由`，不要求复制六张全屏。 |
| P1-3 F11 双主动作/虚构 ready/crop | **接受，P1** | 当前 Picshare 域名为空；future row 必须标 `[SPECIMEN/API shape]`，不能证明当前 ready。 |
| P1-4 F03/F10/F11 “真实 Picshare 数据”不成立 | **接受，P1** | 当前证据值直接复用；示例必须有 fixture/seed 路径或 specimen 标签。 |
| P1-5 多屏裁切说明 QA gate 失效 | **接受，P0 gate** | 与视觉 helper finding 去重；PMD004 的 completed 结论必须重开。 |
| P1-6 设计 shell 不是当前 Devpilot | **接受，P1** | 顶栏 `项目/资源/审计` 是第三种 shell，必须删除。见 §6。 |
| P1-7 a11y 注释写成已验证事实 | **接受，P1** | 注释分 `current verified / design requirement / runtime unresolved`。 |
| P1-8 竞品 P0 与后端边界冲突 | **接受，P0 文档一致性** | save branches、rollback matrix、事故锁定、完整 DNS 流程降级。见 §8。 |
| P1-9 F12 raw log 默认展开 | **接受，P1** | 与视觉 P1-08 去重。 |
| P2-1 中英文混排 | **接受，P2** | 用户任务/状态中文化；API/model/machine term 仅在技术 disclosure。 |
| P2-2 F00 缺 evidence ID | **接受，P2** | 新 F00-A 给代码、当前截图、竞品证据稳定短 ID。 |
| P2-3 F01 只有一项目 | **接受，P2** | 若设计为过滤结果必须标过滤态；全目录验收必须展示真实 3 行或 fixture。 |
| P2-4 machine field 无短值/copy 规则 | **接受，P2** | 主层短值 + copy；完整值进 title/disclosure；字段名不作为用户文案。 |

没有被接受的强要求只有三类：把后端未返回的 DNS/传播/采用状态画成事实；把每屏六态复制为六张全屏；把所有写动作都假定已有 AuditEvent。它们都必须改为 unresolved、需后端或“当前路径无直接审计事件”。

## 4. 强制系统模型

### 4.1 F00 必须从单链改成四条独立泳道

1. **接入 / 生成**

   `Project draft → RepositoryConnection / AnalysisRun → reviewed snapshot → finalize → Project + Staging/Production baselines`

   `/projects/new` 走独立生成链：`wizard draft → POST /projects/generate → Project + generated artifact → ZIP download`。

2. **发布与运行**

   `ReleaseOrder → BuildRun → ArtifactManifest → Staging DeploymentRun`

   Production 是：

   `GET production-preview → POST production-releases → ReleaseRun(awaiting_approval) + OperationApproval(pending) → approval decision → Production DeploymentRun → promotion/route verification → EnvironmentVersion`

   任何设计都不得省略 `OperationApproval`，不得把 POST confirm 的成功态画成“已上线”或“EnvironmentVersion 已生成”。

3. **环境配置**

   `client draft → POST config-revisions(expected current revision) → append-only EnvironmentConfigRevision + currentConfigRevisionId update + AuditEvent`

   它与发布运行是并行域；只有发布快照引用某一 revision 时才相交。

4. **域名 / Site**

   `Site CRUD → Site(draft/pending/active/error)`；`POST sync-plan → SiteSyncRun(dry-run/live)`。

   Site 不是 EnvironmentVersion 的后继节点；它作为部署输入、route snapshot、DNS/probe 或切流证据被引用。

`AuditEvent` 不是全流程唯一终点。当前代码只有部分写路径显式写 AuditEvent；F00-C 必须对每个 action 写“已有事件 / 无直接事件 / 需补契约”，不能画成所有箭头自动汇入同一个 AuditEvent。

### 4.2 数据与状态模型

| 对象 | 当前真实状态/不变量 | UI 必须表达 |
|---|---|---|
| ReleaseOrder | `draft / active / succeeded / failed / canceled`；版本在项目内唯一 | 列表粗状态、当前阶段、终态原因分开。 |
| BuildRun | `queued / running / succeeded / failed / canceled`；固定 branch/commit/inputHash；成功可产 ArtifactManifest | Build 成功不能被 route verification 失败改写。 |
| ArtifactManifest | 一对一 BuildRun，含 digest/items | 只读制品证据；完整 digest 后置。 |
| DeploymentRun | `running / awaiting_validation / completed / failed / blocked`；staging/production 的 provider 执行实体 | Drawer 的 ID/status/provider/log 必须同源。 |
| ReleaseRun | `pending / awaiting_approval / running / awaiting_validation / succeeded / failed / canceled` | Production 提交审批后的主要对象。 |
| OperationApproval | `pending / approved / rejected / cancelled`，绑定 inputHash，可失效/消费 | pending 时不再显示创建第二个生产确认的 CTA。 |
| EnvironmentVersion | 只在部署完成边界生成，关联 DeploymentRun，可选关联 ReleaseRun；形成历史链 | 不得画成直接 pointer update；切换/恢复产生新运行和新版本记录。 |
| EnvironmentConfigRevision | append-only；`@@unique(environmentId, revision)`；CAS 更新 current pointer | collision 时禁止保存；secret 仅引用。 |
| Site | `draft / pending / active / error`；当前 dns/routeSwitch 是 JSON 事实，未必完整 | 只显示 API 实际返回状态；无值用 `—/待验证`。 |
| SiteSyncRun | `queued / running / completed / failed / blocked / cancelled`；dryRun 与 live 分开 | preview 不等于 live sync。 |
| AuditEvent | actor/target/risk/status/metadata/time；不是所有 release CRUD 都显式写 | UI 只对真实事件给“审计已记录”。 |

## 5. F06 生产发布裁决

### 5.1 正确语义

F06 不再是一个“Production Approval + 启用确认”的混合屏。它必须明确分成四个状态：

| State ID | 可见结论 | 可用动作 | 禁止事项 |
|---|---|---|---|
| `P06-BLOCKED` | 无 manifest、preview loading/error、`preApprovalAllowed=false` 或权限不足 | 重试预览、查看门禁/修复目的地 | 不显示启用的最终提交。 |
| `P06-REVIEW` | snapshot 已加载，显示 environment、release version、manifest、build source、preflight/concurrency 摘要 | `核对生产发布` 打开/聚焦确认 Modal | 不得先 POST 后展示 preview。 |
| `P06-SUBMIT-READY` | Modal 中 snapshot、permission、gate 均满足 | 唯一 primary：`提交生产发布审批` | 不写“上线成功”；不承诺 EnvironmentVersion。 |
| `P06-AWAITING-APPROVAL` | `ReleaseRun.awaiting_approval` + `OperationApproval.pending` | 查看审批对象、审批记录、返回发布详情 | 不再显示“提交/确认生产发布”。 |

当前 `ReleaseProductionView` 会在有 production run 后冻结主动作，这一方向应保留；设计稿必须与之同义。

### 5.2 命名错误状态

设计和实现至少使用以下 UI error names。它们是对现有 HTTP/status/message/details 的呈现契约，不代表新增后端能力：

| UI name | 当前可映射证据 | UI 结果 |
|---|---|---|
| `production_preview_loading` | GET pending | Modal 骨架；提交禁用。 |
| `production_preview_load_failed` | GET error | 保留 Modal；显示原因与 `重试加载预览`。 |
| `production_snapshot_unavailable` | preview 无 snapshot | 中性空态；提交禁用。 |
| `production_permission_denied` | 403 / FORBIDDEN | 说明无生产确认权限；不提供伪修复。 |
| `production_preflight_blocked` | 422 `PRODUCTION_PREFLIGHT_BLOCKED` | 展示 blocker gate IDs/原因；回到门禁。 |
| `production_preflight_stale` | 422 `PRODUCTION_PREFLIGHT_STALE` | 重新加载预览；旧 snapshot 不可提交。 |
| `production_input_drift` | 409，配置/工作负载/策略变化 | 关闭旧确认对象并重新预览。 |
| `production_scope_drift` | 409，environment scope 变化 | 中止；回发布详情重新核对。 |
| `production_idempotency_conflict` | 409，幂等键绑定不同输入 | 不自动重试写入；展示冲突。 |
| `production_concurrency_blocked` | active ReleaseRun / route saga 冲突 | 展示正在运行的对象入口。 |
| `production_scope_mismatch_client` | hook ownership guard | 丢弃响应并显示安全错误。 |
| `production_request_created` | POST 返回 ReleaseRun + OperationApproval | 成功提示“审批请求已创建”，进入 awaiting approval。 |

当前 `useProductionReleases` 仍主要显示 raw message，且 retry 会生成新的 UUID。设计可定义上述 UI taxonomy，但不得宣称所有分支已有稳定业务 code；没有稳定 code 的映射应列实现 TODO。

## 6. F12 运行实体与证据裁决

F12 必须选 **DeploymentRun** 并从标题到数据源保持一致：

- 标题：`DeploymentRun <shortId> 日志与证据`；
- query：`deploymentRunId=<id>`；
- 读取：`GET /projects/:projectId/delivery/releases/:releaseOrderId/staging-deployments` 后按 ownership 选中同一 item；
- 当前证据状态：`completed`；provider：`release-artifact / local-filesystem`；
- BuildRun #10 只显示为 `构建来源`；
- 技术部署与业务验证是 DeploymentRun 的子结论，不回写 BuildRun；
- 当前 completed run 不显示“前往 Site 修复”。只有真实 failed/blocked DeploymentRun 的 error 映射到 Site 时才出现该动作；
- raw log 默认折叠，header 显示行数、脱敏与截断状态；展开态使用同一 `deploymentRunId`，不得切换对象；
- 若另画 BuildRun drawer，必须使用 `buildRunId`、BuildRun 状态与 build log；若画 production ReleaseRun，必须使用 `releaseRunId` 和审批/DeploymentRun 列表。三者不得复用一个 mock 对象。

现有 F12 的 `BuildRun #10 / failed / server-executor / route verification failed` 必须整体删除，不接受只改标题。

## 7. 设计壳层裁决

当前运行态证据使用左侧全局导航、组织/账号顶栏与现有 Devpilot wordmark；批准配置参考图定义的是项目工作台内部结构。设计稿新增的顶栏 `项目 / 资源 / 审计`、layers 图标和无侧栏布局属于第三种 shell，**不得实现**。

强制规则：

1. 桌面页面用当前真实 dashboard shell；左侧导航宽度、顶部栏、内容起点与 1440×1000 当前截图一致。
2. 批准配置图只决定 project header、五分区、配置 rail/main/inspector 和操作语法，不替代全局 shell。
3. 若某张图为了聚焦只画内容区，frame 名必须带 `Content-only`，root 宽度必须是扣除当前 shell 后的真实内容宽，且不参与全屏断点验收。
4. F01 项目目录必须用完整当前 shell；F03–F12 最终验收也必须至少有一组完整 shell 导出。
5. 每页 primary action 由内容上下文提供；全局/项目 header 不再无条件注入 filled `创建发布`。

## 8. 竞品借鉴的最终分级

| 模式 | 最终分级 | Devpilot 本轮允许内容 |
|---|---|---|
| Release 粗状态/阶段/终态原因 | **直接借鉴** | 映射现有 ReleaseOrder/BuildRun/DeploymentRun/Gate，不新增枚举。 |
| 故障摘要在日志前、raw evidence 折叠 | **直接借鉴** | 结论—原因—关键证据—原始证据。 |
| 表格 vs cards、1–3 动作直出、4+ overflow | **直接借鉴** | 集合用紧凑表/列表；当前对象/空态才用独立 card。 |
| 一个空态一个动作 | **直接借鉴** | 动作必须有真实 route/API。 |
| 字段级排版 | **直接借鉴** | 对象/状态/阻断 500–600；ID/SHA/path/key 11–12 mono；时间/说明弱化。 |
| Variables staged review/discard | **条件借鉴** | 仅沿用当前前端 draft/ConfigRevision 事实；不宣称跨六区统一待发布。 |
| Project overview 四问 | **条件借鉴** | 只显示 delivery summary 实际返回字段，缺字段不补假值。 |
| Render 三种 save/deploy | **需后端** | 本轮不画可点击分支；最多写 future impact contract。 |
| Rollback 影响矩阵 | **需后端** | 需代码/变量/命令/实例/域名/卷/数据库的目标与当前快照契约。 |
| Netlify/Render 事故锁定 | **需后端** | 当前无锁定/恢复 API，不画按钮。 |
| 完整 DNS 记录组、传播 ETA、访问测试、备案 | **需后端/外部事实** | 当前仅 Site CRUD、`dns` 当前探测事实、dry-run sync plan；未知值不伪造。 |
| sealed/write-only secret | **部分已有** | Devpilot 只展示 secret reference；不能宣称所有 plain config 隐藏或 sealed。 |
| Promote/Rollback/Redeploy | **系统提案** | 必须先定义是否重建、变量来源、目标资格、持久结果；不得统一叫“发布”。 |

`2026-08-26-competitor-matrix.md` 的 §10 P0 列表中，第 5–8 项必须按上表降级；第 4 项缩窄到当前变量 draft/revision 能力。

## 9. 精确最终帧图

最终 OpenPencil 文档应有 **30 个 top-level frames**。不再沿用“13 帧已闭合全部范围”的口径。

| ID | 精确 frame name | 必须展示的真实决策/状态 |
|---|---|---|
| F00-A | `F00-A Evidence Index & Capability Verdict` | 证据 ID、direct/conditional/backend/reject 分级。 |
| F00-B | `F00-B Domain & State Flow` | §4 四泳道；Production approval/DeploymentRun/EnvironmentVersion 顺序正确。 |
| F00-C | `F00-C Action Contract Ledger` | §10 的 action IDs；当前 AuditEvent 有/无必须明确。 |
| F00-D | `F00-D State, Responsive & A11y Matrix` | 每业务 frame 的 loading/empty/error/blocked/approval/staged variant ID 或 N/A。 |
| F01 | `F01 Project Directory / Desktop / Current Shell` | 当前 3 项目或明确过滤态；项目名 14/400；操作列不裁切。 |
| F02 | `F02 Project Directory / Mobile` | compact list；对象—状态—事实—主动作；全部五分区可达。 |
| F03 | `F03 Project Information / Desktop` | 真实 Picshare 组件/runtime/path/port；单一创建发布入口。 |
| F04 | `F04 Release Orders / Desktop` | 紧凑表；status icon/text；真实 action IDs。 |
| F05 | `F05 Release Detail / Staging Blocked` | Staging 单一 scope；DeploymentRun/BuildRun 分开。 |
| F06 | `F06 Release Detail / Production Approval Request States` | `P06-BLOCKED/REVIEW/SUBMIT-READY/AWAITING-APPROVAL` 四态；POST 成功不是 EnvironmentVersion。 |
| F07 | `F07 Release Detail / Mobile` | 五分区可达；禁用原因近场；无横向溢出。 |
| F08 | `F08 Settings Version / Desktop` | current fact strip + eligible candidate table；配置变更；固定操作列。 |
| F09 | `F09 Settings Version / Mobile` | compact candidates；当前版本不重复；44px actions。 |
| F10 | `F10 Variables & Secrets / Revision Conflict` | stale/collision 时 save disabled；reload 后重算；无模型名泄漏。 |
| F11 | `F11 Domains & Entries / Selected Environment` | 单一 environment selector；当前空态一个动作；ready 示例必须 specimen/API shape。 |
| F12 | `F12 DeploymentRun Evidence / Drawer States` | 当前 completed DeploymentRun；collapsed/expanded raw evidence；BuildRun #10 仅 source。 |
| F13 | `F13 Existing Repository Intake / Connect` | `/projects/create` Step 1；公开/私有、managed/inline、详情 disclosure、校验。 |
| F14 | `F14 Existing Repository Intake / Analysis Review` | Step 2；polling/failed/retry、branch/commit、组件接受编辑拒绝、依赖 blocker。 |
| F15 | `F15 Existing Repository Intake / Baseline Finalize` | Step 3；Staging/Production 基线、snapshot/hash、finalize idempotency、resume/error strip。 |
| F16 | `F16 Generated Project / Basic Information` | `/projects/new` Step 1；package name、organization、description、package manager。 |
| F17 | `F17 Generated Project / Subprojects` | Step 2；backend/admin/mobile、UI libs/hooks、至少一项、键盘语义。 |
| F18 | `F18 Generated Project / Features` | Step 3；registry loading/error、按 subproject 过滤、资源/package 依赖。 |
| F19 | `F19 Generated Project / Resources` | Step 4；resource/instance/pool/manual/credential/skipped、数据库 engine。 |
| F20 | `F20 Generated Project / Preview & ZIP Result States` | Step 5；完整摘要、generating/error/retry/download/success redirect；idempotency 保留。 |
| F21 | `F21 Quick Publish / Select Staging Environment` | `/projects/:id/publish` Step 1；只允许恰好一个有效 staging baseline。 |
| F22 | `F22 Quick Publish / Effective Config Review` | Step 2；plain/secret/resource、conflict 阻断、unknown secret warning。 |
| F23 | `F23 Quick Publish / Confirm, Execute & Handoff` | Step 3；create→build→staging；分阶段 retry；明确“自动止于 Staging，Production 在详情另行提交审批”。 |

F24–F26 用于三条补充流程的代表性窄屏验收：

| ID | 精确 frame name | 验收重点 |
|---|---|---|
| F24 | `F24 Existing Repository Intake / Mobile Review` | blocker、review 决策、footer actions 不裁切。 |
| F25 | `F25 Generated Project / Mobile Resources` | 卡片/checkbox 键盘与触控语义一致。 |
| F26 | `F26 Quick Publish / Mobile Conflict & Retry` | conflict、failed stage、retry 与 Staging handoff 首屏可达。 |

兼容重定向 `/projects/import` 与 `/projects/:id/publish/:releaseOrderId` 不需要独立产品页，但必须在 F00-C 标 canonical destination、loading 上限与 named redirect error；这样 10/10 route 都有视觉或明确 redirect 证据。

## 10. Action → route/query → API → permission/risk → result → errors → AuditEvent 契约

| ID / Action | Route / query | API | Permission / risk | Success model | Named errors | 当前 AuditEvent 契约 |
|---|---|---|---|---|---|---|
| `A-DIR-01 连接已有仓库` | `/projects` → `/projects/create` | 无写 API | 已登录 route | 进入 intake Step 1 | `navigation_auth_required` | 无。 |
| `A-DIR-02 生成新项目` | `/projects` → `/projects/new` | 无写 API | 已登录 route | 进入 generator Step 1 | `navigation_auth_required` | 无。F01 必须补这一入口。 |
| `A-INT-01 连接并分析` | `/projects/create?projectId&runId` | `POST /project-intake/drafts` → `POST /project-intake/:id/repository` → `POST .../analysis-runs` | `team_member` + intake write，medium | Project draft + repository connection + AnalysisRun queued/running | `credential_required`、`repository_connect_failed`、`analysis_failed`、`analysis_cancelled` | `repository.connect`；worker 终态 `repository.analysis.succeed/fail/cancel`。 |
| `A-INT-02 提交识别评审` | create Step 2 | `POST /project-intake/:id/analysis-runs/:runId/review` | scoped intake write，medium | 冻结 review snapshot/contract，进入 Step 3 | `review_not_ready`、`dependency_blocked`、`snapshot_drift` | 当前 review 写路径不得假定单独 AuditEvent；建议保留“不确定”而非虚构。 |
| `A-INT-03 创建基线` | create Step 3 → `/projects/:id` | `POST /project-intake/:id/finalize` | scoped intake write，medium | finalization succeeded + repository identity + baseline environments | `finalize_conflict`、`finalize_failed`、`idempotent_replay` | `project.intake.finalize`。 |
| `A-GEN-01 生成并下载 ZIP` | `/projects/new` Step 5 | `POST /projects/generate`；下载响应头/ZIP | self-service `project.generate`，medium | Project + generated artifact；下载；跳项目页/列表 | `registry_load_failed`、`validation_failed`、`generate_failed`、`download_failed` | `project.generate.finalize`；后续下载 `project.artifact.download`。 |
| `A-REL-01 创建发布单` | `/projects/:id/releases?create=true` | `POST /projects/:id/delivery/releases` | create，medium | ReleaseOrder；成功进入 `releaseOrderId` | `release_version_invalid`、`release_version_conflict`、`scope_mismatch` | 当前 ReleaseOrderService 未见直接 AuditEvent；不得标“已审计”。 |
| `A-REL-02 构建` | `releaseStep=build` | `POST .../releases/:rid/builds` | build，high | BuildRun；成功产 ArtifactManifest | `build_gate_blocked`、`git_unresolvable`、`build_failed`、`build_cancelled` | release path 无可证明的同事务 AuditEvent；执行审计需按实际事件读取。 |
| `A-REL-03 部署到预发` | `releaseStep=deploy` | `POST .../releases/:rid/staging-deployments {manifestId}` | staging deploy，high | Staging DeploymentRun completed/failed/blocked | `staging_baseline_invalid`、`gate_blocked`、`deployment_input_drift`、`workload_drift`、`deployment_failed` | 当前 release-staging repository 未显式写 AuditEvent；不得把 DeploymentRun 等同 AuditEvent。 |
| `A-REL-04 核对生产发布` | `release=production`，open Modal | `GET .../production-preview?manifestId` | read，low | 只读 snapshot + preflight/concurrency | §5.2 preview errors | 无写入、无 AuditEvent。 |
| `A-REL-05 提交生产发布审批` | Production Modal | `POST .../production-releases {manifestId, expectedInputHash, idempotencyKey}` | confirm production，high | `ReleaseRun.awaiting_approval + OperationApproval.pending` | §5.2 confirm errors | 当前 repository 直接创建 OperationApproval，不直接写 AuditEvent；审批决定由 operation-approval 审计链负责。 |
| `A-VER-01 切换/恢复版本` | `/settings?env&envTab=versions` | `POST /projects/:id/delivery/environment-versions/:envId/actions` | environment deploy，high；production resume/recovery 用 confirm-production | DeploymentRun，成功边界生成新 EnvironmentVersion | `candidate_ineligible`、`approval_missing`、`gate_stale`、`idempotency_conflict`、`promotion_ambiguous` | 当前设计不得声称每次 action 都已有 AuditEvent；以实际 DeploymentRun/approval/promotion evidence 为准。 |
| `A-CFG-01 保存配置修订` | `/settings?env&envTab=variables|...` | `POST /project-environments/:envId/config-revisions` | scoped create revision，按资源风险 medium/high | append-only EnvironmentConfigRevision + current pointer | `config_load_failed`、`validation_failed`、`config_revision_collision`、`save_failed` | 同事务 `project_environment.config_revision.create`，completed；metadata 不含 secret value。 |
| `A-SITE-01 添加/编辑/删除入口` | `/projects/:id/domains` | `POST /sites`、`PUT /sites/:id`、`DELETE /sites/:id` | scoped site write；update medium；delete high | Site draft/pending，或删除 success | `site_validation_failed`、`binding_scope_mismatch`、`site_not_found`、`permission_denied` | 当前 SiteCrudService 未显式写 AuditEvent；设计不得宣称 CRUD 已审计。此缺口需产品/后端决定。 |
| `A-SITE-02 预览配置` | domains selected row | `POST /sites/:id/sync-plan {dryRun:true}` | `team_admin` + site.sync，low | SiteSyncRun dry-run + plan/diff/warnings | `sync_plan_failed`、`target_missing`、`permission_denied` | Site sync execution 已写 AuditEvent；必须标 dryRun，不得宣称 live applied。 |
| `A-LOG-01 查看部署日志` | `deploymentRunId=<id>` | GET staging-deployments list，client ownership select | read，low | 打开同一 DeploymentRun drawer | `run_not_found`、`run_scope_mismatch`、`logs_unavailable`、`logs_truncated` | 只读，无新 AuditEvent。 |
| `A-PUB-01 快捷发布` | `/projects/:id/publish` | 复用 `A-REL-01 → A-REL-02 → A-REL-03` | medium → high → high | 成功只到 Staging DeploymentRun，并进入 release detail | `publish_create_failed`、`publish_build_failed/timeout`、`publish_deploy_failed` | 无独立 publish model/AuditEvent；沿各步骤真实结果。 |

所有 frame 的可见 control 必须引用一个 action ID。纯 client 行为（search、filter、review draft、discard、close、disclosure）也要在 F00-C 标 `client-only`、结果与 focus return；不能因为没有 API 就不标。

## 11. 源文档与 TODO 的强制修订

实现者完成设计修订时，必须同步以下文档；否则即使 PNG 变好也不得 GO：

1. `2026-08-26-project-code-inventory.md`
   - 把 `Create ReleaseOrder → BuildRun → ArtifactManifest → staging ReleaseRun → production confirm → EnvironmentVersion` 改为 §4 的真实链；
   - 明确 production POST 的成功模型是 ReleaseRun + OperationApproval；
   - Site CRUD、release create/build/staging 的 AuditEvent 不得继续泛化为“每次写均有”。
2. `2026-08-26-product-review-and-design-brief.md`
   - 12-frame/13-root 口径改为 §9 的 30 frames；
   - 修正 F06、F12、shell 与三条缺失 route；
   - 将 DNS/rollback/save branches 的交互要求标 needs backend。
3. `2026-08-26-competitor-matrix.md`
   - §10 的 P0 第 5–8 项降级；第 4 项限定为当前变量 draft/revision；
   - 每条“直接借鉴”带证据等级与 backend boundary。
4. `2026-08-26-current-visual-audit.md`
   - 增加 `/projects/create`、`/projects/new`、`/projects/:id/publish` 未获当前健康截图的 named visual gap；
   - 不再把 release create Modal 当 `/publish` 三步流程证据。
5. `evaluation/design/README.md`
   - 更新 root count、frame index、真实 shell、状态矩阵和 F06/F12 数据模型；
   - 删除“13 intended roots 已覆盖 brief”的旧结论。
6. `docs-internal/todos/2026-08-26-project-module-competitive-design.md`
   - `PMD004 completed` 改为 reopened/changes-required，因为“所有页面无裁切/布局错误”已被导出证据否定；
   - `PMD005` 可在本裁决落盘后标 completed with NO-GO；
   - `PMD006` 保持 pending，并列出本文 P0 gate、30 frames、OpenPencil 打开证据和 push 前置；
   - Evidence log 记录 F06/F12 domain correction，而非只记录视觉修复。
7. `docs-internal/todos/INDEX.md`
   - 更新为 architect NO-GO、PMD004 reopened、PMD006 blocked on mandatory revision。

## 12. 最终强制修订集与实施顺序

### P0 — 先修语义，不得并行美化掩盖

1. 重画 F00-B/C：四泳道、OperationApproval、DeploymentRun、每 action 的真实审计边界。
2. 重画 F06：四态、preview 在 POST 前、POST 成功为 awaiting approval、错误 taxonomy。
3. 重画 F12：DeploymentRun identity、真实 query/provider/status、raw disclosure。
4. 修 `simpleRow` 与 `issue` helper；建立 action/status/mono primitives；重导所有受影响帧。
5. 补 F13–F26，闭合 `/projects/create`、`/projects/new`、`/projects/:id/publish`。

### P1 — 产品与壳层一致性

6. 替换第三种 shell；引入页面上下文 primary slot；移动端恢复五分区可达性。
7. 修 F08 current/candidate 模型、F10 collision、F11 单 scope/单创建动作。
8. 统一中文业务文案、StatusTag、44px action、mono 字段、raw evidence 对比度。
9. 同步 research/brief/README/TODO 的能力分级和帧图。

### P2 — 交付与验证

10. 设置 `.op` document name；运行 lint/export；逐张人工复核。
11. 在 OpenPencil 0.8.4 打开单一 `.op`，确认 30 个 top-level frame 全部可见；记录打开证据。
12. 通过 CR 后再 commit + push；不得先把 PMD004/PMD006 标完成。

## 13. 客观 GO 验收条件

只有同时满足以下条件才可把本裁决改为 GO：

1. **语义**：F00 不存在 `EnvironmentVersion → ConfigRevision → Site`；Staging 是 DeploymentRun；Production POST 成功明确是 awaiting approval。
2. **F06**：任何 pending approval 画面没有启用的提交/确认 CTA；preview 必须先于 POST；403/409/422/load/empty 有命名状态；成功文案不出现“已上线/EnvironmentVersion 已生成”。
3. **F12**：title/query/API type/status/provider/log/repair action 100% 同一 run；当前证据采用 completed DeploymentRun，BuildRun #10 仅 source。
4. **范围**：10/10 route 有健康当前截图、设计帧或明确 redirect/blocker；F13–F26 覆盖三条缺失流程的全部步骤与恢复。
5. **布局**：30/30 PNG 人工复核无裁切、重叠、文字越出 frame；F01/F03/F04/F08/F11 操作列专项通过；F09/F10 叠压专项通过。
6. **响应式**：390px 不出现内容横向 overflow；316px inspector、390px mobile、200% zoom 的 issue/action 均完整；窄屏不丢五分区。
7. **交互节点**：所有 visible controls 有 action ID 和 role；高频/图标动作命中盒 ≥44×44；overflow/disclosure/Modal/Drawer 定义 Escape、initial focus、trap、return focus。
8. **状态**：每业务 frame 的 loading/empty/error/blocked/approval/staged 有 variant ID 或 N/A；mutation error 保留输入；collision/stale 时保存禁用。
9. **数据真实性**：每个 Picshare 值可回指当前截图/API fixture/seed；future 数据标 specimen；secret value 永不渲染。
10. **能力边界**：设计中不存在可点击的 save/deploy 三分支、rollback matrix、事故锁定、伪 DNS/ETA/备案/访问测试、production verification provider。
11. **壳层**：完整 desktop frame 与当前 dashboard 的 sidebar/topbar/content origin 对齐；不存在第三种 brand shell。
12. **审计**：F00-C 对每个写 action 标已有 AuditEvent、无直接事件或需后端；不得用一条总箭头伪造覆盖。
13. **文档**：§11 的七处文档/TODO 同步完成，互相不再矛盾。
14. **交付**：OpenPencil 0.8.4 实际打开 30 roots，文档名稳定，导出与 `.op` 同版本；再完成 commit/push 与远端校验。

在这些条件完成前，结论保持 **NO-GO**。
