import type { SessionInfo } from './session.types';

export type SessionScope = 'active' | 'archived';

export function compareSessions(left: SessionInfo, right: SessionInfo): number {
  return Number(right.isPinned === true) - Number(left.isPinned === true)
    || (right.recencyAt ?? right.updatedAt) - (left.recencyAt ?? left.updatedAt)
    || right.updatedAt - left.updatedAt
    || left.id.localeCompare(right.id);
}

export function sortSessions(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort(compareSessions);
}

export function selectSessionScope(
  sessions: SessionInfo[],
  scope: SessionScope,
): SessionInfo[] {
  return sortSessions(sessions.filter((session) =>
    scope === 'archived' ? session.archivedAt !== undefined : session.archivedAt === undefined,
  ));
}

export function resolveActiveSessionId(
  sessions: SessionInfo[],
  requestedId?: string | null,
): string | null {
  const active = selectSessionScope(sessions, 'active');
  if (requestedId && active.some((session) => session.id === requestedId)) return requestedId;
  return active[0]?.id ?? null;
}
