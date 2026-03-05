# Release Notes - v1.4.0 / v0.6.0

## 发布日期
2026-03-05

## 发布的包
- `@svton/api-client@1.4.0`
- `@svton/service@0.6.0`

## 主要更新

### 1. 静默中止机制（Silent Abort Mechanism）

Generator 函数中的 API 请求失败时会静默停止执行，不抛出错误：

```typescript
@Service()
class UserService {
  @observable() user: User | null = null;

  @action()
  *loadUser(id: number) {
    // 请求失败会静默停止，不会执行后续代码
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
    
    // 只有上面成功，这里才会执行
    console.log('User loaded');
  }
}
```

### 2. 自动 Loading 状态管理

使用 `withLoading()` 方法自动管理 action 的 loading 状态：

```typescript
function UserProfile({ userId }: { userId: number }) {
  const service = useUserService();
  const user = service.useState.user();
  
  // 自动管理 loading 状态
  const [loadUser, loading] = service.useAction.loadUser.withLoading();
  
  useEffect(() => {
    loadUser(userId);
  }, [userId]);
  
  if (loading) return <Spinner />;
  return <div>{user?.name}</div>;
}
```

### 3. catchError 工具函数

允许捕获错误而不中止 Generator 执行：

```typescript
@action()
*loadUserData(id: number) {
  // 必须成功的请求（失败会中止）
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
  
  // 可以失败的请求（失败不会中止）
  const result = yield* catchError(api('GET:/users/:id/avatar', { id }));
  if (result.error) {
    this.avatar = '/default-avatar.png';
  } else {
    this.avatar = result.data;
  }
  
  // 后续代码继续执行
  console.log('Done');
}
```

### 4. 装饰器函数化

所有装饰器改为函数形式，便于未来扩展：

```typescript
@Service()
class UserService {
  @observable()
  count = 0;
  
  @computed()
  get doubled() {
    return this.count * 2;
  }
  
  @action()
  increment() {
    this.count++;
  }
  
  @Inject()
  otherService!: OtherService;
}
```

## Breaking Changes

### 1. 装饰器必须使用函数形式

```typescript
// ❌ 旧代码
@Service
class UserService {
  @observable count = 0;
  @computed get doubled() { return this.count * 2; }
  @action increment() { this.count++; }
}

// ✅ 新代码
@Service()
class UserService {
  @observable() count = 0;
  @computed() get doubled() { return this.count * 2; }
  @action() increment() { this.count++; }
}
```

### 2. 移除 useApi Hooks

`useApi` 和 `useApiOnMount` 已移除，请使用 Service 的 `withLoading()` 方法：

```typescript
// ❌ 旧代码
import { useApi } from '@svton/service';

const { data, loading, execute } = useApi(
  (id: number) => apiAsync('GET:/users/:id', { id })
);

// ✅ 新代码
@Service()
class UserService {
  @observable() user: User | null = null;

  @action()
  *loadUser(id: number) {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }
}

const [loadUser, loading] = service.useAction.loadUser.withLoading();
```

### 3. 禁止手动管理 loading 状态

```typescript
// ❌ 不推荐：手动管理 loading
@Service()
class UserService {
  @observable() loading = false;

  @action()
  *loadUser(id: number) {
    this.loading = true;
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
    this.loading = false; // 失败时不会执行
  }
}

// ✅ 推荐：使用 withLoading()
@Service()
class UserService {
  @action()
  *loadUser(id: number) {
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;
  }
}

const [loadUser, loading] = service.useAction.loadUser.withLoading();
```

## 迁移指南

### 步骤 1: 更新装饰器

在所有装饰器后添加 `()`：

```bash
# 使用 sed 批量替换（macOS）
find . -name "*.ts" -type f -exec sed -i '' 's/@Service$/@Service()/g' {} +
find . -name "*.ts" -type f -exec sed -i '' 's/@observable$/@observable()/g' {} +
find . -name "*.ts" -type f -exec sed -i '' 's/@computed$/@computed()/g' {} +
find . -name "*.ts" -type f -exec sed -i '' 's/@action$/@action()/g' {} +
```

### 步骤 2: 移除 useApi

将 `useApi` 改为使用 Service + `withLoading()`。

### 步骤 3: 移除手动 loading 管理

删除 Service 中的 `loading` 属性，使用 `withLoading()` 代替。

### 步骤 4: 更新依赖

```bash
pnpm update @svton/api-client @svton/service
```

## 新增功能

### @svton/api-client

- ✅ 静默中止机制（ApiAbortError、isAbortSignal）
- ✅ catchError 工具函数
- ✅ 使用标准 ES Module import

### @svton/service

- ✅ withLoading() 自动 loading 管理
- ✅ 装饰器函数化
- ✅ 集成静默中止机制
- ✅ 添加 @svton/api-client 依赖

## 文档更新

- `packages/service/ACTION_GUIDE.md` - Action 装饰器完整指南
- `packages/service/ACTION_LOADING_GUIDE.md` - 自动 loading 状态管理指南
- `packages/api-client/COMPLETE_GUIDE.md` - API Client 完整功能说明

## 致谢

感谢所有贡献者和用户的反馈！

## 下一步计划

- 持续优化类型推导
- 添加更多示例和最佳实践
- 改进文档和教程

---

**完整 Changelog:** https://github.com/751848178/svton/releases
