import { SetMetadata } from '@nestjs/common';

export type MachineCapability = 'enrollment.consume' | 'session.open' | 'heartbeat.write';
export type MachineAuthMode = 'enrollment' | 'machine';
export interface MachineHandlerMetadata { capability: MachineCapability; authMode: MachineAuthMode }
export const MACHINE_HANDLER_METADATA = Symbol('shipkit.machine-handler');
export const MACHINE_METHODS = Object.freeze({
  'enrollment.consume': { path: '/api/agent-registration/enroll', authMode: 'enrollment' },
  'session.open': { path: '/api/agent-registration/session', authMode: 'machine' },
  'heartbeat.write': { path: '/api/agent-registration/heartbeat', authMode: 'machine' },
} as const);

/** A method marker only; authentication and the closed HTTP matrix are mandatory. */
export function MachineHandler(capability: MachineCapability, authMode: MachineAuthMode): MethodDecorator {
  return SetMetadata(MACHINE_HANDLER_METADATA, Object.freeze({ capability, authMode }));
}
