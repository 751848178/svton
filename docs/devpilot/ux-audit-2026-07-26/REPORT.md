# Devpilot 真实使用者交互与信息可用性全量评估

> 结论日期：2026-07-26 21:13 CST（Asia/Shanghai）  
> 评估对象：`http://localhost:3120/` 的本地 Docker 实例  
> 主评估模型：OpenAI Codex（GPT-5 系列；运行时未提供更细型号）  
> 子 Agent：3 个（持续交付竞品、运维治理竞品、前端路由与操作盘点）  
> 工具：Codex 内置浏览器、浏览器 DOM/交互控制、当前运行截图、源码受限检索、官方产品文档检索、图像复核  
> 账号与数据：`Test Org` / `System Administrator`；使用现有本地演示数据  
> 仓库变更边界：没有修改任何项目代码、配置、依赖或数据库迁移；只新增本报告和本轮截图证据  

## 1. 一句话结论

Devpilot 已经具备一个研发部署平台所需的大部分“功能入口”和领域对象，但目前更像一组能力很广的管理控制台，而不是一个能让真实研发团队放心完成生产变更的交付产品。最大问题不是功能少，而是**状态真相、风险语义、主链引导和恢复上下文没有形成统一模型**：用户能点到很多操作，却经常无法确认“这是计划还是真执行、是否影响线上、当前生效版本是什么、失败后旧版本是否仍服务、下一步该做什么”。

基于本轮实际页面和操作证据，当前适合继续做本地/预发研发验证，不建议在没有额外人工操作规程的情况下作为真实生产交付平台开放给普通研发用户。

## 2. 评估范围、方法与边界

### 2.1 覆盖

- 盘点并审查了前端源码中的 **38 个路由、19 个产品 surface**。
- 实际访问了所有可达顶层页面、现有实体详情页和关键 Tab/Drawer/Modal。
- 产出并人工复核了 **75 张本轮截图**。
- 实际操作了登录、退出、项目五步向导、项目导入表单、项目 6 个 Tab、环境变量表单、应用服务 dry-run 部署、服务状态/日志动作、站点同步计划、资源请求/实例/控制、密钥生成、监控 4 个 Tab、日志流、治理、团队和管理端表单等。
- 对删除、正式 live 执行、回滚、恢复、资源释放、成员移除、策略停用/删除等不可逆或可能影响运行态的操作，仅检查入口、确认层、字段和源码分支，没有提交。
- 对无现成实体的 CDN 详情、旧 Proxy 详情，以及需要真实第三方凭证的 Git/CDN/云资源流程，完成了入口和源码级审查，没有伪造“真实供应商验证”。

### 2.2 本轮产生的本地数据副作用

为了验证真实交互，执行了非破坏性的本地演练动作：一次服务 dry-run 部署、服务状态/日志检查、一次站点同步计划、一次性密钥生成。它们增加了本地部署/操作/站点计划记录，但没有执行 live 部署，没有保存生成的密钥，没有修改项目代码，也没有连接真实外部供应商。

### 2.3 评分说明

下表是基于本轮证据的启发式判断，不是统计学量表。

| 维度 | 评分 | 判断 |
|---|---:|---|
| 功能覆盖广度 | 7/10 | 项目、服务、环境、资源、站点、观测、审批、审计均有入口 |
| 主任务链清晰度 | 5/10 | 能走通局部步骤，但对象层级和跨模块跳转缺少统一主线 |
| 信息完整性 | 4/10 | 缺当前线上版本、影响范围、状态新鲜度、恢复建议、关联变更等关键上下文 |
| 状态可信度 | 3/10 | 多处跨页面计数/安装状态不一致；空白、无数据、失败和过期未区分 |
| 操作安全与恢复性 | 4/10 | 部分有审批/确认，但风险语义和 confirmation 规则不一致 |
| 新用户可学习性 | 3/10 | 38 个路由对应的正式文档只有 1 篇；专家字段直接暴露 |
| 无障碍与表单可用性 | 4/10 | 基础语义存在，但长弹窗裁切、标签重排、重叠和占位符替代标签问题明显 |

## 3. 最高优先级问题与更好的预期

| 优先级 | 现状证据 | 用户风险 | 更好的预期 |
|---|---|---|---|
| P0 | 未登录直达 `/dashboard` 会先渲染后台壳和“加载中”再跳登录；源码中 `/dashboard`、`/docs` 不在保护前缀 | 用户无法确认认证边界，未来新增聚合数据时可能出现内容闪现 | 认证在服务端/中间件先判定；未授权请求不渲染后台壳；所有受保护页采用 allow-list；合法回跳一致 |
| P0 | 服务部署 dry-run 文案写“实际命令将在目标服务器执行，但不会改动线上状态” | “演练”与“在目标服务器执行”互相矛盾，研发无法判断真实风险 | 把 Preview、Plan、Check、Dry-run、Live 定义成互斥模式；逐步骤标明是否会连接目标、是否执行命令、是否写磁盘/重启/切流 |
| P0 | 应用服务“状态”“日志”按钮点击后直接创建操作；低风险容器指标动作大量被“需输入 live 确认文本”阻断 | 只读检查也会产生任务和审计噪声；风险分级与确认规则不可信 | 统一 L0-L4 风险模型；L0 查询直接执行且不要求 live confirmation，L2 预览+确认，L3/L4 typed confirmation/原因/审批 |
| P0 | 资源申请审批、交付、Supervisor、执行策略、访问策略、备份恢复等高权限入口大多对普通登录用户可见，主要依赖后端拒绝 | “看得到但点不了”；容易误判权限和误触高风险动作 | UI 与 API 共用同一 `action + scope + condition` 权限模型；隐藏或禁用时解释 Effective access；生产环境单独保护 |
| P0 | 项目概览、环境资源、站点、服务器检测、应用服务状态出现互相不一致的数据 | 用户不知道哪个页面才是真相，部署判断可能建立在错误状态上 | 每个对象同时展示 desired、observed、operation、health、freshness 五类状态；显示来源和最后同步时间；跨页共用同一聚合接口 |
| P1 | 部署列表常以“已阻塞”结束，行内缺明确原因、当前线上影响、恢复动作和关联审批 | 失败后用户不能快速回答“线上是否仍正常” | 部署详情固定展示来源 commit、环境、当前线上版本、阶段时间线、失败步骤、日志、审批、影响、验证和回滚目标 |
| P1 | 站点计划记录把 Nginx 路径、TLS 失败和整段 HTML/Next 脚本输出直接铺在页面 | 关键信号被原始数据淹没，页面可能极长且难检索 | 默认三行摘要；结构化显示 check、结果、耗时、原因、影响；原始 stdout/stderr 折叠、截断、下载；支持复制 correlation ID |
| P1 | Monitoring 指标区域空白，SLO 显示 `-`，告警反复提示未绑定目标，但没有数据新鲜度和修复路径 | “没有问题”和“没有遥测”无法区分 | 统一 Empty State：真空、无遥测、权限不足、供应商失败、部分失败、过期、离线；每种状态提供诊断和 CTA |
| P1 | 日志中归档流仍可启动实时跟随，计数文案出现“0 条条目”；设置入口不明显 | 状态与可用动作冲突，容易误操作 | 归档流禁用实时动作并解释；Stream 状态与动作矩阵一致；将设置、采集、保留策略、Tail 分层 |
| P1 | 配置、资源、治理的新增表单大量直接暴露 regex、adapter key、operation key、Schema JSON 等专家字段 | 普通研发无法安全配置；错误配置成本高 | 提供场景模板、结构化 builder、实时验证和模拟命中结果；高级字段收起；保存前显示有效策略解释 |
| P1 | 审计只有分类/状态/风险筛选和列表，没有时间、全文搜索、详情、diff、原因、导出 | 不能完成真实事故追踪和合规取证 | 审计事件记录 actor/delegator、before/after、reason、operation/deployment/incident correlation；支持时间、搜索、导出和不可变详情 |
| P1 | 旧 `/proxy-configs`、`/domain`、`/cdn` 路由仍能使用，服务器详情还主动链接旧 Proxy | 用户面对两套站点/CDN模型，不知道哪一套真实生效 | 旧工具只读或重定向；唯一主入口为 Sites/CDN 台账；明确迁移状态和数据归属 |
| P1 | Docs 的“平台总览”仍是占位，仅执行策略有正式文章 | 功能复杂度与学习支持严重失衡 | 文档与 19 个 surface 同步发布；页面内嵌“为什么/何时/风险/恢复”；关键错误直接链接对应章节 |
| P2 | 登录页“忘记密码”链接实际指向 `#`；已登录访问认证页的落点与注册成功落点不一致 | 用户遇到死链和导航不可预测 | 未实现功能不要伪装成可点击链接；统一登录、注册、回跳、首次进入和多团队选择逻辑 |
| P2 | 多个弹窗超过视口或出现字段重叠；项目名称输入后组织字段可访问名称被替换 | 键盘和屏幕阅读器用户难以完成任务；视觉上也易填错 | 弹窗有稳定内部滚动、固定标题/动作区、语义 label；做键盘、焦点、缩放和 320/768/1440 响应式验收 |

## 4. 五条核心用户旅程

### 4.1 新项目：创建 → 依赖 → 资源 → 预览 → 生成

实际表现：五步向导的阶段感清楚，能够选择 Backend/Admin/Mobile、功能、数据库和资源模式，也能预览目录。但本轮选择“缓存”后，资源步骤没有出现 Redis 配置，最后预览却声明 Redis 依赖，同时显示“无资源配置”。这会让用户在生成前无法确认依赖是否真的就绪。

更好的预期：

1. 第 1 步建立项目标识与仓库来源。
2. 第 2 步选择运行组件并立刻显示新增依赖。
3. 第 3 步运行依赖解析，列出 MySQL/Redis/Object Storage 等必需项和可选项。
4. 第 4 步逐资源选择 `skipped / manual / credential / instance / pool`，缺项不得进入最终确认。
5. 第 5 步展示代码、资源、环境变量、费用、风险和预检结果；生成后给出下一步部署清单。

证据：[向导资源步骤](./evidence/17-project-create-step4.jpg)、[最终预览](./evidence/18-project-create-step5-preview.jpg)。

### 4.2 服务交付：Plan → Approval → Execute → Verify → Rollback

实际表现：服务部署向导有环境选择、dry-run 预览和正式执行/审批的概念，但部署记录和服务卡没有把“构建、目标资源、健康检查、切流、当前线上版本、验证窗口”串成一个对象。状态/日志等看似只读的操作仍创建执行任务。

更好的预期：

```text
Source(commit/artifact)
  → Preflight
  → Build
  → Provision
  → Health
  → Traffic switch
  → Post-deploy verification
  → Current online release
```

每一步必须有开始/结束时间、输入、输出、日志和责任主体。Retry、Restart、Redeploy、Deploy latest、Rollback、Cancel 要按输入和影响分别定义。回滚明确说明代码、配置、密钥、数据库和持久卷分别是否回退。

证据：[服务 dry-run 计划](./evidence/23-service-deploy-dry-run-preview.jpg)、[服务操作菜单](./evidence/25-service-more-actions.jpg)。

### 4.3 资源：申请 → 审批 → 交付 → 实例 → 注入 → 运行 → 释放

实际表现：这一条链的对象最完整，已有申请、交付实例、资源连接、密钥和运行态控制。但管理型恢复/队列动作与普通申请列表混在一个页面；运行态控制重复出现大量被阻断的低风险任务；用户看不到凭证引用如何进入具体服务和环境。

更好的预期：

- 申请页只处理需求、审批和交付进度。
- 实例页显示所有权、生命周期、使用方、凭证引用、成本和到期。
- 连接页显示代码生成/运行时注入的消费者清单和生效方式。
- 运行页显示 observed state、健康、新鲜度、允许动作和历史。
- Supervisor/队列恢复进入管理员专用治理页。

证据：[资源申请](./evidence/36-resource-requests.jpg)、[运行态资源](./evidence/38-resource-control.jpg)。

### 4.4 站点/CDN：Ownership → DNS → Route → Certificate → Plan → Live → Verify

实际表现：Sites 的动作覆盖面很广，包括同步计划、Live 申请、Smoke、TLS、OpenResty、诊断和 takeover，但页面把专家动作集中在同一菜单，站点卡缺项目/环境/上游关键值，计划记录原始输出过多。旧 Domain/CDN/Proxy 工具又形成第二套路径。

更好的预期：

- 站点详情先展示域名 ownership、DNS、route、certificate 四组状态。
- 每个状态显示最后检查时间、失败原因和修复动作。
- Plan 用结构化 diff；Live 前显示影响域名、路径、证书、上游和回滚目标。
- Live 后自动运行 HTTP/HTTPS、证书和上游健康验证。
- 高级 OpenResty/TLS 工具放入“诊断”子页，按权限显示。

证据：[站点卡和菜单](./evidence/33-site-more-actions.jpg)、[同步记录](./evidence/35-site-plan-records.jpg)、[旧域名工具](./evidence/65-legacy-domain.jpg)。

### 4.5 运行保障：Telemetry → SLO → Alert → Incident → Change

实际表现：Monitoring、Logs、Backups、SLO、规则、静默和通道均有 UI，但它们没有稳定地关联服务当前版本和部署。资源指标空白时无解释，SLO 没有数据新鲜度，告警重复产生“未绑定目标”的记录。

更好的预期：

- 服务页直接显示当前 release、健康、最近部署和 telemetry freshness。
- SLO 显示目标、实际、错误预算、burn rate 和数据窗口。
- 部署完成进入基线/新版本对比窗口，显示错误率、延迟、新错误和告警变化。
- 告警进入 Incident 后自动关联 deployment、service、environment、resource 和 runbook。
- 备份恢复属于高风险变更，必须包含恢复点、覆盖范围、验证计划和审计原因。

证据：[Monitoring](./evidence/45-monitoring.jpg)、[规则事件](./evidence/48-monitoring-rules.jpg)、[备份计划](./evidence/47-backups.jpg)。

## 5. 逐功能评估（19 个 Surface）

### 5.1 公开首页与认证

实际检查：公开首页 CTA、未登录后台跳转、登录、退出、注册表单、密码规则、回登录入口。

问题：

- 未登录后台存在应用壳闪现。
- “忘记密码”是 `#` 死链。
- 注册密码仅 6 位，页面没有展示更完整的安全策略、条款或邮箱验证状态。
- 已登录访问 auth 页的中间件落点与客户端成功落点不一致。

预期：认证前置、回跳一致、无死链；错误要区分凭证错误、账户状态、网络和服务异常；密码恢复必须是完整链路或明确未开放。

证据：[首页](./evidence/01-public-home.jpg)、[登录](./evidence/75-login.jpg)、[注册](./evidence/76-register.jpg)。

### 5.2 Dashboard

实际检查：关键指标、最近部署、待办、快捷入口、加载/失败恢复。

问题：

- 登录后短暂显示“缺少团队 ID”再自行恢复。
- 聚合卡片没有统一显示统计窗口、数据来源、最后更新时间。
- “阻塞部署”等待办缺直接解释和恢复动作。

预期：Dashboard 只显示可行动信号；每张卡有时间范围、freshness 和 drill-down；部分接口失败时保留成功区域并明确 partial。

证据：[Dashboard](./evidence/02-dashboard-overview.jpg)。

### 5.3 项目

实际检查：项目列表、搜索/来源模型、详情 6 Tabs、部署变量展开、环境 Drawer、环境变量新增、Webhook、资源绑定、设置编辑、新建五步、导入长表单。

问题：

- 项目、环境、资源、站点计数不一致。
- Webhook 空态没有创建 CTA 或用途说明，实际却支持复杂 CRUD/密钥轮换/历史。
- 资源 Tab 的“已选 1 项”与是否已保存/待提交不清楚。
- 环境 Drawer 信息密度过高，新增变量自动命名行为不透明。
- 项目设置只露出很少字段，仓库、所有权、生命周期与危险区不成体系。
- 导入页过长，Scope 对后续字段的影响缺持续解释。

预期：项目页成为单一交付上下文，固定显示 owner、repo、environments、services、resources、current releases；每个 Tab 的空态都给出“为什么”和主 CTA；保存态与选择态分开。

证据：[项目概览](./evidence/04-project-detail-overview.jpg)、[环境详情](./evidence/08-environment-detail.jpg)、[Webhook](./evidence/10-project-tab-webhook.jpg)、[资源绑定](./evidence/11-project-tab-resources.jpg)、[导入](./evidence/19-project-import-step1.jpg)。

### 5.4 应用与服务

实际检查：应用列表、新建应用、服务卡、部署向导、dry-run、状态、日志、计划重启/回滚、Live 入口、SLO 下钻。

问题：

- 应用、服务、项目三者的边界和归属关系不够直观。
- 部署与服务操作共享相似任务记录，但用户看不出两者区别。
- 新建应用表单部分字段依赖 placeholder 承担标签语义。
- SLO 目标存在但实际、预算和数据窗口缺失。

预期：Application 是业务能力，Service 是可部署单元，Environment 是保护边界，Deployment 是不可变变更记录；UI 和 URL 都保持这个层级。

证据：[应用服务](./evidence/20-applications.jpg)、[新建应用](./evidence/21-application-create-dialog.jpg)、[状态动作](./evidence/24-service-status-dialog.jpg)、[SLO](./evidence/27-service-slo-detail.jpg)。

### 5.5 服务器

实际检查：列表、新增表单、连接/检测入口、详情、服务检测、旧 Proxy 深链。

问题：

- 服务器显示在线，但详情把 Docker/Nginx/MySQL/Redis/Node/PM2 全部标为“未安装”，同时系统又发现了 Docker 容器。
- 连接、Agent/Supervisor、服务发现和业务容器的状态没有分层。
- “添加代理配置”仍进入旧路径。

预期：分开显示主机连接、Agent readiness、runtime capability、discovered workload、数据更新时间；不再把一次检测结果等同于永久安装状态。

证据：[服务器列表](./evidence/28-servers.jpg)、[服务器详情](./evidence/32-server-detail.jpg)。

### 5.6 Sites

实际检查：列表、新建/编辑入口、同步计划、Live 申请入口、Smoke/TLS/诊断/OpenResty/takeover/删除菜单、计划与运行记录。

问题：站点卡的项目、环境和上游值缺失；专业动作过多；记录中原始输出压倒结构化结论；计划成功后缺明显反馈。

预期：卡片只展示身份、环境、域名、上游、证书和线上状态；所有高级诊断放详情页；操作完成有明确 toast、刷新时间和关联 run。

证据：[Sites](./evidence/29-sites.jpg)、[同步计划](./evidence/34-site-sync-plan.jpg)、[计划记录](./evidence/35-site-plan-records.jpg)。

### 5.7 CDN 台账

实际检查：配置/凭证 Tabs、新建入口、空态、旧 CDN 生成器。

问题：主台账与旧生成器并存；当前无实体，无法从 UI 理解凭证作用域、缓存清理影响和 provider 状态。

预期：配置详情展示 provider、credential reference、domains、origin、routes、certificate、last sync；Purge 必须预览路径范围、缓存影响和审计原因。

证据：[CDN 台账](./evidence/30-cdn-configs.jpg)、[旧 CDN 生成器](./evidence/66-legacy-cdn.jpg)。

### 5.8 历史 Proxy/Domain/CDN 工具

实际检查：三个深链页面、废弃提示、生成表单、从 Server 仍存在的主动入口。

问题：废弃提示已经说明应去 Sites/CDN 台账，但页面仍保留主按钮和可执行表单，形成双重事实来源。

预期：改为只读迁移页或 301/产品内重定向；列出旧配置和迁移目标，不再生成新的非持久化结果。

证据：[旧 Proxy](./evidence/64-legacy-proxy-configs.jpg)、[旧 Domain](./evidence/65-legacy-domain.jpg)、[旧 CDN](./evidence/66-legacy-cdn.jpg)。

### 5.9 资源申请与交付实例

实际检查：申请统计/列表/状态、创建表单、交付治理、实例字段、敏感标记、释放入口。

问题：

- 申请流程和 Supervisor 诊断混在同页。
- 创建表单随资源类型动态增长，但长弹窗缺摘要和固定操作区。
- 实例展示主机、库、用户和 allocation ID，却没有清晰的消费者/环境变量生效链。

预期：申请详情用时间线串联 requester、reviewer、provisioner、delivery、consumer 和 release；所有凭证只显示引用，不在列表展示值。

证据：[资源申请](./evidence/36-resource-requests.jpg)、[实例](./evidence/37-resource-instances.jpg)、[创建申请](./evidence/39-resource-request-create.jpg)。

### 5.10 运行态资源、资源连接与密钥

实际检查：Docker 发现、筛选、同步、动态 action、运行记录、连接空态/新建表单、密钥生成/存储/reveal 模型。

问题：

- 未选服务器时同步按钮显示“同步中…”，像卡死。
- 只读/低风险动作被 live confirmation 阻塞，大量重复失败记录挤满页面。
- 连接配置表单很长；“代码生成”和“运行时注入”虽然有说明，但消费者清单缺失。
- 密钥一次性显示是正确方向，但缺少保存后生效方式、引用方、轮换影响和过期策略。

预期：资源动作采用统一风险模型；Key/Secret 只以 reference 流转，显示 scope、consumers、last rotated、expiry 和生效动作。

证据：[运行态资源](./evidence/38-resource-control.jpg)、[连接表单](./evidence/42-resource-connection-create.jpg)、[密钥生成](./evidence/43-key-generate-dialog.jpg)。

### 5.11 Monitoring

实际检查：资源指标、SLO、事件、规则、静默、通道、创建入口和服务下钻。

问题：

- 指标面板空白而不是明确的 no telemetry。
- SLO 的 `-` 没有解释窗口、源和 freshness。
- 告警事件重复显示未绑定状态目标，但没有一键绑定/诊断路径。
- 规则、静默、通道在同层 Tab，缺少从告警到处置的主线。

预期：所有图表/卡片都有时间、source、last received；事件详情关联服务版本、部署、运行资源和通知投递；规则配置有预览和历史命中。

证据：[Monitoring 总览](./evidence/45-monitoring.jpg)、[规则](./evidence/48-monitoring-rules.jpg)、[静默](./evidence/49-monitoring-silences.jpg)、[通道](./evidence/50-monitoring-channels.jpg)。

### 5.12 Logs

实际检查：流列表、历史日志、筛选、归档流、实时跟随、新建流、设置入口和采集/保留策略源码分支。

问题：归档流仍可实时跟随；“0 条条目”重复量词；设置/采集/retention 能力埋得很深；缺少 deployment/requestId/instance 等常用上下文筛选。

预期：日志 Explorer 支持时间、service、instance、deployment、level、status code、path、requestId；失败阶段一键带上下文打开；Live Tail 明确连接/重连/延迟状态。

证据：[日志中心](./evidence/46-logs.jpg)、[归档流操作](./evidence/51-log-stream-settings.jpg)、[新建流](./evidence/52-log-stream-create.jpg)。

### 5.13 Backups

实际检查：统计、排队开关、新建计划、资源选择、类型和保留天数；运行/恢复分支源码审查。

问题：

- 已有 MySQL/Redis 交付资源，但新建计划的资源下拉没有可选项。
- 新建弹窗出现“资源/名称”标签和控件重叠。
- 页面没有展示备份覆盖范围、预计大小、目标位置、加密、最近验证和 RPO/RTO。

预期：计划创建前明确资产来源和资格；运行详情包含备份点、校验、大小、位置、保留；恢复必须先预演影响、验证目标和回退方式。

证据：[备份空态](./evidence/47-backups.jpg)、[新建计划](./evidence/68-backup-create.jpg)。

### 5.14 执行策略、访问策略与审批

实际检查：执行模板列表/新建、访问策略空态/新建、审批筛选和状态；危险操作未提交。

问题：

- 执行策略直接输入 regex、adapter key、operation key，几乎没有可验证的用户模型。
- 访问策略为 0 时没有说明默认权限，用户不知道当前有效访问是什么。
- 审批空态说明清楚，但缺 diff、checks、合格审批人、自审批规则和批准后是否自动执行。

预期：策略 Builder + Effective access + 模拟器；审批卡固定显示变更 diff、影响、历史、检查、所需人数、到期、原因，且“审批满足”与“开始执行”分开。

证据：[执行策略](./evidence/53-execution-policies.jpg)、[执行策略表单](./evidence/69-execution-policy-create.jpg)、[访问策略表单](./evidence/70-access-policy-create.jpg)、[审批](./evidence/55-operation-approvals.jpg)。

### 5.15 执行治理与审计

实际检查：Supervisor/Jobs/Leases 结构、队列处理、异常统计、审计分类/筛选/列表。

问题：

- Supervisor 4/5，但页面没有把缺失的第 5 项变成明确修复建议。
- 100 个执行任务中 98 个待处理异常、审计 97 个失败事件，噪声极大。
- 审计行的执行人常为 `-`，目标/范围缺项目环境，且无详情与 correlation。

预期：治理页以可恢复异常为单位聚合，显示 owner、age、attempt、next retry、last error、runbook；审计能回答谁、何时、对什么、为什么、前后变化、结果和关联事故。

证据：[执行治理](./evidence/56-execution-governance.jpg)、[审计事件](./evidence/57-audit-events.jpg)。

### 5.16 配置预设与 Git

实际检查：预设空态、保存/导入入口、保存弹窗；Git provider、Token 表单、连接/断开和仓库分支源码审查。

问题：

- “保存当前配置”禁用但没有解释当前配置来自哪里；“保存第一个预设”却能打开仅名称弹窗。
- Git 连接只提示需要 repo 权限，未解释最小 scope、Token 存储、验证、过期和轮换。
- 断开 Git 源码分支没有确认。

预期：预设显示来源、版本、diff 和兼容性；Git 连接优先 OAuth/App，明确 scopes、organization、repo access、webhook 和 token health。

证据：[配置预设](./evidence/58-presets.jpg)、[保存预设](./evidence/72-preset-save.jpg)、[Git](./evidence/59-git-integration.jpg)、[Git 连接](./evidence/71-git-connect.jpg)。

### 5.17 团队

实际检查：团队列表、创建入口、成员搜索、添加、角色下拉、移除、团队设置权限分支。

问题：

- 所有者、管理员、成员的能力缺可见说明。
- 角色变更下拉没有预览影响或保存反馈。
- 面包屑使用截断内部 ID，而不是团队名。

预期：提供角色能力矩阵、继承关系和有效权限；角色变更显示影响并写审计；团队名用于面包屑，ID 只用于详情元数据。

证据：[团队列表](./evidence/60-teams.jpg)、[团队详情](./evidence/67-team-detail.jpg)。

### 5.18 管理端资源池与资源类型

实际检查：资源池容量/可用/状态、新增；资源类型表、新增、审批/交付模式、Schema builder、环境变量模板。

问题：

- 资源池以 endpoint 明文成为主要副标题，缺健康、新鲜度、使用方和容量告警。
- Schema builder 功能强但长弹窗拥挤；字段默认值、敏感性和模板变量之间缺验证反馈。
- 列表操作“禁用”是直接可见的高风险动作，需清楚影响现有实例还是仅禁止新申请。

预期：资源池展示 observed health、last sync、allocations、consumers、capacity forecast；资源类型变更有 schema diff、兼容性检查、受影响申请/实例和 staged publish。

证据：[资源池](./evidence/61-admin-resource-pools.jpg)、[新增资源池](./evidence/73-resource-pool-create.jpg)、[资源类型](./evidence/62-admin-resource-types.jpg)、[新增资源类型](./evidence/74-resource-type-create.jpg)。

### 5.19 Docs

实际检查：目录、平台总览、执行策略文章入口、未登录可达性。

问题：平台总览明确“待补充”，正式内容与产品复杂度严重不匹配；选中项不进 URL/hash，不利于分享和回到原位置。

预期：至少按 19 个 surface 提供快速开始、概念、任务手册、权限/风险、故障恢复和 API/数据模型；页面状态可深链；错误和空态直达相关章节。

证据：[平台文档](./evidence/63-docs.jpg)。

## 6. 38 路由覆盖矩阵

状态说明：`实际` = 本轮浏览器访问；`交互` = 本轮点击/输入/提交了非破坏操作；`源码` = 逐操作源码盘点；`受限` = 无实体、需外部凭证或破坏性操作而未提交。

| # | 路由 | 覆盖 | 健康度 | 主要操作与本轮边界 |
|---:|---|---|---|---|
| 1 | `/` | 实际+交互+源码 | 良 | 首页 CTA、能力卡、登录入口 |
| 2 | `/login` | 实际+交互+源码 | 中 | 成功登录、错误/redirect 分支源码；忘记密码为死链 |
| 3 | `/register` | 实际+源码 | 中 | 字段与校验审查；未创建额外账号 |
| 4 | `/dashboard` | 实际+交互+源码 | 高风险 | 未登录直达、登录后加载、聚合卡和深链 |
| 5 | `/projects` | 实际+源码 | 中 | 列表、搜索/筛选模型、创建/导入入口 |
| 6 | `/projects/new` | 实际+交互+源码 | 高风险 | 五步全走到预览；未生成 ZIP |
| 7 | `/projects/import` | 实际+交互+源码 | 中 | 三 Scope 与长表单；未提交 |
| 8 | `/projects/[id]` | 实际+交互+源码 | 高风险 | 6 Tabs、环境、变量、资源、Webhook、部署；危险操作未提交 |
| 9 | `/applications` | 实际+交互+源码 | 高风险 | 新建表单、服务 dry-run、状态/日志、SLO；未 live |
| 10 | `/servers` | 实际+交互+源码 | 中 | 列表、新增表单、连接/删除分支 |
| 11 | `/servers/[id]` | 实际+交互+源码 | 高风险 | 详情、检测、编辑/删除分支、旧 Proxy 深链 |
| 12 | `/sites` | 实际+交互+源码 | 高风险 | plan、记录、诊断菜单；未 live/rollback/delete |
| 13 | `/cdn-configs` | 实际+交互+源码 | 中 | 两 Tabs/两个新增入口；无实体未 purge |
| 14 | `/cdn-configs/[id]` | 源码+受限 | 待验证 | 无现有配置；编辑/路径 purge/删除未实际执行 |
| 15 | `/proxy-configs` | 实际+源码 | 高风险 | 废弃提示、新增/同步/删除分支；无实体 |
| 16 | `/proxy-configs/[id]` | 源码+受限 | 待验证 | 无现有实体；预览/同步/删除未实际执行 |
| 17 | `/domain` | 实际+源码 | 高风险 | 旧生成器字段、下载分支；未生成 |
| 18 | `/cdn` | 实际+源码 | 高风险 | provider/生成/下载分支；未生成 |
| 19 | `/resource-requests` | 实际+交互+源码 | 高风险 | 创建表单、状态、审批/交付/恢复分支；未提交危险动作 |
| 20 | `/resource-instances` | 实际+交互+源码 | 中 | 实例/敏感标记/来源；未 reveal/release |
| 21 | `/resource-control` | 实际+交互+源码 | 高风险 | Docker 发现、动作、运行记录；未 live 危险动作 |
| 22 | `/resources` | 实际+交互+源码 | 中 | 连接空态、动态表单、删除分支 |
| 23 | `/keys` | 实际+交互+源码 | 中 | 生成一次性值；未保存，截图中不保留明文 |
| 24 | `/monitoring` | 实际+交互+源码 | 高风险 | SLO、事件、规则、静默、通道；未创建生产规则 |
| 25 | `/logs` | 实际+交互+源码 | 高风险 | 历史/归档/实时、新建流、设置分支 |
| 26 | `/backups` | 实际+交互+源码 | 高风险 | 新建计划表单、运行/恢复分支；无可选资源 |
| 27 | `/execution-policies` | 实际+交互+源码 | 高风险 | 列表、新建/编辑/启停/删除分支 |
| 28 | `/access-policies` | 实际+交互+源码 | 高风险 | 空态、新建表单、有效权限缺失 |
| 29 | `/operation-approvals` | 实际+交互+源码 | 中 | 状态筛选、批准/拒绝/执行分支；无待审批实体 |
| 30 | `/execution-governance` | 实际+交互+源码 | 高风险 | Supervisor/Jobs/Leases、队列/恢复/retry/cancel 分支 |
| 31 | `/audit-events` | 实际+交互+源码 | 高风险 | 分类/状态/风险、排序分页；详情/搜索/导出缺失 |
| 32 | `/presets` | 实际+交互+源码 | 中 | 保存/导入/加载/导出/删除分支 |
| 33 | `/git` | 实际+交互+源码 | 高风险 | provider/Token 表单、仓库/断开分支；未接真实账号 |
| 34 | `/teams` | 实际+交互+源码 | 中 | 列表、创建/管理/删除分支 |
| 35 | `/teams/[id]` | 实际+交互+源码 | 中 | 成员、角色、搜索、设置；未修改成员 |
| 36 | `/admin/resource-pools` | 实际+交互+源码 | 中 | 容量、CRUD 表单；未保存 |
| 37 | `/admin/resource-types` | 实际+交互+源码 | 中 | 类型、Schema builder、禁用分支；未保存 |
| 38 | `/docs` | 实际+交互+源码 | 高风险 | 两目录项；总览占位；未登录保护缺失 |

## 7. 竞品研究对照

本轮由两个独立子 Agent 查阅了 117 个主要证据页（持续交付方向 60 个主要官方页面加 1 个补充页；运维治理方向 57 个官方页面）。下列模式来自当前官方文档，不把竞品能力反向臆测为 Devpilot 已实现能力。

| 设计主题 | 成熟产品模式 | Devpilot 当前差距 | 建议借鉴 |
|---|---|---|---|
| 部署对象 | Vercel/Render/Railway 把 deployment 建模为带来源、阶段、日志、环境和线上关系的稳定对象 | 部署/操作/运行记录分散，当前线上版本不清楚 | 统一 Deployment/Release 详情与阶段时间线 |
| 回滚 | Vercel 显示影响与 Undo；Render 明确逐字段恢复；Heroku 用新 Release 记录回滚 | 回滚入口存在，但影响代码/配置/数据/卷的边界未表达 | 回滚影响矩阵 + 新 release + 验证 |
| 环境 | Railway/Heroku/GitLab 把环境作为变量、权限、审批、冻结和推广边界 | Environment 更多像标签和配置容器 | 增加 tier、allowed deployers、freeze、concurrency、current release |
| 部署安全 | GitLab/Harness 显示 diff、checks、审批人、计数和执行历史 | 审批卡上下文不足，批准与执行关系不明确 | “审批满足”和“开始执行”分态 |
| 日志 | Vercel/Render/Railway 支持按部署、服务、实例、时间等上下文过滤 | Stream 有基本筛选，和失败阶段/部署关联弱 | 部署上下文一键进入 Explorer |
| 状态模型 | Argo CD/Datadog 分 desired sync、health、operation、freshness | 单一在线/阻塞/无数据覆盖不同含义 | 统一五维状态并显示来源时间 |
| 资源关系 | Backstage/Datadog 使用目录/服务图帮助依赖与故障传播 | 项目、服务、资源、站点关系需要跨页推断 | declared/observed 拓扑 + source/time/confidence |
| 审计 | GitHub/GitLab/Harness 记录来源、审批、执行和关联变更 | 缺 actor/diff/reason/correlation/导出 | 不可变详情 + 多维检索 + 导出 |
| 高风险动作 | GitLab/Portainer/Harness 强调预览、影响、原因和权限 | confirmation 规则跨模块不一致 | L0-L4 风险矩阵和统一确认组件 |
| 域名/TLS | 成熟平台拆 ownership、DNS、route、certificate 状态 | Sites 动作多但卡片和记录没有这四层主线 | 四状态向导 + last check + 修复 CTA |

主要参考：

- [Vercel Deployments](https://vercel.com/docs/deployments/overview)、[Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Render Deploys](https://render.com/docs/deploys)、[Render Rollbacks](https://render.com/docs/rollbacks)
- [Railway Environments](https://docs.railway.com/environments)、[Railway Deployment Actions](https://docs.railway.com/deployments/deployment-actions)
- [Heroku Pipelines](https://devcenter.heroku.com/articles/pipelines)、[Heroku Releases](https://devcenter.heroku.com/articles/releases)
- [Northflank Workflows](https://northflank.com/docs/v1/application/release/configure-workflows)、[Northflank RBAC](https://northflank.com/docs/v1/application/secure/use-role-based-access-control)
- [GitLab Deployment Approvals](https://docs.gitlab.com/ci/environments/deployment_approvals/)、[GitLab Deployment Safety](https://docs.gitlab.com/ci/environments/deployment_safety/)
- [Harness Execution History](https://developer.harness.io/docs/continuous-delivery/x-platform-cd-features/executions/execution-history/)、[Harness Approvals](https://developer.harness.io/docs/platform/approvals/adding-harness-approval-stages/)
- [Datadog Deployment Tracking](https://docs.datadoghq.com/tracing/services/deployment_tracking/)、[Datadog Service Map](https://docs.datadoghq.com/tracing/services/services_map/)
- [Grafana Alert Rules](https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/)、[Backstage Catalog Graph](https://backstage.io/docs/features/software-catalog/creating-the-catalog-graph/)

## 8. 建议统一的数据结构

### Deployment / Release

```text
id, version, projectId, applicationId, serviceId, environmentId
source { provider, repo, branch, commit, pullRequest, artifact, actor }
mode { preview, plan, dry_run, live }
state { queued, preflight, building, provisioning, health, switching, verifying, succeeded, failed, canceled, blocked }
currentOnlineImpact { unchanged, degraded, switched, unknown }
changes { code, config, secrets, resources, routes, database, volumes }
approval { policy, eligibleApprovers, required, satisfied, expiresAt, reason }
steps[], logsRef, checks[], rollbackTarget, correlationIds[]
createdAt, startedAt, finishedAt, lastUpdatedAt
```

### Service / Environment

```text
Service: desiredState, observedState, runtimeHealth, operationState,
telemetryFreshness, currentRelease, endpoints, dependencies, resources,
slo { target, actual, errorBudget, burnRate, window, source, updatedAt }

Environment: tier, owner, currentRelease, allowedDeployers, approvalPolicy,
freezeWindow, concurrencyPolicy, secretScopes, infraTargets, cost, budget
```

### Resource / Site

```text
Resource: kind, provider, owner, project, environment, desiredState,
observedState, health, freshness, lifecycle, risk, consumers,
credentialRefs, lastSyncAt, availableActions

Site: domains[], ownership, dns, routes[], certificate, upstreams[],
currentConfigVersion, lastPlan, lastLiveRun, verification, rollbackTarget
```

### Approval / AuditEvent

```text
Approval: action, scope, diff, impact, checks, requester, eligibleApprovers,
requiredCount, decisions[], selfApprovalRule, expiresAt, executionPolicy

AuditEvent: actor, delegator, action, target, scope, before, after, reason,
result, risk, requestId, operationId, deploymentId, incidentId, timestamp
```

## 9. 分阶段整改优先级与验收条件

### P0：先建立可信交付边界

1. 统一认证与 RBAC。
   - 未授权页不渲染后台壳。
   - 高风险入口按 Effective access 可见。
   - member/admin/owner 三身份有自动化行为矩阵。
2. 统一模式和风险语义。
   - Preview/Plan/Dry-run/Live 有产品级定义。
   - 每个动作声明副作用、线上影响、审批和回退。
   - L0-L4 风险规则在资源、服务、站点、备份共用。
3. 统一状态模型。
   - 所有核心对象提供 desired/observed/operation/health/freshness。
   - 页面不再出现跨模块互相冲突的计数和安装状态。
4. 建立部署详情主线。
   - 能从任意失败行回答当前线上版本、失败步骤、原因、影响和恢复动作。

### P1：把能力组织成真实工作流

1. 项目向导补齐依赖解析、资源预检和最终一致性校验。
2. Sites/CDN 合并主路径，旧生成器停止产生新配置。
3. Monitoring/Logs/Backups 关联 service/environment/deployment。
4. 审批和审计补充 diff、checks、reason、actor、correlation 和导出。
5. 高密度页面采用摘要、分级可见性、Drawer 下钻和 URL 可恢复筛选。
6. 所有空态区分 no data/no telemetry/error/permission/partial/stale/offline。

### P2：提升学习与细节质量

1. 补齐 19 个 surface 的正式文档和页面内上下文帮助。
2. 修复长弹窗、标签重叠、焦点、键盘和响应式。
3. 统一术语：Project/Application/Service/Environment/Deployment/Operation/Run。
4. 清理死链、重复量词、内部 ID 面包屑、失效按钮和不一致确认。

## 10. 证据索引

所有本轮截图位于 [`evidence/`](./evidence/)。建议优先查看：

- [项目依赖最终预览](./evidence/18-project-create-step5-preview.jpg)
- [服务 dry-run 计划](./evidence/23-service-deploy-dry-run-preview.jpg)
- [站点计划原始输出](./evidence/35-site-plan-records.jpg)
- [运行态资源重复阻断](./evidence/38-resource-control.jpg)
- [Monitoring 空白/无数据](./evidence/45-monitoring.jpg)
- [执行治理异常聚合](./evidence/56-execution-governance.jpg)
- [审计事件可用性](./evidence/57-audit-events.jpg)
- [文档占位](./evidence/63-docs.jpg)
- [备份表单重叠](./evidence/68-backup-create.jpg)
- [访问策略专家表单](./evidence/70-access-policy-create.jpg)
- [团队成员权限](./evidence/67-team-detail.jpg)
- [资源类型 Schema Builder](./evidence/74-resource-type-create.jpg)

## 11. 评估限制

- 当前只有一个管理员身份的现成登录凭证；member/owner 的差异主要依据真实团队页面可见状态和源码权限条件，未用第二个浏览器会话逐一提交 403。
- 没有真实 Git、CDN、云资源或生产服务器凭证；本报告不把本地演练当作真实 provider/生产签核。
- 没有现成 CDN 配置和旧 Proxy 实体，因此两个详情路由只做源码与入口审查。
- 无障碍检查覆盖了 DOM 可访问名称、可见焦点和表单布局，不等同于完整 WCAG 审计；尚未做屏幕阅读器和全键盘回归。
- 没有执行破坏性操作、正式 live、回滚、恢复或删除，因此这些链路的后端成功语义仍需专门的可丢弃测试环境验证。
