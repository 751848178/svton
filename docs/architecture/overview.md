# 整体架构

> 系统架构设计和技术选型详解

---

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                    │
│  ┌───────────────────────┐         ┌───────────────────────┐            │
│  │      移动端小程序       │         │       管理后台         │            │
│  │  ┌─────────────────┐  │         │  ┌─────────────────┐  │            │
│  │  │  Taro 3.6       │  │         │  │  Next.js 15     │  │            │
│  │  │  + React 18     │  │         │  │  + React 19     │  │            │
│  │  │  + Zustand      │  │         │  │  + TailwindCSS  │  │            │
│  │  └─────────────────┘  │         │  └─────────────────┘  │            │
│  └───────────┬───────────┘         └───────────┬───────────┘            │
└──────────────┼─────────────────────────────────┼────────────────────────┘
               │                                 │
               │          RESTful API            │
               └─────────────────┬───────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              服务端层                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    NestJS Backend API                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │                     Guards / Interceptors                │    │   │
│  │  │  (JWT Auth, Logger, Transform, Error Handler)            │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐     │   │
│  │  │ Auth │ User │Cont- │ Cate-│ Tag  │Upload│Search│Notif-│     │   │
│  │  │Module│Module│ent   │ gory │Module│Module│Module│icati-│...  │   │
│  │  │      │      │Module│Module│      │      │      │on    │     │   │
│  │  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘     │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │                    Prisma Service                        │    │   │
│  │  │  (Database Access Layer)                                 │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────┐
│                              数据层                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   MySQL 8   │    │   Redis 7   │    │ 腾讯云 COS   │                 │
│  │  (Prisma)   │    │  (ioredis)  │    │ (文件存储)   │                 │
│  │             │    │             │    │             │                 │
│  │ - 用户数据   │    │ - 会话缓存   │    │ - 图片存储   │                 │
│  │ - 内容数据   │    │ - 验证码     │    │ - 视频存储   │                 │
│  │ - 关系数据   │    │ - 热点数据   │    │ - 文件存储   │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Monorepo 架构

采用 **pnpm workspace + Turborepo** 的 Monorepo 架构：

```
community-next/
├── apps/                    # 应用程序
│   ├── backend/             # NestJS 后端
│   ├── admin/               # Next.js 管理后台
│   └── mobile/              # Taro 小程序
│
├── packages/                # 共享包
│   ├── types/               # @svton/types
│   ├── api-client/          # @svton/api-client
│   ├── hooks/               # @svton/hooks
│   └── taro-ui/             # @svton/taro-ui
│
└── 配置文件...
```

### 依赖关系图

```
                    @svton/types
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       @svton/api-client      @svton/hooks
              │                     │
              └──────────┬──────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          backend      admin     mobile
                                    │
                                    ▼
                            @svton/taro-ui
```

---

## 🔧 技术选型理由

### 后端: NestJS + Prisma

| 特性 | 说明 |
|------|------|
| **模块化架构** | 类似 Spring Boot，依赖注入，易于维护 |
| **TypeScript 原生** | 完美类型安全，与前端共享类型 |
| **Prisma ORM** | 类型安全的数据库访问，自动生成 Client |
| **装饰器语法** | 声明式编程，代码简洁 |
| **生态丰富** | JWT、Swagger、WebSocket 等开箱即用 |

### 管理后台: Next.js + TailwindCSS

| 特性 | 说明 |
|------|------|
| **App Router** | 文件系统路由，约定优于配置 |
| **Server Components** | 服务端渲染，首屏性能好 |
| **TailwindCSS** | 原子化 CSS，开发效率高 |
| **Radix UI** | 无障碍组件库，自定义性强 |
| **SWR** | 数据请求和缓存，用户体验好 |

### 移动端: Taro + React

| 特性 | 说明 |
|------|------|
| **跨端能力** | 一套代码，多端运行 (微信/H5/...) |
| **React 生态** | 与管理后台技术栈统一 |
| **Zustand** | 轻量状态管理，简单易用 |
| **SCSS** | 样式预处理，变量/函数支持 |

---

## 🎨 设计原则

### 1. 单一数据源

所有类型定义统一在 `@svton/types` 包中维护：

```typescript
// packages/types/src/api/content.ts
export interface ContentVo {
  id: number;
  title: string;
  // ...
}

// 前后端共享同一类型
import type { ContentVo } from '@svton/types';
```

### 2. API 契约优先

API 类型通过 `@svton/api-client` 的模块增强入口集中管理：

```typescript
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'GET:/contents/:id': ApiDefinition<{ id: number }, ContentDetailVo>;
  }
}
```

### 3. 代码复用

共享逻辑抽取到 packages：

```typescript
// 所有应用共享 hooks
import { usePersistFn, useDebounce } from '@svton/hooks';

// 移动端共享 UI 组件
import { NavBar, Button } from '@svton/taro-ui';
```

### 4. 关注点分离

```
Controller  → 处理 HTTP 请求/响应
Service     → 业务逻辑
Repository  → 数据访问 (Prisma)
DTO         → 数据传输对象
VO          → 视图对象
```

---

## 🔄 请求流程

```
┌────────────┐
│   Client   │
└─────┬──────┘
      │ 1. HTTP Request
      ▼
┌────────────┐
│   Guard    │ ← 2. JWT 认证
└─────┬──────┘
      ▼
┌────────────┐
│Interceptor │ ← 3. 日志/Transform
└─────┬──────┘
      ▼
┌────────────┐
│ Controller │ ← 4. 参数验证 (DTO)
└─────┬──────┘
      ▼
┌────────────┐
│  Service   │ ← 5. 业务逻辑
└─────┬──────┘
      ▼
┌────────────┐
│  Prisma    │ ← 6. 数据库操作
└─────┬──────┘
      │ 7. Response
      ▼
┌────────────┐
│   Client   │
└────────────┘
```

---

## 📊 数据模型概览

### 核心实体

```
User (用户)
├── Content (内容)
│   ├── Comment (评论)
│   ├── Tag (标签) - 多对多
│   └── Category (分类)
├── UserLike (点赞)
├── UserFavorite (收藏)
├── UserFollow (关注)
└── Notification (通知)

支撑实体:
├── Config (配置)
├── Dictionary (字典)
└── AuditLog (审计日志)
```

### 多租户设计

所有业务表都包含 `tenantId` 字段，支持数据隔离：

```prisma
model Content {
  id       Int    @id @default(autoincrement())
  tenantId String @map("tenant_id")
  // ...
  @@index([tenantId, status])
}
```

---

## 🔐 安全设计

### 认证流程

```
1. 用户登录 → 验证凭证 → 生成 JWT
2. 请求携带 Token → JwtAuthGuard 验证
3. 验证通过 → 注入用户信息到 Request
4. Controller/Service 获取当前用户
```

### 权限控制

```typescript
// 角色定义
enum Role {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

// 装饰器使用
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {}
```

---

## 📈 扩展性设计

### 水平扩展

- 无状态设计，支持多实例部署
- Redis 存储 Session 和缓存
- 支持负载均衡

### 模块扩展

```bash
# 添加新模块
nest g module modules/new-module
nest g controller modules/new-module
nest g service modules/new-module
```

### 存储扩展

支持多种存储后端：

```env
# 本地存储
STORAGE_TYPE=local

# 腾讯云 COS
STORAGE_TYPE=cos

# 阿里云 OSS (预留)
STORAGE_TYPE=oss
```

---

**下一步**: [Monorepo 结构](./monorepo.md)
