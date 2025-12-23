# svton

> Svton CLI - Create full-stack applications with NestJS, Next.js, and Taro

[![npm version](https://badge.fury.io/js/svton.svg)](https://badge.fury.io/js/svton)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Full-Stack Templates** - Backend (NestJS), Admin (Next.js), Mobile (Taro)
- 📦 **Monorepo Setup** - Turbo + pnpm workspace configured
- 🎯 **Multiple Templates** - Choose what you need: full-stack, backend-only, admin-only, mobile-only
- 🛠️ **Developer Experience** - ESLint, Prettier, TypeScript pre-configured
- 🐳 **Docker Support** - MySQL & Redis containers included
- 📚 **Type Safety** - Shared types and API definitions

## Quick Start

```bash
# 推荐方式 (npx)
npx svton create my-app

# 全局安装后使用
npm install -g svton
svton create my-app
```

## Usage

```bash
svton create <project-name> [options]
svton init <project-name> [options]   # 别名
svton new <project-name> [options]    # 别名
```

### Options

- `-o, --org <name>` - Organization name (default: project name)
- `--skip-install` - Skip installing dependencies
- `--skip-git` - Skip Git initialization
- `-t, --template <template>` - Template to use (full-stack, backend-only, admin-only, mobile-only)
- `-p, --package-manager <pm>` - Package manager to use (npm, yarn, pnpm)

### Examples

```bash
# Create a full-stack application
svton create my-app

# Create with custom organization name
svton create my-app --org my-company

# Create backend-only project
svton create my-api --template backend-only

# Skip dependency installation
svton create my-app --skip-install
```

## Templates

### Full Stack (`full-stack`)
Complete application with:
- **Backend**: NestJS + Prisma + MySQL + Redis
- **Admin Panel**: Next.js + TailwindCSS + shadcn/ui
- **Mobile App**: Taro + React (WeChat Mini Program)
- **Shared Types**: TypeScript definitions

### Backend Only (`backend-only`)
- NestJS API server
- Prisma ORM with MySQL
- JWT authentication
- Redis caching
- Swagger documentation

### Admin Only (`admin-only`)
- Next.js 15 with App Router
- TailwindCSS + shadcn/ui
- TypeScript + ESLint
- API client integration

### Mobile Only (`mobile-only`)
- Taro 3.6 framework
- React 18
- WeChat Mini Program support
- TypeScript + ESLint

## Architecture

Projects created with `create-svton-app` follow the Svton architecture:

```
my-app/
├── apps/
│   ├── backend/        # @my-org/backend
│   ├── admin/          # @my-org/admin
│   └── mobile/         # @my-org/mobile
├── packages/
│   └── types/          # @my-org/types
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── docker-compose.yml
```

## After Creation

1. **Start databases** (for full-stack/backend templates):
   ```bash
   docker-compose up -d
   ```

2. **Configure environment**:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # Edit .env file with your settings
   ```

3. **Run migrations** (for backend templates):
   ```bash
   pnpm --filter @my-org/backend prisma:generate
   pnpm --filter @my-org/backend prisma:migrate
   ```

4. **Start development**:
   ```bash
   pnpm dev
   ```

## Requirements

- Node.js >= 18.0.0
- One of: npm, yarn, or pnpm (pnpm recommended)
- Docker (for database services)

## License

MIT © [SVTON Team](https://github.com/svton)
