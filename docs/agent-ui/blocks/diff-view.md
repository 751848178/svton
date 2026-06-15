# DiffView

> 用于渲染 unified diff 格式文本的块组件，支持行级增删高亮。

## 何时使用

当 Agent 对文件做了具体修改并需要展示代码差异时，使用 `DiffView` 将 unified diff 文本渲染为带行号和增删高亮的可视化视图。该组件适合代码审查、补丁预览、文件修改回执等场景。

## 快速开始

```tsx
import { DiffView } from '@svton/agent-ui';

const diff = `@@ -1,3 +1,4 @@
 import React from 'react';
+import { useState } from 'react';
 export function App() {
   return <div />;
 }`;

<DiffView diff={diff} />
```

<Demo name="diff-view" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `diff` | `string` | 是 | unified diff 格式的文本 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
interface DiffViewProps {
  /** unified diff 格式文本 */
  diff: string;
  className?: string;
}
```

## 进阶示例

渲染多文件 diff：

```tsx
const multiFileDiff = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-const a = 1;
+const a = 2;
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,3 @@
 export const b = 2;
+export const c = 3;
+`;

<DiffView diff={multiFileDiff} className="multi-diff" />
```

## 注意事项

- `diff` 必须为标准的 unified diff 格式，以 `@@` 开头的 hunk 头会被解析为分块标记。
- 组件仅负责渲染，不执行实际的文件对比；diff 文本需由调用方（如 git diff）生成后传入。
- 大段 diff（超过数百行）时，建议外层包裹固定高度容器并启用滚动以避免页面过长。
