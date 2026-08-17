/**
 * Agent runtime barrel.
 *
 * PI003 replaced the hand-written ReAct loop (`runtime.ts`)
 * with `SvtonAgentRuntime` — a composition root over pi-agent-core's `Agent`.
 *
 * `ContextManager` is gone (Pi Agent owns the message list; compaction lives
 * in `SvtonCompactor` plugged into Pi's `transformContext`).
 */
export type {
  PublicRuntimeEvent,
  PiAgentEvent,
  SvtonCapabilityEvent,
  AgentMode,
  RunOptions,
  AgentConfig,
  ContextConfig,
  PendingApproval,
  ToolApprovalDecision,
  ToolApprovalRequest,
  ToolApprovalResultMetadata,
  ToolApprovalSettlement,
  ToolApprovalSettlementDecision,
  McpServerToolConfig,
  IRuntime,
} from './types';
export { canonicalSessionId, DEFAULT_RUNTIME_SESSION_ID } from './session-id';

export { SvtonAgentRuntime } from './svton-agent-runtime';
export { resolveModelById } from './runtime-helpers';
export {
  selectNativeToolCall,
  selectNativeToolUpdate,
  selectNativeToolResult,
} from './native-tool-event-selectors.utils';
export { selectLastAssistantMessage } from './native-message-event-selectors.utils';
export {
  isRuntimeSkillContextMessage,
  RUNTIME_SKILL_CONTEXT_PREFIX,
} from './runtime-skill-context-message';
export {
  redactPublicArguments,
  redactSecretRecord,
  redactSecrets,
} from './secret-redactor.utils';
