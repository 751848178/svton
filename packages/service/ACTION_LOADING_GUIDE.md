# Action 自动 Loading 状态管理

## 概述

`@svton/service` 现在支持自动管理 action 的 loading 状态，无需手动在 Service 中定义 loading 属性。

## 使用方式

### 方式一：基础用法（不带 loading）

```typescript
@Service()
class UserService {
  @observable user: User | null = null;

  @action
  *loadUser(id: number) {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }
}

// 在组件中使用
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  const loadUser = service.useAction.loadUser();
  
  useEffect(() => {
    loadUser(userId);
  }, [userId]);
  
  return <div>{user?.name}</div>;
}
```

### 方式二：自动 loading 状态（推荐）

```typescript
@Service()
class UserService {
  @observable user: User | null = null;

  @action
  *loadUser(id: number) {
    // 无需手动管理 loading
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }
}

// 在组件中使用 withLoading()
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  
  // 使用 withLoading() 获取 action 和 loading 状态
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  
  useEffect(() => {
    loadUser(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

## 核心特性

### 1. 自动管理 loading 状态

```typescript
@Service()
class PostService {
  @observable posts: Post[] = [];

  @action
  *loadPosts() {
    const posts = yield* api('GET:/posts');
    this.posts = posts;
  }
}

function PostList() {
  const service = usePostService();
  const posts = service.useState.posts();
  const [loadPosts, loading] = service.useAction.loadPosts.withLoading();
  
  useEffect(() => {
    loadPosts();
  }, []);
  
  if (loading) return <LoadingState />;
  if (posts.length === 0) return <EmptyState />;
  
  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### 2. 防止重复执行

loading 状态会自动防止 action 重复执行：

```typescript
function UserProfile() {
  const service = useUserService();
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  
  const handleRefresh = () => {
    // 如果正在加载，不会重复执行
    loadUser(userId);
  };
  
  return (
    <div>
      <button onClick={handleRefresh} disabled={loading}>
        {loading ? '加载中...' : '刷新'}
      </button>
    </div>
  );
}
```

### 3. 支持多个 action

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable posts: Post[] = [];

  @action
  *loadUser(id: number) {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }

  @action
  *loadPosts(userId: number) {
    const posts = yield* api('GET:/users/:id/posts', { id: userId });
    this.posts = posts;
  }
}

function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  const posts = service.useState.posts();
  
  // 每个 action 都有独立的 loading 状态
  const [loadUser, userLoading] = service.useAction.loadUser.withLoading();
  const [loadPosts, postsLoading] = service.useAction.loadPosts.withLoading();
  
  useEffect(() => {
    loadUser(userId);
    loadPosts(userId);
  }, [userId]);
  
  if (userLoading) return <Spinner />;
  
  return (
    <div>
      <UserCard user={user} />
      {postsLoading ? (
        <Spinner />
      ) : (
        <PostList posts={posts} />
      )}
    </div>
  );
}
```

### 4. 串行请求的 loading

```typescript
@Service()
class OrderService {
  @observable order: Order | null = null;
  @observable user: User | null = null;
  @observable products: Product[] = [];

  @action
  *loadOrderDetails(orderId: number) {
    // 串行请求，整个过程只有一个 loading 状态
    const order = yield* api('GET:/orders/:id', { id: orderId });
    this.order = order;
    
    const user = yield* api('GET:/users/:id', { id: order.userId });
    this.user = user;
    
    const products = yield* api('GET:/products', { ids: order.productIds });
    this.products = products;
  }
}

function OrderDetails({ orderId }: { orderId: number }) {
  const service = useOrderService();
  const order = service.useState.order();
  const user = service.useState.user();
  const products = service.useState.products();
  
  // 整个串行请求过程的 loading 状态
  const [loadOrderDetails, loading] = service.useAction.loadOrderDetails.withLoading();
  
  useEffect(() => {
    loadOrderDetails(orderId);
  }, [orderId]);
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      <OrderCard order={order} />
      <UserCard user={user} />
      <ProductList products={products} />
    </div>
  );
}
```

## 与手动 loading 对比

### ❌ 手动管理 loading（不推荐）

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable loading = false; // 需要手动定义

  @action
  *loadUser(id: number) {
    this.loading = true; // 需要手动设置
    
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
    
    this.loading = false; // 需要手动重置
    // 注意：如果请求失败，这行不会执行，loading 会一直是 true
  }
}

function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  const loading = service.useState.loading(); // 需要单独获取
  const loadUser = service.useAction.loadUser();
  
  useEffect(() => {
    loadUser(userId).finally(() => {
      // 需要手动清理 loading
      service.loading = false;
    });
  }, [userId]);
  
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

### ✅ 自动 loading（推荐）

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  // 无需定义 loading 属性

  @action
  *loadUser(id: number) {
    // 无需手动管理 loading
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }
}

function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  
  // loading 自动管理
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  
  useEffect(() => {
    loadUser(userId);
    // 无需手动清理，loading 会自动重置
  }, [userId]);
  
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

## 优势

### 1. 代码更简洁

- 无需在 Service 中定义 loading 属性
- 无需手动设置和重置 loading
- 无需担心请求失败时 loading 状态不正确

### 2. 自动清理

- 请求成功或失败后，loading 自动重置为 false
- 无需使用 finally 手动清理

### 3. 防止重复执行

- loading 为 true 时，action 不会重复执行
- 避免并发请求导致的问题

### 4. 独立状态

- 每个 action 都有独立的 loading 状态
- 不会相互影响

### 5. 类型安全

- TypeScript 完整类型推导
- IDE 自动补全和类型检查

## 最佳实践

### 1. 优先使用 withLoading()

```typescript
// ✅ 推荐
const [loadUser, loading] = service.useAction.loadUser.withLoading();

// ⚠️ 只在不需要 loading 时使用
const loadUser = service.useAction.loadUser();
```

### 2. 结合 RequestBoundary 使用

```typescript
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  
  useEffect(() => {
    loadUser(userId);
  }, [userId]);
  
  return (
    <RequestBoundary data={user} loading={loading}>
      {(user) => <UserCard user={user} />}
    </RequestBoundary>
  );
}
```

### 3. 多个 action 的 loading

```typescript
function UserDashboard({ userId }: { userId: number }) {
  const service = useUserService();
  const [loadUser, userLoading] = service.useAction.loadUser.withLoading();
  const [loadPosts, postsLoading] = service.useAction.loadPosts.withLoading();
  const [loadComments, commentsLoading] = service.useAction.loadComments.withLoading();
  
  // 计算整体 loading 状态
  const loading = userLoading || postsLoading || commentsLoading;
  
  useEffect(() => {
    loadUser(userId);
    loadPosts(userId);
    loadComments(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  
  return <Dashboard />;
}
```

### 4. 按钮禁用状态

```typescript
function UserForm() {
  const service = useUserService();
  const [saveUser, saving] = service.useAction.saveUser.withLoading();
  
  const handleSubmit = (data: UserFormData) => {
    saveUser(data);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />
      <button type="submit" disabled={saving}>
        {saving ? '保存中...' : '保存'}
      </button>
    </form>
  );
}
```

## 注意事项

### 1. 请求失败时的处理

```typescript
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    loadUser(userId).then(result => {
      if (!result) {
        // 请求失败
        setError(new Error('加载失败'));
      } else {
        setError(null);
      }
    });
  }, [userId]);
  
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} />;
  
  return <UserCard />;
}
```

### 2. 组件卸载时的清理

loading 状态会在组件卸载时自动清理，无需手动处理。

### 3. 与 async 函数一起使用

```typescript
@Service()
class UserService {
  @action
  async loadUser(id: number) {
    const user = await apiAsync('GET:/users/:id', { id });
    this.user = user;
  }
}

// withLoading() 同样适用于 async 函数
const [loadUser, loading] = service.useAction.loadUser.withLoading();
```

## 总结

通过 `withLoading()` 方法，我们实现了：

1. ✅ 自动管理 action 的 loading 状态
2. ✅ 无需在 Service 中定义 loading 属性
3. ✅ 自动防止重复执行
4. ✅ 请求失败时自动清理
5. ✅ 每个 action 独立的 loading 状态
6. ✅ 完整的 TypeScript 类型支持

这让代码更简洁、更安全、更易维护。
