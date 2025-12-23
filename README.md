# Svton 框架

> 全栈应用框架，包含 CLI 工具、共享包和项目模板

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 概述

Svton 是一个完整的全栈应用框架，提供：

- **CLI 工具** (`svton`) - 一条命令创建新项目
- **共享包** - 可复用的 API 客户端、Hooks 和 UI 组件库
- **项目模板** - 生产级别的后端、管理后台和移动端模板
- **文档** - 完整的开发指南和架构文档

## 包列表

| 包名 | 描述 | npm |
|------|------|-----|
| `@svton/cli` | CLI 脚手架工具 | [![npm](https://img.shields.io/npm/v/@svton/cli.svg)](https://www.npmjs.com/package/@svton/cli) |
| `@svton/api-client` | TypeScript API 客户端 | [![npm](https://img.shields.io/npm/v/@svton/api-client.svg)](https://www.npmjs.com/package/@svton/api-client) |
| `@svton/hooks` | React Hooks 集合 | [![npm](https://img.shields.io/npm/v/@svton/hooks.svg)](https://www.npmjs.com/package/@svton/hooks) |
| `@svton/taro-ui` | Taro UI 组件库 | [![npm](https://img.shields.io/npm/v/@svton/taro-ui.svg)](https://www.npmjs.com/package/@svton/taro-ui) |

## 快速开始

```bash
# 创建新项目
npx @svton/cli create my-app

# 或全局安装后使用
npm install -g @svton/cli
svton create my-app
```

## 项目模板

- **全栈模板** - 后端 (NestJS) + 管理后台 (Next.js) + 移动端 (Taro)
- **仅后端** - NestJS + Prisma + MySQL + Redis
- **仅管理后台** - Next.js + TailwindCSS + shadcn/ui
- **仅移动端** - Taro + React (微信小程序)

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 开发模式
pnpm dev

# 运行测试
pnpm test
```

## 项目结构

```
svton/
├── packages/
│   ├── cli/              # svton CLI 工具
│   ├── api-client/       # @svton/api-client
│   ├── hooks/            # @svton/hooks
│   └── taro-ui/          # @svton/taro-ui
├── templates/
│   ├── apps/
│   │   ├── admin/        # Next.js 管理后台模板
│   │   ├── backend/      # NestJS 后端模板
│   │   └── mobile/       # Taro 移动端模板
│   └── packages/
│       └── types/        # 类型定义包模板
├── docs/                 # 文档
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加新功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

MIT © [SVTON Team](https://github.com/svton)
