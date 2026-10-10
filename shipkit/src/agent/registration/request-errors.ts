export type RegistrationRequestCode = 'REGISTRATION_REQUEST_INVALID' | 'REGISTRATION_CA_INVALID'
  | 'REGISTRATION_REQUEST_ABORTED' | 'REGISTRATION_REQUEST_TIMEOUT' | 'REGISTRATION_TLS_FAILED'
  | 'REGISTRATION_CONNECTION_FAILED' | 'REGISTRATION_REDIRECT_REJECTED' | 'REGISTRATION_HTTP_REJECTED'
  | 'REGISTRATION_RESPONSE_LIMIT' | 'REGISTRATION_RESPONSE_INVALID';

// This class deliberately has no remote body, request, URL, raw error or cause.
export class RegistrationRequestError extends Error {
  constructor(readonly code: RegistrationRequestCode, readonly statusCode?: number, readonly remoteCode?: string) {
    super(code); this.name = 'RegistrationRequestError';
  }
}
const REMOTE_STATUS: Readonly<Record<string, number>> = Object.freeze({
  REGISTRATION_INPUT_INVALID: 400, TEMPORARY_AGENT_ENROLLMENT_UNSUPPORTED: 400,
  REGISTRATION_UNAUTHORIZED: 401, REGISTRATION_EXPIRED: 410, REGISTRATION_CONFLICT: 409,
  AGENT_NOT_FOUND: 404, AGENT_SESSION_CONFLICT: 409, AGENT_SEQUENCE_CONFLICT: 409,
  AGENT_SESSION_EXPIRED: 409, AGENT_COUNTER_EXHAUSTED: 409, AGENT_CLOCK_INVALID: 409,
  AGENT_STATE_CONFLICT: 409, REGISTRATION_BUSY: 503,
});
export function registrationHttpError(status: number, value: unknown): RegistrationRequestError {
  const code = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).code : undefined;
  const remoteCode = typeof code === 'string' && Object.hasOwn(REMOTE_STATUS, code) && REMOTE_STATUS[code] === status ? code : undefined;
  return new RegistrationRequestError('REGISTRATION_HTTP_REJECTED', status, remoteCode);
}
export function registrationNetworkError(error: unknown): RegistrationRequestError {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  if (code === 'HPE_HEADER_OVERFLOW') return new RegistrationRequestError('REGISTRATION_RESPONSE_LIMIT');
  const tls = typeof code === 'string' && (/^(?:ERR_TLS_|ERR_SSL_|CERT_)/.test(code)
    || ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code));
  return new RegistrationRequestError(tls ? 'REGISTRATION_TLS_FAILED' : 'REGISTRATION_CONNECTION_FAILED');
}
