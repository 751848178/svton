import { useCallback, useMemo, type MutableRefObject } from 'react';
import type { ChatService } from '../service/chat.service';
import type { SessionService } from '../service/session.service';
import type { SessionTransitionQueue } from '../service/session-transition-queue.service';
import type {
  SessionManagementController,
  SessionManagementResult,
} from '../service/session-management.types';
import { loadSessionMessagesForSwitch } from './use-session-switch-load.utils';

interface SessionManagementParams {
  chatService: ChatService;
  sessionService: SessionService;
  transitionQueue: SessionTransitionQueue;
  isSwitching: MutableRefObject<boolean>;
  flushSessionWrites: () => Promise<void>;
  runSessionMutation: <T>(mutation: () => Promise<T>) => Promise<T>;
  deleteSession: (id: string) => Promise<void>;
}

export function useSessionManagement(params: SessionManagementParams): SessionManagementController {
  const {
    chatService, sessionService, transitionQueue, isSwitching,
    flushSessionWrites, runSessionMutation, deleteSession,
  } = params;
  const mutate = useCallback(async (
    mutation: () => Promise<boolean>,
  ): Promise<SessionManagementResult> => {
    const ok = await runSessionMutation(mutation);
    return ok ? { ok: true } : { ok: false, reason: 'invalid' };
  }, [runSessionMutation]);

  const rename = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return { ok: false, reason: 'emptyTitle' as const };
    const ok = await runSessionMutation(() => sessionService.rename(id, title));
    return ok ? { ok: true } : { ok: false, reason: 'invalid' as const };
  }, [runSessionMutation, sessionService]);

  const archiveExact = useCallback((id: string, stop: boolean) =>
    transitionQueue.run(async (): Promise<SessionManagementResult> => {
      if (!stop && chatService.isSessionStreaming(id)) {
        return { ok: false, reason: 'active' };
      }
      isSwitching.current = true;
      try {
        if (stop) chatService.abortSession(id);
        await flushSessionWrites();
        await chatService.flushRunJournal(id);
        const archived = await runSessionMutation(() => sessionService.archive(id));
        if (!archived) return { ok: false, reason: 'invalid' };
        if (chatService.activeSessionId === id) {
          await activateFallback(chatService, sessionService);
        }
        return { ok: true };
      } finally {
        isSwitching.current = false;
      }
    }), [
    transitionQueue, chatService, isSwitching, flushSessionWrites,
    runSessionMutation, sessionService,
  ]);

  return useMemo(() => ({
    rename,
    setPinned: async (id, pinned) => mutate(() => sessionService.setPinned(id, pinned)),
    archive: (id) => archiveExact(id, false),
    stopAndArchive: (id) => archiveExact(id, true),
    unarchive: async (id) => mutate(() => sessionService.unarchive(id)),
    deletePermanently: deleteSession,
  }), [rename, mutate, archiveExact, sessionService, deleteSession]);
}

async function activateFallback(
  chatService: ChatService,
  sessionService: SessionService,
): Promise<void> {
  const nextId = sessionService.currentSessionId;
  if (!nextId || !await sessionService.switchTo(nextId)) {
    chatService.bindSession(null);
    await chatService.clearMessages();
    return;
  }
  chatService.bindSession(nextId);
  await loadSessionMessagesForSwitch(
    chatService, sessionService, nextId,
    chatService.hasPendingApprovalsForSession(nextId),
  );
}
