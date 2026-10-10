import { setImmediate as immediate } from 'node:timers/promises';
import type { RegistrationIdentity, RegisteredIdentity } from './identity-contracts.js';
import type { RegistrationClientOptions, RegistrationClientStatus, RegistrationRequester } from './client-contracts.js';
import type { RegistrationRequest, RegistrationReceipt } from './request-contracts.js';
import { parseRegistrationIdentityFile } from './identity-schema.js';
import { RegistrationRequestError } from './request-errors.js';
import { RegistrationClientFailure } from './status.js';
import { ENROLL_RECEIPT, ENROLL_SECRET, MACHINE_SECRET, UUID, STATUS, enrollment, SESSION_RECEIPT,
  HEARTBEAT_RECEIPT } from './request-fixture.js';

export const CLIENT_ORIGIN = 'https://registration.example';
export function pendingIdentity(): RegistrationIdentity {
  return parseRegistrationIdentityFile({ v: 1, state: 'pending', serverOrigin: CLIENT_ORIGIN,
    enrollmentCode: ENROLL_SECRET, request: enrollment(CLIENT_ORIGIN).dto });
}
export function registeredIdentity(): RegisteredIdentity {
  return parseRegistrationIdentityFile({ v: 1, state: 'registered', serverOrigin: CLIENT_ORIGIN,
    machineCredential: MACHINE_SECRET, receipt: ENROLL_RECEIPT }) as RegisteredIdentity;
}
export function reply(request: RegistrationRequest, epoch = 1): RegistrationReceipt {
  if (request.phase === 'enroll') return { ...ENROLL_RECEIPT, incarnation: request.dto.incarnation };
  if (request.phase === 'session') return { ...SESSION_RECEIPT, epoch };
  return { ...HEARTBEAT_RECEIPT, epoch: request.dto.epoch, sequence: request.dto.sequence };
}
export function httpFailure(code = 'REGISTRATION_UNAUTHORIZED', status = 401): RegistrationRequestError {
  return new RegistrationRequestError('REGISTRATION_HTTP_REJECTED', status, code);
}
export function clientFixture(initial: RegistrationIdentity = registeredIdentity()) {
  const controller = new AbortController(), events: RegistrationClientStatus[] = [], requests: RegistrationRequest[] = [], waits: number[] = [];
  let identity = initial, saves = 0, statuses = 0, active = 0, maxActive = 0, now = 0;
  const fixture = {
    controller, events, requests, waits,
    get identity() { return identity; }, set identity(value: RegistrationIdentity) { identity = value; },
    get saves() { return saves; }, get statuses() { return statuses; }, get maxActive() { return maxActive; },
    handler: (async () => { throw httpFailure(); }) as RegistrationRequester,
    options: {} as RegistrationClientOptions,
  };
  fixture.options = {
    config: { mode: 'persistent', serverOrigin: CLIENT_ORIGIN }, signal: controller.signal, bootId: UUID,
    store: { current: () => identity, complete: async receipt => {
      saves++; if (identity.state !== 'pending') throw new Error('unexpected repeated identity save');
      identity = parseRegistrationIdentityFile({ v: 1, state: 'registered', serverOrigin: identity.serverOrigin,
        machineCredential: identity.request.machineCredential, receipt }); return identity as RegisteredIdentity;
    } },
    status: async () => ({ ...STATUS, version: `0.0.${++statuses}` }), onStatus: event => events.push(event),
    request: async request => {
      requests.push(request); active++; maxActive = Math.max(maxActive, active);
      try { return await fixture.handler(request); } finally { active--; }
    },
    clock: { now: () => now, random: () => 0.5, wait: async (milliseconds, signal) => {
      waits.push(milliseconds); await immediate();
      if (signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED'); now += milliseconds;
    } },
  };
  return fixture;
}
