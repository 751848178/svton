# @svton/agent-platform

## 0.2.0

### Minor Changes

- Initial release of AI Agent packages
  - **@svton/agent-platform**: Platform abstraction layer (browser, tauri) with IFileSystem, IProcess, IStorage, ISearch interfaces
  - **@svton/agent-core**: Framework-agnostic ReAct loop runtime with provider (OpenAI/Anthropic), tool registry, MCP client/server, memory, skills, planning, hooks, subagents, and permissions
  - **@svton/agent-client**: React integration layer with ChatService, SessionService, hooks (useChat, useSession, useToolApproval), and AgentProvider
  - **@svton/agent-sdk**: High-level SDK with createAgent() one-call entry, Agent wrapper class, and /react sub-path export (AgentProvider, useChat, useToolApproval)
