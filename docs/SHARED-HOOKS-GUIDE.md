# 共享 Hooks 使用指南

## 📦 @svton/hooks 包

所有通用的 React Hooks 应该放在 `packages/hooks` 包中，而不是在各个业务项目中重复声明。

---

## 🎯 设计原则

### 什么应该放在 @svton/hooks？

**✅ 应该放入**：

- 与业务无关的通用 hooks
- 可以在多个项目中复用的 hooks
- 纯粹的 UI 逻辑或状态管理 hooks
- 工具类 hooks（防抖、节流等）

**❌ 不应该放入**：

- 与特定业务逻辑强耦合的 hooks
- 依赖特定项目配置的 hooks
- 与后端 API 直接相关的 hooks（如 useAPI）

### 示例对比

```typescript
// ✅ 应该放在 @svton/hooks
export function usePersistFn<T>(fn: T) {}
export function useDebounce<T>(value: T, delay: number) {}
export function useThrottle<T>(value: T, interval: number) {}
export function useDeepCompareEffect(effect: EffectCallback, deps: DependencyList) {}

// ❌ 应该放在业务项目中
export function useAPI(apiName, params) {} // 依赖项目的 API 配置
export function useAuth() {} // 依赖项目的认证逻辑
export function useUserProfile() {} // 特定业务逻辑
```

---

## 📚 现有 Hooks

### 1. usePersistFn

持久化函数引用，避免因函数引用变化导致的额外渲染。

```typescript
import { usePersistFn } from '@svton/hooks'

function Component() {
  const [count, setCount] = useState(0)

  // ✅ 函数引用永不改变，但能访问最新的 count
  const handleClick = usePersistFn(() => {
    console.log(count)
  })

  return <ChildComponent onClick={handleClick} />
}
```

**使用场景**：

- 传递给子组件的回调函数
- useEffect/useMemo/useCallback 的依赖函数
- 事件处理器
- 列表渲染中的函数

### 2. useDebounce

对值进行防抖处理，延迟更新。

```typescript
import { useDebounce } from '@svton/hooks'

function SearchComponent() {
  const [searchText, setSearchText] = useState('')

  // ✅ 输入停止 500ms 后才更新 debouncedText
  const debouncedText = useDebounce(searchText, 500)

  useEffect(() => {
    // 使用 debouncedText 进行搜索
    search(debouncedText)
  }, [debouncedText])

  return <Input value={searchText} onChange={setSearchText} />
}
```

**使用场景**：

- 搜索输入
- 自动保存
- 窗口大小调整
- 滚动事件处理

### 3. useThrottle

对值进行节流处理，限制更新频率。

```typescript
import { useThrottle } from '@svton/hooks'

function ScrollComponent() {
  const [scrollY, setScrollY] = useState(0)

  // ✅ 最多每 100ms 更新一次
  const throttledScrollY = useThrottle(scrollY, 100)

  return <div>{throttledScrollY}</div>
}
```

**使用场景**：

- 滚动位置追踪
- 拖拽操作
- 鼠标移动追踪
- 高频更新的数据

### 4. useDeepCompareEffect

使用深度比较的 useEffect，避免对象/数组引用变化导致的重复执行。

```typescript
import { useDeepCompareEffect } from '@svton/hooks';

function Component({ config }) {
  // ✅ 只有 config 的内容变化时才执行
  useDeepCompareEffect(() => {
    console.log('Config changed:', config);
  }, [config]);
}
```

**使用场景**：

- 依赖对象或数组的 effect
- 配置对象变化监听
- 复杂数据结构比较

### 5. useMemoizedFn

记忆化函数（类似 useCallback 但性能更好）。

```typescript
import { useMemoizedFn } from '@svton/hooks';

function Component() {
  const [count, setCount] = useState(0);

  // ✅ 性能优化的函数记忆化
  const handleClick = useMemoizedFn(() => {
    console.log(count);
  });
}
```

---

## 🚀 使用指南

### 1. 安装依赖

在业务项目的 `package.json` 中添加：

```json
{
  "dependencies": {
    "@svton/hooks": "workspace:*"
  }
}
```

然后运行：

```bash
pnpm install
```

### 2. 导入使用

```typescript
// ✅ 从 @svton/hooks 导入
import { usePersistFn, useDebounce, useThrottle } from '@svton/hooks';

// ❌ 不要从相对路径导入
import { usePersistFn } from '../../hooks/usePersistFn';
```

### 3. 类型支持

所有 hooks 都有完整的 TypeScript 类型定义：

```typescript
import { usePersistFn } from '@svton/hooks';

// ✅ 完整的类型推导
const handleClick = usePersistFn((id: number) => {
  console.log(id);
});

handleClick(123); // ✅ 类型正确
handleClick('123'); // ❌ 类型错误
```

---

## 📝 开发新 Hook

### 1. 创建 Hook 文件

在 `packages/hooks/src/` 下创建新文件：

```bash
packages/hooks/src/
├── index.ts
├── usePersistFn.ts
├── useDebounce.ts
└── useYourNewHook.ts  # 新增
```

### 2. 编写 Hook

```typescript
// packages/hooks/src/useYourNewHook.ts

/**
 * useYourNewHook
 * Hook 的详细说明
 *
 * @example
 * const result = useYourNewHook(param)
 */

import { useState, useEffect } from 'react';

export function useYourNewHook<T>(param: T) {
  const [state, setState] = useState<T>(param);

  useEffect(() => {
    // Hook 逻辑
  }, [param]);

  return state;
}
```

### 3. 导出 Hook

在 `packages/hooks/src/index.ts` 中导出：

```typescript
export * from './usePersistFn';
export * from './useDebounce';
export * from './useThrottle';
export * from './useYourNewHook'; // 新增
```

### 4. 构建包

```bash
cd packages/hooks
pnpm build
```

### 5. 在业务项目中使用

```typescript
import { useYourNewHook } from '@svton/hooks'

function Component() {
  const result = useYourNewHook(params)
  return <div>{result}</div>
}
```

---

## 🎓 最佳实践

### 1. 命名规范

```typescript
// ✅ 使用 use 前缀
export function usePersistFn() {}
export function useDebounce() {}

// ❌ 不使用 use 前缀
export function persistFn() {}
export function debounce() {}
```

### 2. 类型定义

```typescript
// ✅ 提供完整的泛型支持
export function useDebounce<T>(value: T, delay: number): T;

// ✅ 导出相关类型
export type DebounceOptions = {
  leading?: boolean;
  trailing?: boolean;
};
```

### 3. 文档注释

````typescript
/**
 * Hook 的简短描述
 *
 * @param param1 - 参数1的说明
 * @param param2 - 参数2的说明
 * @returns 返回值的说明
 *
 * @example
 * ```tsx
 * const result = useYourHook(param)
 * ```
 */
export function useYourHook(param1: string, param2: number) {}
````

### 4. 测试

为新 Hook 编写单元测试（推荐使用 `@testing-library/react-hooks`）：

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { usePersistFn } from './usePersistFn';

describe('usePersistFn', () => {
  it('should keep function reference stable', () => {
    const { result, rerender } = renderHook(({ fn }) => usePersistFn(fn), {
      initialProps: { fn: () => {} },
    });

    const fn1 = result.current;
    rerender({ fn: () => {} });
    const fn2 = result.current;

    expect(fn1).toBe(fn2); // 引用不变
  });
});
```

---

## 🔄 迁移指南

### 从业务项目迁移到共享包

**步骤**：

1. **识别通用 Hook**
   - 检查是否与业务逻辑解耦
   - 确认可以在多个项目中复用

2. **移动文件**

   ```bash
   # 从
   apps/mobile/src/hooks/usePersistFn.ts

   # 到
   packages/hooks/src/usePersistFn.ts
   ```

3. **更新导出**

   ```typescript
   // packages/hooks/src/index.ts
   export * from './usePersistFn';
   ```

4. **构建包**

   ```bash
   cd packages/hooks
   pnpm build
   ```

5. **更新导入**

   ```typescript
   // 所有业务项目中
   // 从
   import { usePersistFn } from '../../hooks/usePersistFn';

   // 改为
   import { usePersistFn } from '@svton/hooks';
   ```

6. **删除旧文件**
   ```bash
   rm apps/mobile/src/hooks/usePersistFn.ts
   ```

---

## 📊 架构优势

### 代码复用

**迁移前**：

```
apps/mobile/src/hooks/usePersistFn.ts      (100 行)
apps/admin/src/hooks/usePersistFn.ts       (100 行)
apps/website/src/hooks/usePersistFn.ts     (100 行)
总计: 300 行
```

**迁移后**：

```
packages/hooks/src/usePersistFn.ts         (100 行)
总计: 100 行
节省: 200 行 (67%)
```

### 统一维护

- ✅ 修复一次 bug，所有项目受益
- ✅ 添加新功能，所有项目可用
- ✅ 统一的代码风格和规范
- ✅ 集中的单元测试

### 版本管理

```json
{
  "name": "@svton/hooks",
  "version": "0.1.0"
}
```

可以独立发布和版本控制，业务项目可以选择使用特定版本。

---

## 🛠️ 包配置

### package.json

```json
{
  "name": "@svton/hooks",
  "version": "0.1.0",
  "description": "通用 React Hooks 集合",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  }
}
```

### 构建工具

使用 `tsup` 进行快速构建：

- ✅ 生成 CommonJS 格式 (`dist/index.js`)
- ✅ 生成 ESM 格式 (`dist/index.mjs`)
- ✅ 生成类型定义 (`dist/index.d.ts`)

---

## 📚 相关文档

- [性能优化指南](./PERFORMANCE-OPTIMIZATION.md) - usePersistFn 详细说明
- [TypeScript 最佳实践](./TYPESCRIPT-BEST-PRACTICES.md)
- [React Hooks 规范](./REACT-HOOKS-GUIDELINES.md)

---

## 🎯 总结

### 核心原则

1. **通用 > 特定**：通用 hooks 放共享包，特定 hooks 放业务项目
2. **复用 > 重复**：避免在多个项目中重复声明相同的 hook
3. **类型安全**：所有 hooks 必须有完整的 TypeScript 类型定义
4. **文档完善**：每个 hook 都应该有清晰的文档和示例

### 检查清单

添加新 Hook 时，确保：

- [ ] 是否真的是通用 hook？
- [ ] 是否与业务逻辑解耦？
- [ ] 是否有完整的 TypeScript 类型？
- [ ] 是否有文档注释和示例？
- [ ] 是否在 index.ts 中导出？
- [ ] 是否构建了包？
- [ ] 是否更新了相关文档？

---

**维护者**: 开发团队  
**最后更新**: 2025-11-22  
**版本**: v1.0
