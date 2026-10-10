import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import { registrationFault } from './fault.js';
import type { EnrollmentContext, MachineContext, RegistrationContext } from './machine-request.js';
import type { MachineAuthMode } from './machine-handler.js';
import { loadRegistrationProtocol } from './protocol.js';

export type MachineAgent = Prisma.AgentGetPayload<{ include: { actor: true; workspace: true } }>;
type Enrollment = Prisma.AgentEnrollmentGetPayload<{ include: { issuer: true; workspace: true } }>;
type MachineReader = Pick<Prisma.TransactionClient, 'agent'>;
type EnrollmentReader = Pick<Prisma.TransactionClient, 'agentEnrollment'>;
const unauthorized = () => registrationFault('REGISTRATION_UNAUTHORIZED');
const positive = (value: number) => Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
const role = (value: string) => ['runtime', 'builder', 'both'].includes(value);
const digest = (value: string) => /^[a-f0-9]{64}$/.test(value);

export function eligibleMachine(agent: MachineAgent | null): agent is MachineAgent {
  return !!agent && agent.disabled === false && !!agent.id && !!agent.actorId && !!agent.workspaceId
    && agent.resourceKind === 'persistent' && role(agent.approvedRole)
    && positive(agent.credentialRevision) && positive(agent.trustRevision) && digest(agent.credentialHash)
    && !!agent.incarnation && agent.workspace?.id === agent.workspaceId && agent.actor?.id === agent.actorId
    && agent.actor.disabled === false && agent.actor.kind === 'machine' && agent.actor.username === null && agent.actor.passwordHash === null;
}
function eligibleEnrollment(enrollment: Enrollment | null): enrollment is Enrollment {
  return !!enrollment && !!enrollment.id && !!enrollment.workspaceId && enrollment.resourceKind === 'persistent' && role(enrollment.approvedRole)
    && digest(enrollment.tokenHash) && enrollment.revokedAt === null && enrollment.workspace?.id === enrollment.workspaceId
    && enrollment.issuer?.id === enrollment.issuedByActorId && enrollment.issuer.disabled === false
    && enrollment.issuer.kind === 'user' && !!enrollment.issuer.username && !!enrollment.issuer.passwordHash;
}
function proof<T extends object, K extends string>(context: T, key: K, value: string): T & Record<K, string> {
  Object.defineProperty(context, key, { value, enumerable: false });
  return Object.freeze(context) as T & Record<K, string>;
}

/** Every mutating transaction must recheck the original guard proof and identity. */
export async function assertMachineContext(tx: MachineReader, context: MachineContext): Promise<MachineAgent> {
  const agent = await tx.agent.findUnique({ where: { id: context.agentId }, include: { actor: true, workspace: true } });
  if (context.kind !== 'machine' || !eligibleMachine(agent) || agent.credentialHash !== context.credentialHash
    || agent.actorId !== context.actorId || agent.workspaceId !== context.workspaceId || agent.incarnation !== context.incarnation
    || agent.approvedRole !== context.approvedRole || context.resourceKind !== 'persistent'
    || agent.credentialRevision !== context.credentialRevision || agent.trustRevision !== context.trustRevision) throw unauthorized();
  return agent;
}
/** Expiry/request-hash/recovery predicates belong to consumeOrRecover, not this credential recheck. */
export async function assertEnrollmentContext(tx: EnrollmentReader, context: EnrollmentContext, now: Date): Promise<Enrollment> {
  const enrollment = await tx.agentEnrollment.findUnique({ where: { id: context.enrollmentId }, include: { issuer: true, workspace: true } });
  if (context.kind !== 'enrollment' || !Number.isFinite(now.getTime()) || !eligibleEnrollment(enrollment)
    || enrollment.tokenHash !== context.tokenHash || enrollment.workspaceId !== context.workspaceId
    || enrollment.issuedByActorId !== context.issuedByActorId || enrollment.approvedRole !== context.approvedRole
    || context.resourceKind !== 'persistent') throw unauthorized();
  return enrollment;
}

@Injectable()
export class MachineAuthService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async authenticate(mode: MachineAuthMode, header: string | undefined): Promise<RegistrationContext> {
    if (!['machine', 'enrollment'].includes(mode) || !header?.startsWith('Bearer ') || header.length > 128) throw unauthorized();
    let hash: string;
    try {
      const { hashEnrollmentSecret, hashMachineSecret } = await loadRegistrationProtocol();
      hash = mode === 'machine' ? hashMachineSecret(header.slice(7)) : hashEnrollmentSecret(header.slice(7));
    }
    catch { throw unauthorized(); }
    if (mode === 'machine') {
      const agent = await this.db.agent.findUnique({ where: { credentialHash: hash }, include: { actor: true, workspace: true } });
      if (!eligibleMachine(agent)) throw unauthorized();
      return proof({ kind: 'machine' as const, requestId: randomUUID(), agentId: agent.id, actorId: agent.actorId,
        workspaceId: agent.workspaceId, incarnation: agent.incarnation, approvedRole: agent.approvedRole as MachineContext['approvedRole'],
        resourceKind: 'persistent' as const, credentialRevision: agent.credentialRevision, trustRevision: agent.trustRevision }, 'credentialHash', hash);
    }
    const enrollment = await this.db.agentEnrollment.findUnique({ where: { tokenHash: hash }, include: { issuer: true, workspace: true } });
    if (!eligibleEnrollment(enrollment)) throw unauthorized();
    return proof({ kind: 'enrollment' as const, requestId: randomUUID(), enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId, issuedByActorId: enrollment.issuedByActorId,
      approvedRole: enrollment.approvedRole as EnrollmentContext['approvedRole'], resourceKind: 'persistent' as const }, 'tokenHash', hash);
  }
}
