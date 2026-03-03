# @svton/service

## 0.5.0

### Minor Changes

- # 类型系统重大改进

  ## 新特性
  - ✅ **无需可选链** - 所有属性都从 Service 类直接推断，不再需要使用 `?.()` 可选链
  - ✅ **完整的类型推断** - TypeScript 能够检查所有属性的存在性和类型匹配
  - ✅ **Go to Definition 支持** - Cmd/Ctrl + Click 可以跳转到 Service 类的原始定义
  - ✅ **运行时验证** - 错误使用时抛出清晰的错误提示

  ## 类型定义改进
  - 重构 `StateHooks<T>` - 包含所有非函数属性
  - 重构 `DerivedHooks<T>` - 包含所有非函数属性（getter 在类型层面是属性）
  - 重构 `ActionHooks<T>` - 包含所有函数属性
  - 添加运行时装饰器验证，提供清晰的错误提示

  ## 使用方式

  ```typescript
  @Service()
  class UserService {
    @observable count = 0;

    @computed
    get doubled() {
      return this.count * 2;
    }

    @action
    increment() {
      this.count++;
    }
  }

  const service = useUserService();

  // ✅ 无需可选链，类型精确匹配
  const count = service.useState.count(); // number
  const doubled = service.useDerived.doubled(); // number
  const increment = service.useAction.increment(); // () => void
  ```

  ## 文档
  - 新增 `TYPESCRIPT_GUIDE.md` - 详细的类型系统指南
  - 新增 `TYPE_SYSTEM_IMPROVEMENTS.md` - 技术实现说明
  - 新增 `MIGRATION_GUIDE.md` - 迁移指南（如果之前使用了可选链）
  - 新增 `FINAL_SOLUTION.md` - 完整解决方案说明
  - 更新 `README.md` - 更新使用示例

  ## 破坏性变更

  无破坏性变更。如果之前的代码使用了 `?.()` 可选链，建议移除以获得更好的类型体验，但保留也能正常工作。

## 0.4.0

### Minor Changes

- Initial release of @svton/service and @svton/logger packages.

  ### @svton/service
  - React service-based state management with decorators
  - Decorators: @Service(), @observable, @computed, @action, @Inject()
  - createService() for scoped instances
  - createServiceProvider() for shared instances (Provider pattern)
  - API: service.useState.xxx(), service.useDerived.xxx(), service.useAction.xxx()

  ### @svton/logger
  - Frontend logging and error tracking with plugin support
  - Log levels: debug, info, warn, error
  - Stack trace support (configurable via stackLevel)
  - Batch/immediate report strategies
  - Dynamic config modification
  - Global error and unhandled rejection capture
  - Performance monitoring (Web Vitals)
  - Built-in plugins: sensitive-filter, breadcrumb

## 0.3.0

### Minor Changes

- feat: 发布所有包的新版本

  ### 前端包
  - `@svton/ui`: React UI 组件库更新
  - `@svton/taro-ui`: Taro 小程序 UI 组件库更新
  - `@svton/hooks`: React Hooks 工具库更新

  ### 工具包
  - `@svton/logger`: 日志工具库更新
  - `@svton/service`: 服务层工具库更新
  - `@svton/dynamic-config`: 动态配置库更新
  - `@svton/api-client`: API 客户端更新
  - `@svton/cli`: CLI 工具更新

  ### NestJS 模块
  - `@svton/nestjs-authz`: 授权模块更新
  - `@svton/nestjs-cache`: 缓存模块更新
  - `@svton/nestjs-config-schema`: 配置 Schema 模块更新
  - `@svton/nestjs-http`: HTTP 模块更新
  - `@svton/nestjs-logger`: 日志模块更新
  - `@svton/nestjs-oauth`: OAuth 模块更新
  - `@svton/nestjs-object-storage`: 对象存储模块更新
  - `@svton/nestjs-object-storage-qiniu-kodo`: 七牛云存储模块更新
  - `@svton/nestjs-payment`: 支付模块更新
  - `@svton/nestjs-queue`: 队列模块更新
  - `@svton/nestjs-rate-limit`: 限流模块更新
  - `@svton/nestjs-redis`: Redis 模块更新
  - `@svton/nestjs-sms`: 短信模块更新

## 0.2.0

### Minor Changes

- Initial release of @svton/service and @svton/logger packages
