// Route guards shared by the agent's route groups: docker availability and
// caller-capability checks (M2-03: the caller's EFFECTIVE role decides, the
// machine role only adds a machine-capability constraint).

import type { AgentRole } from '../shared/types.js';
import { HttpFail } from './http-fail.js';
import { DEPLOYMENT_ENV_CAPABILITY, DEPLOYMENT_IDENTITY_CAPABILITY } from '../shared/deployment-identity.js';
import type { RouteCtx } from './route-types.js';

export function requireDocker(dockerOk: () => Promise<boolean>): () => Promise<void> {
  return async () => {
    if (!(await dockerOk())) throw new HttpFail(503, 'docker_unavailable', 'docker is not usable on this machine');
  };
}

export function callerCan(ctx: RouteCtx, capability: 'builder' | 'runtime'): boolean {
  const r = ctx.auth?.role;
  return r === 'both' || r === capability;
}

/** reject before any file write or job creation when the caller lacks the capability */
export function assertCallerCan(ctx: RouteCtx, capability: 'builder' | 'runtime', action: string): void {
  if (!callerCan(ctx, capability)) {
    throw new HttpFail(403, 'wrong_role', `credential role '${ctx.auth?.role ?? '?'}' may not ${action} (needs ${capability})`);
  }
}

/** machine capability constraint: a builder-only machine never stores pull creds etc. */
export function assertMachineCan(role: AgentRole, capability: 'builder' | 'runtime', action: string): void {
  if (role !== 'both' && role !== capability) {
    throw new HttpFail(403, 'wrong_role', `agent role '${role}' does not ${action} (needs ${capability})`);
  }
}

/** capabilities advertised by /api/status for the authenticated caller (M2-04) */
export function capabilitiesFor(role: AgentRole): string[] {
  if (role === 'builder') return ['build', 'push'];
  if (role === 'runtime') return ['deploy', 'rollback', 'gc', DEPLOYMENT_IDENTITY_CAPABILITY, DEPLOYMENT_ENV_CAPABILITY];
  return ['build', 'push', 'deploy', 'rollback', 'gc', DEPLOYMENT_IDENTITY_CAPABILITY, DEPLOYMENT_ENV_CAPABILITY];
}
