import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentContext, setFlushFn } from '../service/provider';
import type { DisplayMessage } from '../service/chat.service';
import type { SessionInfo } from '../service/session.service';
import { deriveTitle, displayToStoredMessages, storedToDisplayMessages } from './session-message-conversion.utils';
import { prepareBackgroundMessagesForSave } from './use-session-background-save.utils';
import { hasVisiblePendingToolCalls } from './use-tool-approval.utils';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';

export { deriveTitle, displayToStoredMessages, storedToDisplayMessages } from './session-message-conversion.utils';

/**
 * Session management hook.
 * Bridges SessionService <-> ChatService for message persistence.
 *
 * Design: session switching is handled entirely through explicit actions
 * (switchTo, create), not through a reactive watcher on currentSessionId.
 * This avoids race conditions between save/load during rapid switching.
 *
 * Background streaming: when user switches away from a session with an
 * active stream, the stream continues in the background. Messages are
 * cached per-session. Switching back loads the latest state from cache.
 */
export function useSession() {
  const { chatService, sessionService, projectService, chatInternal, sessionInternal, platform } = useAgentContext();

  const [sessions, setSessions] = useState(() => {
    const s = sessionInternal.getState('sessions');
    return Array.isArray(s) ? s : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => sessionInternal.getState('currentSessionId'),
  );

  const activeSessionId = useRef<string | null>(null);
  const isCreating = useRef(false);
  // Guard: prevent auto-save from firing during switch/create/delete
  const isSwitching = useRef(false);
  // Track the session that has a background stream running
  const backgroundStreamingId = useRef<string | null>(null);

  // ── Subscribe to observable changes (for UI reactivity only) ──
  useEffect(() => {
    const unsub1 = sessionInternal.subscribe('sessions', () => {
      const s = sessionInternal.getState('sessions');
      setSessions(Array.isArray(s) ? s : []);
    });
    const unsub2 = sessionInternal.subscribe('currentSessionId', () => {
      setCurrentSessionId(sessionInternal.getState('currentSessionId'));
    });
    return () => { unsub1(); unsub2(); };
  }, [sessionInternal]);

  // ── Core: save messages of a specific session ─────────────
  const saveSessionMessages = useCallback(async (
    sessionId: string,
    messages: DisplayMessage[],
  ) => {
    if (messages.length === 0) return;
    const chatMessages = displayToStoredMessages(messages);
    const existing = await sessionService.loadSession(sessionId);
    if (existing) {
      const title = deriveTitle(existing.title, messages);
      await sessionService.saveSession({
        id: existing.id,
        title,
        model: existing.model,
        messages: chatMessages,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        projectId: existing.projectId,
      });
    } else {
      // Session record not yet in storage — create from the session list entry
      const sessList = sessionInternal.getState('sessions');
      const info = (sessList as SessionInfo[]).find((s) => s.id === sessionId);
      if (!info) return;
      await sessionService.saveSession({
        id: info.id,
        title: deriveTitle(info.title, messages),
        model: info.model || '',
        messages: chatMessages,
        createdAt: info.createdAt || Date.now(),
        updatedAt: Date.now(),
        projectId: info.projectId,
      });
    }
  }, [sessionService, sessionInternal]);

  const saveBackgroundSessionMessages = useCallback(async (sessionId: string) => {
    const snapshot = prepareBackgroundMessagesForSave(chatService.getCachedMessages(sessionId));
    if (snapshot.length > 0) {
      await saveSessionMessages(sessionId, snapshot);
    }
  }, [chatService, saveSessionMessages]);

  // ── Startup: restore or create session ────────────────────
  const [sessionReady, setSessionReady] = useState(() => sessionInternal.getState('ready'));
  useEffect(() => {
    const unsub = sessionInternal.subscribe('ready', () => {
      setSessionReady(sessionInternal.getState('ready'));
    });
    return () => unsub();
  }, [sessionInternal]);

  const startupDone = useRef(false);
  useEffect(() => {
    if (!sessionReady || startupDone.current) return;

    const sessList = sessionInternal.getState('sessions');
    const savedId = sessionInternal.getState('currentSessionId');

    const finishStartup = (sid: string, data: unknown) => {
      if (data && typeof data === 'object') {
        const d = data as { messages?: unknown[] };
        if (d.messages && d.messages.length > 0) {
          chatService.loadMessages(storedToDisplayMessages(d.messages));
        }
      }
      chatService.bindSession(sid);
      activeSessionId.current = sid;
      startupDone.current = true;
    };

    if (savedId && sessList.some((s: { id: string }) => s.id === savedId)) {
      sessionService.loadSession(savedId).then((data) => {
        sessionService.switchTo(savedId);
        finishStartup(savedId, data);
      });
    } else if (sessList.length > 0) {
      const recent = sessList[0];
      sessionService.loadSession(recent.id).then((data) => {
        sessionService.switchTo(recent.id);
        finishStartup(recent.id, data);
      });
    } else {
      sessionService.create().then((id) => {
        finishStartup(id, null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  // ── Background stream completion handler ─────────────────
  useEffect(() => {
    chatService.onBackgroundStreamEnd = (sessionId: string) => {
      const bgMsgs = chatService.getCachedMessages(sessionId);
      if (bgMsgs && bgMsgs.length > 0) {
        const filtered = bgMsgs.filter((m: DisplayMessage) => m.role !== 'system' && !m.isStreaming);
        if (filtered.length > 0) {
          saveSessionMessages(sessionId, filtered);
        }
      }
      if (backgroundStreamingId.current === sessionId) {
        backgroundStreamingId.current = null;
      }
    };
    return () => { chatService.onBackgroundStreamEnd = null; };
  }, [chatService, saveSessionMessages]);

  // ── Auto-save when chat completes (status → idle) ────────
  // Only fires for the active session's streams.
  // Background stream saves are handled by onBackgroundStreamEnd callback.
  useEffect(() => {
    let prevStatus = chatInternal.getState('status');
    const unsub = chatInternal.subscribe('status', () => {
      const newStatus = chatInternal.getState('status');
      if (newStatus === 'idle' && prevStatus !== 'idle' && !isSwitching.current) {
        const activeId = activeSessionId.current;
        if (activeId) {
          const snapshot = chatService.getMessagesForSave();
          saveSessionMessages(activeId, snapshot);
        }
      }
      prevStatus = newStatus;
    });
    return () => unsub();
  }, [chatInternal, chatService, saveSessionMessages]);

  // ── Save on hide (page close / minimize) ──────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        // Force-save: mark streaming messages as complete to prevent data loss
        if (activeSessionId.current) {
          const snapshot = chatService.forcePrepareForSave();
          saveSessionMessages(activeSessionId.current, snapshot);
        }
        // Also save any background session's cached messages
        const bgId = backgroundStreamingId.current;
        if (bgId) {
          saveBackgroundSessionMessages(bgId);
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  // ── Flush: force-save all pending messages (for app shutdown) ──
  const flush = useCallback(async () => {
    const activeId = activeSessionId.current;
    if (activeId) {
      const snapshot = chatService.forcePrepareForSave();
      await saveSessionMessages(activeId, snapshot);
    }
    // Background sessions
    const bgId = backgroundStreamingId.current;
    if (bgId) {
      await saveBackgroundSessionMessages(bgId);
    }
  }, [chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  // Register global flush for external callers (e.g. Tauri onCloseRequested)
  useEffect(() => { setFlushFn(flush); return () => setFlushFn(async () => {}); }, [flush]);

  // ── Desktop (Tauri) only: flush messages before window closes ──
  // Uses beforeunload + pagehide (not onCloseRequested) so the native close
  // button is NEVER intercepted. The previous approach (onCloseRequested with
  // preventDefault) caused the window close button to stop working because
  // destroy() could fail silently. Now we persist synchronously via
  // beforeunload and let the OS close the window naturally.
  useEffect(() => {
    if (platform.type !== 'tauri') return;

    const handler = () => {
      // Synchronous flush attempt — fire and forget, the OS will close
      // the window regardless. The visibilitychange handler + auto-save
      // on idle already covers most cases; this is a last-resort safety net.
      if (activeSessionId.current) {
        try {
          const snapshot = chatService.forcePrepareForSave();
          // Can't await in beforeunload — fire synchronously
          saveSessionMessages(activeSessionId.current, snapshot).catch(() => {});
        } catch {
          // Don't block close on errors
        }
      }
      const bgId = backgroundStreamingId.current;
      if (bgId) {
        saveBackgroundSessionMessages(bgId).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [platform, flush, chatService, saveBackgroundSessionMessages, saveSessionMessages]);

  // ── First message: immediate title + projectId + sidebar visibility ──
  useEffect(() => {
    let prevLen = (chatInternal.getState('messages') as DisplayMessage[]).length;
    const unsub = chatInternal.subscribe('messages', () => {
      const msgs = chatInternal.getState('messages') as DisplayMessage[];
      const currentLen = msgs.length;

      // Detect first user message in a new session
      if (prevLen === 0 && currentLen > 0 && activeSessionId.current && !isSwitching.current) {
        const firstMsg = msgs[0];
        if (firstMsg.role === 'user') {
          const text = firstMsg.content.replace(/\n/g, ' ').trim();
          const title = text.length > 40 ? text.slice(0, 40) + '...' : text;
          const projectId = projectService.currentProjectId ?? undefined;
          sessionService.updateSessionInfo(activeSessionId.current, {
            title,
            projectId,
            messageCount: 1,
          });
        }
      }
      prevLen = currentLen;
    });
    return () => unsub();
  }, [chatInternal, sessionService, projectService]);

  // ── Actions ───────────────────────────────────────────────

  const create = useCallback(async (title?: string, model?: string, projectId?: string) => {
    if (isCreating.current) return;
    isCreating.current = true;
    isSwitching.current = true;
    try {
      const oldSessionId = activeSessionId.current;
      let preservePendingToolCalls = chatService.hasPendingApprovals;

      if (oldSessionId) {
        const currentMsgs = [...chatService.messages];
        chatService.cacheSessionMessages(oldSessionId, currentMsgs);

        if (chatService.status === 'running' || chatService.status === 'waiting_approval') {
          backgroundStreamingId.current = oldSessionId;
          preservePendingToolCalls = chatService.hasPendingApprovals;
        } else {
          const snapshot = chatService.getMessagesForSave();
          if (snapshot.length > 0) {
            await saveSessionMessages(oldSessionId, snapshot);
          }
        }
      }

      const id = await sessionService.create(title, model, projectId);
      chatService.clearMessages({ preservePendingToolCalls });
      chatService.bindSession(id);
      activeSessionId.current = id;
      return id;
    } finally {
      isCreating.current = false;
      isSwitching.current = false;
    }
  }, [saveSessionMessages, sessionService, chatService]);

  const switchTo = useCallback(async (id: string) => {
    if (id === activeSessionId.current) return;

    isSwitching.current = true;
    try {
      const oldSessionId = activeSessionId.current;
      let preservePendingToolCalls = chatService.hasPendingApprovals;

      if (oldSessionId) {
        const currentMsgs = [...chatService.messages];
        chatService.cacheSessionMessages(oldSessionId, currentMsgs);

        if (chatService.status === 'running' || chatService.status === 'waiting_approval') {
          backgroundStreamingId.current = oldSessionId;
          preservePendingToolCalls = chatService.hasPendingApprovals;
          chatService.status = 'idle';
        } else {
          const snapshot = chatService.getMessagesForSave();
          if (snapshot.length > 0) {
            await saveSessionMessages(oldSessionId, snapshot);
          }
        }
      }

      sessionService.switchTo(id);
      chatService.bindSession(id);

      await loadSessionMessagesForSwitch(chatService, sessionService, id, preservePendingToolCalls);
      if (chatService.isSessionStreaming(id)) {
        const hasPendingApproval = preservePendingToolCalls
          || hasVisiblePendingToolCalls(chatService.messages);
        chatService.status = hasPendingApproval ? 'waiting_approval' : 'running';
      }

      activeSessionId.current = id;
    } finally {
      isSwitching.current = false;
    }
  }, [saveSessionMessages, sessionService, chatService]);

  const deleteSession = useCallback(async (id: string) => {
    isSwitching.current = true;
    try {
      if (id === activeSessionId.current) {
        chatService.abortIfStreaming();
        const snapshot = chatService.getMessagesForSave();
        if (snapshot.length > 0) {
          await saveSessionMessages(id, snapshot);
        }
        chatService.cacheSessionMessages(id, []);
      } else if (chatService.isSessionStreaming(id)) {
        const onBackgroundStreamEnd = chatService.onBackgroundStreamEnd;
        chatService.onBackgroundStreamEnd = null;
        chatService.abort();
        chatService.onBackgroundStreamEnd = onBackgroundStreamEnd;
        backgroundStreamingId.current = null;
        chatService.cacheSessionMessages(id, []);
      }
      await sessionService.delete(id);
      if (activeSessionId.current === id) {
        const remaining = sessionInternal.getState('sessions');
        if (remaining.length > 0) {
          const nextSession = remaining[0];
          sessionService.switchTo(nextSession.id);
          chatService.bindSession(nextSession.id);
          const cached = chatService.getCachedMessages(nextSession.id);
          if (cached) {
            chatService.loadMessages(cached);
          } else {
            const data = await sessionService.loadSession(nextSession.id);
            if (data?.messages?.length) {
              chatService.loadMessages(storedToDisplayMessages(data.messages));
            } else {
              chatService.clearMessages();
            }
          }
          activeSessionId.current = nextSession.id;
        } else {
          chatService.bindSession(null);
          chatService.clearMessages();
          activeSessionId.current = null;
        }
      }
    } finally {
      isSwitching.current = false;
    }
  }, [saveSessionMessages, sessionService, sessionInternal, chatService]);

  const updateProjectId = useCallback(async (sessionId: string, projectId: string | undefined) => {
    await sessionService.updateProjectId(sessionId, projectId);
  }, [sessionService]);

  return {
    sessions, currentSessionId, create,
    delete: deleteSession, switchTo,
    load: (id: string) => sessionService.loadSession(id),
    saveSessionMessages, flush,
    updateProjectId,
  };
}

// ── Helpers ─────────────────────────────────────────────────
