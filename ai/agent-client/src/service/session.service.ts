import 'reflect-metadata';
import { Service, observable, action } from '@svton/service';
import type { IStorage } from '@svton/agent-platform';
import { SYSTEM_CLOCK, RANDOM_ID_GENERATOR } from '@svton/agent-core';
import type { IClock, IIdGenerator } from '@svton/agent-core';

export interface SessionInfo {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

export interface SessionData {
  id: string;
  title: string;
  model: string;
  /** Stored messages — serialized DisplayMessage[] for lossless persistence */
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

const STORAGE_PREFIX = 'agent:session:';
const LIST_KEY = 'agent:session_list';

@Service()
export class SessionService {
  @observable() sessions: SessionInfo[] = [];
  @observable() currentSessionId: string | null = null;
  @observable() ready: boolean = false;

  private storage: IStorage | null = null;
  // Injectable for deterministic tests; default to the real clock/id generator.
  private clock: IClock = SYSTEM_CLOCK;
  private idGen: IIdGenerator = RANDOM_ID_GENERATOR;

  /**
   * Initialize with storage backend.
   * The clock/idGen params are optional and default to the system singletons;
   * tests pass in FakeClock / SequentialIdGenerator for determinism.
   */
  @action()
  async init(storage: IStorage, opts?: { clock?: IClock; idGen?: IIdGenerator }): Promise<void> {
    if (this.ready) return;
    this.storage = storage;
    if (opts?.clock) this.clock = opts.clock;
    if (opts?.idGen) this.idGen = opts.idGen;
    await this.loadSessionList();
    this.ready = true;
  }

  /**
   * Create a new session.
   * All async I/O is done BEFORE setting observables to avoid cascading re-renders.
   */
  @action()
  async create(title?: string, model?: string, projectId?: string): Promise<string> {
    if (!Array.isArray(this.sessions)) {
      console.error('[SessionService] create() — sessions corrupted, resetting');
      this.sessions = [];
    }

    const id = this.idGen.nextId('session');
    const now = this.clock.now();

    const session: SessionData = {
      id,
      title: title || `Chat ${this.sessions.length + 1}`,
      model: model || 'gpt-4o',
      messages: [],
      createdAt: now,
      updatedAt: now,
      projectId,
    };

    const info: SessionInfo = {
      id,
      title: session.title,
      model: session.model,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      projectId,
    };

    // All async I/O first — no observable changes yet
    const newSessions = [info, ...this.sessions];
    await this.storage!.set(`${STORAGE_PREFIX}${id}`, session);
    await this.storage!.set(LIST_KEY, newSessions);

    // Apply observable changes last
    this.sessions = newSessions;
    this.currentSessionId = id;

    return id;
  }

  /**
   * Load a session's messages.
   */
  async loadSession(id: string): Promise<SessionData | null> {
    return this.storage!.get<SessionData>(`${STORAGE_PREFIX}${id}`);
  }

  /**
   * Save session data.
   * All async I/O before observable changes.
   */
  async saveSession(data: SessionData): Promise<void> {
    if (!Array.isArray(this.sessions)) return;

    const now = this.clock.now();
    const toSave: SessionData = {
      id: data.id,
      title: data.title,
      model: data.model,
      messages: data.messages,
      createdAt: data.createdAt,
      updatedAt: now,
      projectId: data.projectId,
    };
    await this.storage!.set(`${STORAGE_PREFIX}${data.id}`, toSave);

    const updatedSessions = this.sessions.map((s) =>
      s.id === data.id
        ? { ...s, title: data.title, messageCount: data.messages.length, updatedAt: now, projectId: data.projectId }
        : s,
    );
    await this.storage!.set(LIST_KEY, updatedSessions);

    this.sessions = updatedSessions;
  }

  /**
   * Delete a session.
   */
  @action()
  async delete(id: string): Promise<void> {
    if (!Array.isArray(this.sessions)) {
      this.sessions = [];
    }
    await this.storage!.delete(`${STORAGE_PREFIX}${id}`);
    const newSessions = this.sessions.filter((s) => s.id !== id);
    await this.storage!.set(LIST_KEY, newSessions);

    this.sessions = newSessions;
    if (this.currentSessionId === id) {
      this.currentSessionId = newSessions[0]?.id || null;
    }
  }

  /**
   * Switch to a session.
   */
  @action()
  switchTo(id: string): void {
    this.currentSessionId = id;
  }

  /**
   * Update the projectId of a session.
   */
  @action()
  async updateProjectId(sessionId: string, projectId: string | undefined): Promise<void> {
    if (!Array.isArray(this.sessions)) return;

    // Update in-memory list
    const updatedSessions = this.sessions.map((s) =>
      s.id === sessionId ? { ...s, projectId } : s,
    );

    // Persist list
    await this.storage!.set(LIST_KEY, updatedSessions);

    // Also update the session data itself (for loadSession to return correct projectId)
    const data = await this.storage!.get<SessionData>(`${STORAGE_PREFIX}${sessionId}`);
    if (data) {
      await this.storage!.set(`${STORAGE_PREFIX}${sessionId}`, { ...data, projectId });
    }

    this.sessions = updatedSessions;
  }

  /**
   * Lightweight metadata update for immediate sidebar response.
   * Updates title, projectId, and/or messageCount without a full saveSession.
   */
  @action()
  async updateSessionInfo(
    id: string,
    updates: Partial<Pick<SessionInfo, 'title' | 'projectId' | 'messageCount'>>,
  ): Promise<void> {
    if (!Array.isArray(this.sessions)) return;

    const updatedSessions = this.sessions.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );

    await this.storage!.set(LIST_KEY, updatedSessions);

    // Also patch the session data record (title + projectId)
    const data = await this.storage!.get<SessionData>(`${STORAGE_PREFIX}${id}`);
    if (data) {
      const patched: SessionData = {
        ...data,
        ...(updates.title ? { title: updates.title } : {}),
        ...(updates.projectId !== undefined ? { projectId: updates.projectId } : {}),
      };
      await this.storage!.set(`${STORAGE_PREFIX}${id}`, patched);
    }

    this.sessions = updatedSessions;
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async loadSessionList(): Promise<void> {
    const raw = await this.storage!.get<unknown>(LIST_KEY);

    if (raw == null || !Array.isArray(raw)) {
      this.sessions = [];
      if (raw != null) {
        await this.storage!.delete(LIST_KEY);
      }
      return;
    }

    const list = raw as SessionInfo[];

    if (list.length > 200) {
      console.warn(`[SessionService] loadSessionList: ${list.length} entries — corrupted, clearing`);
      await this.nukeAllSessionData();
      return;
    }

    const valid = list.filter(
      (item): item is SessionInfo =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as any).id === 'string' &&
        typeof (item as any).title === 'string',
    );

    if (valid.length !== list.length) {
      console.warn(`[SessionService] loadSessionList: ${valid.length}/${list.length} valid — clearing`);
      await this.nukeAllSessionData();
      return;
    }

    this.sessions = valid;
  }

  private async nukeAllSessionData(): Promise<void> {
    const allKeys = await this.storage!.list(STORAGE_PREFIX);
    for (const key of allKeys) {
      await this.storage!.delete(key);
    }
    await this.storage!.delete(LIST_KEY);
    await this.storage!.set(LIST_KEY, []);
    this.sessions = [];
  }
}
