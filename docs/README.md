# 📚 Svton 架构文档

> 基于 NestJS + Next.js + Taro 的全栈 Monorepo 脚手架

---

## 📖 文档目录

### 🚀 入门指南
| 文档 | 说明 |
|------|------|
| [快速开始](./start/quick-start.md) | 5 分钟快速启动项目 |
| [项目概览](./start/overview.md) | 项目整体介绍和架构概览 |
| [环境准备](./start/prerequisites.md) | 开发环境安装和配置 |
| [项目初始化](./start/initialization.md) | 从零开始创建新项目 |

### 🧭 Devpilot 平台
| 文档 | 说明 |
|------|------|
| [Devpilot 使用指南](./devpilot/usage-guide.md) | 面向新用户的功能使用与状态总览 |

### 🏗️ 架构设计
| 文档 | 说明 |
|------|------|
| [整体架构](./framework/architecture/overview.md) | 系统架构设计和技术选型 |
| [Monorepo 结构](./framework/architecture/monorepo.md) | pnpm + Turborepo 工作空间管理 |
| [目录规范](./framework/architecture/directory-structure.md) | 项目目录结构规范 |
| [依赖管理](./framework/architecture/dependencies.md) | 包依赖关系和版本管理 |

### 🔧 后端开发 (Backend)
| 文档 | 说明 |
|------|------|
| [NestJS 入门](./backend/nestjs-basics.md) | NestJS 框架基础 |
| [模块开发](./framework/backend/modules.md) | 如何开发新模块 |
| [Prisma ORM](./backend/prisma.md) | 数据库操作指南 |
| [认证授权](./backend/authentication.md) | JWT + Passport 认证系统 |
| [API 设计](./backend/api-design.md) | RESTful API 设计规范 |

### 💻 管理后台 (Admin)
| 文档 | 说明 |
|------|------|
| [Next.js 入门](./admin/nextjs-basics.md) | Next.js 14 App Router 基础 |
| [页面开发](./admin/pages.md) | 如何开发新页面 |
| [组件库](./admin/components.md) | shadcn/ui + Radix UI 组件 |
| [状态管理](./admin/state-management.md) | Zustand + SWR 状态管理 |

### 📱 移动端 (Mobile)
| 文档 | 说明 |
|------|------|
| [Taro 入门](./mobile/taro-basics.md) | Taro 跨端框架基础 |
| [页面开发](./mobile/pages.md) | 如何开发小程序页面 |
| [组件库](./mobile/taro-ui.md) | Taro UI 组件使用 |
| [样式规范](./mobile/styling.md) | 设计稿转换和样式开发 |

### 📦 共享包 (Packages)
| 文档 | 说明 |
|------|------|
| [cli](./framework/cli.md) | SVTON CLI脚手架工具 |
| [authz](./packages/authz.md) | RBAC 核心授权包 |
| [types](./packages/types.md) | 类型定义包 |
| [api-client](./packages/api-client.md) | API 客户端包 |
| [hooks](./packages/hooks.md) | React Hooks 工具包 |
| [ui](./packages/ui.md) | React UI 组件库 |
| [taro-ui](./packages/taro-ui.md) | Taro UI 组件库 |

### 🛠️ 开发工具
| 文档 | 说明 |
|------|------|
| [CLI 命令](./tools/cli.md) | 项目常用命令 |
| [代码规范](./framework/coding-standards.md) | ESLint + Prettier 配置 |
| [Git 工作流](./tools/git-workflow.md) | 分支管理和提交规范 |
| [调试技巧](./tools/debugging.md) | 开发调试技巧 |

### 🚢 部署运维
| 文档 | 说明 |
|------|------|
| [环境配置](./framework/deployment/environment.md) | 环境变量配置指南 |
| [Docker 部署](./framework/deployment/docker.md) | Docker 容器化部署 |
| [生产部署](./framework/deployment/production.md) | 生产环境部署流程 |
| [监控日志](./framework/deployment/monitoring.md) | 日志和监控配置 |

### 📋 参考资料
| 文档 | 说明 |
|------|------|
| [API 文档](./reference/api.md) | 完整 API 接口文档 |
| [数据库设计](./reference/database.md) | 数据库 Schema 设计 |
| [配置参考](./reference/configuration.md) | 所有配置项说明 |
| [常见问题](./reference/faq.md) | FAQ 和问题排查 |

---

## 🎯 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                       Svton 架构                             │
├─────────────────────────────────────────────────────────────┤
│  Frontend                                                    │
│  ├── Admin:   Next.js 15 + React 19 + TailwindCSS           │
│  └── Mobile:  Taro 3.6 + React 18 + SCSS                    │
├─────────────────────────────────────────────────────────────┤
│  Backend                                                     │
│  └── API:     NestJS 10 + Prisma 5 + MySQL 8                │
├─────────────────────────────────────────────────────────────┤
│  Shared Packages                                             │
│  ├── @{org}/types      → 共享类型定义（项目私有包）            │
│  ├── @svton/api-client → API 客户端（npm 公共包）             │
│  ├── @svton/hooks      → React Hooks（npm 公共包）           │
│  └── @svton/taro-ui    → Taro 组件库（npm 公共包）           │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure                                              │
│  ├── pnpm workspace    → Monorepo 管理                       │
│  ├── Turborepo         → 构建编排                            │
│  ├── Docker            → 容器化部署                          │
│  └── Redis             → 缓存服务                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 快速链接

- **脚手架仓库**: https://github.com/751848178/svton
- **API 文档**: http://localhost:3000/api-docs (Swagger)
- **管理后台**: http://localhost:3001

---

**版本**: 1.0.0  
**最后更新**: 2024-12
