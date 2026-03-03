# TypeScript 类型系统指南

## 概述

`@svton/service` 提供完整的 TypeScript 类型支持，包括自动类型推断和 IDE 智能提示。所有属性都从 Service 类直接推断，支持 Go to Definition 跳转。

## 类型推断规则

### 1. Observable 属性（useState）

所有非函数属性会自动推断为 observable：

```typescript
@Service()
class UserService {
  @observable user: User | null = null;  // ✅ 自动推断
  @observable count = 0;                 // ✅ 自动推断为 number
  @observable items: string[] = [];      // ✅ 自动推断为 string[]
}

const service = useUserService();
const user = service.useState.user();     // User | null
const count = service.useState.count();   // number
const items = service.useState.items();   // string[]
```

### 2. Computed 属性（useDerived）

Computed 属性通过 getter 定义，类型从返回值推断：

```typescript
@Service()
class UserService {
  @observable count = 0;

  @computed
  get doubled() {
    return this.count * 2;  // 返回 number
  }

  @computed
  get isPositive() {
    return this.count > 0;  // 返回 boolean
  }
}

const service = useUserService();
// ✅ 直接调用，类型精确匹配
const doubled = service.useDerived.doubled();      // number
const isPositive = service.useDerived.isPositive(); // boolean
```

### 3. Action 方法（useAction）

所有方法会自动推断为 action：

```typescript
@Service()
class UserService {
  @action
  increment() {
    // void 返回
  }

  @action
  async login(username: string, password: string) {
    // Promise<void> 返回
  }

  @action
  setUser(user: User) {
    // 参数类型自动推断
  }
}

const service = useUserService();
const increment = service.useAction.increment();  // () => void
const login = service.useAction.login();          // (username: string, password: string) => Promise<void>
const setUser = service.useAction.setUser();      // (user: User) => void
```

## TypeScript 无法区分 @observable 和 @computed

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

```typescript
const service = useMyService();

// ❌ 运行时错误：Property "doubled" is not decorated with @observable
const wrong = service.useState.doubled();

// ✅ 正确
const correct = service.useDerived.doubled();
```

这是可接受的权衡，因为：
1. TypeScript 提供了基本的类型安全（属性存在性、类型匹配）
2. 运行时验证提供了额外的安全性
3. 错误信息清晰，易于调试

## Go to Definition 支持

### 问题：无法跳转到定义

如果你遇到以下问题：
1. `service.useState.xxx` 无法跳转到 Service 类的属性定义
2. `service.useDerived.xxx` 提示属性不存在
3. `service.useAction.xxx` 无法跳转到方法定义

### 解决方案

#### 1. 确保 tsconfig.json 配置正确

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

#### 2. 重新构建类型定义

```bash
cd packages/service
pnpm build
```

#### 3. 重启 IDE

有时 IDE 缓存会导致类型定义不更新：
- VS Code: `Cmd/Ctrl + Shift + P` → "Reload Window"
- WebStorm: `File` → `Invalidate Caches / Restart`

#### 4. 使用类型断言（临时方案）

如果仍然无法跳转，可以使用类型断言：

```typescript
const service = useUserService();
const count = (service.useState as any).count();  // 临时方案
```

## 类型安全最佳实践

### 1. 明确的类型注解

```typescript
// ✅ 推荐：明确类型
@observable user: User | null = null;

// ⚠️ 不推荐：依赖类型推断
@observable user = null;  // 类型为 null
```

### 2. 使用接口定义复杂类型

```typescript
interface UserState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

@Service()
class UserService implements UserState {
  @observable user: User | null = null;
  @observable loading = false;
  @observable error: Error | null = null;
}
```

### 3. Computed 属性的类型注解

```typescript
// ✅ 推荐：明确返回类型
@computed
get fullName(): string {
  return `${this.firstName} ${this.lastName}`;
}

// ⚠️ 可以但不推荐：依赖推断
@computed
get fullName() {
  return `${this.firstName} ${this.lastName}`;
}
```

### 4. Action 方法的类型注解

```typescript
// ✅ 推荐：明确参数和返回类型
@action
async fetchUser(id: number): Promise<void> {
  // ...
}

// ⚠️ 可以但不推荐：依赖推断
@action
async fetchUser(id) {
  // ...
}
```

## 高级类型技巧

### 1. 泛型 Service

```typescript
@Service()
class ListService<T> {
  @observable items: T[] = [];
  @observable loading = false;

  @computed
  get count(): number {
    return this.items.length;
  }

  @action
  add(item: T): void {
    this.items.push(item);
  }
}

// 使用时指定类型
const useUserListService = createService(ListService<User>);
```

### 2. 继承 Service

```typescript
@Service()
class BaseService {
  @observable loading = false;
  @observable error: Error | null = null;
}

@Service()
class UserService extends BaseService {
  @observable user: User | null = null;

  // 继承的属性也会被正确推断
}

const service = useUserService();
const loading = service.useState.loading();  // ✅ 继承的属性
const user = service.useState.user();        // ✅ 自己的属性
```

### 3. 依赖注入的类型推断

```typescript
@Service()
class AuthService {
  @observable token: string | null = null;
}

@Service()
class UserService {
  @Inject() private authService!: AuthService;

  @action
  async fetchUser() {
    // ✅ authService 类型自动推断
    const token = this.authService.token;
  }
}
```

## 常见问题

### Q: 为什么 `useDerived.xxx` 提示不存在？

A: 因为 computed 属性是运行时注册的，TypeScript 无法在编译时确定。使用 `?.()` 或 `!()` 调用。

### Q: 如何让 IDE 支持自动补全？

A: 确保：
1. 运行 `pnpm build` 生成类型定义
2. tsconfig.json 启用 `experimentalDecorators`
3. 重启 IDE

### Q: 类型定义文件在哪里？

A: 构建后在 `dist/index.d.ts` 和 `dist/index.d.mts`

### Q: 如何调试类型问题？

A: 使用 TypeScript 的类型检查工具：

```typescript
// 查看推断的类型
type StateType = ReturnType<typeof service.useState.count>;

// 使用 @ts-expect-error 测试
// @ts-expect-error - 应该报错
const wrong: string = service.useState.count();
```

## 总结

- `useState`: 自动推断所有非函数属性
- `useDerived`: 所有属性可选，使用 `?.()` 或 `!()`
- `useAction`: 自动推断所有方法
- 使用明确的类型注解提高代码可维护性
- 遇到问题时重新构建并重启 IDE
