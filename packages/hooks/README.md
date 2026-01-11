# @svton/hooks

通用 React Hooks 集合

## 安装

```bash
pnpm add @svton/hooks
```

## Hooks 列表

### 函数优化

#### usePersistFn / useMemoizedFn

持久化函数引用，避免因函数引用变化导致的额外渲染。

```typescript
const handleClick = usePersistFn((val) => {
  console.log(val);
});
// handleClick 的引用永远不会改变
```

#### useLockFn

防止异步函数重复执行（防重复提交）。

```typescript
const submit = useLockFn(async () => {
  await api.post('/submit', data);
});
// 连续点击只会执行一次，直到上一次执行完成
```

#### useDebounceFn

防抖函数。

```typescript
const { run, cancel, flush } = useDebounceFn(
  (value: string) => console.log(value),
  { wait: 500 }
);
```

#### useThrottleFn

节流函数。

```typescript
const { run, cancel } = useThrottleFn(
  (value: string) => console.log(value),
  { wait: 500 }
);
```

### 状态管理

#### useBoolean

布尔值状态管理。

```typescript
const [visible, { toggle, setTrue, setFalse }] = useBoolean(false);
```

#### useToggle

在两个值之间切换。

```typescript
const [state, { toggle, setLeft, setRight }] = useToggle('ON', 'OFF');
```

#### useSetState

类似 class 组件的 setState，支持对象合并。

```typescript
const [state, setState] = useSetState({ name: '', age: 0 });
setState({ name: 'John' }); // { name: 'John', age: 0 }
```

#### usePrevious

获取上一次渲染时的值。

```typescript
const [count, setCount] = useState(0);
const prevCount = usePrevious(count);
```

#### useLatest

返回当前最新值的 ref，避免闭包陷阱。

```typescript
const latestCount = useLatest(count);
// latestCount.current 始终是最新值
```

### 值处理

#### useDebounce

防抖值。

```typescript
const debouncedValue = useDebounce(searchValue, 500);
```

#### useThrottle

节流值。

```typescript
const throttledValue = useThrottle(scrollPosition, 100);
```

### 生命周期

#### useMount

组件挂载时执行。

```typescript
useMount(() => {
  console.log('mounted');
});
```

#### useUnmount

组件卸载时执行。

```typescript
useUnmount(() => {
  console.log('unmounted');
});
```

#### useUpdateEffect

忽略首次渲染的 useEffect。

```typescript
useUpdateEffect(() => {
  console.log('只在 count 更新时执行');
}, [count]);
```

#### useDeepCompareEffect

深度比较依赖项的 useEffect。

```typescript
useDeepCompareEffect(() => {
  fetchData(params);
}, [params]);
```

### 定时器

#### useInterval

setInterval 封装。

```typescript
useInterval(() => {
  setCount(c => c + 1);
}, 1000);

// 传入 null 暂停
useInterval(callback, isRunning ? 1000 : null);
```

#### useTimeout

setTimeout 封装。

```typescript
useTimeout(() => {
  setVisible(false);
}, 3000);
```

#### useCountdown

倒计时（验证码场景常用）。

```typescript
const { count, counting, start, reset } = useCountdown(60);

<button onClick={() => start()} disabled={counting}>
  {counting ? `${count}s 后重新获取` : '获取验证码'}
</button>
```

### 存储

#### useLocalStorage

localStorage 持久化状态。

```typescript
const [token, setToken, removeToken] = useLocalStorage<string>('auth_token');
```

#### useSessionStorage

sessionStorage 持久化状态。

```typescript
const [data, setData, removeData] = useSessionStorage<object>('form_data');
```

### 请求相关

#### useRequestState

请求状态管理。

```typescript
const { isLoading, isError, isEmpty, errorMessage } = useRequestState({
  data,
  loading,
  error,
});
```

#### usePagination

分页数据加载。

```typescript
const { data, loading, hasMore, loadMore, refresh } = usePagination(
  (params) => api.getList(params),
  { pageSize: 20 }
);
```

## License

MIT
