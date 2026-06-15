# 第三方集成(Integrations)

> 外部服务集成 — 通过 Manifest 声明凭证和工具，动态启用/禁用 Slack、Linear 等。

`IntegrationManager` 管理外部服务的集成——如 Slack、Linear 等。集成通过 Manifest 声明所需凭证、提供的工具,可以动态启用/禁用。凭证持久化在 `IStorage` 中,启用后工具自动注册到 Agent。

## 快速使用

```typescript
import { IntegrationManager } from '@svton/agent-core';

const integrations = new IntegrationManager(storage);

// 初始化:加载内置 + 自定义集成清单
await integrations.init();

// 启用 Slack 集成并提供凭证
await integrations.enable('slack', {
  botToken: process.env.SLACK_BOT_TOKEN!,
});

// 启用后,Slack 工具自动注册到 ToolRegistry
const tools = integrations.resolveAllTools();
// → [{ name: 'slack_search', ... }, { name: 'slack_post', ... }]
```

## 类型定义

### IntegrationCategory

```typescript
type IntegrationCategory = 'comms' | 'issues' | 'docs' | 'general';
```

### AuthType

```typescript
type AuthType = 'api_key' | 'oauth' | 'none';
```

### AuthField

```typescript
interface AuthField {
  key: string;           // 凭证键名
  label: string;         // UI 标签
  secret: boolean;       // 是否为敏感字段(密码框)
  placeholder?: string;
}
```

### IntegrationManifest

```typescript
interface IntegrationManifest {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  authType: AuthType;
  authFields: AuthField[];
  iconUrl?: string;

  // 方式一:使用 MCP 服务器模板
  mcpServerTemplate?: {
    urlTemplate: string;          // 支持 {{credential}} 占位符
    type: 'http' | 'sse';
  };

  // 方式二:直接提供工具
  getTools?: (credentials: Record<string, string>) => Array<{
    definition: ToolDefinition;
    executor: IToolExecutor;
  }>;
}
```

### IntegrationConfig

```typescript
interface IntegrationConfig {
  id: string;
  enabled: boolean;
  credentials: Record<string, string>;
  addedAt: number;
}
```

---

## 内置集成

### Slack

```typescript
import { SlackIntegration } from '@svton/agent-core';
```

| 字段 | 值 |
| --- | --- |
| ID | `slack` |
| 名称 | Slack |
| 类别 | `comms` |
| 认证方式 | `api_key` |
| 认证字段 | `botToken`(Bot User OAuth Token) |

提供工具:
- `slack_search` — 搜索 Slack 消息
- `slack_post_message` — 发送消息到频道

### Linear

```typescript
import { LinearIntegration } from '@svton/agent-core';
```

| 字段 | 值 |
| --- | --- |
| ID | `linear` |
| 名称 | Linear |
| 类别 | `issues` |
| 认证方式 | `api_key` |
| 认证字段 | `apiKey`(Linear API Key) |

提供 Linear issue 管理相关工具。

---

## IntegrationManager API

### 构造函数与初始化

```typescript
import { IntegrationManager, SlackIntegration, LinearIntegration } from '@svton/agent-core';

const integrationManager = new IntegrationManager(storage);

// 注册内置 Manifest
integrationManager.registerManifest(SlackIntegration);
integrationManager.registerManifest(LinearIntegration);

// 加载已保存的配置
await integrationManager.init();
```

### registerManifest()

注册集成 Manifest:

```typescript
registerManifest(manifest: IntegrationManifest): void;
```

### listManifests()

列出所有已注册的 Manifest:

```typescript
listManifests(): IntegrationManifest[];
```

```typescript
for (const m of integrationManager.listManifests()) {
  console.log(`${m.name} [${m.category}]: ${m.description}`);
}
```

### enable()

启用集成,保存凭证:

```typescript
async enable(id: string, credentials: Record<string, string>): Promise<void>;
```

```typescript
// 启用 Slack 集成
await integrationManager.enable('slack', {
  botToken: 'xoxb-your-bot-token',
});

// 启用 Linear 集成
await integrationManager.enable('linear', {
  apiKey: 'lin_api_your_key',
});
```

### disable()

禁用集成(清除凭证):

```typescript
async disable(id: string): Promise<void>;
```

### isEnabled()

检查集成是否已启用:

```typescript
isEnabled(id: string): boolean;
```

### getCredential()

获取指定集成的凭证:

```typescript
getCredential(id: string, key: string): string | undefined;
```

```typescript
const token = integrationManager.getCredential('slack', 'botToken');
```

### resolveAllTools()

从所有已启用的集成解析工具,返回工具定义和执行器:

```typescript
resolveAllTools(): Array<{ definition: ToolDefinition; executor: IToolExecutor }>;
```

```typescript
const tools = integrationManager.resolveAllTools();
for (const { definition, executor } of tools) {
  registry.register(definition, executor);
}
```

---

## 添加自定义集成

### 方式一:直接提供工具

```typescript
const jiraManifest: IntegrationManifest = {
  id: 'jira',
  name: 'Jira',
  description: 'Atlassian Jira issue 跟踪',
  category: 'issues',
  authType: 'api_key',
  authFields: [
    {
      key: 'apiToken',
      label: 'Jira API Token',
      secret: true,
      placeholder: 'your-api-token',
    },
    {
      key: 'domain',
      label: 'Jira Domain',
      secret: false,
      placeholder: 'your-domain.atlassian.net',
    },
    {
      key: 'email',
      label: 'Account Email',
      secret: false,
      placeholder: 'you@example.com',
    },
  ],
  getTools: (credentials) => [
    {
      definition: {
        name: 'jira_search',
        description: '搜索 Jira issues',
        parameters: {
          type: 'object',
          properties: {
            jql: { type: 'string', description: 'JQL 查询语句' },
          },
          required: ['jql'],
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      executor: {
        async execute(call) {
          const { jql } = call.arguments as { jql: string };
          const resp = await fetch(
            `https://${credentials.domain}/rest/api/3/search?jql=${encodeURIComponent(jql)}`,
            {
              headers: {
                Authorization: `Basic ${btoa(`${credentials.email}:${credentials.apiToken}`)}`,
              },
            },
          );
          const data = await resp.json();
          return {
            callId: call.id,
            output: JSON.stringify(data.issues?.map((i: any) => ({
              key: i.key,
              summary: i.fields.summary,
              status: i.fields.status.name,
            })) ?? []),
          };
        },
      },
    },
    {
      definition: {
        name: 'jira_create_issue',
        description: '创建 Jira issue',
        parameters: { /* ... */ },
      },
      executor: { /* ... */ },
    },
  ],
};

integrationManager.registerManifest(jiraManifest);
```

### 方式二:使用 MCP 服务器模板

```typescript
const notionManifest: IntegrationManifest = {
  id: 'notion',
  name: 'Notion',
  description: 'Notion 文档和工作区',
  category: 'docs',
  authType: 'api_key',
  authFields: [
    {
      key: 'apiKey',
      label: 'Notion Integration Token',
      secret: true,
    },
  ],
  mcpServerTemplate: {
    urlTemplate: 'https://mcp.notion.com/sse?token={{apiKey}}',
    type: 'sse',
  },
};
```

使用 MCP 模板时,系统会自动创建 MCPClient 连接,无需手动编写执行器。

---

## 与 AgentRuntime 集成

```typescript
// 1. 创建并初始化
const integrationManager = new IntegrationManager(storage);
integrationManager.registerManifest(SlackIntegration);
integrationManager.registerManifest(LinearIntegration);
await integrationManager.init();

// 2. 启用需要的集成
await integrationManager.enable('slack', { botToken: 'xoxb-...' });

// 3. 将工具注册到 registry
const tools = integrationManager.resolveAllTools();
for (const { definition, executor } of tools) {
  toolRegistry.register(definition, executor);
}

// 4. 创建 runtime
const runtime = await AgentRuntime.createAsync(
  {
    provider,
    model: 'claude-sonnet-4-20250514',
    toolRegistry,
  },
  platform,
);

// 5. 现在 Agent 可以使用 slack_search、slack_post_message 等工具
for await (const event of runtime.run('在 #general 频道搜索关于 v2 发布的讨论')) {
  // ...
}
```

---

## 凭证安全

- 凭证存储在 `IStorage` 中,键前缀为 `agent:integration:`。
- `disable()` 会清除凭证。
- `AuthField.secret: true` 的字段在 UI 中应以密码框形式展示。
- 建议在桌面端使用系统钥匙串加密存储(由 `IStorage` 实现决定)。

## 最佳实践

- **最小权限**:只启用需要的集成,不用就 `disable()`。
- **使用 MCP 模板**:如果目标服务有 MCP 服务器,优先用 `mcpServerTemplate` 而非手写执行器。
- **按需注册工具**:`resolveAllTools()` 只返回已启用集成的工具,自然实现按需加载。
- **分类清晰**:自定义集成要正确设置 `category`,便于 UI 分组展示。

## 相关文档

- [index](./index) — agent-core 总览
- [工具系统](./tools) — 启用后集成工具注册到 ToolRegistry
- [MCP 协议](./mcp) — 替代集成的 MCP 服务器方式
- [自动化任务](./automation) — 集成事件可触发自动化
- [权限系统](./permission) — 集成工具的权限控制
