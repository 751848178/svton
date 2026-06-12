# @svton/agent-client

> React 集成层 — 基于 `@svton/service` 的响应式服务层，提供 ChatService、SessionService、ProjectService 和 React Hooks。

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/agent-client` |
| **版本** | `0.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |
| **依赖** | `@svton/agent-core`, `@svton/agent-platform`, `@svton/service` |
| **Peer 依赖** | `react ^18.0.0 || ^19.0.0`, `react-dom`, `reflect-metadata` |

> **注意**: 此包面向内部应用（agent-desktop / agent-web）。外部项目推荐使用 `@svton/agent-sdk`，它提供更简洁的 API 且不依赖 `@svton/service`。

---

## 🎯 设计原则

1. **响应式** — 基于 `@svton/service` 的 `@observable` / `@computed` 装饰器，状态变更自动触发 React 重渲染
2. **会话管理** — 内置多会话支持、自动保存、后台流式
3. **项目隔离** — Project 级别的会话分组
4. **Scoped 容器** — 每个 AgentProvider 创建独立的 DI 容器

---

## 📁 目录结构

```
agent-client/src/
├── service/
│   ├── chat.service.ts       # ChatService — 聊天核心
│   ├── session.service.ts    # SessionService — 会话管理
│   ├── project.service.ts    # ProjectService — 项目管理
│   └── provider.tsx          # AgentProvider + useAgentContext
├── hooks/
│   ├── useChat.ts            # useChat() — 消息/状态/发送
│   ├── useSession.ts         # useSession() — 会话生命周期
│   ├── useAgent.ts           # useAgent() — 服务实例
│   └── useTool.ts            # useToolApproval() — 工具审批
├── types.ts                  # 所有类型定义
└── index.ts                  # 导出入口
```

---

## 🏗️ 架构概览

```
AgentProvider (React Context)
  ├── creates scoped @svton/service container
  ├── resolves ChatService (@observable 状态)
  ├── resolves SessionService (@observable 状态)
  ├── resolves ProjectService (@observable 状态)
  │
  ├── ChatService
  │   └── uses AgentRuntime (@svton/agent-core) for streaming
  ├── SessionService
  │   └── uses IStorage (@svton/agent-platform) for persistence
  └── ProjectService
      └── uses IStorage for persistence

Hooks:
  ├── useChat()        → subscribes to ChatService observables
  ├── useSession()     → bridges SessionService + ChatService lifecycle
  ├── useAgent()       → returns service instances
  └── useToolApproval() → subscribes to pending tool calls
```

---

## 📖 API 参考

### 1. AgentProvider

React Context Provider，创建 scoped 服务实例。

```tsx
import { AgentProvider } from '@svton/agent-client';

function App() {
  return (
    <AgentProvider platform={platform} config={agentConfig}>
      <ChatView />
    </AgentProvider>
  );
}
```

**Props (`AgentProviderProps`):**

| Prop | 类型 | 说明 |
|------|------|------|
| `platform` | `IPlatform` | 平台实例 |
| `config` | `AgentConfig` | Agent 配置（来自 @svton/agent-core） |
| `children` | `ReactNode` | 子组件 |

**行为：**
- 创建 scoped `@svton/service` 容器
- 初始化 ChatService、SessionService、ProjectService
- 同 config 引用不重新创建（幂等）
- `config` 或 `platform.storage` 变更时重新初始化

### useAgentContext()

获取内部服务引用，必须在 `AgentProvider` 内使用。

```typescript
import { useAgentContext } from '@svton/agent-client';

const {
  platform,         // IPlatform
  chatService,      // ChatService 实例
  sessionService,   // SessionService 实例
  projectService,   // ProjectService 实例
  chatInternal,     // InternalLike<ChatService> — 响应式订阅
  sessionInternal,  // InternalLike<SessionService>
  projectInternal,  // InternalLike<ProjectService>
} = useAgentContext();
```

---

### 2. ChatService

聊天核心服务，基于 `@svton/service` 的 `@observable` 响应式状态管理。

#### 可观察状态

| 属性 | 类型 | 说明 |
|------|------|------|
| `messages` | `DisplayMessage[]` | 当前会话的消息列表 |
| `status` | `ChatStatus` | 状态：`idle` / `running` / `waiting_approval` / `error` |
| `currentModel` | `string` | 当前模型 ID |
| `lastUsage` | `TokenUsage \| null` | 最近一次 Token 使用量 |
| `activePlan` | `PlanProgress \| null` | 当前活跃的计划进度 |
| `activeSessionId` | `string \| null` | 当前绑定的会话 ID |

#### 计算属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `isStreaming` | `boolean` | `status === 'running'` |
| `hasPendingApprovals` | `boolean` | 有待审批的工具调用 |

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(platform, config) => Promise<void>` | 初始化 Runtime（幂等，同模型跳过） |
| `sendMessage` | `(content, images?) => Promise<void>` | 发送用户消息（支持图片） |
| `retry` | `() => Promise<void>` | 移除最后助手消息并重新生成 |
| `retryFromMessage` | `(messageId) => Promise<void>` | 从指定消息重试 |
| `editMessage` | `(messageId, newContent) => Promise<void>` | 编辑消息并重新生成 |
| `abort` | `() => void` | 中止当前运行 |
| `abortIfStreaming` | `() => boolean` | 仅在流式时中止 |
| `approveToolCall` | `(callId) => void` | 批准工具调用 |
| `rejectToolCall` | `(callId) => void` | 拒绝工具调用 |
| `bindSession` | `(sessionId \| null) => void` | 绑定到指定会话 |
| `cacheSessionMessages` | `(sessionId, messages) => void` | 缓存会话消息 |
| `getCachedMessages` | `(sessionId) => DisplayMessage[] \| undefined` | 获取缓存消息 |
| `getMessagesForSave` | `() => DisplayMessage[]` | 获取可保存消息（排除 system / streaming） |
| `getMessagesForSessionSave` | `(sessionId) => DisplayMessage[]` | 获取任意会话的可保存消息 |
| `clearMessages` | `() => void` | 清空所有状态 |
| `loadMessages` | `(messages) => void` | 从存储加载消息 |
| `isSessionStreaming` | `(sessionId) => boolean` | 检查指定会话是否在后台流式 |

#### 事件处理

ChatService 处理所有 `AgentEvent` 类型：

| 事件 | 处理 |
|------|------|
| `text_delta` | 追加到助手消息 content |
| `thinking_delta` | 追加到 thinking（多轮迭代插入 `---` 分隔符） |
| `tool_call_start` | 创建 DisplayToolCall (status=running) |
| `tool_call_progress` | 更新工具参数 |
| `tool_call_end` | 更新工具结果 + 跟踪计划进度 |
| `tool_approval_needed` | 设置 waiting_approval 状态 |
| `context_compacted` | 添加 system 消息 |
| `error` | 追加错误信息 |
| `done` | 更新 Token 使用量 |

#### 后台流式

当用户在流式进行中切换会话时：
- 当前会话继续在后台运行
- 消息更新写入缓存而非 `this.messages`
- `onBackgroundStreamEnd` 回调通知上层

---

### 3. SessionService

基于 `IStorage` 的会话持久化管理。

#### 可观察状态

| 属性 | 类型 | 说明 |
|------|------|------|
| `sessions` | `SessionInfo[]` | 会话列表 |
| `currentSessionId` | `string \| null` | 当前活跃会话 |
| `ready` | `boolean` | 初始化是否完成 |

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(storage) => Promise<void>` | 初始化并加载会话列表 |
| `create` | `(title?, model?, projectId?) => Promise<string>` | 创建新会话，返回 ID |
| `loadSession` | `(id) => Promise<SessionData \| null>` | 加载完整会话数据 |
| `saveSession` | `(data) => Promise<void>` | 保存会话 |
| `delete` | `(id) => Promise<void>` | 删除会话 |
| `switchTo` | `(id) => void` | 切换会话 |
| `updateProjectId` | `(sessionId, projectId?) => Promise<void>` | 更新会话关联项目 |
| `updateSessionInfo` | `(id, updates) => Promise<void>` | 更新会话元数据 |

#### 类型

```typescript
interface SessionInfo {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

interface SessionData {
  id: string;
  title: string;
  model: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}
```

**安全特性：**
- 损坏的会话列表（>200 条或无效条目）自动重置
- 异步 I/O 在 observable 变更前完成，防止级联重渲染

---

### 4. ProjectService

项目管理服务。

#### 可观察状态

| 属性 | 类型 | 说明 |
|------|------|------|
| `projects` | `Project[]` | 所有项目列表 |
| `currentProjectId` | `string \| null` | 当前选中项目 |
| `ready` | `boolean` | 初始化是否完成 |

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(storage) => Promise<void>` | 初始化 |
| `createProject` | `(name, path) => Promise<Project>` | 创建项目 |
| `deleteProject` | `(id) => Promise<void>` | 删除项目 |
| `switchProject` | `(id \| null) => Promise<void>` | 切换项目 |
| `getCurrentProject` | `() => Project \| undefined` | 获取当前项目 |
| `getProjectById` | `(id) => Project \| undefined` | 按 ID 查找 |

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}
```

---

### 5. React Hooks

#### useChat()

订阅 ChatService 的所有 `@observable` 属性，桥接到 React state。

```typescript
const {
  messages,      // DisplayMessage[]
  status,        // ChatStatus
  isStreaming,   // boolean
  lastUsage,     // TokenUsage | null
  activePlan,    // PlanProgress | null
  send,          // (content, images?) => Promise<void>
  retry,         // () => Promise<void>
  retryFromMessage, // (id) => Promise<void>
  editMessage,   // (id, content) => Promise<void>
  abort,         // () => void
  clear,         // () => void
} = useChat();
```

#### useSession()

完整的会话生命周期管理，桥接 SessionService 和 ChatService。

```typescript
const {
  sessions,              // SessionInfo[]
  currentSessionId,      // string | null
  create,                // (title?, model?, projectId?) => Promise<string | undefined>
  delete,                // (id) => Promise<void>
  switchTo,              // (id) => Promise<void>
  load,                  // (id) => Promise<SessionData | null>
  saveSessionMessages,   // (sessionId, messages) => Promise<void>
  updateProjectId,       // (sessionId, projectId?) => Promise<void>
} = useSession();
```

**自动行为：**
- 启动时恢复上次活跃会话
- 状态从非 idle 转为 idle 时自动保存
- 页面隐藏时保存（`visibilitychange`）
- 会话切换：缓存当前消息 → 加载目标
- 后台流式：切换时继续后台运行
- 首条消息自动生成会话标题（取前 40 字符）

#### useAgent()

获取底层服务实例。

```typescript
const {
  platform,        // IPlatform
  chatService,     // ChatService
  sessionService,  // SessionService
  isConnected,     // boolean (status !== 'idle' || hasPendingApprovals)
} = useAgent();
```

#### useToolApproval()

管理工具审批。

```typescript
const {
  pendingCalls,  // DisplayToolCall[] — status === 'pending_approval'
  hasPending,    // boolean
  approve,       // (callId) => void
  reject,        // (callId) => void
} = useToolApproval();
```

---

### 6. 类型参考

#### DisplayMessage

```typescript
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls?: DisplayToolCall[];
  blocks?: ContentBlock[];
  isStreaming?: boolean;
  systemType?: 'default' | 'context_compacted';
  duration?: number;    // 响应耗时 (ms)
  timestamp: number;
}
```

#### DisplayToolCall

```typescript
interface DisplayToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}
```

#### ContentBlock

```typescript
type ContentBlock =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; call: DisplayToolCall }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string };
```

#### ChatStatus

```typescript
type ChatStatus = 'idle' | 'running' | 'waiting_approval' | 'error';
```

#### PlanProgress

```typescript
interface PlanProgress {
  planId: string;
  title: string;
  steps: Array<{ id: string; title: string; status: string }>;
}
```

---

## 📤 导出列表

**值导出（运行时）：**
- `AgentProvider` — React Context Provider
- `useAgentContext` — Context 访问 Hook
- `ChatService` — 聊天服务类
- `SessionService` — 会话服务类
- `ProjectService` — 项目服务类
- `useAgent` — Agent Hook
- `useChat` — 聊天 Hook
- `useSession` — 会话 Hook
- `useToolApproval` — 工具审批 Hook

**类型导出：**
- `ChatStatus`, `DisplayMessage`, `DisplayToolCall`, `ContentBlock`, `PlanProgress`
- `SessionInfo`, `SessionData`, `Project`
