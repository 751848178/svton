# @svton/cli

## 1.2.0

### Minor Changes

- d9bee61: feat: 添加功能集成系统，支持按需选择功能模块
  - 新增功能配置系统 (features.json)
  - 支持 8 个功能模块的按需安装（缓存、队列、支付、短信、OAuth、存储、限流、权限）
  - 自动生成配置文件和示例代码
  - 自动生成 AI Skill 文档
  - 自动注入模块到 app.module.ts
  - 生成 .env.example 环境变量模板
  - 完整的示例代码（24 个文件）
  - 详细的 README 文档（9 个）
  - 修复配置文件类型转换问题
  - 改进错误处理和文件读取安全性

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
