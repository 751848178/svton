# FileTreeBlockView

> 用于以树形结构展示文件或目录列表的块组件，支持递归嵌套渲染。

## 何时使用

当 Agent 需要展示项目目录结构、待处理文件列表或生成的脚手架布局时，使用 `FileTreeBlockView` 以可折叠的树形结构呈现。该组件适合文件扫描结果、项目概览、代码生成回执等场景。

## 快速开始

```tsx
import { FileTreeBlockView } from '@svton/agent-ui';

const tree = [
  {
    name: 'src',
    type: 'dir',
    children: [
      { name: 'index.ts', type: 'file' },
      { name: 'utils', type: 'dir', children: [{ name: 'helper.ts', type: 'file' }] },
    ],
  },
  { name: 'package.json', type: 'file' },
];

<FileTreeBlockView tree={tree} />
```

<Demo name="file-tree" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tree` | `FileTreeNode[]` | 是 | 树形节点数组 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
interface FileTreeNode {
  /** 节点名称 */
  name: string;
  /** 节点类型：文件或目录 */
  type: 'file' | 'dir';
  /** 子节点列表（仅 dir 类型有效） */
  children?: FileTreeNode[];
}
```

## 进阶示例

展示深层嵌套的目录结构：

```tsx
<FileTreeBlockView
  tree={[
    {
      name: 'components',
      type: 'dir',
      children: [
        {
          name: 'Button',
          type: 'dir',
          children: [
            { name: 'Button.tsx', type: 'file' },
            { name: 'index.ts', type: 'file' },
          ],
        },
      ],
    },
  ]}
  className="project-tree"
/>
```

## 注意事项

- `children` 仅在 `type` 为 `dir` 时有意义；`file` 类型节点的 `children` 会被忽略。
- 树的层级无固定深度限制，但建议控制在 5 层以内以保证可读性。
- 节点名称建议使用相对路径的最后一段（文件名或目录名），路径前缀由层级关系体现。
