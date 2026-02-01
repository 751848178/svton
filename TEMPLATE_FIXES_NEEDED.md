# 模板文件修复清单

## 已修复 ✅

1. **authz.config.ts** - 移除不存在的 roles 配置
2. **cache.config.ts** - 移除 redis 配置（Redis 通过 RedisModule 单独配置）
3. **storage.config.ts** - 使用 adapter 模式配置
4. **oauth.config.ts** - OAuth 命名修复
5. **authz/user.controller.ts** - 移除 Permissions 装饰器
6. **cache/user.service.ts** - 使用 allEntries 替代 pattern
7. **storage/upload.service.ts** - 使用 ObjectStorageClient 和 @InjectObjectStorage()
8. **oauth/auth.service.ts** - 修复 OAuth API 使用（使用 OAuthResult 包装类型）
9. **storage/upload.controller.ts** - 添加 @types/multer 注释
10. **backend/package.json.tpl** - 添加 zod 和 @types/multer 依赖
11. **ast-helper.ts** - 修复重复导入问题（检查已存在的 import）
12. **Prisma 模板** - 创建 schema.prisma.tpl 和 seed.ts.tpl
13. **features.ts** - 添加 copyPrismaTemplates 函数
14. **create.ts** - 在创建后端项目时自动复制 Prisma 模板

## 待测试 🧪

所有修复已完成，需要测试：
1. 运行 `pnpm build` 构建 CLI
2. 使用 CLI 创建新项目并选择所有功能
3. 检查生成的项目是否没有 TypeScript 错误
4. 验证所有功能模块是否正确集成

## 需要发布的版本

建议发布 **2.0.0** 版本（major 版本），因为：
- 修复了多个 API 使用错误
- 添加了 Prisma 模板支持
- 改进了 AST 注入逻辑
- 这些变更可能影响已生成的项目
