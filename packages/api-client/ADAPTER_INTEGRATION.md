# API Client - NestJS HTTP Adapter 集成说明

## 概述

为 `@svton/api-client` 添加了 NestJS HTTP Adapter，用于适配 `@svton/nestjs-http` 的统一响应格式。

## 新增文件

```
packages/api-client/
├── src/
│   ├── adapters/
│   │   ├── index.ts                    # 适配器导出
│   │   ├── nestjs-http.adapter.ts      # NestJS HTTP 适配器实现
│   │   └── README.md                   # 适配器使用文档
│   └── ...
├── EXAMPLES.md                          # 使用示例
└── ADAPTER_INTEGRATION.md              # 本文档
```

## 功能特性

### 1. 自动响应解包

适配器会自动处理 `@svton/nestjs-http` 的响应格式：

```typescript
// 后端响应
{
  code: 0,
  message: "success",
  data: { id: 1, name: "John" },
  traceId: "abc-123",
  timestamp: "2024-01-01T00:00:00.000Z"
}

// 适配器自动提取 data
const user = await apiAsync('GET:/users/:id', { id: 1 });
// user = { id: 1, name: "John" }
```

### 2. 错误处理

- 自动检查 `response.code`
- 当 `code !== successCode` 时抛出 `ApiError`
- 支持自定义错误处理回调

```typescript
const adapter = createNestJSHttpAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    if (response.code === 401) {
      // 跳转登录
      window.location.href = '/login';
    }
  },
});
```

### 3. 调试信息保留

错误对象中保留 `traceId` 和 `timestamp`：

```typescript
try {
  await apiAsync('GET:/users/:id', { id: 999 });
} catch (error) {
  console.log(error.details.traceId);    // "abc-123"
  console.log(error.details.timestamp);  // "2024-01-01T00:00:00.000Z"
}
```

## 使用方式

### Next.js 项目

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createNestJSHttpAdapter } from '@svton/api-client/adapters';
import '@svton/types';

const adapter = createNestJSHttpAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    if (response.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
});

export const { apiAsync } = createApiClient(adapter, {
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  interceptors: {
    request: [
      createTokenInterceptor(() => localStorage.getItem('token'))
    ]
  }
});
```

### Taro 小程序

```typescript
// src/utils/api-client.ts
import Taro from '@tarojs/taro';
import { createApiClient } from '@svton/api-client';
import { createNestJSHttpAdapter } from '@svton/api-client/adapters';

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

const adapter = createNestJSHttpAdapter(taroFetcher, {
  onError: (response) => {
    if (response.code === 401) {
      Taro.redirectTo({ url: '/pages/login/index' });
    } else {
      Taro.showToast({ title: response.message, icon: 'none' });
    }
  },
});

export const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
});
```

## 配置选项

```typescript
interface NestJSHttpAdapterConfig {
  /**
   * 成功响应的 code 值（默认 0）
   */
  successCode?: number;
  
  /**
   * 是否在错误时抛出 ApiError（默认 true）
   */
  throwOnError?: boolean;
  
  /**
   * 自定义错误处理
   */
  onError?: (response: NestJSHttpResponse) => void;
}
```

## 类型定义

```typescript
// NestJS HTTP 响应格式
interface NestJSHttpResponse<T = any> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}
```

## 包导出配置

更新了 `package.json` 以支持子路径导入：

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./adapters": {
      "types": "./dist/adapters/index.d.ts",
      "import": "./dist/adapters/index.mjs",
      "require": "./dist/adapters/index.js"
    }
  }
}
```

## 构建配置

更新了构建脚本以同时构建主包和适配器：

```json
{
  "scripts": {
    "build": "tsup src/index.ts src/adapters/index.ts --format cjs,esm --dts"
  }
}
```

## 文档更新

1. **README.md**: 添加了 NestJS HTTP Adapter 的使用说明
2. **EXAMPLES.md**: 提供了完整的使用示例
3. **adapters/README.md**: 详细的适配器文档
4. **CHANGELOG.md**: 记录了版本变更
5. **.kiro/steering/svton-development.md**: 更新了开发指南

## 版本变更

- 版本号从 `1.1.0` 升级到 `1.2.0`
- 新增 Minor 功能：NestJS HTTP Adapter

## 测试建议

1. **单元测试**：测试适配器的响应解包和错误处理
2. **集成测试**：在实际项目中测试与 `@svton/nestjs-http` 的集成
3. **错误场景**：测试各种错误码的处理
4. **环境适配**：测试在浏览器、Node.js、小程序环境下的表现

## 后续优化

1. 添加单元测试
2. 支持更多响应格式的适配器（如 GraphQL、gRPC）
3. 添加响应缓存功能
4. 支持请求重试机制
5. 添加请求/响应日志

## 相关文档

- [API Client README](./README.md)
- [使用示例](./EXAMPLES.md)
- [适配器文档](./src/adapters/README.md)
- [NestJS HTTP 文档](../nestjs-http/README.md)
