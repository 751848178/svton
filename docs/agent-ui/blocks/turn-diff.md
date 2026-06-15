# TurnDiffView

> 用于展示 Agent 单轮会话中所有文件变更汇总的块组件，以 diff 形式统一渲染。

## 何时使用

当一轮 Agent 会话结束后，需要对本轮涉及的所有文件变更进行汇总展示时，使用 `TurnDiffView`。与 `FileChangeView` 不同，该组件面向"整轮"视角，适合在会话末尾或回看历史时快速浏览改动范围。

## 快速开始

```tsx
import { TurnDiffView } from '@svton/agent-ui';

const changes = [
  { path: 'src/index.ts', changeType: 'modify', diff: '@@ -1,3 +1,4 @@\n+import foo' },
  { path: 'src/new-file.ts', changeType: 'create', diff: '+export const x = 1;' },
];

<TurnDiffView changes={changes} />
```

<Demo name="turn-diff" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `changes` | `FileChangeEntry[]` | 是 | 本轮所有文件变更条目 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
type ChangeType = 'create' | 'modify' | 'delete';

interface FileChangeEntry {
  path: string;
  changeType: ChangeType;
  diff?: string;
}
```

## 进阶示例

展示包含删除操作的整轮变更：

```tsx
<TurnDiffView
  changes={[
    { path: 'src/old.ts', changeType: 'delete' },
    { path: 'src/new.ts', changeType: 'create', diff: '+export default class New {}' },
    { path: 'src/main.ts', changeType: 'modify', diff: '@@ -5 +5 @@\n-old\n+new' },
  ]}
/>
```

## 注意事项

- `changes` 的数据结构与 `FileChangeView` 一致，可直接复用。
- 当变更条目较多时，组件内置滚动容器以避免撑高会话流。
- `diff` 字段为可选；未提供 diff 的条目仅展示路径与变更类型标签。
