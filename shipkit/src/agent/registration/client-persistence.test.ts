import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withRegistrationIdentity } from './identity-store.js';
import { runRegistrationClient } from './client.js';
import { clientFixture, reply, httpFailure } from './client-fixture.js';
import { ENROLL_SECRET, UUID, STATUS } from './request-fixture.js';

test('actual atomic identity save failure preserves pending attempt and a restart recovers the same consume', async t => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'shipkit-client-persistence-'))); await chmod(dir, 0o700);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const workRoot = path.join(dir, 'work'); const { mkdir } = await import('node:fs/promises'); await mkdir(workRoot, { mode: 0o700 });
  const codeFile = path.join(dir, 'enrollment.json'); await writeFile(codeFile, JSON.stringify({ v: 1, enrollmentId: UUID, code: ENROLL_SECRET }), { mode: 0o600 });
  const fixture = clientFixture(); const config = { ...fixture.options.config, enrollmentFile: codeFile };
  let original: string | undefined, enrolls = 0;
  await withRegistrationIdentity(workRoot, config, { initialStatus: STATUS }, async store => {
    const identity = store.current(); assert.equal(identity.state, 'pending'); original = JSON.stringify(identity);
    await runRegistrationClient({ ...fixture.options, config, store, request: async request => {
      assert.equal(request.phase, 'enroll'); enrolls++;
      await chmod(path.join(workRoot, 'registration'), 0o777); return reply(request);
    } });
    assert.equal(fixture.events.at(-1)?.code, 'REGISTRATION_IDENTITY_SAVE_FAILED');
    assert.throws(() => store.current(), { code: 'REGISTRATION_STORE_CLOSED' });
    await chmod(path.join(workRoot, 'registration'), 0o700);
  });
  await withRegistrationIdentity(workRoot, config, { initialStatus: STATUS }, async store => {
    assert.equal(JSON.stringify(store.current()), original);
    await runRegistrationClient({ ...fixture.options, config, store, request: async request => {
      if (request.phase === 'enroll') { enrolls++; return reply(request); } throw httpFailure();
    } });
    assert.equal(store.current().state, 'registered');
  });
  assert.equal(enrolls, 2);
});
