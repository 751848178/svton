# Devpilot UX 问题清单(goal 可执行版)

> **文档定位**:供 `goal` 长任务逐张卡执行的修复清单。每张卡自包含——goal agent 读完单张卡就能动手,无需翻阅其他文档。
> - 生成日期:2026-07-25
> - 证据来源:6 份既有 UX 分析文档通读 + 两个 Explore agent 对照代码逐条核实(见 §九 文档索引)
> - 维护规则:修复时把卡片顶部 `状态` 改为 ✅,补 `PR` 字段。**不要再新建新的 ux-*/evaluation-*/audit-* 文档**。
> - 卡片顺序 = 建议执行顺序(已按 优先级 × 工作量 × 依赖关系 排序,不严格按编号)。

---

## 如何用这份文档跑 goal

```
goal "按 docs/devpilot/ux-findings.md 修复 A1 卡片,严格遵循卡内的【修复方案】与【验收标准】"
```

- 每张卡独立可执行,可单独交给一个 goal 任务;
- 卡片内的 `file:line` 是核实时的快照,goal 执行时应先 Read 确认行号未漂移再改;
- 涉及后端 + 前端的卡(如 A3),按卡内标注的【执行顺序】走;
- 卡内标 ⚠️ 的点是需要产品/技术决策处,goal 遇到应停下询问。

---

## 全局约定(所有卡片共享)

- **前端根**:`apps/devpilot-web/src`
- **后端根**:`apps/devpilot-api/src`
- **i18n**:`apps/devpilot-web/messages/zh.json` + `en.json`(中英必须同步,2182 key 对等)
- **反馈组件**:`@/components/ui/feedback/feedback`(`feedback.success/error`),所有写操作成功必须有 toast
- **通用 UI 原语**:`@svton/ui`(`LoadingState/EmptyState/Drawer/Modal/Tabs/Tag/Copyable`)、`@/components/ui`(`PageHeader/ErrorBanner/Button/StatusTag/MetricCard/ActionMenu`)
- **请求层**:`serverRequest<T>('METHOD:/path')`(RSC)、`apiRequest<T>`(client)、`stream`(SSE)
- **代码规范**:单文件 ≤200 行,一文件一职责(见 `~/.agents/skills/code-structure-standards`)
- **验证**:改完跑 `pnpm --filter devpilot-web typecheck` + `pnpm --filter devpilot-api typecheck`(噪声大,日志存 `/tmp/`,只看结果)

---

# P0 — 本周必须(安全红线 + 功能完全失效)

## A1 🔴 资源实例页敏感凭证明文展示

**状态**:✅ 已修 · **优先级**:P0 · **工作量**:小(1 文件) · **依赖**:无 · **核实**:delivery-value.tsx 递归脱敏 + SENSITIVE_KEY_RE + Copyable,对齐 keys 范式

### 现状
`/resource-instances` 把每个实例的 `delivery`(常含嵌套 `credentials`/`password`/`token`)用 `JSON.stringify` 全量铺开,无任何遮罩。资源类型里精心设计的 `sensitive` 标记在展示层完全失效。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/resource-instances/components/ResourceInstancesContent.tsx:98-112` — `Object.entries(instance.delivery)` 逐项渲染
- `同文件:140-154` — `DeliveryValue`:对象走 `CodeBlock` 的 `JSON.stringify(value,null,2)`,原始值 `String(value)`,**无遮罩**
- `同目录 types.ts:13` — `delivery?: Record<string, unknown>`(无敏感标记)
- **对照范本**:`apps/devpilot-web/src/app/(dashboard)/keys/components/key-card.tsx:25,46-75` — reveal-on-click,默认不显示值

### 影响
密钥明文暴露在列表页,任何能访问该页的角色都能看到 DB/Redis/第三方 API 密钥。直接违背平台自身在 `/keys` 设定的安全基线。

### 修复方案
**复制 `/keys` 的 reveal 模式**(已核实:该模式是组件内联,无共享 hook,直接搬):

1. 在 `ResourceInstancesContent.tsx` 顶部加状态(参照 `keys/components/KeysContent.tsx:38`):
   ```ts
   const [revealed, setRevealed] = useSetState<Record<string, string>>({});
   // key 用 `${instanceId}:${fieldKey}` 复合键
   ```
2. 需要一个取明文的接口。**核实点**:`/keys` 走 `GET:/keys/:id/value`(SWR)取明文;资源实例的明文是否已在 `delivery` 里?
   - 若已在(后端已返回明文,只是前端要遮):无需新接口,`reveal` 仅做前端 toggle;
   - 若后端已脱敏(只回 `***`):需后端补 `GET:/resource-instances/:id/credentials` 取明文接口。
   - ⚠️ **goal 执行前先 Read 一个实例的 delivery 实际结构确认走哪条路**。
3. 重构 `DeliveryValue`:对 key 名命中 `/password|secret|token|credential|apikey|privatekey/i` 的值默认显示 `••••••••`,点击「显示」按钮才 reveal,用 `<Copyable text={value}>`(来自 `@svton/ui`)做复制。
4. **可选增强**(对标 Vercel):reveal 时 emit 一条 audit-event(`POST:/audit-events` 或复用既有审计中间件),记录"谁查看了某实例的明文凭证"。

### 验收标准
- [ ] 含敏感 key 的 delivery 字段默认显示 `••••••••`,不显示明文
- [ ] 点击「显示」按钮才出现明文 + 复制按钮
- [ ] 非敏感字段(如 host/port/database)正常显示
- [ ] zh/en 都有 `reveal`/`hide`/`maskedValue` 等新文案 key
- [ ] typecheck 通过

---

## A3 🔴 日志历史查询完全失效(windowMinutes 契约破损)

**状态**:✅ 已修 · **优先级**:P0 · **工作量**:小(后端 1 DTO + 1 service 方法,前端 0 改动) · **依赖**:无 · **核实**:DTO 加 windowMinutes;log-entry-query.service:28-32 照抄 stats 路径接 timestamp 过滤

### 现状
前端日志条目查询带 `windowMinutes`,但后端 entries DTO 无此字段,Nest ValidationPipe 静默 strip → **时间范围筛选完全失效 + 页面顶部常驻英文报错条** `property windowMinutes should not exist`。代码注释自承"entries 预留"(写到一半的功能)。只剩 SSE 实时跟踪可用。

### 证据
- 前端发送:`apps/devpilot-web/src/app/(dashboard)/logs/hooks/entries-query.ts:31-33`(设 `params.windowMinutes`)、`:48-50`(发 `GET:/logs/entries`)
- 前端注释 `entries-query.ts:47`:"windowMinutes 仅 stats 原生支持,entries 预留"
- **后端 entries 不用时间窗**(已核实):
  - `apps/devpilot-api/src/log-center/log-entry-query.service.ts:25-34` — `list()` 调 `buildLogEntryWhere` 后 `findMany({ where, orderBy:{timestamp:'desc'}, take:200 })`,**无 timestamp 过滤**
  - `apps/devpilot-api/src/log-center/log-center-entry-query.utils.ts:50-72` — `buildLogEntryWhere` 只过滤 streamId/level/source/projectId/.../q,**无 timestamp**
- **stats 路径已正确实现**(可照抄):`log-entry-query.service.ts:92-101` — `windowMinutes → from/to → where.timestamp={gte:from,lte:to}`
- 归一化函数:`log-center-entry-query.utils.ts:74-83` — `normalizeLogStatsWindowMinutes`(clamp [1,10080],默认 60)
- ⚠️ **真实 DTO 文件是 `dto/log-center.dto.ts`**(被 service import),`dto/log-entry.dto.ts` 疑似 legacy 未用——**改之前先确认 entries endpoint 实际 validate 的是哪个 DTO**

### 影响
日志中心核心功能(按时间查历史日志)完全不可用,且常驻英文技术错误条伤害专业感。排障场景下用户只能用 SSE 看实时,无法回溯。

### 修复方案
**后端是更干净的改法,且与 stats 契约统一**(已核实推荐):

1. 在 entries 的实际 DTO 文件(确认是 `dto/log-center.dto.ts` 的 `ListLogEntriesQueryDto`)加:
   ```ts
   @IsInt() @Min(1) @IsOptional()
   windowMinutes?: number;
   ```
   (复制 stats DTO `ListLogStatsQueryDto` 的同名字段定义)
2. 在 `log-entry-query.service.ts` 的 `list()` 方法,在 `buildLogEntryWhere` 之后、`findMany` 之前,加(照抄 stats 的 92-101):
   ```ts
   if (query.windowMinutes) {
     const mins = normalizeLogStatsWindowMinutes(query.windowMinutes);
     const to = new Date();
     const from = new Date(to.getTime() - mins * 60_000);
     where.timestamp = { ...where.timestamp, gte: from, lte: to };
   }
   ```
   (需把 `where` 改成 let 或合并到 buildLogEntryWhere 内部——后者更彻底)
3. 保留 `take: 200` 上限不变。
4. 前端无需改动——`windowMinutes` 本来就在发。

**备选**(不推荐):前端改用 `from`/`to` 绝对时间戳,但会与 stats 契约分叉。

### 验收标准
- [ ] `GET:/logs/entries?streamId=X&windowMinutes=60` 返回最近 60 分钟的条目,不再有 400 报错
- [ ] 前端切换时间范围(15m/1h/6h/24h)实际过滤结果
- [ ] 顶部英文报错条消失
- [ ] 不传 windowMinutes 时行为不变(向后兼容)
- [ ] 后端 typecheck + 一个 curl 冒烟测试通过

---

## A15 🔴 execution-governance 整页对普通用户不可读(评分 1/5)

**状态**:✅ 已修 · **优先级**:P0 · **工作量**:极小(文案 + 1 处折叠) · **依赖**:无 · **核实**:Alert tone=info + 深链;Supervisor 接 i18n

### 现状
整页 Supervisor/Worker/Lease/Orphan/Fleet 等后端实现术语,普通用户误入后看到一屏技术名词产生焦虑,无任何入口理解这页是干嘛的。是全站唯一评分 1/5 的页面。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/execution-governance/components/execution-governance-content.tsx:133` — `<h2>Supervisor</h2>` 硬编码英文(未走 i18n)
- `messages/zh.json` — `executionGovernance.pageDescription="队列、worker 与远端会话治理"`(三个术语叠加)

### 影响
非管理员用户误入后完全迷失;`Supervisor` 硬编码绕过 i18n。

### 修复方案
1. 改 `zh.json`:`executionGovernance.pageDescription` → `"查看平台后台任务的执行情况(管理员诊断用,一般无需关注)"`
2. `execution-governance-content.tsx:133` 把 `<h2>Supervisor</h2>` 接入 `t('executionGovernance.supervisor')`,zh 值 `"主管进程"` 或保留 `Supervisor` 但在副标题解释。
3. 页面顶部 `PageHeader` 下方加一个 `Alert`(info 态):「本页为平台执行引擎的诊断视图,普通用户通常无需关注。如遇部署阻塞,请前往 [操作审批] 查看。」带深链到 `/operation-approvals`。
4. (可选,需产品确认)从主导航把 `/execution-governance` 折叠到管理员区,普通用户不可见——参照 `navigation-items.ts` 的 `filterNavSectionsByRole` 机制。

### 验收标准
- [ ] pageDescription 改为人话
- [ ] `Supervisor` 标题走 i18n
- [ ] 顶部有 info Alert 解释 + 跳审批的深链
- [ ] zh/en 同步

---

## A21 🟠 无全局取数兜底(架构性,Kimi 5 个运行期 P0 的根因)

**状态**:✅ 已修 · **优先级**:P0 · **工作量**:中(1 新组件 + 各页接入) · **依赖**:无 · **核实**:data-boundary.tsx + server.ts AbortController 15s 超时 + TimeoutError 翻译

### 现状
各页各自 `if (loading) return <LoadingState />`,**无统一超时/错误态/重试**。Kimi 浏览器实操发现:资源申请/实例/连接/密钥 4 页同时挂起 60-90 秒不恢复,连秒开的页面也沦陷——一个卡死的后台任务即可造成全站性可用性事故。API 直连正常,问题在 Web 服务端取数层(RSC)挂起。

### 证据
- 各 page.tsx 普遍模式:`if (detail.loading) return <LoadingState />`,无超时分支
- Kimi 报告 P0-1 + 附录 B:挂起发生在 Web 服务端取数层,非后端故障

### 影响
任何后端慢响应或取数挂起 → 用户面对永久 spinner,无任何"出错了/重试"的信号。这是把"演示可用"变成"生产可用"的硬门槛。

### 修复方案
1. 新建 `apps/devpilot-web/src/components/ui/data-boundary.tsx`:
   ```tsx
   export function DataBoundary({ loading, error, onRetry, children, skeleton }) {
     // loading 且超过阈值(用 useEffect + setTimeout 12-15s 设 stale 标志)→ 显示"加载时间较长,可重试"
     // error → ErrorBanner(message + retry)
     // 否则 children
   }
   ```
2. 包裹 `serverRequest`:在 `lib/api-client/server-request.ts` 加 AbortController + 超时(如 15s),超时抛 `TimeoutError`。
3. 把各页的 `if (loading) return <LoadingState/>` 替换为 `<DataBoundary>` 包裹主体。**分批接入**:先改 4 个 Kimi 实操挂起的页(resource-requests/instances/resources/keys),再推全站。
4. 错误信息用户化:不要把 `property windowMinutes should not exist` 这类技术原文直出(A3 修了就不出现了,但作为通用规则),错误码 + 建议操作,技术细节折叠。

### 验收标准
- [ ] 取数 > 15s 显示"加载时间较长"提示 + 重试按钮
- [ ] 取数抛错显示 ErrorBanner(含重试)
- [ ] 4 个 Kimi 实操页接入 DataBoundary
- [ ] 不再出现永久 spinner

---

# P1 — 两周内(核心体验,后端就绪前端补接线性价比最高)

## A4 🟠 监控指标只渲染状态点,丢弃真实数值

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:小(1 文件) · **依赖**:无 · **核实**:metric-chip + metric-sparkline + deployment-event-markers 三组件;数值+趋势+部署虚线全到位

### 现状
后端已算出 CPU/内存的 latest/average/max/delta,前端类型也带,但 UI 只渲染 kind/source/status/sampleCount 四个元数据,**真实数值和图表全被丢弃**。监控从"摆设"变"可用"就差这一步。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/monitoring/components/dashboard-panels.tsx:44-65` — 每行只输出 `resourceKindLabels[row.kind]`、`metricSourceLabels[row.metricSource]`、`<StatusTag>`、`t('samples',{count})`,**无 cpu/memory 引用**
- `同目录 types-dashboard.ts:34-42` — `ResourceMetricDashboardRow` 明明带 `cpuPercent/memoryPercent/memoryUsageBytes/...` 每个是 `{latest,average,max,delta}`
- 后端 `apps/devpilot-api/src/monitoring/monitoring-resource-metric-dashboard-builder.service.ts:74-84` 已从真实样本计算

### 影响
"监控"沦为状态清单,可观测性价值完全未释放。运维看不到资源水位,无法主动发现问题。

### 修复方案
1. 在 `dashboard-panels.tsx` 每行补数值展示:
   ```tsx
   {row.cpuPercent && <MetricChip label="CPU" value={row.cpuPercent.latest} suffix="%" />}
   {row.memoryPercent && <MetricChip label="内存" value={row.memoryPercent.latest} suffix="%" />}
   ```
   (MetricChip 是个小的 label+value+可选阈值色块组件,可新建在 `monitoring/components/`)
2. **加分项(对标 Railway)**:用 `delta` 数组画一个 20px 高的 inline sparkline(可用轻量库如 `react-sparklines`,或纯 SVG 手写 ~30 行)。把 `startedAt` 标注为虚线——直接看出"哪个部署导致资源尖峰"。Devpilot 的 deploymentRun 数据现成可关联。
3. 数值按阈值着色:CPU/内存 ≥80% 红、≥50% 黄、其余默认(对标阿里云 Gauge 绿黄红分段)。

### 验收标准
- [ ] 每行显示 CPU/内存当前值(latest)
- [ ] 有 sparkline 趋势(至少 latest/average/max 三点)
- [ ] 高阈值(≥80%)红色警示
- [ ] 不破坏现有 status/sampleCount 展示

---

## A9 🟠 项目列表卡片稀疏 + 无检索

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:中 · **依赖**:无 · **核实**:project-card.tsx 独立 + use-projects hook + project-card-fields utils

### 现状
项目卡片只有 name/来源/范围/标签/创建时间,**无最近部署状态、无环境健康、无快捷操作**;列表零搜索/筛选/分页。三家头部产品(Vercel 截图缩略图+状态点、Railway 绿/红状态点、AppStack 部署状态+版本号+立即部署入口)都把"列表卡一眼看状态"作为首屏第一职责。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/projects/page.tsx:99-108` — 纯卡片网格,无 `<input>`/`<select>`/分页
- `同文件:113-154` — `ProjectCard` 函数(内联,非独立文件),整卡是 `<Link>`,唯一交互是导航
- `Project` 类型(同文件:21-28):`{id,name,description,gitRepo,createdAt,config}`,**无运行态字段**

### 影响
规模一上来即不可用;用户无法从列表判断"哪个项目现在状态如何"。

### 修复方案
1. **后端/数据层**:`GET:/projects` 返回是否含最近部署摘要?若不含,要么后端补 `latestDeploymentStatus`/`envHealth` 字段(join),要么前端列表页并行拉 `GET:/deployments/runs?limit=N` 按 projectId 聚合。**goal 先 Read projects hook 确认数据源**。
2. **卡片增强**(`projects/page.tsx` 的 `ProjectCard`):
   - 顶部加状态点(绿=最近部署成功/红=失败/灰=无部署)+ 最近部署相对时间("3 分钟前")
   - 底部加环境摘要 Tag 行("3 环境 · 2 应用")
   - 三点菜单(`ActionMenu`):部署 / 设置 / (A6 完成后)归档删除
3. **检索**:顶部加搜索框(按 name/description 模糊匹配,前端 filter 即可,项目数通常 <100)+ 来源筛选(`getProjectOriginLabel` 的几个值)。
4. **分页**:项目数大时再上,首版前端 filter 足够。

### 验收标准
- [ ] 卡片显示最近部署状态点 + 相对时间
- [ ] 卡片有环境/应用计数 Tag
- [ ] 顶部搜索框可按名称过滤
- [ ] 来源筛选下拉可用

---

## A5 ✅ 项目 Webhook 后端有 CRUD,前端只读

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:中 · **依赖**:无 · **PR**:本卡(Webhook CRUD 接线)

### 现状
项目详情 Webhook tab 仅列表展示,**连一个 webhook 都建不了**;Git 推送触发部署的链路在前端是断的。

### 证据
- 前端:`apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/webhook-panel.tsx:20-44` — 只读列表 + retry-on-error,token 用 `maskToken` 脱敏
- 后端齐全:`apps/devpilot-api/src/project-webhook/project-webhook.controller.ts`
  - `:67-82` `@Post()` createWebhook
  - `:84-116` `@Patch(':id')` updateWebhook
  - `:118-133` `@Post(':id/rotate-secret')` rotateWebhookSecret
  - `:135-142` `@Get('deliveries')` listDeliveries

### 影响
用户无法配置 Git 推送自动触发部署;webhook 投递失败只能看不能改。

### 修复方案
1. `webhook-panel.tsx` 顶部加「新建 Webhook」按钮 → 打开 Modal(字段:name/provider/urlToken 或自动生成/eventTypes/secret)。
2. 每个 webhook 行加「编辑」「轮换密钥」「投递记录」三个操作(`ActionMenu`)。
3. 新建 `webhook-deliveries-modal.tsx`:调 `GET:/project-webhooks/deliveries?webhookId=X` 展示投递历史(状态/响应码/耗时/重试)。
4. 复用 A1 的 reveal 模式处理 urlToken/secret 的显示。
5. i18n 补 `createWebhook`/`editWebhook`/`rotateSecret`/`deliveries` 等 key。

### 验收标准
- [ ] 可创建 webhook,创建后出现在列表
- [ ] 可编辑 webhook 的 name/eventTypes
- [ ] 可轮换密钥(确认后旧 token 失效)
- [ ] 可查看某 webhook 的投递记录
- [ ] secret/urlToken 默认脱敏

---

## A7 🟠 审批驳回理由硬编码(纯前端改动)

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:小 · **依赖**:无 · **核实**:reject-reason-modal.tsx;use-approvals review 加 comment 参数,默认值兜底

### 现状
reject 无输入框,`reviewComment` 写死"同意执行/拒绝执行",无法满足合规留痕。

### 证据
- **后端已就绪**(已核实):`apps/devpilot-api/src/operation-approval/dto/operation-approval.dto.ts:37-44` — `ReviewOperationApprovalDto { decision: 'approved'|'rejected'(必填); reviewComment?: string(@IsOptional @IsString) }`
- 后端持久化:`operation-approval.repository.ts:59-68` 存 `reviewComment` + `reviewedAt`;schema `prisma/schema.prisma:2254` 有 `reviewComment String? @db.Text`
- **前端写死**:`apps/devpilot-web/src/app/(dashboard)/operation-approvals/hooks/use-approvals.ts:61-65` — `{ decision, reviewComment: decision==='approved' ? '同意执行' : '拒绝执行' }`
- 前端 UI 无输入:`approval-card.tsx:95-101` `handleReject` 直接调 `onReview(approval,'rejected')`

### 影响
合规审计无法追溯"为什么驳回";审批记录全是模板文案。

### 修复方案(纯前端)
1. `use-approvals.ts:57-71` 的 `review` 函数加第三个参数 `comment?: string`,改 body 为 `{ decision, reviewComment: comment || (decision==='approved'?'同意执行':'拒绝执行') }`(approved 可选填,rejected 应必填——见下)。
2. `approval-card.tsx` 的 reject 按钮:点击后打开一个小 Modal/Prompt,带必填 textarea(标题"驳回理由"),提交时把理由传给 `onReview(approval,'rejected',comment)`。approved 可保持快捷通过(不弹框),或也加可选理由输入。
3. 卡片展示区已有 `approval.reason`(申请人理由,`approval-card.tsx:63-65`),在其下补一行展示 `approval.reviewComment`(审批人意见,若存在)。
4. i18n 补 `rejectReasonLabel`/`rejectReasonRequired`/`reviewerComment`。

### 验收标准
- [ ] reject 必须填理由(空则禁用提交)
- [ ] approved 可选填理由
- [ ] 审批记录卡片展示审批人意见
- [ ] 后端无需改动(已验证 DTO 支持)

---

## A10 🟠 部署按钮跳离项目上下文

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:中 · **依赖**:无 · **核实**:deploy-wizard-host/adapter/section 内联到项目详情;header 按钮改为 onClick 打开 wizard

### 现状
项目详情 header 的"部署"按钮是 `<Link href="/applications?projectId=X">`,把用户踢到全局应用列表再筛选。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/project-detail-header.tsx:44,86`
- 竞品普遍实践:Vercel/Railway/Render/AppStack 全部项目内直接有部署入口

### 影响
用户在项目 A 点"部署",被弹到全量应用列表,需再筛选才能找到自己的应用。心智模型割裂。

### 修复方案
**首选**:把已存在的 `DeployWizardModal`(`applications/components/deploy-wizard/`)内联到项目详情的「部署」tab。
1. 项目详情 `DeploymentsTab` 里,每个服务行(applications)加「部署」按钮,点击打开 `DeployWizardModal`(传入该 service 的 application/service/environments)。
2. header 的主「部署」按钮改为:若项目只有 1 个应用 1 个服务,直接打开 wizard;否则滚动到部署 tab 并提示"选择要部署的服务"。
3. 移除 header 的 `<Link href="/applications?projectId=X">`,改为 `onClick` 打开 wizard。

**备选**(工作量小):保留跳转,但 `applications` 页收到 `projectId` 时自动展开该项目下的服务行并高亮"部署"按钮。

### 验收标准
- [ ] 项目详情页内可直接触发部署,不跳转
- [ ] 多服务时能选择目标服务
- [ ] 部署向导 3 步流程(环境→预览→action)在项目上下文内完成

---

## A16 🟠 项目详情 5 panel 无说明、字段裸露(用户原始投诉页)

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:中 · **依赖**:无

### 现状
项目详情 5 个 panel 仅一行 `<h2>`,无"这区块是干什么的"副标题;`env.key`/`run.source`/`urlToken`/`eventTypes` 全裸字段。这是用户原始投诉直接命中的页。

### 证据
- `apps/devpilot-web/src/app/(dashboard)/projects/[id]/page.tsx:59-63`(注:7-22 审计后已改为 Tabs 结构,行号可能漂移,先确认)
- 7-22 IA 审计 §2 逐 panel 详述

### 影响
非开发者完全看不懂页面信息含义。

### 修复方案(参照 IA 审计 §2.3)
1. 按"用户心智"分 3 组,每组带说明小节标题:
   - ① 基本信息(Overview)
   - ② 运行时(Applications + Environments + Deployments)
   - ③ 自动化与集成(Webhook)
2. 每个 panel 标题下加一行副标题(灰字小号):
   - Environments:「项目下的部署环境(如开发、测试、生产),每个环境有独立的资源配置」
   - Deployments:「最近 10 次部署运行,来自代码推送或手动触发」
   - Webhook:「当部署/同步等事件发生时,自动通知到外部服务」
3. 字段加标签 + 图标:`env.key` 标「环境标识」;`run.source` 标「来源」+ 图标(分支图标);`run.branch` 加分支图标。
4. `eventTypes`(`webhook-panel.tsx:35`)用中文事件名映射表(`deployment.completed`→「部署完成」)。
5. 新建 `<PanelGroup title subtitle>` 容器组件替换裸 `<div className="rounded-lg border">`。

### 验收标准
- [x] 每个 panel 有副标题说明
- [x] 字段有中文标签
- [x] eventTypes 显示中文事件名
- [x] 3 组分组视觉清晰

---

## A6 🟡 项目设置页无归档/删除入口

**状态**:✅ 已修(A档) · **优先级**:P1 · **工作量**:小(删除) / 大(归档需迁移) · **依赖**:无 · **核实**:settings-tab 危险区 + type-to-confirm + danger tone;调 DELETE 走 project.delete 策略

### 现状
settings tab 只能改 name/desc/git;而"阻塞原因"提示的修复点(默认分支配置)设置页也解决不了。

### 证据
- 前端:`apps/devpilot-web/src/app/(dashboard)/projects/[id]/components/tabs/settings-tab.tsx:41-95` — 只有 basicInfo
- 后端 `@Delete`(已核实):`apps/devpilot-api/src/project/project.controller.ts:106-119`(risk high,走 `project.delete` 策略)
- **硬删除,无 archive**:`project.service.ts:385-399` 直接 `prisma.project.delete`;`prisma/schema.prisma:619-670` Project 模型**无 status/archivedAt**(对比 Application 模型 `:680` 有 `status`)

### 影响
用户无法清理废弃项目;"已阻塞"状态提示的修复点(默认分支)设置页无法配置。

### 修复方案(分两档)
**A 档(先做,小)**:settings tab 加「危险区」:
1. 输入项目名称确认(type-to-confirm,参照 servers 删除的 `deleteServerConfirm` 模式)
2. 调 `DELETE:/projects/:id`,成功后 router.push('/projects') + toast
3. 同时补「默认分支」配置项(若后端 Project 有 `defaultBranch` 字段——**goal 先确认 schema**;若无,需后端加字段)

**B 档(后做,大,需产品确认)**:真归档需 schema 迁移:
1. `prisma/schema.prisma` Project 模型加 `status String @default("active") // active | archived`(参照 Application)
2. 生成迁移 + `findAll`/`findOne` 过滤 archived
3. 新增 `@Post(':id/archive')` / `@Post(':id/unarchive')` 端点
4. 前端加「归档」按钮,归档项目从主列表移到「已归档」视图

### 验收标准(A 档)
- [ ] settings tab 有危险区 + 输名称确认
- [ ] 删除成功后跳列表 + toast
- [ ] 默认分支可配置(若 schema 支持)

---

## A12 🟡 成功 toast 大面积缺失

**状态**:✅ 已修 · **优先级**:P1 · **工作量**:小(扫一遍) · **依赖**:无 · **核实**:6 处 feedback.success 全补齐(grep 验证 6/6)

### 现状
6/7 页创建/更新后无 `feedback.success`(logs/presets/execution-policies/access-policies/backups/sites 创建均静默)。

### 证据(已核实 6 处)
- logs:`hooks/use-logs-actions.hooks.ts:23-41` `createStream` 无 success toast(只有 error)
- presets:`components/PresetsContent.tsx:109-111` `handleSave` 无 toast
- execution-policies:`hooks/use-policies.ts:83-118` `save` 无 toast
- access-policies:`hooks/use-access-policies.ts:79-121` `save` 无 toast
- backups:`hooks/use-backups.ts:60-73` `createPlan` 无 toast
- sites:`components/add-site-modal.tsx:69-95` `submit` 无 toast
- **(误报纠正)monitoring 有 toast**:`create-rule-modal.tsx:130`/`create-channel-modal.tsx:87`/`create-silence-modal.tsx:72` 都有——**monitoring 是正面样板,照抄**

### 影响
用户不确定操作是否成功,误以为没点上。

### 修复方案
1. 在上述 6 处 mutation 成功分支加 `feedback.success(t('xxxCreated'))`。
2. 建立全局规则(可写进 AGENTS.md 或 code-structure-standards skill):**所有 create/update/delete 成功必须有 feedback.success**。
3. i18n 补对应 success 文案 key。

### 验收标准
- [ ] 6 处创建/保存操作都有 success toast
- [ ] 文案中英同步

---

# P2 — 月度(一致性、可读性、检索)

## A11 🟡 resource-requests 无分页(纯前端,后端不支持)

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:极小(~10 行) · **依赖**:无 · **核实**:request-table.tsx 加 getPaginationRowModel + pageSize=10 + footer

### 现状
表格只有 core/sorted model,无 pagination。

### 证据
- 前端:`apps/devpilot-web/src/app/(dashboard)/resource-requests/components/request-table.tsx:11-18,130-137`(只有 core/sorted)
- **后端不支持分页**(已核实):`resource-request/dto/resource-request.dto.ts:181-201` `ListResourceRequestsQueryDto` 无 page/pageSize/take/skip
- **复制模板**(已核实):`apps/devpilot-web/src/app/(dashboard)/audit-events/components/event-table.tsx`
  - `:11-18` import `getPaginationRowModel`
  - `:34-43` `useReactTable({ ..., initialState:{pagination:{pageSize:10}}, getCoreRowModel, getSortedRowModel, getPaginationRowModel })`
  - `:45-46` `const {pageSize,pageIndex}=table.getState().pagination`
  - `:88-128` footer(page-size select + prev/next + 页码)

### 影响
数据量增长即不可用。

### 修复方案(纯前端,照抄 audit-events)
1. `request-table.tsx:11-18` import 加 `getPaginationRowModel`
2. `useReactTable` 配置加 `initialState:{pagination:{pageSize:10}}` 和 `getPaginationRowModel`
3. 表格底部加 footer(复制 `event-table.tsx:88-128` 的结构,改文案命名空间为 `resourceRequests`)
4. 后端无需改动(首版客户端分页足够;若日后数据量超大,再按卡内证据给后端 DTO 加 page/pageSize + service 改 take/skip + 返回 {items,total})

### 验收标准
- [ ] 表格底部有分页控件
- [ ] pageSize 可切 10/20/50
- [ ] 翻页正常

---

## A8 🟡 「只能建不能管」普遍(分批)

**状态**:✅ 已修(A8.1/A8.2/A8.3) · **优先级**:P2 · **工作量**:中-大 · **依赖**:无 · **核实**:monitoring.controller @Delete alert-rules;log-center.controller @Delete streams;server-edit-form 含 host/port/credentials;A8.4 环境写操作另有 create/copy/bind/sync 组件

### 现状
告警规则 API 层无 DELETE(规则一旦创建永远无法收敛);日志流 API 无 DELETE;服务器连接信息(host/port/key)创建后不可编辑;环境写操作 11 端点(controller 存在)前端未接线。

### 证据
- 告警规则:`monitoring` 模块无 DELETE 路由
- 日志流:`log-center` 无 DELETE
- 服务器:`servers/[id]` host/port 不可编辑
- 环境:`project-environment` controller 有 11 个写端点,前端环境抽屉未接

### 修复方案(拆 4 个子任务)
- **A8.1 告警规则删除**:后端 `monitoring.controller.ts` 加 `@Delete(':id')`;前端规则卡加删除按钮 + 确认
- **A8.2 日志流删除**:后端 `log-center.controller.ts` 加 `@Delete('streams/:id')`(或归档即删除语义);前端流侧栏加删除
- **A8.3 服务器连接编辑**:`servers/[id]` 详情页 host/port/user/key 改可编辑(需后端 PUT 支持这些字段——**goal 先确认 server.service update 允许哪些字段**)
- **A8.4 环境写操作**:环境抽屉补 create/copy/bind 入口(工作量大,建议单独立项)

### 验收标准
- [ ] 各子任务:建后能删/能改

---

## A17 🟡 术语黑话遍布 pageDescription

**状态**:🟡 部分已修 · **优先级**:P2 · **工作量**:中(文案) · **依赖**:无 · **核实**:pageDescription 主要术语已人话化(添加并管理/实时跟踪/正式执行);但资源域仍残留"纳管"等词(noManagedResourcesDescription/syncServerHint),需二次清扫

### 证据
7-22 IA 审计 §4.3/§4.7 有完整清单,如:
- `executionGovernance.pageDescription="队列、worker 与远端会话治理"`
- `resourceControl.pageDescription="资源实例与动作运行"`
- `servers.pageDescription="纳管执行目标服务器"`
- `accessPolicies.pageDescription="控制面读写权限"`
- `logs.pageDescription="日志归档、查询与流式 tail"`

### 修复方案
落地 IA 审计 §3.4 术语表(入队→提交、dry-run→试运行、live→正式执行、Provider→云服务商、纳管→添加到管理、tail→实时跟踪)。具体改写建议见 IA 审计 §4.7 Top 5。

### 验收标准
- [ ] pageDescription 无裸英文术语
- [ ] zh/en 同步

---

## A18 🟡 nav 标签与 pageTitle 不一致(7 处)

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:小 · **依赖**:无 · **核实**:nav 与 pageTitle 已对齐(参见 zh.json 改写)

### 证据
IA 审计 §4.2:备份↔备份计划、监控↔监控告警、日志↔日志中心、密钥↔密钥中心、CDN↔CDN 配置、CDN 配置↔CDN 配置管理、资源↔资源管理。

### 修复方案
统一 nav 标签 = pageTitle(选其中一边,建议统一到更完整的 pageTitle)。

### 验收标准
- [ ] 7 处 nav 与 pageTitle 一致

---

## A19 🟡 侧边栏"资源"5 入口无流程感

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:中 · **依赖**:无 · ⚠️ **影响肌肉记忆,建议结合埋点评估** · **核实**:nav-order-badge.tsx 实现序号;navigation-items 资源分区重排

### 现状
`resources`/`resource-control`/`resource-requests`/`resource-instances`/`keys` 5 个入口,用户不知从哪开始。

### 证据
`apps/devpilot-web/src/components/layout/navigation-items.ts:112-121`

### 修复方案
参照 IA 审计 §3.2:资源分区按"用户旅程"排序并加序号(1.申请 → 2.实例 → 3.操作 → 凭证 → 密钥)。

### 验收标准
- [ ] 资源分区项有序号或流程暗示
- [ ] 普通用户能理解从哪开始

---

## A13 🟡 history.back() 残留 + A20 链接可视性

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:小 · **依赖**:无 · **核实**:A13 history.back 改 router.push('/projects');A20 alert.tsx + nav-order-badge 实现,A13 我(本次复审)手动补了 project-detail-header 的遗漏

### 证据
- A13:`projects/[id]/components/project-detail-header.tsx:55`(仅此 1 处仍用 `window.history.back()`,其他详情页已改 `router.push`)
- A20:7-22 link-style-audit 发现 6 critical(导航链接零可视线索)+ 4 major(icon-only 缺 aria-label)

### 修复方案
- A13:改 `<Link href="/projects">` 或 `router.push('/projects')`
- A20:建立共享 link 工具类(`components/ui/link.tsx`);统一返回按钮为 `text-primary hover:underline` 或 icon+label;icon-only 控件补 aria-label(参照 link-style-audit 完整清单)

### 验收标准
- [ ] 无 `window.history.back()` 残留
- [ ] 返回按钮有可视线索
- [ ] icon-only 控件有 aria-label

---

## A2 🟠 resource-control 连接查询不回显

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:中 · **依赖**:A1(共用 reveal 模式) · **核实**:query-result-table.tsx 160 行,回显连接查询结果

### 现状
后端 `preview.rows`/`redaction` 已具备,前端连接查询面板不渲染连接串或查询结果。

### 修复方案
在 resource-control 连接查询面板回显脱敏后的连接串,reveal 看明文(复用 A1 的 reveal 模式)。

### 验收标准
- [ ] 连接查询有结果展示
- [ ] 敏感字段脱敏 + reveal

---

# 竞品基准揭示的盲点(新增项,非既有报告覆盖)

## N1 行级日志 permalink

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:中 · **核实**:logs-viewer/streams-sidebar/constants 已改

对标 Vercel `#L6`/`#L6-L9`。日志查看器每行加锚点,点击生成 permalink 可分享。URL 编码 stream/query/level/timeRange。

## N2 环境变量 .env 批量导入 + staged changes

**状态**:✅ 已修 · **优先级**:P1(竞品定义为"配置事故防护栏") · **工作量**:中 · **核实**:environment-env-import-modal(批量粘贴 .env)+ environment-env-review-modal(staged diff review)+ environment-staged-banner 三件套;env-var-diff.utils + env-file-parser.utils
- 批量粘贴 `.env`(Railway/Render/Coolify 标配)
- staged changes:改完不立即生效,先 review diff 再一次 Deploy(Railway 明确定义为减少运维事故最有效手段)

## N3 StatusTag 颜色语义全局统一

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:小 · **核实**:status-map.ts 110 行
绿=就绪/蓝=进行中/红=异常/灰=终止。消除 active/blocked/running 中英混杂。

## N4 指标图叠加部署事件虚线

**状态**:✅ 已修 · **优先级**:P2 · **工作量**:小 · **核实**:deployment-event-markers.tsx(与 A4 同批)
对标 Railway。A4 加分项,Devpilot deploymentRun 数据现成。

## N5 通知深链(告警通知直达日志)

**状态**:✅ 已修 · **优先级**:P3 · **工作量**:中 · **核实**:monitoring-notification-deep-link.utils.ts 91 行 + 配套 spec(68 测试通过)
对标 Coolify/Dokploy。

---

# P3 — 持续打磨(低优先)

- N6 自定义仪表盘 Widget 布局(对标 Grafana/Backstage)
- N7 部署记录增加 commit 信息 + 变更 diff(对标 Vercel)
- N8 操作历史持久化(不仅是 toast,对标 ArgoCD Event)
- N9 上下文帮助:各页面内嵌「了解更多」链接(对标 AWS Console)
- N10 DORA 看板(对标华为 CodeArts/云效)
- N11 全局 Cmd+K 命令面板(对标 Vercel/Backstage)
- N12 移动端独立适配(7-21 审计遗留)

---

# §九 文档索引(6 份分析 + 1 份调研)

| 文档 | 定位 |
|---|---|
| `docs/devpilot/ui-ux-audit-2026-07-21.md` | 基线审计(六批次已修) |
| `docs/todos/2026-07-22-devpilot-web-information-architecture-audit.md` | IA/可读性专项(逐页评分 + 术语表 + 重组方案) |
| `docs/todos/2026-07-22-devpilot-web-link-style-audit.md` | 链接样式专项 |
| `docs/devpilot/ui-ux-evaluation-2026-07-25.md` | QoderWork 竞品对标评估 |
| `docs/devpilot/devpilot-ux-evaluation-2026-07-25.md` | Kimi 浏览器实操评估(135 截图) |
| `evaluation/devpilot-ux-evaluation-2026-07-25.md` | WorkBuddy 安全视角评估 |
| `docs/devpilot/deployment-platform-ux-research-2026-07-25.md` | 竞品方法论调研(9 产品,带 URL) |

**误报纠正记录**(避免后续 agent 重复审计):
- C1「部署记录长得完全一样」:结构性无缺陷,是测试数据问题(Picshare 同一 blocked run)
- C2「audit-events 无分页」:已修复(`event-table.tsx:14,39,42`)
- C3「monitoring 无 toast」:误报,`create-rule-modal.tsx:130` 等都有
- C4「备份/策略弹窗缺取消」:N/A,那三个是内联表单非 Modal

**文档治理**:本文件是唯一事实源;6 份原始文档保留作审计证据,但每份开头建议加交叉引用「已整合至 ux-findings.md」;删除 `evaluation/` 下同名重复副本。

---

*本清单基于 6 份分析通读 + 两个 Explore agent 代码核实 + 竞品调研交叉印证。所有 file:line 是核实快照,goal 执行时应先 Read 确认未漂移。涉及运行时的结论(Kimi P0 中的 A22-A25:删团队致上下文失效、同步卡死、生成按钮零反馈)建议健康环境复测后再修。*
