import 'reflect-metadata';
import { Service, observable, action } from '@svton/service';
import type { IStorage } from '@svton/agent-platform';
import { SYSTEM_CLOCK, RANDOM_ID_GENERATOR } from '@svton/agent-core';
import type { IClock, IIdGenerator } from '@svton/agent-core';
import { SessionRepository } from './session.repository';
import type { SessionData, SessionInfo } from './session.types';
export type { SessionData, SessionInfo } from './session.types';

@Service()
export class SessionService {
  @observable() sessions: SessionInfo[] = [];
  @observable() currentSessionId: string | null = null;
  @observable() ready: boolean = false;

  private storage: IStorage | null = null;
  private repository: SessionRepository | null = null;
  private initGeneration = 0;
  // Injectable for deterministic tests; default to the real clock/id generator.
  private clock: IClock = SYSTEM_CLOCK;
  private idGen: IIdGenerator = RANDOM_ID_GENERATOR;

  @action()
  async init(storage: IStorage, opts?: { clock?: IClock; idGen?: IIdGenerator }): Promise<void> {
    if (this.ready && this.storage === storage) return;
    const generation = ++this.initGeneration;
    this.ready = false;
    this.storage = storage;
    const repository = new SessionRepository(storage);
    this.repository = repository;
    this.sessions = [];
    this.currentSessionId = null;
    if (opts?.clock) this.clock = opts.clock;
    if (opts?.idGen) this.idGen = opts.idGen;
    const sessions = await repository.loadSessionList();
    if (generation !== this.initGeneration) return;
    this.sessions = sessions;
    this.ready = true;
  }

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
    await this.repository!.saveSession(session);
    await this.repository!.saveSessionList(newSessions);

    // Apply observable changes last
    this.sessions = newSessions;
    this.currentSessionId = id;

    return id;
  }

  async loadSession(id: string): Promise<SessionData | null> {
    return this.repository!.loadSession(id);
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
    await this.repository!.saveSession(toSave);

    const updatedSessions = this.sessions.map((s) =>
      s.id === data.id
        ? { ...s, title: data.title, messageCount: data.messages.length, updatedAt: now, projectId: data.projectId }
        : s,
    );
    await this.repository!.saveSessionList(updatedSessions);

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
    await this.repository!.deleteSession(id);
    const newSessions = this.sessions.filter((s) => s.id !== id);
    await this.repository!.saveSessionList(newSessions);

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
    await this.repository!.saveSessionList(updatedSessions);

    // Also update the session data itself (for loadSession to return correct projectId)
    const data = await this.repository!.loadSession(sessionId);
    if (data) {
      await this.repository!.saveSession({ ...data, projectId });
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

    await this.repository!.saveSessionList(updatedSessions);

    // Also patch the session data record (title + projectId)
    const data = await this.repository!.loadSession(id);
    if (data) {
      const patched: SessionData = {
        ...data,
        ...(updates.title ? { title: updates.title } : {}),
        ...(updates.projectId !== undefined ? { projectId: updates.projectId } : {}),
      };
      await this.repository!.saveSession(patched);
    }

    this.sessions = updatedSessions;
  }
}
