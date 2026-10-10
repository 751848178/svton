import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '../database/database.service.js';
import { loadRegistrationProtocol } from './protocol.js';

export async function identitySchemaRows(db: DatabaseService) {
  const { generateEnrollmentSecret, generateMachineSecret, hashEnrollmentSecret, hashMachineSecret } = await loadRegistrationProtocol();
  const actorId = randomUUID(), agentId = randomUUID();
  await db.actor.create({ data: { id: actorId, kind: 'machine', name: 'Fixture machine', username: null, passwordHash: null } });
  const agent = { id: agentId, workspaceId: 'local', actorId, name: 'Persistent Agent', incarnation: randomUUID(),
    approvedRole: 'runtime', resourceKind: 'persistent', credentialHash: hashMachineSecret(generateMachineSecret()), updatedAt: new Date() };
  const enrollment = { id: randomUUID(), workspaceId: 'local', issuedByActorId: 'local-controller', name: 'Persistent Agent',
    approvedRole: 'runtime', resourceKind: 'persistent', tokenHash: hashEnrollmentSecret(generateEnrollmentSecret()), expiresAt: new Date(Date.now() + 60_000) };
  const session = { agentId, epoch: 1, bootId: randomUUID(), incarnation: agent.incarnation, credentialRevision: 1, trustRevision: 1,
    openRequestHash: 'a'.repeat(64), lastSequence: 0, lastSeenAt: new Date(), leaseExpiresAt: new Date(Date.now() + 90_000),
    reportedRole: 'runtime', capabilitiesJson: '[]', version: '0.5.0', docker: true };
  return { agent, enrollment, session };
}
type Table = 'Agent' | 'AgentEnrollment' | 'AgentSession';
export const insertIdentityRow = (db: DatabaseService, table: Table, row: Record<string, unknown>) => {
  const columns = Object.keys(row);
  return db.$executeRawUnsafe(`INSERT INTO "${table}" (${columns.map(key => `"${key}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...Object.values(row));
};
export const updateIdentityRow = (db: DatabaseService, table: Table, id: string, patch: Record<string, unknown>) => {
  const columns = Object.keys(patch), key = table === 'AgentSession' ? 'agentId' : 'id';
  return db.$executeRawUnsafe(`UPDATE "${table}" SET ${columns.map(column => `"${column}"=?`).join(',')} WHERE "${key}"=?`, ...Object.values(patch), id);
};
