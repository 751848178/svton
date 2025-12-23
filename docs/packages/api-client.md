# @svton/api-client

TypeScript API 客户端，支持模块增强、拦截器和类型安全。

## 安装

```bash
npm install @svton/api-client
```

## 基本使用

```typescript
import { createApiClient } from '@svton/api-client'

const api = createApiClient({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
})

// 发起请求
const response = await api.get('/users')
```

## 类型安全

通过模块增强定义 API 类型：

```typescript
// types/api.d.ts
declare module '@svton/api-client' {
  interface ApiEndpoints {
    '/users': {
      GET: {
        response: User[]
      }
      POST: {
        body: CreateUserDto
        response: User
      }
    }
    '/users/:id': {
      GET: {
        params: { id: string }
        response: User
      }
    }
  }
}
```

使用时自动获得类型提示：

```typescript
// response 类型自动推断为 User[]
const users = await api.get('/users')

// body 类型自动推断为 CreateUserDto
await api.post('/users', { phone: '13800138000' })
```

## 拦截器

```typescript
import { createApiClient, addRequestInterceptor, addResponseInterceptor } from '@svton/api-client'

const api = createApiClient({ baseURL: '/api' })

// 请求拦截器 - 添加 Token
addRequestInterceptor(api, (config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 - 错误处理
addResponseInterceptor(api, {
  onSuccess: (response) => response,
  onError: (error) => {
    if (error.status === 401) {
      // 跳转登录
    }
    return Promise.reject(error)
  }
})
```

## 配置选项

```typescript
interface ApiClientConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}
```

## 与 SWR 集成

```typescript
import useSWR from 'swr'
import { api } from '@/lib/api-client'

function useUsers() {
  return useSWR('/users', () => api.get('/users'))
}
```
