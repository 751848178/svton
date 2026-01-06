# @svton/taro-ui

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
