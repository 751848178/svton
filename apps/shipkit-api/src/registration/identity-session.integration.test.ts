import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SESSION_COOKIE } from '../auth/settings.js';
import { identityMigrationFixture } from './identity-migration.fixture.js';
import { seedIdentityLegacy, identityLegacySnapshot } from './identity-legacy.fixture.js';

test('a genuine pre-registration cookie stays usable through normal API after additive migration', async () => {
  const fixture = await identityMigrationFixture();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    let db = await fixture.connect(); const user = await seedIdentityLegacy(db);
    const before = await identityLegacySnapshot(db); await db.onModuleDestroy();
    await fixture.addIdentity(); assert.equal(fixture.deploy().status, 0);
    app = await NestFactory.create(AppModule, { logger: false }); await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/api/auth/session`, { headers: { cookie: `${SESSION_COOKIE}=${user.token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).user, { id: 'legacy-user', username: 'legacy-user', displayName: 'Legacy User' });
    db = await fixture.connect(); assert.deepEqual(await identityLegacySnapshot(db), before);
    assert.equal(await db.agent.count(), 0); assert.equal(await db.agentEnrollment.count(), 0); assert.equal(await db.agentSession.count(), 0);
  } finally { await app?.close(); await fixture.dispose(); }
});
