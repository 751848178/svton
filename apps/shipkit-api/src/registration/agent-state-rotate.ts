import type { Prisma } from '../../generated/client/index.js';
import type { RequestContext } from '../policy/request-context.js';
import { registrationFault } from './fault.js';
import { applyAgentControl, assertTrustRevision, readAdminAgent } from './agent-state-control.js';
import { agentStateView, type AgentStateReceipt } from './agent-state-view.js';
import { nextRegistrationCounter } from './session-view.js';

export async function rotateAgentCredential(tx: Prisma.TransactionClient, context: RequestContext,
  agentId: string, expectedTrustRevision: number, expectedCredentialRevision: number,
  credentialHash: string, now: Date): Promise<AgentStateReceipt> {
  const agent = await readAdminAgent(tx, context, agentId, now);
  if (agent.actor.disabled) registrationFault('AGENT_STATE_CONFLICT');
  const revision = await nextRegistrationCounter(expectedCredentialRevision);
  const trustRevision = await nextRegistrationCounter(expectedTrustRevision);
  if (agent.credentialRevision === revision && agent.trustRevision === trustRevision
    && agent.credentialHash === credentialHash) return agentStateView(agent);
  assertTrustRevision(agent, expectedTrustRevision);
  if (agent.credentialRevision !== expectedCredentialRevision || agent.credentialHash === credentialHash) {
    registrationFault('AGENT_STATE_CONFLICT');
  }
  return applyAgentControl(tx, context, agent, { credentialRevision: revision, credentialHash }, 'agent.credential.rotate', now);
}
