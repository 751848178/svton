# @svton/agent-sdk

`@svton/agent-sdk` 是 `SvtonAgentRuntime` 的高层入口。它不定义另一套 Agent
消息、工具或事件协议：

- `AgentMessage`、`AgentTool` 来自 Pi Agent；
- `Message`/content 类型来自 pi-ai；
- `chat()` 返回 `PublicRuntimeEvent`，即原生 Pi 生命周期加 Svton capability；
- React 子路径中的 `DisplayMessage`/`ContentBlock` 只是 UI view model。

## 安装

```bash
pnpm add @svton/agent-sdk
```

React 应用还需要：

```bash
pnpm add react react-dom
```

## 创建 Agent

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: 'https://api.openai.com/v1',
  },
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  permission: 'default',
});
```

DeepSeek、Ollama、vLLM 和其他 OpenAI-compatible 服务使用
`type: 'openai'` 配合自己的 `baseUrl`。Anthropic 使用
`type: 'anthropic'`。

## 原生事件

```typescript
for await (const event of agent.chat('分析当前项目')) {
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
    agent.approveToolCall(event.call.id);
  }

  if (event.type === 'agent_end') {
    console.log('settled', event.messages.length);
  }
}
```

顶层流式事件使用 Pi 的 `message_update`。其中内层
`assistantMessageEvent.type === 'text_delta'` 是 Pi assistant stream 的合法
原生事件。

## Agent API

| 方法 | 说明 |
| --- | --- |
| `chat(message)` | 发送 Pi `UserMessage.content` 并返回 `PublicRuntimeEvent` |
| `abort()` | 取消当前 Pi run |
| `approveToolCall(id)` / `rejectToolCall(id)` | 处理 Svton 审批 capability |
| `getMessages()` / `setMessages()` | 读取/恢复 Pi `AgentMessage[]` |
| `reset()` | 清空 canonical state 和运行时瞬态状态 |
| `checkpoint(id)` / `resume(id)` | 保存/恢复 Pi state |
| `addTool(tool)` / `removeTool(name)` | 动态更新 Pi-backed 工具注册表 |
| `addSkill(skill)` / `removeSkill(name)` | 更新 Skills capability |
| `setReasoningEffort(level)` | 更新 Pi thinking level |
| `dispose()` | 断开 MCP 客户端 |

## 自定义工具

`UserToolDefinition` 以 Pi `AgentTool` schema 为基础，只附加 SDK 的执行函数：

```typescript
const agent = await createAgent({
  provider: { type: 'openai', apiKey },
  model: 'gpt-4o',
  tools: [{
    name: 'get_weather',
    description: 'Get weather for a city',
    parameters: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
    execute: async (args) => JSON.stringify(await fetchWeather(args.city)),
  }],
});
```

工具仍经过 permission、approval、auto-review、sandbox、hooks、redaction 和
audit；SDK 工具没有绕过安全管线的快捷路径。

## MCP

```typescript
const agent = await createAgent({
  provider: { type: 'openai', apiKey },
  model: 'gpt-4o',
  mcpServers: [{
    type: 'http',
    url: 'https://mcp.example.com',
    name: 'docs',
    headers: { Authorization: `Bearer ${token}` },
  }],
});
```

MCP 工具桥接为 Pi tools，并使用同一个 Svton 工具安全路径。

## React

```tsx
import { AgentProvider, useChat } from '@svton/agent-sdk/react';

function App() {
  return (
    <AgentProvider config={{
      provider: { type: 'openai', apiKey },
      model: 'gpt-4o',
    }}>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { messages, isStreaming, send, abort } = useChat();
  return (
    <>
      {messages.map((message) => (
        <div key={message.id}>{message.content}</div>
      ))}
      <button onClick={() => send('Hello')} disabled={isStreaming}>Send</button>
      <button onClick={abort}>Abort</button>
    </>
  );
}
```

React `DisplayMessage` 和 `ContentBlock` 是 SDK 自包含的展示类型。它们由
事件消费器投影生成，不写回 Pi canonical transcript。

## 公开类型

基础类型：

- `PiAgentEvent`, `PublicRuntimeEvent`, `SvtonCapabilityEvent`
- `AgentMessage`, `AgentTool`
- `Message`, `UserMessage`, `AssistantMessage`, `ToolResultMessage`
- `SvtonToolDefinition`, `ToolCall`, `ToolResult`, `ToolContext`

React view types：

- `ChatStatus`, `DisplayMessage`, `DisplayToolCall`, `ContentBlock`

## 相关文档

- [React SDK](./react)
- [Core runtime](../core/runtime)
- [Core tools](../core/tools)
