# @svton/agent-ui

React component library for AI agent chat interfaces.

## Install

```bash
npm install @svton/agent-ui
```

## Components

### ChatPanel

Full chat surface with messages list + input.

```tsx
import { ChatPanel, type ChatPanelMessage } from '@svton/agent-ui';

<ChatPanel
  messages={messages}
  isStreaming={false}
  onSend={(text) => sendMessage(text)}
  onAbort={() => abort()}
  slashCommands={[
    { name: 'help', description: 'Show help', action: () => {} },
  ]}
/>
```

### ChatMessage

Individual message renderer with blocks, tool calls, thinking.

```tsx
import { ChatMessage } from '@svton/agent-ui';

<ChatMessage
  id="msg1"
  role="assistant"
  content="Hello!"
  blocks={[{ type: 'text', text: 'Hello!' }]}
/>
```

### SplitScreenPanel

Side panel for document/code preview.

```tsx
import { SplitScreenPanel, type SplitScreenContent } from '@svton/agent-ui';

<SplitScreenPanel
  content={{ type: 'document', title: 'Report', content: '# Hello' }}
  onClose={() => setPanel(null)}
/>
```

### SettingsView

Full settings page with adapter pattern.

```tsx
import { SettingsView, type ISettingsAdapter } from '@svton/agent-ui';

class MyAdapter implements ISettingsAdapter {
  getProviders() { return [...]; }
  getDefaultModel() { return 'gpt-4o'; }
  // ... implement all methods
}

<SettingsView adapter={new MyAdapter()} onBack={() => {}} />
```

### Block Components

Specialized content blocks rendered inside ChatMessage:

| Component | Description |
|-----------|-------------|
| `PlanBlockView` | Multi-step plan progress |
| `FileChangeView` | File diff display |
| `SubagentBlockView` | Sub-agent task status |
| `WarningBlockView` | Warning messages |
| `ReferenceBlockView` | File references |
| `WebSearchBlockView` | Search results |
| `ProgressBlockView` | Progress indicators |
| `TurnDiffView` | Aggregated turn changes |
| `CommandBlockView` | Action buttons |
| `FileTreeBlockView` | Directory tree |
| `CodeReviewBlock` | Code review findings |
| `ImageResultBlock` | Generated images |
| `CsvFanoutBlock` | CSV batch results |

### Other Exports

| Export | Description |
|--------|-------------|
| `ReasoningEffortSelector` | Dropdown for LLM reasoning intensity |
| `AgentPicker` | Agent definition switcher |
| `ToolCallCard` | Tool invocation display |
| `ToolApprovalModal` | Permission approval dialog |
| `MarkdownRenderer` | Markdown with syntax highlighting |
| `CodeBlock` | Syntax-highlighted code |
| `DiffView` | Unified diff display |
| `DocumentCard` | Collapsible document card |
| `ExportManager` | Export to MD/HTML/PDF |
| `StreamingText` | Animated streaming text |
| `SandboxSettings` | Sandbox configuration |
| `AutoReviewerSettings` | Auto-reviewer configuration |
| `IntegrationsPanel` | Third-party integration cards |
| `AgentEditorPanel` | Custom agent editor |

## License

MIT
