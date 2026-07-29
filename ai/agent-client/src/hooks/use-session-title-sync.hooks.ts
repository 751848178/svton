import { useEffect, type MutableRefObject } from 'react';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { InternalLike } from '../service/provider';
import type { ProjectService } from '../service/project.service';

export function useSessionTitleSync(
  chatService: ChatService,
  chatInternal: InternalLike<ChatService>,
  projectService: ProjectService,
  isSwitching: MutableRefObject<boolean>,
  updateSessionPreview: (
    sessionId: string,
    messages: DisplayMessage[],
    projectId: string | undefined,
  ) => Promise<void>,
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
        void updateSessionPreview(
          chatService.activeSessionId,
          messages,
          projectService.currentProjectId ?? undefined,
        );
      }
      previousLength = messages.length;
    });
    return () => unsubscribe();
  }, [chatInternal, chatService, projectService, isSwitching, updateSessionPreview]);
}
