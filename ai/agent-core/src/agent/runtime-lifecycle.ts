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
import type { Models, Model, Message, UserMessage } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
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
  getMessages: () => AgentMessage[];
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
  messages: AgentMessage[],
): void {
  const convMessages = toExtractionMessages(messages);
  if (convMessages.length < 4) return;
  const provider = toChatLikeProvider(models, model);
  memoryManager
    .extractFromConversation(convMessages, provider, modelId)
    .catch(() => { /* non-fatal — legacy contract */ });
}

/** Project canonical Pi state into the plain text shape memory extraction owns. */
function toExtractionMessages(
  messages: AgentMessage[],
): Array<{ role: string; content: string }> {
  return messages
    .filter(isPiMessage)
    .map((message) => ({
      role: message.role,
      content: typeof message.content === 'string'
        ? message.content
        : message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join(''),
    }));
}

/** Wrap `models.streamSimple(model, ...)` as the `{chat}` shape extraction expects. */
function toChatLikeProvider(models: Models, model: Model<any>): ChatLikeProvider {
  return {
    async *chat(msgs, opts) {
      const { systemPrompt, messages } = splitExtractionPrompt(msgs);
      const streamOptions: Record<string, unknown> = {
        maxTokens: readMaxTokens(opts),
      };
      if (systemPrompt) streamOptions.systemPrompt = systemPrompt;
      const stream = models.streamSimple(model, { messages }, streamOptions);
      for await (const ev of stream) {
        if (ev.type === 'text_delta') yield { type: 'text_delta', text: ev.delta };
      }
    },
  };
}

function splitExtractionPrompt(msgs: unknown[]): { systemPrompt?: string; messages: Message[] } {
  let systemPrompt: string | undefined;
  const messages: Message[] = [];
  for (const value of msgs) {
    if (!isRecord(value) || typeof value.role !== 'string' || typeof value.content !== 'string') {
      continue;
    }
    if (value.role === 'system' && systemPrompt === undefined) {
      systemPrompt = value.content;
      continue;
    }
    if (value.role === 'user') {
      const message: UserMessage = {
        role: 'user',
        content: value.content,
        timestamp: Date.now(),
      };
      messages.push(message);
    }
  }
  return { systemPrompt, messages };
}

function readMaxTokens(value: unknown): number {
  return isRecord(value) && typeof value.maxTokens === 'number'
    ? value.maxTokens
    : 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPiMessage(message: AgentMessage): message is Message {
  return message.role === 'user'
    || message.role === 'assistant'
    || message.role === 'toolResult';
}
