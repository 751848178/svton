/**
 * Agent runtime barrel.
 *
 * PI003 replaced the hand-written ReAct loop (`AgentRuntime` in runtime.ts)
 * with `SvtonAgentRuntime` — a composition root over pi-agent-core's `Agent`.
 * The legacy `AgentRuntime` symbol is re-exported as an alias of
 * `SvtonAgentRuntime` so existing import sites (`chat.service`, `agent-sdk`,
 * `create-agent`, `checkpoint`, `subagent`) compile unchanged.
 *
 * `ContextManager` is gone (Pi Agent owns the message list; compaction lives
 * in `SvtonCompactor` plugged into Pi's `transformContext`).
 */
export type {
  AgentEvent,
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

/**
 * Legacy alias — the hand-written ReAct loop is gone; this now points at the
 * Pi-backed composition root. Existing `import { AgentRuntime }` sites keep
 * working; new code should use `SvtonAgentRuntime` directly.
 */
export { AgentRuntime } from './agent-runtime-alias';
