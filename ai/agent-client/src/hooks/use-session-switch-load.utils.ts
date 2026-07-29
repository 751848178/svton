import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import { storedToDisplayMessages } from './session-message-conversion.utils';
import { hasVisiblePendingToolCalls } from './use-tool-approval.utils';

export async function loadSessionMessagesForSwitch(
  chatService: ChatService,
  sessionService: SessionService,
  sessionId: string,
  preservePendingToolCalls: boolean,
): Promise<void> {
  const cached = chatService.getCachedMessages(sessionId);
  if (cached) {
    await chatService.loadMessages(cached, {
      preservePendingToolCalls: shouldPreservePending(chatService, sessionId, cached, preservePendingToolCalls),
    });
    return;
  }

  const data = await sessionService.loadSession(sessionId);
  const messages = data?.messages?.length
    ? storedToDisplayMessages(data.messages)
    : [];
  await chatService.loadMessages(messages, {
    preservePendingToolCalls: shouldPreservePending(
      chatService,
      sessionId,
      messages,
      preservePendingToolCalls,
    ),
  });
}

function shouldPreservePending(
  chatService: ChatService,
  sessionId: string,
  messages: DisplayMessage[],
  preservePendingToolCalls: boolean,
): boolean {
  return preservePendingToolCalls
    || (chatService.isSessionStreaming(sessionId) && hasVisiblePendingToolCalls(messages));
}
