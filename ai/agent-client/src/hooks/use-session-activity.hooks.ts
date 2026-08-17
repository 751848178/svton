import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatService } from '../service/chat.service';
import type { InternalLike } from '../service/provider';
import { selectSessionActivity } from '../service/session-activity.reducer';
import type {
  SessionActivityViewModel,
  SessionTerminalIdentity,
} from '../service/session-activity.types';
import type { SessionInfo } from '../service/session.types';

interface SessionActivityParams {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  ready: boolean;
  chatService: ChatService;
  chatInternal: InternalLike<ChatService>;
  markRead: (
    sessionId: string,
    terminal: SessionTerminalIdentity,
    shouldCommit: () => boolean,
  ) => Promise<boolean>;
}

/** Projects addressed run state and clears unread only for the visible selection. */
export function useSessionActivity({
  sessions,
  currentSessionId,
  ready,
  chatService,
  chatInternal,
  markRead,
}: SessionActivityParams): ReadonlyMap<string, SessionActivityViewModel> {
  const [, setVersion] = useState(0);
  const selectedRef = useRef(currentSessionId);
  const readyRef = useRef(ready);
  const activitiesRef = useRef<ReadonlyMap<string, SessionActivityViewModel>>(new Map());
  const readGeneration = useRef(0);
  selectedRef.current = currentSessionId;
  readyRef.current = ready;

  useEffect(() => chatInternal.subscribe('runStateVersion', () => {
    setVersion((value) => value + 1);
  }), [chatInternal]);

  const activities = useMemo(() => new Map(sessions.map((session) => [
    session.id,
    selectSessionActivity({ session, runState: chatService.getSessionRunState(session.id) }),
  ])), [sessions, chatService, chatService.runStateVersion]);
  activitiesRef.current = activities;

  const markVisibleSelection = useCallback(() => {
    const sessionId = selectedRef.current;
    const activity = sessionId ? activitiesRef.current.get(sessionId) : undefined;
    if (!readyRef.current || !sessionId || !activity?.isUnread || !activity.terminal) return;
    if (!isDocumentVisible()) return;
    const generation = ++readGeneration.current;
    const terminal = activity.terminal;
    void markRead(sessionId, terminal, () => {
      const current = activitiesRef.current.get(sessionId)?.terminal;
      return generation === readGeneration.current
        && readyRef.current
        && selectedRef.current === sessionId
        && isDocumentVisible()
        && sameTerminal(current, terminal);
    });
  }, [markRead]);

  useEffect(() => {
    markVisibleSelection();
  }, [activities, currentSessionId, ready, markVisibleSelection]);

  useEffect(() => {
    const handleVisibility = () => {
      readGeneration.current += 1;
      if (isDocumentVisible()) markVisibleSelection();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [markVisibleSelection]);

  return activities;
}

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function sameTerminal(
  current: SessionTerminalIdentity | null | undefined,
  expected: SessionTerminalIdentity,
): boolean {
  return !!current
    && current.runId === expected.runId
    && current.turnRevision === expected.turnRevision
    && current.at === expected.at;
}
