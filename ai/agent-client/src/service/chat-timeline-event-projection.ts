import type { PublicRuntimeEvent } from '@svton/agent-core';
import { applyTimelineActions } from '../timeline/message-projection';
import { selectTimelineActions } from '../timeline/public-event-selector';
import { selectEventTimelineContext } from './chat-event-context';
import {
  isActiveSessionStreaming,
  mapStreamingMessage,
  type MessageStoreHost,
} from './chat-message-store';
import type { TimelineUsageSnapshot } from '../timeline/usage.types';
import type { ChatRunAddress } from './chat-run.types';

/** Applies timeline actions only to their streaming owner and derives legacy global usage. */
export function projectTimelineEvent(
  event: PublicRuntimeEvent,
  assistantMsgId: string,
  store: MessageStoreHost,
  address?: ChatRunAddress,
): void {
  const context = selectEventTimelineContext(store, assistantMsgId, address);
  const actions = selectTimelineActions(event, context);
  if (actions.length === 0) return;
  let compatibilityUsage: TimelineUsageSnapshot | null = null;
  mapStreamingMessage(store, (message) => {
    if (message.id !== assistantMsgId) return message;
    const next = applyTimelineActions(message, actions);
    compatibilityUsage = next.timeline?.usage ?? null;
    return next;
  }, address?.sessionId);
  if (compatibilityUsage) store.sessionUsage?.set(address?.sessionId ?? null, compatibilityUsage);
  if (compatibilityUsage && isActiveSessionStreaming(store, address?.sessionId)) {
    store.lastUsage = compatibilityUsage;
  }
}
