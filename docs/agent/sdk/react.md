# React SDK 集成
> React SDK — AgentProvider、useChat、useToolApproval

`@svton/agent-sdk/react` 提供与 React 深度集成的 Provider 和 Hooks，自动管理 Agent 生命周期、消息流式渲染、工具审批状态，无需手动处理 `agent-core` 的底层事件流。

## 安装

```bash
pnpm add @svton/agent-sdk react react-dom
```

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│                   <AgentProvider>                     │
│                                                       │
│   createAgent(config) ──► Agent 实例                  │
│          │                                            │
│          ▼                                            │
│   React Context (AgentContextValue)                   │
│          │                                            │
│     ┌────┼────────────────────┐                       │
│     ▼    ▼                    ▼                       │
│  useAgent()  useChat()   useToolApproval()             │
│     │        │                    │                   │
│     │        │                    │                   │
│     ▼        ▼                    ▼                   │
│  Agent 实例  messages[]      pendingCalls[]            │
│  引用        + status        + approve/reject          │
│              + send()                                 │
│              + abort()                                │
│              + clear()                                │
└─────────────────────────────────────────────────────┘
```

SDK React 模块内部**不依赖** `@svton/agent-client`，它直接消费 `Agent` 类的 `chat()` 异步生成器，使用纯 React `useState` / `useRef` 管理状态。

---

## AgentProvider

React Context Provider，在应用启动时异步创建 Agent 实例，并自动处理生命周期。

### Props

```typescript
export interface AgentProviderProps {
  /** Agent 配置，传递给 createAgent() */
  config: CreateAgentConfig;
  /** Agent 初始化期间显示的内容 */
  fallback?: ReactNode;
  children: ReactNode;
}
```

### 行为

1. **挂载时**：调用 `createAgent(config)` 异步创建 Agent
2. **成功时**：将 Agent 存入 Context state，渲染 children
3. **失败时**：抛出错误，由 Error Boundary 捕获
4. **config 变更时**：自动销毁旧 Agent 并创建新 Agent
5. **卸载时**：调用 `agent.dispose()` 断开 MCP 连接

### 基础用法

```tsx
import { AgentProvider } from '@svton/agent-sdk/react';
import type { CreateAgentConfig } from '@svton/agent-sdk/react';
import { ChatWidget } from './ChatWidget';
import { LoadingScreen } from './LoadingScreen';

const config: CreateAgentConfig = {
  provider: {
    type: 'openai',
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  },
  model: 'gpt-4o',
  systemPrompt: '你是一个友好的客服助手。',
  memory: true,
};

export default function App() {
  return (
    <AgentProvider config={config} fallback={<LoadingScreen />}>
      <ChatWidget />
    </AgentProvider>
  );
}
```

### 在 Next.js 中使用（App Router）

```tsx
// app/providers.tsx
'use client';

import { AgentProvider } from '@svton/agent-sdk/react';
import type { CreateAgentConfig } from '@svton/agent-sdk';

const config: CreateAgentConfig = {
  provider: {
    type: 'anthropic',
    apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY!,
  },
  model: 'claude-sonnet-4-20250514',
  systemPrompt: '你是一个技术文档助手。',
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AgentProvider config={config}>
      {children}
    </AgentProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## useAgent

获取 Agent 实例引用。用于需要直接调用 Agent 方法的场景（如动态注册工具、会话管理）。

```typescript
import { useAgent } from '@svton/agent-sdk/react';

export interface UseAgentReturn {
  /** Agent 实例（初始化期间已保证非 null） */
  agent: Agent;
}
```

### 示例：动态工具管理

```tsx
import { useAgent } from '@svton/agent-sdk/react';
import { useCallback } from 'react';

export function ToolManager() {
  const { agent } = useAgent();

  const addCalculatorTool = useCallback(() => {
    agent.addTool({
      name: 'calculate',
      description: '执行数学计算',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '数学表达式' },
        },
        required: ['expression'],
      },
      execute: async (args) => {
        try {
          const result = eval(args.expression as string);
          return String(result);
        } catch {
          return '计算失败';
        }
      },
    });
  }, [agent]);

  const saveSession = useCallback(async () => {
    await agent.checkpoint(`session-${Date.now()}`);
  }, [agent]);

  return (
    <div>
      <button onClick={addCalculatorTool}>添加计算器工具</button>
      <button onClick={saveSession}>保存会话</button>
    </div>
  );
}
```

---

## useChat

核心聊天 Hook，管理消息累积、流式状态和 Token 用量。

### 返回值

```typescript
export interface UseChatReturn {
  /** 渲染用消息列表 */
  messages: DisplayMessage[];
  /** 当前状态 */
  status: ChatStatus;
  /** 是否正在流式输出（status === 'running'） */
  isStreaming: boolean;
  /** 最近一次运行的 Token 用量 */
  lastUsage: TokenUsage | null;
  /** 发送消息（可附带图片） */
  send: (message: string, images?: Array<{ data: string; mimeType?: string }>) => void;
  /** 中止当前运行 */
  abort: () => void;
  /** 清空所有消息 */
  clear: () => void;
}
```

### ChatStatus

```typescript
export type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';
```

| 状态 | 说明 |
|------|------|
| `idle` | 空闲，等待用户输入 |
| `running` | 正在流式生成回复 |
| `waiting_approval` | 有工具调用等待用户审批 |
| `error` | 运行出错 |

### DisplayMessage

```typescript
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;           // 推理过程（如支持）]
  error?: string;              // 错误信息
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls: DisplayToolCall[];
  blocks: ContentBlock[];      // 结构化内容块
  isStreaming?: boolean;       // 该消息是否正在流式生成
  systemType?: 'default' | 'context_compacted';
  duration?: number;
  timestamp: number;
}
```

### 完整聊天界面示例

```tsx
import { useChat } from '@svton/agent-sdk/react';
import { useRef, useState } from 'react';

export function ChatInterface() {
  const { messages, status, isStreaming, lastUsage, send, abort, clear } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = (reader.result as string).split(',')[1];
      send('请分析这张图片', [{ data, mimeType: file.type }]);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 消息列表 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && <div className="typing-indicator">...</div>}
        {status === 'error' && <div className="error-banner">出错了，请重试</div>}
      </div>

      {/* Token 用量 */}
      {lastUsage && (
        <div style={{ fontSize: '12px', color: '#999', padding: '4px 16px' }}>
          输入: {lastUsage.inputTokens} tokens / 输出: {lastUsage.outputTokens} tokens
        </div>
      )}

      {/* 输入区 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', padding: '16px' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          id="image-upload"
        />
        <label htmlFor="image-upload" className="upload-btn">
          📎
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          style={{ flex: 1 }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button type="button" onClick={abort}>
            停止
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()}>
            发送
          </button>
        )}
        <button type="button" onClick={clear}>
          清空
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="role-label">{isUser ? '你' : '助手'}</div>

      {/* 正文 */}
      <div className="content">{message.content}</div>

      {/* 推理过程 */}
      {message.thinking && (
        <details className="thinking">
          <summary>查看推理过程</summary>
          <pre>{message.thinking}</pre>
        </details>
      )}

      {/* 工具调用 */}
      {message.toolCalls.map((tc) => (
        <ToolCallBadge key={tc.id} toolCall={tc} />
      ))}

      {/* 错误 */}
      {message.error && <div className="error">{message.error}</div>}
    </div>
  );
}

function ToolCallBadge({ toolCall }: { toolCall: DisplayToolCall }) {
  const statusText = {
    running: '运行中...',
    completed: '完成',
    error: '失败',
    pending_approval: '等待审批',
  }[toolCall.status];

  return (
    <div className="tool-call">
      <code>{toolCall.name}</code>
      <span className="status">{statusText}</span>
      {toolCall.result && (
        <details>
          <summary>结果</summary>
          <pre>{toolCall.result.output}</pre>
        </details>
      )}
    </div>
  );
}
```

---

## useToolApproval

从聊天消息中提取所有待审批的工具调用，并提供 approve / reject 回调。

```typescript
export interface UseToolApprovalReturn {
  /** 所有等待审批的工具调用 */
  pendingCalls: DisplayToolCall[];
  /** 批准指定工具调用 */
  approve: (callId: string) => void;
  /** 拒绝指定工具调用 */
  reject: (callId: string) => void;
}
```

### 工具审批弹窗示例

```tsx
import { useToolApproval } from '@svton/agent-sdk/react';

export function ToolApprovalModal() {
  const { pendingCalls, approve, reject } = useToolApproval();

  if (pendingCalls.length === 0) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>工具调用审批</h3>
        <p>以下工具需要您的确认才能执行：</p>

        {pendingCalls.map((call) => (
          <div key={call.id} className="approval-item">
            <div className="tool-name">
              <strong>{call.name}</strong>
            </div>
            <div className="tool-args">
              <pre>{JSON.stringify(call.arguments, null, 2)}</pre>
            </div>
            <div className="approval-buttons">
              <button
                className="approve-btn"
                onClick={() => approve(call.id)}
              >
                允许
              </button>
              <button
                className="reject-btn"
                onClick={() => reject(call.id)}
              >
                拒绝
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

与聊天界面组合使用：

```tsx
import { AgentProvider } from '@svton/agent-sdk/react';
import { ChatInterface } from './ChatInterface';
import { ToolApprovalModal } from './ToolApprovalModal';

export function App() {
  return (
    <AgentProvider config={agentConfig}>
      <ChatInterface />
      <ToolApprovalModal />
    </AgentProvider>
  );
}
```

---

## 类型导出

SDK React 模块导出以下类型：

```typescript
// Provider
export type { AgentProviderProps };

// Hooks 返回值
export type { UseAgentReturn, UseChatReturn, UseToolApprovalReturn };

// 消息相关
export type { ChatStatus, DisplayMessage, DisplayToolCall, ContentBlock };

// 配置类型（从 SDK 主入口再导出）
export type { CreateAgentConfig, UserToolDefinition, ProviderConfig, SdkMcpServerConfig };
```

---

## 完整集成示例：带自定义平台的桌面应用

以下示例展示在 Tauri 桌面应用中使用 React SDK 的完整集成：

```tsx
import { AgentProvider, useChat, useToolApproval } from '@svton/agent-sdk/react';
import { TauriPlatform, setPlatform } from '@svton/agent-platform';
import type { CreateAgentConfig } from '@svton/agent-sdk';

// 步骤 1：设置平台
const tauriPlatform = new TauriPlatform();
setPlatform(tauriPlatform);

// 步骤 2：配置 Agent
const config: CreateAgentConfig = {
  provider: {
    type: 'anthropic',
    apiKey: 'sk-ant-xxx',
  },
  model: 'claude-sonnet-4-20250514',
  systemPrompt: '你是一个桌面助手，可以读写文件和执行命令。',
  platform: tauriPlatform,    // 显式传入 Tauri 平台
  memory: true,
  planning: true,
  permission: 'default',
  maxIterations: 50,
  workingDir: '/home/user/workspace',
  mcpServers: [
    {
      name: 'filesystem',
      type: 'http',
      url: 'http://localhost:3001/mcp',
    },
  ],
};

// 步骤 3：渲染
export function DesktopApp() {
  return (
    <AgentProvider config={config} fallback={<div>正在初始化...</div>}>
      <MainLayout />
    </AgentProvider>
  );
}

function MainLayout() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', height: '100vh' }}>
      <Sidebar />
      <ChatPanel />
      <ApprovalLayer />
    </div>
  );
}
```

---

## 注意事项

1. **AgentProvider 必须是祖先组件** — `useChat` / `useAgent` / `useToolApproval` 都依赖 Context，在 Provider 外调用会抛出错误
2. **config 变更会重建 Agent** — 如果 config 对象引用变化，会触发销毁 + 重建，建议使用 `useMemo` 包裹 config
3. **内存管理** — Provider 自动在卸载时调用 `dispose()`，断开所有 MCP 连接
4. **并发安全** — `send()` 在 `isStreaming` 期间调用会被忽略，需在 UI 层禁用发送按钮

---

## 下一步

- [Agent SDK 核心 API](./index) — createAgent / Agent 类 / 自定义工具
- [agent-platform](../platform) — 平台抽象层详解
- [agent-ui](../ui) — 预构建的 UI 组件库（基于本 React SDK）
