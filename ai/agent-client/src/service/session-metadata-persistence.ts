import { migrateSessionData, migrateSessionInfo } from './session-metadata-migration';
import { sortSessions } from './session-management-selectors';
import type { SessionRepository } from './session.repository';
import type { SessionInfo } from './session.types';

export interface SessionMetadataWriteContext {
  repository: SessionRepository;
  sessions: () => SessionInfo[];
  isDeleted: (id: string) => boolean;
}

/** Persists one metadata mutation to list and data without touching recency. */
export async function persistSessionMetadata(
  context: SessionMetadataWriteContext,
  id: string,
  mutate: (current: SessionInfo) => SessionInfo,
): Promise<SessionInfo[] | null> {
  if (context.isDeleted(id)) return null;
  const current = context.sessions().find((session) => session.id === id);
  if (!current) return null;
  const data = await context.repository.loadSession(id);
  if (!data || context.isDeleted(id)) return null;
  const nextInfo = migrateSessionInfo(mutate(current));
  const nextData = migrateSessionData({
    ...data,
    title: nextInfo.title,
    titleSource: nextInfo.titleSource,
    isPinned: nextInfo.isPinned,
    archivedAt: nextInfo.archivedAt,
    recencyAt: nextInfo.recencyAt,
    projectId: nextInfo.projectId,
    updatedAt: nextInfo.updatedAt,
  });
  await context.repository.saveSession(nextData);
  if (context.isDeleted(id)) {
    await context.repository.deleteSessionArtifacts(id);
    return null;
  }
  const sessions = sortSessions(context.sessions().map((session) =>
    session.id === id ? nextInfo : session,
  ));
  await context.repository.saveSessionList(sessions);
  return context.isDeleted(id) ? null : sessions;
}
