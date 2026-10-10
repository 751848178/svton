import { withFileLock } from '../../shared/file-lock.js';
import { identityFault, RegistrationIdentityError } from './identity-error.js';

/** The callback is the whole registration lifecycle, not just a single write. */
export async function withRegistrationOwnership<T>(anchor: string, operation: () => Promise<T>, timeoutMs = 15000): Promise<T> {
  let entered = false;
  try {
    return await withFileLock(anchor, async () => { entered = true; return operation(); }, { timeoutMs });
  } catch (error) {
    if (!entered && !(error instanceof RegistrationIdentityError)) return identityFault('REGISTRATION_ALREADY_RUNNING');
    throw error;
  }
}
