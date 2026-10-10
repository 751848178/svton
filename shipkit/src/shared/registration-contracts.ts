import type { AgentRole } from './types.js';
export type { AgentRole } from './types.js';

export const REGISTRATION_VERSION = 1;
export const REGISTRATION_COUNTER_MAX = 2_147_483_647;
export const REGISTRATION_HEARTBEAT_INTERVAL_MS = 15_000;
export const REGISTRATION_SUSPECT_AFTER_MS = 45_000;
export const REGISTRATION_LEASE_MS = 90_000;
export const REGISTRATION_ENROLLMENT_TTL_MS = 15 * 60_000;
export const REGISTRATION_RECOVERY_TTL_MS = 15 * 60_000;

export interface RegistrationMetadata {
  readonly version: string;
  readonly docker: boolean;
  readonly capabilities: readonly string[];
}
export interface RegistrationStatus extends RegistrationMetadata {
  readonly reportedRole: AgentRole;
}
export interface EnrollmentConsumeRequest {
  readonly v: 1;
  readonly enrollmentId: string;
  readonly attemptId: string;
  readonly incarnation: string;
  readonly machineCredential: string;
  readonly reportedRole: AgentRole;
  readonly metadata: RegistrationMetadata;
}
export interface EnrollmentReceipt {
  readonly v: 1;
  readonly agentId: string;
  readonly incarnation: string;
  readonly approvedRole: AgentRole;
  readonly resourceKind: 'persistent';
  readonly credentialRevision: number;
  readonly trustRevision: number;
}
export interface AgentSessionOpenRequest {
  readonly v: 1;
  readonly agentId: string;
  readonly incarnation: string;
  readonly bootId: string;
  readonly status: RegistrationStatus;
}
export interface AgentSessionOpenReceipt {
  readonly v: 1;
  readonly epoch: number;
  readonly lastSequence: number;
  readonly leaseExpiresAt: string;
  readonly heartbeatIntervalMs: 15_000;
}
export interface AgentHeartbeatRequest extends AgentSessionOpenRequest {
  readonly epoch: number;
  readonly sequence: number;
}
export interface AgentHeartbeatReceipt {
  readonly v: 1;
  readonly epoch: number;
  readonly sequence: number;
  readonly acceptedAt: string;
  readonly leaseExpiresAt: string;
}
