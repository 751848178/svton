# @action 装饰器完整指南

## 概述

`@action` 装饰器自动支持两种函数类型：
- **Async 函数**：适用于简单场景
- **Generator 函数**：适用于复杂流程，请求失败自动停止执行

## Async 函数

### 基础用法

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable loading = false;

  @action
  async loadUser(id: number) {
    this.loading = true;
    const user = await apiAsync('GET:/users/:id', { id });
    this.user = user;
    this.loading = false;
  }
}
```

### 适用场景

- 单个简单请求
- 不需要串行执行多个请求
- 需要手动控制错误处理

### 注意事项

- 需要手动检查每个请求的结果
- 需要手动处理 loading 状态
- 错误需要在调用处 catch

## Generator 函数（推荐）

### 基础用法

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable posts: Post[] = [];
  @observable loading = false;

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
    // 注意：如果上面的请求失败，这行不会执行，loading 会保持为 true
  }
}
```

### 优势

1. **静默停止**：请求失败时自动停止后续执行，不抛出错误
2. **代码简洁**：无需手动检查每个请求结果
3. **可读性好**：接近同步代码风格
4. **类型安全**：完整的 TypeScript 类型推断

### 重要说明

**请求失败时的行为：**
- Generator 函数会静默停止执行
- 不会抛出错误
- 失败后的代码不会执行
- 如果需要清理状态（如 loading），应该在调用处处理

**示例：**
```typescript
@action
*loadUser(id: number) {
  this.loading = true;
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  this.loading = false; // 如果请求失败，这行不会执行
}

// 在组件中调用
useEffect(() => {
  service.loadUser(userId).finally(() => {
    // 确保 loading 被重置
    service.loading = false;
  });
}, [userId]);
```

### 串行请求

```typescript
@action
*loadOrderDetails(orderId: number) {
  this.loading = true;
  
  // 1. 加载订单
  const order = yield* api('GET:/orders/:id', { id: orderId });
  this.order = order;
  
  // 2. 加载用户（只有订单加载成功才执行）
  const user = yield* api('GET:/users/:id', { id: order.userId });
  this.user = user;
  
  // 3. 加载产品（只有用户加载成功才执行）
  const products = yield* api('GET:/products', { 
    ids: order.productIds.join(',') 
  });
  this.products = products;
  
  this.loading = false;
}
```

### 并行请求

```typescript
@action
*loadDashboard() {
  this.loading = true;
  
  // 并行加载多个独立数据
  const [stats, orders, notifications] = yield Promise.all([
    api('GET:/stats'),
    api('GET:/orders/recent'),
    api('GET:/notifications'),
  ]);
  
  this.stats = stats;
  this.recentOrders = orders;
  this.notifications = notifications;
  
  this.loading = false;
}
```

### 条件请求

```typescript
@action
*loadContent(id: number) {
  const content = yield* api('GET:/contents/:id', { id });
  this.content = content;
  
  // 只有内容有标签时才加载相关内容
  if (content.tags && content.tags.length > 0) {
    const related = yield* api('GET:/contents/related', {
      tags: content.tags.join(','),
      exclude: id,
    });
    this.relatedContents = related;
  }
}
```

### 错误处理（特殊场景）

通常情况下，action 中不应该有 try-catch，让请求失败时静默停止即可。但在特殊场景下可以使用：

#### 场景 1：需要在失败时设置错误状态

```typescript
@action
*loadUser(id: number) {
  this.loading = true;
  this.error = null;
  
  const user = yield* api('GET:/users/:id', { id });
  
  // 如果请求失败，这里不会执行
  this.user = user;
  this.loading = false;
}

// 在调用处处理错误
service.loadUser(1).then(result => {
  if (!result) {
    // 请求失败
    service.error = '加载失败';
    service.loading = false;
  }
});
```

#### 场景 2：某个请求可以失败

如果某个请求失败不影响后续流程，可以使用 apiAsync + try-catch：

```typescript
@action
*loadProfile(id: number) {
  this.loading = true;
  
  // 必须成功的请求
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  
  // 可以失败的请求（使用 apiAsync）
  try {
    const avatar = await apiAsync('GET:/users/:id/avatar', { id });
    this.avatar = avatar;
  } catch (error) {
    // 使用默认头像
    this.avatar = '/default-avatar.png';
  }
  
  this.loading = false;
}
```

#### 场景 3：需要记录错误但不影响流程

```typescript
@action
*loadData(id: number) {
  const data = yield* api('GET:/data/:id', { id });
  this.data = data;
  
  // 记录访问日志（失败不影响主流程）
  try {
    await apiAsync('POST:/logs', { 
      data: { action: 'view', dataId: id } 
    });
  } catch (error) {
    console.warn('Failed to log:', error);
  }
}
```

## 在组件中使用

### 使用 Service Action

```typescript
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  
  const user = service.useState.user();
  const loading = service.useState.loading();
  
  const loadUserData = service.useAction.loadUserData();
  
  useEffect(() => {
    loadUserData(userId).catch(error => {
      console.error('Failed to load user:', error);
    });
  }, [userId]);
  
  if (loading) return <Spinner />;
  if (!user) return null;
  
  return <div>{user.name}</div>;
}
```

### 使用 useApi Hook（推荐）

```typescript
import { useApi } from '@svton/service';
import { apiAsync } from './lib/api-client';

function UserProfile({ userId }: { userId: number }) {
  const { data: user, loading, error, execute } = useApi(
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

### 使用 useApiOnMount Hook

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

## 最佳实践

### 1. 优先使用 Generator 函数

```typescript
// ✅ 推荐
@action
*loadUserData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  const posts = yield* api('GET:/users/:id/posts', { id });
  return { user, posts };
}

// ❌ 不推荐（除非是简单场景）
@action
async loadUserData(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  const posts = await apiAsync('GET:/users/:id/posts', { id });
  return { user, posts };
}
```

### 2. 避免在 action 中使用 try-catch

```typescript
// ✅ 推荐：让请求失败时静默停止
@action
*loadUser(id: number) {
  this.loading = true;
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  this.loading = false;
}

// 在调用处处理失败情况
service.loadUser(1).then(result => {
  if (!result) {
    // 请求失败
    service.loading = false;
    service.error = '加载失败';
  }
});

// ❌ 不推荐（除非有特殊需求）
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

### 3. 在组件中使用 useApi Hook

```typescript
// ✅ 推荐
function UserList() {
  const { data: users, loading } = useApiOnMount(
    () => apiAsync('GET:/users'),
    []
  );
  
  if (loading) return <Spinner />;
  return <List data={users} />;
}

// ❌ 不推荐
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    apiAsync('GET:/users')
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <Spinner />;
  return <List data={users} />;
}
```

### 4. 必要时使用 await

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

### ❌ 1. 不要在 Generator 中使用 await

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

### ❌ 2. 不要在 async 中使用 yield*

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

### ❌ 3. 不要直接在组件中使用 api/apiAsync

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
  const { data: users } = useApiOnMount(
    () => apiAsync('GET:/users'),
    []
  );
  
  return <List data={users} />;
}
```

### ❌ 4. 不要滥用 try-catch

```typescript
// ❌ 不推荐
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

// ✅ 推荐
@action
*loadUserData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  
  const posts = yield* api('GET:/users/:id/posts', { id });
  this.posts = posts;
}
```

## 常见问题

### Q: 什么时候使用 async，什么时候使用 generator？

A: 
- **简单场景**（单个请求）：使用 async
- **复杂流程**（多个串行请求）：使用 generator（推荐）

### Q: Generator 函数的性能如何？

A: Generator 的性能开销非常小（< 1%），在实际应用中可以忽略不计。

### Q: 为什么不在 action 中使用 try-catch？

A: 
- Generator 函数的优势就是请求失败时静默停止
- 不需要在每个 action 中重复写 try-catch
- 失败处理应该在调用处统一处理
- 如果每个请求都 try-catch，就失去了 Generator 的意义

### Q: 请求失败后如何清理状态（如 loading）？

A: 在调用 action 的地方使用 finally：

```typescript
service.loadUser(1).finally(() => {
  service.loading = false;
});
```

或者使用 useApi Hook，它会自动管理状态：

```typescript
const { data, loading } = useApi(
  (id: number) => service.loadUser(id)
);
```

### Q: 如何知道请求是否失败？

A: Generator action 返回 undefined 表示失败：

```typescript
const result = await service.loadUser(1);
if (!result) {
  // 请求失败
  console.error('Failed to load user');
}
```

### Q: 什么时候可以在 action 中使用 try-catch？

A: 只在特殊场景下使用，比如：
- 某个请求可以失败，需要使用默认值
- 需要记录错误日志但不影响后续执行

### Q: 为什么不直接在组件中使用 api/apiAsync？

A: 
- 难以管理 loading、error 状态
- 代码重复
- 不利于测试
- 推荐使用 useApi Hook 或 Service

## 总结

- ✅ 优先使用 Generator 函数处理复杂流程
- ✅ 在组件中使用 useApi Hook
- ✅ 让错误自然抛出，在调用处统一处理
- ✅ 必要时使用 await 等待请求
- ❌ 不要在 Generator 中使用 await
- ❌ 不要在 async 中使用 yield*
- ❌ 不要直接在组件中使用 api/apiAsync
- ❌ 不要滥用 try-catch
