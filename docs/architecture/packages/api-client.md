# @svton/api-client

> 统一的 API 客户端包 - 类型安全的 API 调用

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/api-client` |
| **版本** | `1.0.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **类型安全** - API 定义包含完整的请求/响应类型
2. **统一管理** - 所有 API 集中定义，避免散落
3. **跨平台** - 支持 Admin (Axios) 和 Mobile (Taro.request)

---

## 📁 目录结构

```
packages/api-client/src/
├── modules/                # API 模块定义
│   ├── auth/               # 认证相关 API
│   ├── user/               # 用户相关 API
│   ├── content/            # 内容相关 API
│   ├── category/           # 分类相关 API
│   ├── tag/                # 标签相关 API
│   ├── comment/            # 评论相关 API
│   ├── upload/             # 上传相关 API
│   ├── search/             # 搜索相关 API
│   └── index.ts            # 模块导出
├── client.ts               # 基础客户端
├── client-v2.ts            # V2 客户端
├── define.ts               # API 定义工具
├── interceptors.ts         # 拦截器
├── registry.ts             # API 注册表
├── types.ts                # 内部类型
└── index.ts                # 导出入口
```

---

## 📝 API 定义

### 使用 defineApi

```typescript
// packages/api-client/src/modules/content/index.ts
import { defineApi } from '../../define';
import type {
  ContentVo,
  ContentDetailVo,
  CreateContentDto,
  QueryContentDto,
  PaginatedResponse,
} from '@svton/types';

// 获取内容列表
export const getContentList = defineApi<
  QueryContentDto,
  PaginatedResponse<ContentVo>
>('GET', '/contents');

// 获取内容详情
export const getContentDetail = defineApi<
  { id: number },
  ContentDetailVo
>('GET', '/contents/:id');

// 创建内容
export const createContent = defineApi<
  CreateContentDto,
  ContentDetailVo
>('POST', '/contents');

// 更新内容
export const updateContent = defineApi<
  { id: number } & Partial<CreateContentDto>,
  ContentDetailVo
>('PUT', '/contents/:id');

// 删除内容
export const deleteContent = defineApi<
  { id: number },
  void
>('DELETE', '/contents/:id');
```

### defineApi 函数签名

```typescript
function defineApi<TParams, TResponse>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string
): ApiDefinition<TParams, TResponse>;
```

---

## 🔧 客户端使用

### Admin 端 (Next.js)

```typescript
// apps/admin/src/lib/api-client.ts
import { createApiClient } from '@svton/api-client';

const apiClient = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  getToken: () => localStorage.getItem('token'),
});

export const apiAsync = apiClient.request;
```

### 使用 SWR Hooks (推荐)

```typescript
// apps/admin/src/hooks/useAPI.ts
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiAsync } from '@/lib/api-client';

// 查询 Hook
export function useQuery<TParams, TResponse>(
  key: string,
  params?: TParams,
  options?: { enabled?: boolean }
) {
  return useSWR(
    options?.enabled === false ? null : [key, params],
    () => apiAsync<TResponse>(key, params)
  );
}

// 变更 Hook
export function useMutation<TParams, TResponse>(key: string) {
  return useSWRMutation(
    key,
    (_, { arg }: { arg: TParams }) => apiAsync<TResponse>(key, arg)
  );
}
```

### 在组件中使用

```typescript
// apps/admin/src/app/(admin)/contents/page.tsx
'use client';

import { useQuery, useMutation } from '@/hooks/useAPI';
import type { ContentVo, PaginatedResponse } from '@svton/types';

export default function ContentsPage() {
  // 查询列表
  const { data, isLoading, mutate } = useQuery<
    { page: number },
    PaginatedResponse<ContentVo>
  >('GET:/contents', { page: 1 });

  // 删除操作
  const { trigger: deleteContent } = useMutation<{ id: number }, void>(
    'DELETE:/contents/:id'
  );

  const handleDelete = async (id: number) => {
    await deleteContent({ id });
    mutate(); // 刷新列表
  };

  if (isLoading) return <Loading />;

  return (
    <div>
      {data?.list.map(item => (
        <div key={item.id}>
          {item.title}
          <button onClick={() => handleDelete(item.id)}>删除</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 📱 Mobile 端 (Taro)

### 配置客户端

```typescript
// apps/mobile/src/services/api.ts
import Taro from '@tarojs/taro';
import { useAuthStore } from '@/store/auth';

const BASE_URL = 'http://localhost:3000';

export async function apiAsync<T>(
  key: string,
  params?: Record<string, any>
): Promise<T> {
  const [method, pathTemplate] = key.split(':') as [string, string];
  
  // 替换路径参数
  let path = pathTemplate;
  const queryParams: Record<string, any> = {};
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (path.includes(`:${key}`)) {
        path = path.replace(`:${key}`, String(value));
      } else {
        queryParams[key] = value;
      }
    });
  }

  const token = useAuthStore.getState().token;

  const response = await Taro.request({
    url: `${BASE_URL}${path}`,
    method: method as any,
    data: method === 'GET' ? undefined : queryParams,
    header: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}
```

### useAPI Hook

```typescript
// apps/mobile/src/hooks/useAPI-v2.ts
import { useState, useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiAsync } from '@/services/api';

export function useAPI<TParams, TResponse>(
  key: string,
  params?: TParams,
  options?: { immediate?: boolean }
) {
  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = usePersistFn(async (fetchParams?: TParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiAsync<TResponse>(key, fetchParams ?? params);
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (options?.immediate !== false) {
      fetch();
    }
  }, []);

  return { data, loading, error, refresh: fetch };
}
```

---

## 🔐 认证处理

### Token 管理

```typescript
// 登录后保存 token
const { data } = await apiAsync('POST:/auth/login', { username, password });
localStorage.setItem('token', data.accessToken);

// 请求时自动携带
// 由 apiClient 的 getToken 配置处理
```

### 401 处理

```typescript
// interceptors.ts
export function createResponseInterceptor(onUnauthorized?: () => void) {
  return (response: any) => {
    if (response.status === 401) {
      onUnauthorized?.();
      // 跳转登录页
    }
    return response;
  };
}
```

---

## ➕ 添加新 API

### 1. 定义 API

```typescript
// packages/api-client/src/modules/example/index.ts
import { defineApi } from '../../define';
import type { ExampleVo, CreateExampleDto } from '@svton/types';

export const getExampleList = defineApi<
  { page: number },
  { list: ExampleVo[]; total: number }
>('GET', '/examples');

export const createExample = defineApi<
  CreateExampleDto,
  ExampleVo
>('POST', '/examples');
```

### 2. 导出模块

```typescript
// packages/api-client/src/modules/index.ts
export * from './example';
```

### 3. 使用

```typescript
import { useQuery, useMutation } from '@/hooks/useAPI';

// 查询
const { data } = useQuery('GET:/examples', { page: 1 });

// 创建
const { trigger } = useMutation('POST:/examples');
await trigger({ title: '新示例' });
```

---

## ✅ 最佳实践

1. **统一使用 Hooks**
   - Admin: `useQuery` / `useMutation`
   - Mobile: `useAPI` / `useMutation`

2. **避免直接调用**
   ```typescript
   // ❌ 不推荐
   const data = await apiAsync('GET:/contents', {});
   
   // ✅ 推荐
   const { data } = useQuery('GET:/contents', {});
   ```

3. **类型安全**
   ```typescript
   // 明确指定类型
   const { data } = useQuery<QueryDto, ResponseVo>('GET:/api', params);
   ```

---

**相关文档**: [@svton/types](./types.md) | [@svton/hooks](./hooks.md)
