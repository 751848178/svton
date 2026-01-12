# @svton/taro-ui

> Taro 小程序 UI 组件库 - 统一的移动端组件

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/taro-ui` |
| **版本** | `1.0.0` |
| **入口** | `src/index.ts` (源码直接引用) |

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/taro-ui
```

### 基础使用

```tsx
import { View } from '@tarojs/components';
import { NavBar, StatusBar, Button } from '@svton/taro-ui';

export default function MyPage() {
  return (
    <View className="page">
      <StatusBar />
      <NavBar title="页面标题" />
      <Button type="primary">主要按钮</Button>
    </View>
  );
}
```

---

## 🎯 设计原则

1. **统一样式** - 遵循设计稿 1.7 倍缩放规则
2. **高可复用** - 通用组件，业务无关
3. **类型安全** - 完整的 TypeScript 类型定义

---

## 📋 组件总览

### 基础组件
| 组件 | 说明 |
|------|------|
| `Button` | 按钮 |
| `Cell` / `CellGroup` | 单元格 |
| `Divider` | 分割线 |
| `Grid` / `GridItem` | 宫格 |
| `Card` | 卡片 |

### 表单组件
| 组件 | 说明 |
|------|------|
| `Input` / `Textarea` | 输入框 |
| `SearchBar` | 搜索栏 |
| `Switch` | 开关 |
| `Checkbox` / `CheckboxGroup` | 复选框 |
| `Radio` / `RadioGroup` | 单选框 |
| `Rate` | 评分 |
| `Stepper` | 步进器 |
| `Form` | 表单 |
| `ImageUploader` | 图片上传 |

### 展示组件
| 组件 | 说明 |
|------|------|
| `Tag` | 标签 |
| `Badge` | 徽标 |
| `Avatar` / `AvatarGroup` | 头像 |
| `Skeleton` / `SkeletonImage` | 骨架屏 |
| `Progress` | 进度条 |
| `Steps` | 步骤条 |
| `Collapse` / `CollapseItem` | 折叠面板 |
| `NoticeBar` | 通告栏 |
| `Countdown` | 倒计时 |
| `Result` | 结果页 |
| `ImageGrid` | 图片网格 |

### 反馈组件
| 组件 | 说明 |
|------|------|
| `Popup` | 弹出层 |
| `Modal` | 弹窗 |
| `ActionSheet` | 动作面板 |
| `Toast` | 轻提示 |
| `SwipeCell` | 滑动单元格 |
| `LoadingState` / `Loading` | 加载状态 |
| `EmptyState` / `Empty` | 空状态 |
| `RequestBoundary` | 请求边界 |

### 导航组件
| 组件 | 说明 |
|------|------|
| `NavBar` | 导航栏 |
| `StatusBar` | 状态栏 |
| `TabBar` | 底部导航 |
| `Tabs` | 标签页 |
| `BackTop` | 返回顶部 |
| `ContentActionBar` | 内容操作栏 |
| `List` | 列表 |

---

## 🔧 基础组件

### StatusBar + NavBar

**每个页面必须包含状态栏和导航栏**

```tsx
import { View } from '@tarojs/components';
import { NavBar, StatusBar } from '@svton/taro-ui';

export default function MyPage() {
  return (
    <View className="page">
      <StatusBar />
      <NavBar title="页面标题" />
      {/* 页面内容 */}
    </View>
  );
}
```

#### NavBar Props

```typescript
interface NavBarProps {
  title?: string;           // 标题
  back?: boolean;           // 是否显示返回按钮，默认 true
  onBack?: () => void;      // 返回按钮点击事件
  rightContent?: ReactNode; // 右侧内容
  transparent?: boolean;    // 是否透明背景
  fixed?: boolean;          // 是否固定定位
}
```

### Button

```tsx
import { Button } from '@svton/taro-ui';

// 基础用法
<Button type="primary" onClick={handleClick}>主要按钮</Button>
<Button type="secondary">次要按钮</Button>
<Button type="text">文本按钮</Button>

// 不同尺寸
<Button size="large">大按钮</Button>
<Button size="medium">中按钮</Button>
<Button size="small">小按钮</Button>

// 状态
<Button disabled>禁用按钮</Button>
<Button loading>加载中</Button>
<Button block>块级按钮</Button>
```

#### Button Props

```typescript
interface ButtonProps {
  type?: 'primary' | 'secondary' | 'text';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
```

### Cell 单元格

```tsx
import { Cell, CellGroup } from '@svton/taro-ui';

<CellGroup title="基础用法">
  <Cell title="标题" value="内容" />
  <Cell title="带描述" label="描述信息" value="内容" />
  <Cell title="带箭头" arrow onClick={() => {}} />
  <Cell title="必填项" required value="请选择" arrow />
</CellGroup>

<CellGroup title="带图标" inset>
  <Cell title="设置" icon={<Icon name="setting" />} arrow />
</CellGroup>
```

#### Cell Props

```typescript
interface CellProps {
  title?: ReactNode;      // 标题
  label?: ReactNode;      // 描述信息
  value?: ReactNode;      // 右侧内容
  icon?: ReactNode;       // 左侧图标
  arrow?: boolean;        // 是否显示箭头
  required?: boolean;     // 是否必填
  clickable?: boolean;    // 是否可点击
  disabled?: boolean;     // 是否禁用
  onClick?: () => void;
}

interface CellGroupProps {
  title?: string;         // 分组标题
  border?: boolean;       // 是否显示边框
  inset?: boolean;        // 是否为内嵌模式
}
```

### Divider 分割线

```tsx
import { Divider } from '@svton/taro-ui';

<Divider />
<Divider>文字</Divider>
<Divider contentPosition="left">左侧文字</Divider>
<Divider dashed>虚线</Divider>
<Divider direction="vertical" />
```

### Grid 宫格

```tsx
import { Grid, GridItem } from '@svton/taro-ui';

<Grid columnNum={4}>
  <GridItem icon="📷" text="拍照" />
  <GridItem icon="📁" text="文件" />
  <GridItem icon="🎵" text="音乐" />
  <GridItem icon="📹" text="视频" />
</Grid>

// 自定义列数和边框
<Grid columnNum={3} border={false} square>
  <GridItem icon="🏠" text="首页" />
  <GridItem icon="🔍" text="搜索" />
  <GridItem icon="👤" text="我的" />
</Grid>
```

### Card 卡片

```tsx
import { Card } from '@svton/taro-ui';

<Card title="卡片标题" extra="更多">
  卡片内容
</Card>

<Card
  title="带封面"
  cover={<Image src="cover.jpg" />}
  footer={<Button size="small">操作</Button>}
>
  卡片内容
</Card>
```

---

## 📝 表单组件

### Input 输入框

```tsx
import { Input, Textarea } from '@svton/taro-ui';

// 基础输入框
<Input
  value={value}
  placeholder="请输入"
  onChange={setValue}
/>

// 带清除按钮
<Input value={value} clearable onChange={setValue} />

// 带字数统计
<Input value={value} maxLength={20} showCount onChange={setValue} />

// 密码输入
<Input type="text" password placeholder="请输入密码" />

// 前缀后缀
<Input prefix={<Text>¥</Text>} suffix={<Text>元</Text>} />

// 多行文本
<Textarea
  value={content}
  placeholder="请输入内容"
  maxLength={200}
  showCount
  autoHeight
  onChange={setContent}
/>
```

#### Input Props

```typescript
interface InputProps {
  value?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'idcard' | 'digit' | 'nickname';
  password?: boolean;
  variant?: 'outlined' | 'borderless' | 'filled';
  disabled?: boolean;
  readonly?: boolean;
  error?: boolean;
  maxLength?: number;
  clearable?: boolean;
  showCount?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onConfirm?: (value: string) => void;
}
```
