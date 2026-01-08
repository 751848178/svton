# @svton/taro-ui

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
