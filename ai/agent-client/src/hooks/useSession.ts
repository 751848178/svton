import { useCallback, useMemo, useRef } from 'react';
import { useAgentContext } from '../service/provider';
import { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { useSessionState } from './use-session-state.hooks';
import { useSessionPersistence } from './use-session-persistence.hooks';
import { useSessionStartup } from './use-session-startup.hooks';
import { useSessionCreateSwitch } from './use-session-create-switch.hooks';
import { useSessionDelete } from './use-session-delete.hooks';
import { useSessionTitleSync } from './use-session-title-sync.hooks';
import { useSessionActivity } from './use-session-activity.hooks';
import { useSessionManagement } from './use-session-management.hooks';
import { useSessionSearch } from './use-session-search.hooks';
import { projectSessionManagement } from '../service/session-management-projection';
import { selectSessionScope } from '../service/session-management-selectors';

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
  const {
    saveSessionMessages,
    updateSessionPreview,
    markSessionRead,
    flushSessionWrites,
    runSessionMutation,
    flush,
  } = useSessionPersistence({
    chatService,
    sessionService,
    chatInternal,
    platform,
  });
  const activityBySessionId = useSessionActivity({
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    ready: state.ready,
    chatService,
    chatInternal,
    markRead: markSessionRead,
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
    flushSessionWrites,
  });
  const management = useSessionManagement({
    chatService,
    sessionService,
    transitionQueue,
    isSwitching,
    flushSessionWrites,
    runSessionMutation,
    deleteSession,
  });
  const activeSessions = useMemo(
    () => selectSessionScope(state.sessions, 'active'), [state.sessions],
  );
  const archivedSessions = useMemo(
    () => selectSessionScope(state.sessions, 'archived'), [state.sessions],
  );
  const managementBySessionId = useMemo(() => new Map(state.sessions.map((session) => [
    session.id,
    projectSessionManagement(session, activityBySessionId.get(session.id)),
  ])), [state.sessions, activityBySessionId]);
  const search = useSessionSearch(sessionService, state.sessions);
  const updateProjectId = useCallback((
    sessionId: string,
    projectId: string | undefined,
  ) => sessionService.updateProjectId(sessionId, projectId), [sessionService]);

  return {
    sessions: activeSessions,
    archivedSessions,
    allSessions: state.sessions,
    currentSessionId: state.currentSessionId,
    activityBySessionId,
    managementBySessionId,
    management,
    search,
    create,
    delete: deleteSession,
    switchTo,
    load: (sessionId: string) => sessionService.loadSession(sessionId),
    saveSessionMessages,
    flush,
    updateProjectId,
  };
}
