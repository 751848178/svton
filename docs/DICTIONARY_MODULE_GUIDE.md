# 字典管理模块使用指南

## 📋 模块说明

字典管理模块是一个独立的系统模块，用于管理系统中的字典数据和枚举值。与配置系统独立，专门用于管理可选项、分类等字典数据。

---

## ✅ 已完成功能

### 1. 后端服务

#### DictionaryService
**文件**: `apps/backend/src/modules/dictionary/dictionary.service.ts`

**核心方法**:
- `findAll()` - 获取所有字典
- `findByCode(code)` - 根据编码获取字典
- `getTree(code)` - 获取字典树（支持父子关系）
- `create(data)` - 创建字典项
- `update(id, data)` - 更新字典项
- `delete(id)` - 删除字典项（软删除）
- `findOne(id)` - 获取字典详情

#### DictionaryController
**文件**: `apps/backend/src/modules/dictionary/dictionary.controller.ts`

**API 端点**:
- `GET /dictionary` - 获取所有字典
- `GET /dictionary/code/:code` - 根据编码获取
- `GET /dictionary/tree/:code` - 获取字典树
- `GET /dictionary/:id` - 获取详情
- `POST /dictionary` - 创建（需要管理员）
- `PUT /dictionary/:id` - 更新（需要管理员）
- `DELETE /dictionary/:id` - 删除（需要管理员）

#### DictionaryModule
**文件**: `apps/backend/src/modules/dictionary/dictionary.module.ts`

已注册到 `AppModule`。

---

### 2. API 客户端

**文件**: `packages/api-client/src/modules/dictionary.ts`

**接口定义**:
```typescript
interface DictionaryItemVo {
  id: number;
  code: string;           // 字典编码，如 'storage_type'
  parentId?: number;      // 父级ID（支持树形）
  label: string;          // 显示名称
  value: string;          // 字典值
  type: string;           // 类型: enum, tree, list
  sort: number;           // 排序
  isEnabled: boolean;     // 是否启用
  description?: string;   // 说明
  extra?: string;         // 扩展字段（JSON）
  children?: DictionaryItemVo[];  // 子项（树形）
}
```

**API 调用**:
```typescript
// 获取所有字典
const all = await apiAsync('GET:/dictionary', undefined);

// 根据编码获取
const items = await apiAsync('GET:/dictionary/code/:code', {
  code: 'storage_type',
});

// 获取字典树
const tree = await apiAsync('GET:/dictionary/tree/:code', {
  code: 'category',
});

// 创建字典
await apiAsync('POST:/dictionary', {
  code: 'storage_type',
  label: '本地存储',
  value: 'local',
  type: 'enum',
  sort: 1,
});

// 更新字典
await apiAsync('PUT:/dictionary/:id', {
  id: 1,
  label: '本地存储（更新）',
});

// 删除字典
await apiAsync('DELETE:/dictionary/:id', { id: 1 });
```

---

### 3. 管理界面

**文件**: `apps/admin/src/app/(admin)/dictionary/page.tsx`

**访问地址**: `http://localhost:3001/dictionary`

**功能特性**:
- ✅ 字典列表展示（按编码分组）
- ✅ 新增字典项
- ✅ 编辑字典项
- ✅ 删除字典项（带确认）
- ✅ 刷新功能
- ✅ 按编码分组显示
- ✅ 排序显示
- ✅ 状态标识（启用/禁用）

**界面布局**:
```
┌─────────────────────────────────────────────────────┐
│ 📖 字典管理                    [刷新] [新增字典]    │
│ 管理系统字典数据和枚举值                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─ storage_type ──────────────────────────────┐   │
│ │ 存储类型字典                                  │   │
│ │ ┌───────────────────────────────────────┐  │   │
│ │ │ 标签     │ 值    │ 类型 │ 排序 │ 操作 │  │   │
│ │ ├───────────────────────────────────────┤  │   │
│ │ │ 本地存储  │ local │ enum │ 1   │ ✏️ 🗑️ │  │   │
│ │ │ 腾讯云COS │ cos   │ enum │ 2   │ ✏️ 🗑️ │  │   │
│ │ │ 阿里云OSS │ oss   │ enum │ 3   │ ✏️ 🗑️ │  │   │
│ │ └───────────────────────────────────────┘  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 使用场景

### 1. 存储类型字典

```typescript
// 种子数据已包含
const storageTypes = [
  { code: 'storage_type', label: '本地存储', value: 'local' },
  { code: 'storage_type', label: '腾讯云COS', value: 'cos' },
  { code: 'storage_type', label: '阿里云OSS', value: 'oss' },
];
```

**使用方式**:
```typescript
// 前端获取存储类型选项
const types = await apiAsync('GET:/dictionary/code/:code', {
  code: 'storage_type',
});

// 渲染下拉框
<Select>
  {types.map(item => (
    <SelectItem key={item.value} value={item.value}>
      {item.label}
    </SelectItem>
  ))}
</Select>
```

### 2. 内容分类（树形）

```typescript
// 创建父级分类
await apiAsync('POST:/dictionary', {
  code: 'content_category',
  label: '技术',
  value: 'tech',
  type: 'tree',
  sort: 1,
});

// 创建子级分类
await apiAsync('POST:/dictionary', {
  code: 'content_category',
  parentId: 1,  // 父级ID
  label: '前端开发',
  value: 'frontend',
  type: 'tree',
  sort: 1,
});

// 获取分类树
const tree = await apiAsync('GET:/dictionary/tree/:code', {
  code: 'content_category',
});
```

### 3. 状态枚举

```typescript
// 订单状态
const orderStatuses = [
  { code: 'order_status', label: '待支付', value: 'pending' },
  { code: 'order_status', label: '已支付', value: 'paid' },
  { code: 'order_status', label: '已完成', value: 'completed' },
  { code: 'order_status', label: '已取消', value: 'cancelled' },
];
```

---

## 🔄 字典 vs 配置

### 字典管理
- **用途**: 可选项、枚举值、分类等**静态数据**
- **特点**: 多个值、树形结构、前端选择
- **示例**: 存储类型、内容分类、订单状态
- **权限**: 读取无需认证，修改需要管理员

### 配置管理
- **用途**: 系统运行参数、功能开关等**动态配置**
- **特点**: 单个值、热更新、后端使用
- **示例**: COS密钥、上传大小、维护模式
- **权限**: 公开配置可读，其他需要认证

---

## 📊 导航菜单

已添加到后台管理导航：

```typescript
const menuItems = [
  { href: '/', icon: LayoutDashboard, label: '概览' },
  { href: '/contents', icon: FileText, label: '内容管理' },
  { href: '/categories', icon: Folder, label: '分类管理' },
  { href: '/tags', icon: Tags, label: '标签管理' },
  { href: '/users', icon: Users, label: '用户管理' },
  { href: '/audit-logs', icon: Shield, label: '审计日志' },
  { href: '/config', icon: Settings, label: '配置管理' },
  { href: '/dictionary', icon: BookOpen, label: '字典管理' }, // ✅ 新增
];
```

---

## 🚀 快速开始

### 1. 访问字典管理

```
http://localhost:3001/dictionary
```

需要管理员登录。

### 2. 添加字典项

1. 点击"新增字典"按钮
2. 填写表单：
   - **字典编码**: `payment_method`（同一编码的项会分组）
   - **标签名称**: `支付宝`
   - **字典值**: `alipay`
   - **类型**: `enum`
   - **排序**: `1`
   - **说明**: `支付宝支付`
3. 点击"保存"

### 3. 前端使用

```typescript
// 获取支付方式选项
const methods = await apiAsync('GET:/dictionary/code/:code', {
  code: 'payment_method',
});

// 渲染
methods.forEach(item => {
  console.log(item.label, item.value);
  // 输出: 支付宝 alipay
});
```

---

## 🗄️ 数据库结构

**表名**: `dictionaries`

**字段**:
- `id` - 主键
- `code` - 字典编码（如 `storage_type`）
- `parent_id` - 父级ID（支持树形）
- `label` - 显示名称
- `value` - 字典值
- `type` - 类型（enum, tree, list）
- `sort` - 排序
- `is_enabled` - 是否启用
- `description` - 说明
- `extra` - 扩展字段（JSON）
- `created_at` - 创建时间
- `updated_at` - 更新时间

**索引**:
- `unique(code, value)` - 同一编码下值唯一
- `index(code)` - 编码索引
- `index(parent_id)` - 父级索引
- `index(is_enabled)` - 启用状态索引

---

## 📝 初始数据

种子文件已包含存储类型字典：

**文件**: `apps/backend/prisma/seeds/config.seed.ts`

```typescript
const dictionaryData = [
  {
    code: 'storage_type',
    label: '本地存储',
    value: 'local',
    type: 'enum',
    sort: 1,
    description: '文件存储在本地服务器',
  },
  {
    code: 'storage_type',
    label: '腾讯云COS',
    value: 'cos',
    type: 'enum',
    sort: 2,
    description: '使用腾讯云对象存储',
  },
  {
    code: 'storage_type',
    label: '阿里云OSS',
    value: 'oss',
    type: 'enum',
    sort: 3,
    description: '使用阿里云对象存储',
  },
];
```

---

## 🎨 扩展字段

字典支持 `extra` 字段存储额外信息（JSON 格式）：

```typescript
await apiAsync('POST:/dictionary', {
  code: 'payment_method',
  label: '微信支付',
  value: 'wechat',
  type: 'enum',
  sort: 1,
  extra: JSON.stringify({
    icon: 'wechat.png',
    color: '#07C160',
    enabled: true,
    fee: 0.006,  // 手续费 0.6%
  }),
});

// 使用时解析
const item = items[0];
const extra = JSON.parse(item.extra || '{}');
console.log(extra.fee);  // 0.006
```

---

## ⚠️ 注意事项

### 1. 编码命名规范
- 使用小写字母和下划线
- 语义化命名
- 示例：`storage_type`, `order_status`, `payment_method`

### 2. 值的唯一性
- 同一编码下，值必须唯一
- 数据库有唯一约束 `unique(code, value)`

### 3. 软删除
- 删除操作是软删除，只设置 `is_enabled = false`
- 不会真正从数据库删除
- 查询时自动过滤 `is_enabled = false` 的项

### 4. 树形结构
- 使用 `parent_id` 建立父子关系
- 使用 `getTree` API 获取树形数据
- 最多支持多级嵌套

---

## 🔮 后续优化建议

### 1. 批量操作
- 批量导入字典
- 批量修改排序
- 批量启用/禁用

### 2. 字典缓存
- Redis 缓存字典数据
- 提高读取性能

### 3. 版本管理
- 字典变更历史
- 版本回滚

### 4. 国际化
- 支持多语言标签
- 根据语言返回对应标签

---

## 📚 相关文档

- [配置系统设计](./CONFIG_SYSTEM_DESIGN.md)
- [配置管理使用](./ADMIN_CONFIG_GUIDE.md)
- [最终总结](./FINAL_SUMMARY_2024-11-24.md)

---

**版本**: 1.0  
**创建时间**: 2024-11-25  
**作者**: AI Assistant  
**状态**: ✅ 已完成并可用
