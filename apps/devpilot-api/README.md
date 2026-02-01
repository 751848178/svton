# Devpilot

项目初始化与资源管控平台 - 可视化创建基于 Svton 技术栈的全栈应用项目。

## 功能特性

- 🚀 可视化项目初始化向导
- 📦 智能包依赖解析
- 🔐 资源凭证安全管理
- 🔑 密钥中心（Key Center）
- 🌐 Git 集成（GitHub/GitLab/Gitee）
- 🗄️ 资源池管理（MySQL/Redis）
- 🌍 域名 & Nginx 配置生成
- 📡 CDN 配置管理

## 环境要求

- Node.js >= 18
- pnpm >= 8
- MySQL >= 8.0
- Redis >= 6.0

## 快速开始

### 1. 安装依赖

```bash
# 在 monorepo 根目录执行
pnpm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp apps/devpilot-api/.env.example apps/devpilot-api/.env

# 编辑 .env 文件，配置数据库和 Redis 连接信息
```

主要配置项：

```env
# 数据库
DATABASE_URL="mysql://user:password@localhost:3306/devpilot"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# JWT（建议生成新的密钥）
JWT_SECRET=your-secret-key

# 加密密钥（必须 32 字符）
ENCRYPTION_KEY=your-32-character-encryption-key!
```

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
pnpm --filter @svton/devpilot-api prisma:generate

# 执行数据库迁移（创建表结构）
pnpm --filter @svton/devpilot-api prisma:migrate

# （可选）打开 Prisma Studio 查看数据
pnpm --filter @svton/devpilot-api prisma:studio
```

### 4. 启动服务

```bash
# 启动后端 API（端口 3101）
pnpm --filter @svton/devpilot-api dev

# 新开终端，启动前端（端口 3100）
pnpm --filter @svton/devpilot-web dev
```

### 5. 访问应用

- 前端界面: http://localhost:3100
- 后端 API: http://localhost:3101
- API 健康检查: http://localhost:3101/api/health

## 一键启动脚本

```bash
# 完整初始化（首次运行）
pnpm install && \
pnpm --filter @svton/devpilot-api prisma:generate && \
pnpm --filter @svton/devpilot-api prisma:migrate

# 日常开发启动
pnpm --filter @svton/devpilot-api dev &
pnpm --filter @svton/devpilot-web dev
```

## 项目结构

```
apps/
├── devpilot-api/          # 后端 NestJS 服务
│   ├── prisma/            # 数据库 Schema & 迁移
│   ├── src/
│   │   ├── auth/          # 认证模块
│   │   ├── generator/     # 项目生成器
│   │   ├── git/           # Git 集成
│   │   ├── key-center/    # 密钥中心
│   │   ├── preset/        # 配置预设
│   │   ├── registry/      # 功能注册表
│   │   ├── resource/      # 资源凭证
│   │   ├── resource-pool/ # 资源池管理
│   │   ├── domain/        # 域名配置
│   │   └── cdn/           # CDN 配置
│   └── .env               # 环境变量
│
└── devpilot-web/          # 前端 Next.js 应用
    └── src/
        ├── app/           # 页面路由
        ├── components/    # 组件
        ├── lib/           # 工具库
        └── store/         # 状态管理
```

## 常用命令

```bash
# 开发
pnpm --filter @svton/devpilot-api dev      # 启动后端
pnpm --filter @svton/devpilot-web dev      # 启动前端

# 构建
pnpm --filter @svton/devpilot-api build    # 构建后端
pnpm --filter @svton/devpilot-web build    # 构建前端

# 数据库
pnpm --filter @svton/devpilot-api prisma:generate  # 生成客户端
pnpm --filter @svton/devpilot-api prisma:migrate   # 执行迁移
pnpm --filter @svton/devpilot-api prisma:studio    # 数据库管理界面

# 代码检查
pnpm --filter @svton/devpilot-api lint     # 后端 lint
pnpm --filter @svton/devpilot-web lint     # 前端 lint
pnpm --filter @svton/devpilot-api type-check  # 类型检查
```

## 技术栈

**后端:**
- NestJS + Prisma + MySQL
- @svton/nestjs-authz（权限控制）
- @svton/nestjs-redis（Redis 缓存）
- @svton/nestjs-logger（日志）

**前端:**
- Next.js 15 + React 19
- @svton/ui（UI 组件库）
- @svton/hooks（React Hooks）
- Tailwind CSS + Zustand
