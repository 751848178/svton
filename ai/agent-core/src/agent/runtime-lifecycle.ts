/**
 * Post-turn lifecycle hooks for `SvtonAgentRuntime` (Architecture §7.5:
 * "reattach memory extraction, planning, checkpoint and resume to explicit Pi
 * lifecycle points").
 *
 * The old runtime fired these from an internal post-turn block. Pi now owns the
 * turn; `runOnce` calls {@link runPostTurnHooks} after the terminal `done`
 * event. Both hooks are fire-and-forget and swallow their own errors so a
 * non-fatal lifecycle failure can never break the next turn.
 *
 *   - **memory extraction**: `memoryManager.extractFromConversation(...)` over
 *     the post-turn transcript, driven through pi-ai `models.streamSimple`
 *     (the deleted `IProvider.chat` path is gone). Mirrors the legacy contract.
 *   - **checkpoint**: `resumeManager.checkpoint(sessionId, runtime)` persists
 *     the Pi-owned transcript + model + reasoning effort for resume.
 */
import type { Models, Model } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { ChatMessage } from '../provider/types';
import type { MemoryManager } from '../memory/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { SvtonAgentRuntime } from './svton-agent-runtime';

/** pi-ai `streamSimple`-shaped adapter satisfying `extractFromConversation`. */
interface ChatLikeProvider {
  chat: (msgs: unknown[], opts?: unknown) => AsyncGenerator<{ type: string; text?: string; delta?: string }>;
}

/** Inputs the runtime gathers once per run for the post-turn hooks. */
export interface PostTurnDeps {
  memoryManager: MemoryManager | null;
  models: Models | null;
  model: Model<any> | null;
  modelId: string;
  resumeManager: SessionResumeManager | null;
  runtime: SvtonAgentRuntime;
  /** Read the post-turn transcript from Pi Agent state. */
  getMessages: () => ChatMessage[];
}

/**
 * Build the `(stopReason, sessionId)` callback `runOnce` invokes after the
 * terminal `done` event. Keeps the composition root free of lifecycle detail.
 */
export function createPostTurnCallback(deps: PostTurnDeps): (stopReason: string, sessionId: string) => void {
  return (stopReason, sessionId) => runPostTurnHooks(deps, stopReason, sessionId);
}

/**
 * Run memory extraction + checkpoint after a turn settles. Fire-and-forget:
 * both hooks catch internally; rejection of the returned promise is impossible
 * unless `getMessages()` itself throws (which would indicate a deeper fault).
 */
export function runPostTurnHooks(
  deps: PostTurnDeps,
  stopReason: string,
  sessionId: string,
): void {
  if (deps.memoryManager && deps.models && deps.model) {
    extractMemory(deps.memoryManager, deps.models, deps.model, deps.modelId, deps.getMessages());
  }
  if (deps.resumeManager && stopReason !== 'aborted') {
    deps.resumeManager.checkpoint(sessionId, deps.runtime).catch(() => {});
  }
}

/**
 * Reattach the legacy post-turn memory extraction. Builds a pi-ai-backed chat
 * adapter (the deleted `IProvider.chat` is replaced by `models.streamSimple`)
 * and feeds the post-turn transcript. Non-fatal — extraction failure is logged
 * and swallowed (matches the legacy `.catch(() => {})` contract).
 */
function extractMemory(
  memoryManager: MemoryManager,
  models: Models,
  model: Model<any>,
  modelId: string,
  messages: ChatMessage[],
): void {
  const convMessages = toExtractionMessages(messages);
  if (convMessages.length < 4) return;
  const provider = toChatLikeProvider(models, model);
  memoryManager
    .extractFromConversation(convMessages, provider, modelId)
    .catch(() => { /* non-fatal — legacy contract */ });
}

/** Flatten ChatMessage[] into the {role,content:string} shape extraction needs. */
function toExtractionMessages(
  messages: ChatMessage[],
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
        ? m.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
        : '',
  }));
}

/** Wrap `models.streamSimple(model, ...)` as the `{chat}` shape extraction expects. */
function toChatLikeProvider(models: Models, model: Model<any>): ChatLikeProvider {
  return {
    async *chat(msgs, opts) {
      // The extraction service sends a [{role:'system',...},{role:'user',...}]
      // pair. Pi's `Message` union has no `system` role — the system prompt is
      // a separate `streamSimple` option — so split it out here.
      const { systemPrompt, conversation } = splitSystemMessage(msgs);
      const piMessages = toAgentLikeMessages(conversation) as unknown as Parameters<typeof models.streamSimple>[1]['messages'];
      const streamOptions: Record<string, unknown> = {
        maxTokens: (opts as { maxTokens?: number } | undefined)?.maxTokens ?? 500,
      };
      if (systemPrompt) streamOptions.systemPrompt = systemPrompt;
      const stream = models.streamSimple(model, { messages: piMessages }, streamOptions);
      for await (const ev of stream) {
        if (ev.type === 'text_delta') yield { type: 'text_delta', text: ev.delta };
      }
    },
  };
}

/** Separate a leading system message from the conversation messages. */
function splitSystemMessage(msgs: unknown[]): { systemPrompt?: string; conversation: unknown[] } {
  if (msgs.length > 0 && (msgs[0] as { role?: string }).role === 'system') {
    const content = (msgs[0] as { content?: string }).content;
    return { systemPrompt: typeof content === 'string' ? content : undefined, conversation: msgs.slice(1) };
  }
  return { conversation: msgs };
}

/** Coerce extraction's plain messages into the shape streamSimple expects. */
function toAgentLikeMessages(msgs: unknown[]): AgentMessage[] {
  return msgs.map((m) => {
    const { role, content } = m as { role: string; content: string };
    // Cast through unknown: pi-ai's `Message` union is narrower than
    // `AgentMessage` at the type level, but streamSimple accepts the plain
    // {role,content} shape at runtime (same bridge subagent-runtime uses).
    return { role, content, timestamp: Date.now() } as unknown as AgentMessage;
  });
}
