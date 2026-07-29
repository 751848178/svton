# SvtonAgentRuntime 与事件流

> 自 Pi Agent 迁移起,核心运行时由 `SvtonAgentRuntime` 担任——它是 pi-agent-core
> `Agent` 之上的组合根(composition root)。Pi 负责循环、续轮、终止、消息源与工具
> 调度;svton 负责能力管理器、审批门、上下文压缩与事件翻译。

## 架构概览

```
用户消息
   ↓
┌──────────────────────────────────────────────┐
│            SvtonAgentRuntime.run()           │
│  (composition root over pi-agent-core Agent) │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 1. 注入 Skill / Memory 上下文          │  │
│  │ 2. 上下文压缩(SvtonCompactor)         │  │
│  │ 3. Pi Agent.run()(循环/续轮/终止)     │  │
│  │ 4. 工具调用经 ToolExecutionService:    │  │
│  │    a. 权限检查                         │  │
│  │    b. pre_tool_use 钩子                │  │
│  │    c. 审批门(可选)                    │  │
│  │    d. auto-reviewer(可选)             │  │
│  │    e. 沙箱执行                         │  │
│  │    f. post_tool_use 钩子               │  │
│  │ 5. Pi 事件 → AgentEvent(pi-event-adapter)│
│  └────────────────────────────────────────┘  │
│                                              │
│  输出: AsyncGenerator<AgentEvent>            │
└──────────────────────────────────────────────┘
```

`SvtonAgentRuntime` 把职责拆到多个 ≤200 行的文件:
`runtime-run`(单轮循环)、`runtime-capabilities`(能力注入/MCP 桥接)、
`runtime-lifecycle`(post-turn 钩子:记忆抽取 + checkpoint)、
`runtime-compose`(构建 Pi Agent)、`runtime-helpers`(模型解析)、
`pi-event-adapter`(Pi→svton 事件翻译)、`approval-gate`、
`svton-compactor`、`message-bridge`。

## 快速使用

```typescript
import {
  SvtonAgentRuntime,
  ToolRegistry,
  createPiModelsForProvider,
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';

const { models, model } = createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
});

const runtime = await SvtonAgentRuntime.createAsync(
  {
    models,
    piModel: model,
    model: 'gpt-4o',
    toolRegistry: new ToolRegistry(),
    workingDir: '/project',
  },
  new BrowserPlatform(),
);

for await (const event of runtime.run('分析项目结构')) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
}
```

> `AgentRuntime` 是 `SvtonAgentRuntime` 的别名,保留用于旧调用点(见
> `agent-runtime-alias.ts`)。

## AgentConfig

```typescript
interface AgentConfig {
  models: Models;                  // pi-ai Models 集合(createPiModelsForProvider 返回)
  piModel?: Model<any>;            // 已解析的 pi-ai Model(可选;省略则按 id 解析)
  model: string;                   // 模型 id,如 "gpt-4o"
  toolRegistry: ToolRegistry;
  systemPrompt?: string;
  initialMessages?: ChatMessage[]; // 初始对话(种子入 Pi state)
  contextConfig?: Partial<ContextConfig>;
  maxIterations?: number;          // 默认 50
  workingDir?: string;
  capabilities?: AgentCapabilities;
}
```

## 工厂方法

### SvtonAgentRuntime.create()(同步)

不桥接 MCP 工具,适合不使用 MCP 的场景。

### SvtonAgentRuntime.createAsync()(异步)

初始化 MCP 客户端、桥接 MCP 工具到注册表,并重组系统提示词。**有 MCP 客户端
时必须使用此方法**。

## AgentEvent 事件协议

`run()` 返回 `AsyncGenerator<AgentEvent>`。事件分两类(详见
`agent/types.ts`):

### Pi-base 事件(pi-agent-core 产生,由 pi-event-adapter 翻译)

| 事件类型 | 字段 | 说明 |
| --- | --- | --- |
| `text_delta` | `text` | LLM 文本片段 |
| `thinking_delta` | `thinking` | 思考过程片段 |
| `tool_call_start` | `call: ToolCall` | 工具调用开始 |
| `tool_call_progress` | `callId, message, arguments?` | 工具执行进度 |
| `tool_call_end` | `result: ToolResult` | 工具调用结束 |
| `error` | `error: Error` | 错误 |
| `done` | `stopReason, usage` | 运行完成 |

### svton-only 事件(Pi 不拥有的能力)

| 事件类型 | 字段 | 说明 |
| --- | --- | --- |
| `tool_approval_needed` | `call, metadata?` | 需要用户审批 |
| `context_compacted` | `summary` | 上下文已被压缩 |
| `warning` | `text, source?` | 警告 |
| `skill_activated` | `skills` | 技能被触发 |

> 子代理不再有独立事件类型——它们通过 `subagent_spawn` 工具以普通
> `tool_call_*` 事件浮现。

## 迭代示例

```typescript
for await (const event of runtime.run('帮我重构 src/utils.ts')) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.text);
      break;
    case 'tool_call_end':
      if (event.result.isError) console.error('失败:', event.result.output);
      break;
    case 'tool_approval_needed':
      // 需要用户确认
      break;
    case 'done':
      console.log(`完成 (reason: ${event.stopReason}, tokens: ${event.usage.totalTokens})`);
      break;
  }
}
```

## 中断运行

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

for await (const event of runtime.run('一个大任务', { signal: controller.signal })) {
  if (event.type === 'done' && event.stopReason === 'aborted') console.log('已中断');
}

// 或直接调用:
runtime.abort();
```

## 工具审批

权限系统决定某工具需要审批时,运行时发出 `tool_approval_needed` 事件并暂停:

```typescript
const pending = runtime.getPendingApprovals(); // Map<string, PendingApproval>
for (const [callId, approval] of pending) {
  approval.resolve(true);  // true=允许,false=拒绝
}

// 也可直接按 id 决策:
runtime.approveToolCall(callId);
runtime.rejectToolCall(callId);
```

## 其他 API

- `getMessages()` — 当前完整消息历史(svton `ChatMessage[]`,从 Pi state 翻译)
- `setMessages(messages)` — 重置 Pi state(模型切换/恢复场景)
- `getModel()` / `setReasoningEffort(effort)` / `getReasoningEffort()`
- `setPermissionManager(m)` / `setHookManager(m)` — 重建 ToolExecutionService
- `setSubagentManager(m)` — 循环依赖,创建后注入
- `switchAgentDefinition(name)` — 切换 Agent 定义(提示词/权限/工具过滤)

## 运行模式(AgentMode)

| 模式 | 说明 |
| --- | --- |
| `default` | 读操作自动通过,写操作和命令需审批 |
| `plan` | 只允许只读操作,不修改任何文件 |
| `auto` | 全自动模式,所有操作自动批准(慎用) |

## post-turn 钩子

`runtime-lifecycle.ts` 在每轮 `done` 后执行:

- **记忆抽取**:`memoryManager.extractFromConversation(...)`(fire-and-forget,非致命)
- **checkpoint**:`resumeManager.checkpoint(sessionId, runtime)`——序列化 Pi state
  供会话恢复。`restore()` 通过 `setMessages` 把 Pi state 重新种回新运行时。

## 相关文档

- [index](./index) — agent-core 总览
- [Provider](./provider) — pi-ai 模型/provider 配置
- [工具系统](./tools) — 工具注册与执行
- [权限系统](./permission) — 运行时权限检查
- [会话恢复](./memory) — checkpoint/resume

## 参考

- 设计文档:`docs-internal/design/pi-agent-migration-architecture.md`(§5.2 事件、§5.3 工具)
- [pi-agent-core README](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)
