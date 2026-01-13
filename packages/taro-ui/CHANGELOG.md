# @svton/taro-ui

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

### Patch Changes

- Updated dependencies
  - @svton/hooks@1.2.0

## 1.1.4

### Patch Changes

- 修复 NavBar 组件中 nav-left 和 nav-title 重叠的问题
  - 将 `.nav-left` 从绝对定位改为 flex 布局，使其自然占据空间
  - 移除 `.nav-title` 的固定 `padding-left`，改用 flex 自动分配空间
  - 添加 `min-width: 0` 确保文本溢出时能正确截断

## 1.1.3

### Patch Changes

- 修复 NavBar 组件中 nav-left 和 nav-title 重叠的问题
  - 将 `.nav-left` 从绝对定位改为 flex 布局，使其自然占据空间
  - 移除 `.nav-title` 的固定 `padding-left`，改用 flex 自动分配空间
  - 添加 `min-width: 0` 确保文本溢出时能正确截断

## 1.1.2

### Patch Changes

- fix: 修复类型声明文件缺失问题，同时生成 .d.ts 和 .d.mts 以支持不同 moduleResolution 配置

## 1.1.1

### Patch Changes

- fix: 修复构建后样式丢失问题，现在导入组件时会自动引入样式
  - 使用 esbuild-sass-plugin 编译 SCSS 为 CSS
  - 在输出文件中自动注入样式导入语句
  - 新增 `@svton/taro-ui/pure` 入口供需要自定义样式的用户使用
  - 新增 `@svton/taro-ui/style.css` 支持手动引入样式

## 1.1.0

### Minor Changes

- - @svton/hooks: 新增 useMount/useRequestState，并增强 usePagination（支持分页字段映射）。
  - @svton/taro-ui: 新增 LoadingState/EmptyState/RequestBoundary 组件与下拉刷新/触底加载相关 hooks。
  - @svton/ui: 新增通用 React 组件包，提供 LoadingState/EmptyState/RequestBoundary。

### Patch Changes

- Updated dependencies
  - @svton/hooks@1.1.0

## 1.0.1

### Patch Changes

- fix: publish types
- 补充请求模板
