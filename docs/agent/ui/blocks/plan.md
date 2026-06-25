# PlanBlockView

> 内联显示执行计划的步骤列表和进度条，支持折叠/展开

## 何时使用

当 AI 使用规划工具（`plan_create` / `plan_update_step`）创建多步骤计划时，此组件自动渲染到消息流中，让用户实时看到执行进度。

## 快速开始

```tsx
import { PlanBlockView } from '@svton/agent-ui';

<PlanBlockView plan={{
  planId: 'plan_1',
  title: '实现用户认证功能',
  steps: [
    { id: 's1', title: '分析现有代码', status: 'completed' },
    { id: 's2', title: '实现登录接口', status: 'in_progress' },
    { id: 's3', title: '编写测试', status: 'pending' },
  ],
}} />
```

效果如下：

<Demo name="plan-block" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `plan` | `PlanInfo` | ✅ | 计划数据 |
| `className` | `string` | | 自定义 CSS 类名 |

### PlanInfo

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

### 步骤状态图标

| 状态 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| `completed` | ✓ | 绿色 | 步骤已完成 |
| `in_progress` | ● (脉动) | 蓝色 | 正在执行 |
| `failed` | ✗ | 红色 | 执行失败 |
| `skipped` | — | 灰色 | 已跳过 |
| `pending` | ○ | 灰色 | 等待执行 |

## 进阶示例

### 带失败步骤的计划

```tsx
<PlanBlockView plan={{
  planId: 'plan_2',
  title: '数据库迁移',
  steps: [
    { id: 's1', title: '备份当前数据库', status: 'completed' },
    { id: 's2', title: '执行迁移脚本', status: 'failed' },
    { id: 's3', title: '验证数据完整性', status: 'skipped' },
  ],
}} />
```

### 嵌入 ChatMessage 使用

PlanBlockView 通常不单独使用，而是作为 `ContentBlock` 的一种类型嵌入到 `ChatMessage` 中：

```tsx
import { ChatMessage } from '@svton/agent-ui';

<ChatMessage
  id="msg1"
  role="assistant"
  content=""
  blocks={[
    { type: 'plan', plan: { planId: 'p1', title: '重构计划', steps: [...] } },
    { type: 'text', text: '重构计划已完成 3/5 步骤。' },
  ]}
/>
```

## 注意事项

- Plan 块会被自动归类为**过程消息**，折叠到「已处理」中（只保留最终文本结论可见）
- 数据来源：当 AI 调用 `plan_create` / `plan_update_step` 工具时，`ToolResult.metadata.planProgress` 携带计划数据，`chat.service.ts` 自动推送 plan block
- 同一个 `planId` 的多次更新会原地替换（而非重复添加）
