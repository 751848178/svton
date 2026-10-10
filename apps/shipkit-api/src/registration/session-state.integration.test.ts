import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noSecrets, rejected, sessionFixture } from './session.fixture.js';

test('disable and enable fence the existing row and reject guard proofs captured before the control', async () => {
  const h = await sessionFixture();
  try {
    const cached = await h.machine(), first = await h.sessions().open(cached, h.request);
    await h.sessions().heartbeat(cached, h.heartbeat(first.epoch, 1));
    const disabled = await h.controls().setDisabled(h.human, h.agentId, 1, true);
    assert.equal(disabled.disabled, true); assert.equal(disabled.trustRevision, 2);
    const fenced = await h.ledger(); assert.equal(fenced.epoch, 2); assert.equal(fenced.lastSequence, 0);
    assert.equal(fenced.lastPayloadHash, null); assert.equal(fenced.lastReceiptJson, null);
    assert.equal(fenced.leaseExpiresAt.getTime(), h.now.getTime());
    await rejected(h.sessions().heartbeat(cached, h.heartbeat(first.epoch, 2)), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.sessions().open(cached, h.request), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.machine(), 'REGISTRATION_UNAUTHORIZED');
    const enabled = await h.controls().setDisabled(h.human, h.agentId, 2, false); assert.equal(enabled.trustRevision, 3);
    await rejected(h.sessions().open(cached, h.request), 'REGISTRATION_UNAUTHORIZED');
    const current = await h.machine(), reopened = await h.sessions().open(current, h.request);
    assert.equal(reopened.epoch, 4); assert.equal(await h.db.agentSession.count(), 1);
    await rejected(h.sessions().heartbeat(current, h.heartbeat(first.epoch, 2)), 'AGENT_SESSION_CONFLICT');
  } finally { await h.dispose(); }
});

test('draining retains authenticated liveness without granting the reported role or accepting old revision contexts', async () => {
  const h = await sessionFixture();
  try {
    const cached = await h.machine(); await h.sessions().open(cached, h.request);
    const state = await h.controls().setDraining(h.human, h.agentId, 1, true); assert.equal(state.draining, true);
    await rejected(h.sessions().open(cached, h.request), 'REGISTRATION_UNAUTHORIZED');
    const fresh = await h.machine(), opened = await h.sessions().open(fresh, h.request);
    const receipt = await h.sessions().heartbeat(fresh, h.heartbeat(opened.epoch, 1)); assert.equal(receipt.sequence, 1);
    const agent = await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } });
    assert.equal(agent.approvedRole, 'runtime'); assert.equal(agent.draining, true); assert.equal((await h.ledger()).reportedRole, 'both');
    const noOp = await h.controls().setDraining(h.human, h.agentId, 2, true); assert.deepEqual(noOp, state);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.draining' } }), 1);
  } finally { await h.dispose(); }
});

test('client-candidate rotation invalidates old credentials and recovers only the exact lost response', async () => {
  const { generateMachineSecret, hashMachineSecret } = await import('shipkit/platform');
  const h = await sessionFixture();
  try {
    const cached = await h.machine(); await h.sessions().open(cached, h.request);
    const candidate = generateMachineSecret(), candidateHash = hashMachineSecret(candidate);
    const rotated = await h.controls().rotate(h.human, h.agentId, 1, 1, candidate);
    assert.equal(rotated.credentialRevision, 2); assert.equal(rotated.trustRevision, 2);
    assert.deepEqual(await h.controls().rotate(h.human, h.agentId, 1, 1, candidate), rotated);
    await h.reload(); assert.deepEqual(await h.controls().rotate(h.human, h.agentId, 1, 1, candidate), rotated);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.credential.rotate' } }), 1);
    await rejected(h.controls().rotate(h.human, h.agentId, 1, 1, generateMachineSecret()), 'AGENT_STATE_CONFLICT');
    await rejected(h.controls().rotate(h.human, h.agentId, 2, 2, candidate), 'AGENT_STATE_CONFLICT');
    await rejected(h.machine(), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.sessions().open(cached, h.request), 'REGISTRATION_UNAUTHORIZED');
    const current = await h.machine(candidate), opened = await h.sessions().open(current, h.request);
    assert.equal((await h.sessions().heartbeat(current, h.heartbeat(opened.epoch, 1))).sequence, 1);
    const audit = await h.db.audit.findMany({ where: { action: { startsWith: 'agent.' } } });
    noSecrets([rotated, audit], h.credential, h.hash, candidate, candidateHash);
    await h.controls().setDisabled(h.human, h.agentId, 2, true);
    await rejected(h.controls().rotate(h.human, h.agentId, 1, 1, candidate), 'AGENT_STATE_CONFLICT');
  } finally { await h.dispose(); }
});

test('rotation while disabled does not enable the Agent; revocation is permanent for this A1 identity', async () => {
  const { generateMachineSecret } = await import('shipkit/platform');
  const h = await sessionFixture();
  try {
    await h.sessions().open(await h.machine(), h.request);
    await h.controls().setDisabled(h.human, h.agentId, 1, true);
    const candidate = generateMachineSecret(), rotated = await h.controls().rotate(h.human, h.agentId, 2, 1, candidate);
    assert.equal(rotated.disabled, true); await rejected(h.machine(candidate), 'REGISTRATION_UNAUTHORIZED');
    const revoked = await h.controls().revoke(h.human, h.agentId, 3); assert.equal(revoked.revoked, true);
    assert.equal(revoked.trustRevision, 4); assert.equal((await h.ledger()).epoch, 4);
    const before = await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } });
    await rejected(h.controls().setDisabled(h.human, h.agentId, 4, false), 'AGENT_STATE_CONFLICT');
    await rejected(h.controls().setDraining(h.human, h.agentId, 4, false), 'AGENT_STATE_CONFLICT');
    await rejected(h.controls().rotate(h.human, h.agentId, 4, 2, generateMachineSecret()), 'AGENT_STATE_CONFLICT');
    assert.deepEqual(await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } }), before);
    const auditCount = await h.db.audit.count({ where: { action: 'agent.revoke' } });
    assert.deepEqual(await h.controls().revoke(h.human, h.agentId, 4), revoked);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.revoke' } }), auditCount);
  } finally { await h.dispose(); }
});
