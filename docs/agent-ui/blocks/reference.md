# ReferenceBlockView

> 用于展示 Agent 引用的代码位置或文档片段列表的块组件，支持点击打开。

## 何时使用

当 Agent 在回答中引用了项目内的文件、行号或代码片段时，使用 `ReferenceBlockView` 将这些引用以可点击的列表形式呈现，方便用户跳转到源码。该组件适合代码审查、问答解释、重构建议等场景。

## 快速开始

```tsx
import { ReferenceBlockView } from '@svton/agent-ui';

<ReferenceBlockView
  refs={[
    { path: 'src/utils/date.ts', line: 42, snippet: 'export function formatDate(' },
    { path: 'docs/api.md' },
  ]}
  onOpen={(ref) => console.log('打开:', ref.path)}
/>
```

<Demo name="reference" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refs` | `ReferenceEntry[]` | 是 | 引用条目数组 |
| `className` | `string` | 否 | 自定义 CSS 类名 |
| `onOpen` | `(ref: ReferenceEntry) => void` | 否 | 点击引用条目时的回调 |

```ts
interface ReferenceEntry {
  /** 文件路径 */
  path: string;
  /** 可选的行号 */
  line?: number;
  /** 可选的代码或文本片段 */
  snippet?: string;
}
```

## 进阶示例

展示带行号与片段的引用：

```tsx
<ReferenceBlockView
  refs={[
    {
      path: 'src/components/Button.tsx',
      line: 15,
      snippet: 'const handleClick = () => onClick();',
    },
  ]}
/>
```

不绑定 `onOpen` 时组件以只读模式渲染：

```tsx
<ReferenceBlockView refs={[{ path: 'README.md' }]} className="ref-list" />
```

## 注意事项

- `onOpen` 为可选回调；若未提供，引用条目将不会显示可点击的交互样式。
- `line` 和 `snippet` 均为可选，组件会根据是否提供自动调整布局。
- 引用数据通常由 Agent 在分析代码后生成，路径应为相对于项目根目录的相对路径。
