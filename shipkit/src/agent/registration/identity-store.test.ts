import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, chmod, mkdir, rm, link } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { withRegistrationIdentity, type RegistrationIdentityStore } from './identity-store.js';
import { identityFixture, initialStatus, enrollmentReceipt } from './identity-fixture.js';
import { RegistrationIdentityError } from './identity-error.js';
import { writeRegistrationIdentityJson } from './identity-write.js';

test('pending attempt is durably frozen before callback; reload ignores changed status and enrollment input', async () => {
  const fixture = await identityFixture();
  try {
    const first = await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      const value = store.current(); assert.equal(value.state, 'pending');
      assert.equal(await readFile(path.join(fixture.root, 'registration', 'identity.json'), 'utf8'), `${JSON.stringify(value)}\n`);
      assert.ok(Object.isFrozen(value));
      if (value.state === 'pending') assert.ok(Object.isFrozen(value.request.metadata.capabilities));
      return value;
    });
    await writeFile(fixture.config.enrollmentFile!, '{invalid', { mode: 0o600 });
    await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus: { ...initialStatus, docker: false, version: 'changed' } }, async store => {
      assert.deepEqual(store.current(), first);
    });
  } finally { await fixture.cleanup(); }
});
test('complete removes code/attempt/DTO, preserves candidate credential and leaves external enrollment file untouched', async () => {
  const fixture = await identityFixture(); let captured: RegistrationIdentityStore | undefined;
  try {
    const original = await readFile(fixture.config.enrollmentFile!, 'utf8');
    const result = await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      captured = store;
      const pending = store.current(); assert.equal(pending.state, 'pending');
      if (pending.state !== 'pending') throw new Error('expected pending');
      const receipt = enrollmentReceipt(pending);
      await assert.rejects(() => store.complete({ ...receipt, incarnation: randomUUID() }), RegistrationIdentityError);
      await assert.rejects(() => store.complete({ ...receipt, secret: fixture.enrollment.code }), RegistrationIdentityError);
      const registered = await store.complete(receipt);
      assert.equal(registered.machineCredential, pending.request.machineCredential);
      assert.deepEqual(await store.complete(receipt), registered);
      await assert.rejects(() => store.complete({ ...receipt, trustRevision: 2 }), RegistrationIdentityError);
      return registered;
    });
    assert.throws(() => captured!.current(), RegistrationIdentityError);
    const saved = await readFile(path.join(fixture.root, 'registration', 'identity.json'), 'utf8');
    assert.doesNotMatch(saved, /enrollmentCode|attemptId|enrollmentId|reportedRole|metadata|"request"/);
    assert.ok(!saved.includes(fixture.enrollment.code));
    assert.equal(await readFile(fixture.config.enrollmentFile!, 'utf8'), original);
    await rm(fixture.config.enrollmentFile!);
    await withRegistrationIdentity(fixture.root, { ...fixture.config, allowLegacyEnrollment: true }, {}, async store => assert.deepEqual(store.current(), result));
  } finally { await fixture.cleanup(); }
});
test('legacy jobs/apps/security need explicit claim and are never changed by initialization', async () => {
  for (const name of ['jobs', 'apps', 'security.json']) {
    const fixture = await identityFixture();
    try {
      const old = path.join(fixture.root, name);
      if (name.endsWith('.json')) await writeFile(old, 'old-pairing', { mode: 0o600 }); else await mkdir(old);
      let entered = false;
      await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async () => { entered = true; }),
        (error: unknown) => error instanceof RegistrationIdentityError && error.code === 'REGISTRATION_LEGACY_CLAIM_REQUIRED');
      assert.equal(entered, false);
      await withRegistrationIdentity(fixture.root, { ...fixture.config, allowLegacyEnrollment: true }, { initialStatus }, async store => assert.equal(store.current().state, 'pending'));
      if (name.endsWith('.json')) assert.equal(await readFile(old, 'utf8'), 'old-pairing');
    } finally { await fixture.cleanup(); }
  }
});
test('identity/anchor deletion, changed incarnation or origin fail closed and cannot trigger another attempt', async () => {
  for (const damage of ['identity', 'anchor', 'incarnation', 'origin', 'both']) {
    const fixture = await identityFixture();
    try {
      await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async () => undefined);
      const identity = path.join(fixture.root, 'registration', 'identity.json'), anchor = path.join(fixture.root, 'registration-anchor.json');
      if (damage === 'identity' || damage === 'both') await rm(identity);
      if (damage === 'anchor' || damage === 'both') await rm(anchor);
      if (damage === 'incarnation') await writeRegistrationIdentityJson(anchor, { v: 1, incarnation: randomUUID() });
      let entered = false;
      await assert.rejects(() => withRegistrationIdentity(fixture.root, { ...fixture.config, allowLegacyEnrollment: true,
        ...(damage === 'origin' ? { serverOrigin: 'https://different.example' } : {}) }, { initialStatus }, async () => { entered = true; }), RegistrationIdentityError);
      assert.equal(entered, false);
    } finally { await fixture.cleanup(); }
  }
});
test('partial initialization and unsafe identity directory are refused without self-healing', async () => {
  const fixture = await identityFixture();
  try {
    await writeRegistrationIdentityJson(path.join(fixture.root, 'registration-anchor.json'), { v: 1, incarnation: randomUUID() });
    await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async () => assert.fail('partial callback')), RegistrationIdentityError);
    await rm(path.join(fixture.root, 'registration-anchor.json'));
    await mkdir(path.join(fixture.root, 'registration'), { mode: 0o755 });
    await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async () => assert.fail('unsafe callback')), RegistrationIdentityError);
    await chmod(path.join(fixture.root, 'registration'), 0o700);
    await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async () => assert.fail('orphan callback')), RegistrationIdentityError);
  } finally { await fixture.cleanup(); }
});
test('failed completion closes the store; repaired safe storage reopens the original pending attempt', async () => {
  const fixture = await identityFixture();
  try {
    const before = await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      const pending = store.current(); assert.equal(pending.state, 'pending');
      if (pending.state !== 'pending') throw new Error('expected pending');
      const extra = path.join(fixture.directory, 'extra-link');
      await link(path.join(fixture.root, 'registration', 'identity.json'), extra);
      await assert.rejects(() => store.complete(enrollmentReceipt(pending)), RegistrationIdentityError);
      assert.throws(() => store.current(), RegistrationIdentityError);
      await rm(extra); return pending;
    });
    await withRegistrationIdentity(fixture.root, fixture.config, {}, async store => assert.deepEqual(store.current(), before));
  } finally { await fixture.cleanup(); }
});
test('concurrent completion cannot race writes and invalid initialization options never publish files', async () => {
  const fixture = await identityFixture();
  try {
    for (const bad of [{ initialStatus: { ...initialStatus, version: '' } }, { initialStatus, lockTimeoutMs: Infinity },
      { initialStatus, lockTimeoutMs: 15001 }]) {
      await assert.rejects(() => withRegistrationIdentity(fixture.root, fixture.config, bad, async () => assert.fail('invalid callback')), RegistrationIdentityError);
    }
    await withRegistrationIdentity(fixture.root, fixture.config, { initialStatus }, async store => {
      const pending = store.current(); if (pending.state !== 'pending') throw new Error('expected pending');
      const receipt = enrollmentReceipt(pending);
      const result = await Promise.allSettled([store.complete(receipt), store.complete(receipt)]);
      assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
      assert.equal(result.filter(item => item.status === 'rejected').length, 1);
      assert.equal(store.current().state, 'registered');
    });
  } finally { await fixture.cleanup(); }
});
