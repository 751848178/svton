import { parseEnrollmentReceipt } from '../../shared/registration-receipts.js';
import type { RegisteredIdentity, RegistrationIdentity } from './identity-contracts.js';
import { parseRegistrationIdentityFile } from './identity-schema.js';
import { registrationOrigin } from './config.js';
import type { RegistrationClientContext } from './client-contracts.js';
import { RegistrationClientFailure } from './status.js';
import { retryRegistration } from './retry.js';
import { clientReceipt } from './client-response.js';
import { RegistrationRequestError } from './request-errors.js';

export function assertClientIdentity(context: RegistrationClientContext, expected: RegistrationIdentity): void {
  const current = parseRegistrationIdentityFile(context.options.store.current());
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw new RegistrationClientFailure('REGISTRATION_CLIENT_IDENTITY_CHANGED');
}
export async function enrollRegistrationClient(context: RegistrationClientContext): Promise<RegisteredIdentity> {
  const identity = parseRegistrationIdentityFile(context.options.store.current());
  if (identity.serverOrigin !== registrationOrigin(context.options.config.serverOrigin)) throw new RegistrationClientFailure('REGISTRATION_CLIENT_IDENTITY_CHANGED');
  if (identity.state === 'registered') return identity;
  context.emit({ state: 'enrolling', phase: 'enroll' });
  const request = Object.freeze({ phase: 'enroll' as const, serverOrigin: identity.serverOrigin,
    caFile: context.options.config.caFile, credential: identity.enrollmentCode, dto: identity.request, signal: context.options.signal });
  const receipt = clientReceipt(parseEnrollmentReceipt, await retryRegistration(context, 'enroll', async () => {
    assertClientIdentity(context, identity); return context.request(request);
  }));
  if (receipt.incarnation !== identity.request.incarnation) throw new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID');
  assertClientIdentity(context, identity);
  // Never retry an uncertain atomic identity save in this process or invent another attempt.
  let registered: RegisteredIdentity;
  try { registered = await context.options.store.complete(receipt); }
  catch { throw new RegistrationClientFailure('REGISTRATION_IDENTITY_SAVE_FAILED'); }
  const expected: RegisteredIdentity = { v: 1, state: 'registered', serverOrigin: identity.serverOrigin,
    machineCredential: identity.request.machineCredential, receipt };
  assertClientIdentity(context, expected);
  if (JSON.stringify(parseRegistrationIdentityFile(registered)) !== JSON.stringify(expected)) throw new RegistrationClientFailure('REGISTRATION_CLIENT_IDENTITY_CHANGED');
  context.emit({ state: 'registered', phase: 'enroll' }); return expected;
}
