import type { MessageStoreHost } from './chat-message-store';
import { mapStreamingMessage } from './chat-message-store';
import { applyTimelineActions } from '../timeline/message-projection';
import { createProviderFailureAction } from '../timeline/public-event-selector';
import { selectEventTimelineContext } from './chat-event-context';
import type { ChatRunAddress } from './chat-run.types';

export function projectProviderFailure(
  error: string,
  assistantMsgId: string,
  store: MessageStoreHost,
  address?: ChatRunAddress,
): void {
  const action = createProviderFailureAction(
    error,
    selectEventTimelineContext(store, assistantMsgId, address),
  );
  mapStreamingMessage(store, (message) => message.id === assistantMsgId
    ? applyTimelineActions(message, [action])
    : message, address?.sessionId);
}
