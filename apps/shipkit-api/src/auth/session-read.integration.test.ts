import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../generated/client/index.js';
import { databaseFixture } from '../testing/database.fixture.js';
import type { DatabaseService } from '../database/database.service.js';
import { ConfigRepository } from '../configs/config.repository.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { SessionStore } from './session-store.js';
import { pruneInvalidSession, readSessionSnapshot } from './session-read.js';

async function harness() {
  const fixture = await databaseFixture();
  const queries: string[] = [];
  const client = new PrismaClient({ datasources: { db: { url: `file:${path.join(fixture.directory, 'platform.db')}` } }, log: [{ emit: 'event', level: 'query' }] });
  client.$on('query', event => queries.push(event.query));
  await client.$connect();
  await client.$queryRaw`PRAGMA busy_timeout=5000`;
  const db = client as DatabaseService;
  const sessions = new SessionStore(db);
  const actor = await db.actor.create({ data: { id: randomUUID(), kind: 'user', name: 'Fixture', username: randomUUID(), passwordHash: 'fixture-only-hash' } });
  const create = (actorId = actor.id, expiresAt = new Date(Date.now() + 60000)) => db.authSession.create({ data: { id: randomUUID(), actorId, expiresAt } });
  return { db, sessions, actor, queries, create, directory: fixture.directory, close: async () => { await client.$disconnect(); await fixture.dispose(); } };
}

test('valid and absent session reads use one parameterized JOIN and no transaction or password material', async () => {
  const h = await harness();
  try {
    const session = await h.create(); h.queries.length = 0;
    const view = await h.sessions.read(session.id);
    assert.deepEqual(view, { user: { id: h.actor.id, username: h.actor.username, displayName: h.actor.name }, expiresAt: session.expiresAt.toISOString() });
    assert.equal(h.queries.length, 1); assert.match(h.queries[0]!, /INNER JOIN Actor/);
    assert.match(h.queries[0]!, /WHERE s\.id = \?/); assert(!JSON.stringify(view).includes('fixture-only-hash'));
    h.queries.length = 0;
    assert.equal(await h.sessions.read("' OR 1=1 --"), null);
    assert.equal(h.queries.length, 1); assert(!h.queries.some(query => /BEGIN|DELETE|UPDATE/i.test(query)));
  } finally { await h.close(); }
});

test('disabled, expired, non-user and missing account credentials remain rejected with conditional cleanup', async () => {
  const h = await harness();
  try {
    const cases = [{ disabled: true }, { kind: 'local' }, { username: null }, { username: '' }, { passwordHash: null }, { passwordHash: '' }];
    for (const patch of cases) {
      await h.db.actor.update({ where: { id: h.actor.id }, data: { disabled: false, kind: 'user', username: h.actor.username, passwordHash: h.actor.passwordHash, ...patch } });
      const session = await h.create();
      const second = patch.disabled ? await h.create() : null;
      assert.equal(await h.sessions.read(session.id), null);
      assert.equal(await h.db.authSession.findUnique({ where: { id: session.id } }), null);
      if (second) assert.equal(await h.db.authSession.findUnique({ where: { id: second.id } }), null);
    }
    await h.db.actor.update({ where: { id: h.actor.id }, data: { disabled: false, kind: 'user', username: h.actor.username, passwordHash: h.actor.passwordHash } });
    const expired = await h.create(h.actor.id, new Date(0));
    assert.equal(await h.sessions.read(expired.id), null);
    assert.equal(await h.db.authSession.findUnique({ where: { id: expired.id } }), null);
  } finally { await h.close(); }
});

test('stale invalid snapshots cannot delete repaired actors, renewed sessions or replacement session identities', async () => {
  const h = await harness();
  try {
    const expired = await h.create(h.actor.id, new Date(0));
    const stale = (await readSessionSnapshot(h.db, expired.id))!;
    await h.db.authSession.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() + 60000) } });
    await pruneInvalidSession(h.db, stale, new Date());
    assert(await h.sessions.read(expired.id));
    for (const patch of [{ disabled: true }, { kind: 'local' }, { username: '' }, { passwordHash: '' }]) {
      await h.db.actor.update({ where: { id: h.actor.id }, data: patch });
      const invalid = (await readSessionSnapshot(h.db, expired.id))!;
      await h.db.actor.update({ where: { id: h.actor.id }, data: { disabled: false, kind: 'user', username: h.actor.username, passwordHash: h.actor.passwordHash } });
      await pruneInvalidSession(h.db, invalid, new Date());
      assert(await h.sessions.read(expired.id));
    }
    const other = await h.db.actor.create({ data: { id: randomUUID(), kind: 'user', name: 'Other', username: randomUUID(), passwordHash: 'fixture-other-hash' } });
    await h.db.authSession.delete({ where: { id: expired.id } });
    await h.db.authSession.create({ data: { id: expired.id, actorId: other.id, expiresAt: stale.expiresAt } });
    await pruneInvalidSession(h.db, stale, new Date());
    assert.equal((await h.db.authSession.findUniqueOrThrow({ where: { id: expired.id } })).actorId, other.id);
  } finally { await h.close(); }
});

test('completed revoke and actor changes are visible to the next atomic snapshot without mixing identities', async () => {
  const h = await harness();
  try {
    const first = await h.create(), second = await h.create();
    await h.sessions.revoke(first.id, 'fixture-revoke');
    assert.equal(await h.sessions.read(first.id), null); assert(await h.sessions.read(second.id));
    await h.db.actor.update({ where: { id: h.actor.id }, data: { name: 'Renamed', username: 'changed-fixture' } });
    assert.deepEqual((await h.sessions.read(second.id))?.user, { id: h.actor.id, username: 'changed-fixture', displayName: 'Renamed' });
    await h.db.actor.update({ where: { id: h.actor.id }, data: { disabled: true } });
    assert.equal(await h.sessions.read(second.id), null);
  } finally { await h.close(); }
});

test('sixteen concurrent valid reads plus a real freeze complete atomically; only freeze takes BEGIN IMMEDIATE', async () => {
  const h = await harness();
  try {
    const session = await h.create();
    const context: RequestContext = { actorId: h.actor.id, workspaceId: 'local', requestId: 'fixture-freeze', source: 'session', sessionId: session.id };
    const project = await h.db.project.create({ data: { workspaceId: 'local', name: 'Fixture', rootPath: h.directory, configPath: path.join(h.directory, 'unused.json'), targetKey: 'server', projectIdentity: 'fixture-project', createdByActorId: h.actor.id, targets: { create: [{ targetKey: 'server' }] }, services: { create: [{ serviceKey: 'server' }] } } });
    const repository = new ConfigRepository(h.db, new LocalPolicyService());
    for (let round = 0; round < 4; round++) {
      const draft = await h.db.configDraft.create({ data: { projectId: project.id, targetKey: 'server', name: 'Fixture', etag: 2, actorId: h.actor.id, servicesJson: '{}' } });
      const data = { id: randomUUID(), projectId: project.id, targetKey: 'server', draftId: draft.id, name: 'Fixture', version: `0.0.${round + 1}`, actorId: h.actor.id, servicesJson: '{}', fingerprint: 'fixture' };
      h.queries.length = 0;
      const values = await Promise.all([repository.freeze(draft, data, context), ...Array.from({ length: 16 }, () => h.sessions.read(session.id))]);
      assert(values.slice(1).every(Boolean));
      assert.equal(h.queries.filter(query => query === 'BEGIN IMMEDIATE').length, 1);
      assert.equal(h.queries.filter(query => /INNER JOIN Actor/.test(query)).length, 16);
      assert.equal(await h.db.configVersion.count({ where: { draftId: draft.id } }), 1);
      assert.equal((await h.db.configDraft.findUniqueOrThrow({ where: { id: draft.id } })).status, 'frozen');
      assert.equal(await h.db.audit.count({ where: { action: 'config.freeze', resourceId: data.id } }), 1);
      await assert.rejects(repository.freeze(draft, { ...data, id: randomUUID() }, context), /草稿已改变或冻结/);
    }
  } finally { await h.close(); }
});
