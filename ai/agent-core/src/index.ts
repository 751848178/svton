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
  // Computer Use tools
  screenshotDef,
  ScreenshotExecutor,
  mouseClickDef,
  MouseClickExecutor,
  mouseMoveDef,
  MouseMoveExecutor,
  keyboardTypeDef,
  KeyboardTypeExecutor,
  keyboardPressKeyDef,
  KeyboardPressKeyExecutor,
  // Chrome CDP tools
  chromeNavigateDef,
  ChromeNavigateExecutor,
  chromeScreenshotDef,
  ChromeScreenshotExecutor,
  chromeClickDef,
  ChromeClickExecutor,
  chromeTypeDef,
  ChromeTypeExecutor,
  chromeEvaluateDef,
  ChromeEvaluateExecutor,
  chromeGetContentDef,
  ChromeGetContentExecutor,
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
  McpServerToolConfig,
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
export { StdioTransport } from './mcp/transport/stdio';
export { McpMarketplace } from './mcp/marketplace';
export type {
  McpMarketplaceServer,
  McpMarketplaceServerDetail,
  McpServerConnection,
  McpServerToolInfo,
  McpMarketplaceResult,
} from './mcp/marketplace';

// Subagent system
export type { SubagentConfig, SubagentResult } from './subagent/types';
export { SubagentManager } from './subagent/manager';

// Skills system
export type { SkillDefinition, SkillScope, SkillTrigger, SkillSummary, SkillSource, SkillInstallRecord } from './skill/types';
export { SkillManager } from './skill/manager';
export { SkillLoader } from './skill/loader';
export { SkillInstaller } from './skill/installer';
export type { InstallResult } from './skill/installer';

// Skill marketplace (skills.sh integration)
export { SkillMarketplace } from './skill/marketplace';
export type {
  RemoteSkill,
  RemoteSkillDetail,
  RemoteSkillFile,
  AuditEntry,
  AuditResponse,
  MarketplaceSkill,
} from './skill/marketplace';

// Memory system
export type { MemoryEntry, MemoryScope } from './memory/types';
export { MemoryManager } from './memory/manager';

// Planning system
export type { Plan, PlanStep, PlanStepStatus } from './planning/types';
export { PlanningManager } from './planning/manager';

// Plugin system
export type { PluginManifest, PluginMcpServer, PluginHook, PluginInstallRecord } from './plugin/types';
export { PluginManager } from './plugin/manager';

// Logger utility
export { logger } from './utils/logger';

// Token estimation utility
export { countTokens } from './utils/token';
