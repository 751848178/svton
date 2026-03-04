# @svton/service

React 业务领域状态管理库，基于 Class + 装饰器模式。

## 特性

- 🎯 **业务内聚** - 一个 Service 管理一个业务领域
- 🔄 **双模式** - Scoped（独立实例）和 Provider（共享实例）
- 💉 **依赖注入** - Service 间自动注入
- 📝 **类型安全** - 完整的 TypeScript 支持
- ⚡ **精准更新** - 按属性订阅，避免无效渲染

## 安装

```bash
pnpm add @svton/service
```

## 快速开始

### 定义 Service

```typescript
import { Service, observable, computed, action } from '@svton/service';
import { api, apiAsync } from './lib/api-client';

@Service()
class OrderService {
  @observable orders: Order[] = [];
  @observable loading = false;
  @observable filters = { status: 'all', page: 1 };

  @computed get pendingOrders() {
    return this.orders.filter(o => o.status === 'pending');
  }

  @computed get pendingCount() {
    return this.pendingOrders.length;
  }

  // Generator 函数（推荐用于复杂流程）
  // 请求失败会静默停止执行，不会抛出错误，无需 try-catch
  @action
  *fetch() {
    this.loading = true;
    
    // 如果请求失败，会静默停止，不会执行后续代码
    // 也不会抛出错误，loading 会保持为 true
    const orders = yield* api('GET:/orders', this.filters);
    this.orders = orders;
    
    this.loading = false;
  }

  // Async 函数（简单场景）
  @action
  async setFilter(key: string, value: any) {
    this.filters = { ...this.filters, [key]: value };
    await this.fetch();
  }
}
```

### 创建 Hook 和 Provider

```typescript
import { createService, createServiceProvider } from '@svton/service';

// Scoped 模式（每次调用创建新实例）
export const useOrderService = createService(OrderService);

// Provider 模式（共享实例）
export const OrderProvider = createServiceProvider(OrderService);
```

### Scoped 模式使用

每个组件独立实例，互不影响：

```tsx
import { useApi } from '@svton/service';
import { apiAsync } from './lib/api-client';

function OrderPanel() {
  const service = useOrderService();

  const orders = service.useState.orders();
  const loading = service.useState.loading();
  const pendingCount = service.useDerived.pendingCount();

  const fetch = service.useAction.fetch();
  const setFilter = service.useAction.setFilter();

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      {loading ? <Spinner /> : <OrderList data={orders} />}
      <span>待处理: {pendingCount}</span>
    </div>
  );
}

// 或者使用 useApi Hook（推荐）
function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error } = useApi(
    (id: number) => apiAsync('GET:/users/:id', { id })
  );
  
  useEffect(() => {
    execute(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  if (!user) return null;
  
  return <div>{user.name}</div>;
}
```

### Provider 模式使用

子组件共享同一实例：

```tsx
// 组件模式
function App() {
  return (
    <OrderProvider>
      <OrderList />
      <OrderStats />
    </OrderProvider>
  );
}

function OrderList() {
  const service = OrderProvider.useService();
  const orders = service.useState.orders();
  return <List data={orders} />;
}

function OrderStats() {
  const service = OrderProvider.useService();
  const pendingCount = service.useDerived.pendingCount();
  return <Badge count={pendingCount} />;
}

// HOC 模式
const OrderPage = OrderProvider.provide(function OrderPage() {
  const service = OrderProvider.useService();
  const orders = service.useState.orders();
  return <div>{orders.length} orders</div>;
});
```

### 全局单例

Provider 放在应用最外层即可实现全局单例：

```tsx
function App() {
  return (
    <UserProvider>
      <OrderProvider>
        <Router />
      </OrderProvider>
    </UserProvider>
  );
}
```

### Provider 内使用 Scoped

两种模式可以混合使用：

```tsx
function OrderPage() {
  return (
    <OrderProvider>
      <SharedOrderList />
      {/* 独立实例，不受 Provider 影响 */}
      <IndependentPanel />
    </OrderProvider>
  );
}

function IndependentPanel() {
  const service = useOrderService(); // 创建独立实例
  // ...
}
```

## API

### 装饰器

| 装饰器 | 说明 |
|--------|------|
| `@Service()` | 标记类为 Service |
| `@observable` | 标记属性为响应式状态 |
| `@computed` | 标记 getter 为计算属性 |
| `@action` | 标记方法为 action，自动支持 async 和 generator 函数 |
| `@Inject()` | 注入其他 Service |

### @action 装饰器

`@action` 装饰器自动支持两种函数类型：

#### 1. Async 函数（简单场景）

```typescript
@action
async loadUser(id: number) {
  this.loading = true;
  const user = await apiAsync('GET:/users/:id', { id });
  this.user = user;
  this.loading = false;
}
```

#### 2. Generator 函数（复杂流程，推荐）

```typescript
@action
*loadUserData(id: number) {
  this.loading = true;
  
  // 请求失败会静默停止执行，不会抛出错误
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  
  // ✅ 只有上面成功，这里才会执行
  const posts = yield* api('GET:/users/:id/posts', { id });
  this.posts = posts;
  
  this.loading = false;
}
```

**Generator 函数的优势：**
- 请求失败静默停止后续执行（不抛出错误）
- 代码更简洁，无需手动检查每个请求结果
- 更好的可读性，接近同步代码风格
- 无需 try-catch，失败时自动停止

**注意：**
- Generator 函数中使用 `yield* api()`，不是 `await apiAsync()`
- 请求失败时会静默停止，不会抛出错误
- 如果需要在失败时执行清理代码，应该在调用 action 的地方处理
- 非特殊场景，action 中不应该有 try-catch

### 函数

| 函数 | 说明 |
|------|------|
| `createService(Class)` | 创建 Scoped Hook |
| `createServiceProvider(Class)` | 创建 Provider |
| `useApi(apiFn, options)` | 在组件中执行 API 请求（推荐） |
| `useApiOnMount(apiFn, args, options)` | 组件挂载时自动执行 API 请求 |

### useApi Hook

在组件中使用 API 请求的推荐方式，自动管理 loading、error 状态：

```typescript
import { useApi } from '@svton/service';
import { apiAsync } from './lib/api-client';

function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error, execute } = useApi(
    (id: number) => apiAsync('GET:/users/:id', { id }),
    {
      onSuccess: (user) => console.log('User loaded:', user),
      onError: (error) => console.error('Failed:', error),
    }
  );
  
  useEffect(() => {
    execute(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  if (!user) return null;
  
  return <div>{user.name}</div>;
}
```

### useApiOnMount Hook

组件挂载时自动执行 API 请求：

```typescript
function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error, refetch } = useApiOnMount(
    (id: number) => apiAsync('GET:/users/:id', { id }),
    [userId]
  );
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  if (!user) return null;
  
  return (
    <div>
      <div>{user.name}</div>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### Service 实例

```typescript
const service = useXxxService();
// 或
const service = XxxProvider.useService();

// 状态
service.useState.xxx()      // 返回状态值

// 计算属性
service.useDerived.xxx()    // 返回计算值

// 方法
service.useAction.xxx()     // 返回绑定的方法
```

### Provider

```typescript
const XxxProvider = createServiceProvider(XxxService);

// 组件模式
<XxxProvider>
  <Children />
</XxxProvider>

// HOC 模式
XxxProvider.provide(Component)

// 获取实例
XxxProvider.useService()
```

## 配置

需要在 `tsconfig.json` 中启用装饰器：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## 最佳实践

### 1. 使用 Generator 函数处理复杂流程

```typescript
// ✅ 推荐：使用 Generator 函数
@action
*loadUserProfile(userId: number) {
  this.loading = true;
  
  // 请求失败会自动停止
  const user = yield* api('GET:/users/:id', { id: userId });
  this.user = user;
  
  const posts = yield* api('GET:/users/:id/posts', { id: userId });
  this.posts = posts;
  
  this.loading = false;
}

// ❌ 不推荐：使用 async/await 需要手动检查
@action
async loadUserProfile(userId: number) {
  this.loading = true;
  
  try {
    const user = await apiAsync('GET:/users/:id', { id: userId });
    if (!user) throw new Error('User not found');
    this.user = user;
    
    const posts = await apiAsync('GET:/users/:id/posts', { id: userId });
    if (!posts) throw new Error('Posts not found');
    this.posts = posts;
  } catch (error) {
    this.error = error;
  } finally {
    this.loading = false;
  }
}
```

### 2. 在组件中使用 useApi Hook

```typescript
// ✅ 推荐：使用 useApi Hook
function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error, execute } = useApi(
    (id: number) => apiAsync('GET:/users/:id', { id })
  );
  
  useEffect(() => {
    execute(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  if (error) return <Error />;
  return <div>{user?.name}</div>;
}

// ❌ 不推荐：直接在组件中使用 apiAsync
function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    apiAsync('GET:/users/:id', { id: userId })
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);
  
  // ...
}
```

### 3. 避免在 action 中使用 try-catch

```typescript
// ✅ 推荐：让错误自然抛出
@action
*loadUser(id: number) {
  this.loading = true;
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  this.loading = false;
}

// 在调用处处理错误
async function handleLoadUser(id: number) {
  try {
    await service.loadUser(id);
  } catch (error) {
    console.error('Failed to load user:', error);
  }
}

// ❌ 不推荐：在 action 中使用 try-catch（除非有特殊需求）
@action
*loadUser(id: number) {
  this.loading = true;
  try {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  } catch (error) {
    this.error = error;
  } finally {
    this.loading = false;
  }
}
```

### 4. 必要时使用 await 等待请求

```typescript
// ✅ 如果必须在组件中直接使用 api，使用 await
async function handleSubmit() {
  try {
    const result = await apiAsync('POST:/users', { data: formData });
    console.log('Success:', result);
  } catch (error) {
    console.error('Failed:', error);
  }
}

// ❌ 不要不等待就继续执行
function handleSubmit() {
  apiAsync('POST:/users', { data: formData }); // 没有 await
  console.log('Submitted'); // 可能在请求完成前执行
}
```

## 禁止的写法

### ❌ 1. 不要在 Generator 函数中使用 await

```typescript
// ❌ 错误
@action
*loadUser(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  this.user = user;
}

// ✅ 正确
@action
*loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
}
```

### ❌ 2. 不要在 async 函数中使用 yield*

```typescript
// ❌ 错误
@action
async loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
}

// ✅ 正确
@action
async loadUser(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  this.user = user;
}
```

### ❌ 3. 不要直接在组件中使用 api/apiAsync（除非必要）

```typescript
// ❌ 不推荐
function UserList() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    apiAsync('GET:/users').then(setUsers);
  }, []);
  
  return <List data={users} />;
}

// ✅ 推荐：使用 useApi
function UserList() {
  const { data: users, loading } = useApiOnMount(
    () => apiAsync('GET:/users'),
    []
  );
  
  if (loading) return <Spinner />;
  return <List data={users} />;
}

// ✅ 或者使用 Service
function UserList() {
  const service = useUserService();
  const users = service.useState.users();
  const loading = service.useState.loading();
  const loadUsers = service.useAction.loadUsers();
  
  useEffect(() => { loadUsers(); }, []);
  
  if (loading) return <Spinner />;
  return <List data={users} />;
}
```

### ❌ 4. 不要在 action 中滥用 try-catch

```typescript
// ❌ 不推荐：每个请求都 try-catch
@action
*loadUserData(id: number) {
  try {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  } catch (error) {
    this.error = error;
  }
  
  try {
    const posts = yield* api('GET:/users/:id/posts', { id });
    this.posts = posts;
  } catch (error) {
    this.postsError = error;
  }
}

// ✅ 推荐：让错误自然抛出，在调用处统一处理
@action
*loadUserData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  
  const posts = yield* api('GET:/users/:id/posts', { id });
  this.posts = posts;
}
```

### ❌ 5. 不要使用可选链调用 Hook

```typescript
// ❌ 错误
const count = service.useState.count?.();

// ✅ 正确
const count = service.useState.count();
```

## TypeScript 类型推断

### 自动类型推断

`@svton/service` 提供完整的 TypeScript 类型支持：

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable loading = false;

  @computed
  get isLoggedIn() {
    return this.user !== null;
  }

  @action
  async login(username: string, password: string) {
    // ...
  }
}

const useUserService = createService(UserService);

function MyComponent() {
  const service = useUserService();

  // ✅ 类型自动推断
  const user = service.useState.user();        // User | null
  const loading = service.useState.loading();  // boolean
  const isLoggedIn = service.useDerived.isLoggedIn(); // boolean
  const login = service.useAction.login();     // (username: string, password: string) => Promise<void>
}
```

### Computed 属性类型

所有属性都从 Service 类直接推断，无需使用可选链：

```typescript
// ✅ 直接调用，无需可选链
const doubled = service.useDerived.doubled();

// ✅ 类型完全匹配
const doubled: number = service.useDerived.doubled();
```

**注意**: 虽然 TypeScript 无法区分 `@observable` 和 `@computed`（它们在类型层面都是非函数属性），但运行时会验证装饰器的正确使用。如果在错误的地方使用属性（如在 `useState` 中使用 `@computed` 属性），会抛出清晰的错误提示。

### Go to Definition 支持

由于 TypeScript 映射类型的限制，直接在 `service.useState.xxx()` 上使用 Go to Definition 会跳转到类型定义，而不是原始的 Service 类属性。这是 TypeScript 的固有限制，不是我们的实现问题。

**推荐的导航方式:**

1. **使用 VS Code 的 "Go To Source Definition"** (TypeScript 4.7+)
   - 右键点击属性 → 选择 "Go To Source Definition"
   - 或设置键盘快捷键 (见下文)

2. **使用 Find All References** (Shift + F12)
   - 查找所有使用该属性的地方

3. **通过 Service 实例类型跳转**
   ```typescript
   const service = useUserService();
   // 在 service 上 Cmd/Ctrl + Click 可以跳转到 UserService
   ```

4. **添加类型注解**
   ```typescript
   const service: ServiceInstance<UserService> = useUserService();
   // 现在可以在 UserService 上跳转
   ```

**设置 VS Code 快捷键:**
```json
// Command Palette → Preferences: Open Keyboard Shortcuts (JSON)
{
  "key": "cmd+click",  // 或 "ctrl+click" (Windows/Linux)
  "command": "editor.action.goToSourceDefinition",
  "when": "editorTextFocus"
}
```

**详细说明请参考:**
- [GO_TO_DEFINITION.md](./GO_TO_DEFINITION.md) - 问题说明和解决方案
- [COMMUNITY_SOLUTIONS.md](./COMMUNITY_SOLUTIONS.md) - 社区调研结果
- [TYPESCRIPT_GUIDE.md](./TYPESCRIPT_GUIDE.md) - 完整的 TypeScript 使用指南

## License

MIT
