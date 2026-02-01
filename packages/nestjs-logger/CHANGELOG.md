# @svton/nestjs-logger

## 1.3.0

### Features

- ✨ 新增阿里云 SLS (Simple Log Service) 支持
- ✨ 新增腾讯云 CLS (Cloud Log Service) 支持
- ✨ 支持同时输出到多个目标（控制台 + 云服务）
- ✨ 批量发送优化（100条/批次，3秒间隔）
- 📝 完善文档和使用示例

### Changes

- 🔧 使用 pino multistream 支持多目标输出
- 🔧 新增 `cloudLogger` 配置选项
- 🔧 新增 `AliyunSlsTransport` 和 `TencentClsTransport`
- 🔧 导出云日志服务相关类型定义

## 1.2.0

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

## 1.1.0

### Minor Changes

- feat: 新增 NestJS 基础设施能力包

  新增以下 @svton 系列 NestJS 模块：
  - @svton/nestjs-object-storage: 对象存储核心模块，支持多云厂商适配器架构，提供 presignedUrl 和回调验签能力
  - @svton/nestjs-object-storage-qiniu-kodo: 七牛云 Kodo 对象存储适配器
  - @svton/nestjs-http: HTTP 规范化模块，统一响应/异常格式，支持 Prisma 错误映射
  - @svton/nestjs-redis: Redis 连接管理模块，提供 CacheService 缓存服务
  - @svton/nestjs-config-schema: 配置校验模块，为 @nestjs/config 提供 Zod schema 验证
  - @svton/nestjs-logger: 日志模块，基于 nestjs-pino，支持 requestId/traceId 追踪
  - @svton/nestjs-authz: RBAC 权限模块，提供 @Roles 装饰器和 RolesGuard
  - @svton/nestjs-sms: 短信核心模块，支持多厂商适配器架构

  所有模块均支持 forRoot/forRootAsync 配置方式，与 NestJS 生态无缝集成。

## 1.0.0

### Major Changes

- feat: 新增 NestJS 基础设施能力包
