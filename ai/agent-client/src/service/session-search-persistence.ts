import type { SessionRepository } from './session.repository';
import type { SessionInfo } from './session.types';
import type { SessionSearchOptions, SessionSearchResult } from './session-search.types';
import { selectSessionSearchResults } from './session-search.utils';
import type { SessionTransitionQueue } from './session-transition-queue.service';

export async function searchPersistedSessions(
  writes: SessionTransitionQueue,
  repository: SessionRepository,
  sessions: SessionInfo[],
  isDeleted: (id: string) => boolean,
  query: string,
  options?: SessionSearchOptions,
): Promise<SessionSearchResult[]> {
  await writes.flush();
  const snapshot = sessions.filter((session) => !isDeleted(session.id));
  const indexes = await repository.loadSearchIndexes(snapshot.map((session) => session.id));
  const currentIds = new Set(sessions.map((session) => session.id));
  return selectSessionSearchResults(
    snapshot.filter((session) => currentIds.has(session.id) && !isDeleted(session.id)),
    indexes, query, options,
  );
}
