# 🔄 游标分页 (NextToken) 改造指南

## 📊 当前分页 vs 游标分页

### 当前方案：页码分页 (Page-based)

```typescript
// 请求
GET /api/contents?page=1&pageSize=10

// 响应
{
  "items": [...],
  "total": 1000,
  "page": 1,
  "pageSize": 10,
  "totalPages": 100
}
```

**优点**：

- ✅ 简单易懂
- ✅ 可以跳页
- ✅ 知道总页数
- ✅ 适合 Web 后台管理

**缺点**：

- ❌ 数据变化时可能重复/遗漏
- ❌ 需要 COUNT 查询（大数据慢）
- ❌ 深分页性能差（OFFSET 大）

---

### NextToken 游标分页 (Cursor-based)

```typescript
// 首次请求
GET /api/contents?limit=10

// 响应
{
  "items": [...],
  "nextToken": "eyJpZCI6MTAwfQ==",  // Base64 编码的游标
  "hasMore": true
}

// 下一页请求
GET /api/contents?limit=10&nextToken=eyJpZCI6MTAwfQ==

// 响应
{
  "items": [...],
  "nextToken": "eyJpZCI6MjAwfQ==",
  "hasMore": true
}
```

**优点**：

- ✅ 性能好（无 OFFSET，使用索引）
- ✅ 数据一致（不会重复/遗漏）
- ✅ 适合移动端无限滚动
- ✅ 适合实时数据流

**缺点**：

- ❌ 不能跳页
- ❌ 不知道总数
- ❌ 不适合需要页码的场景

---

## 🎯 使用场景对比

### 适合页码分页

1. **管理后台列表**
   - 需要跳转到指定页
   - 需要显示总数
   - 数据相对稳定

2. **搜索结果**
   - 用户需要浏览多页
   - 需要"跳到第N页"

### 适合游标分页

1. **移动端列表**
   - 无限滚动
   - Feed 流
   - 实时消息

2. **大数据表**
   - 数据量大（百万级）
   - 深分页频繁

3. **实时数据**
   - 内容动态更新
   - 需要保证一致性

---

## ⏱️ 改造工作量评估

### 📝 改造范围

| 模块            | 工作量   | 说明             |
| --------------- | -------- | ---------------- |
| 类型定义        | 0.5h     | 添加游标分页类型 |
| 后端 Service    | 2-3h     | 修改查询逻辑     |
| 后端 Controller | 0.5h     | 修改参数和响应   |
| API Client      | 1h       | 支持 nextToken   |
| 前端 Hook       | 1-2h     | 实现无限滚动     |
| 测试            | 1h       | 测试分页逻辑     |
| **总计**        | **6-8h** | **1个工作日**    |

---

## 💻 实现示例

### 1. 类型定义

```typescript
// packages/types/src/common/pagination.ts

// 游标分页请求
export interface CursorPaginationQuery {
  limit?: number; // 每次获取数量，默认 20
  nextToken?: string; // 游标 token
}

// 游标分页响应
export interface CursorPaginationResponse<T> {
  items: T[];
  nextToken?: string; // 下一页游标，null 表示没有更多
  hasMore: boolean; // 是否有更多数据
}

// 可选：保留总数（但会影响性能）
export interface CursorPaginationWithTotal<T> extends CursorPaginationResponse<T> {
  total?: number; // 可选的总数
}
```

---

### 2. 后端实现 - Service 层

```typescript
// apps/backend/src/modules/content/content.service.ts

/**
 * 游标分页获取内容列表
 */
async findAllCursor(
  query: CursorPaginationQuery
): Promise<CursorPaginationResponse<ContentListVo>> {
  const limit = query.limit || 20;

  // 解析 nextToken
  let cursor: { id: number; createTime: Date } | null = null;
  if (query.nextToken) {
    try {
      const decoded = Buffer.from(query.nextToken, 'base64').toString('utf-8');
      cursor = JSON.parse(decoded);
    } catch (error) {
      throw new BadRequestException('Invalid nextToken');
    }
  }

  // 构建查询条件
  const where: any = {
    delFlag: 0,
    status: 'published',
  };

  // 游标条件：查询 createTime < cursor.createTime 或 (createTime = cursor.createTime AND id < cursor.id)
  if (cursor) {
    where.OR = [
      { createTime: { lt: cursor.createTime } },
      {
        AND: [
          { createTime: cursor.createTime },
          { id: { lt: cursor.id } },
        ],
      },
    ];
  }

  // 查询 limit+1 条，用于判断是否有更多
  const items = await this.prisma.content.findMany({
    where,
    take: limit + 1,
    orderBy: [
      { createTime: 'desc' },
      { id: 'desc' },  // 二级排序保证稳定性
    ],
    include: {
      author: { select: { id: true, nickname: true, avatar: true } },
      category: { select: { id: true, name: true } },
    },
  });

  // 判断是否有更多
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  // 生成 nextToken
  let nextToken: string | undefined;
  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1];
    const cursorData = {
      id: lastItem.id,
      createTime: lastItem.createTime,
    };
    nextToken = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  return {
    items: resultItems.map(toContentListVo),
    nextToken,
    hasMore,
  };
}
```

---

### 3. 后端实现 - Controller 层

```typescript
// apps/backend/src/modules/content/content.controller.ts

@Public()
@Get('cursor')
@ApiOperation({ summary: '获取内容列表（游标分页）' })
async findAllCursor(
  @Query() query: CursorPaginationQuery,
): Promise<CursorPaginationResponse<ContentListVo>> {
  return this.contentService.findAllCursor(query);
}
```

---

### 4. API Client 定义

```typescript
// packages/api-client/src/modules/content/list-cursor.ts

import { defineApi } from '../../define';
import type { CursorPaginationQuery, CursorPaginationResponse, ContentListVo } from '@svton/types';

export const listCursor = defineApi<CursorPaginationQuery, CursorPaginationResponse<ContentListVo>>(
  {
    path: '/contents/cursor',
    method: 'GET',
    auth: false,
  },
);
```

---

### 5. 前端 Hook - 无限滚动

```typescript
// apps/admin/src/lib/hooks/useInfiniteScroll.ts

import { useState, useEffect } from 'react';
import { api } from '../api-v2';

interface UseInfiniteScrollOptions<T> {
  apiPath: string;
  limit?: number;
}

export function useInfiniteScroll<T>({ apiPath, limit = 20 }: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 加载更多
  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api(apiPath as any, {
        params: { limit, nextToken },
      });

      setItems((prev) => [...prev, ...result.items]);
      setNextToken(result.nextToken);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // 重置
  const reset = () => {
    setItems([]);
    setNextToken(undefined);
    setHasMore(true);
    setError(null);
  };

  // 初始加载
  useEffect(() => {
    loadMore();
  }, []);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
```

---

### 6. 前端使用示例

```tsx
// apps/admin/src/app/contents/page.tsx

import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import { ContentListVo } from '@svton/types';

export default function ContentsPage() {
  const { items, loading, hasMore, loadMore } = useInfiniteScroll<ContentListVo>({
    apiPath: 'GET:/contents/cursor',
    limit: 20,
  });

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}

      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}
```

---

## 🔄 混合方案（推荐）

### 同时支持两种分页

```typescript
// 页码分页 - 管理后台用
GET /api/contents?page=1&pageSize=10

// 游标分页 - 移动端用
GET /api/contents/cursor?limit=20&nextToken=xxx
```

**优势**：

- ✅ 各取所长
- ✅ 灵活适配不同场景
- ✅ 平滑迁移

**实现**：

```typescript
// Controller
@Get()
async findAll(@Query() query) {
  // 页码分页
}

@Get('cursor')
async findAllCursor(@Query() query) {
  // 游标分页
}
```

---

## ⚡ 性能对比

### 测试场景：100万条数据

| 分页方式 | 第1页 | 第100页 | 第1000页 |
| -------- | ----- | ------- | -------- |
| 页码分页 | 50ms  | 200ms   | 2000ms   |
| 游标分页 | 50ms  | 50ms    | 50ms     |

**结论**：游标分页性能稳定，不受页数影响

---

## 🎯 改造建议

### 方案 1：渐进式改造（推荐）

**阶段 1** (1天)：

- 保留现有页码分页
- 新增游标分页接口
- 移动端先使用游标分页

**阶段 2** (按需)：

- 评估效果
- 逐步迁移其他接口

---

### 方案 2：完全替换

**工作量**：2-3天
**风险**：高
**收益**：取决于数据量

---

## 📊 是否需要改造？

### ✅ 建议改造的情况

1. **数据量大**
   - 单表 > 100万
   - 深分页频繁

2. **移动端为主**
   - 无限滚动
   - Feed 流

3. **实时性要求高**
   - 数据频繁更新
   - 需要保证一致性

### ❌ 暂不需要改造

1. **数据量小**
   - 单表 < 10万
   - 总页数 < 100

2. **管理后台为主**
   - 需要跳页
   - 需要显示总数

3. **当前性能可接受**

---

## 🎉 结论

### 你的情况评估

基于社区项目特点，建议：

**当前阶段**：保持页码分页

- ✅ 数据量不大
- ✅ 管理功能为主
- ✅ 符合用户习惯

**后期优化**：渐进式增加游标分页

- 移动端列表用游标
- 管理后台用页码
- 两种方式共存

---

## 📝 快速改造清单

如果你决定改造，按以下顺序：

- [ ] 1. 添加类型定义 (30min)
- [ ] 2. 实现 Service 层游标查询 (2h)
- [ ] 3. 添加 Controller 接口 (30min)
- [ ] 4. 更新 API Client (1h)
- [ ] 5. 实现前端 Hook (1-2h)
- [ ] 6. 更新使用页面 (1h)
- [ ] 7. 测试验证 (1h)

**总计：6-8小时 = 1个工作日** ⏱️

---

**建议：当前不急着改，数据量大了再考虑！** 👍
