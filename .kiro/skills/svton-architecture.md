---
name: svton-architecture-guidance
description: Svton 项目架构指导 - Monorepo 结构、包管理、最佳实践
triggers:
  - 架构
  - monorepo
  - 项目结构
  - 包管理
  - pnpm
  - turborepo
  - workspace
  - 共享包
  - 类型定义
  - api-client
  - 最佳实践
  - 规范
resources:
  - type: documentation
    url: https://751848178.github.io/svton
    description: Svton 官方文档
  - type: documentation
    url: https://pnpm.io/workspaces
    description: pnpm workspace 文档
  - type: documentation
    url: https://turbo.build/repo/docs
    description: Turborepo 文档
---

# Svton 项目架构指导

Svton 是一个基于 pnpm workspace + Turborepo 的 Monorepo 架构项目。

## 项目结构

```
svton/
├── apps/                    # 应用目录
│   ├── devpilot-api/       # NestJS 后端
│   └── devpilot-web/       # Next.js 管理后台
├── packages/               # 共享包目录
│   ├── hooks/             # @svton/hooks
│   ├── ui/                # @svton/ui
│   ├── taro-ui/           # @svton/taro-ui
│   ├── service/           # @svton/service
│   ├── logger/            # @svton/logger
│   ├── nestjs-*/          # NestJS 模块包
│   └── types/             # 项目类型定义
├── docs/                  # 文档
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 包分类

### 1. 公共 NPM 包（@svton/*）

发布到 npm，可在任何项目中使用：
- @svton/hooks
- @svton/ui
- @svton/taro-ui
- @svton/service
- @svton/logger
- @svton/nestjs-*

### 2. 项目私有包（@{org}/*）

仅在当前项目中使用：
- @{org}/types - 类型定义
- @{org}/api-client - API 客户端

## 包依赖关系

- **apps/devpilot-web** 依赖：@svton/hooks, @svton/ui, @{org}/types, @{org}/api-client
- **apps/devpilot-api** 依赖：@svton/nestjs-*, @{org}/types
- **packages/ui** 依赖：@svton/hooks
- **packages/taro-ui** 依赖：@svton/hooks

## 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 开发模式
pnpm dev

# 运行测试
pnpm test

# 添加依赖到特定包
pnpm add <package> --filter <workspace-name>

# 在特定包中运行命令
pnpm --filter <workspace-name> <command>
```

## 开发规范

### 前端规范

1. ✅ 回调函数使用 `usePersistFn`
2. ✅ 布尔状态使用 `useBoolean`
3. ✅ 搜索场景使用 `useDebounce`
4. ✅ 防重复提交使用 `useLockFn`
5. ✅ 使用 `RequestBoundary` 统一处理状态

### 后端规范

1. ✅ 使用结构化日志
2. ✅ 使用缓存装饰器
3. ✅ 异步任务使用队列
4. ✅ 合理设置重试策略

### Taro 小程序规范

1. ✅ 每个页面必须包含 StatusBar 和 NavBar
2. ✅ 使用 Taro UI 组件
3. ✅ 样式使用 variables.scss 变量

## 常见场景

### 场景 1：添加新的共享包

在 packages/ 目录下创建新包：

```bash
# 1. 创建包目录
mkdir -p packages/my-package
cd packages/my-package

# 2. 初始化 package.json
```

```json
{
  "name": "@svton/my-package",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

```bash
# 3. 创建 tsup.config.ts
```

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
});
```

```bash
# 4. 在其他包中使用
pnpm add @svton/my-package --filter my-app
```

### 场景 2：在 Next.js 项目中使用 Svton 包

```bash
# 1. 安装依赖
pnpm add @svton/hooks @svton/ui
```

```javascript
// 2. 配置 Tailwind（如果使用 @svton/ui）
// tailwind.config.js
module.exports = {
  presets: [require('@svton/ui/tailwind-preset')],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@svton/ui/dist/**/*.js',
  ],
};
```

```typescript
// 3. 使用组件
'use client';

import { usePersistFn, useBoolean } from '@svton/hooks';
import { Modal, RequestBoundary } from '@svton/ui';

export default function MyPage() {
  const [visible, { setTrue, setFalse }] = useBoolean(false);
  
  return (
    <>
      <button onClick={setTrue}>打开</button>
      <Modal open={visible} onClose={setFalse}>
        内容
      </Modal>
    </>
  );
}
```

### 场景 3：在 NestJS 项目中使用 Svton 包

```bash
# 1. 安装依赖
pnpm add @svton/nestjs-logger @svton/nestjs-cache @svton/nestjs-queue
```

```typescript
// 2. 在 AppModule 中注册
import { Module } from '@nestjs/common';
import { LoggerModule } from '@svton/nestjs-logger';
import { CacheModule } from '@svton/nestjs-cache';
import { QueueModule } from '@svton/nestjs-queue';

@Module({
  imports: [
    LoggerModule.forRoot({
      appName: 'my-api',
      level: 'info',
    }),
    CacheModule.forRoot({
      ttl: 3600,
      prefix: 'cache',
    }),
    QueueModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
// 3. 在 Service 中使用
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from '@svton/nestjs-logger';
import { Cacheable, CacheEvict } from '@svton/nestjs-cache';

@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}
  
  @Cacheable({ key: 'user:#id', ttl: 3600 })
  async findOne(id: number) {
    this.logger.info({ userId: id }, 'Finding user');
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

## 最佳实践

1. **优先使用框架提供的包**：避免重复造轮子
2. **保持包的独立性**：每个包应该可以独立使用
3. **类型定义共享**：使用 @{org}/types 共享类型
4. **API 客户端统一**：使用 @{org}/api-client 调用后端接口
5. **遵循命名规范**：公共包使用 @svton，私有包使用 @{org}
6. **文档完善**：每个包都应该有 README.md

## 包开发流程

### 1. 创建新包

```bash
mkdir -p packages/my-package/src
cd packages/my-package
```

### 2. 配置 package.json

```json
{
  "name": "@svton/my-package",
  "version": "1.0.0",
  "description": "My package description",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest"
  },
  "keywords": ["svton", "my-package"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 3. 配置构建工具

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
});
```

### 4. 编写代码

```typescript
// src/index.ts
export { myFunction } from './myFunction';
export type { MyType } from './types';
```

### 5. 构建和测试

```bash
pnpm build
pnpm test
```

### 6. 发布到 npm

```bash
npm publish --access public
```

## 故障排查

### 问题 1：包依赖找不到

```bash
# 清理并重新安装
rm -rf node_modules
pnpm install
```

### 问题 2：类型定义不生效

```bash
# 重新构建包
pnpm --filter @svton/my-package build
```

### 问题 3：Turborepo 缓存问题

```bash
# 清理 Turborepo 缓存
rm -rf .turbo
pnpm build
```
