# Design Document: Web Project Initializer

## Overview

Web Project Initializer 是一个全栈 Web 应用，采用前后端分离架构。前端使用 Next.js 构建可视化配置界面，后端使用 NestJS 提供 API 服务，负责项目生成、Git 集成和用户管理。

### 技术栈选择

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | Next.js 15 + React 19 | 与 svton 技术栈一致，SSR 支持 |
| UI | TailwindCSS + shadcn/ui | 与 @svton/ui 风格统一 |
| 后端 | NestJS | 与 svton 后端技术栈一致 |
| 数据库 | PostgreSQL | 支持 JSON 字段，适合存储配置 |
| ORM | Prisma | 类型安全，与 svton 模板一致 |
| 认证 | NextAuth.js | 支持多种 OAuth Provider |
| 文件生成 | Archiver + Mustache | ZIP 打包 + 模板渲染 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Next.js Frontend (SSR/CSR)                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │  Auth    │ │ Project  │ │ Feature  │ │ Resource │   │    │
│  │  │  Pages   │ │  Config  │ │ Selector │ │  Manager │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API / tRPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NestJS Backend                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │ Project  │ │ Generator│ │   Git    │           │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ Resource │ │ Registry │ │  Preset  │                        │
│  │  Module  │ │  Module  │ │  Module  │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │PostgreSQL│   │  Redis   │   │ Git APIs │
        │(用户/配置)│   │ (会话)   │   │(GitHub等)│
        └──────────┘   └──────────┘   └──────────┘
```

### 项目生成流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  配置   │───▶│  解析   │───▶│  生成   │───▶│  打包   │───▶│  输出   │
│  收集   │    │  依赖   │    │  文件   │    │  ZIP    │    │ 下载/Git│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
 用户选择      Feature →      模板渲染       Archiver      下载/推送
 子项目/功能   Package 映射   + 代码注入     压缩打包      到 Git
```

## Components and Interfaces

### 1. 前端组件结构

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── projects/
│   │   │   ├── new/page.tsx      # 项目创建向导
│   │   │   └── [id]/page.tsx     # 项目详情
│   │   ├── resources/page.tsx    # 资源管理
│   │   ├── presets/page.tsx      # 配置预设
│   │   └── layout.tsx
│   └── api/
│       └── auth/[...nextauth]/route.ts
├── components/
│   ├── project-wizard/
│   │   ├── StepBasicInfo.tsx     # 基础信息
│   │   ├── StepSubProjects.tsx   # 子项目选择
│   │   ├── StepFeatures.tsx      # 功能选择
│   │   ├── StepResources.tsx     # 资源配置
│   │   ├── StepPreview.tsx       # 预览确认
│   │   └── WizardContainer.tsx   # 向导容器
│   ├── feature-selector/
│   │   ├── FeatureCard.tsx
│   │   ├── FeatureGroup.tsx
│   │   └── PackagePreview.tsx
│   └── resource-manager/
│       ├── ResourceForm.tsx
│       └── CredentialInput.tsx
└── lib/
    ├── api-client.ts
    └── project-config.ts
```

### 2. 后端模块结构

```
apps/api/
├── src/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── strategies/
│   │       ├── jwt.strategy.ts
│   │       ├── github.strategy.ts
│   │       └── gitee.strategy.ts
│   ├── project/
│   │   ├── project.module.ts
│   │   ├── project.controller.ts
│   │   └── project.service.ts
│   ├── generator/
│   │   ├── generator.module.ts
│   │   ├── generator.service.ts
│   │   ├── template-renderer.ts
│   │   ├── code-injector.ts
│   │   └── archive-builder.ts
│   ├── git/
│   │   ├── git.module.ts
│   │   ├── git.service.ts
│   │   └── providers/
│   │       ├── github.provider.ts
│   │       ├── gitlab.provider.ts
│   │       └── gitee.provider.ts
│   ├── resource/
│   │   ├── resource.module.ts
│   │   ├── resource.controller.ts
│   │   └── resource.service.ts
│   ├── registry/
│   │   ├── registry.module.ts
│   │   └── registry.service.ts
│   └── preset/
│       ├── preset.module.ts
│       ├── preset.controller.ts
│       └── preset.service.ts
└── prisma/
    └── schema.prisma
```

### 3. 核心接口定义

```typescript
// 子项目类型
type SubProjectType = 'backend' | 'admin' | 'mobile';

// 业务功能定义
interface BusinessFeature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  targetSubProjects: SubProjectType[];
  packages: string[];           // 对应的 svton 包
  requiredResources: ResourceType[];
  configSchema: JSONSchema;
  codeSnippets: CodeSnippet[];
}

type FeatureCategory = 
  | 'infrastructure'    // 基础设施
  | 'storage'          // 存储
  | 'auth'             // 认证授权
  | 'third-party'      // 第三方服务
  | 'dev-tools';       // 开发工具

// 资源类型
type ResourceType = 
  | 'mysql' 
  | 'redis' 
  | 'qiniu-kodo' 
  | 'aws-s3'
  | 'wechat-pay' 
  | 'alipay'
  | 'sms-aliyun'
  | 'oauth-wechat'
  | 'oauth-github';

// 资源凭证
interface ResourceCredential {
  id: string;
  userId: string;
  type: ResourceType;
  name: string;
  config: EncryptedJSON;  // 加密存储
  createdAt: Date;
  updatedAt: Date;
}

// 项目配置
interface ProjectConfig {
  basicInfo: {
    name: string;
    orgName: string;
    description: string;
    packageManager: 'pnpm' | 'npm' | 'yarn';
  };
  subProjects: {
    backend: boolean;
    admin: boolean;
    mobile: boolean;
  };
  features: string[];           // 选中的 feature IDs
  resources: {
    [resourceType: string]: string;  // resourceType -> credentialId
  };
  uiLibrary: {
    admin: boolean;   // 是否使用 @svton/ui
    mobile: boolean;  // 是否使用 @svton/taro-ui
  };
  hooks: boolean;     // 是否使用 @svton/hooks
  gitConfig?: {
    provider: 'github' | 'gitlab' | 'gitee';
    repoName: string;
    visibility: 'public' | 'private';
    createNew: boolean;
  };
}

// 代码片段（用于注入到生成的项目中）
interface CodeSnippet {
  target: 'app.module.ts' | 'package.json' | '.env' | 'docker-compose.yml';
  type: 'import' | 'module' | 'config' | 'env' | 'service';
  content: string;
  position?: 'before' | 'after' | 'replace';
  anchor?: string;  // 插入位置的锚点
}
```

## Data Models

### Prisma Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  avatar        String?
  
  // OAuth 关联
  accounts      Account[]
  
  // 用户数据
  resources     Resource[]
  presets       Preset[]
  projects      Project[]
  gitConnections GitConnection[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
}

model Resource {
  id        String       @id @default(cuid())
  userId    String
  type      String       // ResourceType
  name      String
  config    String       // 加密的 JSON 配置
  
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  
  @@index([userId, type])
}

model GitConnection {
  id           String   @id @default(cuid())
  userId       String
  provider     String   // github | gitlab | gitee
  accessToken  String   // 加密存储
  refreshToken String?
  username     String
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@unique([userId, provider])
}

model Preset {
  id        String   @id @default(cuid())
  userId    String
  name      String
  config    Json     // ProjectConfig
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
}

model Project {
  id           String   @id @default(cuid())
  userId       String
  name         String
  config       Json     // ProjectConfig snapshot
  gitRepo      String?  // 推送的仓库地址
  downloadUrl  String?  // ZIP 下载链接（临时）
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt    DateTime @default(now())
}
```



### Feature-Package 映射注册表

```json
// registry/features.json
{
  "features": [
    {
      "id": "cache",
      "name": "缓存服务",
      "description": "基于 Redis 的缓存服务，支持装饰器和拦截器",
      "category": "infrastructure",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-cache", "@svton/nestjs-redis"],
      "requiredResources": ["redis"],
      "configSchema": {
        "type": "object",
        "properties": {
          "ttl": { "type": "number", "default": 300 }
        }
      },
      "codeSnippets": [
        {
          "target": "app.module.ts",
          "type": "import",
          "content": "import { CacheModule } from '@svton/nestjs-cache';"
        },
        {
          "target": "app.module.ts",
          "type": "module",
          "content": "CacheModule.forRoot({ ttl: {{ttl}} })"
        }
      ]
    },
    {
      "id": "rate-limit",
      "name": "限流控制",
      "description": "API 请求限流，防止滥用",
      "category": "infrastructure",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-rate-limit", "@svton/nestjs-redis"],
      "requiredResources": ["redis"],
      "codeSnippets": [...]
    },
    {
      "id": "queue",
      "name": "消息队列",
      "description": "基于 BullMQ 的任务队列",
      "category": "infrastructure",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-queue", "@svton/nestjs-redis"],
      "requiredResources": ["redis"],
      "codeSnippets": [...]
    },
    {
      "id": "object-storage",
      "name": "对象存储",
      "description": "文件上传和存储服务",
      "category": "storage",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-object-storage"],
      "requiredResources": [],
      "subFeatures": [
        {
          "id": "object-storage-qiniu",
          "name": "七牛云 Kodo",
          "packages": ["@svton/nestjs-object-storage-qiniu-kodo"],
          "requiredResources": ["qiniu-kodo"]
        }
      ]
    },
    {
      "id": "payment",
      "name": "支付服务",
      "description": "微信支付、支付宝集成",
      "category": "third-party",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-payment"],
      "requiredResources": [],
      "subFeatures": [
        {
          "id": "payment-wechat",
          "name": "微信支付",
          "requiredResources": ["wechat-pay"]
        },
        {
          "id": "payment-alipay",
          "name": "支付宝",
          "requiredResources": ["alipay"]
        }
      ]
    },
    {
      "id": "oauth",
      "name": "OAuth 登录",
      "description": "第三方登录集成",
      "category": "auth",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-oauth"],
      "requiredResources": [],
      "subFeatures": [
        {
          "id": "oauth-wechat",
          "name": "微信登录",
          "requiredResources": ["oauth-wechat"]
        },
        {
          "id": "oauth-github",
          "name": "GitHub 登录",
          "requiredResources": ["oauth-github"]
        }
      ]
    },
    {
      "id": "authz",
      "name": "权限控制",
      "description": "基于 RBAC 的权限管理",
      "category": "auth",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-authz"],
      "requiredResources": []
    },
    {
      "id": "sms",
      "name": "短信服务",
      "description": "短信发送和验证码",
      "category": "third-party",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-sms"],
      "requiredResources": ["sms-aliyun"]
    },
    {
      "id": "logger",
      "name": "日志服务",
      "description": "结构化日志记录",
      "category": "dev-tools",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-logger"],
      "requiredResources": []
    },
    {
      "id": "http-client",
      "name": "HTTP 客户端",
      "description": "封装的 HTTP 请求客户端",
      "category": "dev-tools",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-http"],
      "requiredResources": []
    },
    {
      "id": "config-schema",
      "name": "配置校验",
      "description": "环境变量配置校验",
      "category": "dev-tools",
      "targetSubProjects": ["backend"],
      "packages": ["@svton/nestjs-config-schema"],
      "requiredResources": []
    },
    {
      "id": "ui-web",
      "name": "Web UI 组件库",
      "description": "React UI 组件库",
      "category": "dev-tools",
      "targetSubProjects": ["admin"],
      "packages": ["@svton/ui"],
      "requiredResources": []
    },
    {
      "id": "ui-mobile",
      "name": "小程序 UI 组件库",
      "description": "Taro UI 组件库",
      "category": "dev-tools",
      "targetSubProjects": ["mobile"],
      "packages": ["@svton/taro-ui"],
      "requiredResources": []
    },
    {
      "id": "hooks",
      "name": "React Hooks",
      "description": "通用 React Hooks 工具库",
      "category": "dev-tools",
      "targetSubProjects": ["admin", "mobile"],
      "packages": ["@svton/hooks"],
      "requiredResources": []
    }
  ]
}
```

### 资源配置 Schema

```json
// registry/resources.json
{
  "resources": {
    "redis": {
      "name": "Redis",
      "fields": [
        { "key": "host", "label": "主机地址", "type": "string", "required": true },
        { "key": "port", "label": "端口", "type": "number", "default": 6379 },
        { "key": "password", "label": "密码", "type": "password", "required": false },
        { "key": "db", "label": "数据库", "type": "number", "default": 0 }
      ],
      "envTemplate": "REDIS_HOST={{host}}\nREDIS_PORT={{port}}\nREDIS_PASSWORD={{password}}\nREDIS_DB={{db}}"
    },
    "mysql": {
      "name": "MySQL",
      "fields": [
        { "key": "host", "label": "主机地址", "type": "string", "required": true },
        { "key": "port", "label": "端口", "type": "number", "default": 3306 },
        { "key": "username", "label": "用户名", "type": "string", "required": true },
        { "key": "password", "label": "密码", "type": "password", "required": true },
        { "key": "database", "label": "数据库名", "type": "string", "required": true }
      ],
      "envTemplate": "DATABASE_URL=mysql://{{username}}:{{password}}@{{host}}:{{port}}/{{database}}"
    },
    "qiniu-kodo": {
      "name": "七牛云 Kodo",
      "fields": [
        { "key": "accessKey", "label": "Access Key", "type": "string", "required": true },
        { "key": "secretKey", "label": "Secret Key", "type": "password", "required": true },
        { "key": "bucket", "label": "Bucket", "type": "string", "required": true },
        { "key": "domain", "label": "CDN 域名", "type": "string", "required": true }
      ],
      "envTemplate": "QINIU_ACCESS_KEY={{accessKey}}\nQINIU_SECRET_KEY={{secretKey}}\nQINIU_BUCKET={{bucket}}\nQINIU_DOMAIN={{domain}}"
    },
    "wechat-pay": {
      "name": "微信支付",
      "fields": [
        { "key": "appId", "label": "AppID", "type": "string", "required": true },
        { "key": "mchId", "label": "商户号", "type": "string", "required": true },
        { "key": "apiKey", "label": "API 密钥", "type": "password", "required": true },
        { "key": "certPath", "label": "证书路径", "type": "string", "required": false }
      ],
      "envTemplate": "WECHAT_PAY_APP_ID={{appId}}\nWECHAT_PAY_MCH_ID={{mchId}}\nWECHAT_PAY_API_KEY={{apiKey}}"
    },
    "alipay": {
      "name": "支付宝",
      "fields": [
        { "key": "appId", "label": "AppID", "type": "string", "required": true },
        { "key": "privateKey", "label": "应用私钥", "type": "textarea", "required": true },
        { "key": "alipayPublicKey", "label": "支付宝公钥", "type": "textarea", "required": true }
      ],
      "envTemplate": "ALIPAY_APP_ID={{appId}}\nALIPAY_PRIVATE_KEY={{privateKey}}\nALIPAY_PUBLIC_KEY={{alipayPublicKey}}"
    }
  }
}
```

## Error Handling

### 错误类型定义

```typescript
// 业务错误码
enum ErrorCode {
  // 认证相关 1xxx
  UNAUTHORIZED = 1001,
  INVALID_CREDENTIALS = 1002,
  TOKEN_EXPIRED = 1003,
  OAUTH_FAILED = 1004,
  
  // 项目相关 2xxx
  PROJECT_NAME_INVALID = 2001,
  PROJECT_NAME_EXISTS = 2002,
  INVALID_CONFIG = 2003,
  GENERATION_FAILED = 2004,
  
  // 资源相关 3xxx
  RESOURCE_NOT_FOUND = 3001,
  RESOURCE_VALIDATION_FAILED = 3002,
  CREDENTIAL_DECRYPT_FAILED = 3003,
  
  // Git 相关 4xxx
  GIT_AUTH_FAILED = 4001,
  GIT_REPO_EXISTS = 4002,
  GIT_PUSH_FAILED = 4003,
  GIT_RATE_LIMITED = 4004,
  
  // 系统相关 5xxx
  INTERNAL_ERROR = 5001,
  TEMPLATE_NOT_FOUND = 5002,
  REGISTRY_LOAD_FAILED = 5003,
}

// 统一错误响应
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
}
```

### 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| 项目名验证失败 | 返回具体的验证错误信息，前端实时提示 |
| 资源凭证解密失败 | 提示用户重新配置凭证 |
| Git 推送失败 | 提供详细错误信息，并提供 ZIP 下载作为备选 |
| 模板渲染失败 | 记录日志，返回友好错误信息 |
| OAuth 授权失败 | 引导用户重新授权 |



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 项目名称验证一致性

*For any* string input as project name, the validation function SHALL correctly identify whether it conforms to npm package naming rules (lowercase, no spaces, valid characters).

**Validates: Requirements 2.2**

### Property 2: 子项目选择约束

*For any* project configuration, at least one Sub_Project (backend, admin, or mobile) MUST be selected for the configuration to be valid.

**Validates: Requirements 3.3**

### Property 3: 功能到包的依赖解析完整性

*For any* set of selected Business_Features, the package resolver SHALL return all required packages including transitive dependencies, and the result set SHALL be a superset of each individual feature's required packages.

**Validates: Requirements 4.2**

### Property 4: 功能过滤正确性

*For any* combination of selected Sub_Projects, the available Business_Features SHALL only include features whose `targetSubProjects` intersect with the selected Sub_Projects.

**Validates: Requirements 4.6**

### Property 5: 资源凭证加密往返一致性

*For any* valid Resource_Credential, encrypting and then decrypting SHALL produce the original credential values.

**Validates: Requirements 5.4**

### Property 6: 环境变量生成完整性

*For any* project configuration with selected features and resources, the generated .env file SHALL contain all environment variables required by the selected features, and the values SHALL match the configured Resource_Credentials.

**Validates: Requirements 5.5, 7.3, 7.4**

### Property 7: 生成项目结构完整性

*For any* valid project configuration, the generated project SHALL contain directories for all selected Sub_Projects, and each Sub_Project directory SHALL contain the required base files.

**Validates: Requirements 7.1**

### Property 8: NestJS 模块导入正确性

*For any* set of selected backend Business_Features, the generated `app.module.ts` SHALL contain import statements and module registrations for all packages mapped from those features.

**Validates: Requirements 7.2**

### Property 9: Docker Compose 服务匹配

*For any* set of selected resources (MySQL, Redis, etc.), the generated `docker-compose.yml` SHALL contain service definitions for each required resource type.

**Validates: Requirements 7.7**

### Property 10: 功能注册表完整性

*For any* Business_Feature in the registry, it SHALL have all required fields: id, name, description, category, targetSubProjects, packages, and requiredResources.

**Validates: Requirements 8.1**

### Property 11: 代码片段定义完整性

*For any* Business_Feature that maps to packages, the registry SHALL define code snippets for integrating those packages.

**Validates: Requirements 8.4**

### Property 12: 配置预设往返一致性

*For any* valid ProjectConfig, saving as a preset and then loading SHALL restore the exact same configuration (deep equality).

**Validates: Requirements 10.3**

### Property 13: 配置导出导入往返一致性

*For any* valid ProjectConfig, exporting to JSON and then importing SHALL restore the exact same configuration.

**Validates: Requirements 10.4, 10.5**

### Property 14: 认证访问控制

*For any* request to protected endpoints (project creation, resource management) without valid authentication, the system SHALL return an unauthorized error.

**Validates: Requirements 1.5**

## Testing Strategy

### 测试框架选择

| 类型 | 框架 | 用途 |
|------|------|------|
| 单元测试 | Jest | 函数级测试 |
| 属性测试 | fast-check | 基于属性的测试 |
| E2E 测试 | Playwright | 端到端流程测试 |
| API 测试 | Supertest | REST API 测试 |

### 属性测试配置

```typescript
// jest.config.js
module.exports = {
  testTimeout: 30000,  // 属性测试需要更长时间
};

// 属性测试示例
import * as fc from 'fast-check';

describe('Package Resolver', () => {
  // Property 3: 功能到包的依赖解析完整性
  it('should resolve all transitive dependencies', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ALL_FEATURE_IDS)),
        (selectedFeatures) => {
          const resolvedPackages = resolvePackages(selectedFeatures);
          
          // 每个选中功能的包都应该在结果中
          for (const featureId of selectedFeatures) {
            const feature = getFeature(featureId);
            for (const pkg of feature.packages) {
              expect(resolvedPackages).toContain(pkg);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 单元测试覆盖

| 模块 | 测试重点 |
|------|----------|
| 项目名验证 | npm 命名规则边界情况 |
| 包依赖解析 | 循环依赖、缺失依赖 |
| 模板渲染 | Mustache 变量替换 |
| 凭证加密 | 加解密往返 |
| 配置序列化 | JSON 导入导出 |

### E2E 测试场景

1. 完整项目创建流程（选择功能 → 配置资源 → 生成下载）
2. Git 集成流程（连接 GitHub → 创建仓库 → 推送代码）
3. 预设保存和加载流程
4. 用户认证流程（注册 → 登录 → 访问保护资源）



## 补充设计：资源池与自动开通

### 资源池架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Resource Pool Manager                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Resource Pools                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │  MySQL   │ │  Redis   │ │  Domain  │ │   CDN    │    │   │
│  │  │  Pool    │ │  Pool    │ │  Pool    │ │  Pool    │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Provisioning Engine                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │  MySQL   │ │  Redis   │ │  Nginx   │ │   CDN    │    │   │
│  │  │Provisioner│ │Provisioner│ │Provisioner│ │Provisioner│    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  MySQL   │   │  Redis   │   │  Nginx   │
        │ Instances│   │ Instances│   │ Servers  │
        └──────────┘   └──────────┘   └──────────┘
```

### 补充数据模型

```prisma
// 资源池 - 管理基础设施实例
model ResourcePool {
  id          String   @id @default(cuid())
  type        String   // mysql | redis | nginx | cdn
  name        String
  endpoint    String   // 连接地址
  adminConfig String   // 加密的管理员凭证
  capacity    Int      // 最大容量（如数据库数量）
  allocated   Int      @default(0)  // 已分配数量
  status      String   @default("active")  // active | maintenance | full
  
  allocations ResourceAllocation[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 资源分配记录
model ResourceAllocation {
  id           String   @id @default(cuid())
  poolId       String
  projectId    String
  userId       String
  
  // 分配的具体资源信息
  resourceName String   // 如数据库名、Redis DB 号
  credentials  String   // 加密的凭证
  config       Json     // 其他配置（如域名、CDN 配置）
  
  pool         ResourcePool @relation(fields: [poolId], references: [id])
  project      Project      @relation(fields: [projectId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  
  status       String   @default("active")  // active | released
  createdAt    DateTime @default(now())
  releasedAt   DateTime?
  
  @@index([projectId])
  @@index([userId])
}

// 更新 Project 模型
model Project {
  id           String   @id @default(cuid())
  userId       String
  name         String
  config       Json
  gitRepo      String?
  downloadUrl  String?
  
  // 域名配置
  domains      Json?    // { backend: "api.example.com", admin: "admin.example.com" }
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  allocations  ResourceAllocation[]
  
  createdAt    DateTime @default(now())
}
```

### 资源开通接口

```typescript
// 资源开通服务
interface ProvisioningService {
  // MySQL 开通
  provisionMySQL(poolId: string, projectId: string, dbName: string): Promise<MySQLCredentials>;
  
  // Redis 开通
  provisionRedis(poolId: string, projectId: string, prefix: string): Promise<RedisCredentials>;
  
  // 域名配置
  configureDomain(domain: string, targetService: string, ssl: SSLConfig): Promise<DomainConfig>;
  
  // CDN 配置
  configureCDN(provider: CDNProvider, domain: string, origin: string): Promise<CDNConfig>;
  
  // 释放资源
  releaseResource(allocationId: string): Promise<void>;
}

interface MySQLCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface RedisCredentials {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

interface DomainConfig {
  domain: string;
  targetHost: string;
  targetPort: number;
  ssl: {
    enabled: boolean;
    certPath?: string;
    keyPath?: string;
    autoRenew: boolean;
  };
  nginxConfig: string;  // 生成的 nginx 配置
}

interface CDNConfig {
  provider: string;
  domain: string;
  origin: string;
  cacheRules: CacheRule[];
  purgeEndpoint: string;
}
```

### MySQL 开通流程

```typescript
class MySQLProvisioner {
  async provision(pool: ResourcePool, projectId: string, dbName: string): Promise<MySQLCredentials> {
    const adminConn = await this.getAdminConnection(pool);
    
    // 生成安全的用户名和密码
    const username = `proj_${projectId.slice(0, 8)}`;
    const password = generateSecurePassword();
    
    try {
      // 创建数据库
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      
      // 创建用户
      await adminConn.query(
        `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}'`
      );
      
      // 授权
      await adminConn.query(
        `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${username}'@'%'`
      );
      
      await adminConn.query('FLUSH PRIVILEGES');
      
      // 更新池的已分配计数
      await this.incrementPoolAllocation(pool.id);
      
      return {
        host: pool.endpoint.split(':')[0],
        port: parseInt(pool.endpoint.split(':')[1]) || 3306,
        database: dbName,
        username,
        password,
      };
    } catch (error) {
      // 回滚
      await this.rollback(adminConn, dbName, username);
      throw error;
    }
  }
}
```

### Nginx 配置生成

```typescript
class NginxConfigGenerator {
  generate(config: DomainConfig): string {
    return `
server {
    listen 80;
    server_name ${config.domain};
    
    ${config.ssl.enabled ? `
    listen 443 ssl;
    ssl_certificate ${config.ssl.certPath};
    ssl_certificate_key ${config.ssl.keyPath};
    
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
    ` : ''}
    
    location / {
        proxy_pass http://${config.targetHost}:${config.targetPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
  }
}
```

### 补充正确性属性

### Property 15: 资源开通事务一致性

*For any* resource provisioning operation, if any step fails, all previous steps SHALL be rolled back, leaving no orphaned resources.

**Validates: Requirements 12.5**

### Property 16: 资源分配唯一性

*For any* resource pool, the sum of all active allocations SHALL NOT exceed the pool's capacity.

**Validates: Requirements 11.3, 12.2**

### Property 17: 域名格式验证

*For any* domain input, the validation function SHALL correctly identify valid domain formats (including subdomains) and reject invalid formats.

**Validates: Requirements 13.2**

### Property 18: Nginx 配置语法正确性

*For any* generated Nginx configuration, it SHALL pass nginx -t syntax validation.

**Validates: Requirements 13.3**



## 扩展性设计

### 1. 模板/子项目类型扩展

系统支持动态添加新的子项目类型，无需修改核心代码：

```json
// registry/sub-projects.json
{
  "subProjects": [
    {
      "id": "backend",
      "name": "后端服务",
      "description": "NestJS API 服务",
      "template": "templates/apps/backend",
      "defaultPackages": ["@svton/nestjs-logger", "@svton/nestjs-config-schema"]
    },
    {
      "id": "admin",
      "name": "管理后台",
      "description": "Next.js 管理后台",
      "template": "templates/apps/admin",
      "defaultPackages": ["@svton/ui", "@svton/hooks"]
    },
    {
      "id": "mobile",
      "name": "移动端小程序",
      "description": "Taro 小程序",
      "template": "templates/apps/mobile",
      "defaultPackages": ["@svton/taro-ui", "@svton/hooks"]
    },
    // 未来可添加
    {
      "id": "h5",
      "name": "H5 移动端",
      "description": "React H5 应用",
      "template": "templates/apps/h5",
      "defaultPackages": ["@svton/ui", "@svton/hooks"]
    },
    {
      "id": "electron",
      "name": "桌面应用",
      "description": "Electron 桌面应用",
      "template": "templates/apps/electron",
      "defaultPackages": ["@svton/ui", "@svton/hooks"]
    }
  ]
}
```

### 2. 资源类型动态扩展

资源类型通过配置文件定义，支持随时添加新类型：

```json
// registry/resources.json
{
  "resources": {
    // 现有资源类型
    "mysql": { ... },
    "redis": { ... },
    "qiniu-kodo": { ... },
    
    // 可随时添加新类型
    "mongodb": {
      "name": "MongoDB",
      "category": "database",
      "fields": [
        { "key": "uri", "label": "连接 URI", "type": "string", "required": true },
        { "key": "database", "label": "数据库名", "type": "string", "required": true }
      ],
      "envTemplate": "MONGODB_URI={{uri}}\nMONGODB_DATABASE={{database}}",
      "dockerService": {
        "image": "mongo:7",
        "ports": ["27017:27017"],
        "volumes": ["mongodb_data:/data/db"]
      }
    },
    "elasticsearch": {
      "name": "Elasticsearch",
      "category": "search",
      "fields": [
        { "key": "host", "label": "主机地址", "type": "string", "required": true },
        { "key": "port", "label": "端口", "type": "number", "default": 9200 },
        { "key": "username", "label": "用户名", "type": "string" },
        { "key": "password", "label": "密码", "type": "password" }
      ],
      "envTemplate": "ES_HOST={{host}}\nES_PORT={{port}}\nES_USERNAME={{username}}\nES_PASSWORD={{password}}"
    },
    "minio": {
      "name": "MinIO 对象存储",
      "category": "storage",
      "fields": [
        { "key": "endpoint", "label": "Endpoint", "type": "string", "required": true },
        { "key": "accessKey", "label": "Access Key", "type": "string", "required": true },
        { "key": "secretKey", "label": "Secret Key", "type": "password", "required": true },
        { "key": "bucket", "label": "Bucket", "type": "string", "required": true }
      ],
      "envTemplate": "MINIO_ENDPOINT={{endpoint}}\nMINIO_ACCESS_KEY={{accessKey}}\nMINIO_SECRET_KEY={{secretKey}}\nMINIO_BUCKET={{bucket}}"
    }
  }
}
```

### 3. 功能扩展

新功能可以通过配置文件添加，自动关联到对应的子项目和资源：

```json
// 添加新功能示例
{
  "id": "search",
  "name": "全文搜索",
  "description": "基于 Elasticsearch 的全文搜索",
  "category": "infrastructure",
  "targetSubProjects": ["backend"],
  "packages": ["@svton/nestjs-search"],  // 假设未来会有这个包
  "requiredResources": ["elasticsearch"],
  "codeSnippets": [...]
}
```

## 使用 Svton 包

本项目将使用以下 svton 已发布的包：

### 后端 (apps/initializer-api)

| 包名 | 用途 |
|------|------|
| @svton/nestjs-logger | 结构化日志 |
| @svton/nestjs-config-schema | 配置校验 |
| @svton/nestjs-redis | Redis 连接（会话存储） |
| @svton/nestjs-cache | 缓存（注册表缓存） |
| @svton/nestjs-http | HTTP 客户端（Git API 调用） |

### 前端 (apps/initializer-web)

| 包名 | 用途 |
|------|------|
| @svton/ui | UI 组件库 |
| @svton/hooks | React Hooks 工具 |
| @svton/service | API 请求封装 |
| @svton/logger | 前端日志 |

### 共享

| 包名 | 用途 |
|------|------|
| @svton/types | 类型定义 |
| @svton/api-client | API 客户端生成 |

