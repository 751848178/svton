import type { EnrollmentConsumeRequest, EnrollmentReceipt, RegistrationStatus } from '../../shared/registration-contracts.js';

export interface DisabledRegistrationConfig { readonly mode: 'disabled' }
export interface PersistentRegistrationConfig {
  readonly mode: 'persistent';
  readonly serverOrigin: string;
  readonly caFile?: string;
  readonly enrollmentFile?: string;
  readonly allowLegacyEnrollment?: boolean;
}
export type RegistrationConfig = DisabledRegistrationConfig | PersistentRegistrationConfig;
export interface PendingRegistrationIdentity {
  readonly v: 1;
  readonly state: 'pending';
  readonly serverOrigin: string;
  readonly enrollmentCode: string;
  readonly request: EnrollmentConsumeRequest;
}
export interface RegisteredIdentity {
  readonly v: 1;
  readonly state: 'registered';
  readonly serverOrigin: string;
  readonly machineCredential: string;
  readonly receipt: EnrollmentReceipt;
}
export type RegistrationIdentity = PendingRegistrationIdentity | RegisteredIdentity;
export interface RegistrationIdentityOptions {
  readonly initialStatus?: RegistrationStatus;
  readonly lockTimeoutMs?: number;
}
export interface EnrollmentInput { readonly v: 1; readonly enrollmentId: string; readonly code: string }
export interface LedgerAnchor { readonly v: 1; readonly incarnation: string }
