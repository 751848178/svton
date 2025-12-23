---
layout: home

hero:
  name: Svton
  text: 全栈应用框架
  tagline: CLI 工具、共享包和项目模板，快速构建 NestJS + Next.js + Taro 应用
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 在 GitHub 上查看
      link: https://github.com/751848178/svton

features:
  - icon: 🚀
    title: CLI 脚手架
    details: 一条命令创建全栈项目，支持多种模板选择
  - icon: 📦
    title: 共享包
    details: 可复用的 API 客户端、React Hooks 和 Taro UI 组件库
  - icon: 🎯
    title: 类型安全
    details: 完整的 TypeScript 支持，端到端类型安全
  - icon: 🛠️
    title: 开发体验
    details: ESLint、Prettier、Turbo 预配置，开箱即用
---

## 快速开始

```bash
# 创建新项目
npx @svton/cli create my-app

# 或全局安装后使用
npm install -g @svton/cli
svton create my-app
```

## 包列表

| 包名 | 描述 |
|------|------|
| [@svton/cli](https://www.npmjs.com/package/@svton/cli) | CLI 脚手架工具 |
| [@svton/api-client](https://www.npmjs.com/package/@svton/api-client) | TypeScript API 客户端 |
| [@svton/hooks](https://www.npmjs.com/package/@svton/hooks) | React Hooks 集合 |
| [@svton/taro-ui](https://www.npmjs.com/package/@svton/taro-ui) | Taro UI 组件库 |
