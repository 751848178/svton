import { SessionResumeManager } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';
import type { ChatRunJournalService } from './chat-run-journal.service';

/** Deletes both UI lifecycle and canonical runtime persistence for one session. */
export async function deleteDurableChatState(
  storage: IStorage | null,
  journal: ChatRunJournalService,
  sessionId: string,
): Promise<void> {
  await Promise.all([
    journal.delete(sessionId),
    storage ? new SessionResumeManager(storage).delete(sessionId) : Promise.resolve(),
  ]);
}
