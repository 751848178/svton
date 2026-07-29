import { useEffect, useRef, type MutableRefObject } from 'react';
import type { ChatService } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import type { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';
import { resolveStartupSessionId } from './session-startup.utils';

interface SessionStartupParams {
  ready: boolean;
  initialSessionId?: string;
  chatService: ChatService;
  sessionService: SessionService;
  transitionQueue: SessionTransitionQueue;
  isSwitching: MutableRefObject<boolean>;
}

export function useSessionStartup({
  ready,
  initialSessionId,
  chatService,
  sessionService,
  transitionQueue,
  isSwitching,
}: SessionStartupParams): void {
  const started = useRef(false);

  useEffect(() => {
    if (!ready) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    void transitionQueue.run(async () => {
      isSwitching.current = true;
      try {
        const sessionId = resolveStartupSessionId(
          sessionService.sessions,
          initialSessionId,
          sessionService.currentSessionId,
        );
        if (sessionId) {
          sessionService.switchTo(sessionId);
          chatService.bindSession(sessionId);
          await loadSessionMessagesForSwitch(chatService, sessionService, sessionId, false);
          return;
        }
        const createdId = await sessionService.create();
        chatService.bindSession(createdId);
        await chatService.clearMessages();
      } finally {
        isSwitching.current = false;
      }
    });
  }, [
    ready,
    initialSessionId,
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
  ]);
}
