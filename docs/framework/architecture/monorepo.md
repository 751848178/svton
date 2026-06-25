# Monorepo 结构

> pnpm workspace + Turborepo 工作空间管理详解

---

## 📦 什么是 Monorepo

Monorepo（单一代码仓库）将多个项目放在一个仓库中管理，共享配置、依赖和工具链。

### 优势

| 优势 | 说明 |
|------|------|
| **代码共享** | 共享类型、工具、组件，避免重复 |
| **原子提交** | 相关改动一次提交，保持一致性 |
| **统一工具链** | 共享 ESLint、Prettier、TypeScript 配置 |
| **依赖管理** | pnpm 高效处理包间依赖 |
| **并行构建** | Turborepo 智能缓存和并行执行 |

---

## 🏗️ 项目结构

```
community-next/
├── apps/                           # 应用程序
│   ├── backend/                    # @svton/backend
│   │   ├── src/
│   │   ├── prisma/
│   │   └── package.json
│   ├── admin/                      # @svton/admin
│   │   ├── src/
│   │   └── package.json
│   └── mobile/                     # @svton/mobile
│       ├── src/
│       └── package.json
│
├── packages/                       # 共享包
│   ├── types/                      # @svton/types
│   ├── api-client/                 # @svton/api-client
│   ├── hooks/                      # @svton/hooks
│   └── taro-ui/                    # @svton/taro-ui
│
├── docs/                           # 文档
├── scripts/                        # 脚本
├── sql/                            # SQL 文件
│
├── package.json                    # 根配置
├── pnpm-workspace.yaml             # 工作空间配置
├── turbo.json                      # Turborepo 配置
├── .eslintrc.js                    # ESLint 配置
├── .prettierrc                     # Prettier 配置
└── docker-compose.yml              # Docker 配置
```

---

## ⚙️ 配置文件详解

### pnpm-workspace.yaml

定义工作空间包含的目录：

```yaml
packages:
  - 'apps/*'      # 所有应用
  - 'packages/*'  # 所有共享包
```

### 根 package.json

```json
{
  "name": "community-helper",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:backend": "turbo run dev --filter=@svton/backend",
    "dev:admin": "turbo run dev --filter=@svton/admin",
    "build": "turbo run build",
    "build:backend": "turbo run build --filter=@svton/backend",
    "build:admin": "turbo run build --filter=@svton/admin",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint -- --fix",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "prettier": "^3.1.0",
    "eslint": "^8.55.0"
  },
  "packageManager": "pnpm@8.12.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### turbo.json

定义任务管道和缓存策略：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],      // 先构建依赖
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,               // 开发模式不缓存
      "persistent": true            // 持久运行
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 📦 包管理

### 包命名规范

所有包统一使用 `@svton` 命名空间：

| 包名 | 类型 | 说明 |
|------|------|------|
| `@svton/backend` | app | 后端 API |
| `@svton/admin` | app | 管理后台 |
| `@svton/mobile` | app | 移动端 |
| `@svton/types` | package | 类型定义 |
| `@svton/api-client` | package | API 客户端 |
| `@svton/hooks` | package | React Hooks |
| `@svton/taro-ui` | package | Taro 组件库 |

### 包间依赖

使用 `workspace:*` 声明内部依赖：

```json
// apps/admin/package.json
{
  "dependencies": {
    "@svton/types": "workspace:*",
    "@svton/api-client": "workspace:*",
    "@svton/hooks": "workspace:*"
  }
}
```

### 添加依赖

```bash
# 添加根依赖
pnpm add -Dw typescript

# 添加到指定包
pnpm --filter @svton/backend add bcrypt
pnpm --filter @svton/admin add zustand

# 添加开发依赖
pnpm --filter @svton/backend add -D @types/bcrypt
```

---

## 🚀 常用命令

### 开发命令

```bash
# 启动所有项目
pnpm dev

# 启动指定项目
pnpm dev:backend      # 只启动后端
pnpm dev:admin        # 只启动管理后台

# 使用 filter 启动
pnpm --filter @svton/backend dev
pnpm --filter @svton/admin dev
```

### 构建命令

```bash
# 构建所有项目
pnpm build

# 构建指定项目 (会自动构建依赖)
pnpm build:backend
pnpm build:admin

# 只构建包
pnpm --filter "./packages/*" build
```

### 其他命令

```bash
# 代码检查
pnpm lint
pnpm lint:fix

# 类型检查
pnpm type-check

# 清理
pnpm clean

# 格式化
pnpm format
```

---

## 🔄 构建顺序

Turborepo 自动处理构建顺序，基于 `dependsOn` 配置：

```
1. @svton/types        (无依赖)
2. @svton/api-client   (依赖 types)
3. @svton/hooks        (无依赖)
4. @svton/taro-ui      (依赖 hooks)
5. @svton/backend      (依赖 types)
6. @svton/admin        (依赖 types, api-client, hooks)
7. @svton/mobile       (依赖 types, api-client, hooks, taro-ui)
```

### 并行执行

无依赖关系的包会并行构建：

```
┌────────────┐    ┌────────────┐
│   types    │    │   hooks    │
└─────┬──────┘    └─────┬──────┘
      │                 │
      ▼                 ▼
┌────────────┐    ┌────────────┐
│ api-client │    │  taro-ui   │
└─────┬──────┘    └─────┬──────┘
      │                 │
      └────────┬────────┘
               │
      ┌────────┴────────┐
      ▼        ▼        ▼
  backend    admin   mobile
```

---

## 💾 缓存策略

Turborepo 提供智能缓存：

### 本地缓存

```bash
# 缓存位置
.turbo/

# 清除缓存
pnpm clean
# 或
rm -rf .turbo node_modules/.cache
```

### 缓存命中

当输入未变化时，直接使用缓存：

```
@svton/types:build: cache hit, replaying output
```

### 强制重新构建

```bash
# 跳过缓存
pnpm build --force
```

---

## 📝 创建新包

### 1. 创建目录和 package.json

```bash
mkdir -p packages/new-package/src

cat > packages/new-package/package.json << 'EOF'
{
  "name": "@svton/new-package",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF
```

### 2. 添加 TypeScript 配置

```json
// packages/new-package/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

### 3. 在其他包中使用

```bash
# 添加依赖
pnpm --filter @svton/admin add @svton/new-package@workspace:*

# 使用
import { something } from '@svton/new-package';
```

---

## 🐛 常见问题

### 依赖解析错误

```bash
# 重新安装依赖
rm -rf node_modules
pnpm install
```

### 类型找不到

确保依赖包已构建：

```bash
pnpm --filter @svton/types build
```

### 循环依赖

避免包之间的循环依赖，保持单向依赖：

```
types → api-client → admin  ✅
types ← api-client          ❌
```

---

**下一步**: 目录规范
