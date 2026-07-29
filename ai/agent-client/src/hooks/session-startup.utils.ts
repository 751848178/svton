import type { SessionInfo } from '../service/session.service';

export function resolveStartupSessionId(
  sessions: SessionInfo[],
  requestedSessionId?: string,
  savedSessionId?: string | null,
): string | null {
  const exists = (id: string | null | undefined) =>
    !!id && sessions.some((session) => session.id === id);
  if (exists(requestedSessionId)) return requestedSessionId!;
  if (exists(savedSessionId)) return savedSessionId!;
  return sessions[0]?.id ?? null;
}
