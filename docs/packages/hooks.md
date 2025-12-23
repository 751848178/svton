# @svton/hooks

React Hooks 集合，提供常用的工具 Hooks。

## 安装

```bash
npm install @svton/hooks
```

## Hooks 列表

### usePersistFn

持久化函数引用，替代 `useCallback`。

```typescript
import { usePersistFn } from '@svton/hooks'

function MyComponent() {
  const handleClick = usePersistFn((id: number) => {
    console.log('clicked', id)
  })

  return <button onClick={() => handleClick(1)}>Click</button>
}
```

### useBoolean

布尔值状态管理。

```typescript
import { useBoolean } from '@svton/hooks'

function MyComponent() {
  const [visible, { setTrue, setFalse, toggle }] = useBoolean(false)

  return (
    <div>
      <button onClick={setTrue}>显示</button>
      <button onClick={setFalse}>隐藏</button>
      <button onClick={toggle}>切换</button>
      {visible && <div>内容</div>}
    </div>
  )
}
```

### useToggle

切换状态管理。

```typescript
import { useToggle } from '@svton/hooks'

function MyComponent() {
  const [state, { toggle, setLeft, setRight }] = useToggle('left', 'right')

  return <div>{state}</div>
}
```

### useMount

组件挂载时执行。

```typescript
import { useMount } from '@svton/hooks'

function MyComponent() {
  useMount(() => {
    console.log('组件已挂载')
  })
}
```

### useUnmount

组件卸载时执行。

```typescript
import { useUnmount } from '@svton/hooks'

function MyComponent() {
  useUnmount(() => {
    console.log('组件将卸载')
  })
}
```

### useUpdateEffect

仅在依赖更新时执行（跳过首次渲染）。

```typescript
import { useUpdateEffect } from '@svton/hooks'

function MyComponent({ value }) {
  useUpdateEffect(() => {
    console.log('value 已更新:', value)
  }, [value])
}
```

### useDebounce

防抖值。

```typescript
import { useDebounce } from '@svton/hooks'

function SearchComponent() {
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 500)

  useEffect(() => {
    // 搜索请求
    search(debouncedKeyword)
  }, [debouncedKeyword])
}
```

### useThrottle

节流值。

```typescript
import { useThrottle } from '@svton/hooks'

function ScrollComponent() {
  const [scrollTop, setScrollTop] = useState(0)
  const throttledScrollTop = useThrottle(scrollTop, 200)
}
```

## 最佳实践

1. **优先使用 `usePersistFn`** 替代 `useCallback`
2. **使用 `useBoolean`** 管理简单的显示/隐藏状态
3. **使用 `useMount/useUnmount`** 替代 `useEffect` 的空依赖数组
4. **使用 `useDebounce`** 处理搜索输入等场景
