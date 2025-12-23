# SVTON Documentation

欢迎使用 SVTON 全栈开发框架！这里包含了完整的架构文档、开发指南和最佳实践。

## 📦 核心包文档

### CLI 工具
```bash
# 创建新项目
npx svton create my-app

# 查看帮助
npx svton create --help
```

### 主要包
- **[@svton/cli](https://npmjs.com/package/@svton/cli)** - SVTON CLI脚手架工具 ⭐
- **[@svton/api-client](https://npmjs.com/package/@svton/api-client)** - TypeScript优先的API客户端
- **[@svton/types](https://npmjs.com/package/@svton/types)** - 模块增强的类型定义
- **[@svton/hooks](https://npmjs.com/package/@svton/hooks)** - 生产就绪的React Hooks
- **[@svton/taro-ui](https://npmjs.com/package/@svton/taro-ui)** - Taro UI组件库

## 📚 架构与设计

### 🏗️ 项目架构
- [架构文档](architecture/README.md) - 完整的架构设计文档
- [项目概述](architecture/getting-started/overview.md) - 项目结构和技术栈
- [快速开始](architecture/getting-started/quick-start.md) - 5分钟上手指南
- [单体架构设计](architecture/architecture/monorepo.md) - Monorepo架构实现

### 🎨 设计系统
- [设计提示](design-prompts/README.md) - 完整的设计系统指南
- [UI设计系统](UI_DESIGN_SYSTEM.md) - 组件设计规范
- [设计主题](design-prompts/design-theme.md) - 色彩和风格指南
- [移动端设计规范](../apps/mobile/docs/design-scale-standard.md) - 1.7倍缩放标准

## 📚 开发指南

### 🎯 必读文档
- [编码规范](CODING_STANDARDS.md) - 统一的开发规范和最佳实践
- [Hooks使用指南](SHARED-HOOKS-GUIDE.md) - React Hooks详细用法
- [Taro最佳实践](Taro组件库最佳实践.md) - 移动端开发指南

### 🔧 核心功能模块
- [配置系统设计](CONFIG_SYSTEM_DESIGN.md) - 动态配置系统架构
- [存储策略](STORAGE-STRATEGY.md) - 文件存储和管理方案
- [智能上传指南](SMART-UPLOAD-GUIDE.md) - 文件上传组件使用
- [字典模块](DICTIONARY_MODULE_GUIDE.md) - 数据字典系统
- [Miaoduo集成](MIAODUO_GUIDE.md) - 设计稿自动转换

### 📱 UI组件库
- [UI组件库设计](UI组件库设计文档.md) - 组件库架构设计
- [组件开发指南](architecture/packages/taro-ui.md) - Taro UI组件开发

## 📖 开发指南

### 🔍 API 开发
- [API客户端架构](architecture/packages/api-client.md) - 类型安全的API客户端
- [响应结构指南](guides/RESPONSE_STRUCTURE_GUIDE.md) - 统一的API响应格式
- [分页指南](guides/CURSOR_PAGINATION_GUIDE.md) - 游标分页实现

### 🗂️ 数据管理
- [内容分类指南](guides/CONTENT_CLASSIFICATION_GUIDE.md) - 内容分类系统
- [数据库迁移指南](DATABASE-MIGRATION-GUIDE.md) - 数据库版本管理

### ⚡ 性能优化
- [性能优化指南](PERFORMANCE-OPTIMIZATION.md) - 全栈性能优化策略
- [SSR身份验证](guides/ssr-auth.md) - 服务端渲染中的身份验证

## 🏗️ 部署与运维

### 📦 包管理
- [包架构设计](architecture/packages/) - 各个包的详细设计
- [部署环境配置](architecture/deployment/environment.md) - 环境变量和配置

### 🐳 容器化部署
- [Docker部署](architecture/deployment/docker.md) - 容器化部署方案

## 🎨 设计资源

### 📋 页面设计提示
- [登录页面](design-prompts/01-login-page.md)
- [首页设计](design-prompts/02-index-page.md)
- [详情页面](design-prompts/03-detail-page.md)
- [发布页面](design-prompts/04-publish-page.md)
- [分类页面](design-prompts/05-category-page.md)
- [个人中心](design-prompts/06-mine-page.md)

## 🚀 快速开始

1. **创建项目**
   ```bash
   npx svton create my-project
   cd my-project
   ```

2. **开发环境**
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   pnpm install
   pnpm dev
   ```

3. **访问应用**
   - Admin: http://localhost:3001
   - Backend: http://localhost:3000
   - Mobile: 小程序开发工具

## 📖 更多资源

- [GitHub](https://github.com/svton)
- [npm Packages](https://npmjs.com/org/svton)
- [发布指南](../RELEASE_GUIDE.md)

---

**文档结构**:
```
docs/
├── architecture/          # 架构设计文档
├── design-prompts/        # 设计系统和页面提示
├── guides/               # 开发指南和最佳实践  
├── CODING_STANDARDS.md   # 编码规范
├── CONFIG_SYSTEM_DESIGN.md # 配置系统
├── PERFORMANCE-OPTIMIZATION.md # 性能优化
└── README.md            # 本文档
```

**最后更新**: 2024-12-23  
**SVTON 框架文档 - 完整版**
