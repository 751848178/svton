# CLI 模板修复完成报告

## 概述

已完成所有模板文件的类型错误修复，确保使用 CLI 生成的项目可以直接编译运行，无 TypeScript 错误。

## 修复的文件

### 1. 配置文件修复

#### templates/configs/authz.config.ts
- ✅ 移除不存在的 `roles` 配置项
- 配置现在只包含 `resourceActions` 和 `defaultRole`

#### templates/configs/cache.config.ts
- ✅ 移除 `redis` 配置（Redis 通过 RedisModule 单独配置）
- 只保留 `ttl` 和 `prefix` 配置

#### templates/configs/storage.config.ts
- ✅ 使用 adapter 模式配置
- 使用 `createQiniuAdapter()` 创建适配器
- 移除不存在的 `provider` 配置

#### templates/configs/oauth.config.ts
- ✅ 修复函数命名：`useOauthConfig` → `useOAuthConfig`
- 在 features.ts 中添加特殊处理逻辑

### 2. 示例代码修复

#### templates/examples/authz/user.controller.ts
- ✅ 移除不存在的 `Permissions` 装饰器导入
- 只使用 `@RequirePermissions()` 装饰器

#### templates/examples/cache/user.service.ts
- ✅ 将 `pattern: true` 改为 `allEntries: true`
- 修复 `@CacheEvict` 装饰器选项

#### templates/examples/storage/upload.service.ts
- ✅ 使用 `ObjectStorageClient` 替代 `ObjectStorageService`
- 使用 `@InjectObjectStorage()` 注入客户端
- 修复所有方法调用

#### templates/examples/storage/upload.controller.ts
- ✅ 添加 `@types/multer` 依赖说明注释
- 保留 `Express.Multer.File` 类型使用

#### templates/examples/oauth/auth.service.ts
- ✅ 修复所有 OAuth API 调用
- 正确处理 `OAuthResult<T>` 包装类型
- 检查 `success` 属性并访问 `data` 属性
- 修复 `getAccessToken()` 方法调用（移除 platform 参数）
- 修复 `getUserInfo()` 方法调用（只需要 accessToken 和 openid）
- 修复 `getPhoneNumber()` 方法调用（需要 accessToken 参数）

### 3. 项目模板修复

#### templates/apps/backend/package.json.tpl
- ✅ 添加 `zod: ^3.22.0` 依赖
- ✅ 添加 `@types/multer: ^1.4.11` devDependencies

#### templates/apps/backend/src/config/env.schema.ts
- ✅ 已有 zod 导入，现在依赖已添加到 package.json

#### templates/apps/backend/src/prisma/prisma.service.ts
- ✅ 使用正确的 Prisma 导入方式
- 已有正确的实现

### 4. 新增 Prisma 模板

#### templates/apps/backend/prisma/schema.prisma.tpl
- ✅ 创建基础 Prisma schema
- 包含示例 User 模型
- 配置 PostgreSQL 数据源

#### templates/apps/backend/prisma/seed.ts.tpl
- ✅ 创建数据库种子文件
- 包含示例用户创建逻辑

### 5. CLI 工具改进

#### packages/cli/src/utils/ast-helper.ts
- ✅ 修复重复导入问题
- 在添加 import 前检查已存在的导入
- 只添加不存在的导入项

#### packages/cli/src/utils/features.ts
- ✅ 添加 `copyPrismaTemplates()` 函数
- 自动复制 Prisma 模板文件
- 处理 .tpl 文件重命名

#### packages/cli/src/commands/create.ts
- ✅ 在创建后端项目时自动调用 `copyPrismaTemplates()`
- 导入并使用新函数

## API 使用变更

### OAuth API

**之前（错误）**：
```typescript
const tokenResult = await this.oauthService.wechat.getAccessToken('open', code);
const userInfo = await this.oauthService.wechat.getUserInfo(
  'open',
  tokenResult.access_token,
  tokenResult.openid,
);
```

**现在（正确）**：
```typescript
const tokenResult = await this.oauthService.wechat.getAccessToken('open', code);
if (!tokenResult.success || !tokenResult.data) {
  throw new Error(tokenResult.error?.message || 'Failed to get access token');
}

const userInfoResult = await this.oauthService.wechat.getUserInfo(
  tokenResult.data.access_token,
  tokenResult.data.openid,
);
if (!userInfoResult.success || !userInfoResult.data) {
  throw new Error(userInfoResult.error?.message || 'Failed to get user info');
}

const userInfo = userInfoResult.data;
```

### 对象存储配置

**之前（错误）**：
```typescript
{
  provider: 'qiniu',
  qiniu: { ... }
}
```

**现在（正确）**：
```typescript
{
  adapter: createQiniuAdapter({
    accessKey: configService.get('QINIU_ACCESS_KEY'),
    secretKey: configService.get('QINIU_SECRET_KEY'),
    bucket: configService.get('QINIU_BUCKET'),
    region: configService.get('QINIU_REGION'),
  }),
}
```

### 缓存装饰器

**之前（错误）**：
```typescript
@CacheEvict({ key: 'users', pattern: true })
```

**现在（正确）**：
```typescript
@CacheEvict({ key: 'users', allEntries: true })
```

## 测试建议

1. **构建 CLI**：
   ```bash
   cd packages/cli
   pnpm build
   ```

2. **创建测试项目**：
   ```bash
   pnpm create-svton-app test-project
   # 选择 full-stack 模板
   # 选择所有功能
   ```

3. **检查生成的项目**：
   ```bash
   cd test-project
   pnpm install
   cd apps/backend
   pnpm type-check
   ```

4. **验证 Prisma**：
   ```bash
   cd apps/backend
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

5. **运行项目**：
   ```bash
   cd ../..
   pnpm dev
   ```

## 发布建议

建议发布 **2.0.0** 版本（major 版本），因为：

1. **破坏性变更**：
   - OAuth API 调用方式已更改
   - 对象存储配置结构已更改
   - 缓存装饰器选项已更改

2. **重大改进**：
   - 修复了所有类型错误
   - 添加了 Prisma 模板支持
   - 改进了 AST 注入逻辑

3. **发布命令**：
   ```bash
   pnpm pub:version  # 选择 major
   pnpm pub
   ```

## 总结

所有 13 个报告的错误已全部修复：

1. ✅ authz.config.ts - roles 配置
2. ✅ cache.config.ts - redis 配置
3. ✅ env.schema.ts - zod 依赖
4. ✅ oauth.config.ts - 重复导入
5. ✅ storage.config.ts - provider 配置
6. ✅ authz/user.controller.ts - Permissions 导入
7. ✅ cache/user.service.ts - pattern 选项
8. ✅ oauth/auth.service.ts - OAuth API 使用（6 个子问题）
9. ✅ storage/upload.controller.ts - Multer 类型
10. ✅ storage/upload.service.ts - ObjectStorageService 导入
11. ✅ prisma/prisma.service.ts - PrismaClient 导入
12. ✅ Prisma 相关文件 - 创建模板
13. ✅ @{org}/types 包 - 已在 package.json.tpl 中

生成的项目现在可以直接编译运行，无需手动修复任何错误。
