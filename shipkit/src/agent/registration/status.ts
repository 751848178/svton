import { parseRegistrationStatus } from '../../shared/registration-validation.js';
import type { RegistrationStatus } from '../../shared/registration-contracts.js';
import { RegistrationIdentityError } from './identity-error.js';
import { RegistrationRequestError, registrationHttpError } from './request-errors.js';
import type { RegistrationClientContext, RegistrationClientStatus } from './client-contracts.js';

export type ClientFailureCode = 'REGISTRATION_CLIENT_ABORTED' | 'REGISTRATION_CLIENT_FAILED'
  | 'REGISTRATION_CLIENT_INPUT_INVALID' | 'REGISTRATION_CLIENT_IDENTITY_CHANGED'
  | 'REGISTRATION_IDENTITY_SAVE_FAILED' | 'REGISTRATION_STATUS_INVALID' | 'REGISTRATION_COUNTER_EXHAUSTED';
export class RegistrationClientFailure extends Error {
  constructor(readonly code: ClientFailureCode) { super(code); this.name = 'RegistrationClientFailure'; }
}
const CLIENT_CODES = new Set(['REGISTRATION_CLIENT_ABORTED', 'REGISTRATION_CLIENT_FAILED', 'REGISTRATION_CLIENT_INPUT_INVALID',
  'REGISTRATION_CLIENT_IDENTITY_CHANGED', 'REGISTRATION_IDENTITY_SAVE_FAILED', 'REGISTRATION_STATUS_INVALID', 'REGISTRATION_COUNTER_EXHAUSTED']);
const IDENTITY_CODES = new Set(['REGISTRATION_STORE_CLOSED', 'REGISTRATION_IDENTITY_CONFLICT',
  'REGISTRATION_RECEIPT_INVALID', 'REGISTRATION_IDENTITY_INVALID', 'REGISTRATION_CONFIG_INVALID',
  'REGISTRATION_FILE_INVALID', 'REGISTRATION_FILE_CHANGED', 'REGISTRATION_FILE_UNSAFE', 'REGISTRATION_PATH_UNSAFE']);
const REQUEST_CODES = new Set(['REGISTRATION_REQUEST_INVALID', 'REGISTRATION_CA_INVALID', 'REGISTRATION_REQUEST_ABORTED',
  'REGISTRATION_REQUEST_TIMEOUT', 'REGISTRATION_TLS_FAILED', 'REGISTRATION_CONNECTION_FAILED', 'REGISTRATION_REDIRECT_REJECTED',
  'REGISTRATION_HTTP_REJECTED', 'REGISTRATION_RESPONSE_LIMIT', 'REGISTRATION_RESPONSE_INVALID']);
export function clientErrorStatus(error: unknown): Pick<RegistrationClientStatus, 'code' | 'remoteCode'> {
  if (error instanceof RegistrationClientFailure && CLIENT_CODES.has(error.code)) return { code: error.code };
  if (error instanceof RegistrationIdentityError && IDENTITY_CODES.has(error.code)) return { code: error.code };
  if (error instanceof RegistrationRequestError && REQUEST_CODES.has(error.code)) {
    const remoteCode = registrationHttpError(error.statusCode ?? 0, { code: error.remoteCode }).remoteCode;
    return { code: error.code, ...(remoteCode ? { remoteCode } : {}) };
  }
  return { code: 'REGISTRATION_CLIENT_FAILED' };
}
export async function registrationClientStatus(context: RegistrationClientContext): Promise<RegistrationStatus> {
  try {
    const status = parseRegistrationStatus(await context.options.status(context.options.signal));
    // Advertise purpose and registration support; legacy execution capabilities stay in direct API status.
    const purposes = status.reportedRole === 'both' ? ['builder', 'runtime'] : [status.reportedRole];
    return parseRegistrationStatus({ ...status, capabilities: [...purposes, 'registration-heartbeat-v1'] });
  } catch (error) {
    if (context.options.signal.aborted) throw new RegistrationClientFailure('REGISTRATION_CLIENT_ABORTED');
    throw new RegistrationClientFailure('REGISTRATION_STATUS_INVALID');
  }
}
