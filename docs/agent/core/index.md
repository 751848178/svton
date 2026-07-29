# @svton/agent-core

> Svton Agent 的核心运行时——基于 [pi-agent-core](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md) 的 Agent 循环,叠加 svton 自有的工具系统、能力管理器与安全管线。

## 安装

```bash
pnpm add @svton/agent-core
```

## 架构分层

svton agent-core 不重复实现 LLM wire 协议或 ReAct 循环,而是在 Pi 之上做
产品层组合:

| 层 | 归属 | 职责 |
| --- | --- | --- |
| provider/model/stream | `@earendil-works/pi-ai` | OpenAI/Anthropic 注册、SSE/JSON 解析、鉴权、reasoning 映射 |
| Agent 循环/续轮/终止/消息源/工具调度 | `@earendil-works/pi-agent-core` | `Agent.run()`,工具调用批序、进度、续轮 |
| 组合根 + 能力 + 安全 | `@svton/agent-core` | `SvtonAgentRuntime`、凭证边界、审批门、压缩、事件翻译、记忆/技能/MCP/子代理/规划/权限/钩子 |

详见 [Pi Agent 迁移架构](#) (`docs-internal/design/pi-agent-migration-architecture.md`)。

## 模块导航

| 模块 | 说明 |
|------|------|
| [Provider 与模型配置](./provider) | pi-ai 模型/provider + `createPiModelsForProvider` |
| [工具系统](./tools) | ToolRegistry + 30+ 内置工具 |
| [SvtonAgentRuntime](./runtime) | Pi Agent 循环 + AgentEvent 事件流 |
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
import {
  SvtonAgentRuntime,
  ToolRegistry,
  createPiModelsForProvider,
} from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';

const { models, model } = createPiModelsForProvider('gpt-4o', {
  family: 'openai',
  apiKey: 'your-key',
});

const runtime = await SvtonAgentRuntime.createAsync(
  {
    models,
    piModel: model,
    model: 'gpt-4o',
    toolRegistry: new ToolRegistry(),
    workingDir: '/project',
  },
  new BrowserPlatform(),
);

for await (const event of runtime.run('分析项目结构')) {
  if (event.type === 'text_delta') process.stdout.write(event.text);
}
```

## 相关文档

- [Provider 与模型配置](./provider) — pi-ai 模型/provider 层
- [SvtonAgentRuntime](./runtime) — Pi Agent 循环 + 事件流
- [工具系统](./tools) — ToolRegistry + 30+ 内置工具
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
