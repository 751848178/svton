import type { IStorage } from '@svton/agent-platform';
import type { SessionData, SessionInfo } from './session.types';
import { migrateSessionData, migrateSessionInfo } from './session-metadata-migration';
import type { SessionSearchIndexRecord } from './session-search.types';

const STORAGE_PREFIX = 'agent:session:';
const LIST_KEY = 'agent:session_list';
const CURRENT_KEY = 'agent:session_current';
const SEARCH_PREFIX = 'agent:session_search:';
const MAX_SESSION_COUNT = 200;

/** Owns storage keys, record validation, and corrupted-index cleanup. */
export class SessionRepository {
  constructor(private readonly storage: IStorage) {}

  owns(storage: IStorage): boolean { return this.storage === storage; }

  loadSession(id: string): Promise<SessionData | null> {
    return this.loadOwnedSession(id);
  }

  saveSession(data: SessionData): Promise<void> {
    return this.storage.set(`${STORAGE_PREFIX}${data.id}`, data);
  }

  deleteSession(id: string): Promise<void> {
    return this.storage.delete(`${STORAGE_PREFIX}${id}`);
  }

  async deleteSessionArtifacts(id: string): Promise<void> {
    await Promise.all([this.deleteSession(id), this.deleteSearchIndex(id)]);
  }

  saveSessionList(sessions: SessionInfo[]): Promise<void> {
    return this.storage.set(LIST_KEY, sessions);
  }

  async loadCurrentSessionId(): Promise<string | null> {
    const value = await this.storage.get<unknown>(CURRENT_KEY);
    if (value == null) return null;
    if (typeof value === 'string' && value.length > 0 && value.length <= 512) return value;
    await this.storage.delete(CURRENT_KEY);
    return null;
  }

  saveCurrentSessionId(id: string | null): Promise<void> {
    return id ? this.storage.set(CURRENT_KEY, id) : this.storage.delete(CURRENT_KEY);
  }

  saveSearchIndex(index: SessionSearchIndexRecord): Promise<void> {
    return this.storage.set(SEARCH_PREFIX + index.sessionId, index);
  }

  deleteSearchIndex(id: string): Promise<void> {
    return this.storage.delete(SEARCH_PREFIX + id);
  }

  async loadSearchIndexes(ids: string[]): Promise<Map<string, SessionSearchIndexRecord>> {
    const indexes = new Map<string, SessionSearchIndexRecord>();
    for (const id of ids.slice(0, MAX_SESSION_COUNT)) {
      const key = SEARCH_PREFIX + id;
      const value = await this.storage.get<unknown>(key);
      if (isSearchIndex(value, id)) indexes.set(id, value);
      else if (value != null) await this.storage.delete(key);
    }
    return indexes;
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
    return sessions.map(migrateSessionInfo);
  }

  private async loadOwnedSession(id: string): Promise<SessionData | null> {
    const key = `${STORAGE_PREFIX}${id}`;
    const data = await this.storage.get<unknown>(key);
    if (data == null) return null;
    if (isRecord(data) && data.id === id && isSessionData(data)) {
      return migrateSessionData(data);
    }
    await this.storage.delete(key);
    return null;
  }

  private async clearAllSessions(): Promise<void> {
    const keys = await this.storage.list(STORAGE_PREFIX);
    for (const key of keys) await this.storage.delete(key);
    const searchKeys = await this.storage.list(SEARCH_PREFIX);
    for (const key of searchKeys) await this.storage.delete(key);
    await this.storage.delete(CURRENT_KEY);
    await this.storage.delete(LIST_KEY);
    await this.storage.set(LIST_KEY, []);
  }
}

function isSearchIndex(value: unknown, id: string): value is SessionSearchIndexRecord {
  if (!value || typeof value !== 'object') return false;
  const index = value as Partial<SessionSearchIndexRecord>;
  return index.schemaVersion === 1
    && index.sessionId === id
    && Array.isArray(index.entries)
    && index.entries.length <= 256
    && index.entries.every((entry) => !!entry
      && typeof entry.displayText === 'string'
      && codePointLength(entry.displayText) <= 180
      && typeof entry.searchableText === 'string'
      && codePointLength(entry.searchableText) <= 180)
    && index.entries.reduce((size, entry) =>
      size + codePointLength(entry.displayText) + codePointLength(entry.searchableText), 0) <= 24_000
    && typeof index.updatedAt === 'number';
}

function isSessionInfo(value: unknown): value is SessionInfo {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return validBase(session)
    && Number.isInteger(session.messageCount)
    && (session.messageCount as number) >= 0;
}

function isSessionData(value: unknown): value is object {
  if (!isRecord(value)) return false;
  return validBase(value) && Array.isArray(value.messages);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function codePointLength(value: string): number {
  return [...value].length;
}

function validBase(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 512
    && typeof value.title === 'string' && value.title.length <= 512
    && typeof value.model === 'string'
    && finiteTimestamp(value.createdAt)
    && finiteTimestamp(value.updatedAt);
}

function finiteTimestamp(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
