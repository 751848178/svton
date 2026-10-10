import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentStateRepository } from './agent-state.repository.js';
import { enrollmentFixture, enrollmentFault } from './enrollment.fixture.js';
import { loadRegistrationProtocol } from './protocol.js';

test('lost enrollment response can recover beyond first-use TTL, without extending recovery', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(1), context = await h.authenticate(issued.code), input = h.consumeInput(issued.enrollmentId);
    const receipt = await h.repository().consume(context, input);
    const original = await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: issued.enrollmentId } });
    h.advance(1001);
    assert.deepEqual(await h.repository().consume(await h.authenticate(issued.code), input), receipt);
    assert.deepEqual(await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: issued.enrollmentId } }), original);
    assert.deepEqual(await h.counts(), { agents: 1, machines: 1, consumed: 1, audits: 1 });
    h.advance(15 * 60_000);
    await assert.rejects(h.repository().consume(context, input), enrollmentFault('REGISTRATION_EXPIRED'));
  } finally { await h.dispose(); }
});

test('revoking a code defeats an already authenticated consume context and leaves no orphan identity', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(), context = await h.authenticate(issued.code), input = h.consumeInput(issued.enrollmentId);
    await h.repository().revoke(h.human, issued.enrollmentId);
    await assert.rejects(h.repository().consume(context, input), enrollmentFault('REGISTRATION_UNAUTHORIZED'));
    assert.deepEqual(await h.counts(), { agents: 0, machines: 0, consumed: 0, audits: 0 });
    await h.repository().revoke(h.human, issued.enrollmentId);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.enrollment.revoke' } }), 1);
  } finally { await h.dispose(); }
});

test('issuer disablement and credential rotation invalidate frozen receipt recovery', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(), context = await h.authenticate(issued.code), input = h.consumeInput(issued.enrollmentId);
    const receipt = await h.repository().consume(context, input);
    await h.db.actor.update({ where: { id: h.human.actorId }, data: { disabled: true } });
    await assert.rejects(h.repository().consume(context, input), enrollmentFault('REGISTRATION_UNAUTHORIZED'));
    await h.db.actor.update({ where: { id: h.human.actorId }, data: { disabled: false } });
    const { generateMachineSecret } = await loadRegistrationProtocol();
    await new AgentStateRepository(h.db, () => h.now).rotate(h.human, receipt.agentId, 1, 1, generateMachineSecret());
    await assert.rejects(h.repository().consume(context, input), enrollmentFault('REGISTRATION_UNAUTHORIZED'));
    assert.deepEqual(await h.counts(), { agents: 1, machines: 1, consumed: 1, audits: 1 });
  } finally { await h.dispose(); }
});

test('admin mutations recheck a logged-out human session inside the transaction', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue();
    await h.db.authSession.delete({ where: { id: h.human.sessionId } });
    await assert.rejects(h.issue(), enrollmentFault('REGISTRATION_UNAUTHORIZED'));
    await assert.rejects(h.repository().revoke(h.human, issued.enrollmentId), enrollmentFault('REGISTRATION_UNAUTHORIZED'));
    assert.equal(await h.db.agentEnrollment.count(), 1);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.enrollment.issue' } }), 1);
  } finally { await h.dispose(); }
});

test('unknown scopes, roles, temporary resources and explicit null TTL are rejected before persistence', async () => {
  const h = await enrollmentFixture();
  try {
    const valid = { v: 1, name: 'Runtime', approvedRole: 'runtime', resourceKind: 'persistent' };
    for (const extra of [{ workspaceId: 'elsewhere' }, { approvedRole: ['runtime'] }, { approvedRole: null }, { ttlSeconds: null }]) {
      await assert.rejects(h.repository().issue(h.human, { ...valid, ...extra }), enrollmentFault('REGISTRATION_INPUT_INVALID'));
    }
    await assert.rejects(h.repository().issue(h.human, { ...valid, resourceKind: 'temporary' }), enrollmentFault('TEMPORARY_AGENT_ENROLLMENT_UNSUPPORTED'));
    assert.equal(await h.db.agentEnrollment.count(), 0);
    assert.equal(await h.db.audit.count({ where: { action: 'agent.enrollment.issue' } }), 0);
  } finally { await h.dispose(); }
});
