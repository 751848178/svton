import type { AgentSessionOpenRequest, AgentSessionOpenReceipt } from 'shipkit/platform';
import type { Prisma } from '../../generated/client/index.js';
import { assertMachineContext } from './machine-auth.service.js';
import type { MachineContext } from './machine-request.js';
import { registrationFault } from './fault.js';
import { loadRegistrationProtocol } from './protocol.js';
import { assertSessionClock, leaseDeadline, nextRegistrationCounter, observedSession,
  sessionOpenView, sessionStatus } from './session-view.js';

export async function openAgentSession(tx: Prisma.TransactionClient, context: MachineContext,
  request: AgentSessionOpenRequest, now: Date): Promise<AgentSessionOpenReceipt> {
  const agent = await assertMachineContext(tx, context);
  if (request.agentId !== agent.id || request.incarnation !== agent.incarnation) registrationFault('REGISTRATION_UNAUTHORIZED');
  const previous = await tx.agentSession.findUnique({ where: { agentId: agent.id } });
  const { sessionOpenRequestHash } = await loadRegistrationProtocol();
  const openRequestHash = sessionOpenRequestHash(request);
  if (previous) {
    assertSessionClock(previous, now);
    if (previous.leaseExpiresAt > now) {
      if (previous.incarnation !== agent.incarnation || previous.credentialRevision !== agent.credentialRevision
        || previous.trustRevision !== agent.trustRevision || previous.bootId !== request.bootId
        || previous.openRequestHash !== openRequestHash) registrationFault('AGENT_SESSION_CONFLICT');
      return sessionOpenView(previous);
    }
  }
  const session = { agentId: agent.id, incarnation: agent.incarnation, bootId: request.bootId,
    credentialRevision: agent.credentialRevision, trustRevision: agent.trustRevision,
    epoch: previous ? await nextRegistrationCounter(previous.epoch) : 1, openRequestHash,
    lastSequence: 0, lastPayloadHash: null, lastReceiptJson: null, lastSeenAt: now,
    leaseExpiresAt: await leaseDeadline(now), ...sessionStatus(request.status) };
  if (previous) {
    const changed = await tx.agentSession.updateMany({ where: observedSession(previous), data: session });
    if (changed.count !== 1) registrationFault('AGENT_SESSION_CONFLICT');
  } else await tx.agentSession.create({ data: session });
  await tx.audit.create({ data: { workspaceId: agent.workspaceId, actorId: agent.actorId, requestId: context.requestId,
    action: 'agent.session.open', resourceType: 'agent', resourceId: agent.id, outcome: 'succeeded' } });
  return sessionOpenView(session);
}
