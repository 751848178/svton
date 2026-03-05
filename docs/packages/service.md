# @svton/service

> React 服务层状态管理 - 基于装饰器的类式状态管理

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/service` |
| **版本** | `0.6.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **类式编程** - 使用类和装饰器定义状态逻辑
2. **自动响应** - 状态变化自动触发组件更新
3. **依赖注入** - 支持 Service 之间的依赖注入
4. **静默中止** - Generator 函数支持 API 失败时的静默停止
5. **自动 Loading** - `withLoading()` 方法自动管理 action 的 loading 状态

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/service
```

### 定义 Service

```typescript
import { Service, observable, computed, action } from '@svton/service';

@Service()
class CounterService {
  @observable
  count = 0;

  @computed
  get doubled() {
    return this.count * 2;
  }

  @action
  increment() {
    this.count++;
  }

  @action
  decrement() {
    this.count--;
  }

  @action
  reset() {
    this.count = 0;
  }
}
```

### 在组件中使用

```tsx
import { createService } from '@svton/service';

const useCounterService = createService(CounterService);

function Counter() {
  const counter = useCounterService();
  
  // 使用状态 Hook
  const count = counter.useState.count();
  const doubled = counter.useDerived.doubled();
  
  // 使用 Action Hook
  const increment = counter.useAction.increment();
  const decrement = counter.useAction.decrement();

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

---

## 🔧 装饰器

### @Service

标记一个类为 Service：

```typescript
import { Service } from '@svton/service';

@Service()
class UserService {
  // ...
}

// 带选项
@Service({ name: 'user' })
class UserService {
  // ...
}
```

### @observable

标记属性为响应式状态：

```typescript
@Service()
class TodoService {
  @observable
  todos: Todo[] = [];

  @observable
  filter: 'all' | 'active' | 'completed' = 'all';

  @observable
  loading = false;
}
```

### @computed

标记 getter 为计算属性：

```typescript
@Service()
class TodoService {
  @observable
  todos: Todo[] = [];

  @observable
  filter: 'all' | 'active' | 'completed' = 'all';

  @computed
  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(t => !t.completed);
      case 'completed':
        return this.todos.filter(t => t.completed);
      default:
        return this.todos;
    }
  }

  @computed
  get activeCount() {
    return this.todos.filter(t => !t.completed).length;
  }

  @computed
  get completedCount() {
    return this.todos.filter(t => t.completed).length;
  }
}
```

### @action

标记方法为 action：

```typescript
@Service()
class TodoService {
  @observable
  todos: Todo[] = [];

  @action
  addTodo(text: string) {
    this.todos.push({
      id: Date.now(),
      text,
      completed: false,
    });
  }

  @action
  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  @action
  removeTodo(id: number) {
    this.todos = this.todos.filter(t => t.id !== id);
  }

  @action
  async fetchTodos() {
    this.loading = true;
    try {
      const response = await fetch('/api/todos');
      this.todos = await response.json();
    } finally {
      this.loading = false;
    }
  }

  // Generator 函数：请求失败时静默停止
  @action
  *loadUserData(id: number) {
    // 如果请求失败，会静默停止，不会执行后续代码
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;

    // 只有上面成功，这里才会执行
    const posts = yield* api('GET:/users/:id/posts', { id });
    this.posts = posts;
  }
}
```

**Generator 函数静默中止机制：**

在 Generator action 中使用 `yield* api()`，当请求失败时会自动停止执行，不会抛出错误。这简化了错误处理流程。

使用 `catchError` 可以捕获个别错误，不中止整个流程：

```typescript
import { catchError } from '@svton/api-client';

@action
*loadData(id: number) {
  // 这个请求必须成功，否则整个流程中止
  const user = yield* api('GET:/users/:id', { id });
  this.data = user;

  // 这个请求可以失败，不会中止整个流程
  const result = yield* catchError(api('GET:/users/:id/avatar', { id }));

  if (result.error) {
    // 使用默认头像
    this.data = { ...user, avatar: '/default.png' };
  } else {
    this.data = { ...user, avatar: result.data };
  }
}
```

### @Inject

注入其他 Service：

```typescript
@Service()
class AuthService {
  @observable
  user: User | null = null;

  @observable
  token: string | null = null;

  @action
  login(user: User, token: string) {
    this.user = user;
    this.token = token;
  }

  @action
  logout() {
    this.user = null;
    this.token = null;
  }
}

@Service()
class UserService {
  @Inject()
  private authService!: AuthService;

  @computed
  get currentUser() {
    return this.authService.user;
  }

  @computed
  get isLoggedIn() {
    return !!this.authService.user;
  }
}
```

---

## 📋 Hooks API

### useState

订阅 @observable 属性：

```typescript
const counter = useCounterService();

// 订阅单个状态
const count = counter.useState.count();

// 状态变化时组件自动更新
```

### useDerived

订阅 @computed 属性：

```typescript
const counter = useCounterService();

// 订阅计算属性
const doubled = counter.useDerived.doubled();

// 依赖的 observable 变化时自动重新计算
```

### useAction

获取 @action 方法：

```typescript
const counter = useCounterService();

// 获取 action 方法
const increment = counter.useAction.increment();
const decrement = counter.useAction.decrement();

// 调用 action
<button onClick={increment}>+</button>
<button onClick={() => decrement()}>-</button>
```

### 自动 Loading 状态

使用 `withLoading()` 自动管理 action 的 loading 状态：

```typescript
@Service()
class TodoService {
  @observable
  todos: Todo[] = [];

  @action
  async addTodo(text: string) {
    await api.post('/todos', { text });
  }
}

function TodoForm() {
  const todo = useTodoService();

  // 带 loading 状态
  const [addTodo, loading] = todo.useAction.addTodo.withLoading();

  return (
    <form onSubmit={() => addTodo('new item')}>
      <button type="submit" disabled={loading}>
        {loading ? '添加中...' : '添加'}
      </button>
    </form>
  );
}
```

### withLoading() 工作原理

1. 自动在 action 执行开始时设置 `loading = true`
2. action 完成或失败后设置 `loading = false`
3. 返回 tuple: `[action, loading]`

---

## 🔌 Provider 模式

### 创建 Provider

```typescript
import { createServiceProvider } from '@svton/service';

const { Provider, useService } = createServiceProvider(CounterService);

// 在应用根组件使用 Provider
function App() {
  return (
    <Provider>
      <Counter />
    </Provider>
  );
}

// 在子组件中使用
function Counter() {
  const counter = useService();
  const count = counter.useState.count();
  // ...
}
```

### 多个 Service

```typescript
const { Provider: AuthProvider, useService: useAuth } = createServiceProvider(AuthService);
const { Provider: TodoProvider, useService: useTodo } = createServiceProvider(TodoService);

function App() {
  return (
    <AuthProvider>
      <TodoProvider>
        <Main />
      </TodoProvider>
    </AuthProvider>
  );
}
```

---

## 📋 完整示例

### Todo 应用

```typescript
// services/todo.service.ts
import { Service, observable, computed, action, Inject } from '@svton/service';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

@Service()
export class TodoService {
  @observable
  todos: Todo[] = [];

  @observable
  filter: 'all' | 'active' | 'completed' = 'all';

  @observable
  loading = false;

  @computed
  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(t => !t.completed);
      case 'completed':
        return this.todos.filter(t => t.completed);
      default:
        return this.todos;
    }
  }

  @computed
  get stats() {
    return {
      total: this.todos.length,
      active: this.todos.filter(t => !t.completed).length,
      completed: this.todos.filter(t => t.completed).length,
    };
  }

  @action
  addTodo(text: string) {
    this.todos.push({
      id: Date.now(),
      text,
      completed: false,
    });
  }

  @action
  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  @action
  removeTodo(id: number) {
    this.todos = this.todos.filter(t => t.id !== id);
  }

  @action
  setFilter(filter: 'all' | 'active' | 'completed') {
    this.filter = filter;
  }

  @action
  clearCompleted() {
    this.todos = this.todos.filter(t => !t.completed);
  }
}
```

```tsx
// components/TodoApp.tsx
import { createService } from '@svton/service';
import { TodoService } from '../services/todo.service';

const useTodoService = createService(TodoService);

export function TodoApp() {
  const todo = useTodoService();
  
  const todos = todo.useDerived.filteredTodos();
  const stats = todo.useDerived.stats();
  const filter = todo.useState.filter();
  
  const addTodo = todo.useAction.addTodo();
  const toggleTodo = todo.useAction.toggleTodo();
  const removeTodo = todo.useAction.removeTodo();
  const setFilter = todo.useAction.setFilter();
  const clearCompleted = todo.useAction.clearCompleted();

  const [text, setText] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      addTodo(text.trim());
      setText('');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What needs to be done?"
        />
      </form>

      <ul>
        {todos.map(item => (
          <li key={item.id}>
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleTodo(item.id)}
            />
            <span style={{ textDecoration: item.completed ? 'line-through' : 'none' }}>
              {item.text}
            </span>
            <button onClick={() => removeTodo(item.id)}>×</button>
          </li>
        ))}
      </ul>

      <footer>
        <span>{stats.active} items left</span>
        <div>
          <button onClick={() => setFilter('all')} disabled={filter === 'all'}>All</button>
          <button onClick={() => setFilter('active')} disabled={filter === 'active'}>Active</button>
          <button onClick={() => setFilter('completed')} disabled={filter === 'completed'}>Completed</button>
        </div>
        {stats.completed > 0 && (
          <button onClick={clearCompleted}>Clear completed</button>
        )}
      </footer>
    </div>
  );
}
```

---

## 📘 TypeScript 类型系统

### 自动类型推断

`@svton/service` 提供完整的 TypeScript 类型支持，所有属性都从 Service 类直接推断：

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

  // ✅ 类型自动推断，无需可选链
  const user = service.useState.user();        // User | null
  const loading = service.useState.loading();  // boolean
  const isLoggedIn = service.useDerived.isLoggedIn(); // boolean
  const login = service.useAction.login();     // (username: string, password: string) => Promise<void>
}
```

### Go to Definition 支持

所有属性都支持 Go to Definition（Cmd/Ctrl + Click）跳转到原始 Service 类的定义。

### 运行时验证

虽然 TypeScript 无法区分 `@observable` 和 `@computed`（它们在类型层面都是非函数属性），但运行时会验证装饰器的正确使用：

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

### 配置要求

需要在 `tsconfig.json` 中启用装饰器：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## ✅ 最佳实践

1. **单一职责**
   ```typescript
   // ✅ 每个 Service 负责一个领域
   @Service() class AuthService { /* 认证相关 */ }
   @Service() class UserService { /* 用户相关 */ }
   @Service() class CartService { /* 购物车相关 */ }
   ```

2. **使用 computed 缓存计算**
   ```typescript
   // ✅ 使用 computed
   @computed
   get filteredItems() {
     return this.items.filter(/* ... */);
   }
   
   // ❌ 避免在组件中重复计算
   const filtered = items.filter(/* ... */);
   ```

3. **异步操作在 action 中处理**
   ```typescript
   @action
   async fetchData() {
     this.loading = true;
     try {
       this.data = await api.getData();
     } catch (error) {
       this.error = error;
     } finally {
       this.loading = false;
     }
   }
   ```

4. **合理使用依赖注入**
   ```typescript
   @Service()
   class OrderService {
     @Inject() private authService!: AuthService;
     @Inject() private cartService!: CartService;
     
     @action
     async createOrder() {
       const user = this.authService.user;
       const items = this.cartService.items;
       // ...
     }
   }
   ```

---

**相关文档**: [@svton/hooks](./hooks.md) | [@svton/logger](./logger.md)
