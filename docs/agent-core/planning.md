# 规划系统(Planning)

> 多步骤任务规划与执行跟踪 — 支持计划创建、步骤依赖、状态更新和持久化存储。

`PlanningManager` 管理多步骤任务的规划与执行跟踪。支持计划创建、步骤依赖、状态更新、进度查询和持久化存储。配合 3 个内置规划工具,Agent 可以自主创建和执行结构化计划。

## 快速使用

```typescript
import { PlanningManager } from '@svton/agent-core';

const planner = new PlanningManager(storage);
await planner.init();

// 创建一个多步骤计划
const plan = await planner.createPlan({
  title: '重构认证模块',
  steps: [
    { title: '分析现有代码', description: '阅读 src/auth/ 下所有文件' },
    { title: '设计新架构', description: '绘制架构图并确认方案' },
    { title: '实现重构', description: '编写代码并运行测试' },
  ],
});

// 更新步骤状态
await planner.updateStepStatus(plan.id, 0, 'completed');
```

## 类型定义

### PlanStepStatus

```typescript
type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
```

| 状态 | 图标 | 说明 |
| --- | --- | --- |
| `pending` | `[ ]` | 待执行 |
| `in_progress` | `[~]` | 执行中 |
| `completed` | `[x]` | 已完成 |
| `skipped` | `[-]` | 已跳过 |
| `failed` | `[!]` | 执行失败 |

### PlanStep

```typescript
interface PlanStep {
  id: string;               // step_1, step_2, ...
  title: string;
  description: string;
  status: PlanStepStatus;
  result?: string;          // 执行结果
  dependencies?: string[];  // 依赖的步骤 ID
}
```

### Plan

```typescript
interface Plan {
  id: string;               // plan_N_timestamp
  title: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}
```

---

## PlanningManager API

### 构造函数与初始化

```typescript
import { PlanningManager } from '@svton/agent-core';

const planner = new PlanningManager();
await planner.init(storage);  // 绑定存储,加载已有计划
```

### init()

绑定存储后端,并从存储加载所有已持久化的计划:

```typescript
async init(storage: IStorage): Promise<void>;
```

---

## 创建计划

### createPlan()

```typescript
createPlan(
  title: string,
  steps: Array<{
    title: string;
    description: string;
    dependencies?: string[];
  }>,
): Plan;
```

```typescript
const plan = planner.createPlan(
  '重构认证模块',
  [
    {
      title: '分析现有代码',
      description: '阅读 src/auth/ 目录,理解当前认证流程',
    },
    {
      title: '设计新架构',
      description: '设计基于 JWT 的新认证架构',
      dependencies: ['step_1'],  // 依赖第一步完成
    },
    {
      title: '实现 JWT 中间件',
      description: '编写 JWT 验证中间件',
      dependencies: ['step_2'],
    },
    {
      title: '迁移现有路由',
      description: '将所有路由切换到新中间件',
      dependencies: ['step_3'],
    },
    {
      title: '编写测试',
      description: '为新认证模块编写单元测试和集成测试',
      dependencies: ['step_4'],
    },
  ],
);

console.log(`计划 ID: ${plan.id}`);
```

步骤 ID 自动生成为 `step_1`, `step_2`, ...,通过 `dependencies` 引用。

---

## 状态管理

### updateStepStatus()

```typescript
updateStepStatus(
  planId: string,
  stepId: string,
  status: PlanStepStatus,
  result?: string,
): boolean;
```

```typescript
planner.updateStepStatus(plan.id, 'step_1', 'completed', '发现 3 个认证策略文件');
planner.updateStepStatus(plan.id, 'step_2', 'in_progress');
planner.updateStepStatus(plan.id, 'step_3', 'failed', 'JWT 库版本不兼容');
planner.updateStepStatus(plan.id, 'step_4', 'skipped');
```

### getNextStep()

获取下一个可执行的步骤(状态为 `pending` 且所有依赖已完成):

```typescript
getNextStep(planId: string): PlanStep | null;
```

```typescript
const next = planner.getNextStep(plan.id);
if (next) {
  console.log(`下一步: ${next.title}`);
}
```

### getReadySteps()

获取所有可执行的步骤(用于并行执行):

```typescript
getReadySteps(planId: string): PlanStep[];
```

```typescript
// 如果 step_2 和 step_3 都没有依赖(或依赖已完成)
const ready = planner.getReadySteps(plan.id);
// 可以并行执行多个步骤
await Promise.all(ready.map(step => executeStep(step)));
```

---

## 查询

### getPlan()

```typescript
getPlan(planId: string): Plan | null;
```

### getProgress()

获取计划的整体进度:

```typescript
getProgress(planId: string): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
};
```

```typescript
const progress = planner.getProgress(plan.id);
console.log(`总步骤: ${progress.total}`);
console.log(`已完成: ${progress.completed}`);
console.log(`失败: ${progress.failed}`);
console.log(`待执行: ${progress.pending}`);
// 可以计算百分比: (completed / total * 100).toFixed(1) + '%'
```

### formatPlan()

格式化计划为 Markdown(用于显示或保存):

```typescript
formatPlan(planId: string): string;
```

输出示例:

```markdown
# 重构认证模块
Plan ID: plan_1_1697000000000

[ ] step_1: 分析现有代码
[ ] step_2: 设计新架构
[ ] step_3: 实现 JWT 中间件
   JWT 库版本不兼容
[ ] step_4: 迁移现有路由
[ ] step_5: 编写测试
```

### deletePlan()

```typescript
deletePlan(planId: string): boolean;
```

---

## 3 个内置规划工具

系统提供以下工具,允许 Agent 自主创建和管理计划:

### plan_create

创建新的计划。

```typescript
import { planCreateDef, PlanCreateExecutor } from '@svton/agent-core';

registry.register(planCreateDef, new PlanCreateExecutor(planner));
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 计划标题 |
| `steps` | array | 步骤数组,每项含 title、description、dependencies |

### plan_get_status

查询当前计划进度。

```typescript
import { planGetStatusDef, PlanGetStatusExecutor } from '@svton/agent-core';

registry.register(planGetStatusDef, new PlanGetStatusExecutor(planner));
```

### plan_update_step

更新步骤状态。

```typescript
import { planUpdateStepDef, PlanUpdateStepExecutor } from '@svton/agent-core';

registry.register(planUpdateStepDef, new PlanUpdateStepExecutor(planner));
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `planId` | string | 计划 ID |
| `stepId` | string | 步骤 ID |
| `status` | string | 新状态 |
| `result` | string | (可选)执行结果 |

---

## 依赖管理

步骤通过 `dependencies` 字段建立依赖关系:

```typescript
planner.createPlan('数据处理流水线', [
  { title: '获取数据', description: '从 API 获取原始数据' },  // step_1
  { title: '清洗数据', description: '去除无效记录', dependencies: ['step_1'] },
  { title: '验证数据', description: '检查数据完整性', dependencies: ['step_2'] },
  { title: '发送通知', description: '通知下游系统', dependencies: ['step_3'] },
  { title: '记录日志', description: '写入执行日志', dependencies: ['step_3'] },
  // step_4 和 step_5 都依赖 step_3,可以并行
]);
```

`getNextStep()` 返回第一个 `pending` 且所有依赖 `completed` 的步骤。`getReadySteps()` 返回所有满足条件的步骤。

---

## 与 AgentRuntime 集成

```typescript
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      planningManager: planner,
    },
  },
  platform,
);
```

## 持久化

计划通过 `IStorage` 持久化,键前缀为 `plan:`。每次 `createPlan`、`updateStepStatus`、`deletePlan` 都会自动同步到存储。应用重启后调用 `init()` 即可恢复所有计划。

## 最佳实践

- **大任务先规划**:复杂任务先用 `plan_create` 拆分为步骤,再逐步执行。
- **善用依赖**:通过 `dependencies` 确保执行顺序,避免并行冲突。
- **记录结果**:每个步骤完成后用 `result` 记录关键信息,便于回溯。
- **用 plan 模式规划**:配合 `RunOptions.mode: 'plan'`,Agent 在只读模式下分析任务并生成计划,确认后再切换模式执行。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 运行时集成 PlanningManager
- [工具系统](./tools) — 3 个内置规划工具
- [子代理](./subagent) — 配合子代理拆分复杂任务
- [权限系统](./permission) — plan 模式下的只读权限
