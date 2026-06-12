# @svton/agent-core

> 核心运行时 — ReAct 循环、Provider、工具系统、MCP、技能、记忆、权限、规划、子代理、插件。

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/agent-core` |
| **版本** | `0.2.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |
| **依赖** | `@svton/agent-platform` |

---

## 🎯 设计原则

1. **ReAct 架构** — Think → Act (Tool Call) → Observe → Think → ... 循环
2. **能力组合** — 8 个可选 Manager，按需启用
3. **事件驱动** — 所有输出通过 `AsyncGenerator<AgentEvent>` 流式返回
4. **Provider 无关** — 统一 `IProvider` 接口，支持 OpenAI / Anthropic 及兼容服务

---

## 📁 目录结构

```
agent-core/src/
├── agent/
│   ├── runtime.ts        # AgentRuntime — ReAct 循环核心
│   ├── context.ts        # ContextManager — 上下文管理
│   ├── tool-executor.ts  # ToolExecutionService — 工具执行管线
│   └── types.ts          # Agent 相关类型
├── provider/
│   ├── openai.ts         # OpenAI 兼容 Provider
│   ├── anthropic.ts      # Anthropic Provider
│   ├── sse-reader.ts     # SSE 流读取器
│   └── types.ts          # Provider 相关类型
├── tool/
│   ├── registry.ts       # ToolRegistry — 工具注册表
│   ├── types.ts          # 工具相关类型
│   └── builtins/         # 内置工具实现
│       ├── file.ts       # file_read / file_write / file_edit
│       ├── search.ts     # grep / glob
│       ├── shell.ts      # bash
│       ├── web.ts        # web_search / web_fetch
│       ├── memory.ts     # memory_save / memory_recall
│       ├── planning.ts   # plan_create / plan_update_step / plan_get_status
│       ├── computer-use.ts  # 截图 / 鼠标 / 键盘（Tauri）
│       └── chrome.ts     # Chrome CDP 工具（浏览器）
├── mcp/
│   ├── client.ts         # MCPClient — MCP 客户端
│   ├── server.ts         # MCPServer — MCP 服务器
│   ├── marketplace.ts    # McpMarketplace — Smithery.ai 集成
│   ├── types.ts          # MCP 相关类型
│   └── transport/        # 传输层
│       ├── http.ts       # HTTPTransport / SSETransport
│       └── stdio.ts      # StdioTransport
├── skill/
│   ├── manager.ts        # SkillManager — 技能发现与注入
│   ├── loader.ts         # SkillLoader — 技能解析与持久化
│   ├── installer.ts      # SkillInstaller — 技能安装
│   ├── marketplace.ts    # SkillMarketplace — skills.sh 集成
│   └── types.ts          # 技能相关类型
├── memory/
│   ├── manager.ts        # MemoryManager — 长期记忆
│   └── types.ts          # 记忆相关类型
├── prompt/
│   ├── manager.ts        # PromptManager — 提示词组装
│   └── types.ts          # 提示词相关类型
├── permission/
│   ├── manager.ts        # PermissionManager — 权限控制
│   └── types.ts          # 权限相关类型
├── hooks/
│   ├── manager.ts        # HookManager — 生命周期钩子
│   └── types.ts          # 钩子相关类型
├── planning/
│   ├── manager.ts        # PlanningManager — 任务规划
│   └── types.ts          # 规划相关类型
├── subagent/
│   ├── manager.ts        # SubagentManager — 子代理
│   └── types.ts          # 子代理相关类型
├── plugin/
│   ├── manager.ts        # PluginManager — 插件管理
│   └── types.ts          # 插件相关类型
├── utils/
│   ├── logger.ts         # 日志工具
│   └── token.ts          # Token 估算
└── index.ts              # 导出入口
```

---

## 🏗️ 架构概览

```
AgentRuntime (ReAct Loop)
├── IProvider (LLM 接口)
│   ├── OpenAIProvider (GPT-4o / DeepSeek / Ollama / vLLM)
│   └── AnthropicProvider (Claude Sonnet 4 / Haiku 4)
├── ToolRegistry (工具注册)
│   └── 内置工具 + MCP 桥接工具 + 用户自定义工具
├── ContextManager (上下文管理 — Token 估算 + 自动压缩)
├── PromptManager (提示词组装 — 模板 + 工具 + 技能 + 记忆)
│
├── Capability Managers (可选)
│   ├── SkillManager        — 技能发现与注入
│   ├── MemoryManager       — 长期记忆（项目 + 自动）
│   ├── PermissionManager   — 权限控制（5 种模式 + 规则引擎）
│   ├── HookManager         — 生命周期钩子（8 个事件）
│   ├── PlanningManager     — 任务规划（步骤依赖追踪）
│   ├── SubagentManager     — 子代理（隔离上下文 + 并行）
│   ├── MCPClient           — 外部协议桥接
│   └── PluginManager       — 插件管理
│
└── IPlatform (平台抽象 — 来自 @svton/agent-platform)
```

---

## 📖 API 参考

### 1. AgentRuntime

ReAct 循环核心。

#### 创建

```typescript
import { AgentRuntime, OpenAIProvider, ToolRegistry } from '@svton/agent-core';

// 同步创建（不桥接 MCP）
const runtime = AgentRuntime.create(config, platform);

// 异步创建（桥接 MCP 工具到 Registry）
const runtime = await AgentRuntime.createAsync(config, platform);
```

#### 核心 API

| 方法 | 签名 | 说明 |
|------|------|------|
| `create` | `(config, platform) => AgentRuntime` | 同步创建 |
| `createAsync` | `(config, platform) => Promise<AgentRuntime>` | 异步创建（桥接 MCP） |
| `run` | `(userMessage, options?) => AsyncGenerator<AgentEvent>` | 启动 ReAct 循环 |
| `abort` | `() => void` | 中止当前运行 |
| `approveToolCall` | `(callId: string) => void` | 批准工具调用 |
| `rejectToolCall` | `(callId: string) => void` | 拒绝工具调用 |
| `getMessages` | `() => ChatMessage[]` | 获取对话历史 |
| `setMessages` | `(messages: ChatMessage[]) => void` | 恢复对话历史 |
| `setPermissionManager` | `(mgr) => void` | 后置注入权限管理器 |
| `setHookManager` | `(mgr) => void` | 后置注入钩子管理器 |
| `setSubagentManager` | `(mgr) => void` | 后置注入子代理管理器 |

#### AgentConfig

```typescript
interface AgentConfig {
  provider: IProvider;               // LLM 提供者
  model: string;                     // 模型 ID
  toolRegistry: ToolRegistry;        // 工具注册表
  systemPrompt?: string;             // 自定义系统提示词
  contextConfig?: ContextConfig;     // 上下文配置
  maxIterations?: number;            // 最大 ReAct 迭代数（默认 50）
  workingDir?: string;               // 工作目录
  capabilities?: AgentCapabilities;  // 能力管理器集合
}
```

#### AgentCapabilities

```typescript
interface AgentCapabilities {
  skillManager?: SkillManager;
  memoryManager?: MemoryManager;
  promptManager?: PromptManager;
  permissionManager?: PermissionManager;
  hookManager?: HookManager;
  mcpClients?: MCPClient[];
  mcpServerConfigs?: McpServerToolConfig[];
  pluginManager?: PluginManager;
  subagentManager?: SubagentManager;
  planningManager?: PlanningManager;
}
```

#### ContextConfig

```typescript
interface ContextConfig {
  maxTokens: number;                 // 最大上下文 Token 数（默认 128000）
  compactionThreshold: number;       // 压缩阈值比例（默认 0.8）
  reservedForResponse: number;       // 为响应预留的 Token（默认 4096）
  preserveRecentMessages: number;    // 压缩时保留的最近消息数（默认 6）
}
```

#### RunOptions

```typescript
interface RunOptions {
  mode?: AgentMode;     // 'default' | 'plan' | 'auto'
  signal?: AbortSignal;
  maxIterations?: number;
}
```

#### AgentEvent 类型

| 事件 | 数据字段 | 说明 |
|------|----------|------|
| `text_delta` | `text` | LLM 文本增量输出 |
| `thinking_delta` | `thinking` | 思维链增量 |
| `tool_call_start` | `call: ToolCall` | 工具调用开始 |
| `tool_call_progress` | `callId, arguments` | 参数解析进度 |
| `tool_call_end` | `result: ToolResult` | 工具执行完成 |
| `tool_approval_needed` | `call: ToolCall` | 工具需要用户审批 |
| `context_compacted` | `summary` | 上下文压缩完成 |
| `subagent_start` | `agentId, task` | 子代理启动 |
| `subagent_end` | `agentId, summary` | 子代理完成 |
| `error` | `error: Error` | 运行时错误 |
| `done` | `stopReason, usage` | 运行结束 |

---

### 2. Provider 系统

#### IProvider 接口

```typescript
interface IProvider {
  readonly name: string;
  readonly models: ModelInfo[];
  chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamEvent>;
  countTokens(text: string): number;
  supportsToolUse(model: string): boolean;
  supportsVision(model: string): boolean;
}
```

#### OpenAIProvider

支持所有 OpenAI API 兼容的端点。

```typescript
import { OpenAIProvider } from '@svton/agent-core';

const provider = new OpenAIProvider({
  name: 'openai',                         // 默认 'openai'
  baseUrl: 'https://api.openai.com',      // 必填
  apiKey: 'sk-xxx',
  models: [{                              // 必填：模型列表
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
  }],
  customHeaders: {},                      // 可选
});
```

| 特性 | 说明 |
|------|------|
| SSE 流式 | ✅ |
| 工具调用 (Function Calling) | ✅ |
| 视觉 (Image Input) | ✅ |
| 推理内容 (reasoning_content) | ✅ DeepSeek / QwQ |
| 非流式回退 | ✅ |
| 自定义 Headers | ✅ |

**兼容服务**: OpenAI、Azure OpenAI、DeepSeek、Ollama、vLLM、LiteLLM

#### AnthropicProvider

```typescript
import { AnthropicProvider } from '@svton/agent-core';

const provider = new AnthropicProvider({
  apiKey: 'sk-ant-xxx',
  baseUrl: 'https://api.anthropic.com',   // 可选，默认值
  models: [{                              // 可选，有默认模型
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    contextWindow: 200000,
    supportsToolUse: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsThinking: true,
  }],
  customHeaders: {},
});
```

| 特性 | 说明 |
|------|------|
| SSE 流式 | ✅ |
| 工具调用 | ✅ |
| 视觉 | ✅ |
| Extended Thinking | ✅ (thinkingBudget 配置) |
| 连续同角色消息合并 | ✅ (Anthropic API 要求) |

**默认模型**: `claude-sonnet-4-20250514` (200K), `claude-haiku-4-20250506` (200K)

#### 消息类型

```typescript
// 内容块
type ContentBlock =
  | TextContent            // { type: 'text', text: string }
  | ImageContent           // { type: 'image', data: string, mimeType?: string }
  | ToolUseContent         // { type: 'tool_use', id, name, input }
  | ToolResultContent      // { type: 'tool_result', toolUseId, output, isError? }
  | ReasoningContent;      // { type: 'reasoning', text: string }

// 消息
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}
```

#### 流式事件 (StreamEvent)

| 事件 | 数据 | 说明 |
|------|------|------|
| `text_delta` | `text` | 文本增量 |
| `thinking_delta` | `thinking` | 思维链增量 |
| `tool_call_start` | `id, name` | 工具调用开始 |
| `tool_call_delta` | `id, arguments` | 参数增量 |
| `tool_call_end` | `id` | 工具调用结束 |
| `usage` | `TokenUsage` | Token 用量更新 |
| `done` | `stopReason` | 流结束 |

---

### 3. 工具系统

#### ToolRegistry

```typescript
class ToolRegistry {
  register(definition: ToolDefinition, executor: IToolExecutor): void;
  unregister(name: string): boolean;
  get(name: string): ToolEntry | null;
  listDefinitions(): ToolDefinition[];
  has(name: string): boolean;
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
  get size(): number;
}
```

#### 工具类型

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;    // JSON Schema
  annotations?: ToolAnnotations;
}

interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  callId: string;
  output: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;  // 结构化数据传递给 UI
}

interface ToolContext {
  platform: IPlatform;
  sessionId: string;
  workingDir: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}
```

#### IToolExecutor

```typescript
interface IToolExecutor {
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}
```

#### 内置工具

**文件操作（需要 Tauri 桌面端）:**

| 工具 | 执行器 | 参数 | 注解 |
|------|--------|------|------|
| `file_read` | `FileReadExecutor` | `{ path, offset?, limit? }` | readOnly |
| `file_write` | `FileWriteExecutor` | `{ path, content }` | destructive |
| `file_edit` | `FileEditExecutor` | `{ path, old_string, new_string, replace_all? }` | destructive |

**搜索（需要 Tauri 桌面端）:**

| 工具 | 执行器 | 参数 | 注解 |
|------|--------|------|------|
| `grep` | `GrepExecutor` | `{ pattern, path, include?, ignore_case?, max_results? }` | readOnly |
| `glob` | `GlobExecutor` | `{ pattern, path? }` | readOnly |

**Shell（需要 Tauri 桌面端）:**

| 工具 | 执行器 | 参数 | 注解 |
|------|--------|------|------|
| `bash` | `BashExecutor` | `{ command, timeout? }` | destructive, openWorld |

**Web（浏览器可用）:**

| 工具 | 执行器 | 参数 | 注解 |
|------|--------|------|------|
| `web_search` | `WebSearchExecutor` | `{ query, max_results? }` | readOnly, openWorld |
| `web_fetch` | `WebFetchExecutor` | `{ url, format? }` | readOnly, openWorld |

**记忆（需 MemoryManager）:**

| 工具 | 执行器 | 参数 | 注解 |
|------|--------|------|------|
| `memory_save` | `MemorySaveExecutor` | `{ content, category? }` | — |
| `memory_recall` | `MemoryRecallExecutor` | `{ keyword? }` | readOnly |

**规划（需 PlanningManager）:**

| 工具 | 执行器 | 参数 |
|------|--------|------|
| `plan_create` | `PlanCreateExecutor` | `{ title, steps: Array<{ title, description, dependencies? }> }` |
| `plan_get_status` | `PlanGetStatusExecutor` | `{ planId }` |
| `plan_update_step` | `PlanUpdateStepExecutor` | `{ planId, stepId, status, result? }` |

**Computer Use（仅 Tauri 桌面端）:**

| 工具 | 执行器 | 参数 |
|------|--------|------|
| `screenshot` | `ScreenshotExecutor` | `{ display? }` |
| `mouse_click` | `MouseClickExecutor` | `{ x, y, button? }` |
| `mouse_move` | `MouseMoveExecutor` | `{ x, y }` |
| `keyboard_type` | `KeyboardTypeExecutor` | `{ text }` |
| `keyboard_press_key` | `KeyboardPressKeyExecutor` | `{ key }` |

**Chrome CDP（仅浏览器，需 `--remote-debugging-port=9222`）:**

| 工具 | 执行器 | 参数 |
|------|--------|------|
| `chrome_navigate` | `ChromeNavigateExecutor` | `{ url }` |
| `chrome_screenshot` | `ChromeScreenshotExecutor` | `{ fullPage? }` |
| `chrome_click` | `ChromeClickExecutor` | `{ selector }` |
| `chrome_type` | `ChromeTypeExecutor` | `{ text }` |
| `chrome_evaluate` | `ChromeEvaluateExecutor` | `{ expression }` |
| `chrome_get_content` | `ChromeGetContentExecutor` | `{ selector? }` |

---

### 4. 上下文管理 (ContextManager)

管理对话历史，自动压缩超长上下文。

```typescript
import { ContextManager } from '@svton/agent-core';

const ctx = new ContextManager({
  maxTokens: 128000,               // 最大上下文 Token
  compactionThreshold: 0.8,        // 80% 时触发压缩
  reservedForResponse: 4096,       // 为响应预留
  preserveRecentMessages: 6,       // 压缩时保留最近 N 条
});

ctx.setProvider(provider, model);  // 启用 LLM 摘要压缩
ctx.addMessage(userMsg);
ctx.addMessage(assistantMsg);

if (ctx.needsCompaction()) {
  const { removed, kept, summary } = await ctx.compact();
}
```

**压缩策略：**
1. 保留所有 system 消息
2. 保留最近 N 条非 system 消息
3. 对被移除的消息：调用 LLM 生成摘要 → 注入为 `[Conversation Summary]`
4. 如果 LLM 摘要失败，静默回退到简单截断

---

### 5. MCP 协议支持

#### MCPClient

连接外部 MCP 服务器，桥接工具到 ToolRegistry。

```typescript
import { MCPClient, HTTPTransport } from '@svton/agent-core';

const client = new MCPClient();
await client.connect(new HTTPTransport({ url: 'https://mcp.example.com/api' }));

// 列出可用工具
const tools = await client.listTools();

// 调用工具
const result = await client.callTool('search', { query: 'hello' });

// 桥接到 ToolRegistry（命名空间: mcp__serverName__toolName）
const definitions = client.toToolDefinitions(tools);
const executor = client.createToolExecutor('search');
registry.register(definitions[0], executor);
```

| 方法 | 说明 |
|------|------|
| `connect(transport)` | 连接 MCP 服务器 |
| `disconnect()` | 断开连接 |
| `listTools()` | 列出服务器工具 |
| `callTool(name, args)` | 调用工具 |
| `listResources()` | 列出资源 |
| `readResource(uri)` | 读取资源 |
| `listPrompts()` | 列出 Prompt 模板 |
| `getPrompt(name, args?)` | 获取 Prompt |
| `toToolDefinitions(tools)` | 转换为 ToolRegistry 格式 |
| `createToolExecutor(toolName)` | 创建委托执行器 |

#### 传输层

| 传输 | 构造参数 | 说明 |
|------|----------|------|
| `HTTPTransport` | `{ url, headers? }` | HTTP POST + SSE 流式，支持 Session URL |
| `SSETransport` | `{ url, headers? }` | EventSource 遗留模式 |
| `StdioTransport` | `(process, command, args, env?, cwd?)` | 子进程 JSON-RPC（需要 Tauri） |

#### MCPServer

将本地工具暴露为 MCP 服务器。

```typescript
import { MCPServer, HTTPTransport } from '@svton/agent-core';

const server = new MCPServer();
await server.start(new StdioTransport(process, 'node', ['server.js']), toolRegistry);
```

#### McpMarketplace

Smithery.ai 集成，搜索和安装 MCP 服务器。

```typescript
import { McpMarketplace } from '@svton/agent-core';

const marketplace = new McpMarketplace(apiKey?);
const results = await marketplace.search('database');
const serverDetail = await marketplace.getServer('org/server-name');
const config = await marketplace.install('org/server-name', storage);
```

---

### 6. 技能系统

#### SkillManager

```typescript
import { SkillManager } from '@svton/agent-core';

const skillManager = new SkillManager();

// 注册技能
skillManager.register({
  name: 'code-review',
  description: '代码审查助手',
  instructions: '你是一个代码审查专家...',
  scope: 'user',
  trigger: { type: 'implicit', patterns: ['review', '审查'] },
  requiredTools: ['file_read', 'grep'],
});

// 查找相关技能
const skills = skillManager.findRelevant('帮我审查这段代码');

// 获取摘要（注入系统提示词）
const summary = skillManager.getSummaries();  // 默认 8000 字符
```

#### SkillLoader

解析 Markdown 格式的技能文件。

```typescript
import { SkillLoader } from '@svton/agent-core';

// 解析 Markdown（YAML 前言 + 正文）
const skill = SkillLoader.parseMarkdown(markdownContent);

// 从 IStorage 加载
const skills = await SkillLoader.fromStorage(storage);

// 自动发现（多来源优先级合并）
const { skills, errors } = await SkillLoader.discover(
  storage, platform, ['.svton/skills/'], workingDir
);
```

#### SkillInstaller

```typescript
import { SkillInstaller } from '@svton/agent-core';

const installer = new SkillInstaller(storage, platform);
await installer.installFromUrl('https://example.com/skill.md');
await installer.installFromGit('https://github.com/user/skill-repo');
await installer.uninstall('skill-name');
```

#### SkillMarketplace

skills.sh 集成。

```typescript
import { SkillMarketplace } from '@svton/agent-core';

const marketplace = new SkillMarketplace();
const skills = await marketplace.search('code review');
const curated = await marketplace.curated();
await marketplace.install('skill-id', storage);
```

#### SkillDefinition

```typescript
interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;          // 完整指令文本
  scope?: SkillScope;            // 'project' | 'user' | 'admin' | 'system'
  trigger?: SkillTrigger;        // 触发配置
  requiredTools?: string[];      // 依赖的工具
  requiredCapabilities?: string[]; // 依赖的平台能力
  allowedTools?: string[];       // 允许的工具白名单
  disallowedTools?: string[];    // 禁止的工具黑名单
  whenToUse?: string;            // 使用场景描述
  avoidWhen?: string;            // 避免场景描述
  triggerSignals?: string[];     // 触发信号
  version?: string;
  source?: SkillSource;          // 来源信息
}
```

---

### 7. 记忆系统

#### MemoryManager

```typescript
import { MemoryManager } from '@svton/agent-core';

const memory = new MemoryManager({ maxAutoEntries: 50 });
await memory.init(storage);

// 项目记忆（从 AGENT.md 文件加载）
await memory.loadProjectMemory(fs, '/project/root');
memory.addProjectMemory('项目使用 TypeScript + pnpm', '/project/AGENT.md');

// 自动记忆
await memory.saveAutoMemory('用户偏好 dark mode', 'user_preference');
await memory.deleteEntry('key');

// 检索
memory.getProjectMemoryText();   // 项目记忆文本
memory.getAutoMemoryText();      // 自动记忆文本
memory.getAllMemoryText();       // 全部记忆文本（注入系统提示词）
```

**两层记忆架构：**

| 层级 | 存储位置 | 用途 |
|------|----------|------|
| Project Memory | AGENT.md 文件（文件系统） | 项目规则、上下文 |
| Auto Memory | IStorage (IndexedDB / SQLite) | 学习到的偏好、事实 |

---

### 8. 提示词管理 (PromptManager)

```typescript
import { PromptManager } from '@svton/agent-core';

const promptManager = new PromptManager();

// 注册模板
promptManager.registerTemplate({
  name: 'code-assistant',
  description: '代码助手模板',
  template: '你是{{role}}，擅长{{skills}}...',
  variables: [{ key: 'role' }, { key: 'skills' }],
});

// 添加自定义指令
promptManager.addInstructions('始终使用 TypeScript 回答代码问题');

// 组装完整系统提示词
const systemPrompt = promptManager.compose({
  tools: registry.listDefinitions(),
  skillsSummary: skillManager.getSummaries(),
  memoryNotes: memoryManager.getAllMemoryText(),
  workingDir: '/project',
});
```

**组装顺序：**
1. 基础模板（Agent 准则 + Plan + Memory 指导）
2. Available Tools（工具描述）
3. Skills（技能摘要）
4. Context（记忆内容）
5. Additional Instructions（自定义指令）

---

### 9. 权限系统 (PermissionManager)

```typescript
import { PermissionManager } from '@svton/agent-core';

const permission = new PermissionManager({ mode: 'default' });

// 检查权限
const decision = permission.check({ id: '1', name: 'bash', arguments: { command: 'rm -rf /' } });
// decision = { allowed: false, needsApproval: true }

// 动态修改
permission.setMode('auto');
permission.addRule({ tool: 'bash', effect: 'deny' });
```

**5 种权限模式：**

| 模式 | 行为 |
|------|------|
| `read_only` | 只允许 file_read, grep, glob, web_search, web_fetch |
| `plan` | 同 read_only |
| `default` | 读取自动通过，其他需确认 |
| `accept_edits` | 读取 + 文件编辑自动通过，其他需确认 |
| `auto` | 所有操作自动执行 |

**规则引擎：** 优先级 `deny > ask > allow`，支持 `Tool(specifier)` glob 匹配。

---

### 10. 生命周期钩子 (HookManager)

```typescript
import { HookManager } from '@svton/agent-core';

const hooks = new HookManager();

// 注册钩子
const hookId = hooks.register({
  event: 'pre_tool_use',
  handler: async (ctx) => {
    if (ctx.toolName === 'bash') {
      return { action: 'deny', reason: '不允许执行 Shell 命令' };
    }
    return { action: 'continue' };
  },
  priority: 10,  // 数字越小越先执行
});

// 触发
const result = await hooks.trigger('pre_tool_use', { toolName: 'bash' });

// 注销
hooks.unregister('pre_tool_use', hookId);
```

**8 个钩子事件：**

| 事件 | 触发时机 |
|------|----------|
| `pre_tool_use` | 工具执行前 |
| `post_tool_use` | 工具执行后 |
| `permission_request` | 权限请求时 |
| `session_start` | 会话开始 |
| `session_end` | 会话结束 |
| `context_compact` | 上下文压缩完成 |
| `message_sent` | 消息发送 |
| `message_received` | 收到响应 |

**返回值：**
- `{ action: 'continue' }` — 继续
- `{ action: 'modify', updates }` — 修改上下文
- `{ action: 'deny', reason }` — 阻止（第一个 deny 短路）
- `{ action: 'approve' }` — 预先批准

---

### 11. 规划系统 (PlanningManager)

```typescript
import { PlanningManager } from '@svton/agent-core';

const planning = new PlanningManager();
await planning.init(storage);

// 创建计划
const plan = planning.createPlan('重构用户模块', [
  { title: '分析现有代码', description: '阅读当前实现' },
  { title: '设计新接口', description: '定义新的 API', dependencies: ['step_0'] },
  { title: '实现迁移', description: '编写新代码', dependencies: ['step_1'] },
]);

// 获取进度
const progress = planning.getProgress(plan.id);
// { total: 3, completed: 0, failed: 0, pending: 3 }

// 获取可执行步骤（依赖已完成）
const ready = planning.getReadySteps(plan.id);  // [{ id: 'step_0', ... }]

// 更新步骤状态
planning.updateStepStatus(plan.id, 'step_0', 'completed', '分析完成');

// 格式化
console.log(planning.formatPlan(plan.id));
```

---

### 12. 子代理系统 (SubagentManager)

```typescript
import { SubagentManager } from '@svton/agent-core';

const subagent = new SubagentManager(config, runtime, platform, toolRegistry);

// 启动单个子代理
const result = await subagent.spawn({
  task: '分析 src/utils/ 目录下的所有文件，找出性能瓶颈',
  model: 'gpt-4o-mini',
  toolAllowlist: ['file_read', 'grep', 'glob'],
  maxIterations: 20,
  timeout: 120000,  // 2 分钟
  roleDescription: '你是一个性能分析专家',
});

// 并行启动多个子代理
const results = await subagent.spawnParallel([
  { task: '分析前端代码', toolAllowlist: ['file_read'] },
  { task: '分析后端代码', toolAllowlist: ['file_read'] },
]);
```

**隔离机制：**
- 独立上下文（ContextManager）
- 继承父级工具（支持 allowlist / denylist）
- 不继承 SubagentManager（防止无限嵌套）

---

### 13. 插件系统 (PluginManager)

```typescript
import { PluginManager } from '@svton/agent-core';

const plugins = new PluginManager();
await plugins.init(storage);

// 从目录安装
await plugins.installFromDir('/path/to/plugin', fs);

// 从 Git 安装
await plugins.installFromGit('https://github.com/user/plugin', 'main', fs, exec);

// 管理
await plugins.enable('plugin-name');
await plugins.disable('plugin-name');
await plugins.uninstall('plugin-name');
```

**插件清单** (`.svton-plugin/plugin.json`):

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "示例插件",
  "skills": ["skill-name"],
  "mcpServers": [{ "name": "tools", "transport": "http", "url": "..." }],
  "hooks": [{ "event": "pre_tool_use" }]
}
```

---

### 14. 工具函数

#### Logger

```typescript
import { logger } from '@svton/agent-core';

logger.info('MyTag', '应用启动');
logger.error('MyTag', '出错了', error);

// 子 logger
const log = logger.child('SubModule');
log.debug('调试信息');
```

启用调试：`localStorage.setItem('agent:debug', 'true')` 或 `AGENT_DEBUG=true`。

#### countTokens

```typescript
import { countTokens } from '@svton/agent-core';

const tokens = countTokens('这是一段文本');  // CJK: ~2 字符/token
```
