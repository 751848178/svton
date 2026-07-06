export function normalizeStreamPollInterval(value?: number | string | null) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) return 3000;
  return Math.max(1000, Math.min(Math.floor(interval), 30000));
}

export function normalizeStreamMaxSessionMs(value?: number | string | null) {
  const sessionMs = Number(value);
  if (!Number.isFinite(sessionMs)) return 300000;
  return Math.max(30000, Math.min(Math.floor(sessionMs), 3600000));
}

export function normalizeStreamMaxActiveSessions() {
  const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM);
  if (!Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(Math.floor(limit), 50));
}

export function normalizeStreamMaxActorActiveSessions() {
  const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR);
  if (!Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(Math.floor(limit), 100));
}

export function normalizeStreamMaxTeamActiveSessions() {
  const limit = Number(process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM);
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(Math.floor(limit), 500));
}
