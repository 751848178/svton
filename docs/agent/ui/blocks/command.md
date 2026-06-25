# CommandBlockView

> 用于展示 Agent 建议或执行过的命令行操作的块组件，支持自定义图标与点击回调。

## 何时使用

当 Agent 需要展示一条 shell 命令、CLI 指令或快捷操作时，使用 `CommandBlockView` 以命令卡片形式呈现。该组件适合工具调用回执、操作建议、快捷入口等场景。

## 快速开始

```tsx
import { CommandBlockView } from '@svton/agent-ui';

<CommandBlockView
  label="安装依赖"
  action="npm install"
  onCommand={(action) => console.log('执行:', action)}
/>
```

<Demo name="command" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | 是 | 命令的显示标签 |
| `action` | `string` | 是 | 命令内容（如 shell 指令） |
| `icon` | `ReactNode` | 否 | 自定义图标 |
| `className` | `string` | 否 | 自定义 CSS 类名 |
| `onCommand` | `(action: string) => void` | 否 | 点击命令时的回调 |

```ts
import type { ReactNode } from 'react';

interface CommandBlockProps {
  label: string;
  action: string;
  icon?: ReactNode;
  className?: string;
  onCommand?: (action: string) => void;
}
```

## 进阶示例

带自定义图标的命令卡片：

```tsx
import { TerminalIcon } from './icons';

<CommandBlockView
  label="启动开发服务器"
  action="npm run dev"
  icon={<TerminalIcon />}
  onCommand={(cmd) => window.electronAPI.run(cmd)}
/>
```

不绑定回调时以纯展示模式渲染：

```tsx
<CommandBlockView label="构建" action="pnpm build" className="cmd-card" />
```

## 注意事项

- `onCommand` 为可选回调；未提供时组件不显示执行按钮。
- `icon` 接受任意 ReactNode，建议传入尺寸为 16-20px 的图标组件。
- `action` 字段会以等宽字体渲染，适合展示代码与命令行内容。
