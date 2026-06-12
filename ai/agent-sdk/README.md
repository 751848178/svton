# @svton/agent-sdk

High-level SDK for creating AI Agents with a single `createAgent()` call. Supports OpenAI, Anthropic, and compatible providers. Includes optional React integration via `/react` sub-path.

## Install

```bash
npm install @svton/agent-sdk
```

## Quick Start

### Programmatic (10 lines)

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: { type: 'openai', apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com' },
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
});

for await (const event of agent.chat('Hello!')) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
}

await agent.dispose();
```

### React

```bash
npm install @svton/agent-sdk react react-dom
```

```tsx
import { AgentProvider, useChat } from '@svton/agent-sdk/react';

function App() {
  return (
    <AgentProvider config={{
      provider: { type: 'openai', apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com' },
      model: 'gpt-4o',
    }}>
      <ChatView />
    </AgentProvider>
  );
}

function ChatView() {
  const { messages, isStreaming, send } = useChat();
  return (
    <div>
      {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
      <button onClick={() => send('Hello')} disabled={isStreaming}>Send</button>
    </div>
  );
}
```

## Custom Tools

```typescript
const agent = await createAgent({
  provider: { /* ... */ },
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

## MCP Servers

```typescript
const agent = await createAgent({
  // ...
  mcpServers: [{
    url: 'https://mcp.example.com/sse',
    type: 'sse',
    name: 'external-tools',
  }],
});
```

## Agent API

| Method | Description |
|--------|-------------|
| `chat(message)` | Start conversation, returns `AsyncGenerator<AgentEvent>` |
| `abort()` | Cancel current conversation |
| `approveToolCall(id)` | Approve a pending tool call |
| `rejectToolCall(id)` | Reject a pending tool call |
| `getMessages()` | Get conversation history |
| `setMessages(msgs)` | Restore conversation history |
| `addTool(tool)` | Add tool at runtime |
| `removeTool(name)` | Remove tool at runtime |
| `addSkill(skill)` | Add skill at runtime |
| `removeSkill(name)` | Remove skill at runtime |
| `dispose()` | Release resources |

## React Hooks (`@svton/agent-sdk/react`)

| Hook | Returns |
|------|---------|
| `useChat()` | `{ messages, status, isStreaming, send, abort, clear }` |
| `useAgent()` | `{ agent }` |
| `useToolApproval()` | `{ pendingCalls, approve, reject }` |

## Configuration

```typescript
await createAgent({
  provider: { type: 'openai' | 'anthropic', apiKey, baseUrl? },
  model: 'gpt-4o',
  systemPrompt?: string,
  tools?: UserToolDefinition[],
  mcpServers?: SdkMcpServerConfig[],
  memory?: boolean,          // enable auto-memory (default: false)
  planning?: boolean,        // enable plan tools (default: false)
  permission?: 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto',
  hooks?: Record<HookEvent, HookHandler>,
  skills?: SkillDefinition[],
  maxIterations?: number,    // default: 50
  workingDir?: string,
});
```

## Compatible Providers

- **OpenAI** — GPT-4o, GPT-4o-mini, etc.
- **Anthropic** — Claude Sonnet 4, Claude Haiku 4
- **DeepSeek** — DeepSeek Chat, DeepSeek Reasoner
- **Ollama** — Local models
- **vLLM** — Self-hosted models
- **LiteLLM** — Unified proxy

## License

MIT
