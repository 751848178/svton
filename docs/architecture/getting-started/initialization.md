# 项目初始化

> 从零开始基于本架构创建新项目的完整指南

---

## 🎯 初始化方式

### 方式一：使用脚手架脚本 (推荐)

```bash
# 运行项目初始化脚本
./scripts/init-project.sh my-new-project

# 或指定完整路径
bash scripts/init-project.sh /path/to/my-new-project
```

### 方式二：手动初始化

按照以下步骤手动创建项目结构。

---

## 📁 步骤 1: 创建项目结构

```bash
mkdir my-new-project && cd my-new-project

# 创建目录结构
mkdir -p apps/{backend,admin,mobile}
mkdir -p packages/{types,api-client,hooks,taro-ui}
mkdir -p docs scripts sql
```

---

## 📦 步骤 2: 初始化根配置

### package.json

```json
{
  "name": "my-new-project",
  "version": "1.0.0",
  "private": true,
  "description": "项目描述",
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

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
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

## 🔧 步骤 3: 初始化后端 (NestJS)

```bash
cd apps/backend

# 初始化 package.json
cat > package.json << 'EOF'
{
  "name": "@svton/backend",
  "version": "1.0.0",
  "description": "后端 API",
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "scripts": {
    "build": "nest build",
    "dev": "NODE_ENV=development nest start --watch",
    "start": "NODE_ENV=production node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts",
    "db:init": "pnpm prisma:generate && pnpm prisma:migrate && pnpm prisma:seed",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.1.17",
    "@prisma/client": "^5.7.1",
    "@svton/types": "workspace:*",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "ioredis": "^5.3.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.2.1",
    "@nestjs/testing": "^10.2.10",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/passport-jwt": "^3.0.13",
    "jest": "^29.7.0",
    "prisma": "^5.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0"
  }
}
EOF

# 创建基础目录
mkdir -p src/{modules,common,prisma} prisma
```

---

## 💻 步骤 4: 初始化管理后台 (Next.js)

```bash
cd ../admin

# 初始化 package.json
cat > package.json << 'EOF'
{
  "name": "@svton/admin",
  "version": "1.0.0",
  "description": "管理后台",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.3",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@svton/api-client": "workspace:*",
    "@svton/hooks": "workspace:*",
    "@svton/types": "workspace:*",
    "axios": "^1.7.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dayjs": "^1.11.13",
    "lucide-react": "^0.462.0",
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.49.0",
    "swr": "^2.2.5",
    "tailwind-merge": "^3.4.0",
    "zod": "^3.22.4",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "autoprefixer": "^10.4.22",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.3"
  }
}
EOF

# 创建目录
mkdir -p src/{app,components,lib,hooks}
```

---

## 📱 步骤 5: 初始化移动端 (Taro)

```bash
cd ../mobile

# 使用 Taro CLI 初始化
npx @tarojs/cli init . --template react-ts

# 或手动配置 package.json
cat > package.json << 'EOF'
{
  "name": "@svton/mobile",
  "version": "1.0.0",
  "description": "移动端小程序",
  "private": true,
  "scripts": {
    "build:weapp": "taro build --type weapp",
    "dev": "npm run dev:weapp",
    "dev:weapp": "npm run build:weapp -- --watch",
    "dev:h5": "npm run build:h5 -- --watch",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@babel/runtime": "^7.23.6",
    "@svton/api-client": "workspace:*",
    "@svton/hooks": "workspace:*",
    "@svton/taro-ui": "workspace:*",
    "@svton/types": "workspace:*",
    "@tarojs/components": "3.6.23",
    "@tarojs/plugin-framework-react": "3.6.23",
    "@tarojs/plugin-platform-weapp": "3.6.23",
    "@tarojs/react": "3.6.23",
    "@tarojs/runtime": "3.6.23",
    "@tarojs/taro": "3.6.23",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@babel/core": "^7.23.6",
    "@tarojs/cli": "3.6.23",
    "@tarojs/webpack5-runner": "3.6.23",
    "@types/react": "^18.2.45",
    "babel-preset-taro": "3.6.23",
    "eslint": "^8.56.0",
    "typescript": "^5.3.3"
  }
}
EOF

mkdir -p src/{pages,components,store,styles,utils}
```

---

## 📝 步骤 6: 初始化共享包

### @svton/types

```bash
cd ../../packages/types

cat > package.json << 'EOF'
{
  "name": "@svton/types",
  "version": "1.0.0",
  "description": "共享类型定义",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF

mkdir -p src/api
```

### @svton/api-client

```bash
cd ../api-client

cat > package.json << 'EOF'
{
  "name": "@svton/api-client",
  "version": "0.1.0",
  "description": "API Client",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  },
  "dependencies": {
    "@svton/types": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3"
  }
}
EOF

mkdir -p src/modules
```

### @svton/hooks

```bash
cd ../hooks

cat > package.json << 'EOF'
{
  "name": "@svton/hooks",
  "version": "0.1.0",
  "description": "通用 React Hooks",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
EOF

mkdir -p src
```

---

## 🚀 步骤 7: 安装并启动

```bash
cd ../..  # 回到项目根目录

# 安装所有依赖
pnpm install

# 构建共享包
pnpm build

# 启动开发服务
pnpm dev
```

---

## 📋 初始化检查清单

- [ ] 项目根目录配置完成
- [ ] 后端应用初始化
- [ ] 管理后台应用初始化
- [ ] 移动端应用初始化
- [ ] 共享包初始化
- [ ] 依赖安装成功
- [ ] 开发服务可以启动

---

**下一步**: [整体架构](../architecture/overview.md)
