# @svton/api-client 完整功能说明

## 目录

- [概述](#概述)
- [核心功能](#核心功能)
- [安装与配置](#安装与配置)
- [API 定义](#api-定义)
- [API 调用](#api-调用)
- [拦截器系统](#拦截器系统)
- [适配器系统](#适配器系统)
- [Generator 支持](#generator-支持)
- [类型系统](#类型系统)
- [最佳实践](#最佳实践)
- [禁止的写法](#禁止的写法)
- [常见问题](#常见问题)

## 概述

`@svton/api-client` 是一个类型安全的 API 客户端框架，提供：

- ✅ 完整的 TypeScript 类型推断
- ✅ 模块增强的 API 定义方式
- ✅ 灵活的拦截器系统
- ✅ 统一响应格式适配器
- ✅ Generator 函数支持
- ✅ 路径参数自动解析
- ✅ 请求/响应参数自动分离

## 核心功能

### 1. API 定义（模块增强）

通过 TypeScript 模块增强定义 API 类型：

```typescript
// types/api.ts
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    // GET 请求
    'GET:/users': ApiDefinition<void, User[]>;
    'GET:/users/:id': ApiDefinition<{ id: number }, User>;
    
    // POST 请求
    'POST:/users': ApiDefinition<{ data: CreateUserDto }, User>;
    
    // PUT 请求
    'PUT:/users/:id': ApiDefinition<{ id: number; data: UpdateUserDto }, User>;
    
    // DELETE 请求
    'DELETE:/users/:id': ApiDefinition<{ id: number }, void>;
  }
}
```

### 2. API 调用方式

#### 方式一：Promise API（apiAsync）

```typescript
// 无参数
const users = await apiAsync('GET:/users');

// 路径参数
const user = await apiAsync('GET:/users/:id', { id: 1 });

// Query 参数（GET）
const users = await apiAsync('GET:/users', { page: 1, size: 10 });

// Body 参数（POST/PUT）
const user = await apiAsync('POST:/users', { 
  data: { name: 'John', email: 'john@example.com' } 
});

// 路径参数 + Body 参数
const user = await apiAsync('PUT:/users/:id', { 
  id: 1,
  data: { name: 'John Updated' }
});
```

#### 方式二：Generator API（api）

```typescript
function* loadUserData(userId: number) {
  // 使用 yield* 调用 API
  const user = yield* api('GET:/users/:id', { id: userId });
  const posts = yield* api('GET:/users/:id/posts', { id: userId });
  
  return { user, posts };
}

// 执行 Generator
const result = await runGenerator(loadUserData(1));
```

### 3. 拦截器系统

#### 请求拦截器

```typescript
const tokenInterceptor: RequestInterceptor = (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};
```

#### 响应拦截器

```typescript
const responseInterceptor: ResponseInterceptor = (response) => {
  console.log('Response:', response.data);
  return response;
};
```

#### 错误拦截器

```typescript
const errorInterceptor: ErrorInterceptor = (error) => {
  if (error.code === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
};
```

### 4. 适配器系统

#### 统一响应格式适配器

```typescript
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 成功的 code 值
  onError: (response) => {
    // 错误处理
    if (response.code === 401) {
      window.location.href = '/login';
    }
  },
});
```

## 安装与配置

### 安装

```bash
pnpm add @svton/api-client
```

### 基础配置

```typescript
// lib/api-client.ts
import { createApiClient } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import { createTokenInterceptor } from '@svton/api-client';

// 创建适配器
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
});

// 创建客户端
export const { api, apiAsync, runGenerator } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  interceptors: {
    request: [
      createTokenInterceptor(() => localStorage.getItem('token')),
    ],
  },
});
```

## API 定义

### 定义格式

```typescript
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    // 格式：'METHOD:/path'
    'API_NAME': ApiDefinition<ParamsType, ResponseType>;
  }
}
```

### 参数类型说明

#### 无参数

```typescript
'GET:/stats': ApiDefinition<void, StatsVo>;
```

#### 只有路径参数

```typescript
'GET:/users/:id': ApiDefinition<{ id: number }, User>;
```

#### 只有 Query 参数（GET）

```typescript
'GET:/users': ApiDefinition<{ page: number; size: number }, User[]>;
```

#### 只有 Body 参数（POST/PUT）

```typescript
'POST:/users': ApiDefinition<{ data: CreateUserDto }, User>;
```

#### 路径参数 + Body 参数

```typescript
'PUT:/users/:id': ApiDefinition<{ id: number; data: UpdateUserDto }, User>;
```

#### 路径参数 + Query 参数（GET）

```typescript
'GET:/users/:id/posts': ApiDefinition<{ id: number; page: number }, Post[]>;
```

### 完整示例

```typescript
// types/api.ts
import type { ApiDefinition } from '@svton/api-client';

// 用户相关类型
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
  password: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

// API 定义
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    // 用户管理
    'GET:/users': ApiDefinition<{ page?: number; size?: number }, User[]>;
    'GET:/users/:id': ApiDefinition<{ id: number }, User>;
    'POST:/users': ApiDefinition<{ data: CreateUserDto }, User>;
    'PUT:/users/:id': ApiDefinition<{ id: number; data: UpdateUserDto }, User>;
    'DELETE:/users/:id': ApiDefinition<{ id: number }, void>;
    
    // 认证
    'POST:/auth/login': ApiDefinition<{ email: string; password: string }, { token: string; user: User }>;
    'POST:/auth/logout': ApiDefinition<void, void>;
    'GET:/auth/me': ApiDefinition<void, User>;
  }
}
```

## API 调用

### Promise API（apiAsync）

#### 基础调用

```typescript
// 无参数
const stats = await apiAsync('GET:/stats');

// 路径参数
const user = await apiAsync('GET:/users/:id', { id: 1 });

// Query 参数
const users = await apiAsync('GET:/users', { page: 1, size: 10 });

// Body 参数
const user = await apiAsync('POST:/users', {
  data: {
    name: 'John',
    email: 'john@example.com',
    password: '123456',
  },
});
```

#### 错误处理

```typescript
try {
  const user = await apiAsync('GET:/users/:id', { id: 1 });
  console.log(user);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.code, error.message);
  }
}
```

#### 并行请求

```typescript
const [users, posts, comments] = await Promise.all([
  apiAsync('GET:/users'),
  apiAsync('GET:/posts'),
  apiAsync('GET:/comments'),
]);
```

### Generator API（api）

#### 基础调用

```typescript
function* loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  return user;
}

const user = await runGenerator(loadUser(1));
```

#### 串行请求

```typescript
function* loadUserWithPosts(userId: number) {
  // 请求会按顺序执行
  const user = yield* api('GET:/users/:id', { id: userId });
  const posts = yield* api('GET:/users/:id/posts', { id: userId });
  
  return { user, posts };
}

const result = await runGenerator(loadUserWithPosts(1));
```

#### 错误处理

```typescript
function* loadUser(id: number) {
  try {
    const user = yield* api('GET:/users/:id', { id });
    return user;
  } catch (error) {
    console.error('Failed to load user:', error);
    return null;
  }
}
```

#### 并行请求

```typescript
function* loadDashboard() {
  const [users, posts, comments] = yield Promise.all([
    api('GET:/users'),
    api('GET:/posts'),
    api('GET:/comments'),
  ]);
  
  return { users, posts, comments };
}
```

## 拦截器系统

### 请求拦截器

#### Token 拦截器

```typescript
import { createTokenInterceptor } from '@svton/api-client';

const tokenInterceptor = createTokenInterceptor(() => {
  return localStorage.getItem('token');
});

// 或异步获取
const asyncTokenInterceptor = createTokenInterceptor(async () => {
  return await getTokenFromStorage();
});
```

#### 自定义请求拦截器

```typescript
const customRequestInterceptor: RequestInterceptor = (config) => {
  // 添加自定义 header
  config.headers['X-Custom-Header'] = 'value';
  
  // 修改 URL
  if (config.url.includes('/api/')) {
    config.url = config.url.replace('/api/', '/v2/api/');
  }
  
  return config;
};
```

### 响应拦截器

```typescript
const responseInterceptor: ResponseInterceptor = (response) => {
  // 记录响应时间
  console.log('Response time:', Date.now());
  
  // 可以修改响应数据
  if (response.data && typeof response.data === 'object') {
    response.data.timestamp = Date.now();
  }
  
  return response;
};
```

### 错误拦截器

#### 401 未授权拦截器

```typescript
import { createUnauthorizedInterceptor } from '@svton/api-client';

const unauthorizedInterceptor = createUnauthorizedInterceptor(() => {
  localStorage.removeItem('token');
  window.location.href = '/login';
});
```

#### 自定义错误拦截器

```typescript
const errorInterceptor: ErrorInterceptor = (error) => {
  // 根据错误码处理
  switch (error.code) {
    case 401:
      // 未授权
      window.location.href = '/login';
      break;
    case 403:
      // 无权限
      alert('您没有权限访问此资源');
      break;
    case 404:
      // 未找到
      console.error('资源未找到');
      break;
    case 500:
      // 服务器错误
      alert('服务器错误，请稍后重试');
      break;
  }
};
```

### 日志拦截器

```typescript
import { createLogInterceptor } from '@svton/api-client';

const logInterceptor = createLogInterceptor();

// 使用
const { api, apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [logInterceptor.request],
    response: [logInterceptor.response],
    error: [logInterceptor.error],
  },
});
```

### 配置拦截器

```typescript
const { api, apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      tokenInterceptor,
      customRequestInterceptor,
    ],
    response: [
      responseInterceptor,
    ],
    error: [
      unauthorizedInterceptor,
      errorInterceptor,
    ],
  },
});
```

## 适配器系统

### 统一响应格式适配器

适用于后端返回统一格式的场景：

```typescript
{
  code: 0,
  message: 'success',
  data: { ... },
  traceId: 'xxx',
  timestamp: 1234567890
}
```

#### 基础配置

```typescript
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 成功的 code 值
});
```

#### 完整配置

```typescript
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  
  // 错误处理
  onError: (response) => {
    console.error('API Error:', response.code, response.message);
    
    // 特殊错误码处理
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
  
  // 自定义错误消息
  getErrorMessage: (response) => {
    return response.message || '请求失败';
  },
});
```

#### 支持的后端格式

```typescript
// Spring Boot 格式（code: 200）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 200,
});

// 自定义格式（code: "SUCCESS"）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: "SUCCESS",
});

// @svton/nestjs-http 格式（code: 0）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
});
```

### 自定义适配器

```typescript
import type { HttpAdapter, HttpRequestConfig } from '@svton/api-client';

const customAdapter: HttpAdapter = {
  async request<T>(config: HttpRequestConfig): Promise<T> {
    const { method, url, data, params, headers } = config;
    
    // 构建 URL
    let fullUrl = url;
    if (params) {
      const query = new URLSearchParams(params).toString();
      fullUrl += `?${query}`;
    }
    
    // 发送请求
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    
    // 处理响应
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },
};
```

## Generator 支持

### runGenerator 函数

```typescript
import { runGenerator } from '@svton/api-client';

function* loadData() {
  const user = yield* api('GET:/users/me');
  const posts = yield* api('GET:/posts', { userId: user.id });
  return { user, posts };
}

const result = await runGenerator(loadData());
```

### 错误处理

```typescript
function* loadData() {
  try {
    const user = yield* api('GET:/users/me');
    const posts = yield* api('GET:/posts', { userId: user.id });
    return { user, posts };
  } catch (error) {
    console.error('Failed to load data:', error);
    return null;
  }
}
```

### 自动停止执行

```typescript
function* loadUserData(userId: number) {
  // 如果这个请求失败，会自动抛出错误
  const user = yield* api('GET:/users/:id', { id: userId });
  
  // ✅ 只有上面成功，这里才会执行
  const posts = yield* api('GET:/users/:id/posts', { id: userId });
  
  return { user, posts };
}
```

## 类型系统

### 类型推断

```typescript
// ✅ 自动推断参数类型
const user = await apiAsync('GET:/users/:id', { id: 1 });
//                                              ^^^^^^^^
//                                              类型：{ id: number }

// ✅ 自动推断返回类型
const user = await apiAsync('GET:/users/:id', { id: 1 });
//    ^^^^
//    类型：User

// ❌ 类型错误：缺少必需参数
const user = await apiAsync('GET:/users/:id');
//                          ^^^^^^^^^^^^^^^^
//                          错误：缺少参数 { id: number }

// ❌ 类型错误：参数类型不匹配
const user = await apiAsync('GET:/users/:id', { id: '1' });
//                                              ^^^^^^^^^^^
//                                              错误：id 应该是 number
```

### 类型安全

```typescript
// ✅ 正确：参数类型匹配
await apiAsync('POST:/users', {
  data: {
    name: 'John',
    email: 'john@example.com',
    password: '123456',
  },
});

// ❌ 错误：缺少必需字段
await apiAsync('POST:/users', {
  data: {
    name: 'John',
    // 缺少 email 和 password
  },
});

// ❌ 错误：字段类型不匹配
await apiAsync('POST:/users', {
  data: {
    name: 123,  // 应该是 string
    email: 'john@example.com',
    password: '123456',
  },
});
```

## 最佳实践

### 1. 集中管理 API 定义

```typescript
// types/api/user.ts
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/users': ApiDefinition<{ page?: number }, User[]>;
    'GET:/users/:id': ApiDefinition<{ id: number }, User>;
    'POST:/users': ApiDefinition<{ data: CreateUserDto }, User>;
  }
}

// types/api/post.ts
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/posts': ApiDefinition<{ page?: number }, Post[]>;
    'GET:/posts/:id': ApiDefinition<{ id: number }, Post>;
  }
}

// types/api/index.ts
export * from './user';
export * from './post';
```

### 2. 使用拦截器处理通用逻辑

```typescript
// lib/api-client.ts
const { api, apiAsync } = createApiClient(adapter, {
  baseURL: process.env.API_BASE_URL,
  interceptors: {
    request: [
      // Token 认证
      createTokenInterceptor(() => localStorage.getItem('token')),
      
      // 添加时间戳
      (config) => {
        config.headers['X-Timestamp'] = Date.now().toString();
        return config;
      },
    ],
    error: [
      // 401 处理
      createUnauthorizedInterceptor(() => {
        window.location.href = '/login';
      }),
      
      // 错误日志
      (error) => {
        console.error('[API Error]', error);
      },
    ],
  },
});
```

### 3. 在 Service 中使用 Generator 函数

```typescript
// ✅ 推荐：在 Service 的 @action 中使用 Generator
@Service()
class UserService {
  @observable user: User | null = null;
  @observable posts: Post[] = [];

  @action
  *loadUserProfile(userId: number) {
    // 请求失败会自动停止
    const user = yield* api('GET:/users/:id', { id: userId });
    this.user = user;
    
    const posts = yield* api('GET:/users/:id/posts', { id: userId });
    this.posts = posts;
  }
}

// ❌ 不推荐：直接在组件中使用 api
function UserProfile({ userId }: { userId: number }) {
  useEffect(() => {
    api('GET:/users/:id', { id: userId }); // 不推荐
  }, [userId]);
}
```

### 4. 在组件中使用 useApi Hook

```typescript
// ✅ 推荐：使用 @svton/service 的 useApi Hook
import { useApi } from '@svton/service';

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
  
  useEffect(() => {
    apiAsync('GET:/users/:id', { id: userId }).then(setUser);
  }, [userId]);
  
  return <div>{user?.name}</div>;
}
```

### 5. 必要时使用 await 等待请求

```typescript
// ✅ 如果必须在组件中直接使用 apiAsync，使用 await
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

### 6. 合理使用并行请求

```typescript
// ✅ 好：独立请求并行执行
const [users, posts] = await Promise.all([
  apiAsync('GET:/users'),
  apiAsync('GET:/posts'),
]);

// ❌ 不好：独立请求串行执行
const users = await apiAsync('GET:/users');
const posts = await apiAsync('GET:/posts');
```

### 7. 统一错误处理

```typescript
// lib/api-client.ts
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    // 统一错误处理
    switch (response.code) {
      case 401:
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      case 403:
        alert('您没有权限访问此资源');
        break;
      case 500:
        alert('服务器错误，请稍后重试');
        break;
    }
  },
});
```

## 禁止的写法

### ❌ 1. 不要直接修改 config 对象

```typescript
// ❌ 错误
const config = { method: 'GET', url: '/users' };
config.headers = { ...config.headers, 'X-Custom': 'value' };

// ✅ 正确：使用拦截器
const interceptor: RequestInterceptor = (config) => {
  return {
    ...config,
    headers: {
      ...config.headers,
      'X-Custom': 'value',
    },
  };
};
```

### ❌ 2. 不要在 Generator 中使用 await

```typescript
// ❌ 错误
function* loadUser(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  return user;
}

// ✅ 正确：使用 yield*
function* loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  return user;
}
```

### ❌ 3. 不要手动构建 URL

```typescript
// ❌ 错误
const userId = 1;
const user = await apiAsync(`GET:/users/${userId}` as any);

// ✅ 正确：使用路径参数
const user = await apiAsync('GET:/users/:id', { id: 1 });
```

### ❌ 4. 不要忽略类型错误

```typescript
// ❌ 错误：使用 any 绕过类型检查
const user = await apiAsync('GET:/users/:id' as any, { id: '1' } as any);

// ✅ 正确：使用正确的类型
const user = await apiAsync('GET:/users/:id', { id: 1 });
```

### ❌ 5. 不要在拦截器中抛出错误

```typescript
// ❌ 错误
const interceptor: RequestInterceptor = (config) => {
  if (!config.headers.Authorization) {
    throw new Error('Missing token');
  }
  return config;
};

// ✅ 正确：返回修改后的 config 或使用错误拦截器
const interceptor: RequestInterceptor = (config) => {
  if (!config.headers.Authorization) {
    config.headers.Authorization = 'Bearer default-token';
  }
  return config;
};
```

### ❌ 6. 不要重复定义 API

```typescript
// ❌ 错误：重复定义
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/users': ApiDefinition<void, User[]>;
  }
}

declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/users': ApiDefinition<{ page: number }, User[]>;  // 冲突
  }
}

// ✅ 正确：在同一个声明中定义
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/users': ApiDefinition<{ page?: number }, User[]>;
  }
}
```

### ❌ 7. 不要在 API 名称中使用变量

```typescript
// ❌ 错误
const method = 'GET';
const path = '/users';
const user = await apiAsync(`${method}:${path}` as any);

// ✅ 正确：使用字面量
const user = await apiAsync('GET:/users');
```

### ❌ 8. 不要混用 api 和 apiAsync

```typescript
// ❌ 错误：在 Generator 中使用 apiAsync
function* loadUser(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  return user;
}

// ✅ 正确：在 Generator 中使用 api
function* loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  return user;
}

// ✅ 正确：在普通函数中使用 apiAsync
async function loadUser(id: number) {
  const user = await apiAsync('GET:/users/:id', { id });
  return user;
}
```

### ❌ 9. 不要直接在组件中使用 api/apiAsync（除非必要）

```typescript
// ❌ 不推荐
function UserList() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    apiAsync('GET:/users').then(setUsers);
  }, []);
  
  return <List data={users} />;
}

// ✅ 推荐：使用 @svton/service 的 useApi Hook
import { useApi } from '@svton/service';

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
  const loadUsers = service.useAction.loadUsers();
  
  useEffect(() => { loadUsers(); }, []);
  
  return <List data={users} />;
}
```

### ❌ 10. 不要不等待就继续执行

```typescript
// ❌ 错误：没有 await
function handleSubmit() {
  apiAsync('POST:/users', { data: formData }); // 没有 await
  console.log('Submitted'); // 可能在请求完成前执行
}

// ✅ 正确：使用 await
async function handleSubmit() {
  try {
    await apiAsync('POST:/users', { data: formData });
    console.log('Submitted');
  } catch (error) {
    console.error('Failed:', error);
  }
}
```

## 常见问题

### Q: 如何处理文件上传？

A: 使用 FormData：

```typescript
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/upload': ApiDefinition<{ data: FormData }, { url: string }>;
  }
}

const formData = new FormData();
formData.append('file', file);

const result = await apiAsync('POST:/upload', { data: formData });
```

### Q: 如何取消请求？

A: 使用 AbortController：

```typescript
const controller = new AbortController();

try {
  const user = await apiAsync('GET:/users/:id', { 
    id: 1,
    signal: controller.signal 
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request cancelled');
  }
}

// 取消请求
controller.abort();
```

### Q: 如何设置超时？

A: 在创建客户端时配置：

```typescript
const { api, apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  timeout: 30000,  // 30 秒
});
```

### Q: 如何处理不同的响应格式？

A: 创建自定义适配器或使用不同的适配器实例：

```typescript
// 统一格式的 API
const adapter1 = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
});

// 原始格式的 API
const adapter2: HttpAdapter = {
  async request(config) {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.data ? JSON.stringify(config.data) : undefined,
    });
    return response.json();
  },
};
```

### Q: 如何调试 API 请求？

A: 使用日志拦截器：

```typescript
import { createLogInterceptor } from '@svton/api-client';

const logInterceptor = createLogInterceptor();

const { api, apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [logInterceptor.request],
    response: [logInterceptor.response],
    error: [logInterceptor.error],
  },
});
```

## 总结

`@svton/api-client` 提供了一套完整的 API 客户端解决方案：

- ✅ 类型安全的 API 定义和调用
- ✅ 灵活的拦截器系统
- ✅ 统一响应格式适配器
- ✅ Generator 函数支持
- ✅ 自动参数解析和分离

遵循最佳实践和避免禁止的写法，可以构建出健壮、类型安全的 API 客户端。
