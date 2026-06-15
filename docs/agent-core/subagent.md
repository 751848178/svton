# 子代理系统(Subagent)

> 隔离的子代理 — 独立上下文窗口、受限工具集，完成后仅返回摘要。

`SubagentManager` 管理隔离的子代理——每个子代理拥有独立的上下文窗口、受限的工具集和独立的生命周期。子代理执行完成后,只有摘要返回给父代理,不会污染父代理的上下文。

## 快速使用

```typescript
import { SubagentManager } from '@svton/agent-core';

const subagentManager = new SubagentManager(config, runtime, platform, toolRegistry);
runtime.setSubagentManager(subagentManager);

// 生成一个子代理执行分析任务
const summary = await subagentManager.spawn({
  task: '审查 src/ 目录的代码质量',
  tools: ['file_read', 'grep', 'glob'],  // 只读工具白名单
  maxIterations: 15,
});

console.log(summary);
```

## 核心原则

1. **上下文隔离**:每个子代理有自己的上下文窗口,不与父代理共享。
2. **仅返回摘要**:子代理完成后,通过 LLM 摘要化,只将精简摘要返回给父代理。
3. **工具受限**:可以通过白名单/黑名单限制子代理可用的工具。
4. **可并行**:多个子代理可以同时运行。
5. **防止无限嵌套**:子代理不再拥有自己的 SubagentManager(会自动剥离)。

## 类型定义

### SubagentConfig

```typescript
interface SubagentConfig {
  /** 要委派的任务 */
  task: string;
  /** 模型覆盖(默认使用父代理的模型) */
  model?: string;
  /** 工具白名单(可选,指定后只允许这些工具) */
  tools?: string[];
  /** 工具黑名单 */
  excludeTools?: string[];
  /** 是否隔离上下文窗口(默认 true) */
  isolatedContext?: boolean;
  /** 子代理最大迭代数 */
  maxIterations?: number;
  /** 超时时间(ms) */
  timeout?: number;
  /** 角色描述 */
  roleDescription?: string;
}
```

### SubagentResult

```typescript
interface SubagentResult {
  agentId: string;           // 唯一运行 ID
  summary: string;           // 摘要(返回给父代理)
  messages: ChatMessage[];   // 完整消息历史(不注入父代理上下文)
  usage: TokenUsage;         // token 使用统计
  success: boolean;          // 是否成功完成
  error?: string;            // 失败时的错误信息
}
```

---

## SubagentManager API

### 构造函数

```typescript
new SubagentManager(
  parentConfig: AgentConfig,
  parentRuntime: IRuntime,
  platform: IPlatform,
  toolRegistry: ToolRegistry,
);
```

### spawn()

创建并运行单个子代理:

```typescript
async spawn(config: SubagentConfig): Promise<SubagentResult>;
```

```typescript
import { SubagentManager } from '@svton/agent-core';

const manager = new SubagentManager(config, runtime, platform, toolRegistry);

const result = await manager.spawn({
  task: '阅读 src/ 目录下所有 TypeScript 文件,总结项目架构',
  roleDescription: '一个代码架构分析专家',
  tools: ['file_read', 'grep', 'glob'],  // 只允许只读工具
  maxIterations: 15,
  timeout: 60000,
});

if (result.success) {
  console.log(`子代理完成 (${result.usage.totalTokens} tokens):`);
  console.log(result.summary);
} else {
  console.error(`子代理失败: ${result.error}`);
}
```

### spawnParallel()

并行创建多个子代理:

```typescript
async spawnParallel(configs: SubagentConfig[]): Promise<SubagentResult[]>;
```

```typescript
const results = await manager.spawnParallel([
  {
    task: '分析前端代码结构',
    tools: ['file_read', 'glob'],
    roleDescription: '前端架构分析师',
  },
  {
    task: '分析后端 API 设计',
    tools: ['file_read', 'grep'],
    roleDescription: '后端 API 设计师',
  },
  {
    task: '分析数据库 schema',
    tools: ['file_read'],
    roleDescription: '数据库架构师',
  },
]);

for (const r of results) {
  console.log(`[${r.agentId}] ${r.summary}`);
}
```

---

## spawnOnCsv() — CSV 批量扇出

为 CSV 的每一行创建一个子代理任务,通过 `{{column_name}}` 模板占位符将行数据注入到任务中。默认并发数 4。

```typescript
async spawnOnCsv(opts: {
  csvContent: string;
  taskTemplate: string;       // {{column_name}} 占位符
  concurrency?: number;       // 默认 4
  onRowStart?: (rowIndex: number, row: Record<string, string>) => void;
  onRowComplete?: (
    rowIndex: number,
    row: Record<string, string>,
    result: SubagentResult,
  ) => void;
}): Promise<{
  results: Array<{ row: Record<string, string>; result: SubagentResult }>;
}>;
```

### 示例:批量处理用户反馈

```csv
name,feedback
Alice,产品很好用但 UI 可以改进
Bob,加载速度太慢
Charlie,希望增加导出功能
```

```typescript
const csv = fs.readFileSync('feedback.csv', 'utf-8');

const { results } = await manager.spawnOnCsv({
  csvContent: csv,
  taskTemplate: '用户 {{name}} 反馈:"{{feedback}}"。请分析反馈情绪,归类为正面/负面/中性,并给出建议回复。',
  concurrency: 2,
  onRowStart: (index, row) => console.log(`开始处理 ${row.name}`),
  onRowComplete: (index, row, result) => {
    console.log(`${row.name}: ${result.summary}`);
  },
});
```

CSV 解析器支持引号包裹的字段、逗号在引号内、以及引号内的换行符。

---

## subagent_spawn 工具

注册 `subagent_spawn` 工具让 LLM 自主决定何时委派任务:

```typescript
// 子代理 spawn 工具(需要 runtime 创建后注入 manager)
runtime.setSubagentManager(manager);
```

工具参数对应 `SubagentConfig`:

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `task` | string | (必填)委派给子代理的任务描述 |
| `tools` | string[] | 允许的工具列表 |
| `excludeTools` | string[] | 排除的工具列表 |
| `model` | string | 模型覆盖 |
| `maxIterations` | number | 最大迭代数 |
| `timeout` | number | 超时(ms) |

---

## 工具注册表构建

子代理创建时会从父代理的工具注册表中复制工具,应用白名单/黑名单:

```typescript
// 子代理工具构建逻辑(内部)
private buildToolRegistry(config: SubagentConfig): ToolRegistry {
  const registry = new ToolRegistry();
  for (const def of this.toolRegistry.listDefinitions()) {
    // 检查黑名单
    if (config.excludeTools?.includes(def.name)) continue;
    // 检查白名单(如果指定)
    if (config.tools && !config.tools.includes(def.name)) continue;
    // 复制
    const entry = this.toolRegistry.get(def.name);
    if (entry) registry.register(entry.definition, entry.executor);
  }
  return registry;
}
```

## 子代理系统提示词

子代理使用如下系统提示词模板:

```
You are ${role}, working as a subagent.

## Your Task
${task}

## Guidelines
- Focus only on the assigned task
- Be concise and efficient
- When done, provide a clear summary of what you accomplished
- If you cannot complete the task, explain why
```

## 摘要化

子代理完成后,会尝试用 LLM 将完整输出摘要为 3-5 句话。如果 LLM 摘要失败,则截取最后一条助手消息的前 2000 字符作为摘要。

---

## 与 AgentRuntime 集成

由于循环依赖(AgentRuntime 依赖 SubagentManager,SubagentManager 依赖 IRuntime),子代理管理器必须在 runtime 创建后通过 setter 注入:

```typescript
const runtime = await AgentRuntime.createAsync(config, platform);

const subagentManager = new SubagentManager(
  config,
  runtime,
  platform,
  toolRegistry,
);

runtime.setSubagentManager(subagentManager);
```

## 最佳实践

- **只读子代理**:对于分析类任务,设置 `tools: ['file_read', 'grep', 'glob']` 避免意外修改。
- **限制迭代**:`maxIterations` 默认 20,复杂任务可适当增加。
- **设置超时**:`timeout` 默认 120 秒,根据任务复杂度调整。
- **利用并行**:多个独立任务使用 `spawnParallel` 而非顺序 `spawn`。
- **使用 CSV 扇出**处理批量同构任务。
- **小模型子代理**:非关键任务可以用 `model` 指定更小的模型降低成本。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — 父代理的运行时
- [权限系统](./permission) — 子代理继承的权限规则
- [工具系统](./tools) — 子代理可用工具白名单/黑名单
- [规划系统](./planning) — 与子代理配合处理复杂任务
