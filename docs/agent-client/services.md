# Services

`@svton/agent-client` 内置三个核心 Service 类，它们通过 `@svton/service` 的依赖注入容器管理，提供 Agent 运行时、会话持久化、项目管理等能力。通常你通过 `useAgent()` / `useChat()` 等 Hook 间接使用它们，但也可以直接获取实例进行高级操作。

## 概览

| Service | 职责 | 主要 Observable |
| --- | --- | --- |
| `ChatService` | Agent 运行时管理、消息流式渲染、工具审批 | `messages`、`status`、`currentModel`、`lastUsage`、`activePlan` |
| `SessionService` | 会话 CRUD、持久化、会话列表 | `sessions`、`currentSessionId`、`ready` |
| `ProjectService` | 工作区项目管理 | `projects`、`currentProjectId`、`ready` |

所有 Service 使用 `@Service()` 装饰器注册到全局容器，使用 `@observable()` 标记响应式属性，使用 `@action()` 标记会修改状态的方法。

---

## ChatService

聊天服务是整个 Agent 客户端的核心。它封装了 `AgentRuntime`，负责：

- 管理当前会话的消息列表与运行状态
- 发送消息、处理流式事件、路由到正确的会话
- 工具调用的审批流程（pending → approved/rejected）
- 后台流式运行（用户切换会话后，原会话的流继续执行）
- 模型切换时保留消息历史

### Observable 属性

```ts
class ChatService {
  @observable() messages: DisplayMessage[] = [];
  @observable() status: ChatStatus = 'idle';
  @observable() currentModel: string = '';
  @observable() lastUsage: TokenUsage | null = null;
  @observable() activePlan: PlanProgress | null = null;
  @observable() activeSessionId: string | null = null;

  @computed() get isStreaming(): boolean;            // status === 'running'
  @computed() get hasPendingApprovals(): boolean;    // pendingToolCalls.size > 0
}
```

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `messages` | `DisplayMessage[]` | 当前活跃会话的消息列表 |
| `status` | `ChatStatus` | `'idle' \| 'running' \| 'waiting_approval' \| 'error'` |
| `currentModel` | `string` | 当前使用的模型名称 |
| `lastUsage` | `TokenUsage \| null` | 最近一次运行的 token 统计 |
| `activePlan` | `PlanProgress \| null` | 当前计划进度 |
| `activeSessionId` | `string \| null` | 当前绑定的会话 ID |
| `isStreaming` | `boolean` | 是否正在流式运行（计算属性） |
| `hasPendingApprovals` | `boolean` | 是否有待审批的工具调用（计算属性） |

### 核心方法

#### init(platform, config)

初始化 ChatService，创建 AgentRuntime。

```ts
@action()
async init(platform: IPlatform, config: AgentConfig): Promise<void>
```

**关键行为：**

- 如果已经用相同模型和工作目录初始化过，则跳过（幂等）。
- 模型切换时保留消息历史，将历史消息注入新 runtime 的上下文。
- 自动注册 `subagent_spawn` 工具和 `csv_fanout` 工具（如果 `SubagentManager` 可用）。

```ts
import { ChatService } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';

const chatService = container.resolve(ChatService);

const config: AgentConfig = {
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  workingDir: '/path/to/project',
  toolRegistry: registry,
};

await chatService.init(platform, config);
```

#### sendMessage(content, images?)

发送用户消息并运行 Agent。

```ts
@action()
async sendMessage(
  content: string,
  images?: Array<{ data: string; mimeType?: string }>,
): Promise<void>
```

- 如果 `status === 'running'`，直接返回（不排队）。
- 创建用户消息追加到 `messages`，然后调用内部的 `runAssistant()`。

```ts
// 纯文本
await chatService.sendMessage('请帮我创建一个 React 组件');

// 带图片
await chatService.sendMessage(
  '分析这张截图',
  [{ data: base64String, mimeType: 'image/png' }],
);
```

#### retry()

删除最后一条助手消息，基于上一条用户消息重新生成。

```ts
@action()
async retry(): Promise<void>
```

#### retryFromMessage(messageId)

从指定的用户消息处重新生成，删除其后所有消息。

```ts
@action()
async retryFromMessage(messageId: string): Promise<void>
```

```ts
// 用户想从第三条消息重新生成
chatService.retryFromMessage('msg_abc123');
```

#### editMessage(messageId, newContent)

编辑指定的用户消息，删除其后所有消息并重新运行。

```ts
@action()
async editMessage(messageId: string, newContent: string): Promise<void>
```

#### abort()

中止当前流式运行。将所有 `isStreaming` 的消息标记为完成。

```ts
@action()
abort(): void
```

```ts
// 用户点击"停止"按钮
chatService.abort();
```

#### abortIfStreaming()

如果正在流式运行则中止，返回是否执行了中止。

```ts
@action()
abortIfStreaming(): boolean
```

#### 工具审批方法

```ts
@action()
approveToolCall(callId: string): void    // 批准工具调用

@action()
rejectToolCall(callId: string): void     // 拒绝工具调用
```

批准时会：
1. 从 `pendingToolCalls` Map 中取出 resolve 回调并调用 `true`
2. 更新对应 ToolCall 的 status 为 `'running'`
3. 通知 runtime 的 `approveToolCall()` 让 ReAct 循环继续

#### 会话绑定与消息缓存

```ts
@action()
bindSession(sessionId: string | null): void
```

将 ChatService 绑定到指定会话。后续的 `sendMessage` 等操作都关联到该会话。

```ts
// 后台流式管理
isSessionStreaming(sessionId: string): boolean

cacheSessionMessages(sessionId: string, messages: DisplayMessage[]): void
getCachedMessages(sessionId: string): DisplayMessage[] | undefined
```

当用户切换会话时：
1. 当前消息被缓存到 `sessionMessages` Map
2. 如果正在流式运行，标记为后台会话（流继续运行，更新缓存）
3. 切回时从缓存恢复（缓存可能已被后台流更新）

#### 消息持久化辅助

```ts
// 获取可保存的消息（过滤 system 和 streaming 消息）
getMessagesForSave(): DisplayMessage[]

// 获取指定会话的可保存消息（支持后台会话）
getMessagesForSessionSave(sessionId: string): DisplayMessage[]

// 强制准备保存（标记所有消息为非流式，用于应用关闭）
forcePrepareForSave(): DisplayMessage[]
```

#### clearMessages() 与 loadMessages()

```ts
@action()
clearMessages(): void

@action()
loadMessages(messages: DisplayMessage[]): void
```

`loadMessages` 还会将历史消息注入 runtime 上下文，让 LLM 拥有先前的对话记忆。

#### setReasoningEffort(effort)

```ts
setReasoningEffort(effort: ReasoningEffort | undefined): void
```

设置推理强度（如 `'low' | 'medium' | 'high'`），在下次运行时生效。

### 后台流式回调

```ts
chatService.onBackgroundStreamEnd = (sessionId: string) => {
  // 后台会话的流式运行完成
  // 可以在这里保存该会话的缓存消息
  const msgs = chatService.getCachedMessages(sessionId);
  if (msgs) {
    saveToStorage(sessionId, msgs);
  }
};
```

### 完整使用示例

```ts
import { container } from '@svton/service';
import { ChatService } from '@svton/agent-client';

const chat = container.resolve(ChatService);

// 1. 初始化
await chat.init(platform, {
  model: 'claude-sonnet-4-20250514',
  apiKey,
  workingDir: '/home/user/project',
  toolRegistry,
});

// 2. 绑定会话
chat.bindSession('session_123');

// 3. 发送消息
await chat.sendMessage('实现一个冒泡排序');

// 4. 监听状态
const unsub = chat['__internal__'].subscribe('messages', () => {
  console.log('消息更新:', chat.messages.length);
});

// 5. 清理
unsub();
```

---

## SessionService

会话持久化服务。负责会话的创建、加载、保存、删除，以及会话列表的维护。所有数据通过注入的 `IStorage` 后端持久化。

### 接口定义

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

interface SessionData {
  id: string;
  title: string;
  model: string;
  messages: unknown[];   // 序列化的 DisplayMessage[]
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}
```

### Observable 属性

```ts
class SessionService {
  @observable() sessions: SessionInfo[] = [];
  @observable() currentSessionId: string | null = null;
  @observable() ready: boolean = false;
}
```

### 存储结构

SessionService 使用两个存储键：

| 键 | 内容 |
| --- | --- |
| `agent:session_list` | `SessionInfo[]` — 会话列表（元数据） |
| `agent:session:{id}` | `SessionData` — 单个会话的完整数据（含消息） |

### 方法

#### init(storage)

```ts
@action()
async init(storage: IStorage): Promise<void>
```

初始化服务，加载会话列表。幂等——如果已初始化则直接返回。

```ts
import { SessionService } from '@svton/agent-client';

const sessionService = container.resolve(SessionService);
await sessionService.init(storageBackend);  // 如 IndexedDB / Tauri Store
```

#### create(title?, model?, projectId?)

创建新会话。

```ts
@action()
async create(
  title?: string,
  model?: string,
  projectId?: string,
): Promise<string>
```

- 自动生成 ID：`session_{timestamp}_{random}`
- 默认标题：`Chat {n}`（n 为当前会话数 + 1）
- 默认模型：`'gpt-4o'`
- **所有异步 I/O 先完成，再更新 observable**（避免级联重渲染）

```ts
const id = await sessionService.create('我的新会话', 'claude-sonnet-4-20250514');
console.log('新会话 ID:', id);
```

#### loadSession(id)

加载会话完整数据（含消息）。

```ts
async loadSession(id: string): Promise<SessionData | null>
```

```ts
const data = await sessionService.loadSession('session_123');
if (data) {
  console.log('标题:', data.title);
  console.log('消息数:', data.messages.length);
}
```

#### saveSession(data)

保存会话数据。

```ts
async saveSession(data: SessionData): Promise<void>
```

- 更新 `updatedAt` 为当前时间
- 同步更新会话列表中的 `title`、`messageCount`、`updatedAt`、`projectId`

```ts
await sessionService.saveSession({
  id: 'session_123',
  title: '关于 React 的讨论',
  model: 'gpt-4o',
  messages: serializedMessages,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now(),
  projectId: 'project_abc',
});
```

#### delete(id)

删除会话。

```ts
@action()
async delete(id: string): Promise<void>
```

- 删除会话数据和列表条目
- 如果删除的是当前会话，自动切换到列表中的第一个

#### switchTo(id)

切换当前会话（仅更新 `currentSessionId`）。

```ts
@action()
switchTo(id: string): void
```

注意：此方法只更新 observable，不负责消息的加载/保存。消息管理由 `useSession` Hook 或 `ChatService` 负责。

#### updateProjectId(sessionId, projectId)

更新会话关联的项目 ID。

```ts
@action()
async updateProjectId(sessionId: string, projectId: string | undefined): Promise<void>
```

同时更新会话列表和会话数据记录。

#### updateSessionInfo(id, updates)

轻量级元数据更新，用于侧边栏即时响应。

```ts
@action()
async updateSessionInfo(
  id: string,
  updates: Partial<Pick<SessionInfo, 'title' | 'projectId' | 'messageCount'>>,
): Promise<void>
```

比 `saveSession` 更轻量——不需要传入完整消息列表，仅更新元数据。

```ts
// 首条消息后更新标题
await sessionService.updateSessionInfo('session_123', {
  title: '帮我写一个排序算法...',
  messageCount: 1,
});
```

### 数据完整性保护

`loadSessionList()` 内部包含完整性校验：

- 如果列表条数超过 200，视为损坏，清空所有数据
- 每个条目校验 `id` 和 `title` 字段类型
- 如果有效条目数与总数不符，执行 `nukeAllSessionData()` 清理

```ts
// 私有方法（了解原理即可）
private async loadSessionList(): Promise<void>
private async nukeAllSessionData(): Promise<void>
```

### 完整使用示例

```ts
import { container } from '@svton/service';
import { SessionService } from '@svton/agent-client';

const sessions = container.resolve(SessionService);
await sessions.init(indexedDBStorage);

// 创建
const id1 = await sessions.create();
const id2 = await sessions.create('代码评审', 'claude-sonnet-4-20250514');

// 列表
console.log(sessions.sessions);
// [
//   { id: 'session_..._2', title: '代码评审', ... },
//   { id: 'session_..._1', title: 'Chat 1', ... },
// ]

// 切换
sessions.switchTo(id2);

// 加载
const data = await sessions.loadSession(id2);

// 删除
await sessions.delete(id1);
```

---

## ProjectService

工作区项目管理服务。每个 Project 代表一个本地代码库或工作目录，可以关联到会话。

### 类型定义

```ts
interface Project {
  id: string;
  name: string;
  path: string;         // 本地文件系统路径
  createdAt: number;
  updatedAt: number;
}
```

### Observable 属性

```ts
class ProjectService {
  @observable() projects: Project[] = [];
  @observable() currentProjectId: string | null = null;
  @observable() ready: boolean = false;
}
```

### 存储结构

| 键 | 内容 |
| --- | --- |
| `agent:project_list` | `Project[]` — 项目列表 |
| `agent:current_project` | `string` — 当前选中项目的 ID |

### 方法

#### init(storage)

```ts
@action()
async init(storage: IStorage): Promise<void>
```

加载项目列表和当前选中项目。

#### createProject(name, path)

创建新项目。

```ts
@action()
async createProject(name: string, path: string): Promise<Project>
```

```ts
const project = await projectService.createProject(
  '我的应用',
  '/home/user/projects/my-app',
);
console.log(project.id);  // 'project_1234567890_abc123'
```

#### deleteProject(id)

删除项目。如果删除的是当前项目，自动取消选中。

```ts
@action()
async deleteProject(id: string): Promise<void>
```

#### switchProject(id)

切换当前项目。

```ts
@action()
async switchProject(id: string | null): Promise<void>
```

```ts
// 选中项目
await projectService.switchProject('project_abc');

// 取消选中
await projectService.switchProject(null);
```

#### 查询方法

```ts
getCurrentProject(): Project | undefined
getProjectById(id: string): Project | undefined
```

这两个是同步方法（非 async），直接从内存中的 `projects` 数组查询。

### 完整使用示例

```ts
import { container } from '@svton/service';
import { ProjectService } from '@svton/agent-client';

const projects = container.resolve(ProjectService);
await projects.init(storage);

// 创建项目
const proj = await projects.createProject('前端项目', '/code/webapp');

// 切换
await projects.switchProject(proj.id);

// 查询
const current = projects.getCurrentProject();
console.log(current?.name);  // '前端项目'

// 与会话关联
await sessionService.updateProjectId(sessionId, proj.id);
```

---

## IStorage 接口

SessionService 和 ProjectService 都依赖 `IStorage` 接口（来自 `@svton/agent-platform`）。你可以实现自己的存储后端：

```ts
interface IStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}
```

### 适配器示例

#### 浏览器 localStorage

```ts
class LocalStorageAdapter implements IStorage {
  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }
}
```

#### Tauri 文件系统

```ts
import { Store } from '@tauri-apps/plugin-store';

class TauriStorageAdapter implements IStorage {
  private store = new Store('.agent.dat');

  async get<T>(key: string): Promise<T | null> {
    return (await this.store.get(key)) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.store.set(key, value);
    await this.store.save();
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
    await this.store.save();
  }

  async list(prefix?: string): Promise<string[]> {
    const entries = await this.store.entries();
    return entries
      .map(([k]) => k as string)
      .filter((k) => !prefix || k.startsWith(prefix));
  }
}
```

---

## Service 之间的协作

三个 Service 并非孤立运作，它们通过 `useSession` Hook 和 ChatService 的内部机制协作：

```
用户操作
   │
   ├─→ useSession.switchTo(id)
   │      │
   │      ├─→ ChatService.cacheSessionMessages(oldId, msgs)
   │      ├─→ ChatService.bindSession(newId)         ← 更新 activeSessionId
   │      ├─→ SessionService.switchTo(newId)          ← 更新 currentSessionId observable
   │      └─→ ChatService.loadMessages(restoreMsgs)   ← 从缓存或存储恢复
   │
   ├─→ useChat.send(content)
   │      │
   │      └─→ ChatService.sendMessage(content)
   │            │
   │            ├─→ 添加用户消息到 messages
   │            ├─→ AgentRuntime.run() → 流式事件
   │            └─→ status: 'idle' → 自动触发 useSession 的保存
   │                  │
   │                  └─→ SessionService.saveSession(data)
   │
   └─→ globalFlush()  (应用关闭前)
          │
          ├─→ ChatService.forcePrepareForSave()
          └─→ SessionService.saveSession()  (活跃 + 后台会话)
```

### 消息保存时机

| 触发条件 | 保存方式 | 调用链 |
| --- | --- | --- |
| `status` 变为 `idle` | 自动保存活跃会话 | `useSession` 监听 → `saveSessionMessages` |
| 后台流完成 | 保存后台会话 | `onBackgroundStreamEnd` 回调 → `saveSessionMessages` |
| 页面隐藏 | 强制保存（含流式消息） | `visibilitychange` → `forcePrepareForSave` |
| 应用关闭 | 全量 flush | `globalFlush()` → `forcePrepareForSave` |
| 切换会话 | 保存原会话 | `switchTo` → `getMessagesForSave` |

## 注意事项

1. **初始化顺序**：`SessionService.init()` 和 `ProjectService.init()` 需要在 `ChatService.init()` 之前调用（通常由 `AgentProvider` 处理）。
2. **Observable 变更时机**：所有 Service 的 `@action()` 方法都遵循"先完成异步 I/O，再更新 observable"的模式，避免中间状态触发重渲染。
3. **不要直接修改 observable**：外部代码应通过 Service 方法修改状态，而不是直接赋值（如 `sessionService.sessions = []`），以确保持久化一致性。
4. **会话 ID 格式**：`session_{timestamp}_{6位随机字符}`，项目 ID 格式类似。不要依赖固定长度。
5. **存储隔离**：不同平台（Web / Tauri / Electron）应使用不同的 `IStorage` 实现，但键名空间一致（`agent:*`）。
