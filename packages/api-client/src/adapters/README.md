# API Client Adapters

适配器用于将不同的 HTTP 客户端和响应格式适配到 `@svton/api-client` 的统一接口。

## Unified Response Adapter（统一响应适配器）

适配常见的统一响应格式，兼容多种后端框架。

### 支持的响应格式

```typescript
{
  code: 0 | 200 | "SUCCESS",  // 业务状态码
  message: "success",          // 响应消息
  data: { ... },              // 业务数据
  traceId?: "...",            // 可选的追踪 ID
  timestamp?: "..."           // 可选的时间戳
}
```

**兼容框架**：
- `@svton/nestjs-http` - code: 0
- Spring Boot - code: 200
- 自定义格式 - code: "SUCCESS" 等

### 基础使用

```typescript
import { createApiClient } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

// @svton/nestjs-http 格式（code: 0）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0
});

// Spring Boot 格式（code: 200）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 200
});

// 自定义格式（code: "SUCCESS"）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: "SUCCESS"
});

// 创建 API 客户端
const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
});

// 使用
const user = await apiAsync('GET:/users/:id', { id: 123 });
// 自动提取 response.data，返回业务数据
```

### 配置选项

```typescript
const adapter = createUnifiedResponseAdapter(fetch, {
  // 成功响应的 code 值（默认 0）
  // 支持数字或字符串
  successCode: 0,  // 或 200, "SUCCESS" 等
  
  // 是否在错误时抛出 ApiError（默认 true）
  throwOnError: true,
  
  // 自定义错误处理
  onError: (response) => {
    console.error('API Error:', response.code, response.message);
    
    // 特殊错误处理
    if (response.code === 401 || response.code === "UNAUTHORIZED") {
      // 跳转到登录页
      window.location.href = '/login';
    }
  },
  
  // 自定义响应格式验证（可选）
  validateResponse: (data) => {
    return data && 'code' in data && 'message' in data && 'data' in data;
  }
});
```

### 错误处理

适配器会自动检查 `code` 字段，当 `code !== successCode` 时：

1. 触发 `onError` 回调（如果配置）
2. 抛出 `ApiError`（如果 `throwOnError: true`）

```typescript
import { ApiError } from '@svton/api-client';

try {
  const user = await apiAsync('GET:/users/:id', { id: 999 });
} catch (error) {
  if (error instanceof ApiError) {
    console.log('Error Code:', error.code);      // 404
    console.log('Error Message:', error.message); // "User not found"
    console.log('Trace ID:', error.details.traceId);
    console.log('Timestamp:', error.details.timestamp);
  }
}
```

### 与拦截器配合使用

```typescript
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 根据你的后端调整
  onError: (response) => {
    // 401 错误统一处理
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
});

const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      // 自动添加 token
      createTokenInterceptor(() => localStorage.getItem('token')),
    ],
  },
});
```

### Next.js 完整示例

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@svton/types'; // 启用类型增强

// 创建适配器（适配 @svton/nestjs-http）
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    // 统一错误处理
    if (response.code === 401) {
      localStorage.removeItem('auth-token');
      window.location.href = '/login';
    }
  },
});

// 创建客户端
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

export default async function UserPage({ params }: { params: { id: string } }) {
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

### Taro 小程序示例

```typescript
// src/utils/api-client.ts
import Taro from '@tarojs/taro';
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@svton/types';

// 使用 Taro.request 作为 fetcher
const taroFetcher = async (url: string, init?: RequestInit) => {
  const response = await Taro.request({
    url,
    method: init?.method as any,
    header: init?.headers as any,
    data: init?.body ? JSON.parse(init.body as string) : undefined,
  });
  
  return {
    json: async () => response.data,
  } as Response;
};

const adapter = createUnifiedResponseAdapter(taroFetcher, {
  successCode: 0,  // 根据你的后端调整
  onError: (response) => {
    if (response.code === 401) {
      Taro.removeStorageSync('token');
      Taro.redirectTo({ url: '/pages/login/index' });
    } else {
      Taro.showToast({
        title: response.message,
        icon: 'none',
      });
    }
  },
});

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
import { apiAsync } from '@/utils/api-client';

export default function UserPage() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    apiAsync('GET:/auth/me').then(setUser);
  }, []);
  
  if (!user) return <View>Loading...</View>;
  
  return (
    <View>
      <Text>{user.name}</Text>
    </View>
  );
}
```

## 自定义适配器

你可以创建自己的适配器来适配其他响应格式：

```typescript
import { HttpAdapter, ApiError } from '@svton/api-client';

export function createCustomAdapter(): HttpAdapter {
  return {
    async request(config) {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
      });
      
      const result = await response.json();
      
      // 适配你的响应格式
      if (!result.success) {
        throw new ApiError(
          result.errorCode,
          result.errorMessage,
          result
        );
      }
      
      return result.payload;
    },
  };
}
```

## 最佳实践

1. **统一错误处理**：在 `onError` 中处理通用错误（如 401、403）
2. **类型安全**：配合 `@svton/types` 使用，获得完整的类型提示
3. **拦截器组合**：使用拦截器处理认证、日志等横切关注点
4. **环境适配**：根据运行环境（浏览器、Node.js、小程序）选择合适的 fetcher
