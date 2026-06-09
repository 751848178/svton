import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentContext } from '../service/provider';
import type { DisplayMessage } from '../service/chat.service';

/**
 * Session management hook.
 * Bridges SessionService <-> ChatService for message persistence.
 *
 * Design: session switching is handled entirely through explicit actions
 * (switchTo, create), not through a reactive watcher on currentSessionId.
 * This avoids race conditions between save/load during rapid switching.
 */
export function useSession() {
  const { chatService, sessionService, chatInternal, sessionInternal } = useAgentContext();

  const [sessions, setSessions] = useState(() => {
    const s = sessionInternal.getState('sessions');
    return Array.isArray(s) ? s : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => sessionInternal.getState('currentSessionId'),
  );

  const activeSessionId = useRef<string | null>(null);
  const isCreating = useRef(false);

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
    if (!existing) return;
    const title = deriveTitle(existing.title, messages);
    await sessionService.saveSession({
      id: existing.id,
      title,
      model: existing.model,
      messages: chatMessages,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    });
  }, [sessionService]);

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

  // ── Auto-save when chat completes (status → idle) ────────
  // Subscribe directly to the observable (bypasses React batching)
  useEffect(() => {
    let prevStatus = chatInternal.getState('status');
    const unsub = chatInternal.subscribe('status', () => {
      const newStatus = chatInternal.getState('status');
      if (newStatus === 'idle' && prevStatus !== 'idle' && activeSessionId.current) {
        const snapshot = chatService.getMessagesForSave();
        saveSessionMessages(activeSessionId.current, snapshot);
      }
      prevStatus = newStatus;
    });
    return () => unsub();
  }, [chatInternal, chatService, saveSessionMessages]);

  // ── Save on hide (page close / minimize) ──────────────────
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden' && activeSessionId.current) {
        const snapshot = chatService.getMessagesForSave();
        saveSessionMessages(activeSessionId.current, snapshot);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [saveSessionMessages]);

  // ── Actions ───────────────────────────────────────────────

  /**
   * Create a new session:
   * 1. Save current session's messages (snapshot)
   * 2. Create new session via service
   * 3. Clear chat messages for new empty session
   */
  const create = useCallback(async (title?: string, model?: string) => {
    if (isCreating.current) return;
    const msgs = chatService.getMessagesForSave();
    if (msgs.length === 0 && activeSessionId.current) {
      return activeSessionId.current;
    }
    isCreating.current = true;
    try {
      // 1. Save current session
      if (activeSessionId.current && msgs.length > 0) {
        await saveSessionMessages(activeSessionId.current, msgs);
      }
      // 2. Create new session (this sets currentSessionId observable)
      const id = await sessionService.create(title, model);
      // 3. Clear messages for new empty session
      chatService.clearMessages();
      activeSessionId.current = id;
      return id;
    } finally {
      isCreating.current = false;
    }
  }, [saveSessionMessages, sessionService, chatService]);

  /**
   * Switch to another session:
   * 1. Snapshot current messages
   * 2. Save current session
   * 3. Switch observable (updates sidebar)
   * 4. Load target session's messages
   */
  const switchTo = useCallback(async (id: string) => {
    if (id === activeSessionId.current) return;

    // 1. Snapshot current messages before any async
    const snapshot = chatService.getMessagesForSave();

    // 2. Save current session
    if (activeSessionId.current && snapshot.length > 0) {
      await saveSessionMessages(activeSessionId.current, snapshot);
    }

    // 3. Switch observable (updates currentSessionId for sidebar highlight)
    sessionService.switchTo(id);

    // 4. Load target session's messages
    const data = await sessionService.loadSession(id);
    if (data?.messages?.length) {
      chatService.loadMessages(storedToDisplayMessages(data.messages));
    } else {
      chatService.clearMessages();
    }

    activeSessionId.current = id;
  }, [saveSessionMessages, sessionService, chatService]);

  const deleteSession = useCallback(async (id: string) => {
    // If deleting the active session, save first
    if (id === activeSessionId.current) {
      const snapshot = chatService.getMessagesForSave();
      if (snapshot.length > 0) {
        await saveSessionMessages(id, snapshot);
      }
    }
    await sessionService.delete(id);
    if (activeSessionId.current === id) {
      // Switch to remaining session or clear
      const remaining = sessionInternal.getState('sessions');
      if (remaining.length > 0) {
        activeSessionId.current = remaining[0].id;
      } else {
        activeSessionId.current = null;
      }
    }
  }, [saveSessionMessages, sessionService, sessionInternal]);

  return {
    sessions, currentSessionId, create,
    delete: deleteSession, switchTo,
    load: (id: string) => sessionService.loadSession(id),
    saveSessionMessages,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function deriveTitle(currentTitle: string, messages: DisplayMessage[]): string {
  if (!currentTitle.startsWith('Chat ')) return currentTitle;
  const first = messages.find((m) => m.role === 'user');
  if (!first?.content) return currentTitle;
  const text = first.content.replace(/\n/g, ' ').trim();
  return text.length > 40 ? text.slice(0, 40) + '...' : text;
}

function displayToStoredMessages(msgs: DisplayMessage[]): unknown[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content,
      thinking: m.thinking || undefined,
      images: m.images || undefined,
      toolCalls: m.toolCalls?.length ? m.toolCalls.map((tc) => ({
        id: tc.id, name: tc.name, arguments: tc.arguments, status: tc.status,
        result: tc.result ? { callId: tc.result.callId, output: tc.result.output, isError: tc.result.isError } : undefined,
      })) : undefined,
    }));
}

function storedToDisplayMessages(msgs: unknown[]): DisplayMessage[] {
  let c = 0;
  const out: DisplayMessage[] = [];
  for (const raw of msgs) {
    const m = raw as Record<string, unknown>;
    if (!m.role || !m.content) continue;
    const tc = m.toolCalls as Array<{ id: string; name: string; arguments: Record<string, unknown>; status: string; result?: { callId: string; output: string; isError?: boolean } }> | undefined;
    out.push({
      id: `restored_${++c}_${Date.now()}`,
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      thinking: m.thinking as string | undefined,
      images: m.images as Array<{ data: string; mimeType?: string }> | undefined,
      toolCalls: tc?.map((t) => ({
        id: t.id, name: t.name, arguments: t.arguments,
        status: t.status as 'running' | 'completed' | 'error' | 'pending_approval',
        result: t.result ? { callId: t.result.callId, output: t.result.output, isError: t.result.isError } : undefined,
      })) || [],
      timestamp: Date.now(),
    });
  }
  return out;
}
