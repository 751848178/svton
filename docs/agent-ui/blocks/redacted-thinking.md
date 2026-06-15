# RedactedThinkingView

> 用于展示 Agent 隐藏了思考细节的推理占位块组件，支持自定义隐藏原因。

## 何时使用

当 Agent 的内部推理过程被安全策略或隐私策略屏蔽时，使用 `RedactedThinkingView` 向用户展示一个"思考已隐藏"的占位块，并可附带隐藏原因说明。该组件适合涉及敏感操作或受限于安全策略的会话场景。

## 快速开始

```tsx
import { RedactedThinkingView } from '@svton/agent-ui';

<RedactedThinkingView reason="出于安全策略，推理过程已被隐藏。" />
```

<Demo name="redacted-thinking" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `reason` | `string` | 否 | 隐藏思考内容的说明文本 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
interface RedactedThinkingProps {
  reason?: string;
  className?: string;
}
```

## 进阶示例

不提供 reason 时使用默认提示文案：

```tsx
<RedactedThinkingView />
```

自定义样式与详细说明：

```tsx
<RedactedThinkingView
  reason="本次推理涉及 API Key 校验，已根据合规要求隐藏。"
  className="redacted-block"
/>
```

## 注意事项

- `reason` 为可选字段；省略时组件展示默认的隐藏提示。
- 该组件为纯展示组件，不包含任何展开或折叠逻辑，思考内容不会在客户端还原。
- 隐藏策略由 Agent 后端或中间件决定，前端仅负责渲染占位块。
