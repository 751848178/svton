# MCP 协议(Model Context Protocol)

> 内置 MCP 客户端 — 连接外部服务器发现和使用工具、资源、提示模板，集成 Smithery 市场。

`@svton/agent-core` 内置完整的 MCP(Model Context Protocol)客户端实现,支持连接外部 MCP 服务器来发现和使用工具、资源、提示模板。同时集成 Smithery 市场,可以一键安装 MCP 服务器。

## 快速使用

```typescript
import { MCPClient, HTTPTransport } from '@svton/agent-core';

const client = new MCPClient();

// 连接到远程 MCP 服务器
await client.connect(new HTTPTransport({
  url: 'https://mcp.example.com/sse',
  headers: { Authorization: `Bearer ${token}` },
}));

// 列出可用工具
const tools = await client.listTools();
```

## 支持的传输方式

| 传输 | 类 | 适用场景 |
| --- | --- | --- |
| **HTTP/SSE** | `HTTPTransport` | 远程 MCP 服务器(Web + 桌面) |
| **Stdio** | `StdioTransport` | 本地 MCP 进程(仅桌面) |

---

## MCPClient

### 基本用法

```typescript
import { MCPClient, HTTPTransport } from '@svton/agent-core';

const client = new MCPClient();

// 连接到远程 MCP 服务器
await client.connect(new HTTPTransport({
  url: 'https://mcp.example.com/sse',
  headers: { Authorization: `Bearer ${token}` },
}));

// 检查连接状态
console.log(client.connected);  // true
console.log(client.info);        // MCPServerInfo

// 列出可用工具
const tools = await client.listTools();
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`);
}

// 调用工具
const result = await client.callTool('search', { query: 'AI agents' });
console.log(result.output);

// 断开连接
await client.disconnect();
```

### 连接生命周期

```typescript
class MCPClient {
  get connected(): boolean;
  get info(): MCPServerInfo | null;

  async connect(transport: ITransport): Promise<void>;
  async disconnect(): Promise<void>;
}
```

`connect()` 内部执行 MCP 初始化握手:
1. 发送 `initialize` 请求(协议版本 `2024-11-05`)。
2. 获取服务器信息和能力声明。
3. 发送 `notifications/initialized` 通知。

### 工具操作

```typescript
// 列出工具(带缓存)
const tools = await client.listTools();

// 调用工具
const result = await client.callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
```

`listTools()` 结果会被缓存,同一连接内不会重复请求。

---

## HTTPTransport

基于 HTTP POST + SSE 的流式传输,兼容 MCP 规范的 Streamable HTTP 模式。

```typescript
import { HTTPTransport } from '@svton/agent-core';

const transport = new HTTPTransport({
  url: 'https://mcp.example.com/sse',
  headers: {
    Authorization: 'Bearer token',
    'X-Custom': 'value',
  },
});
```

特性:
- 自动处理 `Mcp-Session-Id` 头部,维护会话。
- 自动解析 SSE 响应(`text/event-stream`)和 JSON 响应。

## SSETransport

与 `HTTPTransport` 类似,但专门用于纯 SSE 端点:

```typescript
import { SSETransport } from '@svton/agent-core';
```

## StdioTransport

通过子进程的 stdin/stdout 通信,每行一个 JSON-RPC 消息。仅适用于桌面环境(需要进程访问权限)。

```typescript
import { StdioTransport } from '@svton/agent-core';

const transport = new StdioTransport(
  platform.process,         // IProcess 实现
  'npx',                    // 命令
  ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],  // 参数
  { ENV_VAR: 'value' },     // 环境变量(可选)
  '/working/dir',           // 工作目录(可选)
);

await client.connect(transport);
```

---

## ITransport 接口

所有传输实现以下接口:

```typescript
interface ITransport {
  connect(): Promise<void>;
  send(message: JSONRPCRequest): Promise<void>;
  close(): Promise<void>;
  onMessage(handler: (message: JSONRPCResponse) => void): void;
}
```

---

## JSON-RPC 消息类型

```typescript
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface JSONRPCMessage {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}
```

## MCPToolDefinition

```typescript
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

---

## 工具发现与桥接

### 在 AgentRuntime 中自动桥接

使用 `createAsync()` 创建 runtime 时,所有已连接的 MCP 客户端工具会自动桥接到工具注册表:

```typescript
const mcpClient1 = new MCPClient();
await mcpClient1.connect(new HTTPTransport({ url: 'https://mcp1.example.com/sse' }));

const mcpClient2 = new MCPClient();
await mcpClient2.connect(new StdioTransport(platform.process, 'npx', ['@mcp/server-git']));

const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
    capabilities: {
      mcpClients: [mcpClient1, mcpClient2],
    },
  },
  platform,
);
```

### 按 MCP 服务器配置工具权限

```typescript
import type { McpServerToolConfig } from '@svton/agent-core';

const mcpServerConfigs = new Map<string, McpServerToolConfig>([
  ['mcp1', {
    approvalMode: 'auto',            // 'auto' | 'ask' | 'deny'
    enabledTools: ['search', 'read'],
    disabledTools: ['delete'],
  }],
]);

capabilities: {
  mcpClients: [mcpClient1],
  mcpServerConfigs,
}
```

---

## MCPServer

`@svton/agent-core` 也提供 MCP 服务器端实现,可以将自己的工具暴露为 MCP 服务:

```typescript
import { MCPServer } from '@svton/agent-core';

const server = new MCPServer({ name: 'my-mcp-server', version: '1.0.0' });
// 注册工具和处理程序,然后监听传输层
```

---

## McpMarketplace(Smithery 市场)

集成 [Smithery.ai](https://smithery.ai) 市场,可以浏览、搜索和安装 MCP 服务器:

```typescript
import { McpMarketplace } from '@svton/agent-core';

const marketplace = new McpMarketplace();
// 或带 API Key: new McpMarketplace('your-api-key');

// 搜索
const result = await marketplace.search('github', 1, 20);
for (const server of result.servers) {
  console.log(`${server.displayName}: ${server.description}`);
  console.log(`  使用次数: ${server.useCount}, 已验证: ${server.verified}`);
}

// 获取详情
const detail = await marketplace.getDetails('@modelcontextprotocol/server-github');
console.log(`工具数: ${detail.tools?.length}`);
console.log(`连接方式:`);
for (const conn of detail.connections) {
  console.log(`  - ${conn.type}: ${conn.bundleUrl || conn.deploymentUrl}`);
}
```

### Marketplace API

```typescript
class McpMarketplace {
  constructor(apiKey?: string, baseUrl?: string);

  async search(query: string, page?: number, pageSize?: number): Promise<McpMarketplaceResult>;
  async list(page?: number, pageSize?: number): Promise<McpMarketplaceResult>;
  async getDetails(qualifiedName: string): Promise<McpMarketplaceServerDetail>;
}
```

### McpMarketplaceServer

```typescript
interface McpMarketplaceServer {
  id: string;
  qualifiedName: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  verified: boolean;
  useCount: number;
  remote: boolean | null;
  createdAt: string;
  homepage: string;
}
```

---

## 完整示例

```typescript
import {
  AgentRuntime, AnthropicProvider, ToolRegistry,
  MCPClient, HTTPTransport, McpMarketplace,
} from '@svton/agent-core';

// 1. 从市场查找 GitHub MCP 服务器
const marketplace = new McpMarketplace();
const searchResult = await marketplace.search('github');
const githubServer = searchResult.servers[0];

// 2. 获取详情确定连接方式
const detail = await marketplace.getDetails(githubServer.qualifiedName);
const httpConn = detail.connections.find(c => c.type === 'http');

// 3. 连接 MCP 服务器
const mcpClient = new MCPClient();
await mcpClient.connect(new HTTPTransport({
  url: httpConn.deploymentUrl!,
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
}));

// 4. 创建 runtime,自动桥接 MCP 工具
const runtime = await AgentRuntime.createAsync(
  {
    provider: new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    model: 'claude-sonnet-4-20250514',
    toolRegistry: new ToolRegistry(),
    capabilities: { mcpClients: [mcpClient] },
  },
  platform,
);

// 5. 运行 — Agent 现在可以使用 GitHub MCP 工具
for await (const event of runtime.run('查看 svton/svton 仓库最近的 5 个 issue')) {
  // ...
}
```

## 相关文档

- [index](./index) — agent-core 总览
- [工具系统](./tools) — MCP 工具自动桥接到 ToolRegistry
- [第三方集成](./integrations) — 替代 MCP 的集成方式
- [AgentRuntime](./runtime) — 运行时通过 capabilities 配置 MCP 客户端
