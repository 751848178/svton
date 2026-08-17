import type { SessionInfo } from '../service/session.service';

export function resolveStartupSessionId(
  sessions: SessionInfo[],
  requestedSessionId?: string,
  savedSessionId?: string | null,
): string | null {
  const exists = (id: string | null | undefined) =>
    !!id && sessions.some((session) =>
      session.id === id && session.archivedAt === undefined);
  if (exists(requestedSessionId)) return requestedSessionId!;
  if (exists(savedSessionId)) return savedSessionId!;
  return sessions.find((session) => session.archivedAt === undefined)?.id ?? null;
}
