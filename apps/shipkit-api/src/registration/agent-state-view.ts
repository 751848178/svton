import type { MachineAgent } from './machine-auth.service.js';
import type { Prisma } from '../../generated/client/index.js';

export interface AgentStateReceipt {
  v: 1;
  agentId: string;
  credentialRevision: number;
  trustRevision: number;
  disabled: boolean;
  draining: boolean;
  revoked: boolean;
}
export function agentStateView(agent: MachineAgent): AgentStateReceipt {
  return { v: 1, agentId: agent.id, credentialRevision: agent.credentialRevision,
    trustRevision: agent.trustRevision, disabled: agent.disabled, draining: agent.draining, revoked: agent.actor.disabled };
}
export function observedAgent(agent: MachineAgent): Prisma.AgentWhereInput {
  const { actor, workspace, ...identity } = agent;
  return { ...identity, actor: { id: actor.id, kind: 'machine', disabled: actor.disabled,
    username: null, passwordHash: null }, workspace: { id: workspace.id } };
}
