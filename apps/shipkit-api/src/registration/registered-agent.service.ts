import { Inject, Injectable } from '@nestjs/common';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { AgentStateRepository } from './agent-state.repository.js';
import { EnrollmentRepository } from './enrollment.repository.js';
import { RegisteredAgentDirectory } from './registered-agent.directory.js';
import { controlInput, enrollmentRevokeInput, registeredAgentId, rotateInput } from './registered-agent.input.js';

@Injectable()
export class RegisteredAgentService {
  constructor(@Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
    @Inject(EnrollmentRepository) private readonly enrollments: EnrollmentRepository,
    @Inject(AgentStateRepository) private readonly state: AgentStateRepository,
    @Inject(RegisteredAgentDirectory) private readonly directory: RegisteredAgentDirectory) {}
  list(context: RequestContext) {
    this.policy.authorize(context, 'registered-agent.list'); return this.directory.list(context.workspaceId);
  }
  issue(context: RequestContext, body: unknown) {
    this.policy.authorize(context, 'agent-enrollment.issue'); return this.enrollments.issue(context, body);
  }
  async revokeEnrollment(context: RequestContext, id: string, body: unknown) {
    this.policy.authorize(context, 'agent-enrollment.revoke'); enrollmentRevokeInput(body);
    return this.enrollments.revoke(context, await registeredAgentId(id));
  }
  async setDisabled(context: RequestContext, id: string, body: unknown) {
    this.policy.authorize(context, 'registered-agent.disable'); const input = await controlInput(body, 'disabled');
    return this.state.setDisabled(context, await registeredAgentId(id), input.expectedTrustRevision, input.value!);
  }
  async setDraining(context: RequestContext, id: string, body: unknown) {
    this.policy.authorize(context, 'registered-agent.draining'); const input = await controlInput(body, 'draining');
    return this.state.setDraining(context, await registeredAgentId(id), input.expectedTrustRevision, input.value!);
  }
  async revoke(context: RequestContext, id: string, body: unknown) {
    this.policy.authorize(context, 'registered-agent.revoke'); const input = await controlInput(body);
    return this.state.revoke(context, await registeredAgentId(id), input.expectedTrustRevision);
  }
  async rotate(context: RequestContext, id: string, body: unknown) {
    this.policy.authorize(context, 'registered-agent.rotate'); const input = await rotateInput(body);
    return this.state.rotate(context, await registeredAgentId(id), input.expectedTrustRevision, input.expectedCredentialRevision, input.newCredential);
  }
}
