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

export interface StreamRunnerDeps {
  runtime: { run: (content: UserMessage['content'], options: { sessionId?: string }) => AsyncGenerator<import('@svton/agent-core').AgentEvent> };
  handler: ChatEventHandler;
  store: MessageStoreHost;
  streamingAssistantMsgId: { current: string | null };
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
  const { runtime, handler, store, streamingAssistantMsgId, onBackgroundStreamEnd, createDisplayMessage } = deps;

  const assistantMsg = createDisplayMessage('assistant', '');
  assistantMsg.isStreaming = true;
  const startedAt = Date.now();
  store.messages = [...store.messages, assistantMsg];
  store.status = 'running';
  handler.resetLastEventType();
  streamingAssistantMsgId.current = assistantMsg.id;
  store.backgroundSessionId = store.activeSessionId;

  const content: UserMessage['content'] = images && images.length > 0
    ? [
        ...(userContent ? [{ type: 'text' as const, text: userContent }] : []),
        ...images.map((img) => ({ type: 'image' as const, data: img.data, mimeType: img.mimeType ?? 'image/png' })),
      ]
    : userContent;

  try {
    const stream = runtime.run(content, { sessionId: store.activeSessionId ?? undefined });
    for await (const event of stream) {
      handler.handle(event, assistantMsg.id, store);
      if (event.type === 'done') break;
    }
  } catch (error) {
    finalizeStreamEnd(store, assistantMsg.id, {
      error: error instanceof Error ? error.message : String(error),
      isStreaming: false,
    }, onBackgroundStreamEnd, streamingAssistantMsgId);
    return;
  }

  // Mark isStreaming=false BEFORE status='idle' (auto-save reads getMessagesForSave).
  finalizeStreamEnd(store, assistantMsg.id, { isStreaming: false, duration: Date.now() - startedAt }, onBackgroundStreamEnd, streamingAssistantMsgId);
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
