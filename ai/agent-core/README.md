# @svton/agent-core

Core runtime for the Svton AI Agent. Built on top of
[`@earendil-works/pi-ai`](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md)
(provider/model/stream layer) and
[`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)
(Agent loop layer), with svton's product-specific tool system, capability
managers and security pipeline layered on top.

## Architecture

svton does **not** reimplement the LLM wire protocol or the ReAct loop. Instead
`SvtonAgentRuntime` is a composition root over pi-agent-core's `Agent`:

- **pi-ai** owns OpenAI/Anthropic registration, SSE/JSON parsing, auth and
  reasoning-effort mapping. svton calls `models.streamSimple` directly.
- **pi-agent-core** owns the agent loop, continuation, abort, message source of
  truth and tool-call scheduling.
- **agent-core** owns the credential-store boundary, approval gate, context
  compaction, native Pi event multiplexing, and the product capabilities
  (tools, skills, memory, MCP, subagents, planning, permissions, hooks,
  auto-review, checkpoints).

See `docs-internal/design/pi-agent-migration-architecture.md` for the full
design. Public docs live under `docs/agent/core/`.

## Install

```bash
npm install @svton/agent-core
```

## Quick Start

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

for await (const event of runtime.run('Hello, what can you do?')) {
  if (event.type === 'agent_end') console.log('Turn settled');
}
```

## Features

- **Pi-backed Agent loop** — `SvtonAgentRuntime` composes pi-agent-core's `Agent`
- **Multi-Provider via pi-ai** — OpenAI (+ DeepSeek, Ollama, vLLM, Azure) and Anthropic, configured through `createPiModelsForProvider`
- **Tool System** — 30+ built-in tools (file, shell, web, memory, planning, computer use, Chrome CDP, image gen)
- **MCP Protocol** — Connect external tool servers via HTTP, SSE, or Stdio
- **Skills** — Discover and inject context-aware instructions
- **Memory** — Project-level (AGENT.md) + auto memory (IStorage)
- **Permissions** — 5 modes (read_only → auto) with rule engine
- **Hooks** — 8 lifecycle events (pre/post tool, session, etc.)
- **Planning** — Multi-step plans with dependency tracking
- **Subagents** — Spawn isolated agents with restricted toolsets
- **Auto-reviewer** — Pre-execution review of mutating tool calls
- **Session checkpoint/resume** — Pi state serialized and re-seeded on restore
- **Plugins** — Install from directory or Git

## Providers

svton no longer ships `OpenAIProvider`/`AnthropicProvider` classes. Build a
pi-ai `Models` collection via `createPiModelsForProvider`:

```typescript
// OpenAI (or compatible: DeepSeek, Ollama, vLLM, Azure)
createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.openai.com/v1', // optional override
});

// Anthropic
createPiModelsForProvider('claude-sonnet-4-20250514', {
  family: 'anthropic',
  apiKey: 'sk-ant-xxx',
});
```

## Agent Events

`run()` returns an `AsyncGenerator<PublicRuntimeEvent>`.
`PiAgentEvent` is the exported name for upstream pi-agent-core `AgentEvent`,
and the public contract is:

```typescript
type PublicRuntimeEvent = PiAgentEvent | SvtonCapabilityEvent;
```

Pi events pass through unchanged and own agent, turn, message, streaming, tool
execution, failure, abort and settlement lifecycles. Svton capability events
(`tool_approval_needed`, `context_compacted`, `warning`, `skill_activated`)
cover product behavior Pi does not own. See `docs/agent/core/runtime.md`.

## License

MIT
