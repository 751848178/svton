// Shared wire contract for deployment identity and runtime capability negotiation.
export const DEPLOYMENT_IDENTITY_CAPABILITY = 'deployment-identity-v1';
export const DEPLOYMENT_ENV_CAPABILITY = 'deployment-env-preserve-v1';
export const ENVIRONMENT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validProjectIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !/\s/.test(value);
}

export function validEnvironmentIdentity(value: unknown): value is string {
  return typeof value === 'string' && ENVIRONMENT_NAME_RE.test(value);
}
