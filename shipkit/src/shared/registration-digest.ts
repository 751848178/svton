import { createHash, randomBytes } from 'node:crypto';
import { parseEnrollmentSecret, parseMachineSecret, parseEnrollmentConsumeRequest,
  parseAgentSessionOpenRequest, parseAgentHeartbeatRequest } from './registration-validation.js';
import type { RegistrationMetadata, RegistrationStatus } from './registration-contracts.js';

const digest = (domain: string, value: string): string => createHash('sha256')
  .update(`shipkit:agent-registration:v1:${domain}\0`).update(value).digest('hex');
export const generateEnrollmentSecret = (): string => `ska_enroll_${randomBytes(32).toString('base64url')}`;
export const generateMachineSecret = (): string => `ska_machine_${randomBytes(32).toString('base64url')}`;
export const hashEnrollmentSecret = (input: unknown): string => digest('enrollment-secret', parseEnrollmentSecret(input));
export const hashMachineSecret = (input: unknown): string => digest('machine-secret', parseMachineSecret(input));
const metadata = (value: RegistrationMetadata): unknown[] => [value.version, value.docker, value.capabilities];
const status = (value: RegistrationStatus): unknown[] => [value.reportedRole, ...metadata(value)];

/** Only the candidate proof hash enters the durable attempt digest, never the raw secret. */
export function enrollmentRequestHash(input: unknown): string {
  const value = parseEnrollmentConsumeRequest(input);
  return digest('enrollment-request', JSON.stringify([value.v, value.enrollmentId, value.attemptId,
    value.incarnation, hashMachineSecret(value.machineCredential), value.reportedRole, ...metadata(value.metadata)]));
}
/** Frozen opening metadata is distinct from the subsequent heartbeat status. */
export function sessionOpenRequestHash(input: unknown): string {
  const value = parseAgentSessionOpenRequest(input);
  return digest('session-open-request', JSON.stringify([value.v, value.agentId, value.incarnation, value.bootId, ...status(value.status)]));
}
export function heartbeatRequestHash(input: unknown): string {
  const value = parseAgentHeartbeatRequest(input);
  return digest('heartbeat-request', JSON.stringify([value.v, value.agentId, value.incarnation, value.bootId,
    value.epoch, value.sequence, ...status(value.status)]));
}
