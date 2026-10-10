import type { Request } from 'express';
import type { RegistrationStatus } from 'shipkit/platform';
import { registrationFault } from './fault.js';

type Role = RegistrationStatus['reportedRole'];
interface MachineIdentity {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly approvedRole: Role;
  readonly resourceKind: 'persistent';
}
export interface MachineContext extends MachineIdentity {
  readonly kind: 'machine';
  readonly agentId: string;
  readonly actorId: string;
  readonly incarnation: string;
  readonly credentialRevision: number;
  readonly trustRevision: number;
  /** Non-enumerable guard proof, never a response or audit field. */
  readonly credentialHash: string;
}
export interface EnrollmentContext extends MachineIdentity {
  readonly kind: 'enrollment';
  readonly enrollmentId: string;
  readonly issuedByActorId: string;
  /** Non-enumerable guard proof, never a response or audit field. */
  readonly tokenHash: string;
}
export type RegistrationContext = MachineContext | EnrollmentContext;
export interface MachineRequest extends Request { machineContext?: RegistrationContext }

export function machineContext(request: MachineRequest): MachineContext {
  if (request.machineContext?.kind !== 'machine') throw registrationFault('REGISTRATION_UNAUTHORIZED');
  return request.machineContext;
}
export function enrollmentContext(request: MachineRequest): EnrollmentContext {
  if (request.machineContext?.kind !== 'enrollment') throw registrationFault('REGISTRATION_UNAUTHORIZED');
  return request.machineContext;
}
