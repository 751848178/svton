import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { faultCode, noSecrets, rejected, sessionFixture } from './session.fixture.js';

test('heartbeat duplicate returns the original receipt without refreshing lease, lastSeen or audit', async () => {
  const { heartbeatRequestHash } = await import('shipkit/platform');
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request);
    h.advance(15000); const request = h.heartbeat(opened.epoch, 1), receipt = await h.sessions().heartbeat(context, request);
    const before = await h.ledger(); h.advance(15000);
    assert.deepEqual(await h.sessions().heartbeat(context, request), receipt); assert.deepEqual(await h.ledger(), before);
    assert.equal(receipt.acceptedAt, before.lastSeenAt.toISOString()); assert.equal(receipt.sequence, 1);
    await h.reload(); assert.deepEqual(await h.sessions().heartbeat(await h.machine(), request), receipt);
    const audits = await h.db.audit.findMany({ where: { action: { startsWith: 'agent.' } } }); assert.equal(audits.length, 1);
    noSecrets([receipt, audits], h.credential, h.hash, heartbeatRequestHash(request));
  } finally { await h.dispose(); }
});

test('changed duplicate, gap, stale sequence and wrong boot are rejected without ledger updates', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request);
    await h.sessions().heartbeat(context, h.heartbeat(opened.epoch, 1)); const before = await h.ledger();
    await rejected(h.sessions().heartbeat(context, { ...h.heartbeat(opened.epoch, 1),
      status: { ...h.request.status, docker: false } }), 'AGENT_SEQUENCE_CONFLICT');
    await rejected(h.sessions().heartbeat(context, h.heartbeat(opened.epoch, 3)), 'AGENT_SEQUENCE_CONFLICT');
    await rejected(h.sessions().heartbeat(context, { ...h.heartbeat(opened.epoch, 2), bootId: randomUUID() }), 'AGENT_SESSION_CONFLICT');
    assert.deepEqual(await h.ledger(), before);
    await h.sessions().heartbeat(context, h.heartbeat(opened.epoch, 2));
    await rejected(h.sessions().heartbeat(context, h.heartbeat(opened.epoch, 1)), 'AGENT_SEQUENCE_CONFLICT');
  } finally { await h.dispose(); }
});

test('real SQLite concurrent differing heartbeat payloads elect one next sequence; identical retries recover one receipt', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request);
    const first = h.heartbeat(opened.epoch, 1), other = { ...first, status: { ...first.status, docker: false } };
    const results = await Promise.allSettled([h.sessions().heartbeat(context, first), h.sessions().heartbeat(context, other)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failed = results.find(result => result.status === 'rejected'); assert(failed?.status === 'rejected');
    assert.equal(faultCode(failed.reason), 'AGENT_SEQUENCE_CONFLICT');
    h.advance(15000); const next = h.heartbeat(opened.epoch, 2);
    const identical = await Promise.all([h.sessions().heartbeat(context, next), h.sessions().heartbeat(context, next)]);
    assert.deepEqual(identical[0], identical[1]); assert.equal((await h.ledger()).lastSequence, 2);
  } finally { await h.dispose(); }
});

test('expiry and time rollback reject even identical retries; malformed protocol and persisted receipts fail closed', async () => {
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request), request = h.heartbeat(opened.epoch, 1);
    await h.sessions().heartbeat(context, request); const before = await h.ledger(); h.advance(-1);
    await rejected(h.sessions().heartbeat(context, request), 'AGENT_CLOCK_INVALID'); assert.deepEqual(await h.ledger(), before);
    h.advance(1); await rejected(h.sessions().heartbeat(context, { ...request, sequence: 0 }), 'REGISTRATION_INPUT_INVALID');
    await rejected(h.sessions().heartbeat(context, { ...request, machineCredential: h.credential }), 'REGISTRATION_INPUT_INVALID');
    await h.db.agentSession.update({ where: { agentId: h.agentId }, data: { lastReceiptJson: JSON.stringify({ secret: 'must-not-leak' }) } });
    await rejected(h.sessions().heartbeat(context, request), 'AGENT_SEQUENCE_CONFLICT');
    h.advance(90000); await rejected(h.sessions().heartbeat(context, request), 'AGENT_SESSION_EXPIRED');
  } finally { await h.dispose(); }
});

test('maximum sequence can be recovered exactly but cannot wrap or accept a stale predecessor', async () => {
  const { heartbeatRequestHash } = await import('shipkit/platform');
  const h = await sessionFixture();
  try {
    const context = await h.machine(), opened = await h.sessions().open(context, h.request), sequence = 2147483647;
    const request = h.heartbeat(opened.epoch, sequence), row = await h.ledger();
    const receipt = { v: 1, epoch: opened.epoch, sequence, acceptedAt: row.lastSeenAt.toISOString(), leaseExpiresAt: row.leaseExpiresAt.toISOString() };
    await h.db.agentSession.update({ where: { agentId: h.agentId }, data: { lastSequence: sequence,
      lastPayloadHash: heartbeatRequestHash(request), lastReceiptJson: JSON.stringify(receipt) } });
    assert.deepEqual(await h.sessions().heartbeat(context, request), receipt);
    await rejected(h.sessions().heartbeat(context, h.heartbeat(opened.epoch, sequence - 1)), 'AGENT_COUNTER_EXHAUSTED');
    assert.equal((await h.ledger()).lastSequence, sequence);
  } finally { await h.dispose(); }
});
