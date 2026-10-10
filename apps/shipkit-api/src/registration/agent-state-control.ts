import type { Prisma } from '../../generated/client/index.js';
import type { RequestContext } from '../policy/request-context.js';
import { assertHumanContext } from './human-context.js';
import type { MachineAgent } from './machine-auth.service.js';
import { registrationFault } from './fault.js';
import { invalidateAgentSession } from './agent-state-fence.js';
import { nextRegistrationCounter } from './session-view.js';
import { agentStateView, observedAgent, type AgentStateReceipt } from './agent-state-view.js';

export async function readAdminAgent(tx: Prisma.TransactionClient, context: RequestContext,
  agentId: string, now: Date): Promise<MachineAgent> {
  await assertHumanContext(tx, context, now);
  const agent = await tx.agent.findFirst({ where: { id: agentId, workspaceId: context.workspaceId },
    include: { actor: true, workspace: true } });
  if (!agent || agent.resourceKind !== 'persistent' || agent.actor.kind !== 'machine'
    || agent.actor.username !== null || agent.actor.passwordHash !== null) registrationFault('AGENT_NOT_FOUND');
  return agent;
}
export function assertTrustRevision(agent: MachineAgent, expected: number): void {
  if (agent.trustRevision !== expected) registrationFault('AGENT_STATE_CONFLICT');
}
export async function applyAgentControl(tx: Prisma.TransactionClient, context: RequestContext, agent: MachineAgent,
  data: Prisma.AgentUpdateManyMutationInput, action: string, now: Date, revoke = false): Promise<AgentStateReceipt> {
  const trustRevision = await nextRegistrationCounter(agent.trustRevision);
  const changed = await tx.agent.updateMany({ where: observedAgent(agent), data: { ...data, trustRevision } });
  if (changed.count !== 1) registrationFault('AGENT_STATE_CONFLICT');
  if (revoke) {
    const revoked = await tx.actor.updateMany({ where: { id: agent.actorId, kind: 'machine', disabled: false,
      username: null, passwordHash: null }, data: { disabled: true } });
    if (revoked.count !== 1) registrationFault('AGENT_STATE_CONFLICT');
  }
  const updated = await tx.agent.findUniqueOrThrow({ where: { id: agent.id }, include: { actor: true, workspace: true } });
  await invalidateAgentSession(tx, updated, now);
  await tx.audit.create({ data: { workspaceId: context.workspaceId, actorId: context.actorId, requestId: context.requestId,
    action, resourceType: 'agent', resourceId: agent.id, outcome: 'succeeded' } });
  return agentStateView(updated);
}
