# 📦 统一响应结构设计指南

## 🎯 核心原则

**data 字段的包装规则**：

- 简单数据 → 直接放 data
- 需要元信息 → data 内包一层

---

## 📊 不同场景的响应结构

### 1. 列表数据（带分页）✅ 需要包装

**场景**：获取内容列表、用户列表等

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      { "id": 1, "title": "标题1" },
      { "id": 2, "title": "标题2" }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  },
  "timestamp": 1700000000000
}
```

**原因**：需要附加分页元信息（total、page等）

**后端实现**：

```typescript
// ✅ 正确 - 已经在用
return {
  items: result,
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
};
```

---

### 2. 简单列表（无分页）❌ 不需要包装

**场景**：获取分类树、热门标签等

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "id": 1, "name": "社区活动" },
    { "id": 2, "name": "志愿服务" }
  ],
  "timestamp": 1700000000000
}
```

**原因**：数据简单，不需要额外信息

**后端实现**：

```typescript
// ✅ 正确 - 直接返回数组
return categories; // 拦截器会包装为统一格式
```

---

### 3. 详情数据 ❌ 不需要包装

**场景**：获取内容详情、用户详情等

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "title": "标题",
    "content": "内容",
    "author": {
      "id": 1,
      "name": "作者"
    }
  },
  "timestamp": 1700000000000
}
```

**原因**：单个对象，结构完整

**后端实现**：

```typescript
// ✅ 正确 - 直接返回对象
return contentDetail;
```

---

### 4. 操作结果 ❌ 不需要包装

**场景**：创建、更新、删除操作

#### 方案 A：返回操作后的数据（推荐）

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "title": "新创建的内容",
    "status": "draft"
  },
  "timestamp": 1700000000000
}
```

#### 方案 B：返回简单确认

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null,
  "timestamp": 1700000000000
}
```

**后端实现**：

```typescript
// ✅ 方案 A - 返回创建的数据
async create(dto: CreateDto) {
  const created = await this.service.create(dto);
  return created;  // 返回完整对象
}

// ✅ 方案 B - 只返回确认
async remove(id: number) {
  await this.service.remove(id);
  return { message: '删除成功' };  // 或者不返回（void）
}
```

---

### 5. 认证登录 ❌ 不需要包装

**场景**：登录、注册

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": 1,
      "username": "admin",
      "nickname": "管理员"
    }
  },
  "timestamp": 1700000000000
}
```

**原因**：Token 和用户信息是平级关系

---

### 6. 统计数据 ⚠️ 视情况而定

#### 简单统计 - 不包装

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalUsers": 1000,
    "activeUsers": 500,
    "todayNew": 10
  }
}
```

#### 复杂统计 - 建议包装

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "summary": {
      "total": 1000,
      "active": 500
    },
    "trend": [
      { "date": "2024-01-01", "count": 10 },
      { "date": "2024-01-02", "count": 15 }
    ]
  }
}
```

---

## 🎯 决策树

```
是否需要在 data 内包装？
│
├─ 需要分页信息？
│  └─ ✅ 是 → 包装为 { items, total, page, ... }
│
├─ 需要多个并列数据集？
│  └─ ✅ 是 → 包装为 { dataSet1, dataSet2, ... }
│
├─ 需要附加元信息？
│  └─ ✅ 是 → 包装为 { data, meta, ... }
│
└─ 否 → ❌ 不包装，直接返回数据
```

---

## 📝 实际代码示例

### ✅ 正确示例 1：分页列表

```typescript
// content.service.ts
async findAll(query: ContentQueryDto) {
  const [items, total] = await Promise.all([
    this.prisma.content.findMany({ ... }),
    this.prisma.content.count({ ... }),
  ]);

  return {
    items: items.map(toContentListVo),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
```

**响应**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100
  }
}
```

---

### ✅ 正确示例 2：简单列表

```typescript
// category.service.ts
async findAll() {
  const categories = await this.prisma.category.findMany({ ... });
  return this.buildTree(categories);  // 直接返回数组
}
```

**响应**：

```json
{
  "code": 200,
  "message": "success",
  "data": [...]  // 直接是数组
}
```

---

### ✅ 正确示例 3：详情

```typescript
// content.service.ts
async findOne(id: number) {
  const content = await this.prisma.content.findUnique({ ... });
  return toContentDetailVo(content);  // 直接返回对象
}
```

**响应**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "title": "..."
  }
}
```

---

### ❌ 错误示例：过度包装

```typescript
// ❌ 不要这样做
async findAll() {
  const categories = await this.prisma.category.findMany();
  return {
    list: categories,  // 不需要这层
  };
}
```

**会导致**：

```json
{
  "code": 200,
  "data": {
    "list": [...]  // 多余的一层
  }
}
```

---

## 🌐 对比其他框架

### Spring Boot (推荐学习)

```json
// 简单数据
{ "code": 200, "data": {...} }

// 分页数据
{
  "code": 200,
  "data": {
    "content": [...],
    "totalElements": 100,
    "totalPages": 10
  }
}
```

### Laravel

```json
// 简单数据
{ "data": {...} }

// 分页数据
{
  "data": [...],
  "links": {...},
  "meta": {
    "total": 100,
    "per_page": 10
  }
}
```

### Ant Design Pro

```json
// 列表数据
{
  "success": true,
  "data": {
    "list": [...],
    "total": 100
  }
}
```

---

## 💡 最佳实践建议

### ✅ DO（推荐做法）

1. **分页列表** - 包装

   ```typescript
   return { items, total, page, pageSize };
   ```

2. **简单数据** - 不包装

   ```typescript
   return data; // 直接返回
   ```

3. **保持一致** - 同类接口使用相同结构

   ```typescript
   // 所有分页列表都用 items + total
   // 所有详情都直接返回对象
   ```

4. **语义化字段名**
   ```typescript
   items; // 不是 list、data、records
   total; // 不是 count、totalCount
   ```

---

### ❌ DON'T（避免做法）

1. **不要过度嵌套**

   ```typescript
   // ❌ 错误
   return {
     result: {
       data: {
         list: items,
       },
     },
   };
   ```

2. **不要字段名不统一**

   ```typescript
   // ❌ 错误
   // 接口A返回 items，接口B返回 list
   ```

3. **不要混合使用**
   ```typescript
   // ❌ 错误
   // 有时包装，有时不包装
   ```

---

## 🎯 你的项目当前状态

### ✅ 已经做得很好

1. **分页列表**：正确包装

   ```typescript
   return { items, total, page, pageSize };
   ```

2. **简单列表**：直接返回

   ```typescript
   return categories; // 分类树
   return tags; // 标签列表
   ```

3. **详情数据**：直接返回
   ```typescript
   return contentDetail;
   ```

### 📝 建议

**保持当前设计即可！**

你的实现已经很合理：

- 需要元信息时包装（如分页）
- 简单数据直接返回
- 符合社区最佳实践

---

## 🔄 前端适配示例

### 处理分页列表

```typescript
// API 调用
const response = await api('GET:/contents', { params: { page: 1 } });

// 响应结构
const { items, total, page } = response.data;

// 使用数据
items.forEach((item) => console.log(item.title));
```

### 处理简单列表

```typescript
// API 调用
const response = await api('GET:/categories');

// 响应结构
const categories = response.data; // 直接是数组

// 使用数据
categories.forEach((cat) => console.log(cat.name));
```

---

## 📊 总结

| 场景      | 是否包装  | 结构                     |
| --------- | --------- | ------------------------ |
| 分页列表  | ✅ 是     | `{ items, total, page }` |
| 简单列表  | ❌ 否     | `[...]`                  |
| 详情      | ❌ 否     | `{ id, title, ... }`     |
| 创建/更新 | ❌ 否     | `{ id, ... }`            |
| 删除      | ❌ 否     | `null` 或 `{ message }`  |
| 登录      | ❌ 否     | `{ token, user }`        |
| 统计      | ⚠️ 视情况 | 简单不包装，复杂可包装   |

---

## ✨ 结论

**你的当前实现已经很好了！**

- ✅ 分页列表包装了 `{ items, total }`
- ✅ 简单数据直接返回
- ✅ 符合社区标准

**不需要改动，保持现状即可！** 🎉

只有在以下情况才需要额外包装：

1. 分页信息（已实现）
2. 需要多个数据集
3. 需要附加元信息

---

**当前的设计是最佳实践！** 👍
