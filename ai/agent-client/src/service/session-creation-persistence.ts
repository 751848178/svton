import { createSessionRecords } from './session-records';
import type { SessionRepository } from './session.repository';
import type { SessionInfo } from './session.types';
import { createSessionSearchIndex } from './session-search.utils';
import { sortSessions } from './session-management-selectors';

export async function persistNewSession(
  repository: SessionRepository,
  sessions: SessionInfo[],
  input: {
    id: string;
    title: string;
    titleSource: 'auto' | 'manual';
    model: string;
    projectId?: string;
    now: number;
  },
): Promise<SessionInfo[]> {
  const records = createSessionRecords(input);
  const next = sortSessions([records.info, ...(Array.isArray(sessions) ? sessions : [])]);
  await repository.saveSession(records.data);
  await repository.saveSearchIndex(createSessionSearchIndex(records.data));
  await repository.saveSessionList(next);
  await repository.saveCurrentSessionId(input.id);
  return next;
}
