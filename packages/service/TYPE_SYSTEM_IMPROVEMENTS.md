# @svton/service 类型系统改进 v2

## 问题描述

用户报告了两个 TypeScript 类型问题：

1. `service.useDerived.selectedSection` 提示"类型 'DerivedHooks<PageEditorService>' 上不存在属性 'selectedSection'"
2. `useAction`、`useState`、`useDerived` 无法跳转到定义的位置
3. 不应该使用 `?.()` 可选链，类型应该精确匹配

## 新的解决方案

### 核心思路

使用映射类型从 Service 类直接推断所有属性，而不是依赖运行时元数据：

```typescript
// 状态 Hooks - 包含所有非函数属性
type StateHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// 计算属性 Hooks - 包含所有非函数属性（getter 在类型层面是属性）
type DerivedHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// Action Hooks - 包含所有函数属性
type ActionHooks<T> = {
  [K in FunctionKeys<T>]: () => T[K];
};
```

### 关键特性

1. **完整的类型推断** - 所有属性都从 Service 类推断，TypeScript 能看到所有可能的属性
2. **无需可选链** - 所有属性都是必需的，不需要 `?.()` 
3. **Go to Definition 支持** - 类型直接映射到原始类，支持跳转到定义
4. **运行时验证** - 如果使用错误的 Hook（如在 `useState` 中使用 `@computed` 属性），运行时会抛出清晰的错误

## 使用方式

### 正确的用法

```typescript
@Service()
class UserService {
  @observable count = 0;
  
  @computed
  get doubled() {
    return this.count * 2;
  }
  
  @action
  increment() {
    this.count++;
  }
}

const service = useUserService();

// ✅ 正确 - 不需要可选链
const count = service.useState.count();
const doubled = service.useDerived.doubled();
const increment = service.useAction.increment();
```

### TypeScript 类型检查

```typescript
// ✅ 类型正确
const count: number = service.useState.count();
const doubled: number = service.useDerived.doubled();
const increment: () => void = service.useAction.increment();

// ❌ TypeScript 报错 - 属性不存在
const nonExistent = service.useState.nonExistent();

// ❌ TypeScript 报错 - 类型不匹配
const wrongType: string = service.useState.count();
```

### 运行时验证

虽然 TypeScript 无法区分 `@observable` 和 `@computed`（它们在类型层面都是非函数属性），但运行时会验证：

```typescript
@Service()
class MyService {
  @observable count = 0;
  
  @computed
  get doubled() {
    return this.count * 2;
  }
}

const service = useMyService();

// ❌ 运行时错误：Property "doubled" is not decorated with @observable
const wrong = service.useState.doubled();

// ✅ 正确
const correct = service.useDerived.doubled();
```

## 技术实现

### 类型定义

```typescript
// 提取非函数属性
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

// 提取函数属性
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

// 状态 Hooks
type StateHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// 计算属性 Hooks
type DerivedHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// Action Hooks
type ActionHooks<T> = {
  [K in FunctionKeys<T>]: () => T[K];
};
```

### 运行时实现

在创建 Hooks 时，为所有可能的属性创建 Hook 函数，并在调用时验证装饰器：

```typescript
function createStateHooks(internal, metadata) {
  const hooks = {};
  
  // 为所有非函数属性创建 Hook
  allNonFunctionKeys.forEach(key => {
    hooks[key] = () => {
      // 运行时检查是否有 @observable 装饰器
      if (!metadata.observables.has(key)) {
        throw new Error(
          `Property "${key}" is not decorated with @observable. ` +
          `Did you mean to use useDerived.${key}()?`
        );
      }
      // ... 实际的 Hook 逻辑
    };
  });
  
  return hooks;
}
```

## 优势

1. **类型安全** - TypeScript 能检查所有属性是否存在
2. **无需可选链** - 代码更简洁，`service.useDerived.xxx()` 而不是 `service.useDerived.xxx?.()`
3. **Go to Definition** - 支持跳转到原始 Service 类的定义
4. **清晰的错误提示** - 运行时错误会告诉你应该使用哪个 Hook
5. **向后兼容** - 不影响现有的装饰器 API

## 权衡

### TypeScript 无法区分 @observable 和 @computed

由于 getter 在类型层面看起来像普通属性，TypeScript 无法区分：

```typescript
@Service()
class MyService {
  @observable count = 0;  // 类型：number
  
  @computed
  get doubled() {          // 类型：number（看起来一样）
    return this.count * 2;
  }
}
```

因此：
- `useState` 和 `useDerived` 都包含所有非函数属性
- TypeScript 不会阻止你在错误的地方使用属性
- 但运行时会抛出清晰的错误

这是可接受的权衡，因为：
1. TypeScript 提供了基本的类型安全（属性存在性、类型匹配）
2. 运行时验证提供了额外的安全性
3. 错误信息清晰，易于调试

## 迁移指南

从 v0.3.x 迁移到 v0.4.0：

### 移除可选链

```typescript
// ❌ v0.3.x
const doubled = service.useDerived.doubled?.();

// ✅ v0.4.0
const doubled = service.useDerived.doubled();
```

### 批量替换

使用正则表达式：

```bash
# 查找：\.useDerived\.(\w+)\?\.\(\)
# 替换：.useDerived.$1()
```

## 测试

所有类型检查和构建通过：

```bash
pnpm type-check  # ✅ 通过
pnpm build       # ✅ 成功
```

## 总结

新的类型系统：
- ✅ 完整的类型推断
- ✅ 无需可选链
- ✅ 支持 Go to Definition
- ✅ 运行时验证
- ✅ 清晰的错误提示
- ✅ 向后兼容的 API

这是一个更好的解决方案，平衡了 TypeScript 的限制和实际的开发体验。

