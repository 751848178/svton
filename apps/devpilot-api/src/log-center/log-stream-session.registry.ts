import { Injectable } from '@nestjs/common';

export type LogStreamSessionStatus = 'open' | 'closing';

export interface LogStreamSessionRecord {
  id: string;
  teamId: string;
  streamId: string;
  actorId: string;
  projectId?: string | null;
  environmentId?: string | null;
  openedAt: string;
  expiresAt: string;
  maxSessionMs: number;
  pollIntervalMs: number;
  cursor?: string | null;
  lastEventAt: string;
  status: LogStreamSessionStatus;
  closeRequestedAt?: string | null;
  closeReason?: string | null;
}

type StoredLogStreamSession = LogStreamSessionRecord & {
  close: (reason: string) => void;
};

@Injectable()
export class LogStreamSessionRegistry {
  private readonly sessions = new Map<string, StoredLogStreamSession>();

  open(record: Omit<LogStreamSessionRecord, 'status'>, close: (reason: string) => void) {
    const session: StoredLogStreamSession = {
      ...record,
      status: 'open',
      closeRequestedAt: null,
      closeReason: null,
      close,
    };
    this.sessions.set(session.id, session);
    return this.toRecord(session);
  }

  list(teamId: string, streamId?: string | null) {
    return Array.from(this.sessions.values())
      .filter((session) => (
        session.teamId === teamId
        && session.status === 'open'
        && (!streamId || session.streamId === streamId)
      ))
      .map((session) => this.toRecord(session));
  }

  get(teamId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.teamId !== teamId) return null;
    return this.toRecord(session);
  }

  countOpen(teamId: string, streamId?: string | null) {
    return this.list(teamId, streamId).length;
  }

  countOpenByActor(teamId: string, actorId: string) {
    return Array.from(this.sessions.values()).filter((session) => (
      session.teamId === teamId
      && session.actorId === actorId
      && session.status === 'open'
    )).length;
  }

  update(sessionId: string, patch: Partial<Pick<LogStreamSessionRecord, 'cursor' | 'lastEventAt'>>) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    Object.assign(session, patch);
    return this.toRecord(session);
  }

  closeSession(teamId: string, sessionId: string, reason: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.teamId !== teamId) return null;
    session.status = 'closing';
    session.closeRequestedAt = new Date().toISOString();
    session.closeReason = reason;
    session.close(reason);
    return this.toRecord(session);
  }

  remove(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  private toRecord(session: StoredLogStreamSession): LogStreamSessionRecord {
    const { close, ...record } = session;
    void close;
    return { ...record };
  }
}
