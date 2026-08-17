/**
 * Post-turn lifecycle hooks for `SvtonAgentRuntime` (Architecture §7.5:
 * "reattach memory extraction, planning, checkpoint and resume to explicit Pi
 * lifecycle points").
 *
 * Pi owns the turn; `runOnce` awaits these hooks from the native `agent_end`
 * listener. Each hook handles its own non-fatal failure so listener settlement
 * includes the work without letting lifecycle failures break the next turn.
 *
 *   - **memory extraction**: `memoryManager.extractFromConversation(...)` over
 *     the post-turn transcript, driven through canonical pi-ai
 *     `models.streamSimple`.
 *   - **checkpoint**: `resumeManager.checkpoint(sessionId, runtime)` persists
 *     the Pi-owned transcript + model + reasoning effort for resume.
 */
import type { Models, Model } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { MemoryManager } from '../memory/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { SvtonAgentRuntime } from './svton-agent-runtime';
import { logger } from '../utils/logger';
import { redactUserInputToolResults } from './user-input-transcript.utils';
import { extractPostTurnMemory } from './runtime-post-turn-memory';

/** Inputs the runtime gathers once per run for the post-turn hooks. */
export interface PostTurnDeps {
  memoryManager: MemoryManager | null;
  models: Models | null;
  model: Model<any> | null;
  modelId: string;
  resumeManager: SessionResumeManager | null;
  runtime: SvtonAgentRuntime;
  /** Read the post-turn transcript from Pi Agent state. */
  getMessages: () => AgentMessage[];
  /** Bounds hidden model work so foreground settlement cannot hang forever. */
  memoryTimeoutMs?: number;
}

export const DEFAULT_POST_TURN_MEMORY_TIMEOUT_MS = 3_000;

/**
 * Build the awaited callback `runOnce` invokes from native `agent_end`.
 */
export function createPostTurnCallback(
  deps: PostTurnDeps,
): (stopReason: string, sessionId: string, runRevision?: number) => Promise<void> {
  return async (stopReason, sessionId, runRevision) => (
    runPostTurnHooks(deps, stopReason, sessionId, runRevision)
  );
}

/**
 * Run memory extraction + checkpoint as part of awaited turn settlement.
 * Failures are explicitly logged and contained inside this lifecycle boundary.
 */
export async function runPostTurnHooks(
  deps: PostTurnDeps,
  stopReason: string,
  sessionId: string,
  runRevision?: number,
): Promise<void> {
  const sanitizedMessages = redactUserInputToolResults(readMessages(deps));
  deps.runtime.setMessages(sanitizedMessages);
  if (deps.memoryManager && deps.models && deps.model) {
    await extractPostTurnMemory(
      deps.memoryManager,
      deps.models,
      deps.model,
      deps.modelId,
      sanitizedMessages,
      deps.memoryTimeoutMs ?? DEFAULT_POST_TURN_MEMORY_TIMEOUT_MS,
    );
  }
  if (deps.resumeManager && stopReason !== 'aborted') {
    try {
      await deps.resumeManager.checkpoint(sessionId, deps.runtime, runRevision);
    } catch (error) {
      logger.warn('Runtime', 'Post-turn checkpoint failed', { error: String(error), sessionId });
    }
  }
}

function readMessages(deps: PostTurnDeps): AgentMessage[] {
  try {
    return deps.getMessages();
  } catch (error) {
    logger.warn('Runtime', 'Post-turn message snapshot failed', { error: String(error) });
    return [];
  }
}
