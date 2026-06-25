# Docker 部署

> 使用 Docker 容器化部署指南

---

## 🐳 Docker Compose

### 开发环境

项目提供了 `docker-compose.yml` 用于启动 MySQL 和 Redis：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: community-helper-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: community2024
      MYSQL_DATABASE: community_helper
      MYSQL_USER: community
      MYSQL_PASSWORD: community2024
      TZ: Asia/Shanghai
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./sql:/docker-entrypoint-initdb.d
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: community-helper-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  mysql_data:
  redis_data:
```

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f mysql
docker-compose logs -f redis

# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```

---

## 🏭 生产环境部署

### 完整的 docker-compose.prod.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: svton-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      TZ: Asia/Shanghai
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - svton-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: svton-redis
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - svton-network

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: svton-backend
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    ports:
      - "3000:3000"
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - svton-network

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    container_name: svton-admin
    restart: always
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3001:3001"
    depends_on:
      - backend
    networks:
      - svton-network

networks:
  svton-network:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
```

---

## 📦 Dockerfile

### Backend Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM node:20-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm@8

# 依赖安装阶段
FROM base AS deps
WORKDIR /app

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules

COPY . .

# 构建 types
RUN pnpm --filter @svton/types build

# 生成 Prisma Client
RUN cd apps/backend && pnpm prisma:generate

# 构建 backend
RUN pnpm --filter @svton/backend build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 复制构建产物
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
```

### Admin Dockerfile

```dockerfile
# apps/admin/Dockerfile
FROM node:20-alpine AS base

RUN npm install -g pnpm@8

# 依赖安装
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/types/package.json ./packages/types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/hooks/package.json ./packages/hooks/

RUN pnpm install --frozen-lockfile

# 构建
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建共享包
RUN pnpm --filter @svton/types build
RUN pnpm --filter @svton/api-client build
RUN pnpm --filter @svton/hooks build

# 构建 Admin
RUN pnpm --filter @svton/admin build

# 运行
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

EXPOSE 3001

CMD ["node", "apps/admin/server.js"]
```

---

## 🚀 部署流程

### 1. 准备环境变量

创建 `.env.prod` 文件：

```env
# 数据库
MYSQL_ROOT_PASSWORD=strong-root-password
MYSQL_DATABASE=community_helper
MYSQL_USER=svton
MYSQL_PASSWORD=strong-db-password

# Redis
REDIS_PASSWORD=strong-redis-password

# API
API_URL=https://api.your-domain.com
```

### 2. 构建镜像

```bash
# 构建所有镜像
docker-compose -f docker-compose.prod.yml build

# 或单独构建
docker build -t svton-backend -f apps/backend/Dockerfile .
docker build -t svton-admin -f apps/admin/Dockerfile .
```

### 3. 启动服务

```bash
# 使用环境变量文件启动
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 运行数据库迁移
docker exec svton-backend npx prisma migrate deploy

# 初始化数据（首次部署）
docker exec svton-backend node dist/scripts/init-data.js
```

### 4. 验证部署

```bash
# 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 检查日志
docker logs svton-backend
docker logs svton-admin

# 测试 API
curl http://localhost:3000/api/health
```

---

## 📊 常用命令

```bash
# 查看容器状态
docker ps

# 进入容器
docker exec -it svton-backend sh

# 查看日志
docker logs -f svton-backend --tail 100

# 重启服务
docker-compose -f docker-compose.prod.yml restart backend

# 更新部署
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 清理无用镜像
docker image prune -a
```

---

## 🔧 Nginx 配置

```nginx
upstream backend {
    server 127.0.0.1:3000;
}

upstream admin {
    server 127.0.0.1:3001;
}

# API 服务
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# 管理后台
server {
    listen 80;
    server_name admin.your-domain.com;

    location / {
        proxy_pass http://admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

**下一步**: 生产部署
