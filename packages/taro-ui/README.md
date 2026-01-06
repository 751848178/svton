# @svton/taro-ui

Svton Taro UI Components Library - 小程序通用组件库

## 📦 安装

```bash
# 在 monorepo 中使用
pnpm add @svton/taro-ui@workspace:*

# 或从 npm 安装
pnpm add @svton/taro-ui
```

## 🚀 快速开始

### 方式一：自动引入样式（推荐）

直接导入组件即可，样式会自动引入：

```tsx
import { Button, TabBar, NavBar } from '@svton/taro-ui';

// 样式已自动引入，无需额外操作
<Button type="primary">按钮</Button>
```

### 方式二：手动引入样式

如果你的构建工具不支持 CSS 自动导入，可以在入口文件手动引入：

```tsx
// app.tsx 或入口文件
import '@svton/taro-ui/style.css';

// 然后正常使用组件
import { Button } from '@svton/taro-ui';
```

### 方式三：纯组件（自定义样式）

如果需要完全自定义样式，可以使用纯组件入口：

```tsx
// 导入不带样式的组件
import { Button } from '@svton/taro-ui/pure';

// 然后自己编写样式
```

## 🎨 主题定制

### 方式一：使用 SCSS 变量覆盖（推荐）

在你的项目中创建自定义主题文件：

```scss
// apps/mobile/src/styles/custom-theme.scss

// 1. 先定义你的自定义变量（会覆盖组件库的默认值）
$color-primary: #ff6b6b; // 自定义品牌色
$color-success: #51cf66; // 自定义成功色
$font-size-base: 28rpx; // 自定义基础字号
$btn-radius: 16rpx; // 自定义按钮圆角

// 2. 再导入组件库样式（!default 让自定义变量优先）
@import '@svton/taro-ui/src/styles/index.scss';
```

在你的组件中使用：

```tsx
// MyComponent/index.tsx
import './index.scss'

// MyComponent/index.scss
@import '../../styles/custom-theme.scss';  // 导入你的自定义主题

.my-component {
  // 使用主题变量
  color: $color-primary;
  padding: $spacing-md;
}
```

### 方式二：直接使用组件库主题

如果不需要自定义，直接导入组件库样式：

```scss
// 在组件样式文件中
@import '@svton/taro-ui/src/styles/index.scss';

.my-component {
  color: $color-primary; // 使用默认品牌色 #1890ff
  background: $color-bg-card; // 使用默认卡片背景
  padding: $spacing-md; // 使用默认中等间距
}
```

## 🎯 可自定义的主题变量

### 颜色系统

```scss
// 品牌色
$color-primary: #1890ff;
$color-primary-light: #40a9ff;
$color-primary-dark: #0077ff;

// 功能色
$color-success: #52c41a;
$color-warning: #ffa940;
$color-error: #ff4d4f;

// 文字色
$color-text-primary: #1a1a1a;
$color-text-regular: #333333;
$color-text-secondary: #666666;

// 背景色
$color-bg-page: #f7f8fa;
$color-bg-card: #ffffff;
```

### 字体系统

```scss
$font-size-h1: 36rpx;
$font-size-base: 26rpx;
$font-size-sm: 24rpx;

$font-weight-bold: 600;
$font-weight-medium: 500;
```

### 间距系统

```scss
$spacing-xs: 8rpx;
$spacing-sm: 16rpx;
$spacing-md: 24rpx;
$spacing-lg: 32rpx;
```

### 圆角系统

```scss
$radius-sm: 12rpx;
$radius-md: 24rpx;
$radius-lg: 32rpx;
```

### 组件尺寸

```scss
// 按钮
$btn-height-lg: 88rpx;
$btn-height-md: 80rpx;
$btn-radius: $radius-md; // 可单独设置按钮圆角

// 输入框
$input-height: 80rpx;
$input-radius: $radius-sm;

// 头像
$avatar-sm: 64rpx;
$avatar-md: 96rpx;
```

查看完整变量列表：[src/styles/variables.scss](./src/styles/variables.scss)

## 📚 组件使用

### 导航组件

```tsx
import { NavBar, StatusBar } from '@svton/taro-ui'

// 导航栏
<NavBar
  title="页面标题"
  showBack
  backgroundColor="#1890FF"
  rightContent={<View>操作</View>}
/>

// 状态栏占位
<StatusBar backgroundColor="#1890FF" />
```

### Tab 组件

```tsx
import { TabBar } from '@svton/taro-ui'

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'hot', label: '热门' }
]

<TabBar items={tabs} activeKey={activeTab} onChange={setActiveTab} />
```

### 按钮组件

```tsx
import { Button } from '@svton/taro-ui'

<Button type="primary" size="large">主要按钮</Button>
<Button type="default">默认按钮</Button>
<Button type="danger" disabled>危险按钮</Button>
```

### 图片组件

```tsx
import { ImageUploader, ImageGrid } from '@svton/taro-ui'

// 图片上传
<ImageUploader
  value={images}
  onChange={setImages}
  maxCount={9}
/>

// 图片展示
<ImageGrid images={images} />
```

### 列表组件

```tsx
import { List } from '@svton/taro-ui';

<List
  items={dataList}
  loading={loading}
  hasMore={hasMore}
  onLoadMore={loadMore}
  renderItem={(item) => <View>{item.title}</View>}
/>;
```

## 🛠️ 工具函数

```tsx
import { systemInfoManager } from '@svton/taro-ui';

// 获取系统信息
const info = systemInfoManager.getInfo();
console.log(info.statusBarHeight); // 状态栏高度
console.log(info.navBarHeight); // 导航栏总高度
console.log(info.menuButton); // 胶囊按钮位置
```

## 🎨 SCSS Mixins

组件库提供了丰富的 SCSS 混入：

```scss
@import '@svton/taro-ui/src/styles/index.scss';

.my-component {
  // 布局
  @include flex-center; // Flex 居中
  @include flex-between; // Flex 两端对齐

  // 文本
  @include text-ellipsis; // 单行省略
  @include text-ellipsis-multi(2); // 多行省略
  @include heading(1); // 标题样式

  // 交互
  @include active-state; // 点击态
  @include disabled-state; // 禁用态

  // 其他
  @include hide-scrollbar; // 隐藏滚动条
  @include circle(100rpx); // 圆形容器
}
```

查看完整 Mixin 列表：[src/styles/mixins.scss](./src/styles/mixins.scss)

## 🌈 主题示例

### 示例 1：红色主题

```scss
// red-theme.scss
$color-primary: #ff4d4f;
$color-primary-light: #ff7875;
$color-primary-dark: #cf1322;

@import '@svton/taro-ui/src/styles/index.scss';
```

### 示例 2：绿色主题

```scss
// green-theme.scss
$color-primary: #52c41a;
$color-primary-light: #73d13d;
$color-primary-dark: #389e0d;

@import '@svton/taro-ui/src/styles/index.scss';
```

### 示例 3：深色主题

```scss
// dark-theme.scss
$color-bg-page: #141414;
$color-bg-card: #1f1f1f;
$color-text-primary: #ffffff;
$color-text-regular: #e8e8e8;
$color-text-secondary: #a8a8a8;
$color-border: #434343;

@import '@svton/taro-ui/src/styles/index.scss';
```

## 📖 完整文档

- [组件库设计文档](../../docs/UI组件库设计文档.md)
- [组件库命名和迁移总结](../../docs/组件库命名和迁移总结.md)
- [Taro组件库最佳实践](../../docs/Taro组件库最佳实践.md)

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT
