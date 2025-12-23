# 项目结构

使用 Svton CLI 创建的项目采用 Monorepo 架构，使用 pnpm workspace 和 Turbo 管理。

## 目录结构

```
my-app/
├── apps/
│   ├── backend/          # NestJS 后端服务
│   │   ├── prisma/       # Prisma 数据库配置
│   │   ├── src/          # 源代码
│   │   └── .env          # 环境变量
│   ├── admin/            # Next.js 管理后台
│   │   ├── src/
│   │   │   ├── app/      # App Router 页面
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── tailwind.config.js
│   └── mobile/           # Taro 移动端
│       ├── src/
│       │   ├── pages/    # 页面
│       │   └── components/
│       └── config/       # Taro 配置
├── packages/
│   └── types/            # 共享类型定义
│       └── src/
├── docker-compose.yml    # Docker 服务配置
├── package.json          # 根 package.json
├── pnpm-workspace.yaml   # pnpm 工作区配置
└── turbo.json            # Turbo 构建配置
```

## 应用说明

### Backend (`apps/backend`)

NestJS 后端服务，提供 RESTful API。

**技术栈：**
- NestJS 10
- Prisma ORM
- MySQL 数据库
- Redis 缓存
- JWT 认证
- Swagger 文档

### Admin (`apps/admin`)

Next.js 管理后台，用于后台管理。

**技术栈：**
- Next.js 15 (App Router)
- TailwindCSS
- shadcn/ui 组件库
- TypeScript

### Mobile (`apps/mobile`)

Taro 移动端应用，支持微信小程序。

**技术栈：**
- Taro 3.6
- React 18
- TypeScript
- @svton/taro-ui 组件库

## 共享包

### Types (`packages/types`)

共享的 TypeScript 类型定义，包括：
- API 请求/响应类型
- 实体类型
- 通用工具类型

## 配置文件

| 文件 | 说明 |
|------|------|
| `pnpm-workspace.yaml` | 定义工作区包 |
| `turbo.json` | Turbo 构建管道配置 |
| `docker-compose.yml` | MySQL 和 Redis 服务 |
| `.env` 文件 | 各应用的环境变量 |
