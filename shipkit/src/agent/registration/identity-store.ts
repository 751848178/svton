import { randomUUID } from 'node:crypto';
import { generateMachineSecret } from '../../shared/registration-digest.js';
import { parseEnrollmentConsumeRequest, parseRegistrationStatus } from '../../shared/registration-validation.js';
import { parseEnrollmentReceipt } from '../../shared/registration-receipts.js';
import type { PersistentRegistrationConfig, RegisteredIdentity, RegistrationIdentity, RegistrationIdentityOptions } from './identity-contracts.js';
import { registrationOrigin } from './config.js';
import { identityFault } from './identity-error.js';
import { parseEnrollmentInput } from './identity-schema.js';
import { readPrivateRegistrationJson } from './identity-read.js';
import { writeRegistrationIdentityJson } from './identity-write.js';
import { existingRegistrationIdentity, prepareRegistrationDirectory, registrationPaths } from './ledger-anchor.js';
import { withRegistrationOwnership } from './ownership.js';

export interface RegistrationIdentityStore {
  current(): RegistrationIdentity;
  complete(receipt: unknown): Promise<RegisteredIdentity>;
}
class IdentityStore implements RegistrationIdentityStore {
  #closed = false;
  #busy = false;
  #write: Promise<void> | undefined;
  constructor(private readonly file: string, private identity: RegistrationIdentity) {}
  current(): RegistrationIdentity {
    if (this.#closed) return identityFault('REGISTRATION_STORE_CLOSED');
    return this.identity;
  }
  async complete(input: unknown): Promise<RegisteredIdentity> {
    const previous = this.current();
    if (this.#busy) return identityFault('REGISTRATION_IDENTITY_CONFLICT');
    let receipt: ReturnType<typeof parseEnrollmentReceipt>;
    try { receipt = parseEnrollmentReceipt(input); }
    catch { return identityFault('REGISTRATION_RECEIPT_INVALID'); }
    if (previous.state === 'registered') {
      if (JSON.stringify(receipt) !== JSON.stringify(previous.receipt)) return identityFault('REGISTRATION_IDENTITY_CONFLICT');
      return previous;
    }
    if (receipt.incarnation !== previous.request.incarnation) return identityFault('REGISTRATION_RECEIPT_INVALID');
    const registered = Object.freeze({ v: 1 as const, state: 'registered' as const,
      serverOrigin: previous.serverOrigin, machineCredential: previous.request.machineCredential, receipt });
    this.#busy = true;
    try {
      this.#write = writeRegistrationIdentityJson(this.file, registered);
      await this.#write;
      this.identity = registered;
      return registered;
    } catch (error) { this.#closed = true; throw error; }
    finally { this.#busy = false; }
  }
  async close(): Promise<void> {
    this.#closed = true;
    // The lifecycle lock cannot be released while an accepted write is pending.
    await this.#write?.catch(() => undefined);
  }
}

export async function withRegistrationIdentity<T>(workRoot: string, config: PersistentRegistrationConfig,
  options: RegistrationIdentityOptions, operation: (store: RegistrationIdentityStore) => Promise<T>): Promise<T> {
  if (config.mode !== 'persistent' || (config.allowLegacyEnrollment !== undefined && typeof config.allowLegacyEnrollment !== 'boolean')
    || (options.lockTimeoutMs !== undefined && (!Number.isInteger(options.lockTimeoutMs)
      || options.lockTimeoutMs < 1 || options.lockTimeoutMs > 15000))) return identityFault('REGISTRATION_CONFIG_INVALID');
  const origin = registrationOrigin(config.serverOrigin), paths = await registrationPaths(workRoot);
  return withRegistrationOwnership(paths.anchor, async () => {
    let identity = await existingRegistrationIdentity(paths, origin);
    if (!identity) {
      if (!config.enrollmentFile || !options.initialStatus) return identityFault('REGISTRATION_ENROLLMENT_REQUIRED');
      const enrollment = parseEnrollmentInput(await readPrivateRegistrationJson(config.enrollmentFile));
      let status: ReturnType<typeof parseRegistrationStatus>;
      try { status = parseRegistrationStatus(options.initialStatus); }
      catch { return identityFault('REGISTRATION_INITIAL_STATUS_INVALID'); }
      const { reportedRole, ...metadata } = status;
      const request = parseEnrollmentConsumeRequest({ v: 1, enrollmentId: enrollment.enrollmentId,
        attemptId: randomUUID(), incarnation: randomUUID(), machineCredential: generateMachineSecret(), reportedRole, metadata });
      identity = Object.freeze({ v: 1, state: 'pending', serverOrigin: origin, enrollmentCode: enrollment.code, request });
      await prepareRegistrationDirectory(paths, config.allowLegacyEnrollment);
      // A partial initialization is kept and rejected on restart; no request has been sent.
      await writeRegistrationIdentityJson(paths.anchor, { v: 1, incarnation: request.incarnation });
      await writeRegistrationIdentityJson(paths.identity, identity);
    }
    const store = new IdentityStore(paths.identity, identity);
    try { return await operation(store); } finally { await store.close(); }
  }, options.lockTimeoutMs);
}
