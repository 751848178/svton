# @svton/agent-core

> Svton Agent 的核心运行时 — Provider、工具系统、Agent Runtime、MCP、记忆、自动化等。

## 安装

```bash
pnpm add @svton/agent-core
```

## 模块导航

| 模块 | 说明 |
|------|------|
| [Provider](./provider) | LLM 提供商抽象（OpenAI/Anthropic） |
| [工具系统](./tools) | ToolRegistry + 30+ 内置工具 |
| [AgentRuntime](./runtime) | ReAct 循环 + 事件流 |
| [记忆系统](./memory) | 自动提取 + 上下文回忆 |
| [自动化任务](./automation) | 定时/Cron/事件触发 |
| [子代理](./subagent) | 动态创建隔离 Agent |
| [MCP 协议](./mcp) | Model Context Protocol 客户端 |
| [权限系统](./permission) | 5 种模式 + 工具级控制 |
| [生命周期钩子](./hooks) | 8 种事件拦截 |
| [规划系统](./planning) | 多步骤计划追踪 |
| [技能系统](./skills) | 可扩展技能 + 市场 |
| [自定义 Agent](./agent-definition) | .svton/agents/*.md |
| [第三方集成](./integrations) | Slack/Linear |

## 快速开始

```typescript
import { AgentRuntime, OpenAIProvider, ToolRegistry } from '@svton/agent-core';

const provider = new OpenAIProvider({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'your-key',
  models: [{ id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 }],
});

const toolRegistry = new ToolRegistry();

const runtime = await AgentRuntime.createAsync({
  provider,
  model: 'gpt-4o',
  toolRegistry,
  workingDir: '/project',
});

for await (const event of runtime.run('分析项目结构')) {
  console.log(event.type, event);
}
```

## 相关文档

- [Provider](./provider) — LLM 提供商抽象（OpenAI / Anthropic）
- [工具系统](./tools) — ToolRegistry + 30+ 内置工具
- [AgentRuntime](./runtime) — ReAct 循环 + 事件流
- [记忆系统](./memory) — 自动提取 + 上下文回忆
- [自动化任务](./automation) — 定时 / Cron / 事件触发
- [子代理](./subagent) — 动态创建隔离 Agent
- [MCP 协议](./mcp) — Model Context Protocol 客户端
- [权限系统](./permission) — 5 种模式 + 工具级控制
- [生命周期钩子](./hooks) — 8 种事件拦截
- [规划系统](./planning) — 多步骤计划追踪
- [技能系统](./skills) — 可扩展技能 + 市场
- [自定义 Agent](./agent-definition) — Agent 人格定义
- [第三方集成](./integrations) — Slack / Linear 等
