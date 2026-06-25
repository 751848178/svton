# 快速开始

> 几分钟内用 Svton 创建并跑起一个全栈项目。

## 创建项目

```bash
# 推荐:npx 免安装
npx @svton/cli create my-app

# 或全局安装后
npm install -g @svton/cli
svton create my-app
```

按提示选择模板(全栈 / 仅后端 / 仅管理后台 / 仅移动端)、数据库与功能特性。

## 运行项目

`svton create` 生成的项目根自带 `svton.config.ts`,可直接用 `svton` 命令操作(零配置可用):

```bash
cd my-app
svton services up     # 启动本地 MySQL/Redis(docker compose)
svton db init         # prisma generate + migrate
svton dev             # 启动全部 app(委托 turbo)
svton doctor          # 体检 node/pnpm/端口/env/prisma
```

## 接下来

- [快速开始](./quick-start) — 完整分步教程
- [项目概览](./overview) — 了解生成出来的项目结构
- [环境准备](./prerequisites) — Node / pnpm / Docker 要求
- [项目初始化](./initialization) — 初始化细节与选项
