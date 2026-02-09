# API Client Examples

## 使用 统一响应适配器 (Unified Response Adapter)

### Next.js App Router 示例

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@svton/types';

const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    // 统一错误处理
    if (response.code === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-token');
        window.location.href = '/login';
      }
    }
  },
});

export const { api, apiAsync, runGenerator } = createApiClient(adapter, {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  interceptors: {
    request: [
      createTokenInterceptor(() => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem('auth-token');
        }
        return null;
      }),
    ],
  },
});
```

```typescript
// app/users/[id]/page.tsx
import { apiAsync } from '@/lib/api-client';

export default async function UserPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // 服务端获取数据
  const user = await apiAsync('GET:/users/:id', { 
    id: Number(params.id) 
  });
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

```typescript
// components/user-profile.tsx
'use client';

import { useState } from 'react';
import { apiAsync } from '@/lib/api-client';
import { usePersistFn } from '@svton/hooks';

export function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUser = usePersistFn(async () => {
    setLoading(true);
    try {
      const data = await apiAsync('GET:/users/:id', { id: userId });
      setUser(data);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div>
      <button onClick={loadUser}>Load User</button>
      {loading && <div>Loading...</div>}
      {user && <div>{user.name}</div>}
    </div>
  );
}
```

### Taro 小程序示例

```typescript
// src/utils/api-client.ts
import Taro from '@tarojs/taro';
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@svton/types';

// 创建 Taro fetcher
const taroFetcher = async (url: string, init?: RequestInit) => {
  const response = await Taro.request({
    url,
    method: (init?.method || 'GET') as any,
    header: init?.headers as any,
    data: init?.body ? JSON.parse(init.body as string) : undefined,
  });
  
  return {
    json: async () => response.data,
  } as Response;
};

// 创建适配器
const adapter = createUnifiedResponseAdapter(taroFetcher, {
  successCode: 0,
  onError: (response) => {
    // 统一错误处理
    if (response.code === 401) {
      Taro.removeStorageSync('token');
      Taro.redirectTo({ url: '/pages/login/index' });
    } else if (response.code !== 0) {
      Taro.showToast({
        title: response.message,
        icon: 'none',
        duration: 2000,
      });
    }
  },
});

// 创建客户端
export const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      createTokenInterceptor(() => Taro.getStorageSync('token')),
    ],
  },
});
```

```typescript
// src/pages/user/index.tsx
import { View, Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { NavBar, StatusBar, LoadingState, ErrorState } from '@svton/taro-ui';
import { apiAsync } from '@/utils/api-client';
import type { UserVo } from '@svton/types';

export default function UserPage() {
  const [user, setUser] = useState<UserVo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    apiAsync('GET:/auth/me')
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  return (
    <View className="page">
      <StatusBar />
      <NavBar title="个人中心" />
      
      {loading && <LoadingState />}
      {error && <ErrorState message={error.message} />}
      {user && (
        <View className="user-info">
          <Text>{user.name}</Text>
          <Text>{user.email}</Text>
        </View>
      )}
    </View>
  );
}
```

### 使用 Generator API

```typescript
// lib/data-loader.ts
import { api, runGenerator } from '@/lib/api-client';

export function* loadDashboard() {
  // 串行加载多个 API
  const user = yield* api('GET:/auth/me');
  const posts = yield* api('GET:/posts', { userId: user.id, limit: 10 });
  const notifications = yield* api('GET:/notifications');
  
  return {
    user,
    posts,
    notifications,
  };
}

// 使用
const dashboard = await runGenerator(loadDashboard());
```

### 错误处理示例

```typescript
import { apiAsync } from '@/lib/api-client';
import { ApiError } from '@svton/api-client';

async function updateUser(id: number, data: UpdateUserDto) {
  try {
    const user = await apiAsync('PUT:/users/:id', { id, data });
    return { success: true, user };
  } catch (error) {
    if (error instanceof ApiError) {
      // 业务错误
      console.error('API Error:', {
        code: error.code,
        message: error.message,
        traceId: error.details?.traceId,
      });
      
      // 特殊错误处理
      if (error.code === 409) {
        return { success: false, error: '用户名已存在' };
      }
      
      return { success: false, error: error.message };
    } else {
      // 网络错误
      console.error('Network Error:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }
}
```

### 配合 SWR 使用

```typescript
// hooks/useAPI.ts
import useSWR from 'swr';
import { apiAsync } from '@/lib/api-client';
import type { ApiName, ApiParams, ApiResponse } from '@svton/api-client';

export function useQuery<K extends ApiName>(
  apiName: K,
  params: ApiParams<K> | null
) {
  return useSWR(
    params ? [apiName, params] : null,
    ([name, p]) => apiAsync(name, p)
  );
}

// 使用
function UserProfile({ userId }: { userId: number }) {
  const { data: user, error, isLoading } = useQuery('GET:/users/:id', {
    id: userId,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{user.name}</div>;
}
```

### 批量请求示例

```typescript
import { apiAsync } from '@/lib/api-client';

async function loadMultipleUsers(userIds: number[]) {
  // 并行请求
  const users = await Promise.all(
    userIds.map(id => apiAsync('GET:/users/:id', { id }))
  );
  
  return users;
}

// 使用
const users = await loadMultipleUsers([1, 2, 3, 4, 5]);
```

### 分页加载示例

```typescript
import { useState } from 'react';
import { apiAsync } from '@/lib/api-client';
import { usePersistFn } from '@svton/hooks';
import type { PaginatedResponse } from '@svton/nestjs-http';

export function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = usePersistFn(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const result = await apiAsync('GET:/posts', { 
        page, 
        pageSize: 20 
      });
      
      setPosts(prev => [...prev, ...result.items]);
      setPage(prev => prev + 1);
      setHasMore(result.page < result.totalPages);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## 响应格式说明

### NestJS HTTP 响应格式

```typescript
// 成功响应
{
  code: 0,
  message: "success",
  data: {
    id: 1,
    name: "John Doe",
    email: "john@example.com"
  },
  traceId: "abc-123-def",
  timestamp: "2024-01-01T00:00:00.000Z"
}

// 错误响应
{
  code: 404,
  message: "User not found",
  data: null,
  traceId: "abc-123-def",
  timestamp: "2024-01-01T00:00:00.000Z"
}

// 分页响应
{
  code: 0,
  message: "success",
  data: {
    items: [...],
    total: 100,
    page: 1,
    pageSize: 20,
    totalPages: 5
  },
  traceId: "abc-123-def",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

适配器会自动提取 `data` 字段，所以你的代码中直接得到业务数据：

```typescript
const user = await apiAsync('GET:/users/:id', { id: 1 });
// user 就是 { id: 1, name: "John Doe", email: "john@example.com" }
// 而不是完整的响应对象
```

## 最佳实践

1. **统一错误处理**：在 adapter 的 `onError` 中处理通用错误
2. **使用 usePersistFn**：避免回调函数的闭包陷阱
3. **类型安全**：在 `@svton/types` 中定义所有 API 类型
4. **环境变量**：使用环境变量配置 API baseURL
5. **Token 管理**：使用 interceptor 统一处理认证
6. **错误提示**：在 UI 层统一展示错误信息
