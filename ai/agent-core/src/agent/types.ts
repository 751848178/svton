/**
 * Agent runtime type definitions.
 */

import type { TokenUsage, ReasoningEffort } from '../provider/types';
import type { ToolCall, ToolResult } from '../tool/types';
import type { Models, Model, UserMessage } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';

// ============================================================
// IRuntime — interface to break circular deps (agent ↔ subagent)
// ============================================================

export interface IRuntime {
  run(userMessage: UserMessage['content'], options?: RunOptions): AsyncGenerator<AgentEvent>;
  getMessages(): AgentMessage[];
  setMessages?(messages: AgentMessage[]): void;
  reset(): void;
  abort(): void;
}

// ============================================================
// Agent Events (output of the runtime)
// ============================================================

/**
 * Runtime event protocol — Pi-base events plus svton-only capability events
 * (Architecture §5.2).
 *
 * The union is the literal contract from §5.2:
 *   SvtonRuntimeEvent = Pi Agent event
 *                     | approval event
 *                     | skill activation event
 *                     | subagent event   ← surfaced via tool_call_* only
 *                     | compaction event
 *                     | product warning event
 *
 * Text, thinking, tool-call lifecycle, error and settlement (`done`) come FROM
 * Pi (translated by `pi-event-adapter.ts`). Svton events exist ONLY for the
 * capabilities Pi does not own (approval gate, skill activation, compaction,
 * product warnings). Subagents are NOT a distinct event type: they surface as
 * ordinary `tool_call_*` events through the `subagent_spawn` tool, so the
 * legacy `subagent_start`/`subagent_end` variants were dead and have been
 * removed (PI004).
 *
 * Variants are classified below as `Pi-base` or `svton-only`. Variants are
 * NOT renamed — consumers (chat.service, react hooks) depend on these names.
 *
 * --- Pi-base (origin: pi-agent-core, translated) ---
 *   text_delta, thinking_delta           streaming assistant content
 *   tool_call_start, tool_call_progress  tool-call lifecycle (Pi schedules)
 *   tool_call_end                        tool execution settled
 *   error, done                          run termination + usage
 *
 * --- svton-only (capabilities Pi does not own) ---
 *   tool_approval_needed                 approval gate (beforeToolCall)
 *   context_compacted                    SvtonCompactor via transformContext
 *   skill_activated                      SkillManager trigger
 *   warning                              product/hook/provider warnings
 */
export type AgentEvent =
  // --- Pi-base (translated from pi-agent-core by pi-event-adapter.ts) ---
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'tool_call_start'; call: ToolCall }
  | { type: 'tool_call_progress'; callId: string; message: string; name?: string; arguments?: Record<string, unknown> }
  | { type: 'tool_call_end'; result: ToolResult }
  | { type: 'error'; error: Error }
  | { type: 'done'; stopReason: string; usage: TokenUsage }
  // --- svton-only (capabilities Pi does not own) ---
  | { type: 'tool_approval_needed'; call: ToolCall; metadata?: Record<string, unknown> }
  | { type: 'context_compacted'; summary: string }
  | { type: 'warning'; text: string; source?: string }
  | { type: 'skill_activated'; skills: string[] };

// ============================================================
// Agent Run Options
// ============================================================

export type AgentMode = 'default' | 'plan' | 'auto';

export interface RunOptions {
  mode?: AgentMode;
  signal?: AbortSignal;
  maxIterations?: number;
  /** Session ID for checkpoint/resume. Passed to SessionResumeManager. */
  sessionId?: string;
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
  /**
   * Pi-ai `Models` collection (OpenAI + Anthropic registered). Pi Agent calls
   * `models.streamSimple` directly — svton no longer wraps providers behind
   * `IProvider` (Architecture §3, §7.2).
   */
  models: Models;
  /** Resolved pi-ai `Model` for `model`. Optional — resolved by id if omitted. */
  piModel?: Model<any>;
  /** Model id (e.g. "gpt-4o", "claude-sonnet-4-20250514"). */
  model: string;
  toolRegistry: import('../tool/registry').ToolRegistry;
  systemPrompt?: string;
  /** Initial canonical Pi transcript. */
  initialMessages?: AgentMessage[];
  contextConfig?: Partial<ContextConfig>;
  maxIterations?: number;
  workingDir?: string;
  capabilities?: AgentCapabilities;
  /**
   * Initial reasoning effort applied to the Pi Agent's `thinkingLevel` at
   * runtime creation (undefined → 'off', hides thinking). Used by the web E2E
   * seam to exercise the thinking show/hide path without a UI control.
   */
  reasoningEffort?: ReasoningEffort;
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
  resumeManager?: import('../checkpoint/manager').SessionResumeManager;
  agentDefinitionManager?: import('../agent-definition/manager').AgentDefinitionManager;
  worktreeManager?: import('../worktree/manager').WorktreeManager;
  autoReviewer?: import('../auto-reviewer/manager').AutoReviewerManager;
}

// ============================================================
// Tool Approval
// ============================================================

export interface PendingApproval {
  call: ToolCall;
  resolve: (approved: boolean) => void;
  timestamp: number;
}
