import { useCallback, type MutableRefObject } from 'react';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import type { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';

interface DeleteSessionParams {
  chatService: ChatService;
  sessionService: SessionService;
  transitionQueue: SessionTransitionQueue;
  isSwitching: MutableRefObject<boolean>;
  saveSessionMessages: (sessionId: string, messages: DisplayMessage[]) => Promise<void>;
  flushSessionWrites: () => Promise<void>;
}

export function useSessionDelete({
  chatService,
  sessionService,
  transitionQueue,
  isSwitching,
  saveSessionMessages,
  flushSessionWrites,
}: DeleteSessionParams) {
  return useCallback((sessionId: string): Promise<void> =>
    transitionQueue.run(async () => {
      isSwitching.current = true;
      try {
        const wasActive = sessionId === chatService.activeSessionId;
        const wasRunning = chatService.isSessionStreaming(sessionId);
        if (wasActive) {
          chatService.abortSession(sessionId);
          const snapshot = chatService.getMessagesForSave();
          if (snapshot.length > 0) {
            await saveSessionMessages(sessionId, snapshot);
          }
          chatService.cacheSessionMessages(sessionId, []);
        } else if (wasRunning) chatService.abortSession(sessionId);

        await flushSessionWrites();
        sessionService.beginDelete(sessionId);
        await chatService.deleteSessionState(sessionId);
        await sessionService.delete(sessionId);
        if (!wasActive) {
          return;
        }

        const nextSessionId = sessionService.currentSessionId;
        if (!nextSessionId) {
          chatService.bindSession(null);
          await chatService.clearMessages();
          return;
        }
        const switched = await sessionService.switchTo(nextSessionId);
        if (!switched) return;
        chatService.bindSession(nextSessionId);
        await loadSessionMessagesForSwitch(
          chatService,
          sessionService,
          nextSessionId,
          chatService.hasPendingApprovals,
        );
      } finally {
        isSwitching.current = false;
      }
    }), [
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    saveSessionMessages,
    flushSessionWrites,
  ]);
}
