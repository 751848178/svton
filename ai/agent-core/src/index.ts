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
  ReasoningEffort,
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
  mouseDoubleClickDef,
  MouseDoubleClickExecutor,
  mouseMoveDef,
  MouseMoveExecutor,
  mouseDownDef,
  MouseDownExecutor,
  mouseUpDef,
  MouseUpExecutor,
  mouseDragDef,
  MouseDragExecutor,
  scrollDef,
  ScrollExecutor,
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
  // Git code review tools
  gitDiffDef,
  GitDiffExecutor,
  gitLogRangeDef,
  GitLogRangeExecutor,
  // Image generation tool
  imageGenerateDef,
  ImageGenerateExecutor,
  // CSV fan-out tool
  csvFanoutDef,
  CsvFanoutExecutor,
  // Document preview tool
  previewDocumentDef,
  PreviewDocumentExecutor,
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

// Custom Agent Definitions
export type { AgentDefinition, AgentDefinitionSource } from './agent-definition/types';
export { AgentDefinitionManager } from './agent-definition/manager';

// Git Worktrees
export type { WorktreeInfo, CreateWorktreeOptions } from './worktree/types';
export { WorktreeManager } from './worktree/manager';

// Auto-reviewer
export type {
  ReviewVerdict,
  ReviewerMode,
  ReviewContext,
  ReviewResult,
  ReviewRule,
  ReviewerConfig,
} from './auto-reviewer/types';
export { AutoReviewerManager } from './auto-reviewer/manager';
export { BUILTIN_RULES } from './auto-reviewer/builtin-rules';

// Skills system
export type { SkillDefinition, SkillScope, SkillTrigger, SkillSummary, SkillSource, SkillInstallRecord } from './skill/types';
export { SkillManager } from './skill/manager';
export { SkillLoader } from './skill/loader';
export { SkillInstaller } from './skill/installer';
export type { InstallResult } from './skill/installer';

// Built-in skills
export { codeReviewSkill } from './skill/builtin/code-review';

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

// Chronicle screen memory
export type { ScreenCapture, ChronicleConfig } from './chronicle/types';
export { ChronicleManager } from './chronicle/manager';

// Automation / scheduled tasks
export type {
  AutomationTriggerType,
  AutomationTrigger,
  AutomationDefinition,
  AutomationRunStatus,
  AutomationRun,
} from './automation/types';
export type { IAutomationScheduler } from './automation/scheduler';
export { TimerScheduler } from './automation/scheduler';
export { AutomationManager } from './automation/manager';
export { createAutomationDef, CreateAutomationExecutor } from './automation/create-tool';

// Image generation (multi-vendor)
export type {
  ImageGenerationRequest,
  GeneratedImage,
  ImageGenerationResult,
  IImageGenerationProvider,
} from './image-gen';
export {
  OpenAIImageProvider,
  StabilityProvider,
  GoogleImagenProvider,
  ImageGenRegistry,
} from './image-gen';

// Session checkpoint / resume
export type { SerializedRuntime, CheckpointMeta } from './checkpoint/types';
export { SessionResumeManager } from './checkpoint/manager';

// Plugin system
export type { PluginManifest, PluginMcpServer, PluginHook, PluginInstallRecord } from './plugin/types';
export { PluginManager } from './plugin/manager';

// Integrations (Slack, Linear, etc.)
export type {
  IntegrationCategory,
  AuthType,
  AuthField,
  IntegrationManifest,
  IntegrationConfig,
} from './integrations/types';
export { IntegrationManager } from './integrations/manager';
export { SlackIntegration } from './integrations/builtin/slack';
export { LinearIntegration } from './integrations/builtin/linear';
export {
  BUILTIN_INTEGRATIONS,
  resolveBuiltinIntegrationManifests,
  type BuiltinIntegrationId,
} from './integrations/builtin';

// Logger utility
export { logger } from './utils/logger';

// Token estimation utility
export { countTokens } from './utils/token';
