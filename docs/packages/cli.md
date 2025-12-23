# @svton/cli

CLI 脚手架工具，用于快速创建 Svton 全栈项目。

## 安装

```bash
npm install -g @svton/cli
```

## 使用

```bash
svton create <project-name> [options]
svton init <project-name> [options]   # 别名
svton new <project-name> [options]    # 别名
```

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-o, --org <name>` | 组织名称 | 项目名 |
| `-t, --template <template>` | 模板类型 | 交互选择 |
| `-p, --package-manager <pm>` | 包管理器 | pnpm |
| `--skip-install` | 跳过依赖安装 | false |
| `--skip-git` | 跳过 Git 初始化 | false |

## 模板

### full-stack

完整全栈应用，包含：
- **Backend**: NestJS + Prisma + MySQL + Redis
- **Admin**: Next.js + TailwindCSS + shadcn/ui
- **Mobile**: Taro + React (微信小程序)
- **Types**: 共享类型定义

### backend-only

仅后端服务：
- NestJS API 服务器
- Prisma ORM
- JWT 认证
- Swagger 文档

### admin-only

仅管理后台：
- Next.js 15 (App Router)
- TailwindCSS
- shadcn/ui 组件库

### mobile-only

仅移动端应用：
- Taro 3.6
- React 18
- 微信小程序支持

## 示例

```bash
# 创建全栈应用
svton create my-app

# 使用自定义组织名
svton create my-app --org my-company

# 创建仅后端项目
svton create my-api --template backend-only

# 跳过依赖安装
svton create my-app --skip-install

# 使用 yarn
svton create my-app --package-manager yarn
```
