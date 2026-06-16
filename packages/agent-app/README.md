# @svton/agent-app

Out-of-the-box AI agent application. One component, full chat capability, zero configuration.

## Install

```bash
npm install @svton/agent-app reflect-metadata
# or
pnpm add @svton/agent-app reflect-metadata
```

## Quick Start

```tsx
import 'reflect-metadata';
import { AgentApp } from '@svton/agent-app';

export default function App() {
  return (
    <AgentApp
      providers={[{
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        models: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        ],
      }]}
    />
  );
}
```

That's it. You get a full AI agent with:
- Streaming chat with tool use
- Multi-model switching
- Permission modes (read-only / default / accept-edits / auto)
- Reasoning effort control (low / medium / high / xhigh)
- Image generation
- Code review (`/review`)
- Document preview (split-screen)
- Session management (create / switch / delete)
- Memory system
- Planning system
- Settings page (provider config, tool toggles, skills)
- localStorage persistence

## Multi-Provider

```tsx
<AgentApp
  providers={[
    {
      type: 'openai',
      apiKey: 'sk-...',
      models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
    },
    {
      type: 'anthropic',
      apiKey: 'sk-ant-...',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
      ],
    },
  ]}
  defaultModel="gpt-4o"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `providers` | `ProviderConfig[]` | Yes | LLM provider configs |
| `defaultModel` | `string` | No | Initial model ID |
| `systemPrompt` | `string` | No | Extra system prompt |
| `searchEndpoint` | `string` | No | Web search API endpoint |
| `features` | `FeatureFlags` | No | Toggle individual features |
| `skills` | `SkillDefinition[]` | No | Custom skills |
| `mcpServers` | `McpServerEntry[]` | No | MCP server configs (HTTP/SSE) |
| `title` | `string` | No | App title (default: "Svton Agent") |
| `maxIterations` | `number` | No | ReAct loop limit (default: 50) |
| `contextConfig` | `object` | No | Context window config |

## Feature Flags

```tsx
<AgentApp
  providers={[...]}
  features={{
    imageGeneration: false,  // disable image gen
    codeReview: true,        // enable code review
    documentPreview: true,
    webSearch: false,
    sessionResume: true,
    agentDefinitions: true,
  }}
/>
```

## Architecture

```
@svton/agent-app
  ├── AgentApp          — main component (init + state)
  ├── AgentShell        — layout (sidebar + chat + settings)
  ├── createAgentConfig — wires 14+ tools/managers
  └── DefaultSettingsAdapter — localStorage persistence
```

Built on:
- `@svton/agent-core` — runtime engine
- `@svton/agent-client` — React hooks + services
- `@svton/agent-ui` — UI components
- `@svton/service` — reactive state management

## License

MIT
