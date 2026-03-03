# @svton/service v0.5.0 发布说明

## 📦 发布信息

- **包名**: @svton/service
- **版本**: 0.5.0
- **发布时间**: 2025-03-03
- **npm 链接**: https://www.npmjs.com/package/@svton/service
- **下载**: `npm install @svton/service@0.5.0` 或 `pnpm add @svton/service@0.5.0`

## 🎉 重大改进

### 类型系统重构

这是一个重大的类型系统改进版本，提供了更好的 TypeScript 支持和开发体验。

## ✨ 新特性

### 1. 无需可选链

所有属性都从 Service 类直接推断，不再需要使用 `?.()` 可选链：

```typescript
// ❌ v0.4.0 及之前
const doubled = service.useDerived.doubled?.();

// ✅ v0.5.0
const doubled = service.useDerived.doubled();
```

### 2. 完整的类型推断

TypeScript 能够检查所有属性的存在性和类型匹配：

```typescript
const service = useUserService();

// ✅ 类型正确
const count: number = service.useState.count();
const doubled: number = service.useDerived.doubled();

// ❌ TypeScript 报错 - 属性不存在
const nonExistent = service.useState.nonExistent();

// ❌ TypeScript 报错 - 类型不匹配
const wrongType: string = service.useState.count();
```

### 3. Go to Definition 支持

Cmd/Ctrl + Click 可以跳转到 Service 类的原始定义：

```typescript
const service = useUserService();

// 点击 count 跳转到 UserService.count
const count = service.useState.count();

// 点击 doubled 跳转到 UserService.doubled
const doubled = service.useDerived.doubled();

// 点击 increment 跳转到 UserService.increment
const increment = service.useAction.increment();
```

### 4. 运行时验证

错误使用时抛出清晰的错误提示：

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

## 🔧 技术实现

### 类型定义改进

- 重构 `StateHooks<T>` - 包含所有非函数属性
- 重构 `DerivedHooks<T>` - 包含所有非函数属性（getter 在类型层面是属性）
- 重构 `ActionHooks<T>` - 包含所有函数属性
- 添加运行时装饰器验证，提供清晰的错误提示

### 核心类型

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

## 📚 新增文档

- `TYPESCRIPT_GUIDE.md` - 详细的类型系统指南
- `TYPE_SYSTEM_IMPROVEMENTS.md` - 技术实现说明
- `MIGRATION_GUIDE.md` - 迁移指南
- `FINAL_SOLUTION.md` - 完整解决方案说明
- 更新 `README.md` - 更新使用示例

## 🔄 迁移指南

### 从 v0.4.0 迁移

如果之前的代码使用了 `?.()` 可选链，建议移除以获得更好的类型体验：

```typescript
// ❌ v0.4.0
const doubled = service.useDerived.doubled?.();
const items = service.useDerived.filteredItems?.() ?? [];

// ✅ v0.5.0
const doubled = service.useDerived.doubled();
const items = service.useDerived.filteredItems();
```

### 批量替换

使用正则表达式批量替换：

```bash
# 查找：\.useDerived\.(\w+)\?\.\(\)
# 替换：.useDerived.$1()
```

## ⚠️ 破坏性变更

**无破坏性变更**。如果之前的代码使用了 `?.()` 可选链，保留也能正常工作，但建议移除以获得更好的类型体验。

## 🎯 使用示例

```typescript
import { Service, observable, computed, action, createService } from '@svton/service';

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
      <h1>{greeting}</h1>
      <p>Count: {count}, Doubled: {doubled}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={() => setName('New Name')}>Change Name</button>
    </div>
  );
}
```

## 📊 包信息

- **大小**: 123.8 kB (unpacked)
- **依赖**: reflect-metadata ^0.2.1
- **Peer 依赖**: react ^18.0.0 || ^19.0.0
- **许可证**: MIT

## 🔗 相关链接

- [npm 包](https://www.npmjs.com/package/@svton/service)
- [GitHub 仓库](https://github.com/svton/svton)
- [文档](https://751848178.github.io/svton)
- [CHANGELOG](./CHANGELOG.md)

## 🙏 致谢

感谢所有使用和反馈的开发者！

---

**Happy Coding! 🎉**
