# @svton/hooks

> 通用 React Hooks 工具包 - 提升开发效率的自定义 Hooks

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/hooks` |
| **版本** | `1.1.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **替代原生 Hooks** - 提供更好用的替代方案
2. **避免闭包陷阱** - 自动处理依赖问题
3. **跨平台兼容** - 同时支持 Admin 和 Mobile
4. **原子化设计** - 小而专注，可组合使用

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/hooks
```

### 基本使用

```typescript
import {
  usePersistFn,
  useDebounce,
  useBoolean,
  useLocalStorage,
  useCountdown,
} from '@svton/hooks';
```

---

## 📋 Hooks 列表

### 函数优化

| Hook | 说明 | 替代 |
|------|------|------|
| `usePersistFn` | 持久化函数引用 | `useCallback` |
| `useMemoizedFn` | 记忆化函数（别名） | `useCallback` |
| `useLockFn` | 防止异步函数重复执行 | - |
| `useDebounceFn` | 防抖函数 | - |
| `useThrottleFn` | 节流函数 | - |

### 状态管理

| Hook | 说明 |
|------|------|
| `useBoolean` | 布尔值状态管理 |
| `useToggle` | 在两个值之间切换 |
| `useSetState` | 对象合并式 setState |
| `usePrevious` | 获取上一次渲染的值 |
| `useLatest` | 获取最新值的 ref |
| `useUpdate` | 强制组件重新渲染 |

### 值处理

| Hook | 说明 |
|------|------|
| `useDebounce` | 防抖值 |
| `useThrottle` | 节流值 |

### 生命周期

| Hook | 说明 | 替代 |
|------|------|------|
| `useMount` | 组件挂载时执行 | `useEffect` |
| `useUnmount` | 组件卸载时执行 | `useEffect` |
| `useUpdateEffect` | 忽略首次渲染的 effect | `useEffect` |
| `useDeepCompareEffect` | 深度比较依赖的 effect | `useEffect` |

### 定时器

| Hook | 说明 |
|------|------|
| `useInterval` | setInterval 封装 |
| `useTimeout` | setTimeout 封装 |
| `useCountdown` | 倒计时 |

### 存储

| Hook | 说明 |
|------|------|
| `useLocalStorage` | localStorage 持久化 |
| `useSessionStorage` | sessionStorage 持久化 |

### DOM/浏览器

| Hook | 说明 |
|------|------|
| `useScroll` | 滚动位置监听 |
| `useIntersectionObserver` | 元素可见性检测 |
| `useTextSelection` | 获取选中文本 |

### 表单/组件

| Hook | 说明 |
|------|------|
| `useControllableValue` | 受控/非受控值管理 |
| `useSelections` | 多选列表管理 |

### 请求相关

| Hook | 说明 |
|------|------|
| `useRequestState` | 请求状态管理 |
| `usePagination` | 分页数据加载 |

---

## 🔧 函数优化 Hooks

### usePersistFn

**替代 useCallback，无需手动管理依赖**

```typescript
import { usePersistFn } from '@svton/hooks';

function MyComponent() {
  const [count, setCount] = useState(0);

  // ✅ 推荐：函数引用永远稳定，始终能获取最新值
  const handleClick = usePersistFn(() => {
    console.log('count:', count);
  });

  // ❌ 不推荐：需要手动管理依赖
  const handleClickOld = useCallback(() => {
    console.log('count:', count);
  }, [count]);

  return <ChildComponent onClick={handleClick} />;
}
```

### useLockFn

**防止异步函数重复执行（防重复提交）**

```typescript
import { useLockFn } from '@svton/hooks';

function SubmitButton() {
  const submit = useLockFn(async () => {
    await api.post('/submit', data);
  });

  // 连续点击只会执行一次，直到上一次执行完成
  return <button onClick={submit}>提交</button>;
}
```

### useDebounceFn

**防抖函数**

```typescript
import { useDebounceFn } from '@svton/hooks';

function SearchInput() {
  const { run, cancel, flush } = useDebounceFn(
    (value: string) => {
      searchApi(value);
    },
    { wait: 500 }
  );

  return <input onChange={(e) => run(e.target.value)} />;
}
```

**Options**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wait` | `number` | `300` | 等待时间（ms） |
| `leading` | `boolean` | `false` | 是否在延迟开始前调用 |
| `trailing` | `boolean` | `true` | 是否在延迟结束后调用 |

### useThrottleFn

**节流函数**

```typescript
import { useThrottleFn } from '@svton/hooks';

function ScrollHandler() {
  const { run, cancel } = useThrottleFn(
    () => {
      console.log('scroll');
    },
    { wait: 100 }
  );

  useEffect(() => {
    window.addEventListener('scroll', run);
    return () => window.removeEventListener('scroll', run);
  }, []);
}
```

---

## 🔧 状态管理 Hooks

### useBoolean

**布尔值状态管理**

```typescript
import { useBoolean } from '@svton/hooks';

function Modal() {
  const [visible, { toggle, setTrue, setFalse }] = useBoolean(false);

  return (
    <>
      <button onClick={setTrue}>打开</button>
      <button onClick={setFalse}>关闭</button>
      <button onClick={toggle}>切换</button>
      {visible && <div>Modal Content</div>}
    </>
  );
}
```

### useToggle

**在两个值之间切换**

```typescript
import { useToggle } from '@svton/hooks';

// 布尔值切换
const [state, { toggle }] = useToggle();

// 自定义值切换
const [mode, { toggle, setLeft, setRight }] = useToggle('light', 'dark');
```

### useSetState

**类似 class 组件的 setState，支持对象合并**

```typescript
import { useSetState } from '@svton/hooks';

function Form() {
  const [state, setState] = useSetState({
    name: '',
    age: 0,
    email: '',
  });

  // 部分更新
  setState({ name: 'John' }); // { name: 'John', age: 0, email: '' }

  // 函数式更新
  setState((prev) => ({ age: prev.age + 1 }));
}
```

### usePrevious

**获取上一次渲染时的值**

```typescript
import { usePrevious } from '@svton/hooks';

function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <div>
      当前: {count}, 上一次: {prevCount}
    </div>
  );
}
```

### useLatest

**返回当前最新值的 ref，避免闭包陷阱**

```typescript
import { useLatest } from '@svton/hooks';

function Timer() {
  const [count, setCount] = useState(0);
  const latestCount = useLatest(count);

  useEffect(() => {
    const timer = setInterval(() => {
      // latestCount.current 始终是最新值
      console.log(latestCount.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖也能获取最新值
}
```

### useUpdate

**强制组件重新渲染**

```typescript
import { useUpdate } from '@svton/hooks';

function Component() {
  const update = useUpdate();

  return <button onClick={update}>强制刷新</button>;
}
```

---

## 🔧 值处理 Hooks

### useDebounce

**防抖值，常用于搜索输入**

```typescript
import { useDebounce } from '@svton/hooks';

function Search() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 500);

  useEffect(() => {
    if (debouncedKeyword) {
      searchApi(debouncedKeyword);
    }
  }, [debouncedKeyword]);

  return <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />;
}
```

### useThrottle

**节流值，限制更新频率**

```typescript
import { useThrottle } from '@svton/hooks';

function ScrollPosition() {
  const [scrollY, setScrollY] = useState(0);
  const throttledScrollY = useThrottle(scrollY, 100);

  // throttledScrollY 每 100ms 最多更新一次
  return <div>滚动位置: {throttledScrollY}</div>;
}
```

---

## 🔧 生命周期 Hooks

### useMount

**组件挂载时执行**

```typescript
import { useMount } from '@svton/hooks';

function Component() {
  useMount(() => {
    console.log('mounted');
    // 可返回清理函数
    return () => console.log('cleanup');
  });
}
```

### useUnmount

**组件卸载时执行**

```typescript
import { useUnmount } from '@svton/hooks';

function Component() {
  useUnmount(() => {
    console.log('unmounted');
  });
}
```

### useUpdateEffect

**忽略首次渲染的 useEffect**

```typescript
import { useUpdateEffect } from '@svton/hooks';

function Component({ value }) {
  useUpdateEffect(() => {
    // 只在 value 更新时执行，首次渲染不执行
    console.log('value updated:', value);
  }, [value]);
}
```

### useDeepCompareEffect

**深度比较依赖的 useEffect**

```typescript
import { useDeepCompareEffect } from '@svton/hooks';

function Component({ params }) {
  // 当 params 对象内容变化时才执行
  useDeepCompareEffect(() => {
    fetchData(params);
  }, [params]);
}
```

---

## 🔧 定时器 Hooks

### useInterval

**setInterval 封装**

```typescript
import { useInterval } from '@svton/hooks';

function Timer() {
  const [count, setCount] = useState(0);

  // 每秒加 1
  useInterval(() => {
    setCount((c) => c + 1);
  }, 1000);

  // 传入 null 暂停
  useInterval(callback, isRunning ? 1000 : null);
}
```

### useTimeout

**setTimeout 封装**

```typescript
import { useTimeout } from '@svton/hooks';

function Notification() {
  const [visible, setVisible] = useState(true);

  // 3 秒后隐藏
  useTimeout(() => {
    setVisible(false);
  }, 3000);

  // 传入 null 取消
  useTimeout(callback, shouldRun ? 3000 : null);
}
```

### useCountdown

**倒计时（验证码场景常用）**

```typescript
import { useCountdown } from '@svton/hooks';

function VerifyCode() {
  const { count, counting, start, reset, pause } = useCountdown(60, {
    interval: 1000,
    onEnd: () => console.log('倒计时结束'),
  });

  const handleSend = async () => {
    await sendCode();
    start();
  };

  return (
    <button onClick={handleSend} disabled={counting}>
      {counting ? `${count}s 后重新获取` : '获取验证码'}
    </button>
  );
}
```

---

## 🔧 存储 Hooks

### useLocalStorage

**localStorage 持久化状态**

```typescript
import { useLocalStorage } from '@svton/hooks';

function Settings() {
  const [theme, setTheme, removeTheme] = useLocalStorage<'light' | 'dark'>(
    'theme',
    { defaultValue: 'light' }
  );

  return (
    <>
      <button onClick={() => setTheme('dark')}>深色模式</button>
      <button onClick={removeTheme}>重置</button>
    </>
  );
}
```

**Options**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `defaultValue` | `T` | 默认值 |
| `serializer` | `(value: T) => string` | 自定义序列化 |
| `deserializer` | `(value: string) => T` | 自定义反序列化 |

### useSessionStorage

**sessionStorage 持久化状态**

```typescript
import { useSessionStorage } from '@svton/hooks';

const [formData, setFormData, removeFormData] = useSessionStorage<FormData>(
  'form_draft',
  { defaultValue: {} }
);
```

---

## 🔧 DOM/浏览器 Hooks

### useScroll

**滚动位置监听**

```typescript
import { useScroll } from '@svton/hooks';

function ScrollToTop() {
  // 监听 window 滚动
  const { x, y } = useScroll();

  // 监听指定元素滚动
  const ref = useRef<HTMLDivElement>(null);
  const { y: containerY } = useScroll(ref);

  return (
    <>
      {y > 300 && <button>返回顶部</button>}
      <div ref={ref} style={{ overflow: 'auto' }}>
        {/* content */}
      </div>
    </>
  );
}
```

### useIntersectionObserver

**元素可见性检测（懒加载、曝光埋点）**

```typescript
import { useIntersectionObserver } from '@svton/hooks';

function LazyImage({ src }) {
  const ref = useRef<HTMLImageElement>(null);
  const entry = useIntersectionObserver(ref, {
    threshold: 0.1,
    freezeOnceVisible: true, // 可见后停止观察
  });

  const isVisible = entry?.isIntersecting;

  return <img ref={ref} src={isVisible ? src : placeholder} />;
}

// 曝光埋点
function TrackableCard({ id }) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, { threshold: 0.5 });

  useEffect(() => {
    if (entry?.isIntersecting) {
      trackExposure(id);
    }
  }, [entry?.isIntersecting, id]);

  return <div ref={ref}>{/* content */}</div>;
}
```

### useTextSelection

**获取用户选中的文本**

```typescript
import { useTextSelection } from '@svton/hooks';

function TextToolbar() {
  const { text, rects } = useTextSelection();

  return (
    <>
      {text && (
        <div
          style={{
            position: 'fixed',
            top: rects[0]?.top - 40,
            left: rects[0]?.left,
          }}
        >
          <button onClick={() => copy(text)}>复制</button>
          <button onClick={() => search(text)}>搜索</button>
        </div>
      )}
    </>
  );
}
```

---

## 🔧 表单/组件 Hooks

### useControllableValue

**受控/非受控组件值管理（组件库必备）**

```typescript
import { useControllableValue } from '@svton/hooks';

interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

function Input(props: InputProps) {
  const [value, setValue] = useControllableValue(props);

  return (
    <input
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

// 使用 - 非受控
<Input defaultValue="hello" />

// 使用 - 受控
<Input value={value} onChange={setValue} />
```

**Options**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultValue` | `T` | - | 默认值 |
| `defaultValuePropName` | `string` | `'defaultValue'` | 默认值属性名 |
| `valuePropName` | `string` | `'value'` | 值属性名 |
| `trigger` | `string` | `'onChange'` | 变更回调属性名 |

### useSelections

**多选列表管理（全选、反选、部分选中）**

```typescript
import { useSelections } from '@svton/hooks';

function SelectableList({ items }) {
  const {
    selected,
    allSelected,
    noneSelected,
    partiallySelected,
    isSelected,
    toggle,
    toggleAll,
    selectAll,
    unSelectAll,
  } = useSelections(items, []);

  return (
    <>
      {/* 全选复选框 */}
      <Checkbox
        checked={allSelected}
        indeterminate={partiallySelected}
        onChange={toggleAll}
      >
        全选
      </Checkbox>

      {/* 列表项 */}
      {items.map((item) => (
        <Checkbox
          key={item.id}
          checked={isSelected(item)}
          onChange={() => toggle(item)}
        >
          {item.name}
        </Checkbox>
      ))}

      {/* 已选数量 */}
      <div>已选 {selected.length} 项</div>
    </>
  );
}
```

---

## 🔧 请求相关 Hooks

### useRequestState

**请求状态管理**

```typescript
import { useRequestState } from '@svton/hooks';

function DataView({ data, loading, error }) {
  const { isLoading, isError, isEmpty, errorMessage } = useRequestState({
    data,
    loading,
    error,
    isEmpty: (d) => !d || d.length === 0,
  });

  if (isLoading) return <Loading />;
  if (isError) return <Error message={errorMessage} />;
  if (isEmpty) return <Empty />;

  return <Content data={data} />;
}
```

### usePagination

**分页数据加载**

```typescript
import { usePagination } from '@svton/hooks';

function InfiniteList() {
  const {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    reset,
  } = usePagination(
    (params) => api.getList(params),
    {
      pageSize: 20,
      initialParams: { category: 'all' },
      refreshDeps: [category], // 依赖变化时自动刷新
    }
  );

  return (
    <>
      {data.map((item) => (
        <Item key={item.id} data={item} />
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? '加载中...' : '加载更多'}
        </button>
      )}
    </>
  );
}
```

**Options**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `initialParams` | `TParams` | - | 初始请求参数 |
| `initialPage` | `number` | `1` | 初始页码 |
| `pageSize` | `number` | `10` | 每页数量 |
| `pageKey` | `string` | `'page'` | 页码参数名 |
| `pageSizeKey` | `string` | `'pageSize'` | 每页数量参数名 |
| `getItems` | `(result) => T[]` | - | 从响应中提取数据 |
| `getHasMore` | `(result, items, pageSize) => boolean` | - | 判断是否有更多 |
| `refreshDeps` | `any[]` | `[]` | 依赖变化时自动刷新 |
| `auto` | `boolean` | `true` | 是否自动加载 |

---

## 📱 在 Mobile 中使用

```typescript
// apps/mobile/src/pages/search/index.tsx
import { View, Input } from '@tarojs/components';
import { useState, useEffect } from 'react';
import { usePersistFn, useDebounce, useBoolean } from '@svton/hooks';
import { NavBar, StatusBar, Loading } from '@svton/taro-ui';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, { setTrue, setFalse }] = useBoolean(false);
  const debouncedKeyword = useDebounce(keyword, 500);

  useEffect(() => {
    if (debouncedKeyword) {
      setTrue();
      searchApi(debouncedKeyword).finally(setFalse);
    }
  }, [debouncedKeyword]);

  const handleInput = usePersistFn((e: any) => {
    setKeyword(e.detail.value);
  });

  return (
    <View className="search-page">
      <StatusBar />
      <NavBar title="搜索" />
      <Input value={keyword} onInput={handleInput} placeholder="搜索..." />
      {loading && <Loading />}
    </View>
  );
}
```

---

## 💻 在 Admin 中使用

```typescript
// apps/admin/src/components/UserTable.tsx
'use client';

import { usePagination, useSelections, useBoolean } from '@svton/hooks';
import { Table, Checkbox, Button } from '@/components/ui';

export function UserTable() {
  const { data, loading, hasMore, loadMore, refresh } = usePagination(
    (params) => api.getUsers(params),
    { pageSize: 20 }
  );

  const {
    selected,
    allSelected,
    partiallySelected,
    isSelected,
    toggle,
    toggleAll,
  } = useSelections(data);

  const [deleting, { setTrue, setFalse }] = useBoolean(false);

  const handleBatchDelete = async () => {
    setTrue();
    await api.deleteUsers(selected.map((u) => u.id));
    setFalse();
    refresh();
  };

  return (
    <>
      <Button onClick={handleBatchDelete} disabled={selected.length === 0 || deleting}>
        批量删除 ({selected.length})
      </Button>
      <Table data={data} loading={loading}>
        <Table.Column
          title={
            <Checkbox
              checked={allSelected}
              indeterminate={partiallySelected}
              onChange={toggleAll}
            />
          }
          render={(row) => (
            <Checkbox checked={isSelected(row)} onChange={() => toggle(row)} />
          )}
        />
        {/* other columns */}
      </Table>
    </>
  );
}
```

---

## ✅ 最佳实践

### 规范要求

```typescript
// ✅ 回调函数使用 usePersistFn
const handleClick = usePersistFn(() => { /* ... */ });

// ✅ 布尔状态使用 useBoolean
const [visible, { setTrue, setFalse }] = useBoolean(false);

// ✅ 搜索场景使用 useDebounce
const debouncedKeyword = useDebounce(keyword, 500);

// ✅ 防重复提交使用 useLockFn
const submit = useLockFn(async () => { /* ... */ });

// ✅ 对象依赖使用 useDeepCompareEffect
useDeepCompareEffect(() => { /* ... */ }, [params]);

// ✅ 验证码倒计时使用 useCountdown
const { count, counting, start } = useCountdown(60);
```

### 代码审查检查清单

- [ ] 回调函数使用 `usePersistFn`
- [ ] 布尔状态使用 `useBoolean`
- [ ] 搜索场景使用 `useDebounce`
- [ ] 表单提交使用 `useLockFn`
- [ ] 对象依赖使用 `useDeepCompareEffect`
- [ ] 高频更新使用 `useThrottle`
- [ ] 持久化数据使用 `useLocalStorage`

---

**相关文档**: [@svton/ui](./ui.md) | [@svton/taro-ui](./taro-ui.md)
