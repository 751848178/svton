# SubagentBlockView

> 用于展示子 Agent（Subagent）任务派发、运行状态与执行摘要的块组件。

## 何时使用

当主 Agent 将子任务委托给一个或多个子 Agent 执行时，使用 `SubagentBlockView` 在主会话流中嵌入子 Agent 的状态卡片。该组件适合多 Agent 编排、任务分解等场景，帮助用户追踪整体执行进度。

## 快速开始

```tsx
import { SubagentBlockView } from '@svton/agent-ui';

<SubagentBlockView
  agentId="research-agent-01"
  task="检索近期 React 18 迁移指南"
  status="completed"
  summary="共找到 5 篇相关文章，已提取关键迁移步骤。"
/>
```

<Demo name="subagent" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `agentId` | `string` | 是 | 子 Agent 唯一标识 |
| `task` | `string` | 是 | 委派给子 Agent 的任务描述 |
| `status` | `'running' \| 'completed'` | 是 | 子 Agent 当前执行状态 |
| `summary` | `string` | 否 | 子 Agent 完成后的摘要文本 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
type SubagentStatus = 'running' | 'completed';

interface SubagentBlockProps {
  agentId: string;
  task: string;
  status: SubagentStatus;
  summary?: string;
  className?: string;
}
```

## 进阶示例

展示一个正在运行中的子 Agent：

```tsx
<SubagentBlockView
  agentId="codegen-02"
  task="为 UserController 补充单元测试"
  status="running"
/>
```

使用 `className` 覆盖默认样式：

```tsx
<SubagentBlockView
  agentId="lint-fix"
  task="修复 ESLint 错误"
  status="completed"
  summary="共修复 12 处问题"
  className="my-subagent-card"
/>
```

## 注意事项

- `summary` 仅在 `status` 为 `completed` 时显示，`running` 状态下该字段会被忽略。
- `agentId` 仅用于组件内部标识与日志，不会渲染给最终用户。
- 当一个主 Agent 派发多个子 Agent 时，建议将多个 `SubagentBlockView` 包裹在列表容器中统一展示。
