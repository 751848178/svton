# 项目编码规范 - Community Next

**版本**: 1.0.0  
**更新日期**: 2024-11-24  
**适用范围**: 所有新代码和重构代码

---

## 📦 包和依赖规范

### 1. 包命名统一使用 @svton

所有自定义包统一使用 `@svton` 组织名：

```typescript
// ✅ 正确
import { usePersistFn } from '@svton/hooks';
import { NavBar, StatusBar } from '@svton/taro-ui';
import type { ContentDetailVo } from '@svton/types';
import { apiAsync } from '@svton/api-client';

// ❌ 错误
import { usePersistFn } from '@community-helper/hooks';
```

**包列表**:
- `@svton/types` - 类型定义
- `@svton/api-client` - API 客户端
- `@svton/hooks` - React Hooks
- `@svton/taro-ui` - Taro UI 组件
- `@svton/backend` - 后端服务
- `@svton/mobile` - 移动端应用
- `@svton/admin` - 管理端应用

---

## 🎣 Hooks 使用规范

### 2. 优先使用 @svton/hooks 中的 Hooks

所有回调函数、状态管理应优先使用 `@svton/hooks` 包中的优化版本。

#### 2.1 回调函数优化

**使用 `usePersistFn` 代替 `useCallback`**

```typescript
// ✅ 推荐：使用 usePersistFn
import { usePersistFn } from '@svton/hooks';

const handleClick = usePersistFn((id: number) => {
  console.log('Clicked:', id);
  // ... 逻辑
});

// ❌ 不推荐：使用 useCallback（除非有特殊需求）
const handleClick = useCallback((id: number) => {
  console.log('Clicked:', id);
}, [dependency1, dependency2]); // 需要手动管理依赖
```

**优点**:
- 无需手动管理依赖数组
- 函数引用永远稳定
- 避免闭包陷阱

#### 2.2 @svton/hooks 可用 Hooks

```typescript
import {
  usePersistFn,         // 持久化函数引用（最常用）
  useMemoizedFn,        // 记忆化函数
  useDebounce,          // 防抖
  useThrottle,          // 节流
  useDeepCompareEffect, // 深度比较的 useEffect
} from '@svton/hooks';

// 示例1：持久化回调
const handleClick = usePersistFn((id: number) => {
  console.log('Clicked:', id);
});

// 示例2：防抖搜索
const debouncedKeyword = useDebounce(keyword, 500);
useEffect(() => {
  if (debouncedKeyword) {
    search(debouncedKeyword);
  }
}, [debouncedKeyword]);

// 示例3：深度比较依赖
useDeepCompareEffect(() => {
  fetchData(params);
}, [params]); // params 是对象时使用深度比较
```

---

## 🎨 UI 组件使用规范

### 3. 移动端优先使用 @svton/taro-ui 组件

在 `apps/mobile` 项目中，优先使用 `@svton/taro-ui` 包中的组件。

#### 3.1 导航和状态栏

```typescript
// ✅ 推荐：使用 @svton/taro-ui
import { NavBar, StatusBar, CustomNavBar } from '@svton/taro-ui';

<View className="page">
  <StatusBar />
  <NavBar title="页面标题" />
  {/* 内容 */}
</View>

// ❌ 不推荐：自己实现导航栏
<View className="custom-navbar">
  <View className="navbar-back" onClick={goBack}>返回</View>
  <Text className="navbar-title">页面标题</Text>
</View>
```

#### 3.2 @svton/taro-ui 可用组件

```typescript
import {
  NavBar,          // 导航栏（原 CustomNavBar）
  StatusBar,       // 状态栏
  Button,          // 按钮
  List,            // 列表
  TabBar,          // 底部导航栏
  ImageUploader,   // 图片上传器
  ImageGrid,       // 图片网格
} from '@svton/taro-ui';

// 示例1：页面导航
<View className="page">
  <StatusBar />
  <NavBar title="页面标题" />
  {/* 内容 */}
</View>

// 示例2：按钮
<Button 
  type="primary" 
  size="large" 
  onClick={handleSubmit}
>
  提交
</Button>

// 示例3：图片上传
<ImageUploader
  value={images}
  onChange={setImages}
  maxCount={9}
/>

// 示例4：列表
<List>
  {items.map(item => (
    <List.Item key={item.id} onClick={() => handleClick(item.id)}>
      {item.title}
    </List.Item>
  ))}
</List>
```

#### 3.3 暂未实现的组件（使用 Taro 原生或自定义）

以下组件暂未在 `@svton/taro-ui` 中实现，可以使用 Taro 原生组件或自定义：

```typescript
// Loading - 使用 Taro.showLoading
Taro.showLoading({ title: '加载中...' });

// Empty - 自定义空状态
<View className="empty-state">
  <Text className="empty-icon">📭</Text>
  <Text className="empty-text">暂无数据</Text>
</View>

// Modal - 使用 Taro.showModal
Taro.showModal({
  title: '提示',
  content: '确认删除吗？',
  success: (res) => {
    if (res.confirm) {
      // 确认
    }
  },
});

// Toast - 使用 Taro.showToast
Taro.showToast({ title: '操作成功', icon: 'success' });
```

#### 3.3 组件扩展原则

**如果 @svton/taro-ui 中没有所需组件**：
1. 优先在 `@svton/taro-ui` 包中添加通用组件
2. 特定业务组件可以放在 `apps/mobile/src/components`

```typescript
// 示例：添加新组件到 @svton/taro-ui
// packages/taro-ui/src/components/YourComponent/index.tsx
export { YourComponent } from './YourComponent';

// packages/taro-ui/src/index.ts
export { YourComponent } from './components/YourComponent';
```

---

## 🎯 TypeScript 类型规范

### 4. 类型定义使用 @svton/types

所有类型定义统一放在 `@svton/types` 包中。

```typescript
// ✅ 推荐
import type { 
  ContentDetailVo,
  UserProfileVo,
  CommentVo,
  ApiResponse,
} from '@svton/types';

// ❌ 不推荐：在组件中定义全局类型
interface ContentDetail {
  id: number;
  title: string;
  // ...
}
```

**类型文件组织**:
```
packages/types/src/
├── api/           # API 相关类型
│   ├── content.ts
│   ├── user.ts
│   ├── comment.ts
│   └── ...
├── dto/           # DTO 类型
├── vo/            # VO 类型
└── index.ts       # 导出入口
```

---

## 🚀 API 调用规范

### 5. 使用统一的 API 客户端

#### 5.1 客户端组件（Admin）

```typescript
// ✅ 强制使用 useQuery / useMutation
import { useQuery, useMutation } from '@/hooks/useAPI';

function MyComponent() {
  const { data, isLoading, error, mutate } = useQuery(
    'GET:/contents/:id',
    { id: contentId }
  );
  
  const { trigger: deleteContent } = useMutation('DELETE:/contents/:id');
  
  return <div>...</div>;
}

// ❌ 禁止：直接使用 apiAsync
import { apiAsync } from '@/lib/api-client';
useEffect(() => {
  apiAsync('GET:/contents/:id', { id }).then(setData);
}, [id]);
```

#### 5.2 客户端组件（Mobile）

```typescript
// ✅ 推荐：使用 useAPI Hook
import { useAPI, useMutation } from '@/hooks/useAPI-v2';

const { data, loading, error, refresh } = useAPI(
  'GET:/contents/:id',
  { id: contentId },
  { immediate: true }
);

const { trigger: deleteContent } = useMutation('DELETE:/contents/:id');

// ❌ 禁止：直接使用 Taro.request
const fetchData = async () => {
  const res = await Taro.request({
    url: `${baseURL}/contents/${id}`,
    method: 'GET',
  });
};
```

#### 5.3 服务端组件（Next.js）

```typescript
// ✅ 强制使用 serverApiAsync
import { serverApiAsync } from '@/lib/api-server';

export default async function Page() {
  const contents = await serverApiAsync('GET:/contents', { page: 1 });
  const categories = await serverApiAsync('GET:/categories', undefined);
  
  return <div>...</div>;
}

// ❌ 禁止：使用客户端 apiAsync 或 Hooks
import { apiAsync } from '@/lib/api-client';
const data = await apiAsync('GET:/contents', {});

import { useQuery } from '@/hooks/useAPI';
const { data } = useQuery('GET:/contents', {}); // Hooks 不能在服务端使用
```

#### 5.2 API 定义规范

```typescript
// packages/api-client/src/modules/content.ts

// ✅ 推荐：使用新的泛型格式
export const getContentDetail = defineApi<
  { id: number },
  ContentDetailVo
>('GET', '/contents/:id');

// ✅ 也可以：使用旧格式（向后兼容）
export const getContentList = defineApi({
  method: 'GET',
  path: '/contents',
  query: {} as QueryContentDto,
  response: {} as ContentListVo,
});
```

---

## 🎨 样式规范

### 6. 设计稿 1.7 倍缩放规则

所有从 Miaoduo 设计稿复原的页面统一使用 **1.7倍** 缩放规则。

```scss
// ✅ 推荐：导入 design-scale.scss
@import '../../styles/design-scale.scss';

.page {
  // 使用预定义变量
  font-size: $font-size-base;      // scale(16px) = 27.2px
  padding: $spacing-base;          // scale(16px) = 27.2px
  border-radius: $radius-base;     // scale(12px) = 20.4px
  
  // 使用 scale 函数
  width: scale(100px);             // 170px
  height: scale(80px);             // 136px
  
  // 颜色变量
  background: $color-background;
  color: $color-text-primary;
  border: 1px solid $color-border; // 边框不缩放
}
```

**工具文件**: `apps/mobile/src/styles/design-scale.scss`

---

## 📝 代码组织规范

### 7. 组件结构

```typescript
/**
 * 组件说明
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';           // 1. @svton Hooks
import { NavBar, StatusBar } from '@svton/taro-ui';   // 2. @svton UI
import type { ContentVo } from '@svton/types';        // 3. @svton Types
import { useAPI } from '@/hooks/useAPI-v2';           // 4. 业务 Hooks
import './index.scss';                                 // 5. 样式

export default function MyComponent() {
  // 6. 状态定义
  const [data, setData] = useState<ContentVo[]>([]);
  
  // 7. API 调用
  const { data: apiData, loading } = useAPI('GET:/contents');
  
  // 8. 回调函数（使用 usePersistFn）
  const handleClick = usePersistFn(() => {
    console.log('clicked');
  });
  
  // 9. 副作用
  useEffect(() => {
    // ...
  }, []);
  
  // 10. 渲染
  return (
    <View className="my-component">
      <StatusBar />
      <NavBar title="标题" />
      {/* 内容 */}
    </View>
  );
}
```

---

## ✅ 代码审查检查清单

在提交代码前，检查以下项目：

### Hooks 规范
- [ ] 所有回调函数使用 `usePersistFn`
- [ ] 使用 `@svton/hooks` 中的工具 Hooks
- [ ] 避免直接使用 `useCallback`（除非有特殊需求）

### UI 组件规范
- [ ] 移动端使用 `@svton/taro-ui` 组件
- [ ] 导航栏使用 `<NavBar>` 和 `<StatusBar>`
- [ ] 空状态使用 `<Empty>`
- [ ] 加载状态使用 `<Loading>`

### 类型规范
- [ ] 类型定义来自 `@svton/types`
- [ ] 避免在组件中定义全局类型
- [ ] 使用 TypeScript 严格模式

### API 规范
- [ ] 客户端组件使用 `useQuery` / `useMutation` (Admin) 或 `useAPI` (Mobile)
- [ ] 服务端组件使用 `serverApiAsync`
- [ ] 避免直接使用 `apiAsync`、`Taro.request`、`fetch`
- [ ] API 定义使用新的泛型格式

### 样式规范
- [ ] 导入 `design-scale.scss`
- [ ] 使用 `scale()` 函数或预定义变量
- [ ] 使用颜色变量而非硬编码颜色

---

## 🔄 迁移指南

### 现有代码迁移

如果现有代码不符合规范，应逐步迁移：

1. **新功能**：严格遵循规范
2. **重构代码**：应用规范
3. **稳定代码**：不强制迁移（避免引入风险）

### 迁移示例

```typescript
// 迁移前
const handleClick = useCallback(() => {
  console.log('clicked');
}, [dependency]);

// 迁移后
const handleClick = usePersistFn(() => {
  console.log('clicked');
});
```

---

## 📚 参考资源

- **@svton/hooks 文档**: `packages/hooks/README.md`
- **@svton/taro-ui 文档**: `packages/taro-ui/README.md`
- **设计稿缩放规范**: `docs/design-scale-standard.md`
- **API Client 使用指南**: `packages/api-client/README.md`

---

## 💡 最佳实践

### 示例：完整的页面组件

```typescript
/**
 * 内容列表页面
 */
import { View, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { NavBar, StatusBar, Empty, Loading } from '@svton/taro-ui';
import type { ContentVo } from '@svton/types';
import { usePagination } from '@/hooks/useAPI-v2';
import './index.scss';

export default function ContentList() {
  const [categoryId, setCategoryId] = useState<number>();
  
  // 使用分页 Hook
  const { data, loading, hasMore, loadMore } = usePagination(
    'GET:/contents',
    { categoryId, pageSize: 20 }
  );
  
  // 使用 usePersistFn 定义回调
  const handleItemClick = usePersistFn((id: number) => {
    Taro.navigateTo({ url: `/pages/detail/index?id=${id}` });
  });
  
  return (
    <View className="content-list-page">
      <StatusBar />
      <NavBar title="内容列表" />
      
      <ScrollView
        scrollY
        onScrollToLower={loadMore}
        className="scroll-view"
      >
        {loading && <Loading text="加载中..." />}
        
        {!loading && data.length === 0 && (
          <Empty text="暂无内容" />
        )}
        
        {data.map(item => (
          <View 
            key={item.id} 
            className="item"
            onClick={() => handleItemClick(item.id)}
          >
            {/* 内容 */}
          </View>
        ))}
        
        {!hasMore && <View className="no-more">没有更多了</View>}
      </ScrollView>
    </View>
  );
}
```

---

**最后更新**: 2024-11-24  
**维护者**: AI Assistant  
**审核者**: 项目团队

如有疑问或建议，请在项目中提出 Issue。
