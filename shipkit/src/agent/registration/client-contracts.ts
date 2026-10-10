import type { RegistrationStatus } from '../../shared/registration-contracts.js';
import type { PersistentRegistrationConfig, RegisteredIdentity } from './identity-contracts.js';
import type { RegistrationIdentityStore } from './identity-store.js';
import type { RegistrationReceipt, RegistrationRequest } from './request-contracts.js';

export type RegistrationClientPhase = 'enroll' | 'session' | 'heartbeat';
export interface RegistrationClientStatus {
  readonly state: 'enrolling' | 'registered' | 'opening' | 'online' | 'retrying' | 'stopped';
  readonly phase?: RegistrationClientPhase;
  readonly code?: string;
  readonly remoteCode?: string;
}
export interface RegistrationClientClock {
  now(): number;
  wait(milliseconds: number, signal: AbortSignal): Promise<void>;
  random(): number;
}
export type RegistrationRequester = (request: RegistrationRequest) => Promise<RegistrationReceipt>;
export interface RegistrationClientOptions {
  readonly config: PersistentRegistrationConfig;
  readonly store: RegistrationIdentityStore;
  readonly status: (signal: AbortSignal) => Promise<RegistrationStatus>;
  readonly signal: AbortSignal;
  readonly onStatus?: (status: RegistrationClientStatus) => void;
  /** Injection seams for deterministic fault schedules; production creates a fresh UUID. */
  readonly bootId?: string;
  readonly request?: RegistrationRequester;
  readonly clock?: RegistrationClientClock;
}
export interface RegistrationClientContext {
  readonly options: RegistrationClientOptions;
  readonly bootId: string;
  readonly request: RegistrationRequester;
  readonly clock: RegistrationClientClock;
  emit(status: RegistrationClientStatus): void;
}
export interface RegistrationClientSession {
  readonly identity: RegisteredIdentity;
  readonly epoch: number;
  readonly lastSequence: number;
  readonly intervalMs: number;
}
