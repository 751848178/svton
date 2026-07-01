# Code Examples

典型场景的 before/after，演示如何把职责混杂、超长、重复的代码按本标准归位——无论你是新建代码还是改老代码，目标形态都是一样的。示例刻意简化，重点看「职责去了哪个文件」，而不是业务细节。

## 示例 1：职责混杂的超长 service

### Before — `order.service.ts`（300+ 行，混了 4 类职责）

```typescript
// order.service.ts —— 混了 transport、业务规则、数据访问、视图格式化
@Injectable()
export class OrderService {
  constructor(@InjectRepository(Order) private repo: Repository<Order>) {}

  // ❌ controller 该做的：HTTP 入口 + 响应封装
  async createOrderEndpoint(@Req() req, @Body() dto: CreateOrderDto) {
    const order = await this.createOrder(dto, req.user.id);
    return {  // ❌ 视图格式化混在 service
      code: 0,
      data: {
        orderId: order.id,
        totalAmount: Number(order.amount.toFixed(2)),
        created: order.createdAt.toISOString(),
      },
    };
  }

  // 业务规则 + 数据访问 + 计算全挤在一起
  async createOrder(dto: CreateOrderDto, userId: string) {
    const user = await this.repo.manager.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException();  // ❌ transport 异常细节
    let discount = 1;
    if (user.isVip) discount = 0.8;            // ❌ 业务规则
    else if (user.points > 1000) discount = 0.9;
    const amount = dto.quantity * dto.unitPrice * discount;
    const order = this.repo.create({ userId, ...dto, amount });  // ❌ ORM 细节
    return await this.repo.save(order);
  }
}
```

### After — 按职责拆成 4 个文件，每个 < 200 行

```typescript
// order.controller.ts —— 只做入口、校验、响应封装
@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  async create(@Req() req, @Body() dto: CreateOrderDto): Promise<OrderVo> {
    const order = await this.orders.createOrder(dto, req.user.id);
    return toOrderVo(order);  // vo 转换经纯函数 / vo.ts
  }
}
```

```typescript
// order.service.ts —— 只做业务规则和编排
@Injectable()
export class OrderService {
  constructor(private readonly orderRepo: OrderRepository) {}

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    const user = await this.orderRepo.findUser(userId);
    if (!user) throw new UserNotFoundError(userId);  // 抛领域异常，不碰 HTTP
    const discount = computeDiscount(user);           // 业务规则下沉
    const amount = dto.quantity * dto.unitPrice * discount;
    return this.orderRepo.saveOrder({ userId, ...dto, amount });
  }
}
```

```typescript
// order.repository.ts —— 只做数据读写
@Injectable()
export class OrderRepository {
  constructor(@InjectRepository(Order) private repo: Repository<Order>) {}

  findUser(userId: string) {
    return this.repo.manager.findOne(User, { where: { id: userId } });
  }
  saveOrder(data: Partial<Order>) {
    return this.repo.save(this.repo.create(data));
  }
}
```

```typescript
// order.vo.ts + order.utils.ts —— 输出结构与纯函数
export interface OrderVo { orderId: string; totalAmount: number; created: string }

export function toOrderVo(order: Order): OrderVo {
  return {
    orderId: order.id,
    totalAmount: Number(order.amount.toFixed(2)),
    created: order.createdAt.toISOString(),
  };
}

// order.rules.ts（或 order.service 内的私有函数）—— 业务规则
export function computeDiscount(user: User): number {
  if (user.isVip) return 0.8;
  if (user.points > 1000) return 0.9;
  return 1;
}
```

**要点：** transport 异常 → 领域异常；业务规则 → 独立纯函数；ORM 细节 → repository；视图格式化 → vo 纯函数。每个文件都能一句话说清职责。

## 示例 2：重复逻辑抽公共

### Before — 同一段折扣/格式化逻辑复制了三份

```typescript
// ❌ a.service.ts / b.service.ts / c.service.ts 各有一份几乎一样的
function calcAmount(user: User, qty: number, price: number) {
  let discount = 1;
  if (user.isVip) discount = 0.8;
  else if (user.points > 1000) discount = 0.9;
  return qty * price * discount;
}
```

### After — 抽一次，禁止出现第二份

```typescript
// order.rules.ts —— 业务规则只存一份
export function computeDiscount(user: User): number { /* ... */ }

// 三处调用方统一引用
import { computeDiscount } from './order.rules';
const amount = qty * price * computeDiscount(user);
```

**要点：** 出现第二份相似代码时就抽，不要等第三份（规则 6）。

## 示例 3：超长文件机械切碎 vs 按职责拆

### ❌ Wrong — 为了凑行数把强相关逻辑机械切开

把一个 `OrderService.createOrder` 的「校验参数 → 查用户 → 算折扣 → 算金额 → 落库」这条强相关流程，人为切成 `createOrderStep1.ts` / `Step2.ts` / `Step3.ts`。这是禁止事项第 1 条——拆分必须沿职责边界，不能沿行数边界。

### ✅ Right — 按职责边界拆

把「数据读写」整块搬到 repository，把「折扣规则」整块搬到 rules，让 service 只剩流程编排。强相关流程保持在同一个 service 方法里，但它调用的各块职责已经分散到正确文件。

**判断标准：** 拆出来的每一块，能不能用一句话说清它的独立职责？说不清（「这是 createOrder 的第二步」不算职责）就不要单独成文件。

## 示例 4：前端组件下沉数据访问与降级

### Before — 组件直接 fetch + 降级

```tsx
// ❌ order-detail.component.tsx 里
function OrderDetail({ orderId }) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .catch(() => fetch(`/api/orders-fallback/${orderId}`).then(r => r.json()))  // ❌ 降级在视图层
      .then(setOrder);
  }, [orderId]);
  return <div>{order?.amount}</div>;
}
```

### After — 数据和降级下沉到 hook

```typescript
// order.hooks.ts —— 请求与降级在 hook
export function useOrder(orderId: string) {
  const { data } = useSWR(`/api/orders/${orderId}`, fetcher, {
    onErrorRetry: (_, __, ___, revalidate, { retryCount }) => {
      if (retryCount >= 1) return;  // 降级策略收在 hook
      revalidate({ retryCount: retryCount + 1 });
    },
  });
  return data;
}
```

```tsx
// order-detail.component.tsx —— 只做展示
function OrderDetail({ orderId }) {
  const order = useOrder(orderId);  // 只拿结果
  return <div>{order?.amount}</div>;
}
```

**要点：** 组件不直接 fetch、不持有降级编排（规则 10 + `engineering-craft-principles`）。
