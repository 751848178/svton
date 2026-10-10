import type { AgentRole } from './types.js';
import { REGISTRATION_COUNTER_MAX, type AgentHeartbeatRequest, type AgentSessionOpenRequest,
  type EnrollmentConsumeRequest, type RegistrationMetadata, type RegistrationStatus } from './registration-contracts.js';

export class RegistrationProtocolError extends Error {
  readonly code = 'INVALID_REGISTRATION_PROTOCOL';
  constructor() { super('注册协议输入无效'); this.name = 'RegistrationProtocolError'; }
}
const invalid = (): never => { throw new RegistrationProtocolError(); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function registrationRecord(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const value = input as Record<string, unknown>;
  if (Reflect.ownKeys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) return invalid();
  return value;
}
export function parseRegistrationIdentity(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) return invalid();
  return value;
}
export const parseRegistrationIdentifier = parseRegistrationIdentity;
export function parseRegistrationCounter(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > REGISTRATION_COUNTER_MAX) return invalid();
  return value as number;
}
export function parseRegistrationRole(value: unknown): AgentRole {
  if (value !== 'builder' && value !== 'runtime' && value !== 'both') return invalid();
  return value;
}
function metadata(value: Record<string, unknown>): RegistrationMetadata {
  if (typeof value.version !== 'string' || !value.version.length || value.version.length > 64
    || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value.version) || typeof value.docker !== 'boolean') return invalid();
  if (!Array.isArray(value.capabilities) || value.capabilities.length > 16) return invalid();
  const capabilities = value.capabilities;
  if (capabilities.some(item => typeof item !== 'string' || !/^[a-z][a-z0-9._-]{0,47}$/.test(item))
    || new Set(capabilities).size !== capabilities.length) return invalid();
  return Object.freeze({ version: value.version, docker: value.docker, capabilities: Object.freeze([...capabilities].sort()) });
}
export function parseRegistrationMetadata(input: unknown): RegistrationMetadata {
  return metadata(registrationRecord(input, ['version', 'docker', 'capabilities']));
}
export function parseRegistrationStatus(input: unknown): RegistrationStatus {
  const value = registrationRecord(input, ['reportedRole', 'version', 'docker', 'capabilities']);
  return Object.freeze({ ...metadata(value), reportedRole: parseRegistrationRole(value.reportedRole) });
}
function secret(input: unknown, prefix: string): string {
  if (typeof input !== 'string' || !input.startsWith(prefix)) return invalid();
  const encoded = input.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) return invalid();
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== encoded) return invalid();
  return input;
}
export const parseEnrollmentSecret = (input: unknown): string => secret(input, 'ska_enroll_');
export const parseMachineSecret = (input: unknown): string => secret(input, 'ska_machine_');

export function parseEnrollmentConsumeRequest(input: unknown): EnrollmentConsumeRequest {
  const value = registrationRecord(input, ['v', 'enrollmentId', 'attemptId', 'incarnation', 'machineCredential', 'reportedRole', 'metadata']);
  if (value.v !== 1) return invalid();
  return Object.freeze({ v: 1, enrollmentId: parseRegistrationIdentity(value.enrollmentId),
    attemptId: parseRegistrationIdentity(value.attemptId), incarnation: parseRegistrationIdentity(value.incarnation),
    machineCredential: parseMachineSecret(value.machineCredential), reportedRole: parseRegistrationRole(value.reportedRole),
    metadata: parseRegistrationMetadata(value.metadata) });
}
function sessionIdentity(value: Record<string, unknown>): AgentSessionOpenRequest {
  if (value.v !== 1) return invalid();
  return { v: 1, agentId: parseRegistrationIdentity(value.agentId), incarnation: parseRegistrationIdentity(value.incarnation),
    bootId: parseRegistrationIdentity(value.bootId), status: parseRegistrationStatus(value.status) };
}
export function parseAgentSessionOpenRequest(input: unknown): AgentSessionOpenRequest {
  return Object.freeze(sessionIdentity(registrationRecord(input, ['v', 'agentId', 'incarnation', 'bootId', 'status'])));
}
export function parseAgentHeartbeatRequest(input: unknown): AgentHeartbeatRequest {
  const value = registrationRecord(input, ['v', 'agentId', 'incarnation', 'bootId', 'status', 'epoch', 'sequence']);
  return Object.freeze({ ...sessionIdentity(value), epoch: parseRegistrationCounter(value.epoch),
    sequence: parseRegistrationCounter(value.sequence) });
}
