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
import { logger } from '../utils/logger';

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
 * Build the awaited callback `runOnce` invokes from native `agent_end`.
 */
export function createPostTurnCallback(
  deps: PostTurnDeps,
): (stopReason: string, sessionId: string) => Promise<void> {
  return async (stopReason, sessionId) => runPostTurnHooks(deps, stopReason, sessionId);
}

/**
 * Run memory extraction + checkpoint as part of awaited turn settlement.
 * Failures are explicitly logged and contained inside this lifecycle boundary.
 */
export async function runPostTurnHooks(
  deps: PostTurnDeps,
  stopReason: string,
  sessionId: string,
): Promise<void> {
  if (deps.memoryManager && deps.models && deps.model) {
    await extractMemory(
      deps.memoryManager,
      deps.models,
      deps.model,
      deps.modelId,
      readMessages(deps),
    );
  }
  if (deps.resumeManager && stopReason !== 'aborted') {
    try {
      await deps.resumeManager.checkpoint(sessionId, deps.runtime);
    } catch (error) {
      logger.warn('Runtime', 'Post-turn checkpoint failed', { error: String(error), sessionId });
    }
  }
}

/**
 * Reattach the legacy post-turn memory extraction. Builds a pi-ai-backed chat
 * adapter and feeds the post-turn transcript. Extraction failures are logged
 * and contained so checkpoint settlement still runs.
 */
async function extractMemory(
  memoryManager: MemoryManager,
  models: Models,
  model: Model<any>,
  modelId: string,
  messages: AgentMessage[],
): Promise<void> {
  const convMessages = toExtractionMessages(messages);
  if (convMessages.length < 4) return;
  const provider = toChatLikeProvider(models, model);
  try {
    await memoryManager.extractFromConversation(convMessages, provider, modelId);
  } catch (error) {
    logger.warn('Runtime', 'Post-turn memory extraction failed', { error: String(error) });
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
