import { useCallback, useRef, type MutableRefObject } from 'react';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import type { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';

interface CreateSwitchParams {
  chatService: ChatService;
  sessionService: SessionService;
  transitionQueue: SessionTransitionQueue;
  isSwitching: MutableRefObject<boolean>;
  saveSessionMessages: (sessionId: string, messages: DisplayMessage[]) => Promise<void>;
}

async function prepareCurrentSession({
  chatService,
  saveSessionMessages,
}: Pick<CreateSwitchParams, 'chatService' | 'saveSessionMessages'>): Promise<boolean> {
  const sessionId = chatService.activeSessionId;
  let preservePending = chatService.hasPendingApprovalsForSession(sessionId);
  if (!sessionId) return preservePending;
  chatService.cacheSessionMessages(sessionId, [...chatService.messages]);
  if (chatService.status === 'running' || chatService.status === 'waiting_approval') {
    preservePending = chatService.hasPendingApprovalsForSession(sessionId);
  } else {
    const snapshot = chatService.getMessagesForSave();
    if (snapshot.length > 0) await saveSessionMessages(sessionId, snapshot);
  }
  return preservePending;
}

export function useSessionCreateSwitch({
  chatService,
  sessionService,
  transitionQueue,
  isSwitching,
  saveSessionMessages,
}: CreateSwitchParams) {
  const isCreating = useRef(false);

  const create = useCallback((
    title?: string,
    model?: string,
    projectId?: string,
  ): Promise<string | undefined> => {
    if (isCreating.current) return Promise.resolve(undefined);
    isCreating.current = true;
    return transitionQueue.run(async () => {
      isSwitching.current = true;
      try {
        const preservePending = await prepareCurrentSession({
          chatService,
          saveSessionMessages,
        });
        const sessionId = await sessionService.create(title, model, projectId);
        chatService.bindSession(sessionId);
        await chatService.clearMessages({ preserveLiveApprovals: preservePending });
        return sessionId;
      } finally {
        isSwitching.current = false;
        isCreating.current = false;
      }
    });
  }, [
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    saveSessionMessages,
  ]);

  const switchTo = useCallback((sessionId: string): Promise<void> =>
    transitionQueue.run(async () => {
      if (sessionId === chatService.activeSessionId) return;
      isSwitching.current = true;
      try {
        const preservePending = await prepareCurrentSession({
          chatService,
          saveSessionMessages,
        });
        const switched = await sessionService.switchTo(sessionId);
        if (!switched) return;
        chatService.bindSession(sessionId);
        await loadSessionMessagesForSwitch(
          chatService,
          sessionService,
          sessionId,
          preservePending,
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
  ]);

  return { create, switchTo };
}
