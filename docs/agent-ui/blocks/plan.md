# PlanBlockView — 计划进度块

内联显示执行计划的步骤列表和进度条。支持折叠/展开。

## 可交互 Demo

<Demo name="plan-block" :height="400" />

## 代码示例

```tsx
import { PlanBlockView } from '@svton/agent-ui';

<PlanBlockView plan={{
  planId: 'plan_1',
  title: '实现用户认证功能',
  steps: [
    { id: 's1', title: '分析现有代码', status: 'completed' },
    { id: 's2', title: '设计 API', status: 'completed' },
    { id: 's3', title: '实现登录接口', status: 'in_progress' },
    { id: 's4', title: '编写测试', status: 'pending' },
  ],
}} />
```

## Props

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plan` | `PlanInfo` | 是 | 计划数据 |
| `className` | `string` | 否 | 自定义样式 |

## PlanInfo 类型

```typescript
interface PlanInfo {
  planId: string;
  title: string;
  steps: PlanStepInfo[];
}

interface PlanStepInfo {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'failed' | 'skipped' | 'pending';
}
```

## 步骤状态图标

| 状态 | 图标 | 颜色 |
|------|------|------|
| `completed` | ✓ | 绿色 |
| `in_progress` | ● (脉动) | 蓝色 |
| `failed` | ✗ | 红色 |
| `skipped` | — | 灰色 |
| `pending` | ○ | 灰色 |

## 数据来源

Plan 块由 `chat.service.ts` 在 `tool_call_end` 事件中自动创建。当 AI 调用 `plan_create` / `plan_update_step` 工具时，`ToolResult.metadata.planProgress` 中携带计划数据，自动推送 plan block 到消息流。
