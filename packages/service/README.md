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
import { Service, observable, computed, action, Inject } from '@svton/service';

@Service()
class OrderService {
  @observable orders: Order[] = [];
  @observable loading = false;
  @observable filters = { status: 'all', page: 1 };

  @Inject() private userService!: UserService;

  @computed get pendingOrders() {
    return this.orders.filter(o => o.status === 'pending');
  }

  @computed get pendingCount() {
    return this.pendingOrders.length;
  }

  @action async fetch() {
    this.loading = true;
    try {
      this.orders = await api.getOrders(this.filters);
    } finally {
      this.loading = false;
    }
  }

  @action setFilter(key: string, value: any) {
    this.filters = { ...this.filters, [key]: value };
    this.fetch();
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
| `@action` | 标记方法为 action |
| `@Inject()` | 注入其他 Service |

### 函数

| 函数 | 说明 |
|------|------|
| `createService(Class)` | 创建 Scoped Hook |
| `createServiceProvider(Class)` | 创建 Provider |

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

## License

MIT
