---
layout: home

hero:
  name: Svton
  text: 全栈框架 + AI Agent 平台
  tagline: 基于 NestJS + Next.js + Taro 的企业级 Monorepo，内置可嵌入的 AI Agent
  image:
    src: /logo.svg
    alt: Svton
  actions:
    - theme: brand
      text: 快速开始
      link: /start/quick-start
    - theme: alt
      text: Svton 框架
      link: /framework/
    - theme: alt
      text: AI Agent
      link: /agent/
    - theme: alt
      text: GitHub
      link: https://github.com/751848178/svton

features:
  - icon: 🏗️
    title: Monorepo 架构
    details: pnpm workspace + Turborepo，统一管理后端 / 管理后台 / 移动端与共享包
    link: /framework/architecture/overview
  - icon: 🛠️
    title: CLI 命令行
    details: svton create 一键脚手架；dev/build/doctor/db/services/generate 运行与操作项目
    link: /framework/cli
  - icon: 🔧
    title: NestJS 后端
    details: 模块化架构，Prisma ORM，JWT 认证，Swagger 文档
    link: /framework/backend/modules
  - icon: 💻
    title: Next.js 管理后台
    details: App Router，React 19，TailwindCSS，Radix UI
  - icon: 📱
    title: Taro 小程序
    details: 跨端开发，React 18，Zustand 状态管理
  - icon: 🤖
    title: AI Agent
    details: 可嵌入的 Agent 运行时、React SDK、组件库与开箱即用的桌面/Web 应用
    link: /agent/
---

## 🎯 技术栈

<div class="tech-stack">

| 层级 | 技术 |
|------|------|
| **后端** | NestJS 10 + Prisma 5 + MySQL 8 + Redis |
| **管理后台** | Next.js 15 + React 19 + TailwindCSS |
| **移动端** | Taro 3.6 + React 18 + Zustand |
| **AI Agent** | agent-core 运行时 + agent-sdk + agent-ui 组件库 |
| **基础设施** | pnpm + Turborepo + Docker |

</div>

## 🚀 从这里开始

- **[快速开始](/start/quick-start)** — 用 `svton create` 创建你的第一个项目
- **[Svton 框架](/framework/)** — 架构、CLI、后端开发、部署
- **[AI Agent](/agent/)** — 集成指南、运行时、组件库、应用
- **[包参考](/packages/)** — 所有 `@svton/*` 共享包与 NestJS 模块
