import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RegistrationProtocolError, parseEnrollmentReceipt, parseAgentSessionOpenReceipt,
  parseAgentHeartbeatReceipt, parseRegistrationIdentifier } from './registration-protocol.js';

const enrolled = () => ({ v: 1, agentId: randomUUID(), incarnation: randomUUID(), approvedRole: 'runtime',
  resourceKind: 'persistent', credentialRevision: 1, trustRevision: 1 });
const opened = () => ({ v: 1, epoch: 1, lastSequence: 0, leaseExpiresAt: '2026-10-10T12:00:00.000Z', heartbeatIntervalMs: 15_000 });
const heartbeat = () => ({ v: 1, epoch: 1, sequence: 1, acceptedAt: '2026-10-10T11:58:30.000Z', leaseExpiresAt: '2026-10-10T12:00:00.000Z' });

test('durable receipts have exact v1 public fields and exclude all proof material', () => {
  for (const [parse, value] of [[parseEnrollmentReceipt, enrolled()], [parseAgentSessionOpenReceipt, opened()],
    [parseAgentHeartbeatReceipt, heartbeat()]] as const) {
    assert.deepEqual(parse(value), value); assert(Object.isFrozen(parse(value)));
    for (const field of ['token', 'credentialHash', 'secret', 'workspaceId', 'actorId', 'approved']) {
      assert.throws(() => parse({ ...value, [field]: 'unsafe' }), RegistrationProtocolError);
    }
    assert.throws(() => parse({ ...value, v: 2 }), RegistrationProtocolError);
    const missing = { ...value } as Record<string, unknown>; delete missing.v;
    assert.throws(() => parse(missing), RegistrationProtocolError);
  }
});

test('enrollment receipt rejects legacy IDs, temporary kind and invalid trusted counters or role', () => {
  const value = enrolled(); assert.equal(parseRegistrationIdentifier(value.agentId), value.agentId);
  for (const patch of [{ agentId: 'local-controller' }, { incarnation: null }, { approvedRole: 'admin' },
    { resourceKind: 'temporary' }, { credentialRevision: 0 }, { trustRevision: '1' }, { trustRevision: 2_147_483_648 }]) {
    assert.throws(() => parseEnrollmentReceipt({ ...value, ...patch }), RegistrationProtocolError);
  }
});

test('session receipts accept seq0 but reject malformed epochs, sequence and heartbeat cadence', () => {
  for (const patch of [{ epoch: 0 }, { lastSequence: -1 }, { lastSequence: '0' }, { lastSequence: NaN },
    { heartbeatIntervalMs: 1 }, { heartbeatIntervalMs: '15000' }]) {
    assert.throws(() => parseAgentSessionOpenReceipt({ ...opened(), ...patch }), RegistrationProtocolError);
  }
  assert.equal(parseAgentSessionOpenReceipt({ ...opened(), lastSequence: 2_147_483_647 }).lastSequence, 2_147_483_647);
  assert.throws(() => parseAgentHeartbeatReceipt({ ...heartbeat(), sequence: 0 }), RegistrationProtocolError);
});

test('receipt timestamps must be real canonical UTC milliseconds, not alternate or normalized dates', () => {
  for (const value of ['2026-10-10', '2026-10-10T12:00:00Z', '2026-10-10T12:00:00.000+00:00',
    '2026-02-30T12:00:00.000Z', '2026-10-10T25:00:00.000Z', new Date(), null]) {
    assert.throws(() => parseAgentSessionOpenReceipt({ ...opened(), leaseExpiresAt: value }), RegistrationProtocolError);
    assert.throws(() => parseAgentHeartbeatReceipt({ ...heartbeat(), acceptedAt: value }), RegistrationProtocolError);
  }
});
