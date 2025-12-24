# @{org}/types

> 共享类型定义包 - 前后端统一的 TypeScript 类型（项目私有包）

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@{org}/types` (项目私有包，`{org}` 为项目组织名) |
| **版本** | `1.0.0` |
| **入口** | `dist/index.js` |
| **类型** | `dist/index.d.ts` |

> **注意**: `types` 包是项目私有包，不发布到 npm。使用 CLI 创建项目时，包名会自动替换为项目组织名，如 `@my-project/types`。

---

## 🎯 设计原则

1. **单一数据源** - 所有类型定义集中管理
2. **前后端共享** - 后端 DTO/VO 与前端类型一致
3. **版本一致** - 通过 workspace 协议保证版本同步

---

## 📁 目录结构

```
packages/types/src/
├── api/                    # API 相关类型
│   ├── auth.ts             # 认证相关
│   ├── user.ts             # 用户相关
│   ├── content.ts          # 内容相关
│   ├── category.ts         # 分类相关
│   ├── tag.ts              # 标签相关
│   ├── comment.ts          # 评论相关
│   ├── notification.ts     # 通知相关
│   ├── search.ts           # 搜索相关
│   ├── upload.ts           # 上传相关
│   └── follow.ts           # 关注相关
├── api-registry.ts         # API 注册表类型
├── common.ts               # 通用类型
└── index.ts                # 导出入口
```

---

## 📝 类型定义示例

### 通用类型 (common.ts)

```typescript
// 分页请求参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API 响应包装
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
```

### 用户类型 (api/user.ts)

```typescript
// 用户信息 VO
export interface UserVo {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  phone?: string;
  email?: string;
  bio?: string;
  gender?: string;
  followerCount: number;
  followingCount: number;
  role: string;
  status: string;
  createTime: string;
}

// 用户资料 VO
export interface UserProfileVo extends UserVo {
  isFollowing?: boolean;
  contentCount?: number;
}

// 更新用户资料 DTO
export interface UpdateUserProfileDto {
  nickname?: string;
  avatar?: string;
  bio?: string;
  gender?: string;
  birthday?: string;
  location?: string;
  website?: string;
}
```

### 内容类型 (api/content.ts)

```typescript
// 内容列表项 VO
export interface ContentVo {
  id: number;
  title: string;
  summary?: string;
  coverImage?: string;
  contentType: string;
  categoryId: number;
  categoryName?: string;
  author: {
    id: number;
    nickname: string;
    avatar: string;
  };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  createTime: string;
  tags?: { id: number; name: string }[];
}

// 内容详情 VO
export interface ContentDetailVo extends ContentVo {
  body?: string;
  images?: string[];
  video?: string;
  location?: string;
  activityTime?: string;
  contactInfo?: string;
}

// 创建内容 DTO
export interface CreateContentDto {
  title: string;
  summary?: string;
  body?: string;
  contentType: string;
  categoryId: number;
  coverImage?: string;
  images?: string[];
  video?: string;
  location?: string;
  activityTime?: string;
  contactInfo?: string;
  tagIds?: number[];
}

// 查询内容 DTO
export interface QueryContentDto {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  contentType?: string;
  authorId?: number;
  status?: string;
}
```

---

## 🔧 使用方法

### 安装依赖

```json
// 在其他包的 package.json 中（以 @my-project 为例）
{
  "dependencies": {
    "@my-project/types": "workspace:*"
  }
}
```

### 导入类型

```typescript
// 导入单个类型（以 @my-project 为例）
import type { UserVo, ContentVo } from '@my-project/types';

// 导入多个类型
import type {
  PaginatedResponse,
  ApiResponse,
  ContentDetailVo,
  CreateContentDto,
} from '@my-project/types';
```

### 在后端使用

```typescript
// apps/backend/src/modules/user/user.service.ts
import type { UserVo, UpdateUserProfileDto } from '@my-project/types';

@Injectable()
export class UserService {
  async getProfile(id: number): Promise<UserVo> {
    // ...
  }
  
  async updateProfile(id: number, dto: UpdateUserProfileDto): Promise<UserVo> {
    // ...
  }
}
```

### 在前端使用

```typescript
// apps/admin/src/lib/api.ts
import type { ContentVo, PaginatedResponse } from '@my-project/types';

const { data } = await apiAsync<PaginatedResponse<ContentVo>>(
  'GET:/contents',
  { page: 1 }
);
```

---

## 📦 构建配置

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 构建命令

```bash
# 构建
pnpm --filter @my-project/types build

# 监听模式
pnpm --filter @my-project/types dev
```

---

## ➕ 添加新类型

### 1. 在对应文件中定义

```typescript
// packages/types/src/api/example.ts
export interface ExampleVo {
  id: number;
  title: string;
  // ...
}

export interface CreateExampleDto {
  title: string;
  // ...
}
```

### 2. 在 index.ts 中导出

```typescript
// packages/types/src/index.ts
export * from './api/example';
```

### 3. 重新构建

```bash
pnpm --filter @my-project/types build
```

---

## ✅ 最佳实践

1. **命名规范**
   - VO (View Object): 返回给前端的数据结构
   - DTO (Data Transfer Object): 前端传给后端的数据结构
   - 后缀明确：`UserVo`, `CreateUserDto`, `QueryUserDto`

2. **字段可选性**
   - 创建时必填字段不加 `?`
   - 更新时所有字段可选
   - 查询时分页参数可选

3. **类型复用**
   - 使用 `extends` 扩展基础类型
   - 使用 `Partial<T>` 创建更新类型
   - 使用 `Pick<T, K>` 选择部分字段

---

**相关文档**: [@svton/api-client](./api-client.md)
