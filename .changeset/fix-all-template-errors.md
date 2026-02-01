---
'@svton/cli': major
---

重大修复：修复所有模板文件的类型错误和 API 使用问题

这是一个重大版本更新，修复了生成项目中的所有 TypeScript 错误。

**修复清单**：

1. ✅ authz.config.ts - 移除不存在的 roles 配置
2. ✅ cache.config.ts - 修复 redis 配置结构
3. ✅ env.schema.ts - 添加 zod 依赖
4. ✅ oauth.config.ts - 移除重复导入
5. ✅ storage.config.ts - 修复配置结构
6. ✅ authz/user.controller.ts - 移除不存在的 Permissions 导入
7. ✅ cache/user.service.ts - 移除不支持的 pattern 选项
8. ✅ oauth/auth.service.ts - 修复 OAuth API 使用
9. ✅ storage/upload.service.ts - 修复服务导入
10. ✅ storage/upload.controller.ts - 修复 Multer 类型
11. ✅ prisma/prisma.service.ts - 修复 Prisma 导入
12. ✅ 添加 Prisma 相关文件生成
13. ✅ 添加 @{org}/types 包依赖

**破坏性变更**：
- 所有配置文件 API 已更新以匹配最新的包版本
- 示例代码已更新以使用正确的 API

**迁移指南**：
使用新版本创建的项目将自动包含所有修复。
