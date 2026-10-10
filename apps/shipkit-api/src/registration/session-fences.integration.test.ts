import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { faultCode, rejected, sessionFixture } from './session.fixture.js';

test('fresh human session and workspace are required; machine Actor cannot impersonate an administrator', async () => {
  const h = await sessionFixture();
  try {
    await h.sessions().open(await h.machine(), h.request); const before = await h.ledger();
    await rejected(h.controls().setDisabled({ ...h.human, source: 'loopback' }, h.agentId, 1, true), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.controls().setDisabled({ ...h.human, workspaceId: 'other' }, h.agentId, 1, true), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.controls().setDisabled(h.human, randomUUID(), 1, true), 'AGENT_NOT_FOUND');
    await h.db.authSession.create({ data: { id: 'machine-session', actorId: h.actorId, expiresAt: new Date(h.now.getTime() + 1000) } });
    await rejected(h.controls().setDisabled({ ...h.human, sessionId: 'machine-session', actorId: h.actorId }, h.agentId, 1, true), 'REGISTRATION_UNAUTHORIZED');
    await h.db.actor.update({ where: { id: h.human.actorId }, data: { disabled: true } });
    await rejected(h.controls().setDisabled(h.human, h.agentId, 1, true), 'REGISTRATION_UNAUTHORIZED');
    assert.deepEqual(await h.ledger(), before); assert.equal(await h.db.audit.count({ where: { action: 'agent.disabled' } }), 0);
  } finally { await h.dispose(); }
});

test('counter exhaustion or rollback time rolls back the whole admin mutation and its audit', async () => {
  const { generateMachineSecret } = await import('shipkit/platform');
  const h = await sessionFixture();
  try {
    await h.sessions().open(await h.machine(), h.request); const before = await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } });
    h.advance(-1); await rejected(h.controls().setDisabled(h.human, h.agentId, 1, true), 'AGENT_CLOCK_INVALID');
    assert.deepEqual(await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } }), before); h.advance(1);
    await h.db.agentSession.update({ where: { agentId: h.agentId }, data: { epoch: 2147483647 } });
    await rejected(h.controls().revoke(h.human, h.agentId, 1), 'AGENT_COUNTER_EXHAUSTED');
    assert.equal((await h.db.actor.findUniqueOrThrow({ where: { id: h.actorId } })).disabled, false);
    assert.deepEqual(await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } }), before);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.revoke' } }), 0);
    await h.db.agentSession.update({ where: { agentId: h.agentId }, data: { epoch: 1 } });
    await h.db.agent.update({ where: { id: h.agentId }, data: { trustRevision: 2147483647 } });
    await rejected(h.controls().setDraining(h.human, h.agentId, 2147483647, true), 'AGENT_COUNTER_EXHAUSTED');
    await h.db.agent.update({ where: { id: h.agentId }, data: { credentialRevision: 2147483647, trustRevision: 1 } });
    await rejected(h.controls().rotate(h.human, h.agentId, 1, 2147483647, generateMachineSecret()), 'AGENT_COUNTER_EXHAUSTED');
  } finally { await h.dispose(); }
});

test('real SQLite competing admin controls CAS one trust revision and never let the loser undo the winner', async () => {
  const h = await sessionFixture();
  try {
    await h.sessions().open(await h.machine(), h.request);
    const results = await Promise.allSettled([h.controls().setDisabled(h.human, h.agentId, 1, true),
      h.controls().setDraining(h.human, h.agentId, 1, true)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failed = results.find(result => result.status === 'rejected'); assert(failed?.status === 'rejected');
    assert.equal(faultCode(failed.reason), 'AGENT_STATE_CONFLICT');
    const agent = await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } });
    assert.equal(agent.trustRevision, 2); assert.notEqual(agent.disabled, agent.draining);
    assert.equal((await h.ledger()).epoch, 2);
    assert.equal(await h.db.audit.count({ where: { action: { in: ['agent.disabled', 'agent.draining'] } } }), 1);
  } finally { await h.dispose(); }
});

test('a pre-control machine guard proof cannot open or heartbeat after revoke, disable or candidate rotation commits', async () => {
  const { generateMachineSecret } = await import('shipkit/platform');
  for (const control of ['disable', 'rotate', 'revoke'] as const) {
    const h = await sessionFixture();
    try {
      const cached = await h.machine(), opened = await h.sessions().open(cached, h.request);
      if (control === 'disable') await h.controls().setDisabled(h.human, h.agentId, 1, true);
      else if (control === 'rotate') await h.controls().rotate(h.human, h.agentId, 1, 1, generateMachineSecret());
      else await h.controls().revoke(h.human, h.agentId, 1);
      const fenced = await h.ledger();
      await rejected(h.sessions().heartbeat(cached, h.heartbeat(opened.epoch, 1)), 'REGISTRATION_UNAUTHORIZED');
      await rejected(h.sessions().open(cached, h.request), 'REGISTRATION_UNAUTHORIZED');
      assert.deepEqual(await h.ledger(), fenced);
    } finally { await h.dispose(); }
  }
});

test('a concurrent heartbeat and disabling transaction cannot leave a revived lease after the control commits', async () => {
  const h = await sessionFixture();
  try {
    const cached = await h.machine(), opened = await h.sessions().open(cached, h.request); h.advance(15000);
    const results = await Promise.allSettled([h.sessions().heartbeat(cached, h.heartbeat(opened.epoch, 1)),
      h.controls().setDisabled(h.human, h.agentId, 1, true)]);
    assert.equal(results[1]?.status, 'fulfilled');
    if (results[0]?.status === 'rejected') assert.equal(faultCode(results[0].reason), 'REGISTRATION_UNAUTHORIZED');
    const row = await h.ledger(); assert.equal(row.leaseExpiresAt.getTime(), h.now.getTime());
    assert.equal(row.epoch, 2); assert.equal(row.lastSequence, 0); assert.equal(row.lastReceiptJson, null);
    assert.equal((await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } })).disabled, true);
  } finally { await h.dispose(); }
});

test('clock rollback after an admin fence cannot turn its expired lease into an active session', async () => {
  const h = await sessionFixture();
  try {
    await h.sessions().open(await h.machine(), h.request); h.advance(15000);
    await h.controls().setDraining(h.human, h.agentId, 1, true);
    const fresh = await h.machine(), before = await h.ledger(); h.advance(-1);
    await rejected(h.sessions().open(fresh, h.request), 'AGENT_CLOCK_INVALID');
    await rejected(h.sessions().heartbeat(fresh, h.heartbeat(before.epoch, 1)), 'AGENT_CLOCK_INVALID');
    assert.deepEqual(await h.ledger(), before);
  } finally { await h.dispose(); }
});
