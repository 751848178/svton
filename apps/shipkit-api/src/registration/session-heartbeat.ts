import type { AgentHeartbeatRequest, AgentHeartbeatReceipt } from 'shipkit/platform';
import type { Prisma } from '../../generated/client/index.js';
import { assertMachineContext } from './machine-auth.service.js';
import type { MachineContext } from './machine-request.js';
import { registrationFault } from './fault.js';
import { loadRegistrationProtocol } from './protocol.js';
import { assertSessionClock, heartbeatView, leaseDeadline, observedSession,
  originalHeartbeatReceipt, sessionStatus } from './session-view.js';

export async function recordAgentHeartbeat(tx: Prisma.TransactionClient, context: MachineContext,
  request: AgentHeartbeatRequest, now: Date): Promise<AgentHeartbeatReceipt> {
  const agent = await assertMachineContext(tx, context);
  if (request.agentId !== agent.id || request.incarnation !== agent.incarnation) registrationFault('REGISTRATION_UNAUTHORIZED');
  const previous = await tx.agentSession.findUnique({ where: { agentId: agent.id } });
  if (!previous || previous.epoch !== request.epoch || previous.bootId !== request.bootId
    || previous.incarnation !== agent.incarnation || previous.credentialRevision !== agent.credentialRevision
    || previous.trustRevision !== agent.trustRevision) registrationFault('AGENT_SESSION_CONFLICT');
  assertSessionClock(previous, now);
  if (previous.leaseExpiresAt <= now) registrationFault('AGENT_SESSION_EXPIRED');
  const { heartbeatRequestHash, REGISTRATION_COUNTER_MAX } = await loadRegistrationProtocol();
  const requestHash = heartbeatRequestHash(request);
  if (request.sequence === previous.lastSequence) {
    if (previous.lastPayloadHash !== requestHash) registrationFault('AGENT_SEQUENCE_CONFLICT');
    return originalHeartbeatReceipt(previous);
  }
  if (previous.lastSequence >= REGISTRATION_COUNTER_MAX) registrationFault('AGENT_COUNTER_EXHAUSTED');
  if (request.sequence !== previous.lastSequence + 1) registrationFault('AGENT_SEQUENCE_CONFLICT');
  const session = { ...previous, lastSequence: request.sequence, lastPayloadHash: requestHash,
    lastSeenAt: now, leaseExpiresAt: await leaseDeadline(now), ...sessionStatus(request.status) };
  const receipt = heartbeatView(session);
  const changed = await tx.agentSession.updateMany({ where: observedSession(previous),
    data: { ...session, lastReceiptJson: JSON.stringify(receipt) } });
  if (changed.count !== 1) registrationFault('AGENT_SESSION_CONFLICT');
  return receipt;
}
