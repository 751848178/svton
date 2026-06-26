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
- 🧭 **项目运行 & 体检** - 不仅创建项目,还能 `svton dev/build/...` 一键运行,`svton doctor` 体检,`svton db/services/generate` 操作项目

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
# 创建项目
svton create <project-name> [options]
svton init <project-name> [options]   # 别名
svton new <project-name> [options]    # 别名

# 运行 & 操作项目(在 Svton 项目根目录下)
svton dev [app]          # 启动开发服务器(委托 turbo,可指定单个 app)
svton build [app]        # 构建
svton info [--json]      # 打印解析出的项目清单
svton doctor [--fix]     # 环境 & 项目体检
svton env check [app]    # 比对 .env 与 .env.example
svton db <generate|migrate|studio|...>   # Prisma 生命周期
svton services <init|up|down|status>     # 本地 MySQL/Redis(docker compose)
svton docker <init|build|up|down|logs>   # 容器化生产(镜像内构建,无需手动 build)
svton generate <module|app|package|api-contract> [name]   # 代码生成(别名 g)

# AI agent skills
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

## 运行 Svton 项目

用 `svton create` 生成的项目(以及任何符合 Svton 架构的 monorepo)都能直接用以下命令运行与操作。**无需任何配置即可使用** —— CLI 会自动检测工作区结构、各 app 端口、prisma 目录、包管理器等;想要更精确的控制,可在项目根放一份 `svton.config.ts`。

### 生命周期命令(委托 turbo / 包管理器)

| 命令 | 作用 |
|------|------|
| `svton dev [app]` | 启动开发服务器(`turbo run dev`);带 app 名则只跑该 app |
| `svton build [app]` | 构建 |
| `svton start [app]` | 生产启动(跑各 app 的 `start` 脚本;`--all` 启动全部) |
| `svton lint [app]` | Lint(`--fix` 透传给 linter) |
| `svton typecheck [app]` | 类型检查(映射 turbo 任务 `type-check`) |
| `svton test [app]` | 运行测试 |
| `svton clean [--keep-deps]` | 清理构建产物(默认含 node_modules) |
| `svton info [--json]` | 打印解析出的项目清单(apps/端口/db/services) |
| `svton doctor [--fix]` | 环境 & 项目体检(Node/pnpm/turbo/脚本契约/env/端口/Docker) |
| `svton env check [app]` | 比对 `.env` 与 `.env.example`,列出缺失 key(`--fix` 自动补建) |
| `svton db <generate\|migrate\|migrate:deploy\|studio\|seed\|init>` | Prisma 生命周期(自动定位含 `prisma/schema.prisma` 的 app) |
| `svton services <init\|up\|down\|status>` | 本地 MySQL/Redis(`docker compose`;无 compose 时先 `init` 生成) |
| `svton docker <init\|build\|up\|down\|logs>` | 容器化生产部署:**镜像内构建** + 起整套(apps + mysql + redis);无需手动 `svton build` |
| `svton generate <module\|app\|package\|api-contract> [name]` | 代码生成器(别名 `g`;`module` 已实现,自动接线进 `app.module.ts`) |

> 生命周期命令的设计原则是**不重造 turbo** —— 仅做稳定入口 + Svton 专有的人性化(端口/健康/env/db/生成器)。

### 项目清单 `svton.config.ts`(混合 manifest)

Svton 架构规范用**混合方式**声明一个项目:

1. **主配置 `svton.config.ts`**(类型安全,推荐):
   ```ts
   import { defineSvtonProject } from '@svton/cli';

   export default defineSvtonProject({
     schema: 1,
     apps: {
       api: { dir: 'apps/backend', type: 'nest', port: 4000, baseURL: 'http://localhost:4000/api', ready: { http: 'http://localhost:4000/api/health' } },
       web: { dir: 'apps/admin', type: 'next', port: 3000, ready: { http: 'http://localhost:3000' } },
       mobile: { dir: 'apps/mobile', type: 'taro' },
     },
     database: { orm: 'prisma', dir: 'apps/backend' },
     services: { compose: 'docker-compose.yml' },
   });
   ```
2. **根 `package.json` 的 `"svton"` 标记**(快速检测):
   ```json
   { "svton": { "schema": 1 } }
   ```

`schema` 是规范版本(当前为 `1`),用于向前兼容与迁移。`apps` 里 `port`/`ready`/`dependsOn` 等字段会被 `info`/`doctor` 用于健康探测。**没有 manifest 时**,CLI 会自动推断一份等价清单(基于 `pnpm-workspace.yaml`、各 app 的 `package.json` 脚本与 `main.ts` 等),所以旧项目零改造即可用 `svton dev`。

`defineSvtonProject`、`SvtonProjectConfig` 等类型从 `@svton/cli` 公共导出,供你的 `svton.config.ts` 获得编辑器自动补全。

---

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

`svton create` 生成的项目根已带 `svton.config.ts`,可直接用 `svton` 命令操作:

1. **启动数据库**（全栈/后端模板）：
   ```bash
   svton services up          # = docker compose up -d(无 compose 时先 svton services init)
   ```

2. **配置环境变量**：
   ```bash
   svton env check --fix      # 自动从 .env.example 补建缺失的 .env,再手动编辑
   ```

3. **初始化数据库**（后端模板）：
   ```bash
   svton db init              # = prisma generate + migrate dev
   ```

4. **体检 & 启动开发服务器**：
   ```bash
   svton doctor               # 检查 node/pnpm/端口/env/prisma client 等
   svton dev                  # 启动全部 app(= pnpm dev / turbo run dev)
   ```

> 也可以继续用底层命令(`docker-compose up -d`、`pnpm --filter @my-org/backend prisma:migrate`、`pnpm dev`),`svton` 命令只是更省心的封装。

## 环境要求

- Node.js >= 18.0.0
- npm、yarn 或 pnpm（推荐 pnpm）
- Docker（用于数据库服务）

## 许可证

MIT © [SVTON Team](https://github.com/svton)
