import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EnrollmentReceipt } from 'shipkit/platform';
import { DatabaseService } from '../database/database.service.js';
import { contextAudit } from '../projects/project.repository.js';
import type { RequestContext } from '../policy/request-context.js';
import { enrollmentIssueInput } from './enrollment-input.js';
import { registrationFault, parseRegistrationInput } from './fault.js';
import { assertHumanContext } from './human-context.js';
import { assertEnrollmentContext } from './machine-auth.service.js';
import type { EnrollmentContext } from './machine-request.js';
import { recoverEnrollment } from './enrollment-recovery.js';
import { registrationTransaction, type RegistrationClock } from './transaction.js';
import { loadRegistrationProtocol } from './protocol.js';

@Injectable()
export class EnrollmentRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject('REGISTRATION_CLOCK') private readonly clock: RegistrationClock = () => new Date()) {}

  async issue(context: RequestContext, body: unknown) {
    const input = enrollmentIssueInput(body);
    const { generateEnrollmentSecret, hashEnrollmentSecret } = await loadRegistrationProtocol();
    const code = generateEnrollmentSecret(), tokenHash = hashEnrollmentSecret(code), enrollmentId = randomUUID();
    return registrationTransaction(this.db, async (tx, now) => {
      await assertHumanContext(tx, context, now);
      const pending = await tx.agentEnrollment.count({ where: { workspaceId: context.workspaceId,
        consumedAt: null, revokedAt: null, expiresAt: { gt: now } } });
      if (pending >= 256) registrationFault('REGISTRATION_BUSY');
      const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000);
      await tx.agentEnrollment.create({ data: { id: enrollmentId, workspaceId: context.workspaceId,
        issuedByActorId: context.actorId, name: input.name, approvedRole: input.approvedRole,
        resourceKind: 'persistent', tokenHash, expiresAt, createdAt: now } });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'agent.enrollment.issue',
        resourceType: 'agent-enrollment', resourceId: enrollmentId, outcome: 'succeeded' } });
      return { v: 1 as const, enrollmentId, code, expiresAt: expiresAt.toISOString(), approvedRole: input.approvedRole, resourceKind: 'persistent' as const };
    }, this.clock);
  }

  async consume(context: EnrollmentContext, body: unknown): Promise<EnrollmentReceipt> {
    const { parseEnrollmentConsumeRequest, enrollmentRequestHash, hashMachineSecret } = await loadRegistrationProtocol();
    const input = parseRegistrationInput(parseEnrollmentConsumeRequest, body);
    if (input.enrollmentId !== context.enrollmentId) registrationFault('REGISTRATION_UNAUTHORIZED');
    const requestHash = enrollmentRequestHash(input), credentialHash = hashMachineSecret(input.machineCredential);
    return registrationTransaction(this.db, async (tx, now) => {
      const enrollment = await assertEnrollmentContext(tx, context, now);
      if (now < enrollment.createdAt) registrationFault('AGENT_CLOCK_INVALID');
      if (enrollment.consumedAt !== null) return recoverEnrollment(tx, enrollment, input, requestHash, credentialHash, now);
      if (enrollment.expiresAt <= now) registrationFault('REGISTRATION_EXPIRED');
      const actorId = randomUUID(), agentId = randomUUID();
      await tx.actor.create({ data: { id: actorId, kind: 'machine', name: enrollment.name,
        username: null, passwordHash: null, disabled: false } });
      const agent = await tx.agent.create({ data: { id: agentId, workspaceId: enrollment.workspaceId, actorId,
        name: enrollment.name, incarnation: input.incarnation, approvedRole: enrollment.approvedRole,
        resourceKind: 'persistent', credentialHash, credentialRevision: 1, trustRevision: 1, createdAt: now } });
      const consumedAt = this.clock();
      if (!(consumedAt instanceof Date) || !Number.isFinite(consumedAt.getTime()) || consumedAt < now) registrationFault('AGENT_CLOCK_INVALID');
      if (enrollment.expiresAt <= consumedAt) registrationFault('REGISTRATION_EXPIRED');
      const receipt: EnrollmentReceipt = { v: 1, agentId, incarnation: agent.incarnation, approvedRole: enrollment.approvedRole as EnrollmentReceipt['approvedRole'],
        resourceKind: 'persistent', credentialRevision: 1, trustRevision: 1 };
      const result = await tx.agentEnrollment.updateMany({ where: { id: enrollment.id, tokenHash: context.tokenHash,
        workspaceId: context.workspaceId, consumedAt: null, revokedAt: null, expiresAt: { gt: consumedAt } },
        data: { consumedAt, attemptId: input.attemptId, requestHash, agentId,
          recoveryUntil: new Date(consumedAt.getTime() + 15 * 60_000), receiptJson: JSON.stringify(receipt) } });
      if (result.count !== 1) registrationFault('REGISTRATION_CONFLICT');
      await tx.audit.create({ data: { actorId: enrollment.issuedByActorId, workspaceId: enrollment.workspaceId,
        requestId: context.requestId, action: 'agent.enrollment.consume', resourceType: 'agent', resourceId: agentId, outcome: 'succeeded' } });
      return receipt;
    }, this.clock);
  }

  async revoke(context: RequestContext, enrollmentId: string) {
    return registrationTransaction(this.db, async (tx, now) => {
      await assertHumanContext(tx, context, now);
      const enrollment = await tx.agentEnrollment.findFirst({ where: { id: enrollmentId, workspaceId: context.workspaceId } });
      if (!enrollment) registrationFault('AGENT_NOT_FOUND');
      if (enrollment.revokedAt === null) {
        const result = await tx.agentEnrollment.updateMany({ where: { id: enrollmentId, workspaceId: context.workspaceId,
          tokenHash: enrollment.tokenHash, revokedAt: null }, data: { revokedAt: now } });
        if (result.count !== 1) registrationFault('REGISTRATION_CONFLICT');
        await tx.audit.create({ data: { ...contextAudit(context), action: 'agent.enrollment.revoke',
          resourceType: 'agent-enrollment', resourceId: enrollmentId, outcome: 'succeeded' } });
      }
      return { v: 1 as const, enrollmentId, revoked: true };
    }, this.clock);
  }
}
