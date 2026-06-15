# @svton/agent-client

React 集成层 — 连接 agent-core 和 agent-ui，提供 Hooks 和 Service。

## 安装

```bash
pnpm add @svton/agent-client @svton/agent-core @svton/agent-ui
```

## 模块导航

| 模块 | 说明 |
|------|------|
| [React Hooks](./hooks) | useChat / useSession / useAgent / useToolApproval |
| [Service 层](./services) | ChatService / SessionService / ProjectService |

## 快速开始

```tsx
import { AgentProvider, useChat } from '@svton/agent-client';
import { ChatPanel } from '@svton/agent-ui';

function App({ config, platform }) {
  return (
    <AgentProvider config={config} platform={platform}>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { messages, isStreaming, send, abort } = useChat();
  return <ChatPanel messages={messages} onSend={send} onAbort={abort} isStreaming={isStreaming} />;
}
```
