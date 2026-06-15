# ProgressBlockView

> 用于展示 Agent 执行进度文本与运行状态的块组件，支持 running 与 done 两种状态。

## 何时使用

当 Agent 正在执行一个耗时操作（如代码生成、测试运行、文件扫描）并需要向用户反馈当前进度时，使用 `ProgressBlockView` 展示进度文案与状态指示器。该组件适合长任务的中间状态展示。

## 快速开始

```tsx
import { ProgressBlockView } from '@svton/agent-ui';

<ProgressBlockView
  text="正在生成测试用例..."
  status="running"
/>
```

<Demo name="progress" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | `string` | 是 | 进度描述文本 |
| `status` | `'running' \| 'done'` | 是 | 当前执行状态 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
type ProgressStatus = 'running' | 'done';

interface ProgressBlockProps {
  text: string;
  status: ProgressStatus;
  className?: string;
}
```

## 进阶示例

切换为完成状态：

```tsx
<ProgressBlockView text="测试用例已生成，共 12 条。" status="done" />
```

自定义样式：

```tsx
<ProgressBlockView
  text="扫描项目依赖..."
  status="running"
  className="my-progress"
/>
```

## 注意事项

- `running` 状态下组件会显示加载动画；`done` 状态下显示完成标记。
- 该组件为纯展示组件，不包含定时器或轮询逻辑，状态切换由调用方控制。
- 若需要在进度中展示百分比或步骤条，请结合多个 `ProgressBlockView` 或自定义组件使用。
