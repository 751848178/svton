/**
 * Agent runtime type definitions.
 */

import type { ChatMessage, StreamEvent, TokenUsage, ToolDefinition, ContentBlock } from '../provider/types';
import type { ToolCall, ToolResult } from '../tool/types';

// ============================================================
// IRuntime — interface to break circular deps (agent ↔ subagent)
// ============================================================

export interface IRuntime {
  run(userMessage: string | ContentBlock[], options?: RunOptions): AsyncGenerator<AgentEvent>;
  getMessages(): ChatMessage[];
  abort(): void;
}

// ============================================================
// Agent Events (output of the ReAct loop)
// ============================================================

export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_call_start'; call: ToolCall }
  | { type: 'tool_call_progress'; callId: string; message: string; arguments?: Record<string, unknown> }
  | { type: 'tool_call_end'; result: ToolResult }
  | { type: 'tool_approval_needed'; call: ToolCall }
  | { type: 'context_compacted'; summary: string }
  | { type: 'subagent_start'; agentId: string; task: string }
  | { type: 'subagent_end'; agentId: string; summary: string }
  | { type: 'error'; error: Error }
  | { type: 'done'; stopReason: string; usage: TokenUsage };

// ============================================================
// Agent Run Options
// ============================================================

export type AgentMode = 'default' | 'plan' | 'auto';

export interface RunOptions {
  mode?: AgentMode;
  signal?: AbortSignal;
  maxIterations?: number;
}

// ============================================================
// Agent Config
// ============================================================

export interface ContextConfig {
  maxTokens: number;
  compactionThreshold: number;    // 0.0 - 1.0, e.g. 0.8 = compact at 80%
  reservedForResponse: number;
  preserveRecentMessages: number;
}

export interface AgentConfig {
  provider: import('../provider/types').IProvider;
  model: string;
  toolRegistry: import('../tool/registry').ToolRegistry;
  systemPrompt?: string;
  contextConfig?: Partial<ContextConfig>;
  maxIterations?: number;
  workingDir?: string;
  capabilities?: AgentCapabilities;
}

// ============================================================
// Agent Capabilities (all optional, backward-compatible)
// ============================================================

/** Per-MCP-server tool permission configuration */
export interface McpServerToolConfig {
  approvalMode?: 'auto' | 'ask' | 'deny';
  enabledTools?: string[];
  disabledTools?: string[];
}

export interface AgentCapabilities {
  skillManager?: import('../skill/manager').SkillManager;
  memoryManager?: import('../memory/manager').MemoryManager;
  promptManager?: import('../prompt/manager').PromptManager;
  permissionManager?: import('../permission/manager').PermissionManager;
  hookManager?: import('../hooks/manager').HookManager;
  mcpClients?: import('../mcp/client').MCPClient[];
  mcpServerConfigs?: Map<string, McpServerToolConfig>;
  pluginManager?: import('../plugin/manager').PluginManager;
  subagentManager?: import('../subagent/manager').SubagentManager;
  planningManager?: import('../planning/manager').PlanningManager;
}

// ============================================================
// Tool Approval
// ============================================================

export interface PendingApproval {
  call: ToolCall;
  resolve: (approved: boolean) => void;
  timestamp: number;
}
