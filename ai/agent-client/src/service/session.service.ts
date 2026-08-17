import 'reflect-metadata';
import { Service, observable, action } from '@svton/service';
import type { IStorage } from '@svton/agent-platform';
import { SYSTEM_CLOCK, RANDOM_ID_GENERATOR, type IClock, type IIdGenerator } from '@svton/agent-core';
import { SessionRepository } from './session.repository';
import type { SessionData, SessionInfo } from './session.types';
import type { SessionTerminalIdentity, TerminalRunState } from './session-activity.types';
import { persistSessionRead, persistSessionSnapshot } from './session-activity-persistence';
import { SessionTransitionQueue } from './session-transition-queue.service';
import { persistSessionMetadata } from './session-metadata-persistence';
import { resolveActiveSessionId, sortSessions } from './session-management-selectors';
import { normalizeManualTitle } from './session-title-policy';
import type { SessionSearchOptions, SessionSearchResult } from './session-search.types';
import { applySessionInfoUpdate, type SessionInfoUpdate } from './session-info-update';
import { persistNewSession } from './session-creation-persistence';
import { searchPersistedSessions } from './session-search-persistence';
export type { SessionData, SessionInfo } from './session.types';

@Service()
export class SessionService {
  @observable() sessions: SessionInfo[] = [];
  @observable() currentSessionId: string | null = null;
  @observable() ready = false;
  private repository: SessionRepository | null = null;
  private initGeneration = 0;
  private readonly deleted = new Set<string>();
  private readonly writes = new SessionTransitionQueue();
  private clock: IClock = SYSTEM_CLOCK;
  private idGen: IIdGenerator = RANDOM_ID_GENERATOR;

  @action()
  async init(storage: IStorage, opts?: { clock?: IClock; idGen?: IIdGenerator }): Promise<void> {
    if (this.ready && this.repository?.owns(storage)) return;
    const generation = ++this.initGeneration;
    this.ready = false;
    const repository = new SessionRepository(storage);
    this.repository = repository;
    this.deleted.clear();
    this.sessions = [];
    this.currentSessionId = null;
    if (opts?.clock) this.clock = opts.clock;
    if (opts?.idGen) this.idGen = opts.idGen;
    const [loaded, savedId] = await Promise.all([
      repository.loadSessionList(), repository.loadCurrentSessionId(),
    ]);
    if (generation !== this.initGeneration) return;
    const sessions = sortSessions(loaded);
    const currentSessionId = resolveActiveSessionId(sessions, savedId);
    if (currentSessionId !== savedId) await repository.saveCurrentSessionId(currentSessionId);
    if (generation !== this.initGeneration) return;
    this.sessions = sessions;
    this.currentSessionId = currentSessionId;
    this.ready = true;
  }

  @action()
  create(title?: string, model?: string, projectId?: string): Promise<string> {
    return this.writes.run(async () => {
      const id = this.idGen.nextId('session');
      const sessions = await persistNewSession(this.repo, this.sessions, {
        id, title: title || `Chat ${(this.sessions?.length ?? 0) + 1}`,
        titleSource: title ? 'manual' : 'auto', model: model || 'gpt-4o',
        projectId, now: this.clock.now(),
      });
      this.sessions = sessions;
      this.currentSessionId = id;
      return id;
    });
  }

  loadSession(id: string): Promise<SessionData | null> { return this.repo.loadSession(id); }

  saveSession(data: SessionData, terminal?: TerminalRunState): Promise<void> {
    return this.writes.run(async () => {
      const sessions = await persistSessionSnapshot(
        this.writeContext, data, this.clock.now(), terminal,
      );
      if (sessions) this.sessions = sessions;
    });
  }

  @action()
  markRead(id: string, terminal: SessionTerminalIdentity, at = this.clock.now()): Promise<boolean> {
    return this.writes.run(async () => {
      const sessions = await persistSessionRead(this.writeContext, id, terminal, at);
      if (!sessions) return false;
      this.sessions = sessions;
      return true;
    });
  }

  @action()
  switchTo(id: string): Promise<boolean> {
    return this.writes.run(async () => {
      const valid = this.sessions.some((session) =>
        session.id === id && session.archivedAt === undefined && !this.deleted.has(id),
      );
      if (!valid) return false;
      await this.repo.saveCurrentSessionId(id);
      this.currentSessionId = id;
      return true;
    });
  }

  rename(id: string, title: string): Promise<boolean> {
    const normalized = normalizeManualTitle(title);
    if (!normalized) return Promise.resolve(false);
    return this.mutate(id, (session) => ({
      ...session, title: normalized, titleSource: 'manual', updatedAt: this.clock.now(),
    }));
  }

  setPinned(id: string, isPinned: boolean): Promise<boolean> {
    return this.mutate(id, (session) => session.isPinned === isPinned ? session : ({
      ...session, isPinned, updatedAt: this.clock.now(),
    }));
  }

  archive(id: string): Promise<boolean> {
    return this.mutate(id, (session) => session.archivedAt !== undefined ? session : ({
      ...session, archivedAt: this.clock.now(), isPinned: false, updatedAt: this.clock.now(),
    }), true);
  }

  unarchive(id: string): Promise<boolean> {
    return this.mutate(id, (session) => session.archivedAt === undefined ? session : ({
      ...session, archivedAt: undefined, updatedAt: this.clock.now(),
    }));
  }

  @action()
  delete(id: string): Promise<void> {
    this.beginDelete(id);
    return this.writes.run(async () => {
      await this.repo.deleteSessionArtifacts(id);
      const sessions = this.sessions.filter((session) => session.id !== id);
      const selected = resolveActiveSessionId(
        sessions, this.currentSessionId === id ? null : this.currentSessionId,
      );
      await this.repo.saveSessionList(sessions);
      await this.repo.saveCurrentSessionId(selected);
      this.sessions = sessions;
      this.currentSessionId = selected;
    });
  }

  beginDelete(id: string): void { this.deleted.add(id); }

  updateProjectId(id: string, projectId: string | undefined): Promise<boolean> {
    return this.mutate(id, (session) => ({
      ...session, projectId, updatedAt: this.clock.now(),
    }));
  }

  updateSessionInfo(
    id: string,
    updates: SessionInfoUpdate,
  ): Promise<boolean> {
    return this.mutate(id, (session) =>
      applySessionInfoUpdate(session, updates, this.clock.now()));
  }

  async search(query: string, options?: SessionSearchOptions): Promise<SessionSearchResult[]> {
    return searchPersistedSessions(
      this.writes, this.repo, this.sessions,
      (id) => this.deleted.has(id), query, options,
    );
  }

  private mutate(
    id: string,
    update: (session: SessionInfo) => SessionInfo,
    chooseFallback = false,
  ): Promise<boolean> {
    return this.writes.run(async () => {
      const sessions = await persistSessionMetadata(this.writeContext, id, update);
      if (!sessions) return false;
      this.sessions = sessions;
      if (chooseFallback && this.currentSessionId === id) {
        this.currentSessionId = resolveActiveSessionId(sessions);
        await this.repo.saveCurrentSessionId(this.currentSessionId);
      }
      return true;
    });
  }

  private get repo(): SessionRepository {
    if (!this.repository) throw new Error('SessionService is not initialized');
    return this.repository;
  }

  private get writeContext() {
    return {
      repository: this.repo,
      sessions: () => this.sessions,
      isDeleted: (id: string) => this.deleted.has(id),
    };
  }
}
