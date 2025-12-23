# @svton/ui 组织级UI组件库

## 📋 概述

`@svton/ui` 是为 Svton 项目打造的组织级UI组件库，专注于 Taro 小程序开发，提供一套完整、易用、可扩展的基础组件。

## 🎯 设计目标

1. **统一体验** - 所有组件遵循统一的设计规范
2. **易于使用** - 简洁的API设计，开箱即用
3. **类型安全** - 完整的 TypeScript 类型支持
4. **高度可定制** - 灵活的配置选项和样式覆盖
5. **多端兼容** - 支持微信、支付宝、字节等多端小程序

## 📦 包结构

```
packages/ui/
├── package.json          # 包配置
├── tsconfig.json         # TypeScript配置
├── src/
│   ├── index.ts          # 入口文件，导出所有组件
│   └── components/
│       ├── TabBar/       # Tab切换组件
│       ├── Button/       # 按钮组件
│       └── List/         # 列表组件
└── dist/                 # 编译输出（自动生成）
```

## 🧩 核心组件

### 1. TabBar - Tab切换组件

**功能特性：**

- ✅ 动态Tab项配置
- ✅ 自动计算下划线位置
- ✅ 支持受控/非受控模式
- ✅ 自定义样式
- ✅ 平滑切换动画

**API：**

```typescript
interface TabBarItem<T = string> {
  key: T; // Tab的唯一标识
  label: string; // 显示文本
  render?: () => ReactNode; // 自定义渲染
  disabled?: boolean; // 是否禁用
}

interface TabBarProps<T = string> {
  items: TabBarItem<T>[]; // Tab项列表
  activeKey?: T; // 当前激活的Tab（受控）
  defaultActiveKey?: T; // 默认激活的Tab（非受控）
  onChange?: (key: T) => void; // Tab切换回调
  className?: string; // 自定义类名
  style?: CSSProperties; // 自定义样式
  indicatorWidth?: number; // 下划线宽度，默认48
  showIndicator?: boolean; // 是否显示下划线，默认true
  sticky?: boolean; // 是否粘性定位，默认true
}
```

**使用示例：**

```tsx
import { TabBar, TabBarItem } from '@svton/ui'

// 定义Tab项
const tabs: TabBarItem<'recommend' | 'latest'>[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'latest', label: '最新' },
]

// 受控模式
const [activeTab, setActiveTab] = useState('recommend')

<TabBar
  items={tabs}
  activeKey={activeTab}
  onChange={setActiveTab}
/>

// 非受控模式
<TabBar
  items={tabs}
  defaultActiveKey="recommend"
  onChange={(key) => console.log('切换到', key)}
/>
```

**下划线位置计算：**

TabBar 会自动根据 Tab 数量计算下划线位置：

```
2个Tab: 25% (1/4), 75% (3/4)
3个Tab: 16.67% (1/6), 50% (3/6), 83.33% (5/6)
4个Tab: 12.5% (1/8), 37.5% (3/8), 62.5% (5/8), 87.5% (7/8)
```

公式：`(index + 0.5) * (100 / totalCount) %`

---

### 2. Button - 按钮组件

**功能特性：**

- ✅ 多种类型（primary、default、danger、text）
- ✅ 多种尺寸（large、medium、small）
- ✅ 加载状态
- ✅ 禁用状态
- ✅ 块级按钮
- ✅ 自定义样式

**API：**

```typescript
type ButtonType = 'primary' | 'default' | 'danger' | 'text';
type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps {
  type?: ButtonType; // 按钮类型
  size?: ButtonSize; // 按钮尺寸
  loading?: boolean; // 是否加载中
  disabled?: boolean; // 是否禁用
  block?: boolean; // 是否为块级按钮
  children?: ReactNode; // 按钮文本
  className?: string; // 自定义类名
  style?: CSSProperties; // 自定义样式
  onClick?: () => void; // 点击事件
}
```

**使用示例：**

```tsx
import { Button } from '@svton/ui'

// 基础用法
<Button type="primary" onClick={handleClick}>
  确定
</Button>

// 加载状态
<Button type="primary" loading>
  提交中...
</Button>

// 禁用状态
<Button disabled>
  已禁用
</Button>

// 块级按钮
<Button type="primary" block>
  占满整行
</Button>

// 危险按钮
<Button type="danger">
  删除
</Button>

// 文本按钮
<Button type="text">
  取消
</Button>
```

**样式规范：**

| 类型    | 背景色      | 文字颜色 | 边框    |
| ------- | ----------- | -------- | ------- |
| primary | #1890FF     | #FFFFFF  | -       |
| default | #FFFFFF     | #333333  | #D9D9D9 |
| danger  | #FF4D4F     | #FFFFFF  | -       |
| text    | transparent | #1890FF  | -       |

| 尺寸   | 高度 | 左右内边距 | 字号 |
| ------ | ---- | ---------- | ---- |
| large  | 48px | 24px       | 16px |
| medium | 40px | 20px       | 14px |
| small  | 32px | 16px       | 12px |

---

### 3. List - 列表组件

**功能特性：**

- ✅ 下拉刷新
- ✅ 上拉加载更多
- ✅ 空状态展示
- ✅ 加载状态
- ✅ 自定义渲染
- ✅ 头部/底部内容

**API：**

```typescript
interface ListProps<T = any> {
  data: T[]; // 列表数据
  renderItem: (item: T, index: number) => ReactNode; // 渲染列表项
  keyExtractor?: (item: T, index: number) => string | number; // 唯一键
  loading?: boolean; // 是否正在加载
  hasMore?: boolean; // 是否还有更多数据
  onRefresh?: () => Promise<void>; // 下拉刷新回调
  onLoadMore?: () => Promise<void>; // 上拉加载回调
  renderEmpty?: () => ReactNode; // 空状态渲染
  emptyText?: string; // 空状态文本
  loadingText?: string; // 加载提示文本
  noMoreText?: string; // 没有更多提示文本
  className?: string; // 自定义类名
  style?: CSSProperties; // 自定义样式
  enableRefresh?: boolean; // 是否启用下拉刷新
  enableLoadMore?: boolean; // 是否启用上拉加载
  header?: ReactNode; // 头部内容
  footer?: ReactNode; // 底部内容
}
```

**使用示例：**

```tsx
import { List } from '@svton/ui'

// 基础用法
<List
  data={contents}
  renderItem={(item) => (
    <View className="content-card">
      <Text>{item.title}</Text>
    </View>
  )}
  keyExtractor={(item) => String(item.id)}
  loading={loading}
  hasMore={hasMore}
  onRefresh={handleRefresh}
  onLoadMore={handleLoadMore}
/>

// 自定义空状态
<List
  data={[]}
  renderItem={(item) => <View>{item}</View>}
  renderEmpty={() => (
    <View className="custom-empty">
      <Image src="empty.png" />
      <Text>暂无数据</Text>
    </View>
  )}
/>

// 添加头部
<List
  data={contents}
  renderItem={(item) => <ContentCard data={item} />}
  header={
    <View className="list-header">
      <Text>最新内容</Text>
    </View>
  }
/>
```

---

## 🎨 样式定制

### 全局样式变量

所有组件都支持通过 className 和 style 属性自定义样式：

```tsx
// 自定义类名
<TabBar className="my-custom-tab-bar" />

// 内联样式
<Button style={{ marginTop: '20px' }} />
```

### SCSS 变量覆盖

如果需要全局调整组件样式，可以在项目中覆盖 SCSS 变量：

```scss
// 在项目的全局样式文件中
.svton-tab-bar {
  &__text {
    font-size: 18px; // 覆盖默认16px
  }

  &__indicator {
    background: #ff6b6b; // 覆盖默认蓝色
  }
}
```

---

## 📦 安装与使用

### 安装

在 `package.json` 中添加依赖：

```json
{
  "dependencies": {
    "@svton/ui": "workspace:*"
  }
}
```

然后运行：

```bash
pnpm install
```

### 导入

```typescript
// 导入单个组件
import { TabBar } from '@svton/ui';
import { Button } from '@svton/ui';
import { List } from '@svton/ui';

// 导入类型
import type { TabBarProps, TabBarItem } from '@svton/ui';
import type { ButtonProps, ButtonType } from '@svton/ui';
import type { ListProps } from '@svton/ui';
```

### 样式导入

组件样式已经通过 `@import './index.scss'` 内置，无需额外导入。

---

## 🔧 开发与构建

### 开发

```bash
cd packages/ui
pnpm install
pnpm watch  # 监听文件变化，自动编译
```

### 构建

```bash
cd packages/ui
pnpm build  # 编译 TypeScript
```

### 发布

```bash
cd packages/ui
pnpm publish  # 发布到 npm（如需）
```

---

## 📝 最佳实践

### 1. 使用受控模式

推荐使用受控模式，便于状态管理：

```tsx
// ✅ 推荐
const [activeTab, setActiveTab] = useState('recommend')

<TabBar
  items={tabs}
  activeKey={activeTab}
  onChange={setActiveTab}
/>

// ❌ 不推荐
<TabBar
  items={tabs}
  defaultActiveKey="recommend"
/>
```

### 2. 提取配置

将组件配置提取为常量，便于维护：

```tsx
// ✅ 推荐
const TAB_ITEMS = [
  { key: 'recommend', label: '推荐' },
  { key: 'latest', label: '最新' },
]

<TabBar items={TAB_ITEMS} />

// ❌ 不推荐
<TabBar
  items={[
    { key: 'recommend', label: '推荐' },
    { key: 'latest', label: '最新' },
  ]}
/>
```

### 3. 类型安全

充分利用 TypeScript 类型：

```tsx
// ✅ 类型安全
type TabKey = 'recommend' | 'latest'

const tabs: TabBarItem<TabKey>[] = [...]
const [activeTab, setActiveTab] = useState<TabKey>('recommend')

// 自动类型检查
<TabBar
  items={tabs}
  activeKey={activeTab}  // ✅ 类型正确
  onChange={setActiveTab}
/>
```

---

## 🚀 后续规划

### 短期计划

- [ ] **List 组件增强**
  - 多选功能
  - 左滑操作
  - 拖拽排序
  - 虚拟滚动（长列表优化）

- [ ] **新增组件**
  - Input - 输入框组件
  - Modal - 弹窗组件
  - Toast - 提示组件
  - Form - 表单组件

### 长期计划

- [ ] **主题系统** - 支持暗色模式、自定义主题
- [ ] **国际化** - 多语言支持
- [ ] **可访问性** - ARIA 标签、键盘导航
- [ ] **文档站点** - 在线组件预览和文档
- [ ] **单元测试** - 完整的测试覆盖

---

## 📚 参考资料

- [Taro 官方文档](https://taro-docs.jd.com/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)

---

**创建时间：** 2025-11-23  
**维护者：** Svton Team  
**版本：** 1.0.0
