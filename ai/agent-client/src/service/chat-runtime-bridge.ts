/**
 * Chat runtime bridge — the single seam between the display layer
 * (`DisplayMessage[]`, MobX observables) and the Pi runtime truth
 * (`AgentRuntime.getMessages()/setMessages()`).
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
 *   - {@link seedRuntimeFromDisplay} — cold-start restore ONLY: when no
 *     checkpoint exists, seed a fresh runtime from the loaded display list.
 *   - {@link restoreRuntimeState} — prefer the resume manager's checkpoint
 *     (canonical runtime truth) over display; fall back to display seeding.
 */

import { logger } from '@svton/agent-core';
import type { AgentRuntime, ChatMessage, ContentBlock, SerializedRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';

/**
 * Model switch: capture canonical messages from the existing runtime so the
 * new runtime inherits Pi's append-only truth (tool_result blocks included).
 * Returns null when there is no prior runtime or it holds no messages.
 */
export function snapshotRuntimeMessages(runtime: AgentRuntime | null): ChatMessage[] | null {
  if (!runtime) return null;
  const messages = runtime.getMessages();
  return messages.length > 0 ? messages : null;
}

/**
 * Apply a canonical message snapshot (captured before recreating the runtime)
 * to the new runtime. One-way: runtime→runtime, no display round-trip.
 */
export function reseedRuntimeFromSnapshot(
  runtime: AgentRuntime,
  snapshot: ChatMessage[],
): void {
  runtime.setMessages(snapshot);
  logger.info('Chat', 'Model switch — reseeded runtime from canonical snapshot', {
    messageCount: snapshot.length,
  });
}

/**
 * Cold-start restore: seed a fresh runtime from the loaded display messages.
 * This is the ONLY sanctioned display→runtime direction, used when no
 * checkpoint exists. Tool_use/tool_result pairs are reconstructed so the API
 * sees a valid transcript.
 */
export function seedRuntimeFromDisplay(
  runtime: AgentRuntime,
  display: DisplayMessage[],
): void {
  const chatMessages = displayToChatMessages(display);
  runtime.setMessages(chatMessages);
  logger.info('Chat', 'Seeded runtime from display (cold start)', {
    messageCount: chatMessages.length,
  });
}

/**
 * Restore runtime state for a session, preferring the checkpoint (canonical
 * runtime truth) over the display list. Returns true if a checkpoint was
 * applied; false means the caller should fall back to display seeding.
 */
export async function restoreRuntimeState(
  runtime: AgentRuntime,
  sessionId: string | null,
): Promise<boolean> {
  if (!sessionId) return false;
  const resumeMgr = runtime.getResumeManager();
  if (!resumeMgr) return false;
  try {
    return await resumeMgr.restore(sessionId, runtime);
  } catch (error) {
    logger.warn('Chat', 'Checkpoint restore failed; falling back to display seed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * PI007 3-list fix: restore a runtime for a loaded session. Prefers the
 * checkpoint (canonical runtime truth); falls back to seeding from the display
 * list only when no checkpoint exists.
 */
export async function restoreMessagesIntoRuntime(
  runtime: AgentRuntime,
  sessionId: string | null,
  display: DisplayMessage[],
  shouldApply: () => boolean = () => true,
): Promise<boolean> {
  const resumeManager = sessionId ? runtime.getResumeManager() : null;
  let checkpoint: SerializedRuntime | null = null;
  try {
    checkpoint = resumeManager && sessionId
      ? await resumeManager.load(sessionId)
      : null;
  } catch (error) {
    logger.warn('Chat', 'Checkpoint load failed; falling back to display seed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!shouldApply()) return false;
  if (checkpoint && resumeManager) {
    resumeManager.applyLoadedState(checkpoint, runtime);
  } else {
    seedRuntimeFromDisplay(runtime, display);
  }
  return true;
}

// ============================================================
// Display → ChatMessage conversion (cold-start seeding only)
// ============================================================

/**
 * Convert display messages to the runtime's `ChatMessage[]` shape. Reconstructs
 * image, tool_use and tool_result blocks so the transcript round-trips cleanly
 * on cold start. NOTE: this is a fallback path — the canonical source is the
 * runtime/resume manager.
 */
export function displayToChatMessages(messages: DisplayMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  for (const m of filtered) {
    if (m.role === 'user' && m.images && m.images.length > 0) {
      out.push({ role: 'user', content: userImageBlocks(m.content, m.images) });
      continue;
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      out.push({ role: 'assistant', content: assistantToolBlocks(m) });
      appendToolResults(out, m);
      continue;
    }
    if (m.role === 'assistant' && m.thinking) {
      out.push({
        role: 'assistant',
        content: [
          { type: 'reasoning' as const, text: m.thinking },
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
        ],
      });
      continue;
    }
    out.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }
  return out;
}

function userImageBlocks(
  content: string,
  images: Array<{ data: string; mimeType?: string }>,
): ContentBlock[] {
  return [
    ...(content ? [{ type: 'text' as const, text: content }] : []),
    ...images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType })),
  ];
}

function assistantToolBlocks(m: DisplayMessage): ContentBlock[] {
  return [
    ...(m.thinking ? [{ type: 'reasoning' as const, text: m.thinking }] : []),
    ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
    ...(m.toolCalls ?? []).map((tc) => ({
      type: 'tool_use' as const,
      id: tc.id,
      name: tc.name,
      input: tc.arguments,
    })),
  ];
}

/** Reconstruct tool_result messages so the API sees valid tool_use → tool_result pairs. */
function appendToolResults(out: ChatMessage[], m: DisplayMessage): void {
  for (const tc of m.toolCalls ?? []) {
    const output = tc.result?.output ?? '';
    out.push({
      role: 'tool',
      content: [{
        type: 'tool_result',
        toolUseId: tc.id,
        output: typeof output === 'string' ? output : JSON.stringify(output),
        isError: tc.result?.isError ?? tc.status === 'error',
      }],
    });
  }
}
