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

### SearchBar 搜索栏

```tsx
import { SearchBar } from '@svton/taro-ui';

<SearchBar
  value={keyword}
  placeholder="搜索商品"
  onChange={setKeyword}
  onS

### SearchBar 搜索栏

```tsx
import { SearchBar } from '@svton/taro-ui';

<SearchBar
  value={keyword}
  placeholder="搜索商品"
  onChange={setKeyword}
  onSearch={handleSearch}
/>

// 带取消按钮
<SearchBar
  value={keyword}
  showAction
  actionText="取消"
  onChange={setKeyword}
  onCancel={handleCancel}
/>
```

#### SearchBar Props

```typescript
interface SearchBarProps {
  value?: string;
  placeholder?: string;
  shape?: 'round' | 'square';
  showAction?: boolean;
  actionText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onCancel?: () => void;
  onClear?: () => void;
}
```

### Switch 开关

```tsx
import { Switch } from '@svton/taro-ui';

<Switch checked={checked} onChange={setChecked} />
<Switch checked disabled />
<Switch loading />
<Switch size="small" />
<Switch activeColor="#07c160" inactiveColor="#ee0a24" />
```

#### Switch Props

```typescript
interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
  activeColor?: string;
  inactiveColor?: string;
  onChange?: (checked: boolean) => void;
}
```

### Checkbox 复选框

```tsx
import { Checkbox, CheckboxGroup } from '@svton/taro-ui';

// 单独使用
<Checkbox checked={checked} onChange={setChecked}>
  同意协议
</Checkbox>

// 复选框组
<CheckboxGroup value={selected} onChange={setSelected}>
  <Checkbox value="apple">苹果</Checkbox>
  <Checkbox value="banana">香蕉</Checkbox>
  <Checkbox value="orange">橙子</Checkbox>
</CheckboxGroup>

// 水平排列
<CheckboxGroup direction="horizontal" value={selected} onChange={setSelected}>
  <Checkbox value="1">选项1</Checkbox>
  <Checkbox value="2">选项2</Checkbox>
</CheckboxGroup>
```

#### Checkbox Props

```typescript
interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  shape?: 'square' | 'round';
  checkedColor?: string;
  iconSize?: number;
  value?: string | number;
  onChange?: (checked: boolean) => void;
}

interface CheckboxGroupProps {
  value?: (string | number)[];
  defaultValue?: (string | number)[];
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
  onChange?: (value: (string | number)[]) => void;
}
```

### Radio 单选框

```tsx
import { Radio, RadioGroup } from '@svton/taro-ui';

<RadioGroup value={selected} onChange={setSelected}>
  <Radio value="male">男</Radio>
  <Radio value="female">女</Radio>
</RadioGroup>

// 水平排列
<RadioGroup direction="horizontal" value={selected} onChange={setSelected}>
  <Radio value="1">选项1</Radio>
  <Radio value="2">选项2</Radio>
</RadioGroup>
```

### Rate 评分

```tsx
import { Rate } from '@svton/taro-ui';

<Rate value={score} onChange={setScore} />
<Rate value={3} readonly />
<Rate value={score} count={10} onChange={setScore} />
<Rate value={score} allowHalf onChange={setScore} />
<Rate size="large" activeColor="#ffd21e" />
```

#### Rate Props

```typescript
interface RateProps {
  value?: number;
  defaultValue?: number;
  count?: number;           // 星星总数，默认 5
  allowHalf?: boolean;      // 是否允许半星
  readonly?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  activeColor?: string;
  inactiveColor?: string;
  icon?: ReactNode;         // 自定义图标
  voidIcon?: ReactNode;     // 自定义空图标
  onChange?: (value: number) => void;
}
```

### Stepper 步进器

```tsx
import { Stepper } from '@svton/taro-ui';

<Stepper value={count} onChange={setCount} />
<Stepper value={count} min={1} max={99} onChange={setCount} />
<Stepper value={count} step={2} onChange={setCount} />
<Stepper value={count} disabled />
<Stepper value={count} disableInput onChange={setCount} />
<Stepper size="small" />
```

#### Stepper Props

```typescript
interface StepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;             // 最小值，默认 1
  max?: number;             // 最大值，默认 Infinity
  step?: number;            // 步长，默认 1
  disabled?: boolean;
  disableInput?: boolean;   // 是否禁用输入框
  size?: 'small' | 'medium' | 'large';
  inputWidth?: number;
  decimalLength?: number;   // 小数位数
  onChange?: (value: number) => void;
}
```

### ImageUploader 图片上传

```tsx
import { ImageUploader } from '@svton/taro-ui';

<ImageUploader
  value={images}
  onChange={setImages}
  maxCount={9}
  onUpload={async (file) => {
    const url = await uploadFile(file);
    return url;
  }}
/>
```

---

## 🎨 展示组件

### Tag 标签

```tsx
import { Tag } from '@svton/taro-ui';

// 类型
<Tag type="primary">主要</Tag>
<Tag type="success">成功</Tag>
<Tag type="warning">警告</Tag>
<Tag type="danger">危险</Tag>
<Tag type="default">默认</Tag>

// 样式变体
<Tag variant="fill">填充</Tag>
<Tag variant="outline">描边</Tag>
<Tag variant="light">浅色</Tag>

// 尺寸和圆角
<Tag size="small">小标签</Tag>
<Tag size="large">大标签</Tag>
<Tag round>圆角标签</Tag>

// 可关闭
<Tag closeable onClose={handleClose}>可关闭</Tag>
```

#### Tag Props

```typescript
interface TagProps {
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  variant?: 'light' | 'fill' | 'outline';
  size?: 'small' | 'medium' | 'large';
  round?: boolean;
  closeable?: boolean;
  color?: string;
  bgColor?: string;
  onClose?: () => void;
  onClick?: () => void;
}
```

### Badge 徽标

```tsx
import { Badge } from '@svton/taro-ui';

<Badge content={5}>
  <View className="box" />
</Badge>

<Badge content="99+">
  <View className="box" />
</Badge>

<Badge dot>
  <View className="box" />
</Badge>

<Badge content="NEW" type="primary">
  <View className="box" />
</Badge>
```

#### Badge Props

```typescript
interface BadgeProps {
  content?: ReactNode;      // 徽标内容
  dot?: boolean;            // 是否显示小红点
  max?: number;             // 最大值
  type?: 'primary' | 'success' | 'warning' | 'danger';
  offset?: [number, number]; // 偏移量
}
```

### Avatar 头像

```tsx
import { Avatar, AvatarGroup } from '@svton/taro-ui';

<Avatar src="avatar.jpg" />
<Avatar>U</Avatar>
<Avatar icon={<Icon name="user" />} />

// 尺寸和形状
<Avatar size="small" src="avatar.jpg" />
<Avatar size="large" src="avatar.jpg" />
<Avatar shape="square" src="avatar.jpg" />

// 头像组
<AvatarGroup max={3}>
  <Avatar src="avatar1.jpg" />
  <Avatar src="avatar2.jpg" />
  <Avatar src="avatar3.jpg" />
  <Avatar src="avatar4.jpg" />
</AvatarGroup>
```

#### Avatar Props

```typescript
interface AvatarProps {
  src?: string;
  size?: 'small' | 'medium' | 'large' | number;
  shape?: 'circle' | 'square';
  icon?: ReactNode;
  alt?: string;
  onClick?: () => void;
}

interface AvatarGroupProps {
  max?: number;             // 最多显示数量
  size?: 'small' | 'medium' | 'large';
  shape?: 'circle' | 'square';
  gap?: number;             // 头像间距
}
```

### Skeleton 骨架屏

```tsx
import { Skeleton, SkeletonImage } from '@svton/taro-ui';

// 基础骨架屏
<Skeleton loading={loading}>
  <View>实际内容</View>
</Skeleton>

// 带头像和多行
<Skeleton loading={loading} avatar rows={3}>
  <View>实际内容</View>
</Skeleton>

// 骨架图片
<SkeletonImage />
<SkeletonImage shape="round" />
```

#### Skeleton Props

```typescript
interface SkeletonProps {
  loading?: boolean;        // 是否显示骨架屏
  avatar?: boolean;         // 是否显示头像
  avatarSize?: 'small' | 'medium' | 'large';
  avatarShape?: 'circle' | 'square';
  title?: boolean;          // 是否显示标题
  rows?: number;            // 段落行数
  animate?: boolean;        // 是否开启动画
}
```

### Progress 进度条

```tsx
import { Progress } from '@svton/taro-ui';

// 线性进度条
<Progress percent={50} />
<Progress percent={75} status="success" />
<Progress percent={30} status="error" />
<Progress percent={50} showText={false} />

// 环形进度条
<Progress type="circle" percent={75} />
<Progress type="circle" percent={100} status="success" />
```

#### Progress Props

```typescript
interface ProgressProps {
  percent: number;          // 进度百分比 0-100
  type?: 'line' | 'circle';
  status?: 'normal' | 'success' | 'error';
  strokeWidth?: number;     // 进度条粗细
  color?: string;           // 进度条颜色
  trackColor?: string;      // 轨道颜色
  showText?: boolean;       // 是否显示文字
  text?: string;            // 自定义文字
  size?: number;            // 环形进度条直径
}
```

### Steps 步骤条

```tsx
import { Steps } from '@svton/taro-ui';

const items = [
  { title: '步骤1', description: '描述信息' },
  { title: '步骤2', description: '描述信息' },
  { title: '步骤3', description: '描述信息' },
];

<Steps current={1} items={items} />

// 垂直方向
<Steps direction="vertical" current={1} items={items} />

// 自定义状态
const itemsWithStatus = [
  { title: '已完成', status: 'finish' },
  { title: '进行中', status: 'process' },
  { title: '错误', status: 'error' },
  { title: '等待', status: 'wait' },
];
<Steps items={itemsWithStatus} />
```

#### Steps Props

```typescript
interface StepItem {
  title: string;
  description?: string;
  icon?: ReactNode;
  status?: 'wait' | 'process' | 'finish' | 'error';
}

interface StepsProps {
  current?: number;         // 当前步骤（从 0 开始）
  direction?: 'horizontal' | 'vertical';
  items: StepItem[];
  onClick?: (index: number) => void;
}
```

### Collapse 折叠面板

```tsx
import { Collapse, CollapseItem } from '@svton/taro-ui';

<Collapse activeKey={activeKey} onChange={setActiveKey}>
  <CollapseItem title="标题1" name="1">
    内容1
  </CollapseItem>
  <CollapseItem title="标题2" name="2">
    内容2
  </CollapseItem>
</Collapse>

// 手风琴模式
<Collapse accordion activeKey={activeKey} onChange={setActiveKey}>
  <CollapseItem title="标题1" name="1">内容1</CollapseItem>
  <CollapseItem title="标题2" name="2">内容2</CollapseItem>
</Collapse>
```

### NoticeBar 通告栏

```tsx
import { NoticeBar } from '@svton/taro-ui';

<NoticeBar content="这是一条通知信息" />
<NoticeBar content="可关闭的通知" closeable />
<NoticeBar content="可点击的通知" link onClick={handleClick} />
<NoticeBar content="滚动播放的长文本通知信息" scrollable />

// 不同类型
<NoticeBar type="info" content="信息提示" />
<NoticeBar type="success" content="成功提示" />
<NoticeBar type="warning" content="警告提示" />
<NoticeBar type="error" content="错误提示" />
```

#### NoticeBar Props

```typescript
interface NoticeBarProps {
  content: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  closeable?: boolean;
  clickable?: boolean;
  scrollable?: boolean;
  speed?: number;           // 滚动速度（px/s）
  delay?: number;           // 延迟开始滚动时间（ms）
  icon?: ReactNode;
  action?: ReactNode;
  link?: boolean;           // 是否显示链接箭头
  onClick?: () => void;
  onClose?: () => void;
}
```

### Countdown 倒计时

```tsx
import { Countdown } from '@svton/taro-ui';

<Countdown time={30 * 60 * 1000} />
<Countdown time={time} format="DD 天 HH 时 mm 分 ss 秒" />
<Countdown time={time} onFinish={handleFinish} />

// 毫秒级
<Countdown time={time} millisecond format="HH:mm:ss:SSS" />
```

#### Countdown Props

```typescript
interface CountdownProps {
  time: number;             // 倒计时时长（毫秒）
  format?: string;          // 时间格式
  autoStart?: boolean;      // 是否自动开始
  millisecond?: boolean;    // 是否开启毫秒级渲染
  onFinish?: () => void;
  onChange?: (timeData: TimeData) => void;
}
```

### Result 结果页

```tsx
import { Result } from '@svton/taro-ui';

<Result
  status="success"
  title="操作成功"
  description="内容详情可折行，建议不超过两行"
/>

<Result
  status="error"
  title="操作失败"
  description="请稍后重试"
  extra={<Button type="primary">重试</Button>}
/>

// 不同状态
<Result status="info" title="信息提示" />
<Result status="warning" title="警告提示" />
<Result status="waiting" title="等待处理" />
```

#### Result Props

```typescript
interface ResultProps {
  status?: 'success' | 'error' | 'info' | 'warning' | 'waiting';
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
}
```

---

## 💬 反馈组件

### Popup 弹出层

```tsx
import { Popup } from '@svton/taro-ui';

// 底部弹出
<Popup visible={visible} position="bottom" onClose={() => setVisible(false)}>
  <View>弹出内容</View>
</Popup>

// 不同方向
<Popup visible={visible} position="top" onClose={onClose}>顶部弹出</Popup>
<Popup visible={visible} position="left" onClose={onClose}>左侧弹出</Popup>
<Popup visible={visible} position="right" onClose={onClose}>右侧弹出</Popup>
<Popup visible={visible} position="center" onClose={onClose}>居中弹出</Popup>

// 圆角和安全区域
<Popup visible={visible} position="bottom" round safeAreaInsetBottom onClose={onClose}>
  <View>内容</View>
</Popup>
```

#### Popup Props

```typescript
interface PopupProps {
  visible: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  overlay?: boolean;        // 是否显示遮罩
  closeOnOverlayClick?: boolean;
  round?: boolean;          // 是否显示圆角
  safeAreaInsetBottom?: boolean;
  safeAreaInsetTop?: boolean;
  zIndex?: number;
  lockScroll?: boolean;     // 是否锁定背景滚动
  onClose?: () => void;
  onOpen?: () => void;
  onClosed?: () => void;
}
```

### Modal 弹窗

```tsx
import { Modal } from '@svton/taro-ui';

<Modal
  visible={visible}
  title="提示"
  content="确定要删除吗？"
  actions={[
    { text: '取消', type: 'cancel', onClick: () => setVisible(false) },
    { text: '确定', type: 'confirm', onClick: handleConfirm },
  ]}
  onClose={() => setVisible(false)}
/>

// 危险操作
<Modal
  visible={visible}
  title="警告"
  content="此操作不可恢复"
  actions={[
    { text: '取消', type: 'cancel', onClick: onClose },
    { text: '删除', type: 'danger', onClick: handleDelete },
  ]}
  onClose={onClose}
/>

// 自定义内容
<Modal visible={visible} title="自定义" onClose={onClose}>
  <View>自定义内容</View>
</Modal>
```

#### Modal Props

```typescript
interface ModalAction {
  text: string;
  type?: 'cancel' | 'confirm' | 'danger';
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
}

interface ModalProps {
  visible: boolean;
  title?: ReactNode;
  content?: ReactNode;
  actions?: ModalAction[];
  actionsDirection?: 'horizontal' | 'vertical';
  closeOnOverlayClick?: boolean;
  showClose?: boolean;
  zIndex?: number;
  onClose?: () => void;
}
```

### ActionSheet 动作面板

```tsx
import { ActionSheet } from '@svton/taro-ui';

const items = [
  { text: '选项一' },
  { text: '选项二' },
  { text: '删除', danger: true },
];

<ActionSheet
  visible={visible}
  title="请选择操作"
  items={items}
  onSelect={(item, index) => console.log(item, index)}
  onClose={() => setVisible(false)}
/>

// 带描述
const itemsWithDesc = [
  { text: '微信', description: '分享到微信好友' },
  { text: '朋友圈', description: '分享到朋友圈' },
];
<ActionSheet visible={visible} items={itemsWithDesc} onClose={onClose} />
```

#### ActionSheet Props

```typescript
interface ActionSheetItem {
  text: string;
  description?: string;
  danger?: boolean;
  disabled?: boolean;
  color?: string;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  description?: string;
  items: ActionSheetItem[];
  cancelText?: string;
  closeOnOverlayClick?: boolean;
  onSelect?: (item: ActionSheetItem, index: number) => void;
  onCancel?: () => void;
  onClose?: () => void;
}
```

### Toast 轻提示

```tsx
import { Toast } from '@svton/taro-ui';

// 基础用法
<Toast visible={visible} message="提示信息" onClose={() => setVisible(false)} />

// 不同类型
<Toast visible={visible} type="success" message="操作成功" onClose={onClose} />
<Toast visible={visible} type="error" message="操作失败" onClose={onClose} />
<Toast visible={visible} type="warning" message="警告提示" onClose={onClose} />
<Toast visible={visible} type="loading" message="加载中..." onClose={onClose} />

// 不同位置
<Toast visible={visible} position="top" message="顶部提示" onClose={onClose} />
<Toast visible={visible} position="bottom" message="底部提示" onClose={onClose} />

// 自定义时长
<Toast visible={visible} message="3秒后关闭" duration={3000} onClose={onClose} />
```

#### Toast Props

```typescript
interface ToastProps {
  visible: boolean;
  type?: 'success' | 'error' | 'warning' | 'loading' | 'text';
  message: string;
  position?: 'top' | 'center' | 'bottom';
  duration?: number;        // 显示时长（ms），0 表示不自动关闭
  icon?: ReactNode;
  zIndex?: number;
  onClose?: () => void;
}
```

### SwipeCell 滑动单元格

```tsx
import { SwipeCell } from '@svton/taro-ui';

<SwipeCell
  rightActions={[
    { text: '删除', color: '#ee0a24', onClick: handleDelete },
  ]}
>
  <Cell title="滑动单元格" value="左滑显示按钮" />
</SwipeCell>

// 左右都有操作
<SwipeCell
  leftActions={[
    { text: '收藏', color: '#07c160' },
  ]}
  rightActions={[
    { text: '编辑', color: '#1890ff' },
    { text: '删除', color: '#ee0a24' },
  ]}
>
  <Cell title="双向滑动" />
</SwipeCell>
```

#### SwipeCell Props

```typescript
interface SwipeCellAction {
  text: string;
  color?: string;
  backgroundColor?: string;
  width?: number;
  onClick?: () => void;
}

interface SwipeCellProps {
  leftActions?: SwipeCellAction[];
  rightActions?: SwipeCellAction[];
  disabled?: boolean;
  onOpen?: (position: 'left' | 'right') => void;
  onClose?: () => void;
}
```

### LoadingState 加载状态

```tsx
import { LoadingState, Loading } from '@svton/taro-ui';

<LoadingState loading={loading}>
  <View>内容</View>
</LoadingState>

// 单独使用 Loading
<Loading />
<Loading size="large" />
<Loading text="加载中..." />
```

### EmptyState 空状态

```tsx
import { EmptyState, Empty } from '@svton/taro-ui';

<EmptyState />
<EmptyState description="暂无数据" />
<EmptyState
  image={<Image src="empty.png" />}
  description="暂无订单"
>
  <Button type="primary" size="small">去下单</Button>
</EmptyState>
```

### RequestBoundary 请求边界

```tsx
import { RequestBoundary } from '@svton/taro-ui';

<RequestBoundary
  loading={loading}
  error={error}
  empty={data.length === 0}
  onRetry={refetch}
>
  <View>数据内容</View>
</RequestBoundary>
```

---

## 🧭 导航组件

### Tabs 标签页

```tsx
import { Tabs } from '@svton/taro-ui';

const tabs = [
  { title: '全部' },
  { title: '活动' },
  { title: '公告' },
];

<Tabs tabs={tabs} activeIndex={activeIndex} onChange={setActiveIndex} />
```

### TabBar 底部导航

```tsx
import { TabBar } from '@svton/taro-ui';

const tabs = [
  { title: '首页', icon: 'home', selectedIcon: 'home-filled' },
  { title: '发现', icon: 'discover', selectedIcon: 'discover-filled' },
  { title: '我的', icon: 'user', selectedIcon: 'user-filled' },
];

<TabBar tabs={tabs} activeIndex={currentTab} onChange={setCurrentTab} />
```

### BackTop 返回顶部

```tsx
import { BackTop } from '@svton/taro-ui';

<BackTop />
<BackTop right={20} bottom={100} />
<BackTop visibilityHeight={400} />

// 自定义内容
<BackTop>
  <View className="custom-back-top">UP</View>
</BackTop>
```

#### BackTop Props

```typescript
interface BackTopProps {
  visibilityHeight?: number; // 滚动高度达到此值才显示
  right?: number;
  bottom?: number;
  zIndex?: number;
  onClick?: () => void;
}
```

### List 列表

```tsx
import { List } from '@svton/taro-ui';

<List>
  <List.Item title="标题" description="描述文字" arrow onClick={handleClick} />
  <List.Item title="带图标" icon={<Icon name="setting" />} arrow />
  <List.Item title="带右侧内容" extra={<Text>更多</Text>} />
</List>
```

---

## 🪝 Hooks

### useScrollOpacity

滚动透明度 Hook，用于导航栏渐变效果。

```tsx
import { useScrollOpacity } from '@svton/taro-ui';

function MyPage() {
  const opacity = useScrollOpacity();
  
  return (
    <NavBar style={{ opacity }} title="标题" />
  );
}
```

### usePullDownRefresh

下拉刷新 Hook。

```tsx
import { usePullDownRefresh } from '@svton/taro-ui';

function MyPage() {
  usePullDownRefresh(async () => {
    await fetchData();
  });
}
```

### useReachBottom

触底加载 Hook。

```tsx
import { useReachBottom } from '@svton/taro-ui';

function MyPage() {
  useReachBottom(() => {
    loadMore();
  });
}
```

### useLoadMoreOnReachBottom

触底加载更多 Hook（带状态管理）。

```tsx
import { useLoadMoreOnReachBottom } from '@svton/taro-ui';

function MyPage() {
  const { loading, hasMore, loadMore } = useLoadMoreOnReachBottom({
    fetchData: async (page) => {
      const data = await api.getList({ page });
      return { list: data.list, hasMore: data.hasMore };
    },
  });
}
```

---

## 🎨 样式规范

### 1.7 倍缩放规则

所有组件遵循设计稿 1.7 倍缩放：

```scss
@import '../../styles/variables.scss';

.button {
  font-size: $font-size-base;      // scale(16px) = 27.2px
  padding: $spacing-sm $spacing-base;
  border-radius: $radius-base;
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
    <View className="svton-new-component" onClick={onClick}>
      {title}
    </View>
  );
}
```

### 3. 编写样式

```scss
// packages/taro-ui/src/components/NewComponent/index.scss
@import '../../styles/variables.scss';

.svton-new-component {
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
- [ ] 列表使用 `<List>` 或 `<Cell>` 组件
- [ ] 图片上传使用 `<ImageUploader>`
- [ ] 弹窗使用 `<Modal>` 或 `<Popup>`
- [ ] 表单使用对应的表单组件
- [ ] 样式使用 `variables.scss` 变量

### 页面模板

```tsx
import { View, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { NavBar, StatusBar, Button, Cell, CellGroup } from '@svton/taro-ui';
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
        <CellGroup title="设置">
          <Cell title="选项1" arrow onClick={handleClick} />
          <Cell title="选项2" arrow />
        </CellGroup>
        
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
