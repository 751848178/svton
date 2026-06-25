# Hooks
> React Hooks — useChat、useSession、useAgent、useToolApproval

`@svton/agent-client` 提供了 4 个 React Hook，用于在 React 组件中接入 Agent 的聊天、会话、工具审批等能力。所有 Hook 必须在 `<AgentProvider>` 内部使用，它们通过 `useAgentContext()` 获取共享的 Service 实例。

## 概览

| Hook | 用途 | 主要返回值 |
| --- | --- | --- |
| `useAgent()` | 获取底层 Service 实例 | `chatService`、`sessionService`、`platform`、`isConnected` |
| `useChat()` | 消息收发与流式渲染 | `messages`、`status`、`send`、`retry`、`abort` |
| `useSession()` | 多会话管理（增删切换、持久化） | `sessions`、`create`、`switchTo`、`delete`、`flush` |
| `useToolApproval()` | 工具调用审批（人工确认） | `pendingCalls`、`approve`、`reject` |

所有 Hook 都基于 `@svton/service` 的 `@observable()` 装饰器实现响应式订阅，调用 `subscribe()` 后会在 Service 状态变化时自动触发组件重渲染。

---

## useAgent

获取当前共享的 Service 实例。这是其他 Hook 的基础，通常在你需要直接调用 Service 的非标准化方法时使用。

### 签名

```ts
function useAgent(): {
  platform: IPlatform;
  chatService: ChatService;
  sessionService: SessionService;
  isConnected: boolean;
}
```

### 返回值

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `platform` | `IPlatform` | 来自 `@svton/agent-platform` 的平台适配器（Electron / Tauri / Web） |
| `chatService` | `ChatService` | 聊天服务实例，包含 `messages`、`status` 等 observable |
| `sessionService` | `SessionService` | 会话服务实例，包含 `sessions`、`currentSessionId` 等 observable |
| `isConnected` | `boolean` | 当 `chatService.status !== 'idle'` 或存在待审批工具调用时为 `true` |

### 示例

```tsx
import { useAgent } from '@svton/agent-client';

function StatusBar() {
  const { chatService, isConnected } = useAgent();

  return (
    <div>
      <span>当前模型：{chatService.currentModel}</span>
      <span>{isConnected ? '处理中…' : '空闲'}</span>
    </div>
  );
}
```

---

## useChat

聊天 Hook，负责消息的发送、流式渲染、重试与编辑。它在内部订阅了 `messages`、`status`、`lastUsage`、`activePlan` 四个 observable。

### 签名

```ts
function useChat(): {
  messages: DisplayMessage[];
  status: ChatStatus;
  isStreaming: boolean;
  lastUsage: TokenUsage | null;
  activePlan: PlanProgress | null;

  send: (content: string, images?: Array<{ data: string; mimeType?: string }>) => Promise<void>;
  retry: () => Promise<void>;
  retryFromMessage: (id: string) => Promise<void>;
  editMessage: (id: string, content: string) => Promise<void>;
  abort: () => void;
  clear: () => void;
}
```

### 返回值详解

#### 响应式状态

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `messages` | `DisplayMessage[]` | 当前会话的显示消息列表（含用户、助手、系统消息） |
| `status` | `ChatStatus` | `'idle' \| 'running' \| 'waiting_approval' \| 'error'` |
| `isStreaming` | `boolean` | 等价于 `status === 'running'`，便于条件渲染 |
| `lastUsage` | `TokenUsage \| null` | 最近一次运行的 token 使用统计 |
| `activePlan` | `PlanProgress \| null` | 当前活跃的计划进度（多步骤任务） |

#### 操作方法

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `send` | `(content, images?) => Promise<void>` | 发送用户消息并触发 Agent 运行 |
| `retry` | `() => Promise<void>` | 删除最后一条助手消息，基于上一条用户消息重新生成 |
| `retryFromMessage` | `(id: string) => Promise<void>` | 从指定用户消息处重新生成（会删除其后所有消息） |
| `editMessage` | `(id: string, content: string) => Promise<void>` | 编辑指定的用户消息，删除其后的所有消息并重新运行 |
| `abort` | `() => void` | 中止当前流式运行 |
| `clear` | `() => void` | 清空当前会话所有消息 |

### DisplayMessage 类型

```ts
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;          // 助手的思考过程（CoT）
  error?: string;
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls?: DisplayToolCall[];
  blocks?: ContentBlock[];    // 按执行顺序排列的内容块（权威渲染源）
  isStreaming?: boolean;      // 当前是否正在流式生成
  systemType?: 'default' | 'context_compacted';
  duration?: number;          // 完成该轮助手回复所用毫秒数
  timestamp: number;
}
```

### PlanProgress 类型

```ts
interface PlanProgress {
  planId: string;
  title: string;
  steps: Array<{ id: string; title: string; status: string }>;
}
```

### 示例

#### 基础聊天界面

```tsx
import { useChat } from '@svton/agent-client';

function ChatView() {
  const { messages, isStreaming, send, abort } = useChat();
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    send(input);
    setInput('');
  };

  return (
    <div>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.role}:</strong> {m.content}
            {m.isStreaming && <span className="cursor">▌</span>}
          </li>
        ))}
      </ul>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button onClick={handleSubmit} disabled={isStreaming}>发送</button>
      <button onClick={abort} disabled={!isStreaming}>停止</button>
    </div>
  );
}
```

#### 重试与编辑

```tsx
function MessageActions({ message }: { message: DisplayMessage }) {
  const { retry, editMessage } = useChat();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role !== 'user') return null;

  return editing ? (
    <div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => { editMessage(message.id, draft); setEditing(false); }}>
        提交编辑
      </button>
    </div>
  ) : (
    <div>
      <button onClick={() => retry()}>重新生成最后回复</button>
      <button onClick={() => setEditing(true)}>编辑</button>
    </div>
  );
}
```

#### 发送带图片的消息

```tsx
async function sendWithImage(file: File) {
  const data = await fileToBase64(file);
  send('请分析这张图片', [{ data, mimeType: file.type }]);
}
```

---

## useSession

多会话管理 Hook。它桥接 `SessionService` 与 `ChatService`，负责：

- 创建 / 切换 / 删除会话
- 会话切换时保存与恢复消息
- 后台流式运行（用户切走后，流继续在后台执行）
- 页面隐藏/关闭时强制保存
- 首条用户消息时自动生成会话标题

### 设计要点

- **会话切换通过显式动作触发**（`switchTo`、`create`），不通过 `currentSessionId` 的响应式监听器，避免快速切换时的保存/加载竞态。
- **后台流式支持**：当用户从一个正在流式运行的会话切走时，流会在后台继续运行并更新该会话的消息缓存。切回时从缓存恢复。
- **自动保存**：当 `status` 从 `running` 变为 `idle` 时，自动保存当前会话。
- **强制 flush**：通过 `setFlushFn` 注册全局 flush 函数，供 Tauri 等桌面端在关闭窗口前调用。

### 签名

```ts
function useSession(): {
  sessions: SessionInfo[];
  currentSessionId: string | null;

  create: (title?: string, model?: string, projectId?: string) => Promise<string | undefined>;
  switchTo: (id: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  load: (id: string) => Promise<SessionData | null>;
  saveSessionMessages: (sessionId: string, messages: DisplayMessage[]) => Promise<void>;
  flush: () => Promise<void>;
  updateProjectId: (sessionId: string, projectId: string | undefined) => Promise<void>;
}
```

### 返回值详解

| 字段/方法 | 类型 | 说明 |
| --- | --- | --- |
| `sessions` | `SessionInfo[]` | 所有会话的元信息列表（不含消息体） |
| `currentSessionId` | `string \| null` | 当前活跃会话 ID |
| `create` | `(title?, model?, projectId?) => Promise<string \| undefined>` | 创建新会话，返回新会话 ID |
| `switchTo` | `(id) => Promise<void>` | 切换到指定会话（自动保存当前会话） |
| `delete` | `(id) => Promise<void>` | 删除会话（自动切换到下一个） |
| `load` | `(id) => Promise<SessionData \| null>` | 从存储加载会话完整数据 |
| `saveSessionMessages` | `(sessionId, messages) => Promise<void>` | 将消息持久化到指定会话 |
| `flush` | `() => Promise<void>` | 强制保存所有挂起的消息（含后台会话） |
| `updateProjectId` | `(sessionId, projectId) => Promise<void>` | 更新会话关联的项目 ID |

### SessionInfo 类型

```ts
interface SessionInfo {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}
```

### 会话切换流程

```ts
// switchTo(id) 内部执行步骤：
// 1. 缓存当前会话的消息（若正在流式，标记为后台会话，流继续运行）
// 2. 若非流式，立即保存当前会话到存储
// 3. 更新 currentSessionId observable（侧边栏高亮变化）
// 4. 调用 chatService.bindSession(id)
// 5. 优先从缓存加载目标会话消息；缓存不存在则从存储加载
// 6. 更新 activeSessionId ref
```

### 示例

#### 会话侧边栏

```tsx
import { useSession } from '@svton/agent-client';

function SessionSidebar() {
  const { sessions, currentSessionId, create, switchTo, delete: deleteSession } = useSession();

  return (
    <aside>
      <button onClick={() => create()}>+ 新建会话</button>

      <ul>
        {sessions.map((s) => (
          <li
            key={s.id}
            className={s.id === currentSessionId ? 'active' : ''}
            onClick={() => switchTo(s.id)}
          >
            <span>{s.title}</span>
            <small>{s.messageCount} 条消息</small>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

#### 桌面端关闭前保存

```tsx
// Tauri 应用示例：监听 onCloseRequested，确保所有会话数据持久化
import { listen } from '@tauri-apps/api/event';
import { globalFlush } from '@svton/agent-client';

useEffect(() => {
  const unlisten = listen('tauri://close-requested', async () => {
    await globalFlush();       // 强制保存所有挂起的消息
    // 然后允许窗口关闭
  });
  return () => { unlisten.then((fn) => fn()); };
}, []);
```

#### 关联会话与项目

```tsx
function ProjectPicker({ sessionId }: { sessionId: string }) {
  const { updateProjectId } = useSession();
  const [projectId, setProjectId] = useState<string | undefined>();

  return (
    <select
      value={projectId ?? ''}
      onChange={(e) => {
        const id = e.target.value || undefined;
        setProjectId(id);
        updateProjectId(sessionId, id);
      }}
    >
      <option value="">未关联项目</option>
      <option value="proj_1">我的项目</option>
    </select>
  );
}
```

### 导出的辅助函数

`useSession.ts` 还导出了以下工具函数，供高级场景使用：

| 函数 | 说明 |
| --- | --- |
| `deriveTitle(currentTitle, messages)` | 从首条用户消息派生会话标题（仅当 `currentTitle` 以 `"Chat "` 开头时） |
| `displayToStoredMessages(msgs)` | 将 `DisplayMessage[]` 转为可持久化的精简格式（过滤 system 消息） |
| `storedToDisplayMessages(msgs)` | 将存储格式还原为 `DisplayMessage[]`（含 thinking、toolCalls、blocks 重建） |

---

## useToolApproval

工具审批 Hook。用于实现"人工确认"工作流——当 Agent 调用需要审批的工具时，UI 可以展示待审批列表并允许用户批准/拒绝。

它订阅 `messages` observable，通过 `useMemo` 计算出所有 `status === 'pending_approval'` 的工具调用。

### 签名

```ts
function useToolApproval(): {
  pendingCalls: DisplayToolCall[];
  hasPending: boolean;
  approve: (callId: string) => void;
  reject: (callId: string) => void;
}
```

### 返回值详解

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `pendingCalls` | `DisplayToolCall[]` | 所有待审批的工具调用列表 |
| `hasPending` | `boolean` | 等价于 `chatService.hasPendingApprovals` |
| `approve` | `(callId: string) => void` | 批准指定工具调用，恢复执行 |
| `reject` | `(callId: string) => void` | 拒绝指定工具调用，标记为错误 |

### DisplayToolCall 类型

```ts
interface DisplayToolCall {
  id: string;
  name: string;                              // 工具名称，如 'file_write'
  arguments: Record<string, unknown>;         // 工具参数
  result?: ToolResult;                        // 执行结果（审批前为 undefined）
  status: 'running' | 'completed' | 'error' | 'pending_approval';
}
```

### 审批流程

```ts
// 1. Agent 请求调用需要审批的工具（如 file_write）
// 2. ChatService 将该 ToolCall 的 status 设为 'pending_approval'
// 3. useToolApproval 响应式更新 pendingCalls
// 4. 用户在 UI 中查看调用详情，点击"批准"或"拒绝"
// 5. approve()/reject() 被调用，通过 pendingToolCalls Map 中的 resolve 解除阻塞
// 6. 同时通知 runtime，ReAct 循环继续
```

### 示例

#### 审批弹窗

```tsx
import { useToolApproval } from '@svton/agent-client';

function ToolApprovalModal() {
  const { pendingCalls, hasPending, approve, reject } = useToolApproval();

  if (!hasPending) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>以下工具调用需要您的确认</h3>
        {pendingCalls.map((call) => (
          <div key={call.id} className="approval-item">
            <h4>{call.name}</h4>
            <pre>{JSON.stringify(call.arguments, null, 2)}</pre>
            <div className="actions">
              <button onClick={() => approve(call.id)}>批准</button>
              <button onClick={() => reject(call.id)}>拒绝</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 条件渲染加载状态

```tsx
function LoadingIndicator() {
  const { hasPending } = useToolApproval();
  const { isStreaming } = useChat();

  if (hasPending) return <span>等待工具审批…</span>;
  if (isStreaming) return <span>Agent 思考中…</span>;
  return null;
}
```

---

## 组合使用示例

完整的聊天应用通常需要组合多个 Hook：

```tsx
import { AgentProvider, useChat, useSession, useToolApproval } from '@svton/agent-client';

function AppContent() {
  const { messages, send, abort, isStreaming } = useChat();
  const { sessions, currentSessionId, create, switchTo } = useSession();
  const { pendingCalls, approve, reject } = useToolApproval();

  return (
    <div className="app">
      <SessionSidebar
        sessions={sessions}
        currentId={currentSessionId}
        onSelect={switchTo}
        onCreate={() => create()}
      />
      <ChatPanel
        messages={messages}
        onSend={send}
        onAbort={abort}
        isStreaming={isStreaming}
      />
      {pendingCalls.length > 0 && (
        <ToolApprovalModal
          calls={pendingCalls}
          onApprove={approve}
          onReject={reject}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AgentProvider config={agentConfig} platform={platform}>
      <AppContent />
    </AgentProvider>
  );
}
```

## 注意事项

1. **必须在 AgentProvider 内使用**：所有 Hook 依赖 `useAgentContext()`，脱离 Provider 会抛出错误。
2. **避免在 render 阶段调用动作方法**：`send`、`switchTo` 等应放在事件处理器或 `useEffect` 中。
3. **后台流式的限制**：同一时间只有一个后台流式会话。如果用户从后台会话再切到另一个会话，原后台流继续运行。
4. **消息持久化时机**：自动保存在 `status` 变为 `idle` 时触发；页面隐藏（`visibilitychange`）时强制保存；应用关闭前应调用 `globalFlush()`。
5. **observable 订阅的生命周期**：Hook 内部使用 `useEffect` 管理订阅的注册与注销，无需手动清理。
