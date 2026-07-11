# @svton/agent-ui, @svton/agent-sdk, @svton/agent-app

The UI surface, the high-level SDK, and the drop-in app. Reach these before building any chat UI or assembling a runtime by hand.

## @svton/agent-sdk — fastest programmatic start

Export hub: `ai/agent-sdk/src/index.ts`. Package v0.3.1. One call, no manual runtime/registry/manager wiring. Subpath export `@svton/agent-sdk/react`.

- `createAgent(config): Promise<Agent>` (`create-agent.ts:66`) — the entry point.
- `Agent` (`agent.ts`) — wraps `AgentRuntime`; `run()` streaming, `abort()` (`:60`), `getMessages()`/`setMessages()` (`:96`/`:101`).
- `FunctionToolExecutor` + `ToolExecuteFn` (`tool-adapter.ts`) — turn a plain function into a tool executor.

### `CreateAgentConfig` (`types.ts:81`)

- `provider: ProviderConfig` — `{ type: 'openai' | 'anthropic', apiKey, ... }`.
- `model: string`.
- `systemPrompt?: string`.
- `tools?: UserToolDefinition[]` — custom tools (function-based).
- `mcpServers?: SdkMcpServerConfig[]`.
- `skills?: SkillDefinition[]`.
- `models?: ModelInfo[]` — override provider defaults.

The SDK also re-exports the common agent-core classes (`AgentRuntime`, `ToolRegistry`, providers, all managers, builtin tool defs/executors) and `BrowserPlatform` for advanced use — so you rarely need to depend on agent-core directly from app code.

## @svton/agent-app — drop-in full app

Export hub: `packages/agent-app/src/index.tsx`. Package v0.3.0. One component, full chat, zero config.

- `AgentApp` (`AgentApp.tsx`) — the one component.
- `AgentShell` (`components/AgentShell.tsx`) — shell layout if you want more control.
- `createAgentConfig` (`lib/create-agent-config.ts`) — build an `AgentConfig` from app props.
- `DefaultSettingsAdapter` (`lib/default-settings-adapter.ts`) — default `ISettingsAdapter` impl.

```tsx
import { AgentApp } from '@svton/agent-app';

function App() {
  return (
    <AgentApp
      providers={[{
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        models: [{ id: 'gpt-4o', name: 'GPT-4o' }]
      }]}
    />
  );
}
```

Key props types (`types.ts`): `AgentAppProps`, `ProviderConfig`, `ModelConfig`, `FeatureFlags`, `ImageProviderConfig`, `SettingsPersistenceConfig`, `StorageConfig`, `IntegrationConfig`, `MarketplaceConfig`, `RuntimeConfig`, `McpServerEntry`, `View`.

## @svton/agent-ui — chat components

Export hub: `packages/agent-ui/src/index.ts`. Package v0.2.x. Tailwind + highlight.js. Pick components à la carte, or compose `ChatPanel`. Pair with `@svton/agent-client` for state.

### Chat core (`components/chat/`)
`ChatPanel`, `ChatMessage`, `ChatInput`, `StreamingText`, `CodeBlock`, `ToolCallCard`, `ToolApprovalModal`, `PlanPanel`, `DocumentCard`, `SplitScreenPanel`, `MarkdownRenderer`, `DiffView`, `TurnSeparator`, `ExportManager`, `ContentEditor`, `LivePreview`, `ResearchReport`, `VersionTabs`.

### ContentBlock renderers (`components/chat/blocks/`)
`PlanBlockView`, `FileChangeView`, `SubagentBlockView`, `WarningBlockView`, `ReferenceBlockView`, `WebSearchBlockView`, `ProgressBlockView`, `TurnDiffView`, `CommandBlockView`, `FileTreeBlockView`, `RedactedThinkingView`. Plus feature blocks `CodeReviewBlock`, `ImageResultBlock`, `CsvFanoutBlock`, `AgentPicker`, `ReasoningEffortSelector`.

### Settings (`components/settings/`)
`SettingsView` (with the `ISettingsAdapter` contract — agents/providers/tools/skills/mcp/memory), `SandboxSettings`, `AutoReviewerSettings`, `IntegrationsPanel`, `AgentEditorPanel`. Layout: `Sidebar`.

### Tool name display
`tool-names.ts` maps tool names → i18n labels (legacy static + `tool.*` keys; MCP tools render as `<server>/<tool>`).

## Decision guide

- **No UI, just an agent in code** → `@svton/agent-sdk` `createAgent()`.
- **Full chat app, minimal code** → `@svton/agent-app` `<AgentApp/>`.
- **Custom chat UI** → `@svton/agent-ui` components + `@svton/agent-client` `AgentProvider`/hooks for state.
- **Desktop with full system access** → `TauriPlatform` (see `references/agent-platform-client.md`) + mirror `apps/agent-desktop/src/lib/agent-setup.ts`.
