/**
 * Legacy `AgentRuntime` alias.
 *
 * The hand-written ReAct loop is gone; `AgentRuntime` now points at the
 * Pi-backed composition root (`SvtonAgentRuntime`). Kept as a separate module
 * so existing `import { AgentRuntime }` call sites keep compiling (both as a
 * value and as a type) while new code imports `SvtonAgentRuntime` directly.
 */
import { SvtonAgentRuntime } from './svton-agent-runtime';

export const AgentRuntime = SvtonAgentRuntime;
export type AgentRuntime = SvtonAgentRuntime;
