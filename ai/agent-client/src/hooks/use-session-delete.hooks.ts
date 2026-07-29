import { useCallback, type MutableRefObject } from 'react';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import type { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { hasVisiblePendingToolCalls } from './use-tool-approval.utils';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';

interface DeleteSessionParams {
  chatService: ChatService;
  sessionService: SessionService;
  transitionQueue: SessionTransitionQueue;
  isSwitching: MutableRefObject<boolean>;
  saveSessionMessages: (sessionId: string, messages: DisplayMessage[]) => Promise<void>;
}

export function useSessionDelete({
  chatService,
  sessionService,
  transitionQueue,
  isSwitching,
  saveSessionMessages,
}: DeleteSessionParams) {
  return useCallback((sessionId: string): Promise<void> =>
    transitionQueue.run(async () => {
      isSwitching.current = true;
      try {
        const wasActive = sessionId === chatService.activeSessionId;
        const wasBackground = chatService.isSessionStreaming(sessionId);
        if (wasActive) {
          chatService.abortIfStreaming();
          const snapshot = chatService.getMessagesForSave();
          if (snapshot.length > 0) {
            await saveSessionMessages(sessionId, snapshot);
          }
          chatService.cacheSessionMessages(sessionId, []);
        } else if (wasBackground) {
          const callback = chatService.onBackgroundStreamEnd;
          chatService.onBackgroundStreamEnd = null;
          chatService.abort();
          chatService.onBackgroundStreamEnd = callback;
          chatService.cacheSessionMessages(sessionId, []);
        }

        await sessionService.delete(sessionId);
        if (!wasActive) {
          if (wasBackground) await chatService.syncRuntimeToActiveSession();
          return;
        }

        const nextSession = sessionService.sessions[0];
        if (!nextSession) {
          chatService.bindSession(null);
          await chatService.clearMessages();
          return;
        }
        sessionService.switchTo(nextSession.id);
        chatService.bindSession(nextSession.id);
        await loadSessionMessagesForSwitch(
          chatService,
          sessionService,
          nextSession.id,
          false,
        );
        if (chatService.isSessionStreaming(nextSession.id)) {
          chatService.status = hasVisiblePendingToolCalls(chatService.messages)
            ? 'waiting_approval'
            : 'running';
        }
      } finally {
        isSwitching.current = false;
      }
    }), [
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    saveSessionMessages,
  ]);
}
