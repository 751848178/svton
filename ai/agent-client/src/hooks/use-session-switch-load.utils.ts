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
    chatService.loadMessages(cached, {
      preservePendingToolCalls: shouldPreservePending(chatService, sessionId, cached, preservePendingToolCalls),
    });
    return;
  }

  const data = await sessionService.loadSession(sessionId);
  if (data?.messages?.length) {
    const messages = storedToDisplayMessages(data.messages);
    chatService.loadMessages(messages, {
      preservePendingToolCalls: shouldPreservePending(chatService, sessionId, messages, preservePendingToolCalls),
    });
    return;
  }

  chatService.clearMessages({ preservePendingToolCalls });
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
