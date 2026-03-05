# @svton/ui

> React UI 组件库 - 基于 Tailwind CSS 的轻量级组件

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/ui` |
| **版本** | `1.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **轻量级** - 基于 Tailwind CSS，无额外运行时
2. **可定制** - 支持 className 覆盖和 CVA variants
3. **类型安全** - 完整的 TypeScript 类型支持
4. **双模式** - 支持 Tailwind 预设或预编译 CSS

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/ui
```

### 方式一：Tailwind 预设（推荐）

适合已有 Tailwind 的项目，按需加载，体积最小。

```js
// tailwind.config.js
module.exports = {
  presets: [require('@svton/ui/tailwind-preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};
```

```tsx
import { Modal, Tag } from '@svton/ui';
```

### 方式二：预编译 CSS

适合快速原型或不想配置 Tailwind 的场景。

```tsx
import '@svton/ui/styles.css';
import { Modal, Tag } from '@svton/ui';
```

---

## 📋 组件列表

### 状态组件

| 组件 | 说明 |
|------|------|
| `LoadingState` | 加载状态 |
| `EmptyState` | 空数据状态 |
| `ErrorState` | 错误状态 |
| `ProgressState` | 进度状态 |
| `PermissionState` | 无权限状态 |

### 边界组件

| 组件 | 说明 |
|------|------|
| `RequestBoundary` | 请求状态边界 |

### 反馈组件

| 组件 | 说明 |
|------|------|
| `Modal` | 模态框 |
| `Drawer` | 抽屉 |
| `Tooltip` | 文字提示 |
| `Popover` | 气泡卡片 |
| `Notification` | 通知提醒 |
| `Spin` | 加载中 |

### 数据展示

| 组件 | 说明 |
|------|------|
| `Skeleton` | 骨架屏 |
| `Avatar` | 头像 |
| `Badge` | 徽标 |
| `Tag` | 标签 |
| `Card` | 卡片 |
| `Collapse` | 折叠面板 |
| `Tabs` | 标签页 |
| `Divider` | 分割线 |

### 布局组件

| 组件 | 说明 |
|------|------|
| `Portal` | Portal 容器 |
| `AspectRatio` | 固定宽高比 |
| `ScrollArea` | 滚动区域 |
| `InfiniteScroll` | 无限滚动 |

### 工具组件

| 组件 | 说明 |
|------|------|
| `Copyable` | 一键复制 |
| `VisuallyHidden` | 视觉隐藏 |
| `ClickOutside` | 点击外部检测 |

---

## 🔧 状态组件

### LoadingState

```tsx
import { LoadingState, Loading } from '@svton/ui';

<LoadingState />
<LoadingState text="数据加载中..." />
<LoadingState spinner={false} text="请稍候" />
<Loading text="加载中" />  // 别名
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `ReactNode` | `'Loading...'` | 加载文本 |
| `spinner` | `boolean` | `true` | 是否显示动画 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 水平对齐 |
| `justify` | `'start' \| 'center' \| 'end'` | `'center'` | 垂直对齐 |

### EmptyState

```tsx
import { EmptyState, Empty } from '@svton/ui';

<EmptyState />
<EmptyState text="暂无数据" description="请稍后再试" />
<EmptyState 
  text="暂无订单"
  action={<button>去购物</button>}
/>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `ReactNode` | `'No data'` | 主文本 |
| `description` | `ReactNode` | - | 描述文本 |
| `action` | `ReactNode` | - | 操作按钮 |

### ErrorState

```tsx
import { ErrorState } from '@svton/ui';

<ErrorState />
<ErrorState 
  title="加载失败" 
  message="网络连接异常"
  action={<button onClick={retry}>重试</button>}
/>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `ReactNode` | `'Something went wrong'` | 标题 |
| `message` | `ReactNode` | - | 错误信息 |
| `action` | `ReactNode` | - | 操作按钮 |

### ProgressState

```tsx
import { ProgressState, Progress } from '@svton/ui';

<ProgressState percent={75} />
<ProgressState percent={75} text="上传中..." />
<ProgressState percent={100} status="success" text="上传完成" />
<ProgressState percent={50} status="error" text="上传失败" />
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `percent` | `number` | - | 进度百分比 |
| `status` | `'active' \| 'success' \| 'error'` | `'active'` | 状态 |
| `text` | `ReactNode` | - | 文本 |
| `showPercent` | `boolean` | `true` | 显示百分比 |

### PermissionState

```tsx
import { PermissionState } from '@svton/ui';

<PermissionState />
<PermissionState 
  title="无访问权限"
  message="请联系管理员获取权限"
  action={<button>申请权限</button>}
/>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `ReactNode` | `'Access Denied'` | 标题 |
| `message` | `ReactNode` | `'You do not have permission...'` | 描述 |
| `action` | `ReactNode` | - | 操作按钮 |

---

## 🔧 边界组件

### RequestBoundary

自动处理加载、空数据、错误状态。

```tsx
import { RequestBoundary } from '@svton/ui';

function UserList() {
  const { data, loading, error } = useUsers();

  return (
    <RequestBoundary data={data} loading={loading} error={error}>
      {(users) => (
        <ul>
          {users.map(user => <li key={user.id}>{user.name}</li>)}
        </ul>
      )}
    </RequestBoundary>
  );
}

// 自定义各状态
<RequestBoundary 
  data={data}
  loading={loading}
  error={error}
  isEmpty={(d) => d?.length === 0}
  loadingFallback={<Skeleton count={3} />}
  emptyFallback={<EmptyState text="暂无数据" action={<button>刷新</button>} />}
  errorFallback={(message) => <Alert type="error">{message}</Alert>}
>
  {(data) => <Content data={data} />}
</RequestBoundary>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `data` | `T \| null \| undefined` | - | 数据 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `error` | `unknown` | - | 错误对象 |
| `isEmpty` | `(data) => boolean` | - | 自定义空判断 |
| `loadingFallback` | `ReactNode` | `<LoadingState />` | 加载组件 |
| `emptyFallback` | `ReactNode` | `<EmptyState />` | 空状态组件 |
| `errorFallback` | `ReactNode \| ((msg, err) => ReactNode)` | - | 错误组件 |
| `children` | `ReactNode \| ((data: T) => ReactNode)` | - | 子组件 |

---

## 🔧 反馈组件

### Modal

```tsx
import { Modal } from '@svton/ui';

const [open, setOpen] = useState(false);

<Modal 
  open={open} 
  onClose={() => setOpen(false)}
  title="确认删除"
  footer={
    <>
      <button onClick={() => setOpen(false)}>取消</button>
      <button onClick={handleDelete}>确认</button>
    </>
  }
>
  确定要删除这条记录吗？
</Modal>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `open` | `boolean` | - | 是否显示 |
| `onClose` | `() => void` | - | 关闭回调 |
| `title` | `ReactNode` | - | 标题 |
| `footer` | `ReactNode` | - | 底部内容 |
| `width` | `number \| string` | `480` | 宽度 |
| `mask` | `boolean` | `true` | 显示遮罩 |
| `maskClosable` | `boolean` | `true` | 点击遮罩关闭 |
| `centered` | `boolean` | `true` | 垂直居中 |

### Drawer

```tsx
import { Drawer } from '@svton/ui';

<Drawer 
  open={open} 
  onClose={() => setOpen(false)}
  title="设置"
  placement="right"
  width={400}
>
  <p>抽屉内容</p>
</Drawer>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `open` | `boolean` | - | 是否显示 |
| `onClose` | `() => void` | - | 关闭回调 |
| `title` | `ReactNode` | - | 标题 |
| `placement` | `'left' \| 'right' \| 'top' \| 'bottom'` | `'right'` | 位置 |
| `width` | `number \| string` | `300` | 宽度（左右） |
| `height` | `number \| string` | `300` | 高度（上下） |

### Tooltip

```tsx
import { Tooltip } from '@svton/ui';

<Tooltip content="提示文字">
  <button>悬停显示</button>
</Tooltip>

<Tooltip content="底部提示" placement="bottom">
  <span>底部</span>
</Tooltip>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | `ReactNode` | - | 提示内容 |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | 位置 |
| `delay` | `number` | `100` | 延迟显示(ms) |
| `disabled` | `boolean` | `false` | 禁用 |

### Popover

```tsx
import { Popover } from '@svton/ui';

<Popover 
  content={
    <div>
      <p>气泡卡片内容</p>
      <button>操作</button>
    </div>
  }
  trigger="click"
>
  <button>点击显示</button>
</Popover>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | `ReactNode` | - | 内容 |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | 位置 |
| `trigger` | `'click' \| 'hover'` | `'click'` | 触发方式 |
| `visible` | `boolean` | - | 受控显示 |
| `onVisibleChange` | `(visible: boolean) => void` | - | 显示变化回调 |

### Notification

```tsx
import { NotificationContainer, notification } from '@svton/ui';

// 在 App 根组件添加容器
function App() {
  return (
    <>
      <NotificationContainer placement="topRight" />
      <YourApp />
    </>
  );
}

// 调用通知
notification.success({ title: '保存成功' });
notification.error({ title: '操作失败', description: '请稍后重试' });
notification.info({ title: '提示', duration: 3000 });
notification.warning({ title: '警告' });
```

| 方法 | 参数 | 说明 |
|------|------|------|
| `notification.open` | `NotificationProps` | 打开通知 |
| `notification.success` | `Omit<NotificationProps, 'type'>` | 成功通知 |
| `notification.error` | `Omit<NotificationProps, 'type'>` | 错误通知 |
| `notification.info` | `Omit<NotificationProps, 'type'>` | 信息通知 |
| `notification.warning` | `Omit<NotificationProps, 'type'>` | 警告通知 |

### Spin

```tsx
import { Spin } from '@svton/ui';

// 独立使用
<Spin />
<Spin size="large" tip="加载中..." />

// 包裹内容
<Spin spinning={loading}>
  <div>内容区域</div>
</Spin>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `spinning` | `boolean` | `true` | 是否加载中 |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | 大小 |
| `tip` | `ReactNode` | - | 提示文字 |

---

## 🔧 数据展示

### Skeleton

```tsx
import { Skeleton, SkeletonGroup } from '@svton/ui';

<Skeleton />
<Skeleton width={200} height={20} />
<Skeleton variant="circular" width={40} height={40} />
<Skeleton variant="rounded" height={100} />
<Skeleton animation="wave" />

<SkeletonGroup count={3} gap={12} />
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | `number \| string` | `'100%'` | 宽度 |
| `height` | `number \| string` | `20` | 高度 |
| `variant` | `'text' \| 'circular' \| 'rectangular' \| 'rounded'` | `'text'` | 形状 |
| `animation` | `'pulse' \| 'wave' \| 'none'` | `'pulse'` | 动画 |

### Avatar

```tsx
import { Avatar, AvatarGroup } from '@svton/ui';

<Avatar src="/avatar.jpg" />
<Avatar>U</Avatar>
<Avatar size="large" shape="square" />

<AvatarGroup max={3}>
  <Avatar src="/1.jpg" />
  <Avatar src="/2.jpg" />
  <Avatar src="/3.jpg" />
  <Avatar src="/4.jpg" />
</AvatarGroup>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | - | 图片地址 |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | 大小 |
| `shape` | `'circle' \| 'square'` | `'circle'` | 形状 |
| `icon` | `ReactNode` | - | 图标 |

### Badge

```tsx
import { Badge } from '@svton/ui';

<Badge count={5}>
  <button>消息</button>
</Badge>

<Badge dot>
  <button>通知</button>
</Badge>

<Badge count={100} max={99} />
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `count` | `number` | `0` | 数字 |
| `dot` | `boolean` | `false` | 显示小红点 |
| `max` | `number` | `99` | 最大值 |
| `showZero` | `boolean` | `false` | 显示 0 |
| `color` | `string` | `'#ef4444'` | 颜色 |
| `offset` | `[number, number]` | `[0, 0]` | 偏移 |

### Tag

```tsx
import { Tag } from '@svton/ui';

<Tag>默认</Tag>
<Tag color="blue">蓝色</Tag>
<Tag color="green">绿色</Tag>
<Tag color="red">红色</Tag>
<Tag closable onClose={() => {}}>可关闭</Tag>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `color` | `'default' \| 'blue' \| 'green' \| 'red' \| 'orange' \| 'purple' \| 'cyan'` | `'default'` | 颜色 |
| `closable` | `boolean` | `false` | 可关闭 |
| `onClose` | `() => void` | - | 关闭回调 |
| `bordered` | `boolean` | `true` | 显示边框 |
| `icon` | `ReactNode` | - | 图标 |

### Card

```tsx
import { Card } from '@svton/ui';

<Card title="卡片标题">
  卡片内容
</Card>

<Card 
  title="带操作" 
  extra={<a href="#">更多</a>}
  hoverable
  actions={[<span>编辑</span>, <span>删除</span>]}
>
  内容
</Card>

<Card cover={<img src="/cover.jpg" />}>
  带封面的卡片
</Card>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `ReactNode` | - | 标题 |
| `extra` | `ReactNode` | - | 右上角内容 |
| `cover` | `ReactNode` | - | 封面 |
| `actions` | `ReactNode[]` | - | 底部操作 |
| `bordered` | `boolean` | `true` | 显示边框 |
| `hoverable` | `boolean` | `false` | 悬停效果 |

### Collapse

```tsx
import { Collapse, CollapseItem } from '@svton/ui';

<Collapse>
  <CollapseItem title="面板一" defaultOpen>
    内容一
  </CollapseItem>
  <CollapseItem title="面板二">
    内容二
  </CollapseItem>
  <CollapseItem title="面板三" disabled>
    内容三
  </CollapseItem>
</Collapse>
```

| CollapseItem 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `ReactNode` | - | 标题 |
| `defaultOpen` | `boolean` | `false` | 默认展开 |
| `disabled` | `boolean` | `false` | 禁用 |
| `extra` | `ReactNode` | - | 右侧内容 |

### Tabs

```tsx
import { Tabs } from '@svton/ui';

<Tabs
  items={[
    { key: '1', label: '选项一', children: <div>内容一</div> },
    { key: '2', label: '选项二', children: <div>内容二</div> },
    { key: '3', label: '选项三', children: <div>内容三</div>, disabled: true },
  ]}
  defaultActiveKey="1"
  onChange={(key) => console.log(key)}
/>

<Tabs type="card" items={items} />
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `items` | `TabItem[]` | - | 标签项 |
| `activeKey` | `string` | - | 当前激活（受控） |
| `defaultActiveKey` | `string` | - | 默认激活 |
| `onChange` | `(key: string) => void` | - | 切换回调 |
| `type` | `'line' \| 'card'` | `'line'` | 样式类型 |

### Divider

```tsx
import { Divider } from '@svton/ui';

<Divider />
<Divider dashed />
<Divider>分割文字</Divider>
<Divider orientation="left">左对齐</Divider>

// 垂直分割
<span>文字</span>
<Divider type="vertical" />
<span>文字</span>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'horizontal' \| 'vertical'` | `'horizontal'` | 方向 |
| `dashed` | `boolean` | `false` | 虚线 |
| `orientation` | `'left' \| 'center' \| 'right'` | `'center'` | 文字位置 |

---

## 🔧 布局组件

### Portal

```tsx
import { Portal, PortalContainer } from '@svton/ui';

// 渲染到 body
<Portal>
  <div className="modal">Modal Content</div>
</Portal>

// 渲染到指定容器
<Portal container={document.getElementById('modal-root')}>
  <div>Content</div>
</Portal>

// 禁用 Portal
<Portal disabled>
  <div>直接渲染在当前位置</div>
</Portal>
```

### AspectRatio

```tsx
import { AspectRatio } from '@svton/ui';

<AspectRatio ratio={16 / 9}>
  <img src="/video-cover.jpg" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
</AspectRatio>

<AspectRatio ratio={1}>
  <div>正方形</div>
</AspectRatio>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ratio` | `number` | `16/9` | 宽高比 |

### ScrollArea

```tsx
import { ScrollArea } from '@svton/ui';

<ScrollArea maxHeight={300}>
  <div>长内容...</div>
</ScrollArea>

<ScrollArea maxHeight={300} hideScrollbar>
  <div>隐藏滚动条</div>
</ScrollArea>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxHeight` | `number \| string` | - | 最大高度 |
| `hideScrollbar` | `boolean` | `false` | 隐藏滚动条 |

### InfiniteScroll

```tsx
import { InfiniteScroll } from '@svton/ui';

<InfiniteScroll
  hasMore={hasMore}
  loading={loading}
  onLoadMore={loadMore}
  endMessage={<div>没有更多了</div>}
>
  {items.map(item => <Card key={item.id} {...item} />)}
</InfiniteScroll>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hasMore` | `boolean` | - | 是否有更多 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `onLoadMore` | `() => void` | - | 加载更多回调 |
| `threshold` | `number` | `100` | 触发阈值(px) |
| `loader` | `ReactNode` | `<LoadingState />` | 加载组件 |
| `endMessage` | `ReactNode` | - | 结束提示 |

---

## 🔧 工具组件

### Copyable

```tsx
import { Copyable } from '@svton/ui';

<Copyable text="npm install @svton/ui" />

<Copyable 
  text={apiKey} 
  copyText="复制" 
  copiedText="已复制"
  onCopy={(text) => console.log('Copied:', text)}
>
  <code>{apiKey}</code>
</Copyable>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `string` | - | 复制内容 |
| `copyText` | `ReactNode` | `'Copy'` | 复制按钮文字 |
| `copiedText` | `ReactNode` | `'Copied!'` | 已复制文字 |
| `timeout` | `number` | `2000` | 重置时间(ms) |
| `onCopy` | `(text: string) => void` | - | 复制成功回调 |
| `onError` | `(error: Error) => void` | - | 复制失败回调 |

### VisuallyHidden

用于无障碍访问，内容对屏幕阅读器可见但视觉隐藏。

```tsx
import { VisuallyHidden } from '@svton/ui';

<button>
  <Icon />
  <VisuallyHidden>关闭</VisuallyHidden>
</button>
```

### ClickOutside

```tsx
import { ClickOutside } from '@svton/ui';

<ClickOutside onClickOutside={() => setOpen(false)}>
  <div className="dropdown">
    下拉菜单内容
  </div>
</ClickOutside>
```

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `onClickOutside` | `(event: MouseEvent) => void` | - | 点击外部回调 |
| `disabled` | `boolean` | `false` | 禁用 |

---

## 🛠️ 工具函数

### cn

合并 className 的工具函数，基于 clsx + tailwind-merge。

```tsx
import { cn } from '@svton/ui';

<div className={cn('p-4 bg-white', isActive && 'bg-blue-500', className)} />
```

---

## ✅ 最佳实践

### 1. 使用 RequestBoundary 统一处理状态

```tsx
// ✅ 推荐
<RequestBoundary data={data} loading={loading} error={error}>
  {(data) => <Content data={data} />}
</RequestBoundary>

// ❌ 不推荐
{loading && <Loading />}
{error && <Error />}
{!data && <Empty />}
{data && <Content data={data} />}
```

### 2. 自定义空数据判断

```tsx
<RequestBoundary
  data={data}
  isEmpty={(d) => !d || d.items.length === 0}
>
```

### 3. 提供有意义的空状态

```tsx
<RequestBoundary
  emptyFallback={
    <EmptyState
      text="暂无订单"
      description="您还没有任何订单"
      action={<button>去购物</button>}
    />
  }
>
```

---

**相关文档**: [@svton/hooks](./hooks.md) | [@svton/taro-ui](./taro-ui.md)
