/**
 * @svton/agent-sdk — High-level SDK for creating AI Agents.
 *
 * ```ts
 * import { createAgent } from '@svton/agent-sdk';
 * const agent = await createAgent({ provider: { type: 'openai', apiKey, model }, ... });
 * ```
 */

// SDK entry point
export { createAgent } from './create-agent';
export { Agent } from './agent';
export { FunctionToolExecutor } from './tool-adapter';
export type { ToolExecuteFn } from './tool-adapter';

// SDK-specific types
export type {
  CreateAgentConfig,
  ProviderConfig,
  UserToolDefinition,
  SdkMcpServerConfig,
} from './types';

// Re-export commonly needed types from agent-core
export type {
  AgentEvent,
  AgentMode,
  RunOptions,
  ContextConfig,
  ChatMessage,
  ContentBlock,
  TextContent,
  ImageContent,
  ToolParameterSchema,
  ToolAnnotations,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  TokenUsage,
  ModelInfo,
  SkillDefinition,
  PermissionMode,
  HookEvent,
  HookContext,
  HookResult,
  HookHandler,
} from '@svton/agent-core';

// Re-export core classes for advanced use
export {
  AgentRuntime,
  ToolRegistry,
  OpenAIProvider,
  AnthropicProvider,
  PromptManager,
  PermissionManager,
  HookManager,
  MemoryManager,
  SkillManager,
  PlanningManager,
  SubagentManager,
  MCPClient,
  HTTPTransport,
  SSETransport,
} from '@svton/agent-core';

// Re-export built-in tool defs & executors for advanced use
export {
  webFetchDef,
  WebFetchExecutor,
  webSearchDef,
  WebSearchExecutor,
  fileReadDef,
  FileReadExecutor,
  fileWriteDef,
  FileWriteExecutor,
  fileEditDef,
  FileEditExecutor,
  grepDef,
  GrepExecutor,
  globDef,
  GlobExecutor,
  bashDef,
  BashExecutor,
  memorySaveDef,
  MemorySaveExecutor,
  memoryRecallDef,
  MemoryRecallExecutor,
  planCreateDef,
  PlanCreateExecutor,
  planGetStatusDef,
  PlanGetStatusExecutor,
  planUpdateStepDef,
  PlanUpdateStepExecutor,
} from '@svton/agent-core';

// Re-export platform
export { BrowserPlatform } from '@svton/agent-platform';
export type { IPlatform } from '@svton/agent-platform';
