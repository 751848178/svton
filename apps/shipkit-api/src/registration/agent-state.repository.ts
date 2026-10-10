import { Inject, Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { applyAgentControl, assertTrustRevision, readAdminAgent } from './agent-state-control.js';
import { rotateAgentCredential } from './agent-state-rotate.js';
import { agentStateView, type AgentStateReceipt } from './agent-state-view.js';
import { parseRegistrationInput, registrationFault } from './fault.js';
import { registrationTransaction, type RegistrationClock } from './transaction.js';
import { loadRegistrationProtocol } from './protocol.js';

@Injectable()
export class AgentStateRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject('REGISTRATION_CLOCK') private readonly clock: RegistrationClock = () => new Date()) {}

  private async toggle(context: RequestContext, id: string, expected: number, field: 'disabled' | 'draining', value: boolean): Promise<AgentStateReceipt> {
    const { parseRegistrationIdentity, parseRegistrationCounter } = await loadRegistrationProtocol();
    const agentId = parseRegistrationInput(parseRegistrationIdentity, id);
    const revision = parseRegistrationInput(parseRegistrationCounter, expected);
    if (typeof value !== 'boolean') registrationFault('REGISTRATION_INPUT_INVALID');
    return registrationTransaction(this.db, async (tx, now) => {
      const agent = await readAdminAgent(tx, context, agentId, now);
      assertTrustRevision(agent, revision);
      if (agent.actor.disabled) registrationFault('AGENT_STATE_CONFLICT');
      if (agent[field] === value) return agentStateView(agent);
      return applyAgentControl(tx, context, agent, { [field]: value }, `agent.${field}`, now);
    }, this.clock);
  }
  setDisabled(context: RequestContext, id: string, expectedTrustRevision: number, disabled: boolean): Promise<AgentStateReceipt> {
    return this.toggle(context, id, expectedTrustRevision, 'disabled', disabled);
  }
  setDraining(context: RequestContext, id: string, expectedTrustRevision: number, draining: boolean): Promise<AgentStateReceipt> {
    return this.toggle(context, id, expectedTrustRevision, 'draining', draining);
  }
  async revoke(context: RequestContext, id: string, expectedTrustRevision: number): Promise<AgentStateReceipt> {
    const { parseRegistrationIdentity, parseRegistrationCounter } = await loadRegistrationProtocol();
    const agentId = parseRegistrationInput(parseRegistrationIdentity, id);
    const revision = parseRegistrationInput(parseRegistrationCounter, expectedTrustRevision);
    return registrationTransaction(this.db, async (tx, now) => {
      const agent = await readAdminAgent(tx, context, agentId, now);
      assertTrustRevision(agent, revision);
      if (agent.actor.disabled) return agentStateView(agent);
      return applyAgentControl(tx, context, agent, {}, 'agent.revoke', now, true);
    }, this.clock);
  }
  async rotate(context: RequestContext, id: string, expectedTrustRevision: number, expectedCredentialRevision: number,
    newCredential: string): Promise<AgentStateReceipt> {
    const { parseRegistrationIdentity, parseRegistrationCounter, hashMachineSecret } = await loadRegistrationProtocol();
    const agentId = parseRegistrationInput(parseRegistrationIdentity, id);
    const trust = parseRegistrationInput(parseRegistrationCounter, expectedTrustRevision);
    const revision = parseRegistrationInput(parseRegistrationCounter, expectedCredentialRevision);
    const hash = parseRegistrationInput(hashMachineSecret, newCredential);
    return registrationTransaction(this.db, (tx, now) => rotateAgentCredential(tx, context, agentId, trust, revision, hash, now), this.clock);
  }
}
