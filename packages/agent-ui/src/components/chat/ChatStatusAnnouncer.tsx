import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@svton/ui';
import {
  createChatAnnouncementSnapshot,
  selectChatAnnouncement,
  SILENT_CHAT_ANNOUNCEMENT,
  type ChatAnnouncementEvent,
  type ChatAnnouncementSnapshot,
  type DecisionAnnouncement,
} from './chat-announcement-policy';
import type { ChatPanelMessage } from './chat-panel.types';

interface ChatStatusAnnouncerProps {
  isStreaming: boolean;
  messages: ChatPanelMessage[];
  decision: DecisionAnnouncement | null;
}

/** One top-level sink for current-session run transitions; decisions remain dialog-owned. */
export function ChatStatusAnnouncer({ isStreaming, messages, decision }: ChatStatusAnnouncerProps) {
  const { translate: t } = useI18n();
  const snapshot = createChatAnnouncementSnapshot(messages, isStreaming, decision);
  const previousRef = useRef<ChatAnnouncementSnapshot | null>(null);
  const [event, setEvent] = useState<ChatAnnouncementEvent>(SILENT_CHAT_ANNOUNCEMENT);

  useEffect(() => {
    if (previousRef.current) setEvent(selectChatAnnouncement(previousRef.current, snapshot));
    previousRef.current = snapshot;
  }, [snapshot.scopeKey, snapshot.runKey, snapshot.status,
    snapshot.messageIds.join('|'), snapshot.updateKey, snapshot.decision?.key]);

  const live = event.sink === 'polite' || event.sink === 'assertive' ? event.sink : 'off';

  return (
    <div
      className="sr-only"
      aria-live={live}
      aria-atomic="true"
      data-testid="chat-status-announcer"
      data-announcement-event-key={event.key}
      data-announcement-sink={event.sink}
    >
      {live === 'off' || !event.messageKey ? '' : t(event.messageKey)}
    </div>
  );
}
