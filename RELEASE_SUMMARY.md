# @svton/api-client v1.3.0 发布总结

## 📦 发布信息

- **包名**: @svton/api-client
- **版本**: 1.3.0
- **发布类型**: Minor (新增功能)
- **发布状态**: ✅ 准备就绪

## 🎯 新增功能

### 统一响应适配器（Unified Response Adapter）

新增 `@svton/api-client/adapters` 子包，提供统一响应格式的适配器。

#### 核心功能

- ✅ 自动提取 `response.data` 作为返回值
- ✅ 检查 `response.code` 并在错误时抛出 `ApiError`
- ✅ 支持多种 code 类型（数字、字符串）
- ✅ 支持自定义错误处理回调
- ✅ 保留 `traceId` 和 `timestamp` 用于调试
- ✅ 自定义响应格式验证

#### 兼容框架

- `@svton/nestjs-http` (code: 0)
- Spring Boot (code: 200)
- 自定义格式 (code: "SUCCESS", "OK" 等)

## 📝 使用示例

```typescript
import { createApiClient } from '@svton/api-client';
import { createUnifiedResponseAdapter } from '@svton/api-client/adapters';

// 创建适配器
const adapter = createUnifiedResponseAdapter(fetch, {
  successCode: 0,  // 根据后端调整
  onError: (response) => {
    if (response.code === 401) {
      window.location.href = '/login';
    }
  }
});

// 创建 API 客户端
const { apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com'
});

// 使用
const user = await apiAsync('GET:/users/:id', { id: 1 });
```

## 📚 文档

### 新增文档
- ✅ `README.md` - 更新主文档
- ✅ `src/adapters/README.md` - 适配器详细文档
- ✅ `EXAMPLES.md` - 完整使用示例
- ✅ `QUICK_START.md` - 5 分钟快速上手
- ✅ `INTEGRATION_TEST.md` - 集成测试说明
- ✅ `ADAPTER_INTEGRATION.md` - 集成说明
- ✅ `ADAPTER_FINAL_SUMMARY.md` - 功能总结

### 更新文档
- ✅ `CHANGELOG.md` - 版本变更记录
- ✅ `.kiro/steering/svton-development.md` - 开发指南

## 🏗️ 构建验证

```bash
✅ pnpm build - 构建成功
✅ pnpm type-check - 类型检查通过
✅ 导入测试通过
✅ 适配器兼容性验证通过
```

## 📦 包导出

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

## 🔄 发布流程

### 已完成
1. ✅ 代码实现
2. ✅ 类型定义
3. ✅ 文档编写
4. ✅ 构建验证
5. ✅ 创建 changeset
6. ✅ 版本更新 (1.3.0)
7. ✅ CHANGELOG 生成

### 待执行
```bash
# 发布到 npm
pnpm changeset publish

# 推送 git tags
git push --follow-tags
```

## 🎯 Breaking Changes

无破坏性变更，完全向后兼容。

## 📊 影响范围

- **新增**: `@svton/api-client/adapters` 子包
- **更新**: 主包导出，新增 `HttpRequestConfig` 类型
- **兼容**: 完全向后兼容，不影响现有代码

## 🚀 后续计划

### 短期
- 添加单元测试
- 添加集成测试
- 性能基准测试

### 中期
- 支持响应缓存
- 支持请求重试
- 添加请求/响应日志

### 长期
- GraphQL 适配器
- gRPC 适配器
- 更多响应格式支持

## 📞 联系方式

如有问题，请通过以下方式联系：
- GitHub Issues: https://github.com/svton/api-client/issues
- 文档: https://751848178.github.io/svton

---

**发布准备完成！** 🎉
