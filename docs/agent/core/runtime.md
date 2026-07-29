# SvtonAgentRuntime

`SvtonAgentRuntime` 是 svton 对 Pi Agent 的组合根。Pi 是模型、消息状态、
Agent 循环、工具调度和基础生命周期的唯一所有者；svton 只在它周围组合产品、
安全与平台能力。

## 所有权边界

| 层 | 所有内容 |
| --- | --- |
| `@earendil-works/pi-ai` | provider/model 注册、请求与流解析、`Message` 内容 |
| `@earendil-works/pi-agent-core` | `Agent`、`AgentMessage[]`、续轮、工具调度、原生生命周期 |
| `@svton/agent-core` | 权限、审批、自动审查、沙箱、hooks、MCP、Skills、Memory、Planning、Subagents、Checkpoint |
| `@svton/agent-client` | Session/Display DTO，以及唯一的 Pi→Display 投影 |
| `@svton/agent-app` | Client Display→UI 的显式渲染投影 |

运行时内存中的对话事实只存在于 Pi `Agent.state.messages`。Display/Session
对象用于持久化和渲染，不会反向成为另一套运行时协议。

## 创建运行时

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
    workingDir: '/workspace',
  },
  new BrowserPlatform(),
);
```

有 MCP 客户端时使用 `createAsync()`，它会先桥接工具。没有异步装配需求时可用
`create()`。

## AgentConfig

```typescript
interface AgentConfig {
  models: Models;
  piModel?: Model;
  model: string;
  toolRegistry: ToolRegistry;
  systemPrompt?: string;
  initialMessages?: AgentMessage[];
  contextConfig?: Partial<ContextConfig>;
  maxIterations?: number;
  workingDir?: string;
  capabilities?: AgentCapabilities;
  reasoningEffort?: ReasoningEffort;
}
```

`initialMessages` 直接种入 Pi state。工具定义基于 Pi `AgentTool`，svton 只附加
安全注解和来源元数据。

## 原生事件协议

`run()` 返回 `AsyncGenerator<PublicRuntimeEvent>`：

```typescript
type PublicRuntimeEvent = PiAgentEvent | SvtonCapabilityEvent;
```

`PiAgentEvent` 是上游 Pi `AgentEvent` 的公开别名。下列 Pi 事件对象会原样穿过
运行时，不会被改名或翻译：

- Agent：`agent_start`、`agent_end`
- Turn：`turn_start`、`turn_end`
- Message：`message_start`、`message_update`、`message_end`
- Tool：`tool_execution_start`、`tool_execution_update`、`tool_execution_end`

流式文本和 thinking 位于 `message_update.assistantMessageEvent`。工具结果位于
Pi 的 `tool_execution_end` 和 canonical `toolResult` message 中。

svton 仅增加四种 capability event：

- `tool_approval_needed`
- `context_compacted`
- `warning`
- `skill_activated`

```typescript
for await (const event of runtime.run('检查当前变更')) {
  if (
    event.type === 'message_update'
    && event.assistantMessageEvent.type === 'text_delta'
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }

  if (event.type === 'tool_execution_update') {
    console.log(event.toolName, event.partialResult);
  }

  if (event.type === 'tool_approval_needed') {
    runtime.approveToolCall(event.call.id);
  }

  if (event.type === 'agent_end') {
    console.log('Pi run settled', event.messages.length);
  }
}
```

注意：内层 `assistantMessageEvent.type === 'text_delta'` 是 Pi 的原生 assistant
流事件，不是 svton 的顶层事件。

## 结算、取消与并发

- 同一 runtime 同时只允许一个 prompt。
- `AbortSignal` 只取消它捕获的那次 Pi run；旧 run 不能终止新 run。
- 消费者提前停止读取 generator 时，runtime 会取消并等待对应 run 进入 idle。
- `agent_end` 监听器属于结算的一部分。Memory extraction 和 Checkpoint 会在
  generator 完成前被等待。
- approval wait 在 abort、reject 或 run teardown 时释放，不留下悬挂 promise。

```typescript
const controller = new AbortController();
const stream = runtime.run('长任务', { signal: controller.signal });
controller.abort();
for await (const event of stream) {
  // 最终仍按 Pi 原生生命周期完成排空。
}
```

## Canonical message API

```typescript
const messages = runtime.getMessages(); // AgentMessage[]
runtime.setMessages(messages);
runtime.rollbackCanonicalMessages(index);
runtime.reset();
```

`getMessages()` 返回 Pi canonical state 的浅拷贝。Retry/Edit 通过
`rollbackCanonicalMessages()` 回滚到记录的 canonical index；Clear 和新会话
通过 `reset()` 清除 Pi state、审批和 capability sink。

## 工具安全路径

Pi 负责 schema 校验、批次、`executionMode`、进度与续轮。每个工具执行都经过
同一个 `ToolExecutionService`：

```
abort → pre hook → skill gate → permission → auto review → approval
      → sandbox/platform execute → redaction/audit → post hook
```

MCP、Subagent 和内置工具都使用这条路径。`ToolExecutionService` 只返回
`ToolResult` 并产生 capability event；工具基础生命周期只由 Pi 发出。

## 相关文档

- [Provider 与模型](./provider)
- [工具系统](./tools)
- [权限](./permission)
- [MCP](./mcp)
- [Client 服务](../client/services)
