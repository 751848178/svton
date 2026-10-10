import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { assertEnrollmentContext, assertMachineContext } from './machine-auth.service.js';
import type { EnrollmentContext, MachineContext } from './machine-request.js';
import { machineAuthFixture } from './machine-auth.integration.fixture.js';
import { loadRegistrationProtocol } from './protocol.js';
import { SessionStore } from '../auth/session-store.js';

test('hash-only machine and enrollment auth build distinct immutable contexts without enumerating guard proofs', async () => {
  const h = await machineAuthFixture();
  try {
    const machine = await h.auth.authenticate('machine', `Bearer ${h.machineSecret}`) as MachineContext;
    const code = await h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`) as EnrollmentContext;
    assert.equal(machine.agentId, h.agent.id); assert.equal(machine.actorId, h.actor.id); assert.equal(machine.workspaceId, 'local');
    assert.equal(code.enrollmentId, h.enrollment.id); assert.equal(code.issuedByActorId, h.issuer.id);
    assert(machine.requestId && code.requestId && machine.requestId !== code.requestId);
    assert(Object.isFrozen(machine)); assert(Object.isFrozen(code));
    for (const secret of [h.machineSecret, h.enrollmentSecret, h.agent.credentialHash, h.enrollment.tokenHash]) {
      assert(!JSON.stringify([machine, code]).includes(secret));
    }
    assert.equal(machine.credentialHash, h.agent.credentialHash); assert.equal(code.tokenHash, h.enrollment.tokenHash);
    for (const [mode, bearer] of [['machine', h.enrollmentSecret], ['enrollment', h.machineSecret],
      ['machine', h.agent.credentialHash], ['enrollment', h.enrollment.tokenHash], ['machine', 'invalid']]) {
      await assert.rejects(h.auth.authenticate(mode as 'machine' | 'enrollment', `Bearer ${bearer}`));
    }
  } finally { await h.dispose(); }
});

test('machine actor eligibility is independent of enrollment issuer, but disabled and malformed bound Actors reject', async () => {
  const h = await machineAuthFixture();
  try {
    await h.db.actor.update({ where: { id: h.issuer.id }, data: { disabled: true } });
    await h.auth.authenticate('machine', `Bearer ${h.machineSecret}`);
    await assert.rejects(h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`));
    for (const patch of [{ kind: 'user' }, { kind: 'local' }, { username: 'fixture-spoofed' }, { passwordHash: 'fixture-password' }, { disabled: true }]) {
      await h.db.actor.update({ where: { id: h.actor.id }, data: { kind: 'machine', username: null, passwordHash: null, disabled: false, ...patch } });
      await assert.rejects(h.auth.authenticate('machine', `Bearer ${h.machineSecret}`));
    }
    await h.db.actor.update({ where: { id: h.actor.id }, data: { kind: 'machine', username: null, passwordHash: null, disabled: false } });
    await h.db.agent.update({ where: { id: h.agent.id }, data: { draining: true } });
    await h.auth.authenticate('machine', `Bearer ${h.machineSecret}`);
    await h.db.agent.update({ where: { id: h.agent.id }, data: { disabled: true } });
    await assert.rejects(h.auth.authenticate('machine', `Bearer ${h.machineSecret}`));
  } finally { await h.dispose(); }
});

test('fresh transaction checks fence a guard-read followed by rotation, trust change, disable or workspace change', async () => {
  const h = await machineAuthFixture();
  try {
    await h.db.workspace.create({ data: { id: 'other', name: 'Other fixture' } });
    const original = await h.auth.authenticate('machine', `Bearer ${h.machineSecret}`) as MachineContext;
    assert.equal((await h.db.$transaction(tx => assertMachineContext(tx, original))).id, h.agent.id);
    const { generateMachineSecret, hashMachineSecret } = await loadRegistrationProtocol();
    const replacement = hashMachineSecret(generateMachineSecret());
    for (const patch of [{ credentialHash: replacement }, { credentialRevision: 2 }, { trustRevision: 2 },
      { disabled: true }, { workspaceId: 'other' }, { incarnation: randomUUID() }]) {
      await h.db.agent.update({ where: { id: h.agent.id }, data: { credentialHash: h.agent.credentialHash,
        credentialRevision: 1, trustRevision: 1, disabled: false, workspaceId: 'local', incarnation: h.agent.incarnation, ...patch } });
      await assert.rejects(h.db.$transaction(tx => assertMachineContext(tx, original)));
    }
  } finally { await h.dispose(); }
});

test('enrollment credential auth permits expired first-use recovery input but transaction rechecks issuer and revocation', async () => {
  const h = await machineAuthFixture();
  try {
    await h.db.agentEnrollment.update({ where: { id: h.enrollment.id }, data: { expiresAt: new Date(0), consumedAt: new Date(),
      attemptId: randomUUID(), requestHash: 'a'.repeat(64), agentId: h.agent.id, recoveryUntil: new Date(Date.now() + 900000), receiptJson: '{}' } });
    const context = await h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`) as EnrollmentContext;
    assert.equal((await h.db.$transaction(tx => assertEnrollmentContext(tx, context, new Date()))).id, h.enrollment.id);
    await h.db.actor.update({ where: { id: h.issuer.id }, data: { disabled: true } });
    await assert.rejects(h.db.$transaction(tx => assertEnrollmentContext(tx, context, new Date())));
    await h.db.actor.update({ where: { id: h.issuer.id }, data: { disabled: false } });
    await h.db.agentEnrollment.update({ where: { id: h.enrollment.id }, data: { revokedAt: new Date() } });
    await assert.rejects(h.db.$transaction(tx => assertEnrollmentContext(tx, context, new Date())));
  } finally { await h.dispose(); }
});

test('corrupt temporary identity rows cannot bypass persistent-only authentication or transactional checks', async () => {
  const h = await machineAuthFixture();
  try {
    const machine = await h.auth.authenticate('machine', `Bearer ${h.machineSecret}`) as MachineContext;
    const enrollment = await h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`) as EnrollmentContext;
    await h.db.$executeRawUnsafe('PRAGMA ignore_check_constraints=ON');
    await h.db.agent.update({ where: { id: h.agent.id }, data: { resourceKind: 'temporary' } });
    await h.db.agentEnrollment.update({ where: { id: h.enrollment.id }, data: { resourceKind: 'temporary' } });
    await h.db.$executeRawUnsafe('PRAGMA ignore_check_constraints=OFF');
    await assert.rejects(h.auth.authenticate('machine', `Bearer ${h.machineSecret}`));
    await assert.rejects(h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`));
    await assert.rejects(h.db.$transaction(tx => assertMachineContext(tx, machine)));
    await assert.rejects(h.db.$transaction(tx => assertEnrollmentContext(tx, enrollment, new Date())));
  } finally { await h.dispose(); }
});

test('machine Actors never create or retain human sessions, and malformed enrollment issuers reject', async () => {
  const h = await machineAuthFixture();
  try {
    const sessions = new SessionStore(h.db), hash = 'b'.repeat(64), expiresAt = new Date(Date.now() + 60000);
    await assert.rejects(sessions.create(h.actor.id, '', hash, expiresAt, randomUUID()));
    await h.db.authSession.create({ data: { id: hash, actorId: h.actor.id, expiresAt } });
    assert.equal(await sessions.read(hash), null);
    assert.equal(await h.db.authSession.count({ where: { id: hash } }), 0);
    for (const patch of [{ kind: 'machine' }, { kind: 'local' }, { username: null }, { passwordHash: null }, { disabled: true }]) {
      await h.db.actor.update({ where: { id: h.issuer.id }, data: { kind: 'user', username: h.issuer.username,
        passwordHash: h.issuer.passwordHash, disabled: false, ...patch } });
      await assert.rejects(h.auth.authenticate('enrollment', `Bearer ${h.enrollmentSecret}`));
    }
  } finally { await h.dispose(); }
});
