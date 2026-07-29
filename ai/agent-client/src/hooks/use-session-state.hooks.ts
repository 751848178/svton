import { useEffect, useState } from 'react';
import type { InternalLike } from '../service/provider';
import type { SessionInfo, SessionService } from '../service/session.service';

export function useSessionState(sessionInternal: InternalLike<SessionService>) {
  const [sessions, setSessions] = useState<SessionInfo[]>(() => {
    const value = sessionInternal.getState('sessions');
    return Array.isArray(value) ? value : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => sessionInternal.getState('currentSessionId'),
  );
  const [ready, setReady] = useState(() => sessionInternal.getState('ready'));

  useEffect(() => {
    const unsubscribeSessions = sessionInternal.subscribe('sessions', () => {
      const value = sessionInternal.getState('sessions');
      setSessions(Array.isArray(value) ? value : []);
    });
    const unsubscribeCurrent = sessionInternal.subscribe('currentSessionId', () => {
      setCurrentSessionId(sessionInternal.getState('currentSessionId'));
    });
    const unsubscribeReady = sessionInternal.subscribe('ready', () => {
      setReady(sessionInternal.getState('ready'));
    });
    return () => {
      unsubscribeSessions();
      unsubscribeCurrent();
      unsubscribeReady();
    };
  }, [sessionInternal]);

  return { sessions, currentSessionId, ready };
}
