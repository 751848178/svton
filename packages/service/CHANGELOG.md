# @svton/service

## 0.4.0

### Minor Changes

- Initial release of @svton/service and @svton/logger packages.

  ### @svton/service
  - React service-based state management with decorators
  - Decorators: @Service(), @observable, @computed, @action, @Inject()
  - createService() for scoped instances
  - createServiceProvider() for shared instances (Provider pattern)
  - API: service.useState.xxx(), service.useDerived.xxx(), service.useAction.xxx()

  ### @svton/logger
  - Frontend logging and error tracking with plugin support
  - Log levels: debug, info, warn, error
  - Stack trace support (configurable via stackLevel)
  - Batch/immediate report strategies
  - Dynamic config modification
  - Global error and unhandled rejection capture
  - Performance monitoring (Web Vitals)
  - Built-in plugins: sensitive-filter, breadcrumb

## 0.3.0

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

## 0.2.0

### Minor Changes

- Initial release of @svton/service and @svton/logger packages
