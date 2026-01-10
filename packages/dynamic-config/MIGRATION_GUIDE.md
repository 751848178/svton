# 迁移指南

本文档说明将 `@svton/dynamic-config` 包迁移到独立框架项目时需要替换的变量和名称。

## 需要替换的内容

### 1. 包名称

| 当前值 | 替换为 | 文件位置 |
|--------|--------|----------|
| `@svton/dynamic-config` | `@your-org/dynamic-config` | `package.json` |
| `@svton/dynamic-config/core` | `@your-org/dynamic-config/core` | 所有导入语句 |
| `@svton/dynamic-config/nestjs` | `@your-org/dynamic-config/nestjs` | 所有导入语句 |
| `@svton/dynamic-config/prisma` | `@your-org/dynamic-config/prisma` | 所有导入语句 |
| `@svton/dynamic-config/react` | `@your-org/dynamic-config/react` | 所有导入语句 |

### 2. package.json 字段

```json
{
  "name": "@your-org/dynamic-config",  // ← 替换
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/your-repo"  // ← 替换
  },
  "author": "Your Name",  // ← 添加
  "homepage": "https://github.com/your-org/your-repo#readme"  // ← 添加
}
```

### 3. 版本号

| 文件 | 位置 | 说明 |
|------|------|------|
| `package.json` | `version` | 发布版本 |
| `src/index.ts` | `VERSION` 常量 | 运行时版本 |

## 文件清单

### 核心文件

```
src/
├── index.ts                    # 主入口
├── core/
│   ├── index.ts               # Core 模块入口
│   ├── types.ts               # 类型定义
│   ├── utils.ts               # 工具函数
│   ├── repository.ts          # Repository 接口
│   ├── config-manager.ts      # 配置管理器
│   ├── dictionary-manager.ts  # 字典管理器
│   └── cache/
│       ├── index.ts
│       ├── types.ts           # 缓存接口
│       ├── memory-cache.ts    # 内存缓存
│       ├── redis-cache.ts     # Redis 缓存
│       └── tiered-cache.ts    # 分层缓存
├── prisma/
│   ├── index.ts
│   ├── types.ts               # Prisma 接口
│   ├── config-repository.ts   # Prisma 配置仓储
│   ├── dictionary-repository.ts
│   └── schema.prisma.template # Schema 模板
├── nestjs/
│   ├── index.ts
│   ├── constants.ts           # 注入 Token
│   ├── interfaces.ts          # 模块选项接口
│   ├── config.service.ts      # 配置服务
│   ├── dictionary.service.ts  # 字典服务
│   ├── config.controller.ts   # 基础 Controller
│   ├── dictionary.controller.ts
│   └── dynamic-config.module.ts
└── react/
    ├── index.ts
    ├── types.ts               # React 类型
    ├── context.tsx            # Provider
    ├── hooks/
    │   ├── index.ts
    │   ├── use-config.ts
    │   └── use-dictionary.ts
    └── components/
        ├── index.ts
        ├── config-field.tsx
        ├── config-form.tsx
        └── dictionary-select.tsx
```

### 配置文件

```
package.json          # 包配置
tsconfig.json         # TypeScript 配置
tsup.config.ts        # 构建配置
README.md             # 文档
MIGRATION_GUIDE.md    # 本文档
```

## 依赖说明

### peerDependencies（可选依赖）

用户根据使用的模块安装对应依赖：

| 模块 | 需要安装 |
|------|----------|
| core | 无 |
| nestjs | `@nestjs/common`, `@nestjs/core` |
| prisma | `@prisma/client` |
| react | `react` |
| Redis 缓存 | `ioredis` |

### devDependencies

构建和开发时需要：

```json
{
  "devDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "ioredis": "^5.0.0",
    "react": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 发布步骤

### 1. 替换包名

```bash
# 全局替换 @svton 为你的组织名
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" | \
  xargs sed -i '' 's/@svton/@your-org/g'
```

### 2. 更新 package.json

```bash
# 编辑 package.json
vim package.json
```

### 3. 安装依赖

```bash
pnpm install
```

### 4. 构建

```bash
pnpm build
```

### 5. 测试

```bash
pnpm typecheck
```

### 6. 发布

```bash
# 登录 npm
npm login

# 发布
npm publish --access public
```

## 使用示例

### 安装

```bash
# 安装核心包
pnpm add @your-org/dynamic-config

# 根据需要安装 peer dependencies
pnpm add @nestjs/common @nestjs/core  # NestJS
pnpm add @prisma/client               # Prisma
pnpm add react                        # React
pnpm add ioredis                      # Redis
```

### 导入

```typescript
// 核心
import { ConfigManager, MemoryCache, TieredCache } from '@your-org/dynamic-config/core';

// NestJS
import { DynamicConfigModule, DynamicConfigService } from '@your-org/dynamic-config/nestjs';

// Prisma
import { PrismaConfigRepository, PrismaDictionaryRepository } from '@your-org/dynamic-config/prisma';

// React
import { DynamicConfigProvider, useConfig, ConfigForm } from '@your-org/dynamic-config/react';
```

## 注意事项

### 1. Prisma Schema

用户需要手动将 `schema.prisma.template` 中的模型添加到自己的 `schema.prisma` 文件。

### 2. React 组件

React 组件需要用户传入 UI 组件（如 shadcn/ui），不内置 UI 库以保持灵活性。

### 3. 权限控制

NestJS Controller 不包含权限控制，用户需要继承并添加自己的 Guard。

### 4. Redis 客户端

`RedisCache` 接受一个符合 `RedisClientInterface` 接口的客户端，兼容 `ioredis`。

## 版本兼容性

| 依赖 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.x | 20.x |
| TypeScript | 5.0 | 5.3+ |
| NestJS | 9.x | 10.x |
| Prisma | 4.x | 5.x |
| React | 18.x | 18.x |
| ioredis | 5.x | 5.x |

## 问题反馈

如有问题，请提交 Issue 到：

- GitHub: https://github.com/your-org/your-repo/issues

---

**文档版本**: 1.0  
**最后更新**: 2025-01-10
