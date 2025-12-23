# 快速开始

> 5 分钟内让项目运行起来

---

## 📋 前置要求

确保你的开发环境已安装以下工具：

| 工具 | 最低版本 | 推荐版本 | 安装命令 |
|------|---------|---------|---------|
| **Node.js** | 18.0.0 | 20.x | [下载](https://nodejs.org/) |
| **pnpm** | 8.0.0 | 8.12.0 | `npm install -g pnpm` |
| **MySQL** | 8.0 | 8.0 | Docker 或本地安装 |
| **Redis** | 6.0 | 7.x | Docker 或本地安装 |

---

## 🚀 使用CLI创建项目 (推荐)

### 步骤 1: 使用SVTON CLI创建项目

```bash
# 创建新项目
npx svton create my-project
cd my-project
```

### 或者克隆现有项目

```bash
git clone <your-repo-url> community-next
cd community-next
```

### 步骤 2: 启动基础服务

使用 Docker Compose 一键启动 MySQL 和 Redis：

```bash
docker-compose up -d
```

### 步骤 3: 安装依赖

```bash
pnpm install
```

### 步骤 4: 配置环境变量

```bash
# 后端环境变量
cp apps/backend/.env.example apps/backend/.env.development

# 管理后台环境变量 (可选)
cp apps/admin/.env.local.example apps/admin/.env.local
```

### 步骤 5: 初始化数据库

```bash
cd apps/backend

# 生成 Prisma Client
pnpm prisma:generate

# 运行数据库迁移
pnpm prisma:migrate

# 初始化种子数据
pnpm prisma:seed
```

### 步骤 6: 启动开发服务

```bash
# 回到项目根目录
cd ../..

# 启动所有服务
pnpm dev
```

---

## ✅ 验证安装

| 服务 | 地址 | 说明 |
|------|------|------|
| **后端 API** | http://localhost:3000 | NestJS 服务 |
| **API 文档** | http://localhost:3000/api-docs | Swagger UI |
| **管理后台** | http://localhost:3001 | Next.js 应用 |
| **小程序** | 微信开发者工具 | 导入 `apps/mobile/dist` |

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123456` |
| 测试用户 | `testuser` | `user123456` |

---

## 🔧 单独启动服务

如果只需要启动部分服务：

```bash
# 只启动后端
pnpm dev:backend

# 只启动管理后台
pnpm dev:admin

# 启动小程序开发
cd apps/mobile
pnpm dev:weapp
```

---

## 📱 小程序开发

1. 启动后端服务
2. 进入 mobile 目录并启动编译：

```bash
cd apps/mobile
pnpm dev:weapp
```

3. 打开**微信开发者工具**
4. 导入项目：`apps/mobile/dist`
5. 配置 AppID（可使用测试号）

---

## 🐛 常见问题

### 数据库连接失败

确保 MySQL 服务已启动，并检查 `.env` 中的连接配置：

```env
DATABASE_URL="mysql://root:community2024@localhost:3306/community_helper"
```

### Redis 连接失败

确保 Redis 服务已启动：

```bash
# 检查 Redis 状态
docker ps | grep redis

# 或本地启动
redis-server
```

### 端口被占用

修改对应应用的端口配置：

```bash
# 后端 (.env)
PORT=3000

# 管理后台 (package.json 或启动命令)
next dev -p 3001
```

### pnpm install 失败

```bash
# 清理缓存重试
pnpm store prune
rm -rf node_modules
pnpm install
```

---

## 📚 下一步

- [项目概览](./overview.md) - 了解整体架构
- [环境准备](./prerequisites.md) - 详细环境配置
- [编码规范](../tools/coding-standards.md) - 开发规范

---

**遇到问题?** 查看 [常见问题](../reference/faq.md) 或提交 Issue。

## 🛠️ 使用SVTON CLI

```bash
# 查看所有可用命令
npx svton create --help

# 创建不同类型的项目
npx svton create my-app --template fullstack  # 完整项目(默认)
npx svton create my-admin --template admin    # 仅管理后台
npx svton create my-api --template backend    # 仅后端API
npx svton create my-mobile --template mobile  # 仅移动端

# 跳过依赖安装
npx svton create my-app --skip-install
```
