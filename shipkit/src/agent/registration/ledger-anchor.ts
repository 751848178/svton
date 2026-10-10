import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { RegistrationIdentity } from './identity-contracts.js';
import { assertDirectoryChain, optionalStat } from './identity-paths.js';
import { readPrivateRegistrationJson } from './identity-read.js';
import { parseLedgerAnchor, parseRegistrationIdentityFile, identityIncarnation } from './identity-schema.js';
import { identityFault } from './identity-error.js';

export interface RegistrationPaths { readonly root: string; readonly directory: string; readonly identity: string; readonly anchor: string }
export async function registrationPaths(workRoot: string): Promise<RegistrationPaths> {
  await assertDirectoryChain(workRoot);
  return Object.freeze({ root: workRoot, directory: path.join(workRoot, 'registration'),
    identity: path.join(workRoot, 'registration', 'identity.json'), anchor: path.join(workRoot, 'registration-anchor.json') });
}
export async function existingRegistrationIdentity(paths: RegistrationPaths, origin: string): Promise<RegistrationIdentity | null> {
  const directory = await optionalStat(paths.directory);
  if (directory) await assertDirectoryChain(paths.directory, true);
  const anchorFile = await optionalStat(paths.anchor), identityFile = await optionalStat(paths.identity);
  if (!anchorFile && !identityFile && !directory) return null;
  if (!anchorFile || !identityFile || !directory) return identityFault('REGISTRATION_IDENTITY_MISSING');
  const anchor = parseLedgerAnchor(await readPrivateRegistrationJson(paths.anchor));
  const identity = parseRegistrationIdentityFile(await readPrivateRegistrationJson(paths.identity));
  if (anchor.incarnation !== identityIncarnation(identity) || identity.serverOrigin !== origin) {
    return identityFault('REGISTRATION_LEDGER_MISMATCH');
  }
  return identity;
}
export async function prepareRegistrationDirectory(paths: RegistrationPaths, allowLegacy = false): Promise<void> {
  for (const name of ['jobs', 'apps', 'security.json']) {
    if (await optionalStat(path.join(paths.root, name)) && !allowLegacy) return identityFault('REGISTRATION_LEGACY_CLAIM_REQUIRED');
  }
  await mkdir(paths.directory, { mode: 0o700 });
  await assertDirectoryChain(paths.directory, true);
}
