# @svton/hooks

通用 React Hooks 集合

## 安装

```bash
pnpm add @svton/hooks
```

## Hooks 列表

### usePersistFn

持久化函数引用，避免因函数引用变化导致的额外渲染。

```typescript
import { usePersistFn } from '@svton/hooks';

const handleClick = usePersistFn((val) => {
  console.log(val);
});
// handleClick 的引用永远不会改变
```

### useDeepCompareEffect

深度比较依赖项的 useEffect。

```typescript
import { useDeepCompareEffect } from '@svton/hooks';

useDeepCompareEffect(() => {
  // 只有当 params 对象的值真正改变时才会执行
  fetchData(params);
}, [params]);
```

### useDebounce

防抖 Hook。

```typescript
import { useDebounce } from '@svton/hooks';

const debouncedSearchValue = useDebounce(searchValue, 500);

useEffect(() => {
  fetchData(debouncedSearchValue);
}, [debouncedSearchValue]);
```

### useThrottle

节流 Hook。

```typescript
import { useThrottle } from '@svton/hooks';

const throttledScrollPosition = useThrottle(scrollPosition, 100);
```

### useMemoizedFn

usePersistFn 的语义化别名。

```typescript
import { useMemoizedFn } from '@svton/hooks';

const handleSubmit = useMemoizedFn(async (data) => {
  await api.post('/data', data);
});
```

## License

MIT
