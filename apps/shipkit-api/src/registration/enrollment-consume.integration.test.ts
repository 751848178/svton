import assert from 'node:assert/strict';
import test from 'node:test';
import { MachineAuthService } from './machine-auth.service.js';
import { enrollmentFixture, enrollmentFault } from './enrollment.fixture.js';

test('concurrent identical enrollment creates one machine and restores the exact original receipt', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(), context = await h.authenticate(issued.code), input = h.consumeInput(issued.enrollmentId);
    const [first, retry] = await Promise.all([h.repository().consume(context, input), h.repository().consume(context, input)]);
    assert.deepEqual(first, retry);
    assert.equal(first.approvedRole, 'runtime');
    assert.deepEqual(await h.counts(), { agents: 1, machines: 1, consumed: 1, audits: 1 });
    const machine = await new MachineAuthService(h.db).authenticate('machine', `Bearer ${input.machineCredential}`);
    assert.equal(machine.kind, 'machine');
    const saved = await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: issued.enrollmentId } });
    const serialized = JSON.stringify([saved, first, await h.db.audit.findMany()]);
    assert(!serialized.includes(issued.code)); assert(!serialized.includes(input.machineCredential));
    await assert.rejects(h.repository().consume(context, { ...input, attemptId: h.consumeInput(issued.enrollmentId).attemptId }), enrollmentFault('REGISTRATION_CONFLICT'));
    assert.deepEqual(await h.counts(), { agents: 1, machines: 1, consumed: 1, audits: 1 });
  } finally { await h.dispose(); }
});

test('a competing attempt loses atomically without orphan actors or duplicate audits', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(), context = await h.authenticate(issued.code);
    const result = await Promise.allSettled([h.repository().consume(context, h.consumeInput(issued.enrollmentId)),
      h.repository().consume(context, h.consumeInput(issued.enrollmentId))]);
    assert.equal(result.filter(value => value.status === 'fulfilled').length, 1);
    const failure = result.find(value => value.status === 'rejected');
    assert(failure?.status === 'rejected'); assert(enrollmentFault('REGISTRATION_CONFLICT')(failure.reason));
    assert.deepEqual(await h.counts(), { agents: 1, machines: 1, consumed: 1, audits: 1 });
  } finally { await h.dispose(); }
});

test('a mid-transaction expiry rolls back provisional identity and leaves the code unconsumed', async () => {
  const h = await enrollmentFixture();
  try {
    const issued = await h.issue(1), context = await h.authenticate(issued.code), input = h.consumeInput(issued.enrollmentId);
    let samples = 0;
    const repository = h.repository(() => new Date(h.now.getTime() + (samples++ === 0 ? 0 : 1000)));
    await assert.rejects(repository.consume(context, input), enrollmentFault('REGISTRATION_EXPIRED'));
    assert.deepEqual(await h.counts(), { agents: 0, machines: 0, consumed: 0, audits: 0 });
    assert.equal((await h.db.agentEnrollment.findUniqueOrThrow({ where: { id: issued.enrollmentId } })).attemptId, null);
  } finally { await h.dispose(); }
});
