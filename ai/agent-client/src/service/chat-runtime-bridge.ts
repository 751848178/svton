/**
 * Runtime state orchestration around the canonical Pi transcript.
 *
 * PI004/PI007 message-ownership reconciliation:
 *   Pi Agent state (`agent.state.messages`) is the append-only source of truth.
 *   `ChatService.messages` is a one-way DISPLAY projection of runtime events.
 *
 * Previously ChatService round-tripped display → runtime at two sites
 * (model switch + restore), which could drop tool_result blocks and diverge
 * from Pi's truth. This module makes the flow strictly one-way:
 *
 *   - {@link snapshotRuntimeMessages} — model switch: read canonical messages
 *     from the OLD runtime (runtime→runtime), hand them to the NEW runtime.
 *     Display is untouched (it is already a projection).
 * Display state is never converted back into runtime state. Session
 * checkpoints persist canonical `AgentMessage[]` without synthesizing provider
 * metadata or coercing system messages into user messages.
 */

import { logger } from '@svton/agent-core';
import type { SerializedRuntime, SvtonAgentRuntime } from '@svton/agent-core';
import type { AgentMessage } from '@earendil-works/pi-agent-core';

/**
 * Model switch: capture canonical messages from the existing runtime so the
 * new runtime inherits Pi's append-only truth (tool_result blocks included).
 * Returns null when there is no prior runtime or it holds no messages.
 */
export function snapshotRuntimeMessages(runtime: SvtonAgentRuntime | null): AgentMessage[] | null {
  if (!runtime) return null;
  const messages = runtime.getMessages();
  return messages.length > 0 ? messages : null;
}

/**
 * Apply a canonical message snapshot (captured before recreating the runtime)
 * to the new runtime. One-way: runtime→runtime, no display round-trip.
 */
export function reseedRuntimeFromSnapshot(
  runtime: SvtonAgentRuntime,
  snapshot: AgentMessage[],
): void {
  runtime.setMessages(snapshot);
  logger.info('Chat', 'Model switch — reseeded runtime from canonical snapshot', {
    messageCount: snapshot.length,
  });
}

/**
 * Restore runtime state for a session from the canonical checkpoint.
 */
export async function restoreRuntimeState(
  runtime: SvtonAgentRuntime,
  sessionId: string | null,
): Promise<boolean> {
  if (!sessionId) {
    runtime.reset();
    return false;
  }
  const resumeMgr = runtime.getResumeManager();
  if (!resumeMgr) {
    runtime.reset();
    return false;
  }
  try {
    const restored = await resumeMgr.restore(sessionId, runtime);
    if (!restored) runtime.reset();
    return restored;
  } catch (error) {
    logger.warn('Chat', 'Checkpoint restore failed; canonical runtime remains empty', {
      error: error instanceof Error ? error.message : String(error),
    });
    runtime.reset();
    return false;
  }
}

/**
 * PI007 3-list fix: restore a runtime for a loaded session. Prefers the
 * checkpoint (canonical runtime truth). Without one, both runtime and display
 * must be empty; stored display history never becomes canonical state.
 */
export async function restoreMessagesIntoRuntime(
  runtime: SvtonAgentRuntime,
  sessionId: string | null,
  shouldApply: () => boolean = () => true,
): Promise<
  | { kind: 'checkpoint'; checkpoint: SerializedRuntime }
  | { kind: 'empty' | 'stale'; checkpoint: null }
> {
  const resumeManager = sessionId ? runtime.getResumeManager() : null;
  let checkpoint: SerializedRuntime | null = null;
  try {
    checkpoint = resumeManager && sessionId
      ? await resumeManager.load(sessionId)
      : null;
  } catch (error) {
    logger.warn('Chat', 'Checkpoint load failed; clearing canonical session state', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!shouldApply()) return { kind: 'stale', checkpoint: null };
  if (checkpoint && resumeManager) {
    resumeManager.applyLoadedState(checkpoint, runtime);
    return { kind: 'checkpoint', checkpoint };
  } else {
    runtime.reset();
    return { kind: 'empty', checkpoint: null };
  }
}
