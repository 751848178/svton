import path from 'node:path';
import type { RegistrationConfig } from './identity-contracts.js';
import { identityFault } from './identity-error.js';

export function registrationOrigin(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2048) return identityFault('REGISTRATION_CONFIG_INVALID');
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.origin !== input || url.username || url.password) {
      return identityFault('REGISTRATION_CONFIG_INVALID');
    }
    return url.origin;
  } catch { return identityFault('REGISTRATION_CONFIG_INVALID'); }
}
function optionalPath(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  if (!input || input.length > 4096 || /[\u0000-\u001f\u007f]/.test(input)
    || !path.isAbsolute(input) || path.resolve(input) !== input) return identityFault('REGISTRATION_CONFIG_INVALID');
  return input;
}
export function readRegistrationConfig(env: NodeJS.ProcessEnv = process.env): RegistrationConfig {
  const mode = env.SHIP_AGENT_REGISTRATION_MODE ?? 'disabled';
  if (mode === 'disabled') return Object.freeze({ mode });
  if (mode !== 'persistent') return identityFault('REGISTRATION_CONFIG_INVALID');
  const caFile = optionalPath(env.SHIP_AGENT_SERVER_CA_FILE);
  const enrollmentFile = optionalPath(env.SHIP_AGENT_ENROLLMENT_FILE);
  const existing = env.SHIP_AGENT_ENROLL_EXISTING_LEDGER;
  if (existing !== undefined && existing !== '0' && existing !== '1') return identityFault('REGISTRATION_CONFIG_INVALID');
  return Object.freeze({ mode, serverOrigin: registrationOrigin(env.SHIP_AGENT_SERVER_ORIGIN),
    ...(caFile ? { caFile } : {}), ...(enrollmentFile ? { enrollmentFile } : {}),
    ...(existing !== undefined ? { allowLegacyEnrollment: existing === '1' } : {}) });
}
