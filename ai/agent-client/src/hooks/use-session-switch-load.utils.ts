import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import { storedToDisplayMessages } from './session-message-conversion.utils';
import { hasVisiblePendingToolCalls } from './use-tool-approval.utils';

export async function loadSessionMessagesForSwitch(
  chatService: ChatService,
  sessionService: SessionService,
  sessionId: string,
  preserveLiveApprovals: boolean,
): Promise<void> {
  const cached = chatService.getCachedMessages(sessionId);
  if (cached) {
    const preserveTargetApproval = shouldPreservePending(
      chatService,
      sessionId,
      cached,
    );
    await chatService.loadMessages(cached, {
      preservePendingToolCalls: preserveTargetApproval,
      preserveLiveApprovals,
    });
    return;
  }

  const data = await sessionService.loadSession(sessionId);
  const messages = data?.messages?.length
    ? storedToDisplayMessages(data.messages)
    : [];
  const preserveTargetApproval = shouldPreservePending(
    chatService,
    sessionId,
    messages,
  );
  await chatService.loadMessages(messages, {
    preservePendingToolCalls: preserveTargetApproval,
    preserveLiveApprovals,
  });
}

function shouldPreservePending(
  chatService: ChatService,
  sessionId: string,
  messages: DisplayMessage[],
): boolean {
  return chatService.hasPendingApprovalsForSession(sessionId)
    && (chatService.isSessionStreaming(sessionId) || hasVisiblePendingToolCalls(messages));
}
