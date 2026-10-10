import type { Prisma } from '../../generated/client/index.js';
import type { MachineAgent } from './machine-auth.service.js';
import { assertSessionClock, nextRegistrationCounter, observedSession } from './session-view.js';
import { registrationFault } from './fault.js';

/** Fence the existing row; deleting it would allow the next process to reuse epoch 1. */
export async function invalidateAgentSession(tx: Prisma.TransactionClient, agent: MachineAgent, now: Date): Promise<void> {
  const session = await tx.agentSession.findUnique({ where: { agentId: agent.id } });
  if (!session) return;
  assertSessionClock(session, now);
  const epoch = await nextRegistrationCounter(session.epoch);
  const changed = await tx.agentSession.updateMany({ where: observedSession(session), data: {
    epoch, credentialRevision: agent.credentialRevision, trustRevision: agent.trustRevision,
    // This Server observation also fences clock rollback from reviving the expired lease.
    lastSeenAt: now, leaseExpiresAt: now, lastSequence: 0, lastPayloadHash: null, lastReceiptJson: null,
  } });
  if (changed.count !== 1) registrationFault('AGENT_STATE_CONFLICT');
}
