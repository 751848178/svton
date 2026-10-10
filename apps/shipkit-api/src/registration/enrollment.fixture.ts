import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { EnrollmentConsumeRequest } from 'shipkit/platform';
import type { RequestContext } from '../policy/request-context.js';
import { databaseFixture } from '../testing/database.fixture.js';
import { EnrollmentRepository } from './enrollment.repository.js';
import { MachineAuthService } from './machine-auth.service.js';
import type { EnrollmentContext } from './machine-request.js';
import { loadRegistrationProtocol } from './protocol.js';

export async function enrollmentFixture() {
  const fixture = await databaseFixture();
  const { generateMachineSecret } = await loadRegistrationProtocol();
  let now = new Date();
  const actor = await fixture.seedAccount('enrollment-admin', randomBytes(24).toString('base64url'));
  const sessionId = randomUUID();
  await fixture.db.authSession.create({ data: { id: sessionId, actorId: actor.id, expiresAt: new Date(now.getTime() + 86_400_000) } });
  const human: RequestContext = { actorId: actor.id, workspaceId: 'local', requestId: randomUUID(), source: 'session', sessionId };
  const repository = (clock = () => new Date(now)) => new EnrollmentRepository(fixture.db, clock);
  const issue = (ttlSeconds = 900) => repository().issue(human, { v: 1, name: 'Isolated Runtime', approvedRole: 'runtime', resourceKind: 'persistent', ttlSeconds });
  const authenticate = async (code: string) => {
    const context = await new MachineAuthService(fixture.db).authenticate('enrollment', `Bearer ${code}`);
    assert.equal(context.kind, 'enrollment'); return context as EnrollmentContext;
  };
  const consumeInput = (enrollmentId: string): EnrollmentConsumeRequest => ({ v: 1, enrollmentId,
    attemptId: randomUUID(), incarnation: randomUUID(), machineCredential: generateMachineSecret(), reportedRole: 'both',
    metadata: { version: '0.0.1', docker: true, capabilities: ['runtime'] } });
  const counts = async () => ({ agents: await fixture.db.agent.count(), machines: await fixture.db.actor.count({ where: { kind: 'machine' } }),
    consumed: await fixture.db.agentEnrollment.count({ where: { consumedAt: { not: null } } }),
    audits: await fixture.db.audit.count({ where: { action: 'agent.enrollment.consume' } }) });
  return { ...fixture, human, issue, authenticate, consumeInput, counts, repository,
    get now() { return new Date(now); }, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

export function enrollmentFault(code: string) {
  return (error: unknown) => error instanceof HttpException && typeof error.getResponse() === 'object'
    && (error.getResponse() as { code?: string }).code === code;
}
