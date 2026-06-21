# @svton/cli

> Svton CLI - 使用 NestJS、Next.js 和 Taro 创建全栈应用

[![npm version](https://badge.fury.io/js/@svton/cli.svg)](https://badge.fury.io/js/@svton/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 特性

- 🚀 **全栈模板** - 后端 (NestJS)、管理后台 (Next.js)、移动端 (Taro)
- 📦 **Monorepo 架构** - Turbo + pnpm workspace 预配置
- 🎯 **多种模板** - 按需选择：全栈、仅后端、仅管理后台、仅移动端
- 🛠️ **开发体验** - ESLint、Prettier、TypeScript 预配置
- 🐳 **Docker 支持** - 内置 MySQL 和 Redis 容器配置
- 📚 **类型安全** - 共享类型定义和 API 接口

## 快速开始

```bash
# 推荐方式 (npx)
npx @svton/cli create my-app

# 全局安装后使用
npm install -g @svton/cli
svton create my-app
```

## 使用方法

```bash
svton create <project-name> [options]
svton init <project-name> [options]   # 别名
svton new <project-name> [options]    # 别名
svton skill install [source] [options]
svton skill build [skill] [options]
```

### 选项

- `-o, --org <name>` - 组织名称（默认：项目名）
- `--skip-install` - 跳过依赖安装
- `--skip-git` - 跳过 Git 初始化
- `-t, --template <template>` - 使用的模板（full-stack、backend-only、admin-only、mobile-only）
- `-p, --package-manager <pm>` - 包管理器（npm、yarn、pnpm）

### 示例

```bash
# 创建全栈应用
svton create my-app

# 使用自定义组织名
svton create my-app --org my-company

# 创建仅后端项目
svton create my-api --template backend-only

# 跳过依赖安装
svton create my-app --skip-install
```

## Skill 命令

`svton skill` 用于安装和构建符合 AI agent skill 规范的技能产物，默认输出到 `.svton/skills`，可被 Svton Agent 的项目级 skill loader 自动发现。

### 安装 Skill

```bash
# 交互式安装
svton skill install

# 从本地源目录安装单个 skill 或目录下全部 skills
svton skill install --source-dir ./skills/my-skill
svton skill install ./skills

# 从 Git 仓库安装，可指定仓库内源目录和 ref
svton skill install --repo https://github.com/acme/agent-skills.git --source-dir skills/reviewer --ref main

# 从直接的 SKILL.md URL 安装
svton skill install https://example.com/skills/reviewer/SKILL.md

# 从 skills.sh 或兼容 SkillHub 安装
svton skill install --hub https://skills.sh --skill owner/repo/skill-name

# 覆盖同名 skill
svton skill install ./skills/my-skill --force
```

### 构建 Skills

```bash
# 构建 ./skills 下所有 skill 到 ./.svton/skills
svton skill build

# 构建指定 skill
svton skill build engineering-craft-principles

# 指定源目录和输出目录
svton skill build --skills-dir ./skills --out-dir ./dist/skills --clean
```

构建器支持两种源格式：
- `skill.config.json` + 可选 `references/`、`scripts/`、`assets/`、`agents/`
- 已经符合规范的 `SKILL.md` + 可选资源目录

### 查看已安装 Skill

```bash
svton skill list
svton skill list --out-dir ./dist/skills
```

## 模板

### 全栈模板 (`full-stack`)
完整应用包含：
- **后端**: NestJS + Prisma + MySQL + Redis
- **管理后台**: Next.js + TailwindCSS + shadcn/ui
- **移动端**: Taro + React (微信小程序)
- **共享类型**: TypeScript 类型定义

### 仅后端 (`backend-only`)
- NestJS API 服务器
- Prisma ORM + MySQL
- JWT 认证
- Redis 缓存
- Swagger 文档

### 仅管理后台 (`admin-only`)
- Next.js 15 + App Router
- TailwindCSS + shadcn/ui
- TypeScript + ESLint
- API 客户端集成

### 仅移动端 (`mobile-only`)
- Taro 3.6 框架
- React 18
- 微信小程序支持
- TypeScript + ESLint

## 项目架构

使用 `svton` 创建的项目遵循以下架构：

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

## 创建后的步骤

1. **启动数据库**（全栈/后端模板）：
   ```bash
   docker-compose up -d
   ```

2. **配置环境变量**：
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   # 编辑 .env 文件配置你的设置
   ```

3. **运行数据库迁移**（后端模板）：
   ```bash
   pnpm --filter @my-org/backend prisma:generate
   pnpm --filter @my-org/backend prisma:migrate
   ```

4. **启动开发服务器**：
   ```bash
   pnpm dev
   ```

## 环境要求

- Node.js >= 18.0.0
- npm、yarn 或 pnpm（推荐 pnpm）
- Docker（用于数据库服务）

## 许可证

MIT © [SVTON Team](https://github.com/svton)
