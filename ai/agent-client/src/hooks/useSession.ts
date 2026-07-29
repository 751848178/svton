import { useCallback, useRef } from 'react';
import { useAgentContext } from '../service/provider';
import { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { useSessionState } from './use-session-state.hooks';
import { useSessionPersistence } from './use-session-persistence.hooks';
import { useSessionStartup } from './use-session-startup.hooks';
import { useSessionCreateSwitch } from './use-session-create-switch.hooks';
import { useSessionDelete } from './use-session-delete.hooks';
import { useSessionTitleSync } from './use-session-title-sync.hooks';

export {
  deriveTitle,
  displayToStoredMessages,
  storedToDisplayMessages,
} from './session-message-conversion.utils';

/** Composes isolated startup, persistence, and serialized session transitions. */
export function useSession() {
  const {
    chatService,
    sessionService,
    projectService,
    chatInternal,
    sessionInternal,
    platform,
    initialSessionId,
  } = useAgentContext();
  const transitionQueue = useRef(new SessionTransitionQueue()).current;
  const isSwitching = useRef(false);
  const state = useSessionState(sessionInternal);
  const { saveSessionMessages, updateSessionPreview, flush } = useSessionPersistence({
    chatService,
    sessionService,
    chatInternal,
    platform,
  });

  useSessionStartup({
    ready: state.ready,
    initialSessionId,
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
  });
  useSessionTitleSync(
    chatService,
    chatInternal,
    projectService,
    isSwitching,
    updateSessionPreview,
  );
  const { create, switchTo } = useSessionCreateSwitch({
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    saveSessionMessages,
  });
  const deleteSession = useSessionDelete({
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    saveSessionMessages,
  });
  const updateProjectId = useCallback((
    sessionId: string,
    projectId: string | undefined,
  ) => sessionService.updateProjectId(sessionId, projectId), [sessionService]);

  return {
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    create,
    delete: deleteSession,
    switchTo,
    load: (sessionId: string) => sessionService.loadSession(sessionId),
    saveSessionMessages,
    flush,
    updateProjectId,
  };
}
