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

## 🎯 设计原则

1. **统一样式** - 遵循设计稿 1.7 倍缩放规则
2. **高可复用** - 通用组件，业务无关
3. **类型安全** - 完整的 TypeScript 类型定义

---

## 📋 可用组件

| 组件 | 用途 |
|------|------|
| `NavBar` | 导航栏 |
| `StatusBar` | 状态栏占位 |
| `Button` | 按钮 |
| `List` | 列表 |
| `Tabs` | 标签页 |
| `TabBar` | 底部导航 |
| `ImageUploader` | 图片上传 |
| `ImageGrid` | 图片网格 |
| `Form` | 表单组件 |
| `ContentActionBar` | 内容操作栏 |

---

## 🔧 基础组件使用

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

### NavBar Props

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

### 自定义导航栏

```tsx
<NavBar
  title="详情"
  rightContent={
    <View onClick={handleShare}>
      <Text>分享</Text>
    </View>
  }
/>
```

---

### Button

```tsx
import { Button } from '@svton/taro-ui';

// 基础用法
<Button type="primary" onClick={handleClick}>
  主要按钮
</Button>

// 不同类型
<Button type="primary">主要按钮</Button>
<Button type="secondary">次要按钮</Button>
<Button type="text">文本按钮</Button>

// 不同尺寸
<Button size="large">大按钮</Button>
<Button size="medium">中按钮</Button>
<Button size="small">小按钮</Button>

// 禁用状态
<Button disabled>禁用按钮</Button>

// 加载状态
<Button loading>加载中</Button>

// 块级按钮
<Button block>块级按钮</Button>
```

### Button Props

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

---

### List

```tsx
import { List } from '@svton/taro-ui';

<List>
  <List.Item
    title="标题"
    description="描述文字"
    arrow
    onClick={() => handleClick()}
  />
  <List.Item
    title="带图标"
    icon={<Icon name="setting" />}
    arrow
  />
  <List.Item
    title="带右侧内容"
    extra={<Text>更多</Text>}
  />
</List>
```

### List.Item Props

```typescript
interface ListItemProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  extra?: ReactNode;
  arrow?: boolean;
  onClick?: () => void;
}
```

---

### Tabs

```tsx
import { useState } from 'react';
import { Tabs } from '@svton/taro-ui';

function MyComponent() {
  const [activeIndex, setActiveIndex] = useState(0);

  const tabs = [
    { title: '全部' },
    { title: '活动' },
    { title: '公告' },
  ];

  return (
    <Tabs
      tabs={tabs}
      activeIndex={activeIndex}
      onChange={setActiveIndex}
    />
  );
}
```

---

### ImageUploader

```tsx
import { useState } from 'react';
import { ImageUploader } from '@svton/taro-ui';

function PublishPage() {
  const [images, setImages] = useState<string[]>([]);

  return (
    <ImageUploader
      value={images}
      onChange={setImages}
      maxCount={9}
      onUpload={async (file) => {
        // 上传到服务器，返回 URL
        const url = await uploadFile(file);
        return url;
      }}
    />
  );
}
```

### ImageUploader Props

```typescript
interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
  onUpload?: (file: File) => Promise<string>;
  disabled?: boolean;
}
```

---

### ImageGrid

**展示图片列表**

```tsx
import { ImageGrid } from '@svton/taro-ui';

<ImageGrid
  images={['url1', 'url2', 'url3']}
  onPreview={(index) => {
    // 预览图片
  }}
/>
```

---

### TabBar

**底部导航栏**

```tsx
import { TabBar } from '@svton/taro-ui';

const tabs = [
  { title: '首页', icon: 'home', selectedIcon: 'home-filled' },
  { title: '发现', icon: 'discover', selectedIcon: 'discover-filled' },
  { title: '我的', icon: 'user', selectedIcon: 'user-filled' },
];

<TabBar
  tabs={tabs}
  activeIndex={currentTab}
  onChange={(index) => setCurrentTab(index)}
/>
```

---

## 🎨 样式规范

### 1.7 倍缩放规则

所有组件遵循设计稿 1.7 倍缩放：

```scss
// 导入缩放工具
@import '../../styles/design-scale.scss';

.button {
  // 使用预定义变量
  font-size: $font-size-base;      // scale(16px) = 27.2px
  padding: $spacing-sm $spacing-base;
  border-radius: $radius-base;
  
  // 使用 scale 函数
  min-width: scale(80px);          // 136px
  height: scale(44px);             // 74.8px
}
```

### 颜色变量

```scss
// 主题色
$color-primary: #1890ff;
$color-success: #52c41a;
$color-warning: #faad14;
$color-error: #ff4d4f;

// 文字颜色
$color-text-primary: #333333;
$color-text-secondary: #666666;
$color-text-placeholder: #999999;

// 背景色
$color-background: #f5f5f5;
$color-background-white: #ffffff;

// 边框
$color-border: #e8e8e8;
```

---

## ➕ 添加新组件

### 1. 创建组件目录

```bash
mkdir -p packages/taro-ui/src/components/NewComponent
```

### 2. 编写组件

```tsx
// packages/taro-ui/src/components/NewComponent/index.tsx
import { View } from '@tarojs/components';
import './index.scss';

export interface NewComponentProps {
  title: string;
  onClick?: () => void;
}

export function NewComponent({ title, onClick }: NewComponentProps) {
  return (
    <View className="new-component" onClick={onClick}>
      {title}
    </View>
  );
}
```

### 3. 编写样式

```scss
// packages/taro-ui/src/components/NewComponent/index.scss
@import '../../styles/variables.scss';

.new-component {
  padding: $spacing-base;
  font-size: $font-size-base;
}
```

### 4. 导出组件

```typescript
// packages/taro-ui/src/index.ts
export { NewComponent } from './components/NewComponent';
export type { NewComponentProps } from './components/NewComponent';
```

---

## ✅ 使用规范

### 代码审查检查清单

- [ ] 页面使用 `<StatusBar />` 和 `<NavBar />`
- [ ] 按钮使用 `<Button>` 组件
- [ ] 列表使用 `<List>` 组件
- [ ] 图片上传使用 `<ImageUploader>`
- [ ] 样式使用 `design-scale.scss` 变量

### 页面模板

```tsx
import { View, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { NavBar, StatusBar, Button, List } from '@svton/taro-ui';
import './index.scss';

export default function ExamplePage() {
  const [loading, setLoading] = useState(false);

  const handleClick = usePersistFn(() => {
    // 处理点击
  });

  return (
    <View className="example-page">
      <StatusBar />
      <NavBar title="示例页面" />
      
      <ScrollView scrollY className="content">
        <List>
          <List.Item title="选项1" arrow onClick={handleClick} />
          <List.Item title="选项2" arrow />
        </List>
        
        <View className="actions">
          <Button type="primary" block onClick={handleClick}>
            确认
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
```

---

**相关文档**: [@svton/hooks](./hooks.md) | [样式规范](../mobile/styling.md)
