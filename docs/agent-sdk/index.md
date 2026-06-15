# @svton/agent-sdk

高层 SDK — 一个 `createAgent()` 调用完成所有配置。

## 安装

```bash
pnpm add @svton/agent-sdk
```

## 快速开始

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = createAgent({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY!,
  tools: [
    {
      name: 'get_weather',
      description: '获取天气',
      parameters: { type: 'object', properties: { city: { type: 'string' } } },
      execute: async (args) => `天气: 晴 25°C`,
    },
  ],
});

const result = await agent.run('北京今天天气怎么样？');
console.log(result);
```

## React 集成

```tsx
import { AgentProvider, useChat } from '@svton/agent-sdk/react';

<AgentProvider agent={agent}>
  <MyChat />
</AgentProvider>
```

详见 [React SDK](./react)。
