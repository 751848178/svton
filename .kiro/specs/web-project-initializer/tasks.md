# Implementation Plan: Web Project Initializer

## Overview

本实现计划将 Web Project Initializer 分为多个阶段，从基础架构搭建到核心功能实现，再到高级功能（资源池、Git 集成等）。采用 TypeScript 全栈开发，前端 Next.js，后端 NestJS。

## Tasks

- [x] 1. 项目初始化与基础架构
  - [x] 1.1 创建 monorepo 项目结构
    - 在 svton monorepo 中创建 `apps/initializer-web` (Next.js) 和 `apps/initializer-api` (NestJS)
    - 配置 pnpm workspace 和 turbo
    - _Requirements: 项目基础结构_

  - [x] 1.2 配置 Next.js 前端项目
    - 初始化 Next.js 15 + React 19 + TypeScript
    - 配置 TailwindCSS + @svton/ui
    - 集成 @svton/hooks、@svton/service、@svton/logger
    - 设置基础布局和路由结构
    - _Requirements: 2.1_

  - [x] 1.3 配置 NestJS 后端项目
    - 初始化 NestJS + TypeScript
    - 配置 Prisma + PostgreSQL
    - 集成 @svton/nestjs-logger、@svton/nestjs-config-schema
    - 集成 @svton/nestjs-redis、@svton/nestjs-cache
    - 设置基础模块结构
    - _Requirements: 后端基础架构_

  - [ ]* 1.4 编写项目结构验证测试
    - 验证 monorepo 配置正确性
    - _Requirements: 1.1-1.3_

- [-] 2. 用户认证模块
  - [x] 2.1 实现数据库模型
    - 创建 User、Account Prisma 模型
    - 运行数据库迁移
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 实现邮箱注册登录
    - 创建 Auth Module (NestJS)
    - 实现注册、登录、密码重置 API
    - 实现 JWT 认证策略
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ] 2.3 实现 OAuth 登录
    - 集成 NextAuth.js
    - 配置 GitHub、GitLab、Gitee OAuth Provider
    - _Requirements: 1.2_

  - [x] 2.4 实现前端认证页面
    - 创建登录、注册、密码重置页面
    - 实现 OAuth 登录按钮
    - _Requirements: 1.1, 1.2, 1.6_

  - [ ]* 2.5 编写认证访问控制属性测试
    - **Property 14: 认证访问控制**
    - **Validates: Requirements 1.5**

- [ ] 3. Checkpoint - 认证模块完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 功能注册表模块
  - [x] 4.1 创建功能注册表 JSON 配置
    - 定义所有 Business_Features 的元数据
    - 定义 Feature → Package 映射
    - 定义代码片段和配置 Schema
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [x] 4.2 实现 Registry Service
    - 加载和解析功能注册表
    - 实现功能查询和过滤 API
    - _Requirements: 8.3_

  - [ ]* 4.3 编写注册表完整性属性测试
    - **Property 10: 功能注册表完整性**
    - **Property 11: 代码片段定义完整性**
    - **Validates: Requirements 8.1, 8.4**

  - [x] 4.4 创建资源配置 Schema
    - 定义各类资源的配置字段
    - 定义环境变量模板
    - _Requirements: 5.1, 5.3_

- [x] 5. 包依赖解析器
  - [x] 5.1 实现 Package Resolver
    - 解析功能到包的映射
    - 处理包之间的依赖关系
    - 返回去重后的包列表
    - _Requirements: 4.2_

  - [ ]* 5.2 编写依赖解析属性测试
    - **Property 3: 功能到包的依赖解析完整性**
    - **Validates: Requirements 4.2**

  - [x] 5.3 实现功能过滤器
    - 根据选中的子项目过滤可用功能
    - _Requirements: 4.6_

  - [ ]* 5.4 编写功能过滤属性测试
    - **Property 4: 功能过滤正确性**
    - **Validates: Requirements 4.6**

- [ ] 6. Checkpoint - 注册表和解析器完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 项目配置前端
  - [x] 7.1 实现项目创建向导容器
    - 创建多步骤向导组件
    - 实现步骤导航和状态管理
    - _Requirements: 2.1_

  - [x] 7.2 实现基础信息步骤
    - 项目名、组织名、描述输入
    - 包管理器选择
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 7.3 编写项目名验证属性测试
    - **Property 1: 项目名称验证一致性**
    - **Validates: Requirements 2.2**

  - [x] 7.4 实现子项目选择步骤
    - backend/admin/mobile 选择卡片
    - UI 库和 Hooks 库选择
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 7.5 编写子项目选择约束属性测试
    - **Property 2: 子项目选择约束**
    - **Validates: Requirements 3.3**

  - [x] 7.6 实现功能选择步骤
    - 分类展示业务功能
    - 显示功能描述和关联包
    - 自动解析依赖并显示
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [x] 7.7 实现资源配置步骤
    - 根据选中功能显示所需资源
    - 资源凭证表单（支持跳过）
    - 凭证值脱敏显示
    - _Requirements: 5.2, 5.3, 5.6, 5.7_

- [x] 8. 资源凭证管理
  - [x] 8.1 实现 Resource Module (后端)
    - 创建 Resource Prisma 模型
    - 实现凭证加密存储
    - 实现 CRUD API
    - _Requirements: 5.1, 5.4_

  - [ ]* 8.2 编写凭证加密往返属性测试
    - **Property 5: 资源凭证加密往返一致性**
    - **Validates: Requirements 5.4**

  - [x] 8.3 实现资源管理前端页面
    - 资源列表展示
    - 添加/编辑/删除资源
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

- [ ] 9. Checkpoint - 项目配置 UI 完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 项目生成引擎
  - [x] 10.1 实现模板渲染器
    - 使用 Mustache 渲染模板
    - 处理变量替换
    - _Requirements: 7.1_

  - [x] 10.2 实现代码注入器
    - 解析 app.module.ts 并注入模块
    - 生成 package.json 依赖
    - _Requirements: 7.2_

  - [ ]* 10.3 编写模块导入正确性属性测试
    - **Property 8: NestJS 模块导入正确性**
    - **Validates: Requirements 7.2**

  - [x] 10.4 实现环境变量生成器
    - 生成 .env.example（所有变量）
    - 生成 .env（填充用户凭证）
    - _Requirements: 7.3, 7.4_

  - [ ]* 10.5 编写环境变量生成属性测试
    - **Property 6: 环境变量生成完整性**
    - **Validates: Requirements 5.5, 7.3, 7.4**

  - [x] 10.6 实现 Docker Compose 生成器
    - 根据选中资源生成服务定义
    - _Requirements: 7.7_

  - [ ]* 10.7 编写 Docker Compose 匹配属性测试
    - **Property 9: Docker Compose 服务匹配**
    - **Validates: Requirements 7.7**

  - [x] 10.8 实现项目结构生成器
    - 根据选中子项目创建目录结构
    - 复制基础模板文件
    - _Requirements: 7.1_

  - [ ]* 10.9 编写项目结构完整性属性测试
    - **Property 7: 生成项目结构完整性**
    - **Validates: Requirements 7.1**

  - [x] 10.10 实现 ZIP 打包器
    - 使用 Archiver 打包生成的项目
    - 提供下载链接
    - _Requirements: 7.5_

- [ ] 11. Checkpoint - 项目生成引擎完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 12. 配置预览功能
  - [x] 12.1 实现文件树预览组件
    - 展示生成的项目结构
    - _Requirements: 9.1_

  - [x] 12.2 实现文件内容预览
    - 语法高亮显示
    - 显示功能贡献来源
    - _Requirements: 9.2, 9.3, 9.4_

- [x] 13. 配置预设功能
  - [x] 13.1 实现 Preset Module (后端)
    - 创建 Preset Prisma 模型
    - 实现保存/加载/删除 API
    - _Requirements: 10.1, 10.2_

  - [ ]* 13.2 编写预设往返属性测试
    - **Property 12: 配置预设往返一致性**
    - **Validates: Requirements 10.3**

  - [x] 13.3 实现配置导入导出
    - JSON 导出功能
    - JSON 导入功能
    - _Requirements: 10.4, 10.5_

  - [ ]* 13.4 编写导入导出往返属性测试
    - **Property 13: 配置导出导入往返一致性**
    - **Validates: Requirements 10.4, 10.5**

  - [x] 13.5 实现预设管理前端
    - 预设列表页面
    - 保存/加载预设 UI
    - _Requirements: 10.1, 10.3_

- [ ] 14. Checkpoint - 核心功能完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 15. Git 集成模块
  - [x] 15.1 实现 Git Module (后端)
    - 创建 GitConnection Prisma 模型
    - 实现 OAuth 连接 API
    - _Requirements: 6.1, 6.2_

  - [x] 15.2 实现 Git Provider 适配器
    - GitHub API 集成（使用 @svton/nestjs-http）
    - GitLab API 集成
    - Gitee API 集成
    - _Requirements: 6.1_

  - [x] 15.3 实现仓库操作
    - 列出用户仓库
    - 创建新仓库
    - 推送代码
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 15.4 实现 Git 集成前端
    - Git 账号连接 UI
    - 仓库选择/创建 UI
    - _Requirements: 6.3, 6.4_

  - [x] 15.5 实现 Git 初始化文件生成
    - 生成 .gitignore
    - 生成 README.md
    - _Requirements: 6.6_

- [x] 16. 资源池管理（可选功能）
  - [x] 16.1 实现 ResourcePool 数据模型
    - 创建 ResourcePool、ResourceAllocation Prisma 模型
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 16.2 实现资源池管理 API
    - 池的 CRUD 操作
    - 容量和状态管理
    - _Requirements: 11.3, 11.4_

  - [x] 16.3 实现 MySQL Provisioner
    - 连接 MySQL 实例
    - 创建数据库和用户
    - 实现回滚机制
    - _Requirements: 12.2, 12.5_

  - [ ]* 16.4 编写资源开通事务属性测试
    - **Property 15: 资源开通事务一致性**
    - **Validates: Requirements 12.5**

  - [x] 16.5 实现 Redis Provisioner
    - 分配 Redis DB 或 key prefix
    - _Requirements: 12.3_

  - [ ]* 16.6 编写资源分配唯一性属性测试
    - **Property 16: 资源分配唯一性**
    - **Validates: Requirements 11.3, 12.2**

  - [x] 16.7 实现资源池管理前端（管理员）
    - 资源池列表和状态
    - 添加/编辑资源池
    - _Requirements: 11.4_

- [x] 17. 域名与反向代理配置（可选功能）
  - [x] 17.1 实现域名配置 UI
    - 域名输入和验证
    - SSL 配置选项
    - _Requirements: 13.1, 13.2, 13.4_

  - [ ]* 17.2 编写域名验证属性测试
    - **Property 17: 域名格式验证**
    - **Validates: Requirements 13.2**

  - [x] 17.3 实现 Nginx 配置生成器
    - 生成反向代理配置
    - 生成 SSL 配置
    - _Requirements: 13.3, 13.5_

  - [ ]* 17.4 编写 Nginx 配置语法属性测试
    - **Property 18: Nginx 配置语法正确性**
    - **Validates: Requirements 13.3**

- [x] 18. CDN 配置（可选功能）
  - [x] 18.1 实现 CDN 配置 UI
    - CDN 提供商选择
    - 域名和源站配置
    - _Requirements: 14.1, 14.3_

  - [x] 18.2 实现 CDN 配置生成
    - 生成资源 URL 前缀配置
    - 生成 CDN 刷新脚本
    - _Requirements: 14.2, 14.4_

- [x] 19. 资源生命周期管理
  - [x] 19.1 实现资源分配查看
    - 项目资源列表
    - 资源使用状态
    - _Requirements: 15.1_

  - [x] 19.2 实现资源释放功能
    - 释放单个资源
    - 项目删除时的资源处理
    - _Requirements: 15.2, 15.3_

  - [x] 19.3 实现资源审计日志
    - 记录分配/释放历史
    - _Requirements: 15.4_

- [ ] 20. Final Checkpoint - 全部功能完成
  - 确保所有测试通过
  - 进行端到端测试
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 资源池、域名配置、CDN 配置为可选高级功能，可根据优先级延后实现
- 每个 Checkpoint 后应确保功能可用，便于增量交付
- 属性测试使用 fast-check 库，每个测试至少运行 100 次迭代
- **扩展性**：子项目类型、资源类型、功能定义均通过 JSON 配置文件管理，支持动态扩展
- **使用 svton 包**：后端使用 @svton/nestjs-* 系列包，前端使用 @svton/ui、@svton/hooks 等
