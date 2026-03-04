# @svton/api-client

## 1.4.0

### Minor Changes

- feat: 实现静默中止机制、自动 loading 状态管理和 catchError 工具

  **@svton/api-client:**
  - 实现静默中止机制（Silent Abort Mechanism）
  - 添加 ApiAbortError 和 isAbortSignal
  - Generator 函数请求失败时静默停止，不抛出错误
  - 新增 catchError 工具函数，允许捕获错误而不中止执行
  - 使用标准 ES Module import 替代 require()

  **@svton/service:**
  - 实现 action 自动 loading 状态管理
  - 添加 withLoading() 方法：`const [action, loading] = service.useAction.xxx.withLoading()`
  - 自动管理 loading、防止重复执行、自动清理
  - 所有装饰器改为函数形式：@Service()、@observable()、@computed()、@action()、@Inject()
  - 移除 useApi 和 useApiOnMount hooks（项目应自行封装）
  - 集成静默中止机制
  - 添加 @svton/api-client 依赖

  **Breaking Changes:**
  - 所有装饰器必须使用函数形式调用：`@Service()` 而不是 `@Service`
  - 移除了 `useApi` 和 `useApiOnMount` hooks，请使用 Service 的 `withLoading()` 方法或自行封装
  - 禁止手动管理 loading 状态，应使用 `withLoading()` 自动管理

## 1.3.0

### Minor Changes

- feat: 添加统一响应适配器（Unified Response Adapter）

  新增 `@svton/api-client/adapters` 子包，提供统一响应格式的适配器：

  **核心功能**：
  - 自动提取 `response.data` 作为返回值
  - 检查 `response.code` 并在错误时抛出 `ApiError`
  - 支持多种 code 类型（数字、字符串）
  - 支持自定义错误处理回调
  - 保留 `traceId` 和 `timestamp` 用于调试

  **兼容框架**：
  - `@svton/nestjs-http` (code: 0)
  - Spring Boot (code: 200)
  - 自定义格式 (code: "SUCCESS" 等)

  使用方式：

  ```typescript
  import { createUnifiedResponseAdapter } from "@svton/api-client/adapters";

  const adapter = createUnifiedResponseAdapter(fetch, {
    successCode: 0,
    onError: (response) => {
      if (response.code === 401) {
        window.location.href = "/login";
      }
    },
  });
  ```

## 1.1.0

### Minor Changes

- feat: 发布所有包的新版本

  ### 前端包
  - `@svton/ui`: React UI 组件库更新
  - `@svton/taro-ui`: Taro 小程序 UI 组件库更新
  - `@svton/hooks`: React Hooks 工具库更新

  ### 工具包
  - `@svton/logger`: 日志工具库更新
  - `@svton/service`: 服务层工具库更新
  - `@svton/dynamic-config`: 动态配置库更新
  - `@svton/api-client`: API 客户端更新
  - `@svton/cli`: CLI 工具更新

  ### NestJS 模块
  - `@svton/nestjs-authz`: 授权模块更新
  - `@svton/nestjs-cache`: 缓存模块更新
  - `@svton/nestjs-config-schema`: 配置 Schema 模块更新
  - `@svton/nestjs-http`: HTTP 模块更新
  - `@svton/nestjs-logger`: 日志模块更新
  - `@svton/nestjs-oauth`: OAuth 模块更新
  - `@svton/nestjs-object-storage`: 对象存储模块更新
  - `@svton/nestjs-object-storage-qiniu-kodo`: 七牛云存储模块更新
  - `@svton/nestjs-payment`: 支付模块更新
  - `@svton/nestjs-queue`: 队列模块更新
  - `@svton/nestjs-rate-limit`: 限流模块更新
  - `@svton/nestjs-redis`: Redis 模块更新
  - `@svton/nestjs-sms`: 短信模块更新

## 1.0.1

### Patch Changes

- 补充请求模板
