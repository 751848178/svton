# 快速开始

## 安装

### 使用 npx（推荐）

```bash
npx @svton/cli create my-app
```

### 全局安装

```bash
npm install -g @svton/cli
svton create my-app
```

## 创建项目

运行创建命令后，CLI 会引导你完成项目配置：

```bash
svton create my-app
```

### 交互式配置

1. **选择模板**
   - `full-stack` - 完整全栈应用（后端 + 管理后台 + 移动端）
   - `backend-only` - 仅后端服务
   - `admin-only` - 仅管理后台
   - `mobile-only` - 仅移动端应用

2. **配置组织名** - 用于包的命名空间，如 `@my-org/backend`

3. **选择包管理器** - npm、yarn 或 pnpm

### 命令选项

```bash
svton create <project-name> [options]

选项：
  -o, --org <name>           组织名称（默认：项目名）
  -t, --template <template>  模板类型
  -p, --package-manager <pm> 包管理器
  --skip-install             跳过依赖安装
  --skip-git                 跳过 Git 初始化
```

## 项目启动

### 1. 启动数据库

```bash
cd my-app
docker-compose up -d
```

### 2. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
# 编辑 .env 文件配置数据库连接等
```

### 3. 初始化数据库

```bash
pnpm --filter @my-org/backend prisma:generate
pnpm --filter @my-org/backend prisma:migrate
```

### 4. 启动开发服务器

```bash
pnpm dev
```

## 访问应用

- **后端 API**: http://localhost:3000
- **管理后台**: http://localhost:3001
- **移动端开发**: 使用微信开发者工具打开 `apps/mobile/dist`

## 下一步

- [项目结构](./project-structure) - 了解项目目录结构
- [配置说明](./configuration) - 详细配置指南
- [编码规范](../standards/coding) - 开发规范和最佳实践
