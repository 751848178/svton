import { RegistrationRequestError } from './request-errors.js';

/** Preserve the same fail-closed protocol boundary for native and injected transports. */
export function clientReceipt<T>(parse: (value: unknown) => T, value: unknown): T {
  try { return parse(value); }
  catch { throw new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID'); }
}
