export const DEFAULT_RUNTIME_SESSION_ID = 'default';

/** One canonical key for runtime-owned interactions when no session is supplied. */
export function canonicalSessionId(sessionId: string | null | undefined): string {
  const value = sessionId?.trim();
  return value || DEFAULT_RUNTIME_SESSION_ID;
}
