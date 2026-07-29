import type { IStorage } from '@svton/agent-platform';
import type { SessionData, SessionInfo } from './session.types';

const STORAGE_PREFIX = 'agent:session:';
const LIST_KEY = 'agent:session_list';
const MAX_SESSION_COUNT = 200;

/** Owns storage keys, record validation, and corrupted-index cleanup. */
export class SessionRepository {
  constructor(private readonly storage: IStorage) {}

  loadSession(id: string): Promise<SessionData | null> {
    return this.loadOwnedSession(id);
  }

  saveSession(data: SessionData): Promise<void> {
    return this.storage.set(`${STORAGE_PREFIX}${data.id}`, data);
  }

  deleteSession(id: string): Promise<void> {
    return this.storage.delete(`${STORAGE_PREFIX}${id}`);
  }

  saveSessionList(sessions: SessionInfo[]): Promise<void> {
    return this.storage.set(LIST_KEY, sessions);
  }

  async loadSessionList(): Promise<SessionInfo[]> {
    const raw = await this.storage.get<unknown>(LIST_KEY);
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      await this.storage.delete(LIST_KEY);
      return [];
    }
    const sessions = raw.filter(isSessionInfo);
    if (raw.length > MAX_SESSION_COUNT || sessions.length !== raw.length) {
      await this.clearAllSessions();
      return [];
    }
    return sessions;
  }

  private async loadOwnedSession(id: string): Promise<SessionData | null> {
    const key = `${STORAGE_PREFIX}${id}`;
    const data = await this.storage.get<SessionData>(key);
    if (!data || data.id === id) return data;
    await this.storage.delete(key);
    return null;
  }

  private async clearAllSessions(): Promise<void> {
    const keys = await this.storage.list(STORAGE_PREFIX);
    for (const key of keys) await this.storage.delete(key);
    await this.storage.delete(LIST_KEY);
    await this.storage.set(LIST_KEY, []);
  }
}

function isSessionInfo(value: unknown): value is SessionInfo {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SessionInfo>;
  return typeof session.id === 'string' && typeof session.title === 'string';
}
