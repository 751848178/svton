# Devpilot 项目工作台：产品评审与 OpenPencil 实施 Brief

日期：2026-08-26
交付类型：implementation-ready design brief
范围：项目目录、项目信息、发布列表/详情、项目配置、域名与入口、部署证据
证据状态：基于当前源码清单、运行态视觉审计、竞品矩阵、workbench contract、problem-solution ledger 与 4 张仓库内截图；未浏览网页、未执行运行时或测试。

## 1. 结论

Devpilot 不需要重做信息架构；应保留“真实状态优先、项目任务分区、技术证据渐进披露”的现有骨架。

本轮设计目标不是增加能力，而是让用户在每个页面先回答：正在操作哪个对象、当前结论是什么、为什么、会影响什么、下一步去哪。

两个必须先修的 P0 是：

1. 发布详情的环境上下文必须只有一个状态源，页头、环境链、主 CTA、正文不得互相矛盾。
2. 版本配置必须消除状态/时间/操作碰撞，并让桌面、移动端的主要动作都可见、可触达。

## 2. 证据口径与 unresolved 规则

- `[source-confirmed]`：可由 `2026-08-26-project-code-inventory.md` 指向当前 import/handler/API/model。
- `[visual-confirmed]`：可由本轮当前截图直接观察。
- `[contract]`：来自 workbench contract 或 problem-solution ledger 的既定设计边界。
- `[competitor-pattern]`：只作为交互模式输入，不能当 Devpilot 已有能力。
- `[unresolved]`：当前证据不能证明；OpenPencil 只画注释或禁用占位，不画成可用功能。
- 高风险写动作必须关联真实 API、结果状态、权限/审批与审计；无法关联即从交互稿删除。

## 3. A — Verdict 表

| 评审项 | Verdict | 设计决定 | 实现边界 |
|---|---|---|---|
| 项目级五分区：项目信息/发布/项目配置/域名与入口/部署记录 | 保留 | 维持任务导向，不按后端对象加新一级导航 | 当前部署记录主要是发布上下文 Drawer；独立 route `[unresolved]` |
| 紧凑问题行：对象 + 原因 + 影响 + 精确动作 | 保留 | 作为 blocker/warning 的唯一默认样式 | 不再使用脱离原因的“立即处理” |
| 发布粗状态/当前阶段/终态原因三层 | 直接借鉴 | 列表扫粗状态，详情看阶段，失败先看原因 | 映射现有 ReleaseOrder/Run/Gate 数据，不新增状态枚举 |
| 摘要在日志前、原始证据二级展开 | 直接借鉴 | 首屏只放结论、影响、下一步、关键证据 | 完整日志仍在现有 Drawer，保留脱敏/截断边界 |
| 配置变更显示 staged/review/discard | 条件借鉴 | 变量页沿用已有 staged banner；其他配置只显示当前可证明的 unsaved/revision 状态 | 跨六区统一 staged changes `[unresolved]` |
| 项目 Overview 四问 | 条件借鉴 | 只用现有 production version/health/last change/nextAction；缺字段不补假值 | delivery summary 能否完整回答四问 `[unresolved]` |
| 移动端用对象摘要列表代替压缩桌面表 | 直接借鉴 | 项目、版本在 390px 显示对象/状态/主动作/展开详情 | 仍是集合列表，不做重复大卡片 |
| 所有行操作默认塞进省略号 | 拒绝 | 1–3 个动作直出；超过 3 个才 overflow | 符合既定操作列 contract |
| 固定 Production/Preview 两环境 | 拒绝 | 环境选择器只列已有环境，不硬编码数量 | staging/production 是当前流程角色，不是产品上限 |
| Railway 式服务画布作为默认项目页 | 拒绝 | 当前保持线性项目工作台 | 仅真实多服务比较任务才可另立 proposal |
| “保存但不发布/重部署/重建并部署”三分支 | 需后端 | 只作为未来影响模型，不画可点击按钮 | 当前 config revision 写入不等于已有三种执行 API |
| 回滚影响矩阵与事故锁定 | 需后端 | 可先定义只读字段契约，不能宣称可执行 | 目标/当前代码、变量、域名、数据、自动发布差异 `[unresolved]` |
| 域名 DNS 记录组、传播时间、访问测试 | 需后端 | 当前只画已有 Site 字段与 dry-run；缺失字段标 unresolved | TLS/DNS/route-switch 全组合未获运行态证明 |
| 生产真实验证 provider/基线创建 | 拒绝 | 验证页只承诺 `unconfigured` / `local_acceptance_v1` | 不把 local acceptance 写成 production verification |

## 4. 两个 P0 策略

### P0-1：发布环境上下文单一化

- 决策对象：当前 ReleaseOrder 在当前环境阶段的可执行性。
- 单一状态源：`selectedEnvironmentRole` 驱动页头 badge、环境链选中项、步骤标题、主 CTA、blocked copy。
- 页头只写版本/发布名 + 当前环境；候选提交、最新 run 进入三列事实区。
- 环境选择使用 `tablist`，明确组标签“发布环境”；步骤使用第二组“执行步骤”，不可使用相同视觉造型。
- 切换 Production 时，任何 `预发（Staging）发布` 文案必须同步消失。
- 主 CTA 文案带结果：`部署到预发`、`确认生产发布`；禁用原因紧贴按钮，不依赖 title。
- 生产审批未满足时显示 `待生产审批` + 审批对象/影响；统一 capability 预检 `[需后端]`，当前仍需处理 API 拒绝态。
- 验收：F05/F06/F07 三 frame 中页头、环境、步骤、CTA、问题行语义一致。

### P0-2：版本配置的列与动作收敛

- 决策对象：从已有合格版本中选择一个，进入受审计部署路径。
- 桌面表保留：版本、名称、来源、配置变更、环境状态、操作；创建时间移到检查面板。
- 操作列固定宽度；主动作仅 `切换版本`，`查看详情/查看变更` 为次动作，技术证据进入 overflow。
- 状态与操作不得共享重叠区域；状态包含文本/图标，不只用色。
- 当前环境版本单独使用 plain fact strip，不与候选版本重复成两张大卡。
- 移动端改为紧凑列表行：`版本 + 名称`、状态、来源、一个主动作、详情 disclosure。
- 生产候选无已批准 run 时，主动作禁用并在近场显示原因；不得直接改 Environment current pointer。
- 验收：F08/F09 无横向裁切，无 status/action 重叠，技术证据仍可到达。

## 5. 两个 P1 策略

### P1-1：移动可达性与动作层级

- 390px 下项目与版本集合改用紧凑列表，不把 `min-width` 桌面表直接塞进视口。
- 所有高频操作、tab、导航、overflow trigger 命中盒至少 44px；文字视觉尺寸保持 14px。
- 一个对象只有一个默认主去向；修复动作紧贴问题；低频动作放 overflow。
- disclosure、overflow、tab 必须键盘可达、可见 focus、Escape 关闭并回焦。
- 颜色对比、200% 缩放、完整键盘和屏幕阅读器仍是 `[unresolved]`，不得标已通过。

### P1-2：证据降噪与失败恢复

- 发布首屏顺序固定为：结论 → 可操作原因 → 关键证据 → 原始证据。
- Gate 目录、构建物、完整日志、Manifest/digest 默认折叠或进 Drawer。
- Settings governance 读取失败必须有常驻 ErrorBanner + `重试加载`，不能只依赖 toast。
- 旧 deployment deep link 不允许无限 loading：可迁移则重定向到 release + Drawer；不可迁移则错误态给返回发布列表。
- 域名/验证空态在内容近场说明用途、影响、一个真实动作；没有真实创建路径则只给目的地链接。

## 6. OpenPencil frame 清单（30 个顶层 frame）

架构裁决后的单页由 F00-A–F00-D 证据/契约板、F01–F12 核心 workbench、F13–F23 三条缺失流程和 F24–F26 移动验收组成。下表保留 F01–F12 的核心决策；完整精确名称见本节表后索引。

| ID | Frame 名 | 视口 | 主决策 |
|---|---|---:|---|
| F01 | Project Directory / Desktop | 1440×1000 | 哪个项目需要进入或修复 |
| F02 | Project Directory / Mobile | 390×844 | 在首屏触达对象、状态与主动作 |
| F03 | Project Information / Desktop | 1440×1000 | 当前仓库/组件事实是否可用于发布 |
| F04 | Release Orders / Desktop | 1440×1000 | 选择发布单并理解粗状态/阶段 |
| F05 | Release Detail / Staging Blocked | 1440×1000 | 为什么预发不可继续、去哪里修复 |
| F06 | Release Detail / Production Approval Request States | 1440×1000 | 在 blocked/review/submit-ready/awaiting-approval 四态中提交审批请求；不伪称已生成 EnvironmentVersion |
| F07 | Release Detail / Mobile | 390×844 | 纵向保持环境、步骤、结论一致 |
| F08 | Settings Version / Desktop | 1440×1000 | 选择已有版本并发起受审计切换 |
| F09 | Settings Version / Mobile | 390×844 | 无横向裁切地完成同一决策 |
| F10 | Variables & Secrets / Revision Conflict | 1440×1000 | stale/collision 阻断保存，reload 后重算；Secret 只显示 reference |
| F11 | Domains & Entries / Selected Environment | 1440×1000 | 单一环境空态；ready 行仅 specimen/API shape |
| F12 | DeploymentRun Evidence / Drawer States | 1440×1000 | 当前 completed DeploymentRun 的 collapsed/expanded 受控证据；BuildRun #10 仅为 source |

完整索引：F00-A `Evidence Index & Capability Verdict`；F00-B `Domain & State Flow`；F00-C `Action Contract Ledger`；F00-D `State, Responsive & A11y Matrix`；F13–F15 `Existing Repository Intake` 的 Connect/Analysis Review/Baseline Finalize；F16–F20 `Generated Project` 的 Basic Information/Subprojects/Features/Resources/Preview & ZIP Result States；F21–F23 `Quick Publish` 的 Select Staging Environment/Effective Config Review/Confirm, Execute & Handoff；F24–F26 分别为这三条流程的 Mobile Review/Mobile Resources/Mobile Conflict & Retry。

## 7. 每 frame 的真实字段、排版与动作

| Frame | 真实字段 | 字体/字重理由 | 主动作 | 次动作 |
|---|---|---|---|---|
| F01 | 项目名、状态、组件摘要、production version/domain、最新发布时间、可选环境版本、nextAction | 项目名 14/400 蓝色链接保持当前测试契约；状态 14/500+文本图标；版本 14/500；机器摘要 12 mono | `进入项目` 或真实 nextAction（二者只保留一个默认） | `发布`、`配置`、`域名`，第 4 项起 overflow |
| F02 | 项目名、状态、production version、阻断摘要 | 项目名 16/600 用于移动对象识别；状态 14/500；辅助 12/400 | `进入项目`/精确修复 | `发布`、详情 disclosure、overflow |
| F03 | repository URL、default branch、release policy、component name/runtime/status、branch@SHA、reviewed delta、path/port | h1 20/600；section 18/600；事实值 14/500；repo/SHA/path 12 mono；说明 12/400 | `创建发布单` | 仓库分析 `连接/重跑` 仅在真实状态允许；运行/证据 disclosure |
| F04 | release name、x.y.z、短 ID、粗状态、source branch@SHA、current stage、updatedAt | 行主对象 14/600；ID/SHA 11–12 mono；状态 12/500；时间 12/400 muted | `进入发布` | `构建`、`部署`、`证据`，超过 3 项 overflow |
| F05 | release/version、selected env=staging、candidate commit、latest run、block counts、preflight/build/deploy、technical/business result、digest | h1 24/600；阻断名 14/600；事实值 13–14/500；SHA/digest 12 mono | `部署到预发`（blocked 时禁用） | 精确修复链接、查看历史、查看日志 |
| F06 | release/version、selected env=production、artifact、build source、warnings、gate/approval、input hash 相关确认摘要、production runs | 环境 12/500 pill；主版本 24/600；审批/阻断 14/600；技术值 12 mono | `确认生产发布` | 返回预发证据、查看环境版本、运行历史 |
| F07 | F05/F06 的移动必要字段：对象、环境、blocker、三事实、步骤、当前结论、主动作 | h1 20/600；组标签 12/500；正文 14/400；机器值 12 mono | 随环境变化的唯一 CTA | 修复链接、evidence disclosure、历史/日志 |
| F08 | environment、current version、candidate version/name/source/config delta/environment status、approved evidence、createdAt detail | 版本号 20/600；候选 14/600；名称 14/400；来源 12 mono；状态 12/500 | `切换版本` | `查看详情`、`查看变更`、overflow 技术证据 |
| F09 | version + name、status、source、approval reason、selected detail | 对象 16/600；状态 12/500；来源 12 mono；说明 12/400 | `切换版本` | `查看详情` disclosure、overflow |
| F10 | key、type=plain/secret/resource、value/reference、source、collision、effective/draft/current revision、change summary | key/reference 12 mono；类型/冲突 12/500；说明 12/400；section 18/600 | `保存修订` | `添加变量`、`导入 .env`、review/discard staged；不显示 secret value |
| F11 | environment、domain/aliases、name、target server/upstream、TLS type/status、site status；dry-run path/warnings/diff | domain 14/500；target/path 12 mono；状态 12/500；空态正文 14/400 | `添加域名入口` | `编辑`、`预览配置`、`删除`；近场修复链接 |
| F12 | run/status/duration/provider/start/end、technical result、business result、artifact address/size/mode、error summary、sanitized log | 结论 16/600；事实 13/500；ID/path/log 12 mono；label 12/400 muted | `重试`仅在真实 handler 可用，否则无主动作 | 复制受控值、展开原始证据、关闭 Drawer |

## 8. 每 frame 的状态覆盖

| Frame | empty | loading | error | blocked | approval | staged |
|---|---|---|---|---|---|---|
| F01 | 无项目：说明范围 + `连接已有仓库` | 表骨架 + `aria-busy` | ErrorBanner + `重试` | nextAction 行写原因/影响/修复 | N/A：目录无批准动作 | N/A：目录无草稿写路径 |
| F02 | 同 F01，单动作 | 3 行列表骨架 | 全宽错误 + 重试 | 阻断摘要紧邻主动作 | N/A | N/A |
| F03 | 无组件：说明无法形成发布基线；仓库分析保持折叠 | detail/组件分区骨架 | 详情失败重试；分析错误局部恢复 | 组件变更未评审时标影响 | N/A：策略只读 | 分析建议只显示“待评审”，不自动应用 |
| F04 | 无发布单：`创建发布单` | table skeleton | ErrorBanner + retry | 顶部 checkpoint issue + 精确动作 | 粗状态可显示待审批；详情处理 | draft ReleaseOrder 明确为草稿 |
| F05 | 无 build/deploy：说明尚未执行 | 各 run 局部 skeleton/poll 状态 | 阶段错误摘要 + retry/日志 | 红色决策行 + 可见 disabled reason | 手工 gate 待确认时显示 reason 输入入口 | 未构建/未部署按阶段状态表达，不伪称成功 |
| F06 | 无 production run：说明尚未生产发布 | preview 与 run history 分区 loading | preview/confirm 错误保留输入不漂移 | 预发证据、artifact、gate 任一不足即阻断 | `待生产审批`，显示 reviewer/evidence（若返回） | 候选版本仍未成为运行中版本 |
| F07 | 当前步骤无记录：短文案 + 下一合法动作 | 局部 skeleton，不整页闪烁 | sticky/近场 error + retry | 首屏看到原因、影响、修复 | 审批状态在 CTA 上方 | 阶段状态纵向展示 |
| F08 | 无候选版本：说明需先完成发布生成合格版本 | list/detail 双区 skeleton | governance 常驻 ErrorBanner + retry | 无 approved run 时禁用切换并解释 | 实际 `待生产审批` badge + 原因 | 候选仅 eligible，不标运行中 |
| F09 | 同 F08 | 3 行紧凑列表 skeleton | 全宽错误 + retry | 原因在主动作上方 | 同 F08 | 同 F08 |
| F10 | 无变量：说明 plain/secret/resource 三类 + 一个添加动作 | table skeleton | 初始加载常驻错误；保存失败局部 alert | collision `role=alert` 阻止保存 | capability/approval API 拒绝需可执行翻译 `[unresolved]` | 已有 staged banner：review/discard；显示 draft/current revision |
| F11 | 当前环境无 Site：用途、发布影响、`添加域名入口` | table skeleton | ErrorBanner + retry | production 无入口用 compact issue row | CRUD 无统一审批前检 `[unresolved]` | preview 是 dry-run plan，不等于已同步 |
| F12 | 无日志：说明“没有返回日志”不等于无错误 | Drawer 内骨架/role=status | 错误摘要 + retry，保留 run 身份 | 截断/脱敏/证据不可用明确标注 | N/A：Drawer 不做审批 | N/A：只读证据 |

## 9. Route / query interaction map

| 用户动作 | 规范 route/query | 结果状态 | 迁移/错误要求 |
|---|---|---|---|
| 项目目录 | `/projects` | SSR directory → SWR scoped refresh | 401/403 登录，其余错误可重试 |
| 进入项目信息 | `/projects/:id` | 默认 Project information | `tab/view` 旧 query canonicalize |
| 进入发布列表 | `/projects/:id/releases` | release list | 项目行旧 `?view=releases` 应直接改规范 route |
| 创建发布单 | `/projects/:id/releases?create=true` | create modal | 成功写 `releaseOrderId` 并进入详情 |
| 进入发布详情 | `/projects/:id/releases?releaseOrderId=:rid` | detail workbench | `/publish/:rid` 旧链接重定向到规范地址 |
| 选择执行步骤 | 同页 `releaseStep=preflight|build|deploy` | 选中唯一步骤 tab | query 非法时回 preflight 并替换 URL |
| 打开运行/日志 | 同页 `buildRunId` / `deploymentRunId` / `releaseRunId` | history/log Drawer | ownership 不匹配显示错误，不静默串项目 |
| 项目配置 | `/projects/:id/settings?env=:envId&envTab=:tab` | 已有环境 + 六区之一 | tab 仅 version/targets/resources/variables/access/verification |
| 域名与入口 | `/projects/:id/domains` | environment-scoped Site list | environment query 是否持久化 `[unresolved]` |
| 快捷发布 | `/projects/:id/publish` | 只自动执行到 staging | 成功进入 release detail；文案不得暗示自动 production |
| 旧 deployment 深链 | `?view=deployments&runId=:runId` | 应迁移到对应 release Drawer | 解析失败进入 named error，禁止无限 loading |

## 10. API / model / audit data flow

### 10.1 读路径

`GET /project-directory?take=100` → per-project read filter → Project/Environment/Run/Site 聚合 → F01/F02。

`GET /projects/:id` + `GET /projects/:id/delivery/summary` → 子对象逐项 read filter → F03 与 workbench shell。

Release detail 并行读取 detail/evidence/gates/builds/staging → ownership guard → F05/F06/F07/F12。

Settings 按 `env + envTab` 读取 environment/current revision/targets/versions/policies → F08/F09/F10；非当前 tab 不预取全部子域。

Domains 读取 Sites/servers/environments/proxy configs/sync runs → server record filter → client environment scope → F11；server-side environment filter 为优化项，不是新增能力。

### 10.2 写路径

Create ReleaseOrder → BuildRun → ArtifactManifest → Staging DeploymentRun → production preview → POST production release → `ReleaseRun.awaiting_approval + OperationApproval.pending` → approval decision → Production DeploymentRun → EnvironmentVersion；每一步保持真实独立状态，POST 成功本身不生成 EnvironmentVersion。

Production preview → 用户核对 → `expectedInputHash + idempotencyKey` confirm；设计必须显示确认对象，不能把 preview 当成功。

Environment version action → high-risk audited deploy/production confirm → 新 run/version record；禁止直接写 current pointer。

Environment config save → POST append-only config revision，携带 expected current revision + changeSummary → transaction 内更新 current pointer + AuditEvent。

Site create/update/delete 或 dry-run sync plan → Site/SiteSyncRun；preview 不持久化 live sync 结果。

### 10.3 审计与机密

- AuditEvent 关联 team/actor/project/environment/site/deployment，记录 category/action/target/risk/status/summary/metadata/time；它不是所有写操作的通用终点。当前可证明的是 config revision 同事务 audit、intake connect/finalize 与 worker 终态、Site sync execution 和 approval decision 链。ReleaseOrder create/build/Staging、Site CRUD 与 review submit 不得泛化为“已审计”。
- 配置审计只保留 key/reference，不保留 plain/secret values；UI 仍可能显示 plain value，不得宣称所有值都隐藏。
- Secret 只显示 reference metadata，不显示 secret value。
- Repo inline secret 连接后清内存；日志由 server presenter 截断/脱敏。
- 前端缺统一 action capability matrix；approval-required/forbidden 的稳定错误契约为 `[unresolved/需后端]`。

## 11. 禁止虚构能力清单

1. 不新增环境；Settings 只能选择 intake 已创建的环境。
2. 不新增 settings `routes/protection` tab；源码存在但当前不 dispatch。
3. 不把 deployment 画成已有独立 route；当前真实入口是 release 上下文的历史/日志 Drawer。
4. 不把 `/publish` 描述为自动生产发布；现有自动状态机止于 staging。
5. 不提供 production verification 选项；当前仅 unconfigured/local acceptance。
6. 不把 release policy 画成可编辑；当前项目信息只读。
7. 不提供自由输入版本；只选已有 eligible `name + x.y.z` 版本。
8. 不把 version switch 画成瞬时 pointer update、无审计切换或删除历史。
9. 不宣称所有高风险动作已在渲染前完成 capability 预检。
10. 不把 operation approval 错误画成统一可恢复流程，除非后端契约补齐。
11. 不提供 rollback impact matrix、事故锁定、三种 save/deploy 分支的可点击能力。
12. 不画 DNS 记录、传播 ETA、备案或访问测试的成功值，除非 API 返回真实字段。
13. 不自动应用仓库分析建议；必须绑定 branch/commit、人工 review 后更新事实。
14. 不显示 secret value，不在审计或日志 mock data 中放敏感值。
15. 不把缺日志、缺证据、local acceptance 写成“健康/验证通过”。

## 12. OpenPencil 布局、token 与标注

### 12.1 文档结构

- 单页 `Devpilot Project Workbench Review`，精确 30 个 top-level root：F00-A–F00-D + F01–F26；桌面/移动按流程成组排列。
- Root 使用 `frame`；内部只用 auto-layout，layout container 子节点不写 x/y。
- 重复表行/列表行使用 script loop 或 reusable frame/ref；不复制粘贴近似节点。
- 推荐层次：`WorkbenchShell / PageHeader / ContextIssueRow / ScopeControl / DecisionSummary / Content / EvidenceDisclosure`。
- 角色优先：navbar、nav-link、table/table-row/table-cell、button、icon-button、badge、form-input、heading、body-text、label。
- 图标使用 `icon_font` + Lucide kebab-case；不用 emoji，不依赖 unresolved path post-process。

### 12.2 尺寸与栅格

- Desktop root：1440×1000；页面内容按当前 dashboard shell 自适应，不另造超窄 max-width。
- Mobile root：390×844，内容允许纵向溢出并标注 scroll；禁止横向 content overflow。
- Desktop settings：190px config rail + flexible main + 280–320px inspection pane；窄于 `xl` 时 inspection 下移。
- Release desktop：flexible main + 320px evidence aside；移动端全部按决策顺序堆叠。
- Dense table 行高 56–64px；操作列固定；mobile compact row 最小 72px。
- 间距采用 repo 现有 4/8/12/16/24/32 token；相关项 8–12，组件 16，组 24，section 32。
- 控件视觉可紧凑，但交互 hitbox ≥44×44。

### 12.3 颜色与排版 token

- OpenPencil variables 使用语义名：`$bg`, `$surface`, `$text`, `$textMuted`, `$border`, `$primary`, `$success`, `$warning`, `$danger`, `$focus`。
- 颜色值从 live Devpilot token 抄录；brief 不新增 hex、不增加第三种高饱和强调色。
- 优先用白底、分隔线、spacing、字重；只有独立对象才用 card，列表/环境/步骤不做卡片。
- CJK 画板用 `Noto Sans SC` 作为确定性替代，实现继承 repo `font-sans`；CJK letterSpacing=0、lineHeight≥1.3。
- 页面标题 20–24/600；section 18/600；对象/阻断 14–16/600；事实值 14/500；正文 14/400；辅助 12/400。
- ID/SHA/digest/path/key/log 使用 mono 11–12/400–500；完整值由 title/copy/disclosure 承载。
- 粗体只给对象、状态、阻断和下一步，不给 URL、时间、作者、所有数值同时加粗。

### 12.4 标注协议

- 每个交互节点命名：`[ACTION] label → route/API → success state`。
- 每个状态变体命名：`[STATE/loading|empty|error|blocked|approval|staged]`。
- 每个数据区标：`[DATA/source-confirmed] endpoint → model.field`；不确定字段标 `[UNRESOLVED]`。
- 每个高风险动作标：risk、permission assertion、approval requirement、AuditEvent result。
- 每个 technical disclosure 标：默认收起内容、完整值入口、脱敏/截断边界。
- 每个 responsive frame 标：reading order、scroll boundary、44px hitbox、focus return destination。
- 文案注释包含 cause、impact、action；禁止 `立即处理`、`处理中请稍后` 这类无对象文案。

## 13. OpenPencil 与实现验收

1. 30 个 frame 全部存在，名称、尺寸、状态与本 brief 一致。
2. F05/F06/F07 的 header/env/step/CTA 由同一环境变量生成，不出现跨环境文案。
3. F08 状态、时间、操作不重叠；F09 无横向裁切且主动作首屏可达。
4. 每个 frame 都有 empty/loading/error/blocked/approval/staged 的明确变体或 `N/A + 原因`。
5. 所有列表使用 table/compact list；没有 environment cards、step cards 或 nested cards。
6. 每页只有一个 page-level primary；repair action 与问题同行；1–3 个 row action 直出。
7. disabled action 旁有可见原因；状态同时使用文本/图标/颜色。
8. Release/Deployment 首屏先结论和原因，原始 gate/log/digest 不抢主层级。
9. 每个按钮/链接均有 route 或 API 标注；无真实 destination 的控件已删除或标 unresolved。
10. Version switch、production confirm、config revision、Site mutation 标明结果 model，并逐动作明确 AuditEvent 为“已有 / 无直接写 / 需契约”，不得统一宣称已审计。
11. Secret 不显示值；mock log 不包含 token/credential；plain value 边界描述真实。
12. Mobile reading order 符合：对象 → 状态/阻断 → 关键事实 → 主动作 → 证据。
13. OpenPencil 树无 layout child x/y、无 `fit_content` parent 内 `fill_container` 循环、同级宽度策略一致。
14. 使用真实 Picshare 值：`0.0.1`、`master @ 8e7c465d`、BuildRun #10；不得使用 lorem ipsum。
15. 完成画板后执行 OpenPencil refine/layout 检查；本 brief 阶段未运行该检查。
16. 实现后以同视口对比当前图与批准配置稿，并专项验证 keyboard/focus/200% zoom/color contrast。

## 14. 交付顺序

1. 先画 F05/F06/F07，锁定环境单一状态源与 release hierarchy。
2. 再画 F08/F09，锁定表格列、inspection、移动 compact list。
3. 画 F01–F04，统一对象/状态/动作语法。
4. 画 F10–F12，统一 staged、空态、evidence disclosure。
5. 逐 frame 对照 route/API/model/audit 标注，删除无法落地的控件。
6. 最后做 responsive/a11y 注释与 unresolved 清单复核，再进入代码实现。
