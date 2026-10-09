import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { storedProjectInput } from '../projects/project-source.service.js';
import type { AgentResourceChecks, AgentResourceList } from './agent.contracts.js';
import { agentResourceList } from './agent.view.js';

@Injectable()
export class AgentService {
  constructor(
    @Inject(ProjectRepository) private readonly projects: ProjectRepository,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
  ) {}
  private async inventory(context: RequestContext) {
    this.policy.authorize(context, 'agent.read');
    const projects = await this.projects.list(context.workspaceId);
    const configs = await Promise.allSettled(projects.map(project => this.executor.listProjectAgentConnections(storedProjectInput(project))));
    return { projects, list: agentResourceList(projects, configs.map(result => result.status === 'fulfilled' ? result.value : null)) };
  }
  async list(context: RequestContext): Promise<AgentResourceList> { return (await this.inventory(context)).list; }
  async check(id: string, context: RequestContext): Promise<AgentResourceChecks> {
    this.policy.authorize(context, 'agent.checks');
    const { projects, list } = await this.inventory(context);
    const resource = list.items.find(item => item.id === id);
    if (!resource) throw new NotFoundException('Agent 资源不存在或已从项目配置移除，请刷新列表');
    const checkedAt = new Date().toISOString();
    const outcomes = await Promise.allSettled(resource.bindings.map(async binding => ({
      ...await this.executor.checkProjectAgentConnection(storedProjectInput(projects.find(project => project.id === binding.projectId)!), binding.locator, resource.endpoint), bindingId: binding.id,
    })));
    const checks = outcomes.map((outcome, index) => outcome.status === 'fulfilled' ? outcome.value
      : { bindingId: resource.bindings[index]!.id, ok: false, checkedAt, error: '此关联的配置或凭据已变更，无法完成检查，请刷新并核对项目配置' });
    const passed = checks.filter(check => check.ok).length;
    return { resourceId: resource.id, checkedAt, status: passed === checks.length ? 'succeeded' : passed ? 'partial' : 'failed', checks };
  }
}
