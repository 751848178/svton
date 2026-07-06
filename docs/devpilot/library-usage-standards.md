# Devpilot 编码规范：优先使用三方库与现有基础设施

> 面向 devpilot 应用（`apps/devpilot-api`、`apps/devpilot-web`）开发者。
> 本规范约束"何时该用成熟库/现有基础设施，而非手写"。

---

## 一、原则

新增功能或修复时，遵循以下顺序：

1. **先查现有基础设施**——本文件第二部分列出了 devpilot 已建立的 22 项共享模块。
   遇到加密、配置、调度、重试、锁、队列、SSH、SSE、Git、nginx、CDN、Docker、状态机、
   日期、i18n、表单、表格等场景，**先用这里列出的模块**，不要重新手写。
2. **再查成熟三方库**——现有基础设施不覆盖时，优先选成熟、维护活跃的库（npm 周下载量、
   最近提交、star 数）。常见场景的推荐库见第三部分。
3. **最后才考虑手写**——只有当：(a) 现有基础设施不覆盖、(b) 无成熟库、或 (c) 库的抽象层级
   不匹配（见第四部分决策记录）时，才手写。手写时须在代码注释或 PR 说明里写明**为何不用库**。

### 核心判据：是否在"消除手搓"

"优先用库"针对的是**协议格式、算法、与外部系统交互**这类手写易错、有标准实现的部分：

- ✅ 该用库：SSE 帧格式、AES-GCM 加密、cron 调度、YAML 解析、nginx 模板、厂商 API SDK、
  日期格式化、表单状态管理、数据表格、i18n、glob 匹配。
- ❌ 不该机械替换：**承载业务语义**的定制逻辑（如 DB lease 的审计持久化、SSE 的会话治理、
  远端 CLI 执行模型）。这些不是"手搓"，是"功能模型"——库不提供这些语义时，替换会丢功能。

> 关键区分：**"有成熟库"不等于"必须替换现有实现"**。当现有实现承载了库不提供的语义时，
> 强行替换会引入回归或功能丢失。判断不清时，按第四部分的历史决策记录类比。

---

## 二、现有基础设施索引（必须先查这里）

路径相对 `apps/devpilot-api/src/`（除特别注明）。新增同类功能时，**扩展这些模块**，不要另起炉灶。

### API 端 — `common/` 共享层

| 场景 | 模块 / 入口 | 说明 |
|------|-------------|------|
| 对称加密（凭据/密钥/webhook） | `common/crypto/crypto.service.ts` | AES-256-GCM + CBC 双模式，每条随机 salt；`encryptWebhook`/`decryptWebhook` 保留历史 wire 格式 |
| 加密常量/盐 | `common/crypto/crypto.constants.ts` | GCM/CBC 密钥派生函数、盐常量 |
| 环境变量校验 | `common/config/env.schema.ts` | zod schema，配合 `ConfigModule.forRoot({ validate })` |
| 定时调度器 | `common/scheduler/base-interval-scheduler.ts` | 继承获取 run-lock / release-run-lock，11 个调度器已迁入 |
| Provider 重试 | `common/retry/provider-retry.ts` | `executeProviderCall` / `withTimeout` / `isRetryableProviderError`，线性退避 |
| SSH 传输 | `common/ssh/ssh-transport.ts`（接口）<br>`common/ssh/ssh2-transport.ts`（ssh2 实现） | 替代 `spawn('ssh')` + 临时私钥落盘 |
| 分布式锁 | `common/lock/distributed-lock.ts`（接口）<br>`common/lock/redlock-distributed-lock.ts`（redlock+ioredis）<br>`common/lock/noop-distributed-lock.ts`（降级） | Redis 不可用时自动降级 Noop |
| SSE 帧格式 | `common/sse/sse-frame-writer.ts` + `SSE_HEADERS` | 取代手写 `id/event/data/retry` 行拼接 |
| SSE 会话生命周期 | `common/sse/sse-session-manager.ts` | header 设置/三级限流/cursor 轮询/超时清理/连接断开；controller 委托 `start()` |

### API 端 — 领域层

| 场景 | 模块 / 入口 | 说明 |
|------|-------------|------|
| 任务队列 | `server-executor/queue/job-queue.port.ts`（接口，7 原语）<br>`server-executor/queue/db-job-queue.ts`（Prisma 实现） | claim/extend/complete/recover + lease acquire/release/expire；未来换 BullMQ 只需实现端口 |
| 部署状态机 | `deployment/deployment-run-status.ts` | 命名常量 + 转换表 + `assertDeploymentRunTransition` 守卫 |
| 资源供给状态机 | `resource-request/resource-provisioning-run-status.ts` | 命名常量 + `assertProvisioningRunTransition` 守卫 |
| GitHub 集成 | `git/providers/github.provider.ts` | `@octokit/rest`，动态 `import()` 解决 ESM |
| GitLab 集成 | `git/providers/gitlab.provider.ts` | `@gitbeaker/rest` |
| nginx.conf 生成 | `proxy-config/proxy-config.service.ts` + `proxy-config/nginx.template.ts` | mustache 模板引擎 |
| CDN 缓存刷新 | `cdn-config/providers/`（4 家厂商实现 + factory） | 阿里云/腾讯云/Cloudflare/七牛官方 SDK |
| Docker 资产采集 | `resource-control/inventory/executors/` | `DockerInventoryExecutor` 接口 + CLI/dockerode 双路径 + factory 凭据驱动路由 |
| webhook 分支匹配 | `project-webhook/project-webhook.service.ts` | `micromatch`，保留 `'*'` 全匹配语义 |
| 口令复杂度 | `auth/dto/auth.dto.ts` | `@IsStrongPassword`（class-validator 内置） |

### Web 端 — `apps/devpilot-web/`

| 场景 | 模块 / 入口 | 说明 |
|------|-------------|------|
| 日期格式化 | `src/lib/format-date.ts` | `formatDateTime` / `formatDateTimeMinute` / `formatDate`，dayjs 底层 |
| 国际化 | `messages/zh.json` + `messages/en.json`<br>`next.config.js`（withNextIntl）<br>`src/app/layout.tsx`（Provider） | next-intl，28 命名空间 879 key；新 JSX 中文文本节点必须走 `useTranslations` |
| SSE 客户端 | `src/app/(dashboard)/logs/hooks/use-logs-tail-stream-effects.ts` | `@microsoft/fetch-event-source` |
| 表单状态 | `react-hook-form`（`useForm`+`register`+`handleSubmit`） | 15 个表单已迁入；动态 key 字段保留受控 map |
| 数据表格 | `@tanstack/react-table` | 4 个表格已迁入（audit-events/resource-requests/proxy-configs/cdn-configs） |

---

## 三、推荐三方库（新场景选型参考）

遇到下表场景且现有基础设施不覆盖时，优先选这些库。新增依赖前在 PR 说明里写明理由。

| 场景 | 推荐库 | 备注 |
|------|--------|------|
| 加密 / KMS 信封 | 内部 `CryptoService`，长期走 Aliyun KMS / Vault SDK | 不要直接用 `crypto.scryptSync` |
| 配置校验 | `zod` | 已是项目标准 |
| 定时任务 | `@nestjs/schedule` + `BaseIntervalScheduler` | 不要裸 `setInterval` 写 service |
| 分布式锁 | `redlock` + `ioredis` | 已封装为 `DistributedLock` 端口 |
| 队列 | 实现 `JobQueuePort`（当前 `DbJobQueue`） | 大规模可换 BullMQ |
| SSH | `ssh2` | 不要 `spawn('ssh')` |
| GitHub | `@octokit/rest` | 不要裸 axios 调 REST |
| GitLab | `@gitbeaker/rest` | |
| 模板渲染（配置文件） | `mustache` | 代码生成仍可用模板字符串 |
| YAML 解析/序列化 | `js-yaml` | |
| glob / 分支匹配 | `micromatch` | 不要手写通配符 |
| CDN 厂商 API | 各厂商官方 SDK（阿里云/腾讯云/七牛/Cloudflare） | 不要裸 axios 手搓 |
| Docker API | `dockerode` | 凭据可用时优先于 CLI |
| 口令强度 | `class-validator` 的 `@IsStrongPassword` | |
| 日期 | `dayjs`（已封装 `format-date.ts`） | 不要 `new Date().toLocaleString(...)` 散布 |
| i18n（Next.js） | `next-intl` | 不要硬编码中文 JSX 文本 |
| SSE 服务端 | `SseFrameWriter` + `SseSessionManager`（`@Sse()` 不适用，见决策记录） | |
| SSE 客户端 | `@microsoft/fetch-event-source` | 不要手搓 `ReadableStream.getReader()` |
| 表单 | `react-hook-form` | |
| 数据表格 | `@tanstack/react-table` | |

---

## 四、决策记录（评估后不用库的场景）

这些场景经评估后**不**用三方库，理由记录在此，避免后人重复纠结。新增同类"看似该用库"的场景时，先对照这里的判据。

| 场景 | 不用的库 | 理由 |
|------|----------|------|
| slugify 字符串清洗 | `slugify` 包 | 各处是**定制清洗逻辑**（不同字符集/长度限制/保留字符），语义不同，机械替换有风险无收益 |
| SSE 服务端整体替换 | NestJS `@Sse()` 装饰器 | log-center 的 SSE 是**有状态流式查询**（自定义 response header 会话元数据 / cursor resume / 三级限流 / closing 事件）；`@Sse()` 只能返回 `Observable<MessageEvent>`，无法设置自定义 header 或做会话治理。**帧格式手搓已通过 `SseFrameWriter` 消除，会话生命周期已通过 `SseSessionManager` 消除** |
| 状态机 | `xstate` | 状态转换依赖**业务条件**（不是纯拓扑），typed map 转换表 + `assertTransition` 守卫已满足"拦截非法转换"诉求，引入 xstate 增加运行时开销无对应收益 |
| nginx 代码模板 | （生成代码时）mustache | generator 给新项目**生成代码**时用 JS 模板字符串——语言内置插值 + IDE 高亮 + 类型检查，更适合代码生成场景（nginx.conf 配置文件渲染仍用 mustache） |

---

## 五、Code Review 检查项

审查 PR 时，若发现以下信号，应要求作者改用现有基础设施或成熟库：

- [ ] 出现 `crypto.scryptSync` / 裸 AES——改用 `CryptoService`
- [ ] 出现裸 `setInterval` 写定时 service——继承 `BaseIntervalScheduler`
- [ ] 出现手写 `id: ...\nevent: ...\ndata: ...` SSE 帧——改用 `SseFrameWriter`
- [ ] 出现 `spawn('ssh'/'scp')` + 临时私钥落盘——改用 `SshTransport`
- [ ] 出现裸 axios 调 GitHub/GitLab/CDN 厂商 API——改用对应 SDK
- [ ] 出现 `new Date(x).toLocaleString('zh-CN', {...})`——改用 `formatDateTime`
- [ ] 出现硬编码中文 JSX 文本节点（`<div>提交</div>`）——改用 `useTranslations`
- [ ] 出现手写 `ReadableStream` SSE 客户端——改用 `fetchEventSource`
- [ ] 出现手写表单 `useState`（静态命名字段）——改用 `react-hook-form`
- [ ] 出现手写 `<table>` 排序——改用 `@tanstack/react-table`
- [ ] 新增状态字符串字面量比较——改用状态机常量 + `assertTransition`

---

## 参考

- 改造历史与逐项决策详情：[`docs-internal/devpilot/progress/PT-tech-debt-libraries.md`](../../docs-internal/devpilot/progress/PT-tech-debt-libraries.md)
- 框架层（`packages/`）编码规范：[`docs/framework/coding-standards.md`](../framework/coding-standards.md)
- 文件结构标准（200 行上限、按后缀分层）：`skills/code-structure-standards`
