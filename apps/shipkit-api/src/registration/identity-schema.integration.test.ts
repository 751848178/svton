import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { databaseFixture } from '../testing/database.fixture.js';
import { identitySchemaRows, insertIdentityRow, updateIdentityRow } from './identity-schema.fixture.js';

test('fresh deployed identity schema creates no registered identity and leaves legacy local Actor intact', async () => {
  const h = await databaseFixture();
  try {
    assert.deepEqual([await h.db.agent.count(), await h.db.agentEnrollment.count(), await h.db.agentSession.count()], [0, 0, 0]);
    const local = await h.db.actor.findUniqueOrThrow({ where: { id: 'local-controller' } });
    assert.equal(local.kind, 'local'); assert.equal(local.username, null); assert.equal(local.passwordHash, null);
    assert.equal(await h.db.authSession.count(), 0);
    assert.deepEqual(await h.db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
  } finally { await h.dispose(); }
});

test('real SQLite Agent constraints enforce persistent role, UUID, hash, integer revisions, booleans and ownership', async () => {
  const h = await databaseFixture();
  try {
    const rows = await identitySchemaRows(h.db); await insertIdentityRow(h.db, 'Agent', rows.agent);
    const before = await h.db.agent.findUniqueOrThrow({ where: { id: rows.agent.id } });
    for (const patch of [{ id: 'legacy-resource' }, { incarnation: ('a' + randomUUID().slice(1)).toUpperCase() }, { approvedRole: 'admin' },
      { resourceKind: 'temporary' }, { credentialHash: 'raw-secret' }, { credentialHash: 'A'.repeat(64) },
      { credentialRevision: 0 }, { credentialRevision: 2_147_483_648 }, { credentialRevision: 1.5 },
      { trustRevision: -1 }, { disabled: 2 }, { draining: 2 }, { name: ' ' }]) {
      await assert.rejects(updateIdentityRow(h.db, 'Agent', rows.agent.id, patch), /CHECK constraint failed/);
    }
    assert.deepEqual(await h.db.agent.findUniqueOrThrow({ where: { id: rows.agent.id } }), before);
    await assert.rejects(insertIdentityRow(h.db, 'Agent', { ...rows.agent, id: randomUUID(), incarnation: randomUUID() }), /UNIQUE constraint failed/);
    await assert.rejects(updateIdentityRow(h.db, 'Agent', rows.agent.id, { workspaceId: 'missing-workspace' }), /FOREIGN KEY constraint failed/);
    await assert.rejects(h.db.actor.delete({ where: { id: rows.agent.actorId } }), /Foreign key constraint/);
  } finally { await h.dispose(); }
});

test('real SQLite Enrollment enforces every consumed field together, hash and unique attempt binding', async () => {
  const h = await databaseFixture();
  try {
    const rows = await identitySchemaRows(h.db);
    await insertIdentityRow(h.db, 'Agent', rows.agent); await insertIdentityRow(h.db, 'AgentEnrollment', rows.enrollment);
    const before = await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: rows.enrollment.id } });
    const consumed = { consumedAt: new Date(), attemptId: randomUUID(), requestHash: 'b'.repeat(64), agentId: rows.agent.id,
      recoveryUntil: new Date(Date.now() + 900_000), receiptJson: '{}' };
    for (const [field, value] of Object.entries(consumed)) {
      await assert.rejects(updateIdentityRow(h.db, 'AgentEnrollment', rows.enrollment.id, { [field]: value }), /CHECK constraint failed/);
    }
    for (const patch of [{ resourceKind: 'temporary' }, { approvedRole: 'admin' }, { tokenHash: 'raw-code' }, { name: '' }]) {
      await assert.rejects(updateIdentityRow(h.db, 'AgentEnrollment', rows.enrollment.id, patch), /CHECK constraint failed/);
    }
    assert.deepEqual(await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: rows.enrollment.id } }), before);
    await updateIdentityRow(h.db, 'AgentEnrollment', rows.enrollment.id, consumed);
    await assert.rejects(insertIdentityRow(h.db, 'AgentEnrollment', { ...rows.enrollment, id: randomUUID(), tokenHash: 'c'.repeat(64), ...consumed }), /UNIQUE constraint failed/);
    await assert.rejects(updateIdentityRow(h.db, 'AgentEnrollment', rows.enrollment.id, { agentId: randomUUID() }), /FOREIGN KEY constraint failed/);
    await assert.rejects(h.db.agent.delete({ where: { id: rows.agent.id } }), /Foreign key constraint/);
  } finally { await h.dispose(); }
});

test('real SQLite Session keeps opening hash and enforces epoch/sequence fences and receipt pairs', async () => {
  const h = await databaseFixture();
  try {
    const rows = await identitySchemaRows(h.db); await insertIdentityRow(h.db, 'Agent', rows.agent);
    await insertIdentityRow(h.db, 'AgentSession', rows.session);
    const before = await h.db.agentSession.findUniqueOrThrow({ where: { agentId: rows.agent.id } });
    for (const patch of [{ epoch: 0 }, { epoch: 2_147_483_648 }, { epoch: 1.5 }, { credentialRevision: 0 }, { trustRevision: 0 },
      { bootId: 'old-boot' }, { incarnation: 'local' }, { openRequestHash: 'raw-secret' }, { lastSequence: -1 },
      { lastSequence: 2_147_483_648 }, { lastSequence: 1 }, { lastPayloadHash: 'd'.repeat(64) }, { lastReceiptJson: '{}' },
      { reportedRole: 'admin' }, { capabilitiesJson: '' }, { version: 'x'.repeat(65) }, { docker: 2 }]) {
      await assert.rejects(updateIdentityRow(h.db, 'AgentSession', rows.agent.id, patch), /CHECK constraint failed/);
    }
    assert.deepEqual(await h.db.agentSession.findUniqueOrThrow({ where: { agentId: rows.agent.id } }), before);
    await updateIdentityRow(h.db, 'AgentSession', rows.agent.id, { epoch: 2_147_483_647, lastSequence: 2_147_483_647,
      lastPayloadHash: 'd'.repeat(64), lastReceiptJson: '{}' });
    assert.equal((await h.db.agentSession.findUniqueOrThrow({ where: { agentId: rows.agent.id } })).openRequestHash, before.openRequestHash);
    await assert.rejects(updateIdentityRow(h.db, 'AgentSession', rows.agent.id, { lastPayloadHash: null }), /CHECK constraint failed/);
    await assert.rejects(insertIdentityRow(h.db, 'AgentSession', { ...rows.session, agentId: randomUUID() }), /FOREIGN KEY constraint failed/);
    await assert.rejects(h.db.agent.delete({ where: { id: rows.agent.id } }), /Foreign key constraint/);
  } finally { await h.dispose(); }
});
