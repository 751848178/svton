import { parseEnrollmentConsumeRequest, parseEnrollmentSecret, parseMachineSecret,
  parseRegistrationIdentifier, registrationRecord } from '../../shared/registration-validation.js';
import { parseEnrollmentReceipt } from '../../shared/registration-receipts.js';
import type { EnrollmentInput, LedgerAnchor, RegistrationIdentity } from './identity-contracts.js';
import { registrationOrigin } from './config.js';
import { identityFault } from './identity-error.js';

export function parseRegistrationIdentityFile(input: unknown): RegistrationIdentity {
  try {
    if ((input as { state?: unknown } | null)?.state === 'pending') {
      const value = registrationRecord(input, ['v', 'state', 'serverOrigin', 'enrollmentCode', 'request']);
      if (value.v !== 1) return identityFault('REGISTRATION_IDENTITY_INVALID');
      return Object.freeze({ v: 1, state: 'pending', serverOrigin: registrationOrigin(value.serverOrigin),
        enrollmentCode: parseEnrollmentSecret(value.enrollmentCode), request: parseEnrollmentConsumeRequest(value.request) });
    }
    const value = registrationRecord(input, ['v', 'state', 'serverOrigin', 'machineCredential', 'receipt']);
    if (value.v !== 1 || value.state !== 'registered') return identityFault('REGISTRATION_IDENTITY_INVALID');
    return Object.freeze({ v: 1, state: 'registered', serverOrigin: registrationOrigin(value.serverOrigin),
      machineCredential: parseMachineSecret(value.machineCredential), receipt: parseEnrollmentReceipt(value.receipt) });
  } catch { return identityFault('REGISTRATION_IDENTITY_INVALID'); }
}
export function parseEnrollmentInput(input: unknown): EnrollmentInput {
  try {
    const value = registrationRecord(input, ['v', 'enrollmentId', 'code']);
    if (value.v !== 1) return identityFault('REGISTRATION_ENROLLMENT_INVALID');
    return Object.freeze({ v: 1, enrollmentId: parseRegistrationIdentifier(value.enrollmentId), code: parseEnrollmentSecret(value.code) });
  } catch { return identityFault('REGISTRATION_ENROLLMENT_INVALID'); }
}
export function parseLedgerAnchor(input: unknown): LedgerAnchor {
  try {
    const value = registrationRecord(input, ['v', 'incarnation']);
    if (value.v !== 1) return identityFault('REGISTRATION_LEDGER_INVALID');
    return Object.freeze({ v: 1, incarnation: parseRegistrationIdentifier(value.incarnation) });
  } catch { return identityFault('REGISTRATION_LEDGER_INVALID'); }
}
export const identityIncarnation = (value: RegistrationIdentity): string => value.state === 'pending'
  ? value.request.incarnation : value.receipt.incarnation;
