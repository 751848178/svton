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
  McpServerToolConfig,
  IRuntime,
} from './types';

export { SvtonAgentRuntime } from './svton-agent-runtime';
export { resolveModelById } from './runtime-helpers';
export {
  selectNativeToolCall,
  selectNativeToolUpdate,
  selectNativeToolResult,
} from './native-tool-event-selectors.utils';
export { selectLastAssistantMessage } from './native-message-event-selectors.utils';
