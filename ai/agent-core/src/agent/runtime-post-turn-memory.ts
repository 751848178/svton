import type { Models, Model, Message, UserMessage } from '@earendil-works/pi-ai';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { MemoryManager } from '../memory/manager';
import { logger } from '../utils/logger';

interface ChatLikeProvider {
  chat: (msgs: unknown[], opts?: unknown) => AsyncGenerator<{ type: string; text?: string }>;
}

/** Runs hidden memory extraction with an abort signal and a hard settlement bound. */
export async function extractPostTurnMemory(
  memoryManager: MemoryManager,
  models: Models,
  model: Model<any>,
  modelId: string,
  messages: AgentMessage[],
  timeoutMs: number,
): Promise<void> {
  const convMessages = toExtractionMessages(messages);
  if (convMessages.length < 4) return;
  const controller = new AbortController();
  const extraction = memoryManager.extractFromConversation(
    convMessages,
    toChatLikeProvider(models, model),
    modelId,
    controller.signal,
  );
  const timeout = createTimeout(extraction, controller, timeoutMs);
  try {
    const result = await Promise.race([extraction.then(() => 'complete' as const), timeout]);
    if (result === 'timeout') {
      logger.warn('Runtime', 'Post-turn memory extraction timed out', { timeoutMs });
    }
  } catch (error) {
    logger.warn('Runtime', 'Post-turn memory extraction failed', { error: String(error) });
  }
}

function createTimeout(
  extraction: Promise<number>,
  controller: AbortController,
  timeoutMs: number,
): Promise<'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      controller.abort();
      resolve('timeout');
    }, Math.max(0, timeoutMs));
    extraction.finally(() => clearTimeout(timer)).catch(() => {});
  });
}

function toExtractionMessages(
  messages: AgentMessage[],
): Array<{ role: string; content: string }> {
  return messages.filter(isPiMessage).map((message) => ({
    role: message.role,
    content: typeof message.content === 'string'
      ? message.content
      : message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join(''),
  }));
}

function toChatLikeProvider(models: Models, model: Model<any>): ChatLikeProvider {
  return {
    async *chat(msgs, opts) {
      const { systemPrompt, messages } = splitExtractionPrompt(msgs);
      const signal = readSignal(opts);
      const streamOptions: Record<string, unknown> = { maxTokens: readMaxTokens(opts) };
      if (signal) streamOptions.signal = signal;
      if (systemPrompt) streamOptions.systemPrompt = systemPrompt;
      const stream = models.streamSimple(model, { messages }, streamOptions);
      for await (const event of stream) {
        if (signal?.aborted) throw new DOMException('Memory extraction aborted', 'AbortError');
        if (event.type === 'text_delta') yield { type: 'text_delta', text: event.delta };
      }
    },
  };
}

function splitExtractionPrompt(msgs: unknown[]): { systemPrompt?: string; messages: Message[] } {
  let systemPrompt: string | undefined;
  const messages: Message[] = [];
  for (const value of msgs) {
    if (!isRecord(value) || typeof value.role !== 'string' || typeof value.content !== 'string') continue;
    if (value.role === 'system' && systemPrompt === undefined) {
      systemPrompt = value.content;
    } else if (value.role === 'user') {
      const message: UserMessage = { role: 'user', content: value.content, timestamp: Date.now() };
      messages.push(message);
    }
  }
  return { systemPrompt, messages };
}

function readSignal(value: unknown): AbortSignal | undefined {
  return isRecord(value) && value.signal instanceof AbortSignal ? value.signal : undefined;
}

function readMaxTokens(value: unknown): number {
  return isRecord(value) && typeof value.maxTokens === 'number' ? value.maxTokens : 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPiMessage(message: AgentMessage): message is Message {
  return message.role === 'user' || message.role === 'assistant' || message.role === 'toolResult';
}
