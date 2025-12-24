---
layout: home

hero:
  name: Svton
  text: 全栈 Monorepo 脚手架
  tagline: 基于 NestJS + Next.js + Taro 的企业级项目架构
  image:
    src: /logo.svg
    alt: Svton
  actions:
    - theme: brand
      text: 快速开始
      link: /getting-started/quick-start
    - theme: alt
      text: 架构设计
      link: /architecture/overview
    - theme: alt
      text: GitHub
      link: https://github.com/751848178/svton

features:
  - icon: 🏗️
    title: Monorepo 架构
    details: 使用 pnpm workspace + Turborepo，统一管理多个应用和共享包
  - icon: 🔧
    title: NestJS 后端
    details: 模块化架构，Prisma ORM，JWT 认证，Swagger 文档
  - icon: 💻
    title: Next.js 管理后台
    details: App Router，React 19，TailwindCSS，Radix UI
  - icon: 📱
    title: Taro 小程序
    details: 跨端开发，React 18，Zustand 状态管理
  - icon: 📦
    title: 共享包
    details: 类型定义、API 客户端、React Hooks、UI 组件库
  - icon: 🚀
    title: 一键初始化
    details: 提供脚手架脚本，快速创建新项目
---

## 🎯 技术栈

<div class="tech-stack">

| 层级 | 技术 |
|------|------|
| **后端** | NestJS 10 + Prisma 5 + MySQL 8 + Redis |
| **管理后台** | Next.js 15 + React 19 + TailwindCSS |
| **移动端** | Taro 3.6 + React 18 + Zustand |
| **基础设施** | pnpm + Turborepo + Docker |

</div>

## 📦 共享包

```typescript
// 类型定义 - 项目私有包，{org} 为你的项目组织名
import type { UserVo, ContentVo } from '@{org}/types';

// API 客户端 - @svton 公共包
import { apiAsync } from '@svton/api-client';

// React Hooks - @svton 公共包
import { usePersistFn, useDebounce } from '@svton/hooks';

// Taro UI 组件 - @svton 公共包
import { NavBar, Button } from '@svton/taro-ui';
```
