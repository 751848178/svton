import type { DisplayMessage } from '../types';
import { finalizeMessageTimelineDuration } from '../timeline/message-projection';
import type { MessageStoreHost } from './chat-message-store';
import type { ChatRunAddress } from './chat-run.types';
import { finalizeTurnBlocks } from './chat-turn-blocks.utils';

/** Atomically publishes terminal display state to the addressed owner. */
export function finalizeStreamEnd(
  store: MessageStoreHost,
  address: ChatRunAddress,
  assistantMsgId: string,
  updates: Partial<DisplayMessage>,
  onBackgroundStreamEnd: ((sessionId: string) => void) | null,
  streamingAssistantMsgId: string | { current: string | null } | null,
  onActiveStreamEnd?: (sessionId: string | null) => void,
): void {
  const ownerSessionId = address.sessionId;
  const isActive = ownerSessionId === store.activeSessionId;
  const applyUpdates = (message: DisplayMessage): DisplayMessage => {
    if (message.id !== assistantMsgId) return message;
    const updated = finalizeTurnBlocks({ ...message, ...updates });
    return typeof updates.duration === 'number'
      ? finalizeMessageTimelineDuration(updated, updates.duration)
      : updated;
  };
  if (ownerSessionId && !isActive) {
    const cached = store.sessionMessages.get(ownerSessionId);
    if (cached) store.sessionMessages.set(ownerSessionId, cached.map(applyUpdates));
    onBackgroundStreamEnd?.(ownerSessionId);
    return;
  }
  store.messages = store.messages.map(applyUpdates);
  void streamingAssistantMsgId;
  onActiveStreamEnd?.(ownerSessionId);
}
