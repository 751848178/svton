import type { SessionInfo } from './session.types';

export type SessionInfoUpdate = Partial<Pick<
  SessionInfo,
  'title' | 'titleSource' | 'projectId' | 'messageCount'
>>;

export function applySessionInfoUpdate(
  session: SessionInfo,
  updates: SessionInfoUpdate,
  updatedAt: number,
): SessionInfo {
  const requestedSource = updates.title
    ? updates.titleSource ?? 'manual'
    : updates.titleSource;
  const requested = { ...updates, ...(requestedSource ? { titleSource: requestedSource } : {}) };
  const protectManual = session.titleSource === 'manual' && requestedSource === 'auto';
  const safeUpdates = protectManual
    ? { ...requested, title: session.title, titleSource: 'manual' as const }
    : requested;
  return { ...session, ...safeUpdates, updatedAt };
}
