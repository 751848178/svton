# @svton/api-client

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
