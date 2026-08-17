import { describe, expect, it } from 'vitest';
import { MemoryStorage } from './helpers/pi-test-utils';
import { SessionService } from '../src/service/session.service';
import { migrateSessionData, migrateSessionInfo } from '../src/service/session-metadata-migration';
import type { SessionData } from '../src/service/session.types';
import type { TerminalRunState } from '../src/service/session-activity.types';

describe('durable session management', () => {
  it('totally migrates legacy and incomplete v2 records into canonical v3', () => {
    const base = {
      id: 'legacy', title: 'Legacy', model: 'test', messageCount: 0,
      createdAt: 1, updatedAt: 2,
    };
    expect(migrateSessionInfo({ ...base, schemaVersion: 2 })).toMatchObject({
      schemaVersion: 3, titleSource: 'auto', isPinned: false, recencyAt: 2,
    });
    expect(migrateSessionData({ ...base, messages: [], schemaVersion: 2 })).toMatchObject({
      schemaVersion: 3, titleSource: 'auto', isPinned: false, recencyAt: 2,
    });
  });

  it('rejects partial base records instead of exposing undefined canonical fields', async () => {
    const storage = new MemoryStorage();
    await storage.set('agent:session_list', [{ id: 'partial', title: 'Partial' }]);
    const service = new SessionService();
    await service.init(storage);
    expect(service.sessions).toEqual([]);
    expect(await storage.get('agent:session:partial')).toBeNull();
  });

  it('keeps a manual title through preview, foreground, background terminal, and reload', async () => {
    const { service, storage } = await setup();
    const id = await service.create();
    const stale = (await service.loadSession(id))!;
    await service.rename(id, 'My durable title');
    await service.updateSessionInfo(id, { title: 'auto preview', titleSource: 'auto' });
    await service.saveSession(withMessage(stale, 'foreground title source'));
    await service.saveSession(withMessage(stale, 'background title source'), terminal(id));
    const fresh = new SessionService();
    await fresh.init(storage);
    expect(fresh.sessions[0]).toMatchObject({
      title: 'My durable title', titleSource: 'manual', lastTerminalRunId: 'run-1',
    });
    expect((await fresh.loadSession(id))?.title).toBe('My durable title');
  });

  it('sorts pinned then recency deterministically without management recency inflation', async () => {
    let now = 10;
    const { service } = await setup(() => now);
    const a = await service.create('A');
    now = 20;
    const b = await service.create('B');
    const aRecency = service.sessions.find((session) => session.id === a)!.recencyAt;
    now = 30;
    await service.rename(a, 'A renamed');
    expect(service.sessions.find((session) => session.id === a)!.recencyAt).toBe(aRecency);
    expect(service.sessions[0].id).toBe(b);
    await service.setPinned(a, true);
    expect(service.sessions[0].id).toBe(a);
    await service.setPinned(a, false);
    expect(service.sessions[0].id).toBe(b);
    await service.archive(a);
    await service.unarchive(a);
    expect(service.sessions.find((session) => session.id === a)!.recencyAt).toBe(aRecency);
  });

  it('persists valid selection and repairs archived, missing, and deleted selections', async () => {
    const { service, storage } = await setup();
    const a = await service.create('A');
    const b = await service.create('B');
    expect(await service.switchTo(a)).toBe(true);
    const fresh = new SessionService();
    await fresh.init(storage);
    expect(fresh.currentSessionId).toBe(a);
    await fresh.archive(a);
    expect(fresh.currentSessionId).toBe(b);
    expect(await storage.get('agent:session_current')).toBe(b);
    expect(await fresh.switchTo('missing')).toBe(false);
    expect(fresh.currentSessionId).toBe(b);
    await fresh.delete(b);
    expect(fresh.currentSessionId).toBeNull();
    expect(await storage.get('agent:session_current')).toBeNull();
  });

  it('searches title and display-faithful normalized content with an extension label', async () => {
    const { service } = await setup();
    const id = await service.create('Release Notes');
    const data = (await service.loadSession(id))!;
    await service.saveSession({
      ...data,
      messages: [{ role: 'user', content: 'ＦｕｌｌＷｉｄｔｈ Café e\u0301vidence' }],
    });
    expect((await service.search('release'))[0]).toMatchObject({ match: 'title' });
    const content = (await service.search('fullwidth', { includeContent: true }))[0];
    expect(content).toMatchObject({
      match: 'content', source: 'svton-content-extension',
    });
    expect(content.snippet).toContain('ＦｕｌｌＷｉｄｔｈ');
    expect((await service.search('évidence', { includeContent: true }))[0].snippet)
      .toContain('e\u0301vidence');
  });

  it('keeps newest message groups searchable and evicts only whole old groups', async () => {
    const { service } = await setup();
    const id = await service.create('Long');
    const data = (await service.loadSession(id))!;
    await service.saveSession({
      ...data,
      messages: [
        message(`OLD_MARKER ${'a'.repeat(3_900)}`),
        message(`middle-one ${'b'.repeat(3_900)}`),
        message(`middle-two ${'c'.repeat(3_900)}`),
        message(`LATEST_MARKER ${'d'.repeat(3_900)}`),
      ],
    });
    expect(await service.search('OLD_MARKER', { includeContent: true })).toEqual([]);
    expect((await service.search('LATEST_MARKER', { includeContent: true }))[0].match)
      .toBe('content');
  });

  it('round-trips emoji search indexes and deletes malformed oversized indexes', async () => {
    const { service, storage } = await setup();
    const id = await service.create('Emoji');
    const data = (await service.loadSession(id))!;
    await service.saveSession({ ...data, messages: [message(`${'😀'.repeat(180)} target`)] });
    const fresh = new SessionService();
    await fresh.init(storage);
    expect((await fresh.search('😀😀', { includeContent: true }))[0].match).toBe('content');
    await storage.set(`agent:session_search:${id}`, {
      schemaVersion: 1, sessionId: id, updatedAt: 1,
      entries: [{ displayText: 'x'.repeat(181), searchableText: 'x'.repeat(181) }],
    });
    await fresh.search('x', { includeContent: true });
    expect(await storage.get(`agent:session_search:${id}`)).toBeNull();
  });
});

async function setup(now: () => number = () => 1) {
  const storage = new MemoryStorage();
  const service = new SessionService();
  let id = 0;
  await service.init(storage, {
    clock: { now },
    idGen: { nextId: () => `session-${++id}` },
  });
  return { service, storage };
}

function message(content: string) { return { role: 'user', content }; }

function withMessage(data: SessionData, content: string): SessionData {
  return { ...data, title: content, titleSource: 'auto', messages: [message(content)] };
}

function terminal(sessionId: string): TerminalRunState {
  return {
    sessionId, runId: 'run-1', turnRevision: 1, phase: 'completed',
    startedAt: 1, completedAt: 2, pendingApprovalIds: [], pendingUserInputIds: [], revision: 1,
  };
}
