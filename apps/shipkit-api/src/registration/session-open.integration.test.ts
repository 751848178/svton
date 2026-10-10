import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { faultCode, noSecrets, rejected, sessionFixture } from './session.fixture.js';

test('opening and repeating a frozen boot persists through Server reconstruction without extending the lease', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), first = await h.sessions().open(context, h.request);
    assert.equal(first.v, 1); assert.equal(first.epoch, 1); assert.equal(first.lastSequence, 0);
    assert.equal(first.heartbeatIntervalMs, 15000); assert.equal(Date.parse(first.leaseExpiresAt), h.now.getTime() + 90000);
    h.advance(15000); const duplicate = await h.sessions().open(context, h.request); assert.deepEqual(duplicate, first);
    assert.equal((await h.ledger()).reportedRole, 'both'); // Approved runtime does not become approved both.
    assert.equal((await h.db.agent.findUniqueOrThrow({ where: { id: h.agentId } })).approvedRole, 'runtime');
    const audits = await h.db.audit.findMany({ where: { action: 'agent.session.open' } }); assert.equal(audits.length, 1);
    noSecrets([first, duplicate, audits], h.credential, h.hash);
    await h.reload(); assert.deepEqual(await h.sessions().open(await h.machine(), h.request), first);
    assert.equal(await h.db.agentSession.count(), 1);
  } finally { await h.dispose(); }
});

test('active boot or opening-metadata changes conflict; a repeated original opening returns the current sequence', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request);
    await rejected(h.sessions().open(context, { ...h.request, bootId: randomUUID() }), 'AGENT_SESSION_CONFLICT');
    await rejected(h.sessions().open(context, { ...h.request, status: { ...h.request.status, version: '0.0.2' } }), 'AGENT_SESSION_CONFLICT');
    h.advance(15000); const beat = await h.sessions().heartbeat(context, { ...h.heartbeat(opened.epoch, 1),
      status: { ...h.request.status, version: '0.0.2' } });
    h.advance(15000); const repeated = await h.sessions().open(context, h.request);
    assert.equal(repeated.lastSequence, 1); assert.equal(repeated.leaseExpiresAt, beat.leaseExpiresAt);
    assert.equal((await h.ledger()).version, '0.0.2');
  } finally { await h.dispose(); }
});

test('real SQLite competing first sessions elect one boot and retain exactly one opening audit', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), other = { ...h.request, bootId: randomUUID() };
    const results = await Promise.allSettled([h.sessions().open(context, h.request), h.sessions().open(context, other)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failed = results.find(result => result.status === 'rejected'); assert(failed?.status === 'rejected');
    assert.equal(faultCode(failed.reason), 'AGENT_SESSION_CONFLICT');
    assert.equal(await h.db.agentSession.count(), 1); assert.equal(await h.db.audit.count({ where: { action: 'agent.session.open' } }), 1);
  } finally { await h.dispose(); }
});

test('expired lease opens a strictly newer epoch without deleting the Session row or inheriting sequence receipts', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), first = await h.sessions().open(context, h.request);
    await h.sessions().heartbeat(context, h.heartbeat(first.epoch, 1)); h.advance(90000);
    await rejected(h.sessions().heartbeat(context, h.heartbeat(first.epoch, 1)), 'AGENT_SESSION_EXPIRED');
    const second = await h.sessions().open(context, { ...h.request, bootId: randomUUID() });
    assert.equal(second.epoch, 2); assert.equal(second.lastSequence, 0);
    const row = await h.ledger(); assert.equal(row.lastPayloadHash, null); assert.equal(row.lastReceiptJson, null);
    assert.equal(await h.db.agentSession.count(), 1);
    await rejected(h.sessions().heartbeat(context, h.heartbeat(first.epoch, 2)), 'AGENT_SESSION_CONFLICT');
  } finally { await h.dispose(); }
});

test('opening rejects wrong request identity, rollback time and exhausted durable epochs without changing state', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(); await h.sessions().open(context, h.request);
    await rejected(h.sessions().open(context, { ...h.request, incarnation: randomUUID() }), 'REGISTRATION_UNAUTHORIZED');
    await rejected(h.sessions().open(context, { ...h.request, agentId: randomUUID() }), 'REGISTRATION_UNAUTHORIZED');
    const before = await h.ledger(); h.advance(-1);
    await rejected(h.sessions().open(context, h.request), 'AGENT_CLOCK_INVALID'); assert.deepEqual(await h.ledger(), before);
    h.advance(90001); await h.db.agentSession.update({ where: { agentId: h.agentId }, data: { epoch: 2147483647 } });
    await rejected(h.sessions().open(context, { ...h.request, bootId: randomUUID() }), 'AGENT_COUNTER_EXHAUSTED');
    assert.equal((await h.ledger()).epoch, 2147483647);
  } finally { await h.dispose(); }
});
