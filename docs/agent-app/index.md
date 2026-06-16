# @svton/agent-app

Out-of-the-box AI agent application. One component, full chat capability, zero configuration.

::: tip 🚀 在线体验
[**点击这里立即体验 →**](/svton/agent-app-demo/)
输入你的 API Key 即可在浏览器中完整体验 AgentApp 的全部能力，无需安装任何东西。
:::

## 安装

```bash
npm install @svton/agent-app reflect-metadata
# or
pnpm add @svton/agent-app reflect-metadata
```

## 快速开始

```tsx
import 'reflect-metadata';
import { AgentApp } from '@svton/agent-app';

export default function App() {
  return (
    <AgentApp
      providers={[{
        type: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      }]}
    />
  );
}
```

完成。你将获得一个完整的 AI Agent 应用，包含：

- 流式对话 + 工具调用
- 多模型切换
- 权限模式（只读 / 默认 / 接受编辑 / 全自动）
- 推理强度控制（Low / Medium / High / Xhigh）
- 图片生成
- 代码审查（`/review`）
- 文档预览（分屏）
- 会话管理（新建 / 切换 / 删除）
- 记忆系统
- 计划系统
- 设置页面（Provider 配置、工具开关、技能管理）
- localStorage 持久化

## 多 Provider 配置

```tsx
<AgentApp
  providers={[
    {
      type: 'openai',
      apiKey: 'sk-...',
      models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
    },
    {
      type: 'anthropic',
      apiKey: 'sk-ant-...',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
      ],
    },
  ]}
  defaultModel="gpt-4o"
/>
```

## 功能开关

通过 `features` 属性可以禁用不需要的功能：

```tsx
<AgentApp
  providers={[...]}
  features={{
    imageGeneration: false,   // 禁用图片生成
    codeReview: true,         // 启用代码审查
    documentPreview: true,    // 启用文档预览
    webSearch: false,         // 禁用网络搜索
    sessionResume: true,      // 启用会话恢复
    agentDefinitions: true,   // 启用 Agent 定义
  }}
/>
```

## 自定义技能

```tsx
import type { SkillDefinition } from '@svton/agent-core';

const mySkill: SkillDefinition = {
  name: 'my-skill',
  description: 'A custom skill for my workflow',
  instructions: 'When the user asks to...',
  triggerSignals: ['my-task'],
};

<AgentApp
  providers={[...]}
  skills={[mySkill]}
/>
```

## MCP 服务器

```tsx
<AgentApp
  providers={[...]}
  mcpServers={[{
    name: 'my-mcp',
    url: 'https://my-mcp-server.com/sse',
    type: 'sse',
    enabled: true,
  }]}
/>
```

## Props 参考

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `providers` | `ProviderConfig[]` | 是 | LLM Provider 配置列表 |
| `defaultModel` | `string` | 否 | 默认模型 ID |
| `systemPrompt` | `string` | 否 | 额外的系统提示词 |
| `searchEndpoint` | `string` | 否 | 网络搜索 API 端点 |
| `features` | `FeatureFlags` | 否 | 功能开关 |
| `skills` | `SkillDefinition[]` | 否 | 自定义技能 |
| `mcpServers` | `McpServerEntry[]` | 否 | MCP 服务器配置（仅 HTTP/SSE） |
| `title` | `string` | 否 | 应用标题（默认 "Svton Agent"） |
| `maxIterations` | `number` | 否 | ReAct 循环上限（默认 50） |
| `contextConfig` | `object` | 否 | 上下文窗口配置 |

## 架构

```
@svton/agent-app
  ├── AgentApp              主组件（初始化 + 状态管理）
  ├── AgentShell            布局外壳（侧边栏 + 对话 + 设置）
  ├── createAgentConfig     工具/Manager 接线（14+ 步）
  └── DefaultSettingsAdapter localStorage 持久化适配器
```

基于以下包构建：
- [@svton/agent-core](/agent-core/) — 运行时引擎
- [@svton/agent-client](/agent-client/) — React Hooks + Services
- [@svton/agent-ui](/agent-ui/) — UI 组件库
- [@svton/service](https://www.npmjs.com/package/@svton/service) — 响应式状态管理

## 导出

```tsx
// 主组件
import { AgentApp } from '@svton/agent-app';

// 子组件（可单独使用）
import { AgentShell } from '@svton/agent-app';

// 工具函数
import { createAgentConfig } from '@svton/agent-app';
import { DefaultSettingsAdapter } from '@svton/agent-app';

// 类型
import type { AgentAppProps, ProviderConfig, FeatureFlags } from '@svton/agent-app';
```
