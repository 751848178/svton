import { useEffect, type MutableRefObject } from 'react';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { InternalLike } from '../service/provider';
import type { ProjectService } from '../service/project.service';
import type { SessionService } from '../service/session.service';

export function useSessionTitleSync(
  chatService: ChatService,
  chatInternal: InternalLike<ChatService>,
  sessionService: SessionService,
  projectService: ProjectService,
  isSwitching: MutableRefObject<boolean>,
): void {
  useEffect(() => {
    let previousLength = (chatInternal.getState('messages') as DisplayMessage[]).length;
    const unsubscribe = chatInternal.subscribe('messages', () => {
      const messages = chatInternal.getState('messages') as DisplayMessage[];
      if (
        previousLength === 0
        && messages.length > 0
        && chatService.activeSessionId
        && !isSwitching.current
        && messages[0].role === 'user'
      ) {
        const text = messages[0].content.replace(/\n/g, ' ').trim();
        void sessionService.updateSessionInfo(chatService.activeSessionId, {
          title: text.length > 40 ? `${text.slice(0, 40)}...` : text,
          projectId: projectService.currentProjectId ?? undefined,
          messageCount: 1,
        });
      }
      previousLength = messages.length;
    });
    return () => unsubscribe();
  }, [chatInternal, chatService, sessionService, projectService, isSwitching]);
}
