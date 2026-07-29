# Provider 与模型配置(LLM 层)

> 自 Pi Agent 迁移起,svton 不再自己实现 OpenAI/Anthropic 的 wire 协议。LLM
> 的 **provider 注册、模型分发、流式生成、工具调用与扩展思考** 全部由
> [`@earendil-works/pi-ai`](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md)
> 提供;svton 只负责凭证边界与 UI 模型目录。

## 架构分层

```
┌─────────────────────────────────────────────┐
│  应用层(agent-app / agent-web / desktop)    │
│  ProviderConfig + ModelInfo → createPiModels │
└───────────────────┬─────────────────────────┘
                    │ createPiModelsForProvider()
┌───────────────────▼─────────────────────────┐
│  @svton/agent-core                          │
│  SvtonPiCredentialStore(凭证边界)           │
│  createPiModelsForProvider → Models + Model │
└───────────────────┬─────────────────────────┘
                    │ Models.streamSimple
┌───────────────────▼─────────────────────────┐
│  @earendil-works/pi-agent-core (Agent 循环) │
│  Agent.run() → 调度工具、续轮、终止         │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│  @earendil-works/pi-ai (provider/model 层)  │
│  openaiProvider / anthropicProvider         │
│  SSE/JSON 解析、鉴权、reasoning 映射        │
└─────────────────────────────────────────────┘
```

关键点:

- **svton 不再有 `IProvider` 接口**——历史里的 `OpenAIProvider`/`AnthropicProvider`
  类、`StreamEvent`/`ChatOptions` 类型已在 PI002/PI003 删除。运行时通过
  pi-ai 的 `Models` 对象直接调用。
- **凭证隔离**:`SvtonPiCredentialStore` 在 `agent-core` 与上游凭证存储之间
  划一条边界,API key 在请求级别透传(`AuthResolutionOverrides.apiKey`),
  不依赖 pi-ai 的环境变量回退。
- **自定义端点**:DeepSeek、Ollama、vLLM、Azure 等 OpenAI 兼容端点通过
  合成的 `Model` 对象携带 `baseUrl` 路由,无需改动 pi-ai 目录。

## createPiModelsForProvider

构建一个 pi-ai `Models` 集合(注册 OpenAI 或 Anthropic provider),挂载凭证
存储,并解析/合成给定模型 id 对应的 pi-ai `Model`:

```typescript
import { createPiModelsForProvider } from '@svton/agent-core';

const { models, model } = createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  baseUrl: 'https://api.openai.com/v1',   // 可选;DeepSeek/Ollama 换成对应地址
  models: [                                // svton UI 模型目录(可选,用于能力提示)
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsToolUse: true, supportsVision: true },
  ],
});

// models 喂给 AgentConfig.models,model 喂给 AgentConfig.piModel
```

### CreatePiModelsOptions

```typescript
interface CreatePiModelsOptions {
  family: 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  models?: ModelInfo[];   // svton UI 模型目录
  piProvider?: Provider;  // 测试注入:fauxProvider(...) 脚本化响应,无网络无真实 key
}
```

## ModelInfo(svton UI 模型目录)

`ModelInfo` 是 svton 维护的 UI 模型描述,被 `createPiModelsForProvider` 用于
能力提示(是否支持视觉/思考)以及在 pi-ai 目录里找不到模型 id 时合成一个
带正确 `baseUrl` 的 `Model`:

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

## ProviderConfig(应用层)

应用层(`agent-app` 的设置面板)维护一个 `ProviderConfig[]`,描述用户配置的
每个 provider 及其模型列表。`createAgentConfig` 会从中选出当前 provider,
用 `toModelInfo()` 映射成 `ModelInfo[]`,再交给 `createPiModelsForProvider`。

```typescript
interface ProviderConfig {
  family: 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow?: number;
    supportsToolUse?: boolean;
    supportsVision?: boolean;
    supportsStreaming?: boolean;
    supportsThinking?: boolean;
  }>;
}
```

## 内置 provider 家族

| family | pi-ai provider | 默认 baseUrl | 默认 API |
| --- | --- | --- | --- |
| `openai` | `openaiProvider()` | `https://api.openai.com/v1` | `openai-responses` |
| `anthropic` | `anthropicProvider()` | `https://api.anthropic.com/v1` | `anthropic-messages` |

## 示例:连接 Anthropic

```typescript
const { models, model } = createPiModelsForProvider('claude-sonnet-4-20250514', {
  family: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

## 示例:连接 DeepSeek / Ollama(自定义端点)

```typescript
const { models, model } = createPiModelsForProvider('deepseek-chat', {
  family: 'openai',
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseUrl: 'https://api.deepseek.com',
  models: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000, supportsVision: false },
  ],
});
```

## 相关文档

- [index](./index) — agent-core 总览
- [AgentRuntime](./runtime) — Pi Agent 循环 + 事件流
- [工具系统](./tools) — 工具定义与执行
- [权限系统](./permission) — 运行时权限检查

## 参考

- 设计文档:`docs-internal/design/pi-agent-migration-architecture.md`(§5.1 模型与消息)
- [pi-ai README](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md)
