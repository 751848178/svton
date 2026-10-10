import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRegistrationClient } from './client.js';
import { RegistrationRequestError } from './request-errors.js';
import { clientFixture, pendingIdentity, registeredIdentity, reply, httpFailure } from './client-fixture.js';
import type { HeartbeatRegistrationRequest } from './request-contracts.js';

test('lost consume response retries the exact pending attempt/code/credential before one identity save', async () => {
  const fixture = clientFixture(pendingIdentity()); let enrolls = 0;
  fixture.handler = async request => {
    if (request.phase !== 'enroll') throw httpFailure();
    if (++enrolls === 1) throw new RegistrationRequestError('REGISTRATION_CONNECTION_FAILED'); return reply(request);
  };
  await runRegistrationClient(fixture.options);
  const requests = fixture.requests.filter(request => request.phase === 'enroll');
  assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]); assert.equal(fixture.saves, 1);
  assert.equal(fixture.identity.state, 'registered'); assert.equal(fixture.maxActive, 1);
});
test('lost open response and 409 wait preserve the same boot and frozen open status', async () => {
  const fixture = clientFixture(); let opens = 0;
  fixture.handler = async request => {
    if (request.phase !== 'session') throw httpFailure();
    if (++opens === 1) throw new RegistrationRequestError('REGISTRATION_REQUEST_TIMEOUT');
    if (opens === 2) throw httpFailure('AGENT_SESSION_CONFLICT', 409); return reply(request);
  };
  await runRegistrationClient(fixture.options);
  const requests = fixture.requests.filter(request => request.phase === 'session');
  assert.equal(requests.length, 3); assert.equal(requests[0], requests[1]); assert.equal(requests[1], requests[2]);
  assert.ok(fixture.waits.includes(90_000)); assert.equal(fixture.saves, 0); assert.equal(fixture.maxActive, 1);
});
test('lost heartbeat response retries original sequence/status once before the next sequence', async () => {
  const fixture = clientFixture(); let heartbeats = 0;
  fixture.handler = async request => {
    if (request.phase === 'session') return reply(request);
    if (request.phase !== 'heartbeat') throw new Error('unexpected enrollment');
    heartbeats++; if (heartbeats === 1) throw new RegistrationRequestError('REGISTRATION_CONNECTION_FAILED');
    if (heartbeats === 3) throw httpFailure(); return reply(request);
  };
  await runRegistrationClient(fixture.options);
  const requests = fixture.requests.filter(request => request.phase === 'heartbeat') as HeartbeatRegistrationRequest[];
  assert.deepEqual(requests.map(request => request.dto.sequence), [1, 1, 2]); assert.equal(requests[0], requests[1]);
  assert.equal(fixture.maxActive, 1); assert.equal(fixture.statuses, 3); assert.equal(fixture.saves, 0);
});
test('only expired heartbeat reopens a new epoch with same boot and new frozen open metadata', async () => {
  const fixture = clientFixture(); let epoch = 0;
  fixture.handler = async request => {
    if (request.phase === 'session') return reply(request, ++epoch);
    if (request.phase === 'heartbeat' && request.dto.epoch === 1) throw httpFailure('AGENT_SESSION_EXPIRED', 409);
    throw httpFailure();
  };
  await runRegistrationClient(fixture.options);
  const opens = fixture.requests.filter(request => request.phase === 'session');
  const heartbeats = fixture.requests.filter(request => request.phase === 'heartbeat') as HeartbeatRegistrationRequest[];
  assert.equal(opens.length, 2); assert.equal(opens[0]!.dto.bootId, opens[1]!.dto.bootId);
  assert.notEqual(opens[0]!.dto.status.version, opens[1]!.dto.status.version);
  assert.deepEqual(heartbeats.map(request => [request.dto.epoch, request.dto.sequence]), [[1, 1], [2, 1]]);
});
test('server identity absence after reconstruction stops without reenrolling the registered ledger', async () => {
  const fixture = clientFixture(registeredIdentity()); fixture.handler = async () => { throw httpFailure('AGENT_NOT_FOUND', 404); };
  const before = JSON.stringify(fixture.identity); await runRegistrationClient(fixture.options);
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.requests[0]!.phase, 'session');
  assert.equal(JSON.stringify(fixture.identity), before); assert.equal(fixture.saves, 0);
  assert.equal(fixture.events.at(-1)?.state, 'stopped');
});
test('retry delays stay capped and jittered for network/timeout/5xx/BUSY', async () => {
  const fixture = clientFixture(); let calls = 0;
  fixture.handler = async () => {
    if (++calls === 10) throw httpFailure();
    if (calls % 3 === 0) throw httpFailure('REGISTRATION_BUSY', 503);
    throw new RegistrationRequestError(calls % 2 ? 'REGISTRATION_CONNECTION_FAILED' : 'REGISTRATION_REQUEST_TIMEOUT');
  };
  await runRegistrationClient(fixture.options);
  assert.deepEqual(fixture.waits.slice(0, 4), [750, 1_500, 3_000, 6_000]);
  assert.ok(fixture.waits.every(wait => wait <= 30_000)); assert.equal(fixture.requests.length, 10);
});
