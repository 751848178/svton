# @svton/agent-client

React integration layer for Svton AI Agent. Provides reactive services (`@svton/service` based) for chat, sessions, and projects with React hooks.

> **For external projects**, consider using [`@svton/agent-sdk`](https://www.npmjs.com/package/@svton/agent-sdk) which offers a simpler API without the `@svton/service` dependency.

## Install

```bash
npm install @svton/agent-client
```

## Usage

```tsx
import { AgentProvider, useChat, useSession, useToolApproval } from '@svton/agent-client';
import { BrowserPlatform, setPlatform } from '@svton/agent-platform';

setPlatform(new BrowserPlatform());

function App() {
  return (
    <AgentProvider platform={platform} config={agentConfig}>
      <ChatView />
    </AgentProvider>
  );
}

function ChatView() {
  const { messages, status, send, abort } = useChat();
  const { pendingCalls, approve, reject } = useToolApproval();

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
      {pendingCalls.map(call => (
        <div key={call.id}>
          <span>{call.name}</span>
          <button onClick={() => approve(call.id)}>Allow</button>
          <button onClick={() => reject(call.id)}>Deny</button>
        </div>
      ))}
      <button onClick={() => send('Hello')} disabled={status === 'running'}>
        Send
      </button>
    </div>
  );
}
```

## Services

### ChatService

Observable reactive service for chat state management.

- `messages`, `status`, `currentModel`, `lastUsage`, `activePlan` — reactive state
- `sendMessage(content, images?)` — send user message with optional images
- `retry()` / `retryFromMessage(id)` / `editMessage(id, content)` — regeneration
- `approveToolCall(id)` / `rejectToolCall(id)` — tool approval
- `abort()` — cancel current run
- Background streaming support when switching sessions mid-stream

### SessionService

Multi-session persistence via `IStorage`.

- `create()`, `loadSession()`, `saveSession()`, `delete()`, `switchTo()`
- Automatic corrupted session list recovery

### ProjectService

Project management with session association.

- `createProject()`, `deleteProject()`, `switchProject()`

## Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useChat()` | `{ messages, status, isStreaming, send, retry, abort, ... }` | Chat interaction |
| `useSession()` | `{ sessions, create, delete, switchTo, ... }` | Session lifecycle |
| `useAgent()` | `{ platform, chatService, sessionService, isConnected }` | Service instances |
| `useToolApproval()` | `{ pendingCalls, hasPending, approve, reject }` | Tool approval |

## License

MIT
