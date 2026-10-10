import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EnrollmentConsumeRequest, AgentSessionOpenRequest, RegistrationProtocolError,
  generateEnrollmentSecret, generateMachineSecret, parseEnrollmentSecret, parseMachineSecret,
  hashEnrollmentSecret, hashMachineSecret, parseEnrollmentConsumeRequest, parseAgentSessionOpenRequest,
  parseAgentHeartbeatRequest, parseRegistrationStatus, parseRegistrationIdentity, parseRegistrationCounter,
  enrollmentRequestHash, sessionOpenRequestHash, heartbeatRequestHash, REGISTRATION_COUNTER_MAX,
  REGISTRATION_HEARTBEAT_INTERVAL_MS, REGISTRATION_SUSPECT_AFTER_MS, REGISTRATION_LEASE_MS,
  REGISTRATION_ENROLLMENT_TTL_MS, REGISTRATION_RECOVERY_TTL_MS } from './registration-protocol.js';

const status = () => ({ reportedRole: 'runtime' as const, version: '0.5.0', docker: true,
  capabilities: ['jobs-events-v1', 'jobs-operation-v1'] });
const open = (): AgentSessionOpenRequest => ({ v: 1, agentId: randomUUID(), incarnation: randomUUID(), bootId: randomUUID(), status: status() });
const enrollment = (): EnrollmentConsumeRequest => ({ v: 1, enrollmentId: randomUUID(), attemptId: randomUUID(),
  incarnation: randomUUID(), machineCredential: generateMachineSecret(), reportedRole: 'builder',
  metadata: { version: '0.5.0', docker: true, capabilities: ['jobs-events-v1'] } });
const rejects = (run: () => unknown) => assert.throws(run, RegistrationProtocolError);

test('secret generation is canonical, prefix-bound and domain separated; a hash is never a bearer', () => {
  const first = generateEnrollmentSecret(), second = generateEnrollmentSecret(), machine = generateMachineSecret();
  assert.notEqual(first, second); assert.equal(parseEnrollmentSecret(first), first); assert.equal(parseMachineSecret(machine), machine);
  assert.match(hashEnrollmentSecret(first), /^[0-9a-f]{64}$/);
  const sameBytes = first.replace('ska_enroll_', 'ska_machine_');
  assert.notEqual(hashEnrollmentSecret(first), hashMachineSecret(sameBytes));
  for (const value of [undefined, null, 12, '', first + '=', first + '\n', hashEnrollmentSecret(first), machine]) {
    rejects(() => parseEnrollmentSecret(value)); rejects(() => hashEnrollmentSecret(value));
  }
  rejects(() => parseMachineSecret(first)); rejects(() => hashMachineSecret(hashMachineSecret(machine)));
});

test('secret parser rejects alternate base64 spelling and invalid trailing bits', () => {
  const canonical = 'ska_machine_' + 'A'.repeat(43);
  assert.equal(parseMachineSecret(canonical), canonical);
  for (const value of ['ska_machine_' + 'A'.repeat(42) + 'B', canonical.replace(/A$/, '+'), canonical.slice(0, -1),
    canonical + 'A', 'ska_machine_' + '0'.repeat(64), 'ska_machine_' + 'A'.repeat(42) + '=']) rejects(() => parseMachineSecret(value));
});

test('UUID and counter gates apply to new registration identity, not arbitrary legacy identifiers', () => {
  assert.equal(parseRegistrationIdentity(open().agentId).length, 36);
  for (const value of ['local', 'local-controller', '00000000-0000-0000-0000-000000000000', ('a' + open().agentId.slice(1)).toUpperCase(), [], null]) {
    rejects(() => parseRegistrationIdentity(value));
  }
  assert.equal(parseRegistrationCounter(REGISTRATION_COUNTER_MAX), REGISTRATION_COUNTER_MAX);
  for (const value of [0, -1, 1.1, NaN, Infinity, '1', 2_147_483_648]) rejects(() => parseRegistrationCounter(value));
});

test('status has bounded unique safe metadata and never accepts execution or approval parameters', () => {
  const source = { ...status(), capabilities: ['z-capability', 'a-capability'] };
  const parsed = parseRegistrationStatus(source);
  assert.deepEqual(parsed.capabilities, ['a-capability', 'z-capability']);
  assert(Object.isFrozen(parsed) && Object.isFrozen(parsed.capabilities));
  source.capabilities.push('new-capability'); assert.equal(parsed.capabilities.length, 2);
  for (const patch of [{ reportedRole: 'admin' }, { version: '' }, { version: 'x'.repeat(65) }, { version: 'ok\ncommand' },
    { version: 'ok\u0000' }, { docker: 'true' }, { capabilities: 'jobs-events-v1' }, { capabilities: Array(17).fill('a') },
    { capabilities: ['a', 'a'] }, { capabilities: ['http://example.test'] }, { capabilities: ['../bin'] },
    { capabilities: ['$(whoami)'] }, { capabilities: ['a'.repeat(49)] }, { capabilities: [1] }]) {
    rejects(() => parseRegistrationStatus({ ...status(), ...patch }));
  }
  for (const field of ['url', 'path', 'shell', 'approvedRole', 'executionReady', 'actorId', 'workspaceId']) {
    rejects(() => parseRegistrationStatus({ ...status(), [field]: 'untrusted' }));
  }
});

test('enrollment DTO freezes candidate proof and metadata with strict v1 shape', () => {
  const value = enrollment(), parsed = parseEnrollmentConsumeRequest(value);
  assert.deepEqual(parsed, value); assert(Object.isFrozen(parsed) && Object.isFrozen(parsed.metadata));
  for (const patch of [{ v: 2 }, { approvedRole: 'both' }, { workspaceId: 'local' }, { resourceKind: 'temporary' },
    { machineCredential: hashMachineSecret(value.machineCredential) }, { reportedRole: 'admin' },
    { metadata: { ...value.metadata, url: 'https://example.test' } }, { metadata: null }, { attemptId: 'local' }]) {
    rejects(() => parseEnrollmentConsumeRequest({ ...value, ...patch }));
  }
  const missing = { ...value } as Record<string, unknown>; delete missing.metadata;
  rejects(() => parseEnrollmentConsumeRequest(missing));
});

test('session requires a frozen status; heartbeat requires exact positive sequence and epoch', () => {
  const value = open(), heartbeat = { ...value, epoch: 1, sequence: 1 };
  assert.deepEqual(parseAgentSessionOpenRequest(value), value); assert.deepEqual(parseAgentHeartbeatRequest(heartbeat), heartbeat);
  for (const patch of [{ status: undefined }, { v: '1' }, { epoch: 1 }, { agentId: 'legacy-endpoint-hash' }, { status: { ...status(), secret: 'no' } }]) {
    rejects(() => parseAgentSessionOpenRequest({ ...value, ...patch }));
  }
  for (const patch of [{ epoch: 0 }, { sequence: 0 }, { sequence: '1' }, { sequence: REGISTRATION_COUNTER_MAX + 1 }, { approvedRole: 'both' }]) {
    rejects(() => parseAgentHeartbeatRequest({ ...heartbeat, ...patch }));
  }
});

test('prototype inheritance and non-JSON object shapes cannot smuggle DTO fields', () => {
  const value = open();
  for (const input of [[], null, new Date(), Object.create(value), { ...value, [Symbol('unknown')]: true }]) {
    rejects(() => parseAgentSessionOpenRequest(input));
  }
  const dictionary = Object.assign(Object.create(null), value);
  assert.deepEqual(parseAgentSessionOpenRequest(dictionary), value);
});

test('attempt digest binds candidate identity and all enrollment metadata', () => {
  const value = enrollment(), original = enrollmentRequestHash(value);
  assert.equal(enrollmentRequestHash(Object.fromEntries(Object.entries(value).reverse())), original);
  for (const patch of [{ attemptId: randomUUID() }, { incarnation: randomUUID() }, { enrollmentId: randomUUID() },
    { machineCredential: generateMachineSecret() }, { reportedRole: 'runtime' },
    { metadata: { ...value.metadata, version: '0.6.0' } }, { metadata: { ...value.metadata, docker: false } },
    { metadata: { ...value.metadata, capabilities: ['new-capability'] } }]) {
    assert.notEqual(enrollmentRequestHash({ ...value, ...patch }), original);
  }
});

test('open digest binds opening status independently of later heartbeat updates; capabilities are a set', () => {
  const value = open(), original = sessionOpenRequestHash(value);
  assert.equal(sessionOpenRequestHash({ ...value, status: { ...value.status, capabilities: [...value.status.capabilities].reverse() } }), original);
  for (const patch of [{ bootId: randomUUID() }, { incarnation: randomUUID() }, { agentId: randomUUID() },
    { status: { ...value.status, docker: false } }, { status: { ...value.status, reportedRole: 'both' } }]) {
    assert.notEqual(sessionOpenRequestHash({ ...value, ...patch }), original);
  }
  const heartbeat = { ...value, epoch: 1, sequence: 1 };
  assert.notEqual(heartbeatRequestHash(heartbeat), original);
  assert.notEqual(heartbeatRequestHash({ ...heartbeat, sequence: 2 }), heartbeatRequestHash(heartbeat));
  assert.notEqual(heartbeatRequestHash({ ...heartbeat, epoch: 2 }), heartbeatRequestHash(heartbeat));
  assert.equal(sessionOpenRequestHash(value), original);
});

test('default leases and independent recovery period are explicit protocol constants', () => {
  assert.deepEqual([REGISTRATION_HEARTBEAT_INTERVAL_MS, REGISTRATION_SUSPECT_AFTER_MS, REGISTRATION_LEASE_MS], [15_000, 45_000, 90_000]);
  assert.equal(REGISTRATION_ENROLLMENT_TTL_MS, 900_000); assert.equal(REGISTRATION_RECOVERY_TTL_MS, 900_000);
});
