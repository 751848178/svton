# WarningBlockView

> 用于在会话流中突出展示警告信息的块组件，支持自定义来源标签。

## 何时使用

当 Agent 在执行过程中遇到需要用户注意但非致命的情况（例如工具调用降级、权限受限、资源不足等）时，使用 `WarningBlockView` 以醒目的警告样式提示用户。该组件也适合展示系统级或环境级的告警信息。

## 快速开始

```tsx
import { WarningBlockView } from '@svton/agent-ui';

<WarningBlockView
  text="当前环境未配置 OpenAI API Key，部分功能将不可用。"
  source="环境检测"
/>
```

<Demo name="warning" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | `string` | 是 | 警告正文内容 |
| `source` | `string` | 否 | 警告来源标签（如工具名、模块名） |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
interface WarningBlockProps {
  text: string;
  source?: string;
  className?: string;
}
```

## 进阶示例

不带来源的纯文本警告：

```tsx
<WarningBlockView text="检测到磁盘空间不足，建议清理缓存目录。" />
```

自定义容器样式：

```tsx
<WarningBlockView
  text="Shell 工具执行超时，已自动降级为只读模式。"
  source="ShellTool"
  className="my-warning"
/>
```

## 注意事项

- `source` 为可选字段，省略时组件仅展示正文，不显示来源标签。
- 该组件仅用于展示警告，不会触发任何用户交互或回调；如需可操作的告警，请结合 `CommandBlockView` 使用。
- 数据来源通常由 Agent 运行时或 Tool 层捕获异常后注入。
