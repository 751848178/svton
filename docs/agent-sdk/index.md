# @svton/agent-sdk
> 高层 SDK — 一个 createAgent() 调用完成所有配置

高层 SDK — 通过一个 `createAgent()` 异步调用完成 Provider、ToolRegistry、Memory、Planning、MCP、Hooks 等全部配置，屏蔽底层 `@svton/agent-core` 的复杂装配逻辑。

## 安装

```bash
pnpm add @svton/agent-sdk
```

## 设计理念

直接使用 `@svton/agent-core` 需要手动创建十余个对象并正确连线：

| 手动步骤 (agent-core) | SDK 自动完成 |
|---|---|
| `new OpenAIProvider(...)` / `new AnthropicProvider(...)` | 根据 `provider.type` 自动创建 |
| `new ToolRegistry()` + 注册内置工具 | 自动注册 `web_fetch`、`web_search` |
| `new PromptManager()` + `addInstructions()` | 自动从 `systemPrompt` 配置 |
| `new PermissionManager(...)` | 自动从 `permission` 配置 |
| `new HookManager()` + 循环注册 | 自动从 `hooks` 映射注册 |
| `new MemoryManager()` + `init(storage)` + 注册工具 | `memory: true` 时自动完成 |
| `new PlanningManager()` + 注册计划工具 | `planning: true` 时自动完成 |
| `new MCPClient()` × N + `connect(transport)` | 自动遍历 `mcpServers` 连接 |
| `new SubagentManager(...)` | 自动创建并注入 runtime |
| `AgentRuntime.createAsync(config, platform)` | 自动装配并返回 `Agent` 包装类 |

SDK 将以上 10+ 步骤压缩为一次调用，返回一个具有 `chat()`、`abort()`、`addTool()`、`approveToolCall()` 等方法的 `Agent` 实例。

---

## 核心类型

### CreateAgentConfig

创建 Agent 的完整配置，所有字段除 `provider` 和 `model` 外均可选。

```typescript
export interface CreateAgentConfig {
  /** LLM 提供者配置 */
  provider: ProviderConfig;
  /** 模型 ID，例如 'gpt-4o'、'claude-sonnet-4-20250514' */
  model: string;

  // ---- 提示词 ----
  /** 自定义系统提示词（追加到基础模板之后） */
  systemPrompt?: string;

  // ---- 工具 ----
  /** 自定义工具列表 */
  tools?: UserToolDefinition[];
  /** MCP 服务器配置列表 */
  mcpServers?: SdkMcpServerConfig[];

  // ---- 能力开关 ----
  /** 启用自动记忆（持久化到平台存储），默认 false */
  memory?: boolean;
  /** 启用计划管理工具，默认 false */
  planning?: boolean;

  // ---- 权限 ----
  /** 权限模式，默认 'default' */
  permission?: PermissionMode;

  // ---- 钩子 ----
  /** 生命周期钩子注册表 */
  hooks?: Partial<Record<HookEvent, HookHandler>>;

  // ---- 技能 ----
  /** 技能定义列表 */
  skills?: SkillDefinition[];

  // ---- 高级 ----
  /** 上下文窗口配置 */
  contextConfig?: Partial<ContextConfig>;
  /** ReAct 循环最大迭代次数，默认 50 */
  maxIterations?: number;
  /** 工具的工作目录提示，默认 '/' */
  workingDir?: string;
  /** 自定义平台实现，默认 BrowserPlatform */
  platform?: IPlatform;
}
```

### ProviderConfig

LLM 提供者的统一配置。`type: 'openai'` 也适用于 Azure OpenAI、Ollama、vLLM、DeepSeek 等 OpenAI 兼容 API（通过 `baseUrl` 指向不同端点）。

```typescript
export interface ProviderConfig {
  /** 提供者类型 */
  type: 'openai' | 'anthropic';
  /** API 密钥 */
  apiKey: string;
  /**
   * Base URL
   * - openai 默认: 'https://api.openai.com'
   * - anthropic 默认: 'https://api.anthropic.com'
   */
  baseUrl?: string;
  /** 每个请求附加的自定义请求头 */
  customHeaders?: Record<string, string>;
  /** 模型列表覆盖（省略则使用提供者默认值） */
  models?: ModelInfo[];
}
```

连接 DeepSeek 示例：

```typescript
const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseUrl: 'https://api.deepseek.com',
  },
  model: 'deepseek-chat',
});
```

连接本地 Ollama 示例：

```typescript
const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: 'ollama',          // Ollama 不校验密钥，填任意值
    baseUrl: 'http://localhost:11434/v1',
  },
  model: 'llama3.1:8b',
});
```

### UserToolDefinition

用户自定义工具的扁平化定义。SDK 内部通过 `FunctionToolExecutor` 将 `execute` 函数适配为 `IToolExecutor` 接口。

```typescript
export interface UserToolDefinition {
  /** 工具名称（必须唯一） */
  name: string;
  /** 描述（供 LLM 判断何时调用此工具） */
  description: string;
  /** JSON Schema 参数定义 */
  parameters: ToolParameterSchema;
  /** 执行函数：接收解析后的参数和上下文，返回字符串输出 */
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
  /** 可选工具行为注解 */
  annotations?: ToolAnnotations;
}
```

### FunctionToolExecutor

将简单用户函数适配为 `IToolExecutor` 接口的适配器类。在 `execute` 内部：

1. 调用用户函数 `fn(call.arguments, context)`
2. 成功时返回 `{ callId, output }`
3. 异常时捕获并返回 `{ callId, output: errorMessage, isError: true }`

```typescript
export class FunctionToolExecutor implements IToolExecutor {
  constructor(private readonly fn: ToolExecuteFn) {}

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    try {
      const output = await this.fn(call.arguments, context);
      return { callId: call.id, output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { callId: call.id, output: message, isError: true };
    }
  }
}

// 类型别名
export type ToolExecuteFn = (
  args: Record<string, unknown>,
  context: ToolContext,
) => Promise<string>;
```

### SdkMcpServerConfig

MCP 服务器连接配置。SDK 支持 HTTP 和 SSE 两种传输协议。

```typescript
export interface SdkMcpServerConfig {
  /** 服务器端点 URL */
  url: string;
  /** 传输类型 */
  type: 'http' | 'sse';
  /** 显示名称（用作桥接工具前缀: mcp__{name}__tool） */
  name?: string;
  /** 认证请求头 */
  headers?: Record<string, string>;
  /** 按服务器过滤工具 */
  toolFilter?: {
    enabled?: string[];
    disabled?: string[];
    approvalMode?: 'auto' | 'ask' | 'deny';
  };
}
```

---

## 完整示例：自定义工具 + MCP 服务器

以下示例展示一个完整的生产级 Agent 配置：连接 OpenAI、注册两个自定义工具、连接两个 MCP 服务器、启用记忆与计划。

```typescript
import { createAgent } from '@svton/agent-sdk';
import type { UserToolDefinition, SdkMcpServerConfig } from '@svton/agent-sdk';

// --------------------------------------------------
// 1. 自定义工具：查询数据库
// --------------------------------------------------
const queryDatabaseTool: UserToolDefinition = {
  name: 'query_database',
  description: '执行只读 SQL 查询并返回 JSON 结果',
  parameters: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'SELECT 语句',
      },
      limit: {
        type: 'number',
        description: '返回行数上限，默认 100',
      },
    },
    required: ['sql'],
  },
  annotations: {
    readOnly: true,
    destructive: false,
  },
  execute: async (args, _context) => {
    const sql = args.sql as string;
    const limit = (args.limit as number) ?? 100;
    // 实际项目中替换为你的数据库连接
    const rows = await myDb.query(sql, limit);
    return JSON.stringify(rows, null, 2);
  },
};

// --------------------------------------------------
// 2. 自定义工具：发送通知
// --------------------------------------------------
const sendNotificationTool: UserToolDefinition = {
  name: 'send_notification',
  description: '向用户发送推送通知',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '通知标题' },
      body: { type: 'string', description: '通知正文' },
    },
    required: ['title', 'body'],
  },
  annotations: {
    readOnly: false,
    destructive: false,
  },
  execute: async (args, _context) => {
    const { title, body } = args as { title: string; body: string };
    await pushService.send({ title, body });
    return `通知已发送: ${title}`;
  },
};

// --------------------------------------------------
// 3. MCP 服务器配置
// --------------------------------------------------
const mcpServers: SdkMcpServerConfig[] = [
  {
    name: 'github',
    type: 'http',
    url: 'https://mcp.github.dev/sse',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    },
    toolFilter: {
      approvalMode: 'auto',
    },
  },
  {
    name: 'internal-tools',
    type: 'sse',
    url: 'https://internal.example.com/mcp/events',
    headers: {
      'X-API-Key': process.env.INTERNAL_API_KEY!,
    },
    toolFilter: {
      enabled: ['search_docs', 'get_ticket'],
      disabled: ['delete_ticket'],
      approvalMode: 'ask',
    },
  },
];

// --------------------------------------------------
// 4. 创建 Agent
// --------------------------------------------------
const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o',
  },
  model: 'gpt-4o',

  systemPrompt: '你是一个数据分析助手，可以查询数据库并发送通知。',

  tools: [queryDatabaseTool, sendNotificationTool],
  mcpServers,

  memory: true,
  planning: true,
  permission: 'default',
  maxIterations: 30,
  workingDir: '/data',

  hooks: {
    before_tool_call: async (ctx) => {
      console.log(`[hook] 即将调用工具: ${ctx.toolName}`);
      return { proceed: true };
    },
    after_run_complete: async (ctx) => {
      console.log(`[hook] 运行结束，token 用量:`, ctx.usage);
      return { proceed: true };
    },
  },
});

// --------------------------------------------------
// 5. 使用 Agent
// --------------------------------------------------
for await (const event of agent.chat('查询最近 10 条订单，并把结果发通知给我')) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.text);
      break;
    case 'tool_call':
      console.log(`\n[工具调用] ${event.name}(${JSON.stringify(event.arguments)})`);
      break;
    case 'tool_result':
      console.log(`[工具结果] ${event.output.slice(0, 200)}...`);
      break;
    case 'done':
      console.log(`\n[完成] 输入: ${event.usage.inputTokens}, 输出: ${event.usage.outputTokens}`);
      break;
  }
}

// --------------------------------------------------
// 6. 运行时动态注册工具
// --------------------------------------------------
agent.addTool({
  name: 'translate',
  description: '翻译文本',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      targetLang: { type: 'string' },
    },
    required: ['text', 'targetLang'],
  },
  execute: async (args) => {
    return await translationService(args.text, args.targetLang);
  },
});

// --------------------------------------------------
// 7. 会话保存与恢复
// --------------------------------------------------
await agent.checkpoint('session-001');
// ... 应用重启 ...
await agent.resume('session-001');

// --------------------------------------------------
// 8. 清理
// --------------------------------------------------
await agent.dispose();
```

---

## SDK 导出总览

### 主要导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `createAgent(config)` | 函数 | 一键创建 Agent |
| `Agent` | 类 | Agent 包装类（chat / abort / addTool 等） |
| `FunctionToolExecutor` | 类 | 用户函数适配器 |
| `BrowserPlatform` | 类 | 浏览器平台实现（从 agent-platform 再导出） |

### 类型导出

```typescript
// SDK 专有类型
export type { CreateAgentConfig, ProviderConfig, UserToolDefinition, SdkMcpServerConfig };

// 从 agent-core 再导出的常用类型
export type {
  AgentEvent, AgentMode, RunOptions, ContextConfig,
  ChatMessage, ContentBlock, TextContent, ImageContent,
  ToolParameterSchema, ToolAnnotations, ToolDefinition,
  ToolCall, ToolResult, ToolContext,
  TokenUsage, ModelInfo, SkillDefinition,
  PermissionMode, HookEvent, HookContext, HookResult, HookHandler,
};
```

### 高级再导出（agent-core 核心）

当需要更精细的控制时，SDK 直接再导出 agent-core 的核心类和内置工具，避免在项目中引入额外依赖：

```typescript
// 核心管理器
export {
  AgentRuntime, ToolRegistry,
  OpenAIProvider, AnthropicProvider,
  PromptManager, PermissionManager, HookManager,
  MemoryManager, SkillManager, PlanningManager,
  SubagentManager, MCPClient, HTTPTransport, SSETransport,
};

// 内置工具定义与执行器
export {
  webFetchDef, WebFetchExecutor,
  webSearchDef, WebSearchExecutor,
  fileReadDef, FileReadExecutor,
  fileWriteDef, FileWriteExecutor,
  fileEditDef, FileEditExecutor,
  grepDef, GrepExecutor,
  globDef, GlobExecutor,
  bashDef, BashExecutor,
  memorySaveDef, MemorySaveExecutor,
  memoryRecallDef, MemoryRecallExecutor,
  planCreateDef, PlanCreateExecutor,
  planGetStatusDef, PlanGetStatusExecutor,
  planUpdateStepDef, PlanUpdateStepExecutor,
};
```

---

## 与 agent-core 的对比

### 手动方式 (agent-core, 约 60 行)

```typescript
import {
  AgentRuntime, OpenAIProvider, ToolRegistry,
  PromptManager, PermissionManager, HookManager,
  MemoryManager, MCPClient, HTTPTransport,
  webFetchDef, WebFetchExecutor,
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';

const platform = new BrowserPlatform();
const provider = new OpenAIProvider({ apiKey: 'sk-xxx' });
const toolRegistry = new ToolRegistry();
toolRegistry.register(webFetchDef, new WebFetchExecutor());
const promptManager = new PromptManager();
promptManager.addInstructions('你是一个助手');
const permissionManager = new PermissionManager({ mode: 'default' });
const hookManager = new HookManager();
const memoryManager = new MemoryManager();
await memoryManager.init(platform.storage);
const mcpClient = new MCPClient();
await mcpClient.connect(new HTTPTransport({ url: 'https://mcp.example.com' }));
const runtime = await AgentRuntime.createAsync({
  provider, model: 'gpt-4o', toolRegistry, systemPrompt: '你是一个助手',
  capabilities: { promptManager, permissionManager, hookManager, memoryManager, mcpClients: [mcpClient] },
}, platform);
// 还需要手动管理生命周期...
```

### SDK 方式 (约 8 行)

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: { type: 'openai', apiKey: 'sk-xxx' },
  model: 'gpt-4o',
  systemPrompt: '你是一个助手',
  memory: true,
  mcpServers: [{ type: 'http', url: 'https://mcp.example.com' }],
});

for await (const event of agent.chat('你好')) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
}
```

---

## 下一步

- [React 集成](./react) — AgentProvider / useChat / useToolApproval
- [平台抽象层](../agent-platform) — BrowserPlatform / TauriPlatform
- [agent-core 文档](../agent-core) — 底层核心 API
