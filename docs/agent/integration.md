# Agent 集成指南

本文说明如何把当前 Pi-backed Agent 接入 Web、Tauri 或自定义应用。

## 选择入口

| 需求 | 推荐入口 |
| --- | --- |
| 最少配置创建 Agent | `@svton/agent-sdk` |
| React hooks | `@svton/agent-sdk/react` 或 `@svton/agent-client` |
| 自定义 Runtime/能力管理器 | `@svton/agent-core` |
| 开箱即用 UI | `@svton/agent-app` |

## 契约所有权

Pi 是基础契约的唯一所有者：

- pi-ai：模型、provider、wire、消息 content；
- pi-agent-core：Agent state、`AgentMessage[]`、工具调度、原生生命周期；
- svton：permission、approval、auto-review、sandbox、hooks、redaction、
  MCP、Skills、Memory、Planning、Subagents、Checkpoint 和平台执行。

Client 的 Session/Display DTO 只在持久化和渲染边界使用。App 通过
`projectClientMessageToChatPanel()` 将 Client view 投影到 UI；`preview_images`
由 split-screen surface 消费，不进入 inline block union。

## 最简 SDK

```typescript
import { createAgent } from '@svton/agent-sdk';

const agent = await createAgent({
  provider: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  },
  model: 'gpt-4o',
});

for await (const event of agent.chat('你好')) {
  if (
    event.type === 'message_update'
    && event.assistantMessageEvent.type === 'text_delta'
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
}
```

DeepSeek 或自建 OpenAI-compatible endpoint：

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

## React

```tsx
import { AgentProvider, useChat, useToolApproval } from '@svton/agent-sdk/react';

function Root() {
  return (
    <AgentProvider config={{
      provider: { type: 'openai', apiKey },
      model: 'gpt-4o',
    }}>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { messages, send, abort, isStreaming } = useChat();
  const { pendingCalls, approve, reject } = useToolApproval();

  return (
    <>
      {messages.map((message) => (
        <div key={message.id}>{message.content}</div>
      ))}
      {pendingCalls.map((call) => (
        <div key={call.id}>
          {call.name}
          <button onClick={() => approve(call.id)}>Allow</button>
          <button onClick={() => reject(call.id)}>Deny</button>
        </div>
      ))}
      <button onClick={() => send('Hello')} disabled={isStreaming}>Send</button>
      <button onClick={abort}>Abort</button>
    </>
  );
}
```

## Advanced Core

```typescript
import {
  SvtonAgentRuntime,
  ToolRegistry,
  createPiModelsForProvider,
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';

const { models, model } = createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey,
});

const runtime = await SvtonAgentRuntime.createAsync(
  {
    models,
    piModel: model,
    model: 'gpt-4o',
    toolRegistry: new ToolRegistry(),
  },
  new BrowserPlatform(),
);
```

`run()` 公开 `PublicRuntimeEvent`。Pi 原生事件不改名；svton 只增加
`tool_approval_needed`、`skill_activated`、`context_compacted` 和 `warning`。

## 自定义工具

```typescript
import type { UserToolDefinition } from '@svton/agent-sdk';

const weatherTool = {
  name: 'get_weather',
  description: 'Get weather for a city',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
  execute: async (args: Record<string, unknown>) => {
    const city = args.city;
    if (typeof city !== 'string' || city.trim() === '') {
      throw new Error('city must be a non-empty string');
    }
    return JSON.stringify(await fetchWeather(city));
  },
} satisfies UserToolDefinition;

const agent = await createAgent({
  provider: { type: 'openai', apiKey },
  model: 'gpt-4o',
  tools: [weatherTool],
  permission: 'default',
});
```

Pi 负责 schema 校验和调度；工具执行仍经过 Svton security pipeline。

## Tauri

```typescript
import { TauriPlatform } from '@svton/agent-platform';

const agent = await createAgent({
  provider: { type: 'openai', apiKey },
  model: 'gpt-4o',
  platform: new TauriPlatform(),
  workingDir: '/path/to/project',
});
```

Tauri IPC 只由 `TauriPlatform` 适配。Runtime、Client 和 UI 不直接依赖
`invoke()`；文件、进程、存储、HTTP 和系统能力都从 `IPlatform` 进入。

## 会话恢复

```typescript
await agent.checkpoint('session-1');
await agent.resume('session-1');
```

Checkpoint 序列化 Pi canonical state。React Client 同时保存 Display DTO，
恢复时先恢复 canonical state，再从唯一的 Pi→Display 边界重新投影。

## 验证建议

- provider contract：确定性 faux provider；
- Runtime：多轮、工具结果、abort、approval、error 和 settlement；
- Web：真实浏览器 stream/thinking/tool/refresh；
- Desktop：真实 `tauri dev` WKWebView + Tauri IPC；
- 安全：permission、auto-review、sandbox、hooks、redaction 和 audit。

## 相关文档

- [SDK](./sdk/)
- [Core runtime](./core/runtime)
- [Core provider](./core/provider)
- [Core tools](./core/tools)
- [Tauri platform](./platform/tauri)
