import type { SessionRepository } from './session.repository';
import type { SessionTerminalIdentity, TerminalRunState } from './session-activity.types';
import { prepareSessionRead, prepareSessionSave } from './session-records';
import type { SessionData, SessionInfo } from './session.types';
import { createSessionSearchIndex } from './session-search.utils';
import { sortSessions } from './session-management-selectors';

interface SessionWriteContext {
  repository: SessionRepository;
  sessions: () => SessionInfo[];
  isDeleted: (id: string) => boolean;
}

export async function persistSessionSnapshot(
  context: SessionWriteContext,
  data: SessionData,
  now: number,
  terminal?: TerminalRunState,
): Promise<SessionInfo[] | null> {
  const current = context.sessions().find((session) => session.id === data.id);
  if (!current || context.isDeleted(data.id)) return null;
  const saved = prepareSessionSave(data, current, now, terminal);
  await context.repository.saveSession(saved.data);
  await context.repository.saveSearchIndex(createSessionSearchIndex(saved.data));
  if (context.isDeleted(data.id)) {
    await context.repository.deleteSessionArtifacts(data.id);
    return null;
  }
  const sessions = sortSessions(context.sessions().map((session) =>
    session.id === data.id ? saved.info : session,
  ));
  await context.repository.saveSessionList(sessions);
  return context.isDeleted(data.id) ? null : sessions;
}

export async function persistSessionRead(
  context: SessionWriteContext,
  id: string,
  terminal: SessionTerminalIdentity,
  at: number,
): Promise<SessionInfo[] | null> {
  if (context.isDeleted(id)) return null;
  const info = context.sessions().find((session) => session.id === id);
  if (!info) return null;
  const data = await context.repository.loadSession(id);
  if (!data || context.isDeleted(id)) return null;
  const next = prepareSessionRead(data, info, terminal, at);
  if (!next) return null;
  await context.repository.saveSession(next.data);
  if (context.isDeleted(id)) {
    await context.repository.deleteSessionArtifacts(id);
    return null;
  }
  const sessions = sortSessions(context.sessions().map((session) =>
    session.id === id ? next.info : session,
  ));
  await context.repository.saveSessionList(sessions);
  return context.isDeleted(id) ? null : sessions;
}
