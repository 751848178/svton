# 环境准备

> 详细的开发环境安装和配置指南

---

## 🖥️ 系统要求

| 系统 | 支持状态 |
|------|---------|
| macOS 12+ | ✅ 推荐 |
| Windows 10/11 | ✅ 支持 |
| Ubuntu 20.04+ | ✅ 支持 |

---

## 📦 必需软件

### 1. Node.js

**推荐版本**: 20.x LTS

```bash
# macOS (使用 Homebrew)
brew install node@20

# 或使用 nvm 管理多版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Windows (使用 winget)
winget install OpenJS.NodeJS.LTS

# 验证安装
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2. pnpm

**推荐版本**: 8.12.0+

```bash
# 使用 npm 安装
npm install -g pnpm@8

# 或使用 corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@8.12.0 --activate

# 验证安装
pnpm --version  # 8.12.0
```

### 3. Docker (推荐)

用于运行 MySQL 和 Redis 服务。

```bash
# macOS
brew install --cask docker

# Windows
winget install Docker.DockerDesktop

# Ubuntu
sudo apt-get install docker.io docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

## 🗄️ 数据库服务

### 方式一：Docker Compose (推荐)

项目根目录已包含 `docker-compose.yml`：

```bash
# 启动 MySQL + Redis
docker-compose up -d

# 查看运行状态
docker ps

# 停止服务
docker-compose down

# 停止并清除数据
docker-compose down -v
```

**默认配置**：

| 服务 | 端口 | 用户名 | 密码 |
|------|------|--------|------|
| MySQL | 3306 | root | community2024 |
| MySQL | 3306 | community | community2024 |
| Redis | 6379 | - | - |

### 方式二：本地安装 MySQL

```bash
# macOS
brew install mysql@8.0
brew services start mysql@8.0

# Ubuntu
sudo apt-get install mysql-server

# 创建数据库
mysql -u root -p
CREATE DATABASE community_helper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 方式三：本地安装 Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis-server

# 验证
redis-cli ping  # 应返回 PONG
```

---

## 🔐 可选 Live Adapter 开关

Devpilot 的生产资源 live 操作默认关闭。只在确认目标环境、凭据和访问策略后再开启：

```bash
# 允许日志中心通过 cloud_aliyun TeamCredential 执行 SLS GetLogs 只读 live 查询
LOG_CENTER_SLS_LIVE_QUERY_ENABLED=false

# SLS live 查询超时与重试
LOG_CENTER_SLS_QUERY_TIMEOUT_MS=10000
LOG_CENTER_SLS_QUERY_RETRY_ATTEMPTS=1
LOG_CENTER_SLS_QUERY_RETRY_BASE_DELAY_MS=200

# 默认关闭 SLS 按日志流回填调度；启用后仍只处理 slsBackfill.enabled=true 的流
LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED=false
LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN=true
LOG_CENTER_SLS_BACKFILL_SCHEDULER_INTERVAL_SECONDS=300
LOG_CENTER_SLS_BACKFILL_SCHEDULER_SCAN_LIMIT=100
LOG_CENTER_SLS_BACKFILL_DEFAULT_INTERVAL_MINUTES=15
```

日志中心页面仍需要用户显式勾选 live 读取并确认线上日志读取，后端也会检查 `params.confirmLiveRead=true`。
定时回填还需要在单条 SLS 日志流上保存 `slsBackfill.enabled=true`；如果要 live 回填，还要该流保存 live 和确认读取配置。

---

## 🔧 IDE 配置

### VS Code (推荐)

安装推荐扩展：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "formulahendry.auto-rename-tag",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**工作区设置** (`.vscode/settings.json`)：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### WebStorm

1. 启用 ESLint: `Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint`
2. 启用 Prettier: `Settings > Languages & Frameworks > JavaScript > Prettier`
3. 设置保存时自动格式化

---

## 📱 小程序开发工具

### 微信开发者工具

1. 下载: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 安装并登录
3. 导入项目目录: `apps/mobile/dist`
4. 配置 AppID (可使用测试号)

---

## 🌐 网络配置

### npm/pnpm 源

`@svton/cli create` 生成的新项目默认会写入 `registry=https://registry.npmmirror.com`，并在自动安装依赖时使用同一个源。需要使用公司内网源时，可以在创建项目时覆盖：

```bash
svton create my-app --registry https://npm.my-company.internal
```

也可以在 CI 或 shell 中统一设置：

```bash
export SVTON_NPM_REGISTRY=https://npm.my-company.internal
```

### 全局代理设置 (如需)

```bash
# npm/pnpm 代理
pnpm config set registry https://registry.npmmirror.com

# 恢复默认
pnpm config delete registry
```

### 端口使用

确保以下端口未被占用：

| 端口 | 用途 |
|------|------|
| 3000 | 后端 API |
| 3001 | 管理后台 |
| 3306 | MySQL |
| 6379 | Redis |

```bash
# 检查端口占用 (macOS/Linux)
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

---

## ✅ 环境验证清单

运行以下命令验证环境：

```bash
# Node.js
node --version    # >= 18.0.0

# pnpm
pnpm --version    # >= 8.0.0

# Docker (可选)
docker --version

# MySQL
mysql --version   # 或 docker ps | grep mysql

# Redis
redis-cli ping    # 或 docker ps | grep redis
```

---

## 🐛 常见问题

### Node.js 版本不对

使用 nvm 切换版本：

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

### pnpm 命令找不到

重新安装或添加到 PATH：

```bash
npm install -g pnpm
# 或
export PATH="$PATH:$(npm bin -g)"
```

### Docker 权限问题 (Linux)

```bash
sudo usermod -aG docker $USER
# 然后重新登录
```

---

**下一步**: [快速开始](./quick-start.md)
