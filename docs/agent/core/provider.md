# Provider(LLM 提供商)

> 统一的 `IProvider` 接口抽象不同 LLM 服务商（OpenAI / Anthropic），支持流式输出、工具调用与扩展思考。

`@svton/agent-core` 通过统一的 `IProvider` 接口抽象不同的 LLM 服务商,目前内置支持:

- **OpenAIProvider** — 兼容所有 OpenAI Chat Completions 格式的服务(OpenAI、Azure OpenAI、Ollama、vLLM、DeepSeek 等)。
- **AnthropicProvider** — Anthropic Claude 系列,支持流式、工具调用和扩展思考(extended thinking)。

## 快速使用

<Demo name="provider-config" :height="500" />

```typescript
import { OpenAIProvider } from '@svton/agent-core';

const provider = new OpenAIProvider({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY!,
  models: [{ id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 }],
});

for await (const event of provider.chat(messages, { model: 'gpt-4o' })) {
  if (event.type === 'text') process.stdout.write(event.text);
}
```

## IProvider 接口

所有 Provider 都实现以下接口:

```typescript
interface IProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  chat(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamEvent>;

  countTokens(text: string): number;
  supportsToolUse(model: string): boolean;
  supportsVision(model: string): boolean;
}
```

### ChatMessage

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType?: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; output: string; isError?: boolean }
  | { type: 'reasoning'; text: string };
```

### ChatOptions

```typescript
interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;             // 默认 true
  systemPrompt?: string;
  signal?: AbortSignal;
  thinkingBudget?: number;      // Anthropic 扩展思考预算
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}
```

### StreamEvent

`chat()` 返回 `AsyncGenerator<StreamEvent>`,事件类型包括:

```typescript
type StreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_end'; id: string; name: string; arguments: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; stopReason: string };
```

### ModelInfo

```typescript
interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsToolUse: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsThinking?: boolean;
}
```

---

## OpenAIProvider

兼容所有实现 OpenAI Chat Completions API 格式的服务。

### 构造函数

```typescript
new OpenAIProvider(config: {
  name?: string;                    // 默认 'openai'
  baseUrl: string;                  // 例如 'https://api.openai.com'
  apiKey: string;
  models: ModelInfo[];
  customHeaders?: Record<string, string>;
})
```

### 示例:连接 OpenAI

```typescript
import { OpenAIProvider } from '@svton/agent-core';

const provider = new OpenAIProvider({
  baseUrl: 'https://api.openai.com',
  apiKey: process.env.OPENAI_API_KEY!,
  models: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      supportsToolUse: true,
      supportsVision: true,
      supportsStreaming: true,
    },
  ],
});
```

### 示例:连接 DeepSeek

```typescript
const provider = new OpenAIProvider({
  name: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
  models: [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      contextWindow: 64000,
      supportsToolUse: true,
      supportsVision: false,
      supportsStreaming: true,
    },
  ],
});
```

### 示例:连接本地 Ollama

```typescript
const provider = new OpenAIProvider({
  name: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: 'ollama',                 // Ollama 不校验,但字段必填
  models: [
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 8B',
      contextWindow: 128000,
      supportsToolUse: true,
      supportsVision: false,
      supportsStreaming: true,
    },
  ],
});
```

### 示例:流式调用

```typescript
const messages = [
  { role: 'user' as const, content: '解释量子隧穿效应' },
];

for await (const event of provider.chat(messages, {
  model: 'gpt-4o',
  stream: true,
})) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.text);
  } else if (event.type === 'done') {
    console.log(`\n停止原因: ${event.stopReason}`);
  }
}
```

### 特殊行为

- **reasoningEffort 映射**:OpenAI 的 `reasoning_effort` 仅支持 `low|medium|high`,`xhigh` 会被自动降级为 `high`。
- **工具调用缓冲**:OpenAI SSE 流不会显式发送每个工具调用的结束事件,Provider 会在流结束时统一 flush。
- **孤儿 tool_use 清理**:`sanitizeToolUseChain()` 自动剥离没有匹配 `tool_result` 的 `tool_use`,避免 API 报错。
- **图像结果降级**:对于截图等图像类工具结果,会向非视觉模型发送文本占位符,避免 API 报错。

---

## AnthropicProvider

连接 Anthropic Claude 系列模型,支持流式、工具调用、扩展思考。

### 构造函数

```typescript
new AnthropicProvider(config: {
  apiKey: string;
  baseUrl?: string;                 // 默认 'https://api.anthropic.com'
  models?: ModelInfo[];             // 默认包含 Sonnet 4 / Haiku 4
  customHeaders?: Record<string, string>;
})
```

默认模型列表:

| 模型 ID | 名称 | 上下文窗口 | 工具 | 视觉 | 思考 |
| --- | --- | --- | --- | --- | --- |
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | 200K | ✓ | ✓ | ✓ |
| `claude-haiku-4-20250506` | Claude Haiku 4 | 200K | ✓ | ✓ | ✓ |

### 示例

```typescript
import { AnthropicProvider } from '@svton/agent-core';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// 发送请求时会自动设置 anthropic-version: 2023-06-01 头
for await (const event of provider.chat(
  [{ role: 'user', content: '用 TypeScript 写一个快速排序' }],
  { model: 'claude-sonnet-4-20250514', stream: true },
)) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.text);
  }
}
```

### 示例:使用代理网关

```typescript
const provider = new AnthropicProvider({
  apiKey: 'my-key',
  baseUrl: 'https://my-proxy.example.com',
  customHeaders: {
    'X-Custom-Header': 'value',
  },
});
```

---

## 选择 Provider 的建议

| 场景 | 推荐 |
| --- | --- |
| 需要最强推理能力 | AnthropicProvider + Claude Sonnet 4 |
| 低延迟、轻量任务 | AnthropicProvider + Claude Haiku 4 |
| 企业内网/数据合规 | OpenAIProvider + Azure OpenAI |
| 本地部署 | OpenAIProvider + Ollama / vLLM |
| 预算敏感 | OpenAIProvider + DeepSeek |

## countTokens

两个 Provider 都提供简单的 token 估算(基于字符数和启发式规则),用于上下文窗口管理:

```typescript
const tokens = provider.countTokens('一段需要估算的文本');
console.log(`估算 tokens: ${tokens}`);
```

> 注意:这是粗略估算,与 Provider 实际计费可能略有差异。如需精确计数,建议使用各自的官方 tokenizer。

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — ReAct 循环核心，调用 Provider
- [工具系统](./tools) — 工具定义与执行
- [技能系统](./skills) — 渐进式加载领域知识
