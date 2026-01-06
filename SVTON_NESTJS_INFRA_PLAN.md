# Svton Backend 基础设施能力包规划与需求文档（v1）

## 1. 背景与目标

### 1.1 背景
当前 `templates/apps/backend` 是一个可运行的最小 NestJS 后端模板（Prisma/JWT/Auth/User/Swagger/Validation/CORS），但缺少：
- 基础设施层（Infra）：对象存储、短信、Redis 缓存/锁等能力未落地（env 有 Redis，但代码未使用）。
- 工程化与治理：统一异常/响应格式、日志与 trace、权限等横切能力缺口。

### 1.2 目标
- 将通用基础设施能力封装为 **npm 标准包**，供新项目按需安装使用。
- 采用 **抽象接口 + 多 Adapter** 的架构，支持多云/多运营商。
- **优先使用 NestJS 官方或成熟生态能力**，不做重复造轮子；仅对 NestJS 未提供的能力做封装。
- 与当前 `svton` monorepo 的 **turbo + changesets + tsup** 打包发布方式保持一致。

### 1.3 非目标
- 不在 v1 内实现所有云厂商与所有高级功能（如全量分片上传、复杂 policy、全链路可观测平台对接等）。
- 不将业务策略（例如具体目录规范、业务回调字段、业务错误码表）强塞进通用包。

---

## 2. 总体架构原则

### 2.1 分层
- **Core 包**：只定义领域接口、通用类型、NestJS Module/DynamicModule、注入 token、错误模型；不强依赖任何云厂商 SDK。
- **Adapter 子包**：实现某厂商 SDK 的接入，提供 `createAdapter()` 或 Adapter class 给 Core 包注册；仅引入对应 SDK 依赖。

### 2.2 NestJS 封装形态
- 统一提供：
  - `XxxModule.forRoot(options)`
  - `XxxModule.forRootAsync({ imports, inject, useFactory })`
- 统一通过 **Injection Token** 注入能力，避免业务直接依赖具体实现类。
- 横切能力（Filter/Interceptor/Guard）通过 `APP_FILTER` / `APP_INTERCEPTOR` / `APP_GUARD` 全局注册或导出可选装配。

### 2.3 “官方优先”策略
以下能力直接使用官方/成熟生态，不二开：
- `@nestjs/config`（配置加载）
- `@nestjs/swagger`（文档）
- `@nestjs/terminus`（健康检查）
- `@nestjs/throttler`（限流）
- Passport + `@nestjs/jwt`（认证）
- `class-validator` + `ValidationPipe`（验证）

Svton 的包聚焦：对象存储、短信、Redis 接入、配置 schema 校验、HTTP 响应/异常规范、日志/trace、权限（RBAC）等。

---

## 3. 包拆分与命名（最终确定）

> 组织名 scope：`@svton/*`
> 模式：**核心包 + adapter 子包**

### 3.1 对象存储（Object Storage）
- **核心包**
  - `@svton/nestjs-object-storage`
- **adapter 子包（示例）**
  - `@svton/nestjs-object-storage-aliyun-oss`
  - `@svton/nestjs-object-storage-tencent-cos`
  - `@svton/nestjs-object-storage-qiniu-kodo`
  - `@svton/nestjs-object-storage-s3`
  - （可选）`@svton/nestjs-object-storage-minio`（也可复用 s3 adapter）

> 说明：避免使用 `oss` 作为核心包名，因为它是阿里云品牌词；核心使用中性领域名 `object-storage`。

### 3.2 短信（SMS）
- 核心：`@svton/nestjs-sms`
- adapters：
  - `@svton/nestjs-sms-aliyun`
  - `@svton/nestjs-sms-tencent`
  - `@svton/nestjs-sms-huawei`

### 3.3 Redis
- `@svton/nestjs-redis`
  - v1：连接管理 + 注入 + 生命周期关闭钩子 + 薄 `CacheService`（可选启用）
  - 高阶（后续）：分布式锁、rate-limit storage、队列基础等

### 3.4 配置校验（不替代官方）
- `@svton/nestjs-config-schema`
  - 给 `@nestjs/config` 提供 `validate` 能力（zod/joi），实现 env 校验、类型收敛与默认值策略。

### 3.5 HTTP 规范化（响应 + 异常）
- `@svton/nestjs-http`
  - 全局异常格式化（包含 Prisma 常见错误映射）
  - 全局响应包装（统一 `{code,message,data,traceId}` 形态）

### 3.6 Logger / Trace
- `@svton/nestjs-logger`
  - 基于 `nestjs-pino`（或选定生态）给出统一默认配置
  - requestId/traceId（AsyncLocalStorage）贯穿

### 3.7 AuthZ（RBAC）
- `@svton/nestjs-authz`
  - `@Roles()` decorator + `RolesGuard`
  - 与模板现有 JWT payload 中 `role` 对接

---

## 4. 核心能力：对象存储（v1）详细需求

> v1 明确要求：**包含 `presignedUrl` + 回调验签**

### 4.1 Core 契约（业务只依赖 Core）

#### 注入 Token
- `OBJECT_STORAGE_CLIENT`
- `OBJECT_STORAGE_OPTIONS`

#### Module
- `ObjectStorageModule.forRoot(options)`
- `ObjectStorageModule.forRootAsync(asyncOptions)`

#### 核心接口：`ObjectStorageClient`（v1 必须实现）
- **对象上传**：`putObject(input)`（支持 buffer/stream）
- **对象删除**：`deleteObject({ bucket?, key })`
- **公开访问 URL**：`getPublicUrl({ bucket?, key }) => string`
- **预签名**：`presign(input)`（支持 `GET/PUT`，返回 `{ url, method, headers? }`，为 POST policy 预留扩展位）
- **回调验签**：`verifyCallback(input)`（输入 raw HTTP 信息，输出统一结构，至少包含 `isValid` 和 `key`）

#### 回调验签输入（统一协议，v1 必须）
- `method: string`
- `path: string`
- `query: Record<string, string | string[]>`
- `headers: Record<string, string | string[]>`
- `rawBody: Buffer`（必须）
- `ip?: string`（可选）

#### 回调验签输出（统一协议，v1 必须）
- `isValid: boolean`
- `provider: string`
- `bucket?: string`
- `key?: string`
- `etag?: string`
- `size?: number`
- `eventType?: string`
- `metadata?: Record<string, any>`
- `raw: any`

#### 错误模型（v1 建议具备）
- `ObjectStorageConfigError`
- `ObjectStorageSignatureError`
- `ObjectNotFoundError`
- `ObjectStorageProviderError`（透传 provider + 原始 error）

### 4.2 Core Options（建议）
- `defaultBucket?: string`
- `publicBaseUrl?: string`（CDN 域名等）
- `defaultExpiresInSeconds?: number`
- `adapter: ObjectStorageAdapter | ObjectStorageAdapterFactory`

### 4.3 Adapter 子包规范（必须遵循）
adapter 子包必须导出至少一种标准入口：
- `createXxxObjectStorageAdapter(options) => ObjectStorageAdapter`
  - `name: string`
  - `createClient(): Promise<ObjectStorageClient> | ObjectStorageClient`

并且 adapter 子包只依赖自身云厂商 SDK。

---

## 5. 其他包（v1 需求边界简述）

### 5.1 `@svton/nestjs-sms`（v1 建议范围）
- 核心接口 `SmsClient.send({ phone, templateId, params, signName? })`
- adapter 子包实现具体厂商
- 频控/验证码业务流程留在业务侧（可在后续做可选插件）

### 5.2 `@svton/nestjs-redis`（v1 范围）
- `RedisModule.forRoot/forRootAsync`
- 提供 `REDIS_CLIENT` token 注入 ioredis 实例
- 可选 `CacheService`：`get/set/del` + JSON 序列化 + ttl（保持很薄）

### 5.3 `@svton/nestjs-config-schema`（v1 范围）
- 提供 `createZodValidate()` 或 `createJoiValidate()` 输出给 `ConfigModule.forRoot({ validate })`
- 不替代 `@nestjs/config`

### 5.4 `@svton/nestjs-http`（v1 范围）
- `APP_FILTER`：统一异常结构；支持 Prisma 常见错误映射
- `APP_INTERCEPTOR`：统一成功响应结构

### 5.5 `@svton/nestjs-logger`（v1 范围）
- 基于 `nestjs-pino` 做默认 logger module + requestId/traceId
- 输出标准 log 字段（app/env/requestId/userId/latency 等）

### 5.6 `@svton/nestjs-authz`（v1 范围）
- `@Roles(...roles)` decorator
- `RolesGuard` 从 `req.user.role` 读取并校验

---

## 6. 模板项目（templates/apps/backend）接入要求

### 6.1 依赖方式
模板 `package.json.tpl` 改为依赖 npm 版本（而不是 `workspace:*`），例如：
- `@svton/nestjs-object-storage`
- `@svton/nestjs-object-storage-qiniu-kodo`（按需）
- `@svton/nestjs-redis`（按需）

### 6.2 必要接入点：Raw Body（回调验签必须）
对象存储回调验签依赖原始请求体（raw bytes）。模板需要提供标准接入方式：
- 在回调路由上拿到 `rawBody: Buffer`
- 确保不会被 JSON parser 改写

**决策（v1 采用）：**
- 使用 Express 平台时，在回调路由前为特定路径挂载 raw body 中间件（仅针对回调路由启用，避免影响全局 JSON 解析）。
- `verifyCallback()` 的输入统一接收 `rawBody`。

> 具体实现会在模板示例中给出（例如为 `/object-storage/callback` 路由挂 `express.raw({ type: '*/*' })` 或使用自定义中间件收集 rawBody）。

### 6.3 示例模块/控制器
模板提供示例：
- `ObjectStorageCallbackController`：接收回调 -> 调 `verifyCallback` -> 业务处理
- `UploadController`（可选）：生成 presignedUrl 给前端上传

---

## 7. 发布与工程化规范（svton monorepo）

### 7.1 构建方式
对齐现有包：
- 使用 `tsup` 输出：
  - `dist/index.js`
  - `dist/index.mjs`
  - `dist/index.d.ts`
- `package.json` 统一：
  - `main/module/types/files/exports/scripts/prepublishOnly/publishConfig.access=public`

### 7.2 版本与发布
- 使用 `changesets`：
  - 新增包/重要变更：`minor`
  - 修复：`patch`
- 根命令：
  - `pnpm changeset:version`
  - `pnpm pub`

### 7.3 peerDependencies
Nest 相关依赖建议放 `peerDependencies`：
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/config`（如需要）
adapter 子包的云 SDK 放 `dependencies`。

---

## 8. 里程碑（Milestones）与验收标准

### M1：对象存储核心包 + 1 个 adapter 样板
- **产出**
  - `@svton/nestjs-object-storage`
  - `@svton/nestjs-object-storage-qiniu-kodo`（或你指定的第一个）
- **验收**
  - 能在 Nest 项目中 `forRootAsync` 注册并注入 `OBJECT_STORAGE_CLIENT`
  - `presign(GET/PUT)` 可用
  - 回调验签 `verifyCallback()` 可用（基于真实回调请求样例验证）
  - changeset 可发布

### M2：模板接入示例
- **产出**
  - `templates/apps/backend` 增加示例接入（依赖、AppModule 注册、callback controller）
- **验收**
  - 本地启动模板后可通过 mock/真实回调完成验签流程
  - 文档说明清晰

### M3：补齐更多 adapter（COS / S3 / OSS）
- **验收**
  - 每个 adapter 包至少通过基础用例：`presign` + `verifyCallback`（如该厂商回调形态不同则给出替代方案与文档）

---

## 9. 开放问题（已按决策落地）

### 9.1 回调形态
**决策（v1）：**优先支持“厂商直接 HTTP 回调到业务服务”。
- OSS/Qiniu 等天然支持回调 URL，适合 v1。
- COS/S3 若回调形态不一致，则 adapter 侧给出可行方案：
  - 若厂商支持 HTTP 回调：实现 `verifyCallback()`
  - 若更推荐事件流：在文档中明确 v1 支持边界，并提供后续 `@svton/nestjs-queue`/事件消费的规划。

### 9.2 rawBody 获取
**决策（v1）：**仅对回调路径启用 raw body 采集，避免影响全局 JSON。
- 模板会提供最小示例（Express raw 中间件或自定义中间件）。

### 9.3 S3 事件策略
**决策（v1）：**S3 优先走事件（SNS/SQS/EventBridge）方案；若用户坚持 HTTP webhook，需用户提供约束（例如 API Gateway 自带验签/secret）。
- v1 adapter 可先提供 presign 能力，事件消费能力后置到 `queue/audit` 体系。

### 9.4 KeyBuilder
**决策（v1）：**不在 `@svton/nestjs-object-storage` 内内置业务 Key 生成策略。
- 如需统一 key 规范，后续以独立小包或模板业务层实现（避免把业务策略固化进 infra 包）。

### 9.5 多 bucket
**决策（v1）：**支持 `defaultBucket`，并允许每次调用时覆盖 `bucket`。

