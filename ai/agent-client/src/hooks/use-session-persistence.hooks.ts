import { useCallback, useEffect, useRef } from 'react';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { InternalLike } from '../service/provider';
import type { SessionService } from '../service/session.service';
import { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { setFlushFn } from '../service/provider';
import { displayToStoredMessages } from './session-message-conversion.utils';
import { prepareBackgroundMessagesForSave } from './use-session-background-save.utils';
import { isTerminalRunState } from '../service/session-activity.reducer';
import type { SessionRunState } from '../service/chat-run.types';
import type { SessionTerminalIdentity } from '../service/session-activity.types';
import { resolveSessionTitle } from '../service/session-title-policy';

interface SessionPersistenceParams {
  chatService: ChatService;
  sessionService: SessionService;
  chatInternal: InternalLike<ChatService>;
  platform: IPlatform;
}

export function useSessionPersistence({
  chatService,
  sessionService,
  chatInternal,
  platform,
}: SessionPersistenceParams) {
  const saveQueue = useRef(new SessionTransitionQueue()).current;

  const saveSessionMessages = useCallback((
    sessionId: string,
    messages: DisplayMessage[],
    terminal?: SessionRunState,
  ): Promise<void> => {
    if (messages.length === 0 && !terminal) return Promise.resolve();
    const terminalCandidate = terminal ?? null;
    const durableTerminal = isTerminalRunState(terminalCandidate)
      ? terminalCandidate
      : undefined;
    const snapshot = [...messages];
    const storedMessages = displayToStoredMessages(snapshot);
    return saveQueue.run(async () => {
      const existing = await sessionService.loadSession(sessionId);
      if (existing) {
        const title = resolveSessionTitle(existing, snapshot);
        await sessionService.saveSession({
          ...existing,
          ...title,
          messages: storedMessages,
          updatedAt: Date.now(),
        }, durableTerminal);
        return;
      }
      const info = sessionService.sessions.find((session) => session.id === sessionId);
      if (!info) return;
      const title = resolveSessionTitle(info, snapshot);
      await sessionService.saveSession({
        schemaVersion: info.schemaVersion,
        id: info.id,
        ...title,
        model: info.model || '',
        messages: storedMessages,
        createdAt: info.createdAt || Date.now(),
        updatedAt: Date.now(),
        projectId: info.projectId,
        isPinned: info.isPinned,
        archivedAt: info.archivedAt,
        recencyAt: info.recencyAt,
      }, durableTerminal);
    });
  }, [saveQueue, sessionService]);

  const saveBackgroundSessionMessages = useCallback((sessionId: string) => {
    const messages = prepareBackgroundMessagesForSave(
      chatService.getCachedMessages(sessionId),
    );
    return saveSessionMessages(sessionId, messages);
  }, [chatService, saveSessionMessages]);

  const updateSessionPreview = useCallback((
    sessionId: string,
    messages: DisplayMessage[],
    projectId: string | undefined,
  ) => saveQueue.run(async () => {
    const info = sessionService.sessions.find((session) => session.id === sessionId);
    if (!info) return;
    const title = resolveSessionTitle(info, messages);
    await sessionService.updateSessionInfo(sessionId, {
      ...title,
      projectId,
      messageCount: messages.length,
    });
  }), [saveQueue, sessionService]);

  useEffect(() => {
    chatService.onBackgroundStreamEnd = (sessionId: string) => {
      void saveBackgroundSessionMessages(sessionId);
    };
    chatService.onRunDisplayPersist = async (sessionId, _phase, state) => {
      await saveSessionMessages(
        sessionId,
        chatService.forcePrepareForSessionSave(sessionId),
        state,
      );
    };
    return () => {
      chatService.onBackgroundStreamEnd = null;
      chatService.onRunDisplayPersist = undefined;
    };
  }, [chatService, saveBackgroundSessionMessages]);

  useEffect(() => {
    let previousStatus = chatInternal.getState('status');
    const unsubscribe = chatInternal.subscribe('status', () => {
      const status = chatInternal.getState('status');
      const sessionId = chatService.activeSessionId;
      if (status === 'waiting_approval' && previousStatus !== 'waiting_approval' && sessionId) {
        void saveSessionMessages(sessionId, chatService.forcePrepareForSave());
      }
      if (status === 'idle' && previousStatus !== 'idle' && sessionId) {
        void saveSessionMessages(sessionId, chatService.getMessagesForSave());
      }
      previousStatus = status;
    });
    return () => unsubscribe();
  }, [chatInternal, chatService, saveSessionMessages]);

  useEffect(() => {
    const saveOnHide = () => {
      if (document.visibilityState !== 'hidden') return;
      for (const sessionId of sessionIdsForSave(chatService)) {
        void saveSessionMessages(sessionId, chatService.forcePrepareForSessionSave(sessionId));
      }
    };
    document.addEventListener('visibilitychange', saveOnHide);
    return () => document.removeEventListener('visibilitychange', saveOnHide);
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  const flush = useCallback(async () => {
    for (const sessionId of sessionIdsForSave(chatService)) {
      await saveSessionMessages(sessionId, chatService.forcePrepareForSessionSave(sessionId));
      await chatService.flushRunJournal(sessionId);
    }
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  useEffect(() => {
    setFlushFn(flush);
    return () => setFlushFn(async () => {});
  }, [flush]);

  useEffect(() => {
    if (platform.type !== 'tauri') return;
    const saveBeforeClose = () => {
      for (const sessionId of sessionIdsForSave(chatService)) {
        void saveSessionMessages(sessionId, chatService.forcePrepareForSessionSave(sessionId));
      }
    };
    window.addEventListener('beforeunload', saveBeforeClose);
    window.addEventListener('pagehide', saveBeforeClose);
    return () => {
      window.removeEventListener('beforeunload', saveBeforeClose);
      window.removeEventListener('pagehide', saveBeforeClose);
    };
  }, [platform.type, chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  const markSessionRead = useCallback((
    sessionId: string,
    terminal: SessionTerminalIdentity,
    shouldCommit: () => boolean,
  ) => saveQueue.run(async () => {
    if (!shouldCommit()) return false;
    return sessionService.markRead(sessionId, terminal);
  }), [saveQueue, sessionService]);

  return {
    saveSessionMessages,
    updateSessionPreview,
    markSessionRead,
    flushSessionWrites: () => saveQueue.flush(),
    runSessionMutation: <T,>(mutation: () => Promise<T>) => saveQueue.run(mutation),
    flush,
  };
}

function sessionIdsForSave(chatService: ChatService): string[] {
  return [...new Set([
    ...(chatService.activeSessionId ? [chatService.activeSessionId] : []),
    ...chatService.getRunningSessionIds(),
  ])];
}
