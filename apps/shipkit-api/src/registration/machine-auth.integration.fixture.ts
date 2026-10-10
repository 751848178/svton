import { randomUUID } from 'node:crypto';
import { databaseFixture } from '../testing/database.fixture.js';
import { MachineAuthService } from './machine-auth.service.js';
import { loadRegistrationProtocol } from './protocol.js';

export async function machineAuthFixture() {
  const { generateEnrollmentSecret, generateMachineSecret, hashEnrollmentSecret, hashMachineSecret } = await loadRegistrationProtocol();
  const fixture = await databaseFixture(), db = fixture.db;
  const actor = await db.actor.create({ data: { id: randomUUID(), kind: 'machine', name: 'Fixture machine' } });
  const issuer = await db.actor.create({ data: { id: randomUUID(), kind: 'user', name: 'Fixture issuer',
    username: `issuer-${randomUUID()}`, passwordHash: 'fixture-only-password-hash' } });
  const machineSecret = generateMachineSecret(), enrollmentSecret = generateEnrollmentSecret();
  const agent = await db.agent.create({ data: { actorId: actor.id, workspaceId: 'local', name: 'Fixture Agent',
    incarnation: randomUUID(), approvedRole: 'runtime', resourceKind: 'persistent', credentialHash: hashMachineSecret(machineSecret) } });
  const enrollment = await db.agentEnrollment.create({ data: { workspaceId: 'local', issuedByActorId: issuer.id,
    name: 'Fixture enrollment', approvedRole: 'runtime', resourceKind: 'persistent', tokenHash: hashEnrollmentSecret(enrollmentSecret),
    expiresAt: new Date(Date.now() + 900000) } });
  return { ...fixture, actor, issuer, agent, enrollment, machineSecret, enrollmentSecret, auth: new MachineAuthService(db) };
}
