# API Client - Unified Response Adapter 实现总结

## 概述

为 `@svton/api-client` 包添加了统一响应适配器（Unified Response Adapter），用于适配常见的统一响应格式，兼容多种后端框架（包括 `@svton/nestjs-http`、Spring Boot 等），实现前后端的无缝集成。

## 核心功能

### 1. 响应格式适配

**支持的响应格式**：
```typescript
{
  code: 0 | 200 | "SUCCESS",  // 业务状态码（支持数字和字符串）
  message: "success",          // 响应消息
  data: { ... },              // 业务数据
  traceId?: "...",            // 追踪 ID（可选）
  timestamp?: "..."           // 时间戳（可选）
}
```

**兼容框架**：
- `@svton/nestjs-http` - code: 0
- Spring Boot - code: 200
- 自定义格式 - code: "SUCCESS" 等

**适配器处理**：
- 自动提取 `response.data` 作为返回值
- 检查 `response.code` 是否等于 `successCode`
- 错误时抛出 `ApiError`，包含 `traceId` 和 `timestamp`
- 支持自定义响应格式验证

### 2. 错误处理

```typescript
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 或 200, "SUCCESS" 等
  throwOnError: true,
  onError: (response) => {
    // 统一错误处理
    if (response.code === 401 || response.code === "UNAUTHORIZED") {
      window.location.href = '/login';
    }
  },
});
```

### 3. 类型安全

完整的 TypeScript 类型支持：
- `UnifiedResponse<T>` - 统一响应格式类型
- `UnifiedResponseAdapterConfig` - 配置选项类型
- `HttpRequestConfig` - 请求配置类型

## 文件结构

```
packages/api-client/
├── src/
│   ├── adapters/
│   │   ├── index.ts                       # 导出
│   │   ├── unified-response.adapter.ts    # 统一响应适配器实现
│   │   └── README.md                      # 适配器文档
│   ├── client.ts                          # 更新：导出 HttpRequestConfig
│   └── index.ts                           # 更新：导出 adapters
├── dist/
│   ├── adapters/
│   │   ├── index.js                       # CJS
│   │   ├── index.mjs                      # ESM
│   │   └── index.d.ts                     # 类型定义
│   └── ...
├── README.md                              # 更新：添加适配器说明
├── EXAMPLES.md                            # 新增：使用示例
├── QUICK_START.md                         # 新增：快速开始
├── ADAPTER_INTEGRATION.md                 # 新增：集成说明
├── CHANGELOG.md                           # 更新：版本记录
└── package.json                           # 更新：版本 1.2.0
```

## 代码变更

### 1. 新增适配器实现

**packages/api-client/src/adapters/unified-response.adapter.ts**

核心功能：
- `createUnifiedResponseAdapter()` - 创建适配器
- `isUnifiedResponse()` - 类型守卫
- 支持多种 code 类型（数字、字符串）
- 自动处理 query 参数和 body 数据
- 错误检测和转换

### 2. 更新导出

**packages/api-client/src/index.ts**
```typescript
// 新增
export * from './adapters';
export { type HttpRequestConfig } from './client';
```

**packages/api-client/src/client.ts**
```typescript
// 新增
export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  data?: any;
  params?: any;
  headers?: Record<string, string>;
}
```

### 3. 更新构建配置

**packages/api-client/package.json**
```json
{
  "version": "1.2.0",
  "exports": {
    ".": { ... },
    "./adapters": {
      "types": "./dist/adapters/index.d.ts",
      "import": "./dist/adapters/index.mjs",
      "require": "./dist/adapters/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/adapters/index.ts --format cjs,esm --dts"
  }
}
```

## 使用方式

### Next.js 项目

```typescript
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import { createNestJSHttpAdapter } from '@svton/api-client/adapters';

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
import Taro from '@tarojs/taro';
import { createNestJSHttpAdapter } from '@svton/api-client/adapters';

const taroFetcher = async (url: string, init?: RequestInit) => {
  const response = await Taro.request({
    url,
    method: init?.method as any,
    header: init?.headers as any,
    data: init?.body ? JSON.parse(init.body as string) : undefined,
  });
  
  return { json: async () => response.data } as Response;
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
```

## 文档更新

### 1. README.md
- 添加 NestJS HTTP Adapter 到功能列表
- 更新 Quick Start 部分，推荐使用适配器
- 添加到最佳实践

### 2. 新增文档
- **EXAMPLES.md** - 完整的使用示例（Next.js、Taro、错误处理等）
- **QUICK_START.md** - 5 分钟快速上手指南
- **ADAPTER_INTEGRATION.md** - 集成说明和技术细节
- **adapters/README.md** - 适配器详细文档

### 3. 开发指南
更新 `.kiro/steering/svton-development.md`，添加适配器使用说明

## 优势

### 1. 开发体验
- ✅ 自动响应解包，代码更简洁
- ✅ 统一错误处理，减少重复代码
- ✅ 完整的类型提示
- ✅ 保留调试信息（traceId、timestamp）

### 2. 代码质量
- ✅ 类型安全，编译时检查
- ✅ 错误处理标准化
- ✅ 易于测试和维护

### 3. 团队协作
- ✅ 统一的 API 调用方式
- ✅ 清晰的文档和示例
- ✅ 降低学习成本

## 示例对比

### 使用适配器前

```typescript
const response = await fetch('https://api.example.com/users/1');
const result = await response.json();

if (result.code !== 0) {
  throw new Error(result.message);
}

const user = result.data; // 需要手动提取
```

### 使用适配器后

```typescript
const user = await apiAsync('GET:/users/:id', { id: 1 });
// 自动提取 data，自动错误处理，完整类型提示
```

## 测试建议

### 单元测试
```typescript
describe('NestJSHttpAdapter', () => {
  it('should extract data from response', async () => {
    const adapter = createNestJSHttpAdapter(mockFetch);
    const result = await adapter.request({ ... });
    expect(result).toEqual({ id: 1, name: 'John' });
  });

  it('should throw ApiError on error code', async () => {
    const adapter = createNestJSHttpAdapter(mockFetch);
    await expect(adapter.request({ ... })).rejects.toThrow(ApiError);
  });
});
```

### 集成测试
- 在实际项目中测试与 `@svton/nestjs-http` 的集成
- 测试各种错误场景（401、404、500 等）
- 测试不同环境（浏览器、Node.js、小程序）

## 后续优化

1. **测试覆盖**
   - 添加单元测试
   - 添加集成测试
   - 添加 E2E 测试

2. **功能增强**
   - 支持响应缓存
   - 支持请求重试
   - 支持请求取消
   - 添加请求/响应日志

3. **更多适配器**
   - GraphQL 适配器
   - gRPC 适配器
   - 自定义格式适配器

4. **性能优化**
   - 请求合并
   - 响应压缩
   - 连接池管理

## 版本信息

- **版本号**: 1.2.0
- **发布日期**: 2024-02-08
- **变更类型**: Minor（新增功能）
- **向后兼容**: ✅ 是

## 相关链接

- [API Client README](./packages/api-client/README.md)
- [使用示例](./packages/api-client/EXAMPLES.md)
- [快速开始](./packages/api-client/QUICK_START.md)
- [适配器文档](./packages/api-client/src/adapters/README.md)
- [NestJS HTTP 文档](./packages/nestjs-http/README.md)
