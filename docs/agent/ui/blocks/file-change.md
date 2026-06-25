# FileChangeView

> 用于展示 Agent 对文件系统的变更（创建、修改、删除），支持行级 diff 渲染的块组件。

## 何时使用

当 Agent 在一次会话中对一个或多个文件进行了创建、修改或删除操作时，使用 `FileChangeView` 将这些变更以可读的列表形式展示给用户。该组件常用于 ToolCall 回执或会话摘要中，帮助用户快速理解 Agent 改动了哪些文件。

## 快速开始

```tsx
import { FileChangeView } from '@svton/agent-ui';

const changes = [
  { path: 'src/index.ts', changeType: 'modify', diff: '@@ -1,3 +1,4 @@\n+import foo' },
  { path: 'README.md', changeType: 'create' },
];

<FileChangeView changes={changes} />
```

<Demo name="file-change" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `changes` | `FileChangeEntry[]` | 是 | 变更条目数组 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
type ChangeType = 'create' | 'modify' | 'delete';

interface FileChangeEntry {
  /** 文件相对或绝对路径 */
  path: string;
  /** 变更类型 */
  changeType: ChangeType;
  /** 可选的 unified diff 文本，仅 modify 时有意义 */
  diff?: string;
}
```

## 进阶示例

按变更类型分组展示，并传入完整 diff：

```tsx
<FileChangeView
  changes={[
    { path: 'src/a.ts', changeType: 'create', diff: '+export const a = 1;' },
    { path: 'src/b.ts', changeType: 'delete' },
    { path: 'src/c.ts', changeType: 'modify', diff: '@@ -10 +10 @@\n-foo\n+bar' },
  ]}
/>
```

通过 `className` 自定义容器样式：

```tsx
<FileChangeView changes={changes} className="my-change-list" />
```

## 注意事项

- `diff` 字段为可选；若不提供，组件仅展示文件路径与变更类型标记。
- 当 `changeType` 为 `delete` 时，`diff` 字段会被忽略。
- 数据通常由 Agent 后端在执行文件操作工具后返回，前端无需手动拼接。
