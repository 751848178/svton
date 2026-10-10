import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEventListeners } from 'node:events';
import { runRegistrationClient } from './client.js';
import { waitForRegistration } from './retry.js';
import { RegistrationRequestError } from './request-errors.js';
import { clientFixture, reply, httpFailure } from './client-fixture.js';
import { ENROLL_SECRET, MACHINE_SECRET } from './request-fixture.js';

test('credentials/TLS/CA/sequence/clock/counter/protocol errors stop once and redact untrusted errors', async () => {
  const errors = [httpFailure(), httpFailure(undefined, 403), httpFailure('AGENT_SEQUENCE_CONFLICT', 409),
    httpFailure('AGENT_CLOCK_INVALID', 409), httpFailure('AGENT_COUNTER_EXHAUSTED', 409),
    new RegistrationRequestError('REGISTRATION_TLS_FAILED'), new RegistrationRequestError('REGISTRATION_CA_INVALID'),
    new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID'), new RegistrationRequestError('REGISTRATION_RESPONSE_LIMIT'),
    new Error(`${ENROLL_SECRET} ${MACHINE_SECRET}`), new RegistrationRequestError(MACHINE_SECRET as never, 500, MACHINE_SECRET)];
  for (const error of errors) {
    const fixture = clientFixture(); fixture.handler = async () => { throw error; };
    await runRegistrationClient(fixture.options);
    assert.equal(fixture.requests.length, 1); assert.equal(fixture.waits.length, 0); assert.equal(fixture.saves, 0);
    assert.equal(fixture.events.at(-1)?.state, 'stopped');
    for (const secret of [ENROLL_SECRET, MACHINE_SECRET]) assert.equal(JSON.stringify(fixture.events).includes(secret), false);
  }
});
test('local identity change during retry stops before another bearer request', async () => {
  const fixture = clientFixture(); const previous = fixture.options.clock!;
  fixture.handler = async () => { throw new RegistrationRequestError('REGISTRATION_CONNECTION_FAILED'); };
  await runRegistrationClient({ ...fixture.options, clock: { ...previous, wait: async (ms, signal) => {
    fixture.identity = { ...fixture.identity, machineCredential: `ska_machine_${Buffer.alloc(32, 21).toString('base64url')}` } as typeof fixture.identity;
    return previous.wait(ms, signal);
  } } });
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.events.at(-1)?.code, 'REGISTRATION_CLIENT_IDENTITY_CHANGED');
});
test('purpose capabilities stay bounded independently of sixteen legacy execution capabilities', async () => {
  const fixture = clientFixture(); fixture.handler = async () => { throw httpFailure(); };
  await runRegistrationClient({ ...fixture.options, status: async () => ({ reportedRole: 'both', version: '0.0.1',
    docker: false, capabilities: Array.from({ length: 16 }, (_, i) => `legacy-${i}`) }) });
  const request = fixture.requests[0]!; assert.equal(request.phase, 'session');
  if (request.phase === 'session') {
    assert.deepEqual(request.dto.status.capabilities, ['builder', 'registration-heartbeat-v1', 'runtime']);
    assert.equal(request.dto.status.docker, false);
  }
});
test('abort before start and during an in-flight request stops without late session or heartbeat', async () => {
  const fixture = clientFixture(); fixture.controller.abort(new Error(MACHINE_SECRET));
  await runRegistrationClient(fixture.options); assert.equal(fixture.requests.length, 0); assert.equal(fixture.statuses, 0);
  const active = clientFixture(); let release!: () => void;
  active.handler = async request => { await new Promise<void>(resolve => { release = resolve; }); return reply(request); };
  const running = runRegistrationClient(active.options);
  await new Promise<void>(resolve => setImmediate(resolve)); active.controller.abort(); await running;
  release(); await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(active.requests.length, 1); assert.equal(active.events.at(-1)?.code, 'REGISTRATION_CLIENT_ABORTED');
  assert.equal(getEventListeners(active.controller.signal, 'abort').length, 0);
});
test('abort cancels a real retry timer and removes owned AbortSignal listeners', async () => {
  const controller = new AbortController(), before = process.getActiveResourcesInfo().filter(name => name === 'Timeout').length;
  const waiting = waitForRegistration(30_000, controller.signal); controller.abort(new Error(ENROLL_SECRET));
  await assert.rejects(waiting, { code: 'REGISTRATION_CLIENT_ABORTED' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(process.getActiveResourcesInfo().filter(name => name === 'Timeout').length, before);
});
test('malformed receipts and untrusted observer exceptions never continue or reveal response data', async () => {
  const fixture = clientFixture(); fixture.handler = async request => ({ ...reply(request), secret: MACHINE_SECRET }) as never;
  await runRegistrationClient({ ...fixture.options, onStatus: event => { fixture.events.push(event); throw new Error(ENROLL_SECRET); } });
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.waits.length, 0);
  assert.equal(fixture.events.at(-1)?.code, 'REGISTRATION_RESPONSE_INVALID');
  assert.equal(JSON.stringify(fixture.events).includes(MACHINE_SECRET), false);
  assert.equal(JSON.stringify(fixture.events).includes(ENROLL_SECRET), false);
});
