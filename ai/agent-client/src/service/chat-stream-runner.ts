/**
 * Chat stream runner — orchestrates one assistant turn against the runtime.
 *
 * Extracted from ChatService (PI007) to keep the service a thin composition
 * root. Builds the placeholder assistant message, drives `runtime.run()`,
 * routes each event through the event handler, and finalizes the streaming
 * message on completion/error (routing the finalization to the active or
 * background session as appropriate).
 *
 * State mutation is performed through the MessageStoreHost interface so the
 * observable properties on ChatService stay the single source of truth.
 */

import type { UserMessage } from '@earendil-works/pi-ai';
import type { ChatEventHandler } from './chat-event-handler';
import type { MessageStoreHost } from './chat-message-store';
import type { DisplayMessage } from '../types';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';

export interface StreamRunnerDeps {
  runtime: {
    run: (
      content: UserMessage['content'],
      options: { sessionId?: string },
    ) => AsyncGenerator<import('@svton/agent-core').PublicRuntimeEvent>;
  };
  handler: ChatEventHandler;
  store: MessageStoreHost;
  ownership: ChatRunOwnershipService;
  onBackgroundStreamEnd: ((sessionId: string) => void) | null;
  createDisplayMessage: (role: 'user' | 'assistant' | 'system', content: string) => DisplayMessage;
}

/**
 * Run one assistant turn. Adds a streaming placeholder message, iterates the
 * runtime's event stream, and finalizes the message when the stream settles.
 */
export async function runAssistantTurn(
  deps: StreamRunnerDeps,
  userContent: string,
  images: Array<{ data: string; mimeType?: string }> | undefined,
): Promise<void> {
  const { runtime, handler, store, ownership, onBackgroundStreamEnd, createDisplayMessage } = deps;
  const assistantMsg = createDisplayMessage('assistant', '');
  const lease = ownership.begin(store.activeSessionId, assistantMsg.id);
  if (!lease) return;
  assistantMsg.isStreaming = true;
  const startedAt = Date.now();
  store.messages = [...store.messages, assistantMsg];
  store.status = 'running';
  handler.resetSequenceState();
  store.backgroundSessionId = store.activeSessionId;

  const content: UserMessage['content'] = images && images.length > 0
    ? [
        ...(userContent ? [{ type: 'text' as const, text: userContent }] : []),
        ...images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType ?? 'image/png' })),
      ]
    : userContent;

  let failure: string | undefined;
  try {
    const stream = runtime.run(content, { sessionId: store.activeSessionId ?? undefined });
    for await (const event of stream) {
      if (lease.acceptsEvents()) handler.handle(event, assistantMsg.id, store);
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  const shouldFinalize = lease.acceptsEvents();
  if (shouldFinalize) {
    const updates = failure
      ? { error: failure, isStreaming: false }
      : { isStreaming: false, duration: Date.now() - startedAt };
    finalizeStreamEnd(
      store, assistantMsg.id, updates, onBackgroundStreamEnd,
      ownership.assistantMessageId,
    );
  }
  lease.release();
}

/** Route finalization to the active session (observable) or background cache. */
export function finalizeStreamEnd(
  store: MessageStoreHost,
  assistantMsgId: string,
  updates: Partial<DisplayMessage>,
  onBackgroundStreamEnd: ((sessionId: string) => void) | null,
  streamingAssistantMsgId: { current: string | null },
): void {
  const bgId = store.backgroundSessionId;
  const isActive = bgId === store.activeSessionId;

  if (bgId && !isActive) {
    const cached = store.sessionMessages.get(bgId);
    if (cached) {
      store.sessionMessages.set(bgId, cached.map((m) => (m.id === assistantMsgId ? { ...m, ...updates } : m)));
    }
    store.backgroundSessionId = null;
    streamingAssistantMsgId.current = null;
    onBackgroundStreamEnd?.(bgId);
    return;
  }

  store.messages = store.messages.map((m) => (m.id === assistantMsgId ? { ...m, ...updates } : m));
  store.backgroundSessionId = null;
  streamingAssistantMsgId.current = null;
  store.status = 'idle';
}
