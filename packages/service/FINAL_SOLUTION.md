# @svton/service 类型系统最终解决方案

## 需求回顾

1. ✅ 不使用 `?.()` 可选链 - 类型必须精确匹配
2. ✅ 当属性不存在时 TypeScript 报错
3. ✅ 支持 Go to Definition 跳转到原始定义
4. ✅ 不影响现有的正常功能和业务

## 解决方案

### 核心思路

使用映射类型从 Service 类直接推断所有属性，而不依赖运行时元数据：

```typescript
// 提取非函数属性
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

// 提取函数属性
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

// 状态 Hooks - 包含所有非函数属性
type StateHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// 计算属性 Hooks - 包含所有非函数属性
type DerivedHooks<T> = {
  [K in NonFunctionKeys<T>]: () => T[K];
};

// Action Hooks - 包含所有函数属性
type ActionHooks<T> = {
  [K in FunctionKeys<T>]: () => T[K];
};
```

### 关键特性

1. **完整的类型推断** - 所有属性都从 Service 类推断
2. **无需可选链** - 所有属性都是必需的
3. **Go to Definition** - 类型直接映射到原始类
4. **运行时验证** - 错误使用时抛出清晰的错误

## 使用示例

### 定义 Service

```typescript
@Service()
class UserService {
  @observable count = 0;
  @observable name = 'test';

  @computed
  get doubled() {
    return this.count * 2;
  }

  @computed
  get greeting() {
    return `Hello, ${this.name}`;
  }

  @action
  increment() {
    this.count++;
  }

  @action
  setName(name: string) {
    this.name = name;
  }
}
```

### 在组件中使用

```typescript
const useUserService = createService(UserService);

function MyComponent() {
  const service = useUserService();

  // ✅ 无需可选链，类型精确匹配
  const count = service.useState.count();           // number
  const name = service.useState.name();             // string
  const doubled = service.useDerived.doubled();     // number
  const greeting = service.useDerived.greeting();   // string
  const increment = service.useAction.increment();  // () => void
  const setName = service.useAction.setName();      // (name: string) => void

  return (
    <div>
      <p>{greeting}</p>
      <p>Count: {count}, Doubled: {doubled}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={() => setName('New Name')}>Change Name</button>
    </div>
  );
}
```

### TypeScript 类型检查

```typescript
// ✅ 类型正确
const count: number = service.useState.count();
const doubled: number = service.useDerived.doubled();

// ❌ TypeScript 报错 - 属性不存在
const nonExistent = service.useState.nonExistent();

// ❌ TypeScript 报错 - 类型不匹配
const wrongType: string = service.useState.count();
```

### Go to Definition

在 IDE 中：
- Cmd/Ctrl + Click 在 `count` 上 → 跳转到 `UserService.count`
- Cmd/Ctrl + Click 在 `doubled` 上 → 跳转到 `UserService.doubled`
- Cmd/Ctrl + Click 在 `increment` 上 → 跳转到 `UserService.increment`

### 运行时验证

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

// ❌ 运行时错误（清晰的错误提示）
const wrong = service.useState.doubled();
// Error: Property "doubled" is not decorated with @observable. 
// Did you mean to use useDerived.doubled()?

// ✅ 正确
const correct = service.useDerived.doubled();
```

## 技术实现

### 类型层面

所有属性都从 Service 类直接映射：
- `StateHooks<T>` 包含所有非函数属性
- `DerivedHooks<T>` 包含所有非函数属性
- `ActionHooks<T>` 包含所有函数属性

TypeScript 无法区分 `@observable` 和 `@computed`（它们在类型层面都是非函数属性），但这是可接受的权衡。

### 运行时层面

在创建 Hooks 时：
1. 遍历 Service 类的所有属性
2. 为每个属性创建 Hook 函数
3. 在 Hook 函数内部检查装饰器元数据
4. 如果装饰器不匹配，抛出清晰的错误

```typescript
function createStateHooks(internal, metadata) {
  const hooks = {};
  
  // 为所有非函数属性创建 Hook
  allNonFunctionKeys.forEach(key => {
    hooks[key] = () => {
      // 运行时检查
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

1. ✅ **类型安全** - TypeScript 检查属性存在性和类型匹配
2. ✅ **无需可选链** - 代码简洁，`service.useDerived.xxx()` 而不是 `service.useDerived.xxx?.()`
3. ✅ **Go to Definition** - 支持跳转到原始 Service 类
4. ✅ **清晰的错误** - 运行时错误告诉你应该使用哪个 Hook
5. ✅ **向后兼容** - 不影响装饰器 API 和现有业务逻辑

## 权衡

### TypeScript 无法区分 @observable 和 @computed

这是 TypeScript 类型系统的固有限制：

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
4. 开发体验更好（无需可选链）

## 测试验证

### 类型检查

```bash
pnpm type-check  # ✅ 通过
```

### 构建

```bash
pnpm build       # ✅ 成功
```

### 生成的类型定义

```typescript
// dist/index.d.ts
type StateHooks<T> = {
    [K in NonFunctionKeys<T>]: () => T[K];
};

type DerivedHooks<T> = {
    [K in NonFunctionKeys<T>]: () => T[K];
};

type ActionHooks<T> = {
    [K in FunctionKeys<T>]: () => T[K];
};

interface ServiceInstance<T> {
    useState: StateHooks<T>;
    useDerived: DerivedHooks<T>;
    useAction: ActionHooks<T>;
}
```

## 文档更新

- ✅ `README.md` - 更新使用示例，移除可选链
- ✅ `TYPESCRIPT_GUIDE.md` - 详细的类型系统指南
- ✅ `TYPE_SYSTEM_IMPROVEMENTS.md` - 技术实现说明
- ✅ `MIGRATION_GUIDE.md` - 迁移指南
- ✅ `docs/packages/service.md` - 官方文档更新

## 总结

新的类型系统完美满足了所有需求：

1. ✅ 不使用 `?.()` - 所有属性都是必需的
2. ✅ TypeScript 类型检查 - 属性不存在时报错
3. ✅ Go to Definition - 支持跳转到原始定义
4. ✅ 不影响现有功能 - 装饰器 API 和业务逻辑保持不变

这是一个平衡了 TypeScript 限制和开发体验的优雅解决方案。
