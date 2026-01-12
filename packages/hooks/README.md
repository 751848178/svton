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

### DOM/浏览器

#### useScroll

滚动位置监听。

```typescript
// 监听 window 滚动
const { x, y } = useScroll();

// 监听指定元素滚动
const ref = useRef<HTMLDivElement>(null);
const { x, y } = useScroll(ref);

// 显示返回顶部按钮
{y > 300 && <BackToTop />}
```

#### useIntersectionObserver

元素可见性检测（懒加载、曝光埋点）。

```typescript
const ref = useRef<HTMLDivElement>(null);
const entry = useIntersectionObserver(ref, { threshold: 0.5 });

useEffect(() => {
  if (entry?.isIntersecting) {
    trackExposure('banner');
  }
}, [entry?.isIntersecting]);
```

#### useTextSelection

获取用户选中的文本。

```typescript
const { text, rects } = useTextSelection();

// 显示选中文本的工具栏
{text && <Toolbar>复制 | 搜索</Toolbar>}
```

### 表单/组件

#### useControllableValue

受控/非受控组件值管理（组件库必备）。

```typescript
// 在组件内部使用
function Input(props: { value?: string; defaultValue?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useControllableValue(props);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}

// 非受控使用
<Input defaultValue="hello" />

// 受控使用
<Input value={value} onChange={setValue} />
```

#### useSelections

多选列表管理（全选、反选、部分选中）。

```typescript
const {
  selected,
  allSelected,
  partiallySelected,
  isSelected,
  toggle,
  toggleAll,
} = useSelections(list, []);

// 全选复选框
<Checkbox checked={allSelected} indeterminate={partiallySelected} onChange={toggleAll} />

// 列表项
{list.map(item => (
  <Checkbox checked={isSelected(item)} onChange={() => toggle(item)} />
))}
```

#### useUpdate

强制组件重新渲染。

```typescript
const update = useUpdate();
<button onClick={update}>刷新</button>
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
