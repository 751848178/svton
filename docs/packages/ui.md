# @svton/ui

> React UI 组件库 - 通用状态组件

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/ui` |
| **版本** | `1.0.1` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **轻量级** - 最小化依赖，专注核心功能
2. **可定制** - 支持自定义样式和内容
3. **类型安全** - 完整的 TypeScript 类型支持

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/ui
```

### 基本使用

```tsx
import { LoadingState, EmptyState, RequestBoundary } from '@svton/ui';

function MyComponent() {
  const { data, loading, error } = useQuery();

  return (
    <RequestBoundary data={data} loading={loading} error={error}>
      {(data) => <DataList items={data} />}
    </RequestBoundary>
  );
}
```

---

## 📋 组件列表

| 组件 | 说明 |
|------|------|
| `LoadingState` | 加载状态组件 |
| `EmptyState` | 空状态组件 |
| `RequestBoundary` | 请求状态边界组件 |

---

## 🔧 LoadingState

显示加载中状态。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `ReactNode` | `'Loading...'` | 加载文本 |
| `spinner` | `boolean` | `true` | 是否显示加载动画 |
| `className` | `string` | - | 自定义类名 |
| `style` | `CSSProperties` | - | 自定义样式 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 水平对齐 |
| `justify` | `'start' \| 'center' \| 'end'` | `'center'` | 垂直对齐 |

### 示例

```tsx
import { LoadingState, Loading } from '@svton/ui';

// 基本使用
<LoadingState />

// 自定义文本
<LoadingState text="数据加载中..." />

// 无文本
<LoadingState text={null} />

// 无动画
<LoadingState spinner={false} text="请稍候" />

// 自定义样式
<LoadingState 
  style={{ minHeight: 200 }}
  align="center"
  justify="center"
/>

// 别名
<Loading text="加载中" />
```

---

## 🔧 EmptyState

显示空数据状态。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `ReactNode` | `'No data'` | 主文本 |
| `description` | `ReactNode` | - | 描述文本 |
| `action` | `ReactNode` | - | 操作按钮 |
| `className` | `string` | - | 自定义类名 |
| `style` | `CSSProperties` | - | 自定义样式 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 水平对齐 |
| `justify` | `'start' \| 'center' \| 'end'` | `'center'` | 垂直对齐 |

### 示例

```tsx
import { EmptyState, Empty } from '@svton/ui';

// 基本使用
<EmptyState />

// 自定义文本
<EmptyState text="暂无数据" />

// 带描述
<EmptyState 
  text="暂无订单"
  description="您还没有任何订单记录"
/>

// 带操作按钮
<EmptyState 
  text="暂无商品"
  description="点击下方按钮添加商品"
  action={<Button onClick={handleAdd}>添加商品</Button>}
/>

// 左对齐
<EmptyState 
  text="暂无数据"
  align="start"
/>

// 别名
<Empty text="无数据" />
```

---

## 🔧 RequestBoundary

请求状态边界组件，自动处理加载、空数据、错误状态。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `data` | `T \| null \| undefined` | - | 数据 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `error` | `unknown` | - | 错误对象 |
| `isEmpty` | `(data) => boolean` | - | 自定义空数据判断 |
| `loadingFallback` | `ReactNode` | `<LoadingState />` | 加载状态组件 |
| `emptyFallback` | `ReactNode` | `<EmptyState />` | 空状态组件 |
| `errorFallback` | `ReactNode \| ((msg, err) => ReactNode)` | - | 错误状态组件 |
| `children` | `ReactNode \| ((data: T) => ReactNode)` | - | 子组件 |

### 示例

```tsx
import { RequestBoundary } from '@svton/ui';

// 基本使用
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

// 自定义空数据判断
<RequestBoundary 
  data={data}
  loading={loading}
  isEmpty={(d) => !d || d.length === 0}
>
  {(data) => <List items={data} />}
</RequestBoundary>

// 自定义各状态组件
<RequestBoundary 
  data={data}
  loading={loading}
  error={error}
  loadingFallback={<Skeleton />}
  emptyFallback={
    <EmptyState 
      text="暂无数据"
      action={<Button>刷新</Button>}
    />
  }
  errorFallback={(message) => (
    <Alert type="error">{message}</Alert>
  )}
>
  {(data) => <Content data={data} />}
</RequestBoundary>

// 静态子组件
<RequestBoundary data={data} loading={loading}>
  <StaticContent />
</RequestBoundary>
```

---

## 📋 与 Hooks 配合使用

### 配合 SWR

```tsx
import useSWR from 'swr';
import { RequestBoundary } from '@svton/ui';

function UserProfile({ id }: { id: number }) {
  const { data, error, isLoading } = useSWR(`/api/users/${id}`);

  return (
    <RequestBoundary data={data} loading={isLoading} error={error}>
      {(user) => (
        <div>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      )}
    </RequestBoundary>
  );
}
```

### 配合 React Query

```tsx
import { useQuery } from '@tanstack/react-query';
import { RequestBoundary } from '@svton/ui';

function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  return (
    <RequestBoundary 
      data={data} 
      loading={isLoading} 
      error={error}
      isEmpty={(d) => d?.length === 0}
    >
      {(products) => (
        <div className="grid">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </RequestBoundary>
  );
}
```

### 配合 @svton/hooks

```tsx
import { useRequestState } from '@svton/hooks';
import { RequestBoundary } from '@svton/ui';

function DataView({ data, loading, error }) {
  return (
    <RequestBoundary data={data} loading={loading} error={error}>
      {(data) => <DataDisplay data={data} />}
    </RequestBoundary>
  );
}
```

---

## 🎨 自定义样式

### 使用 className

```tsx
<LoadingState className="my-loading" />
<EmptyState className="my-empty" />
```

```css
.my-loading {
  min-height: 300px;
  background: #f5f5f5;
}

.my-empty {
  padding: 48px;
}
```

### 使用 style

```tsx
<LoadingState 
  style={{ 
    minHeight: 200,
    backgroundColor: '#fafafa',
  }} 
/>
```

### 完全自定义

```tsx
<RequestBoundary
  data={data}
  loading={loading}
  loadingFallback={<MyCustomLoader />}
  emptyFallback={<MyCustomEmpty />}
  errorFallback={<MyCustomError />}
>
  {(data) => <Content data={data} />}
</RequestBoundary>
```

---

## ✅ 最佳实践

1. **使用 RequestBoundary 统一处理状态**
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

2. **自定义空数据判断**
   ```tsx
   <RequestBoundary
     data={data}
     isEmpty={(d) => !d || d.items.length === 0}
   >
   ```

3. **提供有意义的空状态**
   ```tsx
   <RequestBoundary
     emptyFallback={
       <EmptyState
         text="暂无订单"
         description="您还没有任何订单"
         action={<Button>去购物</Button>}
       />
     }
   >
   ```

---

**相关文档**: [@svton/hooks](./hooks.md) | [@svton/taro-ui](./taro-ui.md)
