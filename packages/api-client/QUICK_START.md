# Quick Start - NestJS HTTP Adapter

## 5 分钟快速上手

### 1. 安装依赖

```bash
pnpm add @svton/api-client @svton/types
```

### 2. 定义 API 类型（在 @svton/types 中）

```typescript
// packages/types/src/apis/user.ts
import type { ApiDefinition } from '@svton/api-client';

declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/users/:id': ApiDefinition<{ id: number }, UserVo>;
    'PUT:/users/:id': ApiDefinition<{ id: number; data: UpdateUserDto }, UserVo>;
    'GET:/users': ApiDefinition<{ page?: number; pageSize?: number }, PaginatedResponse<UserVo>>;
  }
}

export interface UserVo {
  id: number;
  name: string;
  email: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
}
```

### 3. 创建 API 客户端

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';
import '@svton/types'; // 启用类型增强

// 创建适配器
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0, // 成功响应的 code
  onError: (response) => {
    // 统一错误处理
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
});

// 创建客户端
export const { apiAsync } = createApiClient(adapter, {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  interceptors: {
    request: [
      // 自动添加 token
      createTokenInterceptor(() => localStorage.getItem('token')),
    ],
  },
});
```

### 4. 使用 API

```typescript
// 获取用户
const user = await apiAsync('GET:/users/:id', { id: 1 });
console.log(user.name); // 类型安全！

// 更新用户
const updated = await apiAsync('PUT:/users/:id', {
  id: 1,
  data: { name: 'New Name' }
});

// 获取用户列表
const users = await apiAsync('GET:/users', { 
  page: 1, 
  pageSize: 20 
});
console.log(users.items); // 类型安全的分页数据
```

### 5. 错误处理

```typescript
import { ApiError } from '@svton/api-client';

try {
  const user = await apiAsync('GET:/users/:id', { id: 999 });
} catch (error) {
  if (error instanceof ApiError) {
    console.log('错误码:', error.code);
    console.log('错误信息:', error.message);
    console.log('追踪 ID:', error.details.traceId);
  }
}
```

## 响应格式说明

### 后端响应（@svton/nestjs-http）

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "traceId": "abc-123-def",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 前端接收（自动解包）

```typescript
const user = await apiAsync('GET:/users/:id', { id: 1 });
// user = { id: 1, name: "John Doe", email: "john@example.com" }
// 适配器自动提取了 response.data
```

## 常见场景

### 场景 1: 登录

```typescript
// 定义类型
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/auth/login': ApiDefinition<LoginDto, LoginVo>;
  }
}

// 使用
const result = await apiAsync('POST:/auth/login', {
  phone: '13800138000',
  password: '123456'
});

localStorage.setItem('token', result.token);
```

### 场景 2: 文件上传

```typescript
// 定义类型
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/upload': ApiDefinition<{ file: File }, { url: string }>;
  }
}

// 使用
const formData = new FormData();
formData.append('file', file);

const result = await apiAsync('POST:/upload', formData);
console.log(result.url);
```

### 场景 3: 分页列表

```typescript
import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';

function UserList() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);

  const loadUsers = usePersistFn(async () => {
    const result = await apiAsync('GET:/users', { 
      page, 
      pageSize: 20 
    });
    setUsers(result.items);
  });

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={() => setPage(p => p + 1)}>下一页</button>
    </div>
  );
}
```

## 环境配置

### Next.js

```typescript
// .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Taro

```typescript
// src/config.ts
export const API_BASE_URL = process.env.TARO_ENV === 'weapp'
  ? 'https://api.example.com'
  : 'http://localhost:3000';
```

## 下一步

- 查看 [完整文档](./README.md)
- 查看 [使用示例](./EXAMPLES.md)
- 查看 [适配器文档](./src/adapters/README.md)
