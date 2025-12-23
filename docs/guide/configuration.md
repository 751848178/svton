# 配置说明

## 环境变量

### Backend 环境变量

创建 `apps/backend/.env` 文件：

```bash
# 数据库
DATABASE_URL="mysql://root:password@localhost:3306/myapp"

# JWT
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# 服务端口
PORT=3000

# CORS
CORS_ORIGIN="http://localhost:3001"
```

### Admin 环境变量

创建 `apps/admin/.env.local` 文件：

```bash
# API 地址
NEXT_PUBLIC_API_URL="http://localhost:3000"

# 应用名称
NEXT_PUBLIC_APP_NAME="My App Admin"
```

### Mobile 环境变量

在 `apps/mobile/config/index.ts` 中配置：

```typescript
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
```

## Turbo 配置

`turbo.json` 定义构建管道：

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {}
  }
}
```

## Docker 配置

`docker-compose.yml` 提供开发环境服务：

```yaml
services:
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: myapp

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Prisma 配置

数据库 Schema 位于 `apps/backend/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  phone     String   @unique
  nickname  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## 常用命令

```bash
# 开发
pnpm dev                    # 启动所有应用
pnpm --filter @org/backend dev  # 仅启动后端

# 构建
pnpm build                  # 构建所有应用

# 数据库
pnpm --filter @org/backend prisma:generate  # 生成 Prisma Client
pnpm --filter @org/backend prisma:migrate   # 运行迁移
pnpm --filter @org/backend prisma:studio    # 打开 Prisma Studio

# 代码检查
pnpm lint                   # ESLint 检查
pnpm type-check             # TypeScript 类型检查
```
