# @svton/cli

## 2.0.0

### Major Changes

- 9c7222f: 重大修复：修复所有模板文件的类型错误和 API 使用问题

  这是一个重大版本更新，修复了生成项目中的所有 TypeScript 错误，确保生成的项目可以直接编译运行。

  **修复清单**：
  1. ✅ **authz.config.ts** - 移除不存在的 roles 配置
  2. ✅ **cache.config.ts** - 移除 redis 配置（Redis 通过 RedisModule 单独配置）
  3. ✅ **storage.config.ts** - 使用 adapter 模式配置（createQiniuAdapter）
  4. ✅ **oauth.config.ts** - 修复函数命名（useOAuthConfig）
  5. ✅ **authz/user.controller.ts** - 移除不存在的 Permissions 装饰器
  6. ✅ **cache/user.service.ts** - 将 pattern 改为 allEntries
  7. ✅ **storage/upload.service.ts** - 使用 ObjectStorageClient 和 @InjectObjectStorage()
  8. ✅ **oauth/auth.service.ts** - 修复 OAuth API 使用（正确处理 OAuthResult 包装类型）
  9. ✅ **storage/upload.controller.ts** - 添加 @types/multer 依赖说明
  10. ✅ **backend/package.json.tpl** - 添加 zod 和 @types/multer 依赖
  11. ✅ **ast-helper.ts** - 修复重复导入问题（检查已存在的 import）
  12. ✅ **Prisma 模板** - 创建 schema.prisma.tpl 和 seed.ts.tpl
  13. ✅ **features.ts** - 添加 copyPrismaTemplates 函数自动复制 Prisma 模板
  14. ✅ **create.ts** - 在创建后端项目时自动复制 Prisma 模板

  **主要改进**：
  - **OAuth API 修复**：所有 OAuth 方法现在正确返回 `OAuthResult<T>` 类型，需要检查 `success` 和访问 `data` 属性
  - **对象存储修复**：使用 adapter 模式配置，通过 `@InjectObjectStorage()` 注入客户端
  - **缓存装饰器修复**：使用 `allEntries: true` 替代不存在的 `pattern` 选项
  - **AST 注入改进**：避免重复导入相同的模块
  - **Prisma 支持**：自动生成 Prisma schema 和 seed 文件
  - **依赖完整性**：添加所有缺失的依赖（zod, @types/multer）

  **破坏性变更**：
  - OAuth API 调用方式已更改（需要处理 OAuthResult 包装类型）
  - 对象存储配置结构已更改（使用 adapter 模式）
  - 缓存装饰器选项已更改（pattern → allEntries）

  **迁移指南**：
  使用新版本创建的项目将自动包含所有修复，无需手动迁移。

## 1.4.1

### Patch Changes

- 修复配置文件类型错误和命名问题

  **修复内容**：
  - 修复 OAuth 配置函数命名：`useOauthConfig` → `useOAuthConfig`
  - 修复 storage.config.ts 中的 provider 类型
  - 修复 cache.config.ts 中的 redis 配置类型
  - 修复 oauth.config.ts 中的 platform 类型（使用 `as const`）
  - 所有 configService.get() 调用添加默认值或类型断言

  **改进**：
  - 确保生成的配置文件类型安全
  - 避免 TypeScript 类型错误
  - 提供更好的类型提示

## 1.4.0

### Minor Changes

- 重大功能：自动注入功能模块到 app.module.ts

  **新功能**：
  - 使用 AST 操作安全地修改 `app.module.ts` 文件
  - 自动添加模块导入语句
  - 自动注册功能模块到 imports 数组
  - 自动导入配置文件函数
  - 如果自动注入失败，生成手动集成说明文档作为备选方案

  **技术实现**：
  - 使用 `@babel/parser` 解析 TypeScript 代码
  - 使用 `@babel/traverse` 遍历 AST
  - 使用 `@babel/generator` 生成新代码
  - 确保代码格式正确，不破坏原有结构

  **用户体验**：
  - 创建项目后可以直接运行，无需手动配置
  - 所有功能模块自动集成完成
  - 配置文件、示例代码、环境变量全部就绪

## 1.3.0

### Minor Changes

- 重大改进：修复模板代码问题并优化功能集成流程

  **破坏性变更**：
  - 不再自动修改 `app.module.ts`，改为生成集成说明文档 `FEATURE_INTEGRATION.md`

  **功能改进**：
  - 生成完整的 `.env.example` 文件，包含所有功能的环境变量配置
  - 环境变量按功能分组，添加详细注释和说明
  - 生成 `FEATURE_INTEGRATION.md` 文档，提供清晰的模块集成步骤

  **模板修复**：
  - 删除冗余的 `authz/roles.guard.ts`，统一使用 `@svton/nestjs-authz` 包中的实现
  - 修复所有示例代码的导入和类型问题
  - 确保所有配置文件正确导出类型

  **文档改进**：
  - 添加详细的功能集成说明
  - 提供配置文件路径索引
  - 添加环境变量配置指南

## 1.2.5

### Patch Changes

- 修复功能集成时的文件路径，将文件放到正确的项目目录中
  - 修复配置文件路径：从 `src/config/` 改为 `apps/backend/src/config/`
  - 修复示例代码路径：从 `src/examples/` 改为 `apps/backend/src/examples/`
  - 修复环境变量文件路径：从 `.env.example` 改为 `apps/backend/.env.example`
  - 修复 package.json 路径：从根目录改为 `apps/backend/package.json`
  - 修复 app.module.ts 路径：从 `src/app.module.ts` 改为 `apps/backend/src/app.module.ts`
  - 更新能力索引文档中的示例代码路径说明

## 1.2.4

### Patch Changes

- 修复功能集成时的模板路径解析错误
  - 修复 `copyConfigFiles`、`copyExampleFiles`、`copySkillFiles` 函数中硬编码的 `templates/` 路径
  - 统一使用 `templateDir` 参数，支持从本地开发环境或 GitHub 下载的模板
  - 添加文件不存在时的警告日志
  - 添加模板目录清理逻辑，避免临时文件残留

## 1.2.3

### Patch Changes

- refactor: use GitHub templates instead of bundling in package
  - Remove templates from npm package to reduce package size
  - Always download templates from GitHub repository
  - Ensures users always get the latest templates
  - Reduces npm package size significantly

## 1.2.2

### Patch Changes

- fix: bundle templates directory in npm package
  - Add templates directory to npm package files
  - Create prebuild script to copy templates from project root
  - Update template path resolution to check packaged templates first
  - Ensure CLI works correctly when installed globally via npm

## 1.2.1

### Patch Changes

- fix: include features.json in npm package and fix path resolution
  - Add features.json to package files
  - Fix features.json path resolution for published package
  - Support both development and production environments

## 1.2.0

### Minor Changes

- d9bee61: feat: 添加功能集成系统，支持按需选择功能模块
  - 新增功能配置系统 (features.json)
  - 支持 8 个功能模块的按需安装（缓存、队列、支付、短信、OAuth、存储、限流、权限）
  - 自动生成配置文件和示例代码
  - 自动生成 AI Skill 文档
  - 自动注入模块到 app.module.ts
  - 生成 .env.example 环境变量模板
  - 完整的示例代码（24 个文件）
  - 详细的 README 文档（9 个）
  - 修复配置文件类型转换问题
  - 改进错误处理和文件读取安全性

## 1.1.0

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
