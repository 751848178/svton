# @svton/hooks

> 通用 React Hooks 工具包 - 提升开发效率的自定义 Hooks

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/hooks` |
| **版本** | `1.0.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **替代原生 Hooks** - 提供更好用的替代方案
2. **避免闭包陷阱** - 自动处理依赖问题
3. **跨平台兼容** - 同时支持 Admin 和 Mobile

---

## 📋 可用 Hooks

| Hook | 用途 | 替代 |
|------|------|------|
| `usePersistFn` | 持久化函数引用 | `useCallback` |
| `useMemoizedFn` | 记忆化函数 | `useCallback` |
| `useDebounce` | 防抖值 | - |
| `useThrottle` | 节流值 | - |
| `useDeepCompareEffect` | 深度比较的 useEffect | `useEffect` |

---

## 🔧 使用方法

### usePersistFn (最常用)

**替代 useCallback，无需手动管理依赖**

```typescript
import { usePersistFn } from '@svton/hooks';

function MyComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  // ✅ 推荐：使用 usePersistFn
  const handleClick = usePersistFn(() => {
    console.log('count:', count);
    console.log('name:', name);
    // 始终能获取到最新值
  });

  // ❌ 不推荐：使用 useCallback 需要手动管理依赖
  const handleClickOld = useCallback(() => {
    console.log('count:', count);
    console.log('name:', name);
  }, [count, name]); // 容易遗漏依赖

  return (
    <ChildComponent onClick={handleClick} />
  );
}
```

**优点**：
- 函数引用永远稳定
- 无需声明依赖数组
- 避免闭包陷阱
- 避免子组件不必要的重渲染

---

### useMemoizedFn

**与 usePersistFn 类似，提供记忆化功能**

```typescript
import { useMemoizedFn } from '@svton/hooks';

const memoizedFn = useMemoizedFn((a: number, b: number) => {
  return a + b;
});
```

---

### useDebounce

**防抖值，常用于搜索输入**

```typescript
import { useState, useEffect } from 'react';
import { useDebounce } from '@svton/hooks';

function SearchComponent() {
  const [keyword, setKeyword] = useState('');
  
  // 防抖 500ms
  const debouncedKeyword = useDebounce(keyword, 500);

  useEffect(() => {
    if (debouncedKeyword) {
      // 只有在用户停止输入 500ms 后才执行搜索
      searchApi(debouncedKeyword);
    }
  }, [debouncedKeyword]);

  return (
    <input
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      placeholder="搜索..."
    />
  );
}
```

**参数**：
- `value`: 需要防抖的值
- `delay`: 延迟时间（毫秒），默认 500ms

---

### useThrottle

**节流值，限制更新频率**

```typescript
import { useThrottle } from '@svton/hooks';

function ScrollComponent() {
  const [scrollY, setScrollY] = useState(0);
  
  // 节流 100ms，每 100ms 最多更新一次
  const throttledScrollY = useThrottle(scrollY, 100);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 使用节流后的值进行渲染，避免频繁更新
  return <div>滚动位置: {throttledScrollY}</div>;
}
```

---

### useDeepCompareEffect

**深度比较依赖的 useEffect**

```typescript
import { useDeepCompareEffect } from '@svton/hooks';

function MyComponent({ params }: { params: QueryParams }) {
  // 当 params 对象内容变化时才执行
  useDeepCompareEffect(() => {
    fetchData(params);
  }, [params]);

  // ❌ 普通 useEffect 会在每次渲染时执行（对象引用变化）
  // useEffect(() => {
  //   fetchData(params);
  // }, [params]);
}
```

**使用场景**：
- 依赖项是对象或数组
- 需要比较内容而非引用

---

## 📱 在 Mobile 中使用

```typescript
// apps/mobile/src/pages/search/index.tsx
import { View, Input } from '@tarojs/components';
import { useState, useEffect } from 'react';
import { usePersistFn, useDebounce } from '@svton/hooks';
import { NavBar, StatusBar } from '@svton/taro-ui';
import { useAPI } from '@/hooks/useAPI-v2';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 500);

  const { data, loading, refresh } = useAPI(
    'GET:/search',
    { keyword: debouncedKeyword },
    { immediate: false }
  );

  useEffect(() => {
    if (debouncedKeyword) {
      refresh({ keyword: debouncedKeyword });
    }
  }, [debouncedKeyword]);

  const handleInput = usePersistFn((e: any) => {
    setKeyword(e.detail.value);
  });

  return (
    <View className="search-page">
      <StatusBar />
      <NavBar title="搜索" />
      <Input
        value={keyword}
        onInput={handleInput}
        placeholder="输入关键词搜索"
      />
      {/* 搜索结果 */}
    </View>
  );
}
```

---

## 💻 在 Admin 中使用

```typescript
// apps/admin/src/components/SearchInput.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePersistFn, useDebounce } from '@svton/hooks';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  onSearch: (keyword: string) => void;
}

export function SearchInput({ onSearch }: SearchInputProps) {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 300);

  useEffect(() => {
    onSearch(debouncedKeyword);
  }, [debouncedKeyword, onSearch]);

  const handleChange = usePersistFn((e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
  });

  return (
    <Input
      value={keyword}
      onChange={handleChange}
      placeholder="搜索..."
    />
  );
}
```

---

## 🔧 实现原理

### usePersistFn 实现

```typescript
import { useRef, useCallback } from 'react';

export function usePersistFn<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef<T>(fn);
  
  // 每次渲染时更新 ref，保证获取最新的函数
  fnRef.current = fn;

  // 返回稳定的函数引用
  const persistFn = useCallback(
    ((...args) => fnRef.current(...args)) as T,
    []
  );

  return persistFn;
}
```

### useDebounce 实现

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

## ✅ 最佳实践

### 规范要求

```typescript
// ✅ 所有回调函数使用 usePersistFn
const handleClick = usePersistFn(() => { /* ... */ });
const handleChange = usePersistFn((value) => { /* ... */ });
const handleSubmit = usePersistFn(async () => { /* ... */ });

// ❌ 避免使用 useCallback
const handleClick = useCallback(() => { /* ... */ }, [dep1, dep2]);
```

### 代码审查检查清单

- [ ] 回调函数使用 `usePersistFn`
- [ ] 搜索场景使用 `useDebounce`
- [ ] 对象依赖使用 `useDeepCompareEffect`
- [ ] 高频更新使用 `useThrottle`

---

**相关文档**: [@svton/taro-ui](./taro-ui.md) | [编码规范](../tools/coding-standards.md)
