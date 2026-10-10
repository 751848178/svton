import type { AgentHeartbeatReceipt, AgentHeartbeatRequest, AgentSessionOpenReceipt,
  AgentSessionOpenRequest, EnrollmentConsumeRequest, EnrollmentReceipt } from '../../shared/registration-contracts.js';

export const REGISTRATION_REQUEST_BYTES = 8_192;
export const REGISTRATION_RESPONSE_BYTES = 16_384;
export const REGISTRATION_RESPONSE_HEADER_BYTES = 4_096;
export const REGISTRATION_REQUEST_DEADLINE_MS = 10_000;
export const REGISTRATION_REQUEST_MAX_DEADLINE_MS = 30_000;

export interface RegistrationConnection {
  readonly serverOrigin: string;
  readonly caFile?: string;
  readonly credential: string;
  readonly signal?: AbortSignal;
  /** One deadline for trust loading, DNS, TCP, TLS and the complete response. */
  readonly deadlineMs?: number;
}
export interface EnrollmentRegistrationRequest extends RegistrationConnection {
  readonly phase: 'enroll';
  readonly dto: EnrollmentConsumeRequest;
}
export interface SessionRegistrationRequest extends RegistrationConnection {
  readonly phase: 'session';
  readonly dto: AgentSessionOpenRequest;
}
export interface HeartbeatRegistrationRequest extends RegistrationConnection {
  readonly phase: 'heartbeat';
  readonly dto: AgentHeartbeatRequest;
}
export type RegistrationRequest = EnrollmentRegistrationRequest | SessionRegistrationRequest | HeartbeatRegistrationRequest;
export type RegistrationReceipt = EnrollmentReceipt | AgentSessionOpenReceipt | AgentHeartbeatReceipt;
