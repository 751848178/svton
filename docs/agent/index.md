# AI Agent

> 可嵌入到任意 Svton(或独立)应用的 AI Agent 平台:运行时、SDK、组件库与开箱即用的应用。

Svton Agent 是一套分层体系:核心运行时(`agent-core`)→ 客户端(`agent-client`)→ UI 组件(`agent-ui`)→ 平台适配(`agent-platform`)→ 应用(`agent-app` / `agent-web`)。

## 章节导航

- **[集成指南](./integration)** — 从零把 Svton Agent 接入你的应用(Tauri / Web / 自定义工具 / Chrome 控制 / Computer Use)
- **[agent-sdk](./sdk/)** — 面向应用的 SDK(含 [React SDK](./sdk/react))
- **[agent-core](./core/)** — Agent 运行时:Provider、工具、Runtime、记忆、规划、技能、MCP、权限…
- **[多 Agent 开发架构](./core/multi-agent-architecture)** — 分层 Agent、任务板、上下文包与按需触发策略
- **[agent-client](./client/)** — React Hooks 与 Service 层
- **[agent-ui](./ui/)** — 聊天面板 / 消息 / 工具卡片等组件 + [消息块 Demo](./ui/blocks/plan)
- **[agent-platform](./platform/)** — 桌面平台适配([Tauri](./platform/tauri))
- **应用** — [agent-app(开箱即用)](./app/) / [agent-web](./web/)

## 快速选型

| 你想… | 看 |
|------|---|
| 直接用现成的 Agent 桌面/Web 应用 | [agent-app](./app/) / [agent-web](./web/) |
| 把 Agent 嵌入自己的 React 应用 | [agent-sdk](./sdk/) + [agent-ui](./ui/) |
| 定制 Agent 行为(工具/记忆/权限) | [agent-core](./core/) |
| 组织复杂开发任务、子代理和上下文隔离 | [多 Agent 开发架构](./core/multi-agent-architecture) |
