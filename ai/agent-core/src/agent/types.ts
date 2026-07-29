/**
 * Agent runtime type definitions.
 */

import type { ReasoningEffort } from '../provider/types';
import type { ToolCall } from '../tool/types';
import type { Models, Model, UserMessage } from '@earendil-works/pi-ai';
import type {
  AgentEvent as PiAgentEvent,
  AgentMessage,
} from '@earendil-works/pi-agent-core';
export type { PiAgentEvent };

// ============================================================
// IRuntime — interface to break circular deps (agent ↔ subagent)
// ============================================================

export interface IRuntime {
  run(userMessage: UserMessage['content'], options?: RunOptions): AsyncGenerator<PublicRuntimeEvent>;
  getMessages(): AgentMessage[];
  setMessages?(messages: AgentMessage[]): void;
  reset(): void;
  abort(): void;
}

// ============================================================
// Public runtime events
// ============================================================

/**
 * Product capabilities that upstream Pi does not own. These extensions never
 * restate Pi's agent, turn, message, streaming, tool, error, abort, or
 * settlement lifecycle.
 */
export type SvtonCapabilityEvent =
  | { type: 'tool_approval_needed'; call: ToolCall; metadata?: Record<string, unknown> }
  | { type: 'context_compacted'; summary: string }
  | { type: 'warning'; text: string; source?: string }
  | { type: 'skill_activated'; skills: string[] };

/** Canonical public event contract: native Pi lifecycle plus Svton capability. */
export type PublicRuntimeEvent = PiAgentEvent | SvtonCapabilityEvent;

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
