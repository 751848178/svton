# 编码规范

> 项目统一的编码规范和最佳实践

---

## 📦 包命名规范

### 项目私有包（使用项目组织名 `@{org}`）

| 包名 | 类型 | 说明 |
|------|------|------|
| `@{org}/backend` | app | 后端 API |
| `@{org}/admin` | app | 管理后台 |
| `@{org}/mobile` | app | 移动端小程序 |
| `@{org}/types` | package | TypeScript 类型定义 |

### 公共包（使用 `@svton` 组织名，发布到 npm）

| 包名 | 类型 | 说明 |
|------|------|------|
| `@svton/api-client` | package | API 客户端 |
| `@svton/hooks` | package | React Hooks |
| `@svton/taro-ui` | package | Taro UI 组件库 |
| `@svton/cli` | package | CLI 脚手架工具 |

---

## 🎣 Hooks 使用规范

### 必须优先使用 @svton/hooks

```typescript
// ✅ 正确：使用 usePersistFn
import { usePersistFn, useDebounce } from '@svton/hooks';

const handleClick = usePersistFn(() => {
  console.log('clicked', data);
});

// ❌ 错误：使用 useCallback
const handleClick = useCallback(() => {
  console.log('clicked', data);
}, [data]);
```

### 可用 Hooks 列表

| Hook | 用途 | 替代 |
|------|------|------|
| `usePersistFn` | 持久化函数引用 | `useCallback` |
| `useMemoizedFn` | 记忆化函数 | `useCallback` |
| `useDebounce` | 防抖值 | 自定义实现 |
| `useThrottle` | 节流值 | 自定义实现 |
| `useDeepCompareEffect` | 深度比较 Effect | `useEffect` |

---

## 🎨 UI 组件规范

### 移动端必须使用 @svton/taro-ui

```tsx
// ✅ 正确：使用 @svton/taro-ui 组件
import { NavBar, StatusBar, Button, List } from '@svton/taro-ui';

export default function MyPage() {
  return (
    <View className="page">
      <StatusBar />
      <NavBar title="页面标题" />
      <Button type="primary">按钮</Button>
    </View>
  );
}

// ❌ 错误：自己实现导航栏等组件
```

### 可用组件

| 组件 | 用途 |
|------|------|
| `StatusBar` | 状态栏占位 |
| `NavBar` | 导航栏 |
| `Button` | 按钮 |
| `List` / `List.Item` | 列表 |
| `Tabs` | 标签页 |
| `TabBar` | 底部导航 |
| `ImageUploader` | 图片上传 |
| `ImageGrid` | 图片网格 |

---

## 📐 类型定义规范

### 必须使用项目 types 包

```typescript
// ✅ 正确：从项目 types 包导入类型（以 @my-project 为例）
import type { UserVo, ContentVo, PaginatedResponse } from '@my-project/types';

// ❌ 错误：自己定义重复类型
interface UserVo {
  id: number;
  // ...
}
```

### 类型命名规范

| 后缀 | 用途 | 示例 |
|------|------|------|
| `Vo` | 返回给前端的数据 | `UserVo`, `ContentVo` |
| `Dto` | 前端传给后端的数据 | `CreateContentDto` |
| `Params` | 查询参数 | `QueryContentParams` |

---

## 🌐 API 调用规范

### 使用统一的 Hooks

```typescript
// ✅ 推荐：使用 useQuery / useMutation
const { data, isLoading } = useQuery('GET:/contents', { page: 1 });
const { trigger } = useMutation('POST:/contents');

// ❌ 不推荐：直接调用 apiAsync
const data = await apiAsync('GET:/contents', {});
```

### API Key 格式

```
METHOD:/path
```

示例：
- `GET:/contents`
- `POST:/contents`
- `PUT:/contents/:id`
- `DELETE:/contents/:id`

---

## 🎨 样式规范

### 移动端 1.7 倍缩放

设计稿尺寸 × 1.7 = 开发尺寸

```scss
@import '../../styles/design-scale.scss';

.my-component {
  // 使用预定义变量
  font-size: $font-size-base;      // scale(16px)
  padding: $spacing-base;          // scale(16px)
  
  // 使用 scale 函数
  width: scale(100px);             // 170px
}
```

### 常用缩放对照

| 设计稿 | 开发尺寸 |
|--------|----------|
| 12px | 20.4px |
| 14px | 23.8px |
| 16px | 27.2px |
| 20px | 34px |
| 24px | 40.8px |

### 不转换的值

- 边框：保持 1px
- 百分比：保持原值
- 阴影：保持原值

---

## ✅ 代码审查检查清单

每次提交代码前，确认以下事项：

### Hooks 检查

- [ ] 回调函数使用 `usePersistFn`
- [ ] 搜索场景使用 `useDebounce`
- [ ] 对象依赖使用 `useDeepCompareEffect`

### 组件检查

- [ ] 移动端页面包含 `<StatusBar />` 和 `<NavBar />`
- [ ] 按钮使用 `<Button>` 组件
- [ ] 列表使用 `<List>` 组件

### 类型检查

- [ ] 类型来自项目 `@{org}/types` 包
- [ ] API 响应有正确的类型定义

### API 检查

- [ ] 使用 `useQuery` / `useMutation`
- [ ] 错误处理完整

### 样式检查

- [ ] 使用 `design-scale.scss` 变量
- [ ] 遵循 1.7 倍缩放规则

---

## 📁 文件命名规范

### 目录结构

```
src/
├── components/           # 组件目录
│   └── MyComponent/      # 组件文件夹 (PascalCase)
│       ├── index.tsx     # 组件入口
│       └── index.scss    # 组件样式
├── pages/                # 页面目录
│   └── my-page/          # 页面文件夹 (kebab-case)
│       ├── index.tsx
│       └── index.scss
├── hooks/                # Hooks 目录
│   └── useMyHook.ts      # Hook 文件 (camelCase)
├── utils/                # 工具函数
│   └── my-util.ts        # 工具文件 (kebab-case)
└── services/             # 服务/API
    └── my-service.ts     # 服务文件 (kebab-case)
```

### 命名规则

| 类型 | 命名方式 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `MyComponent` |
| Hook | camelCase + use 前缀 | `useMyHook` |
| 工具函数 | camelCase | `formatDate` |
| 常量 | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE` |
| CSS 类 | kebab-case | `.my-component` |

---

## 📚 详细规范

完整编码规范请参考：CODING_STANDARDS.md
