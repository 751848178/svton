import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionStore } from '../auth/session-store.js';
import { verifyPassword } from '../auth/password.js';
import { identityMigrationFixture, IDENTITY_MIGRATION } from './identity-migration.fixture.js';
import { seedIdentityLegacy, identityLegacySnapshot } from './identity-legacy.fixture.js';

test('additive Agent identity migration retains real existing user session and every legacy ledger row', async () => {
  const fixture = await identityMigrationFixture();
  try {
    let db = await fixture.connect();
    const user = await seedIdentityLegacy(db), before = await identityLegacySnapshot(db);
    const view = await new SessionStore(db).read(user.hash); assert.equal(view?.user.id, 'legacy-user');
    await db.onModuleDestroy();
    await fixture.addIdentity(); assert.equal(fixture.deploy().status, 0);
    db = await fixture.connect();
    assert.deepEqual(await identityLegacySnapshot(db), before);
    assert.deepEqual(await new SessionStore(db).read(user.hash), view);
    assert(await verifyPassword(user.password, (await db.actor.findUniqueOrThrow({ where: { id: 'legacy-user' } })).passwordHash!));
    assert.deepEqual([await db.agent.count(), await db.agentEnrollment.count(), await db.agentSession.count()], [0, 0, 0]);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA integrity_check'), [{ integrity_check: 'ok' }]);
    await db.onModuleDestroy(); assert.equal(fixture.deploy().status, 0); db = await fixture.connect();
    assert.deepEqual(await identityLegacySnapshot(db), before);
    const applied = await db.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT count(*) AS count FROM _prisma_migrations WHERE migration_name=? AND finished_at IS NOT NULL', IDENTITY_MIGRATION);
    assert.equal(Number(applied[0]?.count), 1);
  } finally { await fixture.dispose(); }
});

test('failure before registration COMMIT rolls back every new table/index and preserves users before QA-only retry', async () => {
  const fixture = await identityMigrationFixture();
  try {
    let db = await fixture.connect(); await seedIdentityLegacy(db); const before = await identityLegacySnapshot(db);
    await db.onModuleDestroy(); await fixture.addIdentity(true); assert.equal(fixture.deploy().status, 1);
    db = await fixture.connect(); assert.deepEqual(await identityLegacySnapshot(db), before);
    const partial = await db.$queryRawUnsafe('SELECT name FROM sqlite_master WHERE name LIKE \'Agent%\''); assert.deepEqual(partial, []);
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    await db.onModuleDestroy(); assert.equal(fixture.resolveRollback().status, 0);
    await fixture.addIdentity(); assert.equal(fixture.deploy().status, 0); db = await fixture.connect();
    assert.deepEqual(await identityLegacySnapshot(db), before);
    assert.deepEqual([await db.agent.count(), await db.agentEnrollment.count(), await db.agentSession.count()], [0, 0, 0]);
  } finally { await fixture.dispose(); }
});
