# @svton/agent-sdk

> 高层 SDK — 一行代码创建 AI Agent，支持 React 集成。

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/agent-sdk` |
| **版本** | `0.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **React 入口** | `dist/react/index.js` / `dist/react/index.mjs` |
| **类型** | `dist/index.d.ts` |
| **React 类型** | `dist/react/index.d.ts` |
| **依赖** | `@svton/agent-core`, `@svton/agent-platform` |
| **Peer 依赖** | `react >= 18.0.0`（可选，仅使用 `/react` 子路径时需要） |

---

## 🚀 快速开始

### 安装

```bash
npm install @svton/agent-sdk
```

### 程序化使用（10 行代码）

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: 'sk-xxx',
    baseUrl: 'https://api.openai.com',
  },
  model: 'gpt-4o',
  systemPrompt: '你是一个有帮助的助手。',
});

const stream = agent.chat('你好，介绍一下你自己');
for await (const event of stream) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
  if (event.type === 'done') console.log('\n--- 完成 ---');
}

await agent.dispose();
```

### React 使用

```tsx
import { AgentProvider, useChat, useToolApproval } from '@svton/agent-sdk/react';

function App() {
  return (
    <AgentProvider config={{
      provider: { type: 'openai', apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com' },
      model: 'gpt-4o',
    }}>
      <ChatView />
    </AgentProvider>
  );
}

function ChatView() {
  const { messages, isStreaming, send } = useChat();
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
          <span>{call.name} 请求执行</span>
          <button onClick={() => approve(call.id)}>允许</button>
          <button onClick={() => reject(call.id)}>拒绝</button>
        </div>
      ))}

      <button onClick={() => send('你好')} disabled={isStreaming}>
        发送
      </button>
    </div>
  );
}
```

---

## 📖 核心 API

### createAgent(config)

创建一个完整的 Agent 实例，内部自动完成平台初始化、Provider 创建、工具注册、MCP 连接等所有步骤。

```typescript
const agent = await createAgent({
  // 必填：LLM 提供者配置
  provider: {
    type: 'openai',              // 'openai' | 'anthropic'
    apiKey: 'sk-xxx',
    baseUrl: 'https://api.openai.com',  // OpenAI 可选，Anthropic 默认 https://api.anthropic.com
    customHeaders: {},           // 可选：自定义请求头
  },

  // 必填：模型 ID
  model: 'gpt-4o',

  // 可选：系统提示词
  systemPrompt: '你是一个专业的代码助手',

  // 可选：自定义工具
  tools: [
    {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
        },
        required: ['city'],
      },
      execute: async (args) => {
        const weather = await fetchWeather(args.city);
        return JSON.stringify(weather);
      },
    },
  ],

  // 可选：MCP 服务器
  mcpServers: [
    {
      url: 'https://mcp.example.com/sse',
      type: 'sse',
      name: 'my-tools',
    },
  ],

  // 可选：能力开关
  memory: true,         // 启用自动记忆（默认 false）
  planning: true,       // 启用计划管理工具（默认 false）

  // 可选：权限模式
  permission: 'default',  // 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto'

  // 可选：生命周期钩子
  hooks: {
    post_tool_use: async (ctx) => {
      console.log(`工具 ${ctx.toolName} 执行完成`);
      return { action: 'continue' };
    },
  },

  // 可选：高级配置
  maxIterations: 50,     // 最大 ReAct 循环次数
  workingDir: '/project', // 工作目录
});
```

### CreateAgentConfig 完整配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | `ProviderConfig` | — | **必填** LLM 提供者配置 |
| `model` | `string` | — | **必填** 模型 ID |
| `systemPrompt` | `string` | — | 自定义系统提示词，追加到基础模板之后 |
| `tools` | `UserToolDefinition[]` | `[]` | 自定义工具列表 |
| `mcpServers` | `SdkMcpServerConfig[]` | `[]` | MCP 服务器列表 |
| `memory` | `boolean` | `false` | 启用自动记忆（memory_save / memory_recall） |
| `planning` | `boolean` | `false` | 启用计划管理（plan_create / plan_update_step / plan_get_status） |
| `permission` | `PermissionMode` | `'default'` | 权限模式 |
| `hooks` | `Partial<Record<HookEvent, HookHandler>>` | — | 生命周期钩子 |
| `skills` | `SkillDefinition[]` | `[]` | 技能定义列表 |
| `maxIterations` | `number` | `50` | ReAct 循环最大迭代次数 |
| `workingDir` | `string` | `'/'` | 工作目录 |
| `platform` | `IPlatform` | `BrowserPlatform` | 自定义平台实例 |
| `contextConfig` | `Partial<ContextConfig>` | — | 上下文管理配置 |

### ProviderConfig

```typescript
interface ProviderConfig {
  type: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl?: string;                       // OpenAI: 可选；Anthropic: 默认 https://api.anthropic.com
  customHeaders?: Record<string, string>;
  models?: ModelInfo[];                   // 覆盖默认模型列表
}
```

**兼容 OpenAI 的服务**：OpenAI、Azure OpenAI、DeepSeek、Ollama、vLLM、LiteLLM — 只需设置对应的 `baseUrl` 和 `apiKey`。

---

### Agent 类

`createAgent()` 返回的 Agent 实例，提供完整的 Agent 生命周期管理。

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `runtime` | `AgentRuntime` | 底层运行时实例（高级用法） |
| `toolRegistry` | `ToolRegistry` | 工具注册表（高级用法） |
| `platform` | `IPlatform` | 当前平台实例 |

#### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `chat` | `(message: string \| ContentBlock[]) => AsyncGenerator<AgentEvent>` | 启动对话，返回事件流 |
| `abort` | `() => void` | 中止当前对话 |
| `approveToolCall` | `(callId: string) => void` | 批准待审批的工具调用 |
| `rejectToolCall` | `(callId: string) => void` | 拒绝待审批的工具调用 |
| `getMessages` | `() => ChatMessage[]` | 获取当前对话历史 |
| `setMessages` | `(messages: ChatMessage[]) => void` | 恢复对话历史（会话恢复） |
| `addTool` | `(tool: UserToolDefinition) => void` | 动态添加工具 |
| `removeTool` | `(name: string) => void` | 动态移除工具 |
| `addSkill` | `(skill: SkillDefinition) => void` | 动态添加技能 |
| `removeSkill` | `(name: string) => void` | 动态移除技能 |
| `dispose` | `() => Promise<void>` | 释放资源（断开 MCP 连接等） |

#### 多模态输入

`chat()` 支持传入图片：

```typescript
const stream = agent.chat([
  { type: 'text', text: '这张图片里有什么？' },
  { type: 'image', data: base64Image, mimeType: 'image/png' },
]);
```

#### 事件流处理

```typescript
const stream = agent.chat('帮我分析这段代码');

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      // LLM 文本增量输出
      process.stdout.write(event.text);
      break;
    case 'thinking_delta':
      // 思维链（DeepSeek Reasoner / Claude Extended Thinking）
      process.stdout.write(event.thinking);
      break;
    case 'tool_call_start':
      // 工具调用开始
      console.log(`调用工具: ${event.call.name}`);
      break;
    case 'tool_call_end':
      // 工具调用完成
      console.log(`工具结果: ${event.result.output}`);
      break;
    case 'tool_approval_needed':
      // 需要用户审批
      console.log(`工具 ${event.call.name} 需要审批`);
      // agent.approveToolCall(event.call.id) 或 agent.rejectToolCall(event.call.id)
      break;
    case 'error':
      console.error('错误:', event.error);
      break;
    case 'done':
      console.log('完成');
      break;
  }
}
```

---

## 🛠️ 自定义工具

### 定义工具

```typescript
import { UserToolDefinition } from '@svton/agent-sdk';

const databaseQueryTool: UserToolDefinition = {
  name: 'query_database',
  description: '查询数据库，返回 SQL 查询结果',
  parameters: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'SQL 查询语句（仅支持 SELECT）',
      },
      database: {
        type: 'string',
        description: '数据库名称',
        enum: ['production', 'staging'],
      },
    },
    required: ['sql'],
  },
  // 可选：工具注解（影响权限决策）
  annotations: {
    readOnlyHint: true,        // 只读操作
    destructiveHint: false,    // 非破坏性
    idempotentHint: true,      // 幂等
    openWorldHint: false,      // 不访问外部网络
  },
  execute: async (args, context) => {
    // args 是已经解析好的参数对象
    // context 包含平台信息、工作目录、中止信号等
    const result = await db.query(args.sql);
    return JSON.stringify(result.rows);
  },
};
```

### 注册工具

```typescript
const agent = await createAgent({
  provider: { /* ... */ },
  model: 'gpt-4o',
  tools: [databaseQueryTool],
});

// 或者动态注册
agent.addTool(anotherTool);
agent.removeTool('query_database');
```

---

## 🔌 MCP 服务器集成

MCP (Model Context Protocol) 允许连接外部工具服务器。

### 连接 MCP 服务器

```typescript
const agent = await createAgent({
  provider: { /* ... */ },
  model: 'gpt-4o',
  mcpServers: [
    {
      url: 'https://mcp.example.com/api',
      type: 'http',           // 'http' | 'sse'
      name: 'external-tools', // 工具命名空间前缀: mcp__external-tools__toolName
      headers: {              // 可选：认证头
        Authorization: 'Bearer xxx',
      },
      toolFilter: {           // 可选：工具过滤
        enabled: ['search', 'calculate'],   // 白名单
        disabled: ['dangerous_tool'],       // 黑名单
        approvalMode: 'auto',              // 'auto' | 'ask' | 'deny'
      },
    },
  ],
});
```

MCP 工具会被自动注册到 Agent 的工具表中，LLM 可以直接调用。

---

## 🔐 权限模式

通过 `permission` 配置控制工具执行的审批策略。

| 模式 | 行为 |
|------|------|
| `read_only` | 只允许只读工具（file_read, grep, glob, web_search, web_fetch） |
| `plan` | 同 read_only，不允许任何写入 |
| `default` | 读取自动通过，写入需用户确认 |
| `accept_edits` | 读取 + 文件编辑自动通过，其他写入需确认 |
| `auto` | 所有操作自动执行，无需确认 |

```typescript
const agent = await createAgent({
  // ...
  permission: 'default',  // 工具调用前会发出 tool_approval_needed 事件
});

// 监听审批请求并处理
const stream = agent.chat('帮我修改配置文件');
for await (const event of stream) {
  if (event.type === 'tool_approval_needed') {
    const call = event.call;
    console.log(`工具 ${call.name} 想要执行:`, call.arguments);
    agent.approveToolCall(call.id);  // 或 agent.rejectToolCall(call.id);
  }
}
```

---

## 🪝 生命周期钩子

在工具执行、会话管理等关键节点插入自定义逻辑。

```typescript
const agent = await createAgent({
  // ...
  hooks: {
    // 工具执行前 — 可以修改参数或拒绝执行
    pre_tool_use: async (ctx) => {
      if (ctx.toolName === 'bash' && ctx.toolCall?.arguments?.command?.includes('rm')) {
        return { action: 'deny', reason: '不允许执行删除命令' };
      }
      return { action: 'continue' };
    },

    // 工具执行后 — 可以记录日志或修改结果
    post_tool_use: async (ctx) => {
      console.log(`[${ctx.toolName}] 执行完成`);
      return { action: 'continue' };
    },

    // 权限请求时
    permission_request: async (ctx) => {
      // 自动批准特定工具
      if (ctx.toolName === 'file_read') {
        return { action: 'approve' };
      }
      return { action: 'continue' };
    },

    // 会话开始
    session_start: async (ctx) => {
      console.log('会话开始');
      return { action: 'continue' };
    },
  },
});
```

### 钩子事件列表

| 事件 | 触发时机 |
|------|----------|
| `pre_tool_use` | 工具执行前 |
| `post_tool_use` | 工具执行后 |
| `permission_request` | 权限检查时 |
| `session_start` | 会话开始 |
| `session_end` | 会话结束 |
| `context_compact` | 上下文压缩完成 |
| `message_sent` | 消息发送 |
| `message_received` | 收到响应 |

### 钩子返回值

| 返回值 | 效果 |
|--------|------|
| `{ action: 'continue' }` | 继续正常流程 |
| `{ action: 'modify', updates }` | 修改上下文后继续 |
| `{ action: 'deny', reason }` | 阻止操作 |
| `{ action: 'approve' }` | 预先批准 |

---

## ⚛️ React 集成

通过 `@svton/agent-sdk/react` 子路径导入 React Hooks。

### 安装

```bash
npm install @svton/agent-sdk react react-dom
```

### AgentProvider

在组件树顶层提供 Agent 实例。

```tsx
import { AgentProvider } from '@svton/agent-sdk/react';

function App() {
  return (
    <AgentProvider
      config={{
        provider: { type: 'openai', apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com' },
        model: 'gpt-4o',
        tools: [myTool],
      }}
      fallback={<div>正在初始化 Agent...</div>}
    >
      <ChatView />
    </AgentProvider>
  );
}
```

| Prop | 类型 | 说明 |
|------|------|------|
| `config` | `CreateAgentConfig` | Agent 配置，同 `createAgent()` 的参数 |
| `fallback` | `ReactNode` | 初始化期间显示的加载内容（可选） |
| `children` | `ReactNode` | 子组件 |

> `AgentProvider` 在 mount 时创建 Agent，unmount 时自动释放。`config` 变更时会重新创建。

### useChat()

核心聊天 Hook，管理消息流和对话状态。

```typescript
const {
  messages,     // DisplayMessage[] — 当前对话消息
  status,       // ChatStatus — 'idle' | 'running' | 'waiting_approval' | 'error'
  isStreaming,  // boolean — 是否正在流式输出
  lastUsage,    // TokenUsage | null — 上次响应的 Token 用量
  send,         // (message: string, images?) => void — 发送消息
  abort,        // () => void — 中止当前对话
  clear,        // () => void — 清空消息并重置状态
} = useChat();
```

#### 发送消息（支持图片）

```tsx
function ChatInput() {
  const { send, isStreaming } = useChat();

  const handleSend = () => {
    send('分析这张图片', [
      { data: base64Image, mimeType: 'image/png' },
    ]);
  };

  return <button onClick={handleSend} disabled={isStreaming}>发送</button>;
}
```

#### 消息渲染

```tsx
function MessageList() {
  const { messages } = useChat();

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          {/* 角色标签 */}
          <span>{msg.role === 'user' ? '👤' : '🤖'}</span>

          {/* 文本内容 */}
          <p>{msg.content}</p>

          {/* 思维链（可折叠） */}
          {msg.thinking && <details><summary>思考过程</summary><pre>{msg.thinking}</pre></details>}

          {/* 内容块 */}
          {msg.blocks.map((block, i) => {
            switch (block.type) {
              case 'tool_call':
                return <ToolCallCard key={i} call={block.call} />;
              case 'error':
                return <div key={i} className="error">{block.text}</div>;
              default:
                return null;
            }
          })}

          {/* 工具调用列表 */}
          {msg.toolCalls.map(tc => (
            <div key={tc.id}>
              {tc.name} — {tc.status}
              {tc.result && <pre>{tc.result.output}</pre>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### useAgent()

获取 Agent 实例，用于直接操作。

```typescript
const { agent } = useAgent();

// 直接调用 Agent 方法
agent.addTool(newTool);
agent.getMessages();
```

### useToolApproval()

管理待审批的工具调用。

```typescript
const {
  pendingCalls,  // DisplayToolCall[] — 所有 status === 'pending_approval' 的工具调用
  approve,       // (callId: string) => void — 批准
  reject,        // (callId: string) => void — 拒绝
} = useToolApproval();
```

### React 类型

#### DisplayMessage

```typescript
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;           // 思维链内容
  error?: string;              // 错误信息
  images?: Array<{ data: string; mimeType?: string }>;
  toolCalls: DisplayToolCall[];
  blocks: ContentBlock[];
  isStreaming?: boolean;       // 是否仍在流式输出
  systemType?: 'default' | 'context_compacted';
  duration?: number;           // 响应耗时 (ms)
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

#### ContentBlock (React)

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

---

## 🧠 高级功能

### 技能 (Skills)

技能是一组预定义的指令，在特定场景下自动注入到 Agent 的上下文中。

```typescript
const codeReviewSkill: SkillDefinition = {
  name: 'code-review',
  description: '代码审查助手',
  instructions: `你是一个专业的代码审查专家。
请从以下维度审查代码：
1. 代码质量和可读性
2. 潜在 Bug 和安全问题
3. 性能优化建议
4. 最佳实践建议`,
  trigger: {
    type: 'implicit',
    patterns: ['审查代码', 'code review', 'review'],
  },
};

const agent = await createAgent({
  // ...
  skills: [codeReviewSkill],
});
```

### 记忆 (Memory)

启用记忆后，Agent 可以自动保存和召回重要信息。

```typescript
const agent = await createAgent({
  // ...
  memory: true,  // 启用 memory_save 和 memory_recall 工具
});
```

Agent 会：
- 在对话中主动使用 `memory_save` 保存用户偏好和重要事实
- 使用 `memory_recall` 查找相关记忆
- 记忆在会话间持久保存（基于 `IStorage`）

### 计划管理 (Planning)

启用计划后，Agent 可以创建和跟踪多步骤计划。

```typescript
const agent = await createAgent({
  // ...
  planning: true,  // 启用 plan_create / plan_update_step / plan_get_status
});
```

### 内置工具

SDK 自动注册以下工具（浏览器环境标记为可用）：

| 工具 | 说明 | 浏览器可用 |
|------|------|-----------|
| `web_search` | 网页搜索 | ✅ |
| `web_fetch` | 获取 URL 内容 | ✅ |
| `memory_save` | 保存记忆 | 需启用 `memory` |
| `memory_recall` | 召回记忆 | 需启用 `memory` |
| `plan_create` | 创建计划 | 需启用 `planning` |
| `plan_update_step` | 更新步骤状态 | 需启用 `planning` |
| `plan_get_status` | 获取计划进度 | 需启用 `planning` |

> 文件操作（file_read, file_write, file_edit, bash, grep, glob）需要桌面端（Tauri）环境。

---

## 📋 完整示例

### 带工具和审批的 Agent

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: {
    type: 'anthropic',
    apiKey: 'sk-ant-xxx',
  },
  model: 'claude-sonnet-4-20250514',
  systemPrompt: '你是一个项目管理助手。',
  tools: [
    {
      name: 'create_ticket',
      description: '创建项目工单',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '工单标题' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          description: { type: 'string' },
        },
        required: ['title'],
      },
      execute: async (args) => {
        const ticket = await api.createTicket(args);
        return `工单 #${ticket.id} 已创建: ${ticket.title}`;
      },
    },
  ],
  permission: 'default',
  memory: true,
  planning: true,
});

// 对话循环
const stream = agent.chat('帮我创建一个高优先级的登录 Bug 工单');

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.text);
      break;
    case 'tool_approval_needed':
      console.log(`\n工具 ${event.call.name} 需要审批:`, event.call.arguments);
      agent.approveToolCall(event.call.id);
      break;
    case 'done':
      console.log('\n--- 完成 ---');
      if (event.usage) {
        console.log(`Token 用量: ${event.usage.totalTokens}`);
      }
      break;
  }
}

await agent.dispose();
```

### 多 Provider 切换

```typescript
// OpenAI 兼容（支持 DeepSeek、Ollama 等）
const deepseekAgent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: 'sk-xxx',
    baseUrl: 'https://api.deepseek.com',
  },
  model: 'deepseek-chat',
});

// Anthropic
const claudeAgent = await createAgent({
  provider: {
    type: 'anthropic',
    apiKey: 'sk-ant-xxx',
  },
  model: 'claude-sonnet-4-20250514',
});
```

---

## 📤 导出列表

### 主入口 `@svton/agent-sdk`

**SDK 核心:**
- `createAgent` — 工厂函数
- `Agent` — Agent 类
- `FunctionToolExecutor` — 工具适配器

**SDK 类型:**
- `CreateAgentConfig`, `ProviderConfig`, `UserToolDefinition`, `SdkMcpServerConfig`, `ToolExecuteFn`

**Re-exported from `@svton/agent-core`:**
- 类型: `AgentEvent`, `AgentMode`, `RunOptions`, `ContextConfig`, `ChatMessage`, `ContentBlock`, `TextContent`, `ImageContent`, `ToolParameterSchema`, `ToolAnnotations`, `ToolDefinition`, `ToolCall`, `ToolResult`, `ToolContext`, `TokenUsage`, `ModelInfo`, `SkillDefinition`, `PermissionMode`, `HookEvent`, `HookContext`, `HookResult`, `HookHandler`
- 类: `AgentRuntime`, `ToolRegistry`, `OpenAIProvider`, `AnthropicProvider`, `PromptManager`, `PermissionManager`, `HookManager`, `MemoryManager`, `SkillManager`, `PlanningManager`, `SubagentManager`, `MCPClient`, `HTTPTransport`, `SSETransport`
- 内置工具: `webFetchDef` / `WebFetchExecutor`, `webSearchDef` / `WebSearchExecutor`, `fileReadDef` / `FileReadExecutor`, 等

**Re-exported from `@svton/agent-platform`:**
- `BrowserPlatform`, `IPlatform`

### React 入口 `@svton/agent-sdk/react`

- `AgentProvider` — React Context Provider
- `useChat` — 聊天 Hook
- `useAgent` — Agent 实例 Hook
- `useToolApproval` — 工具审批 Hook
- 类型: `ChatStatus`, `DisplayMessage`, `DisplayToolCall`, `ContentBlock`
- 类型 (re-export): `CreateAgentConfig`, `UserToolDefinition`, `ProviderConfig`, `SdkMcpServerConfig`
