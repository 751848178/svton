# 统一响应适配器 - 集成测试

## 验证适配器兼容性

### 1. 类型兼容性 ✅

`createUnifiedResponseAdapter` 返回的对象完全符合 `HttpAdapter` 接口：

```typescript
// HttpAdapter 接口定义
interface HttpAdapter {
  request<T = any>(config: HttpRequestConfig): Promise<T>;
}

// createUnifiedResponseAdapter 返回
{
  async request<T = any>(requestConfig: HttpRequestConfig): Promise<T> {
    // 实现
  }
}
```

### 2. 完整使用示例

```typescript
import { createApiClient } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

// 1. 创建适配器
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,
  onError: (response) => {
    if (response.code === 401) {
      window.location.href = '/login';
    }
  }
});

// 2. 创建 API 客户端（适配器完全兼容）
const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com'
});

// 3. 使用
const user = await apiAsync('GET:/users/:id', { id: 1 });
```

### 3. 响应流程

```
用户调用 apiAsync
    ↓
createApiClient 调用 adapter.request()
    ↓
createUnifiedResponseAdapter 处理请求
    ↓
发送 HTTP 请求
    ↓
接收响应: { code: 0, message: "success", data: {...} }
    ↓
检查 code === successCode
    ↓
提取并返回 data
    ↓
用户获得业务数据
```

### 4. 错误处理流程

```
接收响应: { code: 404, message: "Not found", data: null }
    ↓
检查 code !== successCode
    ↓
触发 onError 回调
    ↓
抛出 ApiError
    ↓
用户捕获错误
```

## 测试场景

### 场景 1: 成功响应

**后端返回**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "John Doe"
  },
  "traceId": "abc-123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**前端接收**:
```typescript
const user = await apiAsync('GET:/users/:id', { id: 1 });
// user = { id: 1, name: "John Doe" }
```

### 场景 2: 错误响应

**后端返回**:
```json
{
  "code": 404,
  "message": "User not found",
  "data": null,
  "traceId": "abc-123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**前端处理**:
```typescript
try {
  const user = await apiAsync('GET:/users/:id', { id: 999 });
} catch (error) {
  // error instanceof ApiError
  // error.code = 404
  // error.message = "User not found"
  // error.details.traceId = "abc-123"
}
```

### 场景 3: 不同的 successCode

**Spring Boot (code: 200)**:
```typescript
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 200
});
```

**自定义格式 (code: "SUCCESS")**:
```typescript
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: "SUCCESS"
});
```

## 兼容性矩阵

| 后端框架 | code 类型 | successCode | 兼容性 |
|---------|----------|-------------|--------|
| @svton/nestjs-http | number | 0 | ✅ |
| Spring Boot | number | 200 | ✅ |
| 自定义格式 | string | "SUCCESS" | ✅ |
| 自定义格式 | string | "OK" | ✅ |

## 性能考虑

1. **响应解析** - 只解析一次 JSON
2. **类型检查** - 简单的对象属性检查，性能开销极小
3. **错误处理** - 只在错误时创建 ApiError 对象

## 最佳实践

1. **统一 successCode** - 在整个项目中使用相同的 successCode
2. **错误处理** - 在 onError 中处理通用错误（401、403 等）
3. **类型定义** - 在 @svton/types 中定义所有 API 类型
4. **调试信息** - 利用 traceId 进行问题追踪

## 总结

✅ 适配器完全兼容 `createApiClient`  
✅ 类型安全，编译时检查  
✅ 支持多种后端框架  
✅ 灵活的错误处理  
✅ 保留调试信息
