# 模板文件修复清单

## 已修复 ✅

1. **authz.config.ts** - 移除不存在的 roles 配置
2. **cache.config.ts** - 移除 redis 配置（Redis 通过 RedisModule 单独配置）
3. **storage.config.ts** - 使用 adapter 模式配置
4. **oauth.config.ts** - OAuth 命名修复

## 待修复 🔧

### 4. env.schema.ts
**问题**：找不到模块 "zod"
**解决方案**：在 backend package.json 模板中添加 zod 依赖

### 5. oauth.config.ts  
**问题**：重复的 import 语句
**解决方案**：检查 AST 注入逻辑，避免重复导入

### 6. authz/user.controller.ts
**问题**：Permissions 装饰器不存在
**解决方案**：从示例中移除 Permissions 导入和使用

### 7. cache/user.service.ts
**问题**：pattern 选项不存在
**解决方案**：使用 allEntries 替代 pattern

### 8. oauth/auth.service.ts
**问题**：OAuth API 使用错误
- `access_token` 等属性不存在
- 参数数量不匹配
**解决方案**：查看 OAuthResult 类型定义，使用正确的 API

### 9. storage/upload.service.ts
**问题**：ObjectStorageService 不存在
**解决方案**：使用 ObjectStorageClient 或通过 @InjectObjectStorage() 注入

### 10. storage/upload.controller.ts & upload.service.ts
**问题**：Express.Multer 类型不存在
**解决方案**：添加 @types/multer 依赖

### 11. prisma/prisma.service.ts
**问题**：PrismaClient 导入错误
**解决方案**：使用正确的 Prisma 导入方式

### 12. Prisma 相关文件
**问题**：缺少 Prisma schema 和配置
**解决方案**：在模板中添加完整的 Prisma 配置

### 13. @{org}/types 包
**问题**：缺少类型包依赖
**解决方案**：在 apps 的 package.json 中添加 workspace 依赖

## 建议的修复顺序

1. 先修复配置文件（1-5）
2. 再修复示例代码（6-10）
3. 最后添加缺失的文件和依赖（11-13）

## 需要的包版本信息

- zod: ^3.22.0
- @types/multer: ^1.4.11
- @prisma/client: ^5.0.0
- prisma: ^5.0.0 (devDependencies)
