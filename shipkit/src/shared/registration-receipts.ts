import { REGISTRATION_HEARTBEAT_INTERVAL_MS, type EnrollmentReceipt,
  type AgentSessionOpenReceipt, type AgentHeartbeatReceipt } from './registration-contracts.js';
import { RegistrationProtocolError, registrationRecord, parseRegistrationIdentifier,
  parseRegistrationCounter, parseRegistrationRole } from './registration-validation.js';

function iso(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new RegistrationProtocolError();
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new RegistrationProtocolError();
  return value;
}
function version(value: Record<string, unknown>): void {
  if (value.v !== 1) throw new RegistrationProtocolError();
}
export function parseEnrollmentReceipt(input: unknown): EnrollmentReceipt {
  const value = registrationRecord(input, ['v', 'agentId', 'incarnation', 'approvedRole', 'resourceKind', 'credentialRevision', 'trustRevision']);
  version(value);
  if (value.resourceKind !== 'persistent') throw new RegistrationProtocolError();
  return Object.freeze({ v: 1, agentId: parseRegistrationIdentifier(value.agentId), incarnation: parseRegistrationIdentifier(value.incarnation),
    approvedRole: parseRegistrationRole(value.approvedRole), resourceKind: 'persistent',
    credentialRevision: parseRegistrationCounter(value.credentialRevision), trustRevision: parseRegistrationCounter(value.trustRevision) });
}
export function parseAgentSessionOpenReceipt(input: unknown): AgentSessionOpenReceipt {
  const value = registrationRecord(input, ['v', 'epoch', 'lastSequence', 'leaseExpiresAt', 'heartbeatIntervalMs']);
  version(value);
  if (value.heartbeatIntervalMs !== REGISTRATION_HEARTBEAT_INTERVAL_MS) throw new RegistrationProtocolError();
  return Object.freeze({ v: 1, epoch: parseRegistrationCounter(value.epoch), lastSequence: value.lastSequence === 0 ? 0 : parseRegistrationCounter(value.lastSequence),
    leaseExpiresAt: iso(value.leaseExpiresAt), heartbeatIntervalMs: REGISTRATION_HEARTBEAT_INTERVAL_MS });
}
export function parseAgentHeartbeatReceipt(input: unknown): AgentHeartbeatReceipt {
  const value = registrationRecord(input, ['v', 'epoch', 'sequence', 'acceptedAt', 'leaseExpiresAt']);
  version(value);
  return Object.freeze({ v: 1, epoch: parseRegistrationCounter(value.epoch), sequence: parseRegistrationCounter(value.sequence),
    acceptedAt: iso(value.acceptedAt), leaseExpiresAt: iso(value.leaseExpiresAt) });
}
