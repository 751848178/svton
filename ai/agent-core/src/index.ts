/**
 * @svton/agent-core
 *
 * Core runtime for the Svton AI Agent platform.
 * Framework-agnostic, runs in browser, Electron, or Taro.
 */

// Provider (LLM abstraction)
export type {
  IProvider,
  ChatMessage,
  ChatOptions,
  StreamEvent,
  TokenUsage,
  ModelInfo,
  ToolDefinition,
  ToolAnnotations,
  ToolParameterSchema,
  ContentBlock,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolResultContent,
} from './provider/types';

export { OpenAIProvider } from './provider/openai';
export { AnthropicProvider } from './provider/anthropic';

// Tool system
export type {
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
  ToolEntry,
} from './tool/types';

export { ToolRegistry } from './tool/registry';

export {
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
  webSearchDef,
  WebSearchExecutor,
  webFetchDef,
  WebFetchExecutor,
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
} from './tool/builtins';

// Agent runtime
export type {
  AgentEvent,
  AgentMode,
  RunOptions,
  AgentConfig,
  AgentCapabilities,
  ContextConfig,
  PendingApproval,
  IRuntime,
} from './agent/types';

export { AgentRuntime } from './agent/runtime';
export { ContextManager } from './agent/context';

// Prompt management
export type { PromptTemplate, PromptVariable } from './prompt/types';
export { PromptManager } from './prompt/manager';

// Permission system
export type {
  PermissionMode,
  PermissionRule,
  PermissionConfig,
  PermissionDecision,
} from './permission/types';

export { PermissionManager } from './permission/manager';

// Hooks lifecycle
export type {
  HookEvent,
  HookContext,
  HookResult,
  HookHandler,
  HookConfig,
} from './hooks/types';

export { HookManager } from './hooks/manager';

// MCP Protocol
export type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCMessage,
  MCPToolDefinition,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptMessage,
  MCPCapabilities,
  MCPServerInfo,
  ITransport,
} from './mcp/types';

export { MCPClient } from './mcp/client';
export { MCPServer } from './mcp/server';
export { HTTPTransport, SSETransport } from './mcp/transport/http';

// Subagent system
export type { SubagentConfig, SubagentResult } from './subagent/types';
export { SubagentManager } from './subagent/manager';

// Skills system
export type { SkillDefinition, SkillScope, SkillTrigger, SkillSummary } from './skill/types';
export { SkillManager } from './skill/manager';
export { SkillLoader } from './skill/loader';

// Memory system
export type { MemoryEntry, MemoryScope } from './memory/types';
export { MemoryManager } from './memory/manager';

// Planning system
export type { Plan, PlanStep, PlanStepStatus } from './planning/types';
export { PlanningManager } from './planning/manager';

// Logger utility
export { logger } from './utils/logger';

// Token estimation utility
export { countTokens } from './utils/token';
