import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatService, DisplayMessage } from '../service/chat.service';
import type { InternalLike } from '../service/provider';
import type { SessionService } from '../service/session.service';
import { SessionTransitionQueue } from '../service/session-transition-queue.service';
import { setFlushFn } from '../service/provider';
import { deriveTitle, displayToStoredMessages } from './session-message-conversion.utils';
import { prepareBackgroundMessagesForSave } from './use-session-background-save.utils';

interface SessionPersistenceParams {
  chatService: ChatService;
  sessionService: SessionService;
  chatInternal: InternalLike<ChatService>;
  platform: IPlatform;
  isSwitching: MutableRefObject<boolean>;
}

export function useSessionPersistence({
  chatService,
  sessionService,
  chatInternal,
  platform,
  isSwitching,
}: SessionPersistenceParams) {
  const saveQueue = useRef(new SessionTransitionQueue()).current;

  const saveSessionMessages = useCallback((
    sessionId: string,
    messages: DisplayMessage[],
  ): Promise<void> => {
    if (messages.length === 0) return Promise.resolve();
    const snapshot = [...messages];
    const storedMessages = displayToStoredMessages(snapshot);
    return saveQueue.run(async () => {
      const existing = await sessionService.loadSession(sessionId);
      if (existing) {
        await sessionService.saveSession({
          ...existing,
          title: deriveTitle(existing.title, snapshot),
          messages: storedMessages,
          updatedAt: Date.now(),
        });
        return;
      }
      const info = sessionService.sessions.find((session) => session.id === sessionId);
      if (!info) return;
      await sessionService.saveSession({
        id: info.id,
        title: deriveTitle(info.title, snapshot),
        model: info.model || '',
        messages: storedMessages,
        createdAt: info.createdAt || Date.now(),
        updatedAt: Date.now(),
        projectId: info.projectId,
      });
    });
  }, [saveQueue, sessionService]);

  const saveBackgroundSessionMessages = useCallback((sessionId: string) => {
    const messages = prepareBackgroundMessagesForSave(
      chatService.getCachedMessages(sessionId),
    );
    return saveSessionMessages(sessionId, messages);
  }, [chatService, saveSessionMessages]);

  useEffect(() => {
    chatService.onBackgroundStreamEnd = (sessionId: string) => {
      void saveBackgroundSessionMessages(sessionId);
      void chatService.syncRuntimeToActiveSession();
    };
    return () => { chatService.onBackgroundStreamEnd = null; };
  }, [chatService, saveBackgroundSessionMessages]);

  useEffect(() => {
    let previousStatus = chatInternal.getState('status');
    const unsubscribe = chatInternal.subscribe('status', () => {
      const status = chatInternal.getState('status');
      if (status === 'idle' && previousStatus !== 'idle' && !isSwitching.current) {
        const sessionId = chatService.activeSessionId;
        if (sessionId) {
          void saveSessionMessages(sessionId, chatService.getMessagesForSave());
        }
      }
      previousStatus = status;
    });
    return () => unsubscribe();
  }, [chatInternal, chatService, isSwitching, saveSessionMessages]);

  useEffect(() => {
    const saveOnHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (chatService.activeSessionId) {
        void saveSessionMessages(
          chatService.activeSessionId,
          chatService.forcePrepareForSave(),
        );
      }
      if (chatService.backgroundSessionId) {
        void saveBackgroundSessionMessages(chatService.backgroundSessionId);
      }
    };
    document.addEventListener('visibilitychange', saveOnHide);
    return () => document.removeEventListener('visibilitychange', saveOnHide);
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  const flush = useCallback(async () => {
    if (chatService.activeSessionId) {
      await saveSessionMessages(
        chatService.activeSessionId,
        chatService.forcePrepareForSave(),
      );
    }
    if (chatService.backgroundSessionId) {
      await saveBackgroundSessionMessages(chatService.backgroundSessionId);
    }
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  useEffect(() => {
    setFlushFn(flush);
    return () => setFlushFn(async () => {});
  }, [flush]);

  useEffect(() => {
    if (platform.type !== 'tauri') return;
    const saveBeforeClose = () => {
      if (chatService.activeSessionId) {
        void saveSessionMessages(
          chatService.activeSessionId,
          chatService.forcePrepareForSave(),
        );
      }
      if (chatService.backgroundSessionId) {
        void saveBackgroundSessionMessages(chatService.backgroundSessionId);
      }
    };
    window.addEventListener('beforeunload', saveBeforeClose);
    window.addEventListener('pagehide', saveBeforeClose);
    return () => {
      window.removeEventListener('beforeunload', saveBeforeClose);
      window.removeEventListener('pagehide', saveBeforeClose);
    };
  }, [platform.type, chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  return { saveSessionMessages, flush };
}
