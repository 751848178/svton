# 🔐 服务端渲染 + 认证解决方案

## 问题分析

### 当前架构限制

```
客户端 (Browser)
  ├── localStorage 存储 token  ❌
  └── 客户端组件 fetch 数据

服务端 (Node.js)
  ├── 无法访问 localStorage  ❌
  └── 无法发起认证请求
```

**结果**：无法在服务端预获取需要认证的数据

---

## 解决方案1：Cookie 存储（推荐）⭐⭐⭐⭐⭐

### 核心思路

将 token 存储在 **HTTP-only Cookie** 中，服务端和客户端都能访问

```
客户端 (Browser)
  ├── Cookie 存储 token  ✅
  └── 自动发送到服务端

服务端 (Node.js)
  ├── 从 Cookie 读取 token  ✅
  ├── 预获取数据  ✅
  └── 渲染 HTML  ✅
```

### 实施步骤

#### 1. 修改后端登录接口，返回 Cookie

```typescript
// apps/backend/src/modules/auth/auth.controller.ts

import { Response } from 'express';

@Post('login')
async login(
  @Body() dto: LoginDto,
  @Res({ passthrough: true }) res: Response,  // ✅ 注入 Response
): Promise<LoginVo> {
  const result = await this.authService.login(dto);

  // ✅ 设置 HTTP-only Cookie
  res.cookie('token', result.accessToken, {
    httpOnly: true,      // 防止 XSS 攻击
    secure: process.env.NODE_ENV === 'production',  // HTTPS only
    sameSite: 'lax',     // CSRF 保护
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7天
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30天
  });

  return result;
}
```

#### 2. 创建服务端 API 客户端

```typescript
// apps/admin/src/lib/api-server.ts

import { cookies } from 'next/headers';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

/**
 * 服务端 API 客户端
 * 从 Cookie 读取 token
 */
function createServerApiClient() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  return axios.create({
    baseURL: API_BASE_URL,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });
}

// ✅ 服务端分类 API
export const serverCategoryApi = {
  async getTree() {
    const client = createServerApiClient();
    const { data } = await client.get('/categories/tree');
    return data;
  },

  async getList(params?: any) {
    const client = createServerApiClient();
    const { data } = await client.get('/categories', { params });
    return data;
  },
};

// ✅ 服务端内容 API
export const serverContentApi = {
  async getList(params?: any) {
    const client = createServerApiClient();
    const { data } = await client.get('/contents', { params });
    return data;
  },
};

// ✅ 服务端标签 API
export const serverTagApi = {
  async getList(params?: any) {
    const client = createServerApiClient();
    const { data } = await client.get('/tags', { params });
    return data;
  },
};

// ✅ 服务端用户 API
export const serverUserApi = {
  async getList(params?: any) {
    const client = createServerApiClient();
    const { data } = await client.get('/users', { params });
    return data;
  },
};
```

#### 3. 在服务端组件中使用

```tsx
// apps/admin/src/app/dashboard/categories/page.tsx

import { serverCategoryApi } from '@/lib/api-server';
import CategoriesContainer from './categories-container';

/**
 * ✅ 服务端组件 - 预获取数据
 */
export default async function CategoriesPage() {
  // ✅ 在服务端直接获取数据
  const initialCategories = await serverCategoryApi.getTree();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">分类管理</h1>
        <p className="text-muted-foreground">管理内容分类</p>
      </div>

      {/* ✅ 传递初屏数据给客户端组件 */}
      <CategoriesContainer initialData={initialCategories} />
    </div>
  );
}
```

#### 4. 客户端组件接收初始数据

```tsx
// apps/admin/src/app/dashboard/categories/categories-container.tsx

'use client';

import { useState, useEffect } from 'react';
import { CategoryVo } from '@svton/types';

interface Props {
  initialData: CategoryVo[]; // ✅ 接收服务端数据
}

export default function CategoriesContainer({ initialData }: Props) {
  // ✅ 使用服务端数据初始化
  const [categories, setCategories] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // 后续操作仍然使用客户端 API
  async function loadCategories() {
    setLoading(true);
    try {
      const data = await categoryApi.getTree();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }

  // ✅ 首屏不需要loading，数据已经有了
  return (
    <>
      <CategoryTable categories={categories} />
      {/* ... */}
    </>
  );
}
```

#### 5. 修改前端登录逻辑

```tsx
// apps/admin/src/app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  async function handleLogin(username: string, password: string) {
    try {
      const result = await authApi.login({ username, password });

      // ✅ Token 已自动存储在 Cookie（服务端设置）
      // 不再需要 localStorage.setItem('token', ...)

      // ✅ 直接跳转
      router.push('/dashboard');
      router.refresh(); // 刷新服务端组件
    } catch (error) {
      console.error('登录失败', error);
    }
  }

  return <LoginForm onSubmit={handleLogin} />;
}
```

---

## 收益对比

### 修改前：客户端渲染

```
1. 浏览器访问 /dashboard/categories
2. 返回空白 HTML + JS bundle
3. JS 执行
4. 客户端发起 API 请求
5. 等待响应
6. 渲染数据

总时间：2-3秒
首屏：空白或 Loading
SEO：不友好
```

### 修改后：服务端渲染

```
1. 浏览器访问 /dashboard/categories
2. 服务端获取数据（并行）
3. 服务端渲染 HTML（包含数据）
4. 返回完整 HTML
5. 浏览器直接显示
6. JS 加载后增强交互

总时间：0.5-1秒
首屏：直接显示数据
SEO：友好
```

### 性能提升

| 指标           | 修改前  | 修改后 | 提升      |
| -------------- | ------- | ------ | --------- |
| **首屏时间**   | 2-3s    | 0.5-1s | ⬆️ 60-75% |
| **白屏时间**   | 1-2s    | 0s     | ⬆️ 100%   |
| **SEO 友好度** | 差      | 优     | ⬆️ 显著   |
| **用户体验**   | Loading | 即时   | ⬆️ 优秀   |

---

## 安全性对比

### localStorage 存储（当前）

```typescript
// ❌ 容易受到 XSS 攻击
localStorage.setItem('token', token);

// 恶意脚本可以读取
const token = localStorage.getItem('token');
```

**风险**：

- ❌ XSS 攻击可以读取 token
- ❌ 任何 JS 代码都能访问
- ❌ 第三方脚本可能窃取

### HTTP-only Cookie（推荐）

```typescript
// ✅ 无法被 JS 访问
res.cookie('token', token, {
  httpOnly: true, // JS 无法读取
  secure: true, // 仅 HTTPS
  sameSite: 'lax', // 防止 CSRF
});
```

**优势**：

- ✅ XSS 攻击无法读取
- ✅ JS 代码无法访问
- ✅ 自动发送，无需手动处理
- ✅ 服务端可以访问

---

## 实施优先级

### Phase 1: 后端改造（1-2小时）

- [ ] 修改登录接口，设置 Cookie
- [ ] 修改登出接口，清除 Cookie
- [ ] 修改刷新 Token 接口
- [ ] 测试 Cookie 设置

### Phase 2: 前端服务端 API（1小时）

- [ ] 创建 `api-server.ts`
- [ ] 实现服务端 API 客户端
- [ ] 从 Cookie 读取 token

### Phase 3: 页面重构（2-3小时）

- [ ] 重构分类管理页面
- [ ] 重构标签管理页面
- [ ] 重构内容管理页面
- [ ] 重构用户管理页面

### Phase 4: 前端登录改造（1小时）

- [ ] 移除 localStorage 相关代码
- [ ] 改用 Cookie
- [ ] 测试登录流程

---

## 迁移检查清单

### 后端

- [ ] 登录接口设置 Cookie
- [ ] 登出接口清除 Cookie
- [ ] 刷新 Token 更新 Cookie
- [ ] CORS 配置允许 credentials
  ```typescript
  app.enableCors({
    origin: 'http://localhost:3001',
    credentials: true, // ✅ 允许发送 Cookie
  });
  ```

### 前端

- [ ] API 客户端配置 credentials
  ```typescript
  axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // ✅ 发送 Cookie
  });
  ```
- [ ] 创建服务端 API 客户端
- [ ] 页面组件改为 async
- [ ] 传递初始数据给容器组件
- [ ] 移除 localStorage 相关代码

---

## 替代方案

### 方案2：保持当前架构，部分优化

如果不想大改，可以：

1. **关键页面使用服务端渲染**
   - Dashboard（概览页）
   - 列表页面

2. **复杂交互保持客户端渲染**
   - 创建/编辑页面
   - 需要频繁交互的页面

3. **混合策略**

   ```tsx
   // 列表页：服务端渲染
   export default async function ListPage() {
     const data = await fetchPublicData(); // 不需要认证的数据
     return <List initialData={data} />;
   }

   // 详情页：客户端渲染
   export default function DetailPage() {
     return <DetailContainer />; // 需要认证，客户端获取
   }
   ```

---

## 总结

您的建议非常正确！完整的服务端渲染方案应该是：

```
✅ 最佳实践
├── Cookie 存储 token（安全）
├── 服务端预获取数据（快速）
├── 传递给客户端组件（交互）
└── 客户端后续操作（灵活）

收益：
✅ 首屏性能 ⬆️ 60-75%
✅ 安全性 ⬆️ 显著
✅ SEO ⬆️ 优秀
✅ 用户体验 ⬆️ 优秀
```

**下一步建议**：

1. 优先实施 Cookie 方案（安全性和性能双提升）
2. 逐步重构关键页面
3. 保持客户端交互的灵活性

**需要我帮您实施这个方案吗？** 🚀
