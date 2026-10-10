import { mkdtemp, mkdir, chmod, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateEnrollmentSecret } from '../../shared/registration-digest.js';
import type { EnrollmentReceipt, RegistrationStatus } from '../../shared/registration-contracts.js';
import type { PendingRegistrationIdentity, PersistentRegistrationConfig } from './identity-contracts.js';

export const initialStatus: RegistrationStatus = Object.freeze({ reportedRole: 'both', version: '0.5.0',
  docker: true, capabilities: Object.freeze(['runtime', 'builder']) });
export async function identityFixture() {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'shipkit-identity-')));
  await chmod(directory, 0o700);
  const root = path.join(directory, 'work'), enrollmentFile = path.join(directory, 'enrollment.json');
  await mkdir(root, { mode: 0o700 });
  const enrollment = { v: 1, enrollmentId: randomUUID(), code: generateEnrollmentSecret() };
  await writeFile(enrollmentFile, `${JSON.stringify(enrollment)}\n`, { mode: 0o600 });
  const config: PersistentRegistrationConfig = { mode: 'persistent', serverOrigin: 'https://registration.example', enrollmentFile };
  return { directory, root, enrollment, config, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
export function enrollmentReceipt(identity: PendingRegistrationIdentity): EnrollmentReceipt {
  return { v: 1, agentId: randomUUID(), incarnation: identity.request.incarnation, approvedRole: 'runtime',
    resourceKind: 'persistent', credentialRevision: 1, trustRevision: 1 };
}
