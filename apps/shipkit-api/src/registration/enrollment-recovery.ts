import type { Prisma } from '../../generated/client/index.js';
import type { EnrollmentConsumeRequest, EnrollmentReceipt } from 'shipkit/platform';
import { registrationFault } from './fault.js';
import { eligibleMachine } from './machine-auth.service.js';
import { loadRegistrationProtocol } from './protocol.js';

type Enrollment = Prisma.AgentEnrollmentGetPayload<{ include: { issuer: true; workspace: true } }>;
export async function recoverEnrollment(
  tx: Prisma.TransactionClient, enrollment: Enrollment, input: EnrollmentConsumeRequest,
  requestHash: string, credentialHash: string, now: Date,
): Promise<EnrollmentReceipt> {
  if (!enrollment.consumedAt || !enrollment.recoveryUntil || now < enrollment.consumedAt) registrationFault('AGENT_CLOCK_INVALID');
  if (enrollment.recoveryUntil <= now) registrationFault('REGISTRATION_EXPIRED');
  if (enrollment.attemptId !== input.attemptId || enrollment.requestHash !== requestHash || !enrollment.agentId
    || !enrollment.receiptJson || enrollment.resourceKind !== 'persistent') registrationFault('REGISTRATION_CONFLICT');
  const agent = await tx.agent.findUnique({ where: { id: enrollment.agentId }, include: { actor: true, workspace: true } });
  if (!eligibleMachine(agent) || agent.workspaceId !== enrollment.workspaceId || agent.incarnation !== input.incarnation
    || agent.approvedRole !== enrollment.approvedRole || agent.resourceKind !== 'persistent'
    || agent.credentialHash !== credentialHash) registrationFault('REGISTRATION_UNAUTHORIZED');
  let receipt: EnrollmentReceipt;
  const { parseEnrollmentReceipt } = await loadRegistrationProtocol();
  try { receipt = parseEnrollmentReceipt(JSON.parse(enrollment.receiptJson)); } catch { return registrationFault('REGISTRATION_CONFLICT'); }
  if (receipt.agentId !== agent.id || receipt.incarnation !== agent.incarnation || receipt.approvedRole !== agent.approvedRole
    || receipt.resourceKind !== agent.resourceKind || receipt.credentialRevision !== agent.credentialRevision
    || receipt.trustRevision !== agent.trustRevision) registrationFault('REGISTRATION_CONFLICT');
  return receipt;
}
