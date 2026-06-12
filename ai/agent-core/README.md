# @svton/agent-core

Core runtime for Svton AI Agent. Provides a ReAct loop with tool execution, context management, multi-provider LLM support, MCP protocol, skills, memory, permissions, planning, subagents, and plugins.

## Install

```bash
npm install @svton/agent-core
```

## Quick Start

```typescript
import {
  AgentRuntime, OpenAIProvider, ToolRegistry, setPlatform
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';

setPlatform(new BrowserPlatform());

const provider = new OpenAIProvider({
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-xxx',
  models: [{
    id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000,
    supportsToolUse: true, supportsVision: true, supportsStreaming: true,
  }],
});

const registry = new ToolRegistry();
registry.register(webSearchDef, new WebSearchExecutor());

const runtime = AgentRuntime.create({
  provider, model: 'gpt-4o', toolRegistry: registry,
});

const stream = runtime.run('Hello, what can you do?');
for await (const event of stream) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
  if (event.type === 'done') console.log('\nDone');
}
```

## Features

- **ReAct Loop** — Think → Act (tool call) → Observe → Think → ...
- **Multi-Provider** — OpenAI (and compatible: DeepSeek, Ollama, vLLM) + Anthropic
- **Tool System** — 20+ built-in tools (file, shell, web, memory, planning, computer use, Chrome CDP)
- **MCP Protocol** — Connect external tool servers via HTTP, SSE, or Stdio
- **Skills** — Discover and inject context-aware instructions
- **Memory** — Project-level (AGENT.md) + auto memory (IStorage)
- **Permissions** — 5 modes (read_only → auto) with rule engine
- **Hooks** — 8 lifecycle events (pre/post tool, session, etc.)
- **Planning** — Multi-step plans with dependency tracking
- **Subagents** — Spawn isolated agents with restricted toolsets
- **Plugins** — Install from directory or Git

## Providers

### OpenAI Compatible

```typescript
new OpenAIProvider({
  baseUrl: 'https://api.openai.com',  // or DeepSeek, Ollama, etc.
  apiKey: 'sk-xxx',
  models: [/* ModelInfo[] */],
})
```

### Anthropic

```typescript
new AnthropicProvider({
  apiKey: 'sk-ant-xxx',
  // Default models: claude-sonnet-4, claude-haiku-4
})
```

## Built-in Tools

| Category | Tools | Browser |
|----------|-------|---------|
| File | `file_read`, `file_write`, `file_edit` | No |
| Search | `grep`, `glob` | No |
| Shell | `bash` | No |
| Web | `web_search`, `web_fetch` | Yes |
| Memory | `memory_save`, `memory_recall` | Yes |
| Planning | `plan_create`, `plan_update_step`, `plan_get_status` | Yes |
| Computer Use | `screenshot`, `mouse_click`, `mouse_move`, `keyboard_type`, `keyboard_press_key` | Tauri only |
| Chrome CDP | `chrome_navigate`, `chrome_screenshot`, `chrome_click`, `chrome_type`, `chrome_evaluate`, `chrome_get_content` | Browser only |

## Agent Events

The `run()` method returns an `AsyncGenerator<AgentEvent>`:

- `text_delta` — LLM text output
- `thinking_delta` — Chain-of-thought (DeepSeek / Claude)
- `tool_call_start` / `tool_call_progress` / `tool_call_end` — Tool execution
- `tool_approval_needed` — Awaiting user approval
- `context_compacted` — Context window compression
- `done` — Run complete with token usage
- `error` — Runtime error

## License

MIT
