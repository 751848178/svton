---
inclusion: always
---

# Svton 项目开发指南

本项目使用 Svton 全栈框架，这是一个基于 NestJS + Next.js + Taro 的企业级 Monorepo 架构。

## 📦 可用的 NPM 包

### 前端通用包

#### @svton/hooks - React Hooks 工具包
提供高质量的自定义 Hooks，替代原生 Hooks 并避免闭包陷阱：

**函数优化**：
- `usePersistFn` - 替代 useCallback，无需手动管理依赖
- `useLockFn` - 防止异步函数重复执行（防重复提交）
- `useDebounceFn` / `useThrottleFn` - 防抖/节流函数

**状态管理**：
- `useBoolean` - 布尔值状态管理，提供 toggle/setTrue/setFalse
- `useToggle` - 在两个值之间切换
- `useSetState` - 类似 class 组件的 setState
- `usePrevious` - 获取上一次渲染的值
- `useLatest` - 获取最新值的 ref，避免闭包陷阱

**值处理**：
- `useDebounce` / `useThrottle` - 防抖/节流值

**生命周期**：
- `useMount` / `useUnmount` - 组件挂载/卸载时执行
- `useUpdateEffect` - 忽略首次渲染的 useEffect
- `useDeepCompareEffect` - 深度比较依赖的 useEffect

**定时器**：
- `useInterval` / `useTimeout` - 定时器封装
- `useCountdown` - 倒计时（验证码场景）

**存储**：
- `useLocalStorage` / `useSessionStorage` - 持久化状态

**DOM/浏览器**：
- `useScroll` - 滚动位置监听
- `useIntersectionObserver` - 元素可见性检测（懒加载、曝光埋点）

**表单/组件**：
- `useControllableValue` - 受控/非受控组件值管理
- `useSelections` - 多选列表管理（全选、反选）

**请求相关**：
- `useRequestState` - 请求状态管理
- `usePagination` - 分页数据加载

**使用规范**：
```typescript
// ✅ 回调函数使用 usePersistFn
const handleClick = usePersistFn(() => { /* ... */ });

// ✅ 布尔状态使用 useBoolean
const [visible, { setTrue, setFalse }] = useBoolean(false);

// ✅ 搜索场景使用 useDebounce
const debouncedKeyword = useDebounce(keyword, 500);

// ✅ 防重复提交使用 useLockFn
const submit = useLockFn(async () => { /* ... */ });
```

#### @svton/ui - React UI 组件库
基于 Tailwind CSS 的轻量级组件库，用于 Next.js 管理后台：

**状态组件**：LoadingState, EmptyState, ErrorState, ProgressState, PermissionState
**边界组件**：RequestBoundary（自动处理加载、空数据、错误状态）
**反馈组件**：Modal, Drawer, Tooltip, Popover, Notification, Spin
**数据展示**：Skeleton, Avatar, Badge, Tag, Card, Collapse, Tabs
**布局组件**：Portal, AspectRatio, ScrollArea, InfiniteScroll
**工具组件**：Copyable, ClickOutside

**使用方式**：
```typescript
// 方式一：Tailwind 预设（推荐）
// tailwind.config.js
module.exports = {
  presets: [require('@svton/ui/tailwind-preset')],
};

// 方式二：预编译 CSS
import '@svton/ui/styles.css';
```

**最佳实践**：
```typescript
// ✅ 使用 RequestBoundary 统一处理状态
<RequestBoundary data={data} loading={loading} error={error}>
  {(data) => <Content data={data} />}
</RequestBoundary>
```

#### @svton/taro-ui - Taro 小程序 UI 组件库
统一的移动端组件库，遵循 1.7 倍缩放规则：

**基础组件**：StatusBar, NavBar, Button, Cell, Divider, Grid, Card
**表单组件**：Input, SearchBar, Switch, Checkbox, Radio, Rate, Stepper, ImageUploader
**展示组件**：Tag, Badge, Avatar, Skeleton, Progress, Steps, Collapse, NoticeBar, Countdown, Result
**反馈组件**：Popup, Modal, ActionSheet, Toast, SwipeCell, LoadingState, EmptyState, RequestBoundary
**导航组件**：Tabs, TabBar, BackTop, List

**页面模板**：
```typescript
import { View } from '@tarojs/components';
import { NavBar, StatusBar, Button } from '@svton/taro-ui';

export default function MyPage() {
  return (
    <View className="page">
      <StatusBar />
      <NavBar title="页面标题" />
      {/* 页面内容 */}
    </View>
  );
}
```

**规范要求**：
- 每个页面必须包含 `<StatusBar />` 和 `<NavBar />`
- 按钮使用 `<Button>` 组件
- 列表使用 `<List>` 或 `<Cell>` 组件
- 样式使用 `variables.scss` 变量

#### @svton/service - React 服务层状态管理
基于装饰器的类式状态管理：

```typescript
import { Service, observable, computed, action } from '@svton/service';

@Service()
class CounterService {
  @observable count = 0;
  
  @computed get doubled() {
    return this.count * 2;
  }
  
  @action increment() {
    this.count++;
  }
}

// 在组件中使用
const useCounterService = createService(CounterService);

function Counter() {
  const counter = useCounterService();
  const count = counter.useState.count();
  const increment = counter.useAction.increment();
  
  return <button onClick={increment}>{count}</button>;
}
```

#### @svton/logger - 前端日志与错误追踪
支持插件扩展的日志库：

```typescript
import { createLogger } from '@svton/logger';

const logger = createLogger({
  appName: 'my-app',
  env: 'production',
  reportUrl: 'https://api.example.com/logs',
  captureGlobalErrors: true,
  capturePerformance: true,
});

logger.info('User logged in', { userId: 123 });
logger.error('Request failed', { error });
```

### NestJS 后端包

#### @svton/nestjs-logger - 日志模块
基于 Pino 的高性能结构化日志，支持阿里云 SLS 和腾讯云 CLS：

```typescript
LoggerModule.forRoot({
  appName: 'my-api',
  level: 'info',
  prettyPrint: process.env.NODE_ENV !== 'production',
  cloudLogger: {
    aliyunSls: {
      endpoint: 'cn-hangzhou.log.aliyuncs.com',
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      project: 'my-project',
      logstore: 'my-logstore',
    },
  },
});

// 使用
@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}
  
  async findOne(id: number) {
    this.logger.info({ userId: id }, 'Finding user');
  }
}
```

**特性**：
- 自动 requestId/traceId 追踪
- 批量发送优化（100条/批次，3秒间隔）
- 开发环境美化输出，生产环境 JSON 格式

#### @svton/nestjs-cache - 缓存装饰器模块
类 Spring Cache 的声明式缓存：

```typescript
CacheModule.forRoot({
  ttl: 3600,
  prefix: 'cache',
});

@Injectable()
export class UsersService {
  @Cacheable({ key: 'user:#id', ttl: 3600 })
  async findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  
  @CacheEvict({ key: 'user:#id' })
  async update(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }
  
  @CachePut({ key: 'user:#id' })
  async updateAndRefresh(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
```

**Key 表达式**：
- `#0`, `#1` - 位置参数
- `#paramName` - 参数名
- `#id` - 从 request.params 获取
- `#body.field` - 从 request.body 获取

#### @svton/nestjs-queue - 队列模块
基于 BullMQ 的任务队列：

```typescript
QueueModule.forRoot({
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

// 添加任务
await queueService.addJob('email', 'send', {
  to: 'user@example.com',
  subject: 'Welcome',
});

// 定义处理器
@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  @Process('send')
  async handleSend(job: Job<{ to: string; subject: string }>) {
    await this.sendEmail(job.data);
  }
}
```

#### @svton/nestjs-payment - 支付模块
微信支付 V3 API + 支付宝集成：

```typescript
PaymentModule.forRoot({
  wechat: {
    mchId: '商户号',
    privateKey: '商户 API 私钥',
    serialNo: '商户 API 证书序列号',
    apiV3Key: 'APIv3 密钥',
    appId: '关联的 AppID',
  },
  alipay: {
    appId: '应用 ID',
    privateKey: '应用私钥',
    alipayPublicKey: '支付宝公钥',
  },
});

// 微信 JSAPI 支付
const result = await paymentService.wechat.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
  userId: openid,
}, 'jsapi');

// 支付宝电脑网站支付
const result = await paymentService.alipay.createOrder({
  outTradeNo: orderId,
  totalAmount: amount,
  description: '商品购买',
}, 'page');
```

**支付类型**：
- 微信：jsapi, native, app, h5, miniprogram
- 支付宝：page, wap, app

#### @svton/nestjs-oauth - OAuth 模块
微信登录集成（开放平台、公众号、小程序）：

```typescript
OAuthModule.forRoot({
  wechat: [
    {
      platform: 'open',
      appId: 'wx_open_app_id',
      appSecret: 'wx_open_app_secret',
      callbackUrl: 'https://example.com/auth/wechat/callback',
    },
    {
      platform: 'miniprogram',
      appId: 'wx_mini_app_id',
      appSecret: 'wx_mini_app_secret',
    },
  ],
});

// PC 扫码登录
const url = oauthService.wechat.getAuthorizationUrl('open', state);

// 小程序登录
const result = await oauthService.wechat.code2Session(code);
```

#### 其他 NestJS 包
- `@svton/nestjs-redis` - Redis 模块
- `@svton/nestjs-http` - HTTP 响应格式化
- `@svton/nestjs-authz` - 权限控制
- `@svton/nestjs-rate-limit` - 限流
- `@svton/nestjs-sms` - 短信发送
- `@svton/nestjs-object-storage` - 对象存储
- `@svton/nestjs-object-storage-qiniu-kodo` - 七牛云存储
- `@svton/nestjs-config-schema` - 配置验证

### 项目私有包

#### @{org}/types
类型定义包，定义项目中共享的 TypeScript 类型：

```typescript
// 在 Admin 和 Mobile 中使用
import type { UserVo, ContentVo } from '@{org}/types';
```

#### @{org}/api-client
TypeScript API 客户端，用于前端调用后端接口。

**基础使用**：

```typescript
import { apiAsync } from '@{org}/api-client';

const user = await apiAsync('GET:/users/:id', { id: 1 });
```

**使用统一响应适配器（推荐）**：

如果后端使用统一响应格式（如 `@svton/nestjs-http`、Spring Boot 等），使用内置适配器自动处理：

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@{org}/types';

const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 根据后端调整：0, 200, "SUCCESS" 等
  onError: (response) => {
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
});

export const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      createTokenInterceptor(() => localStorage.getItem('token'))
    ]
  }
});
```

适配器会自动：
- 提取 `response.data` 作为返回值
- 检查 `response.code` 并在错误时抛出 `ApiError`
- 保留 `traceId` 和 `timestamp` 用于调试

**兼容框架**：
- `@svton/nestjs-http` - code: 0
- Spring Boot - code: 200
- 自定义格式 - code: "SUCCESS" 等

## 🎯 开发规范

### 前端开发规范

1. **回调函数使用 usePersistFn**
   ```typescript
   const handleClick = usePersistFn(() => { /* ... */ });
   ```

2. **布尔状态使用 useBoolean**
   ```typescript
   const [visible, { setTrue, setFalse }] = useBoolean(false);
   ```

3. **搜索场景使用 useDebounce**
   ```typescript
   const debouncedKeyword = useDebounce(keyword, 500);
   ```

4. **防重复提交使用 useLockFn**
   ```typescript
   const submit = useLockFn(async () => { /* ... */ });
   ```

5. **使用 RequestBoundary 统一处理状态**
   ```typescript
   <RequestBoundary data={data} loading={loading} error={error}>
     {(data) => <Content data={data} />}
   </RequestBoundary>
   ```

### 后端开发规范

1. **使用结构化日志**
   ```typescript
   this.logger.info({ userId, action: 'login' }, 'User logged in');
   ```

2. **使用缓存装饰器**
   ```typescript
   @Cacheable({ key: 'user:#id', ttl: 3600 })
   async findOne(id: number) { /* ... */ }
   ```

3. **异步任务使用队列**
   ```typescript
   await queueService.addJob('email', 'send', { to, subject, body });
   ```

4. **合理设置重试策略**
   ```typescript
   {
     attempts: 3,
     backoff: { type: 'exponential', delay: 1000 },
   }
   ```

### Taro 小程序规范

1. **每个页面必须包含 StatusBar 和 NavBar**
   ```typescript
   <View className="page">
     <StatusBar />
     <NavBar title="页面标题" />
   </View>
   ```

2. **使用 Taro UI 组件**
   - 按钮使用 `<Button>` 组件
   - 列表使用 `<List>` 或 `<Cell>` 组件
   - 表单使用对应的表单组件

3. **样式使用 variables.scss 变量**
   ```scss
   @import '../../styles/variables.scss';
   
   .button {
     font-size: $font-size-base;
     padding: $spacing-sm $spacing-base;
   }
   ```

## 📚 文档资源

- 官方文档：https://751848178.github.io/svton
- GitHub：https://github.com/751848178/svton

## 🔧 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 开发模式
pnpm dev

# 运行测试
pnpm test
```

## 💡 开发提示

当你在开发过程中遇到以下场景时，应该使用对应的 Svton 包：

- 需要防抖/节流 → 使用 `@svton/hooks` 的 `useDebounce` / `useThrottle`
- 需要防止重复提交 → 使用 `@svton/hooks` 的 `useLockFn`
- 需要处理加载/空/错误状态 → 使用 `@svton/ui` 的 `RequestBoundary`
- 需要缓存数据 → 使用 `@svton/nestjs-cache` 的装饰器
- 需要异步任务 → 使用 `@svton/nestjs-queue`
- 需要支付功能 → 使用 `@svton/nestjs-payment`
- 需要微信登录 → 使用 `@svton/nestjs-oauth`
- 需要日志追踪 → 使用 `@svton/nestjs-logger`

记住：优先使用框架提供的包和组件，避免重复造轮子！
