import { createHash } from 'node:crypto';
import type { ProjectAgentConnections } from 'shipkit/platform';
import type { StoredProject } from '../projects/project.repository.js';
import type { AgentResource, AgentResourceList } from './agent.contracts.js';

export function agentResourceList(projects: StoredProject[], configs: Array<ProjectAgentConnections | null>): AgentResourceList {
  const resources = new Map<string, AgentResource>();
  const result: AgentResourceList = { items: [], dynamicBuilders: [], issues: [] };
  projects.forEach((project, index) => {
    const config = configs[index];
    if (!config) {
      result.issues.push({ projectId: project.id, projectName: project.name, message: '项目配置无法读取或校验失败，请在本机检查配置引用' });
      return;
    }
    for (const connection of config.connections) {
      const id = createHash('sha256').update(connection.endpoint).digest('hex').slice(0, 24);
      const resource: AgentResource = resources.get(id) || { id, endpoint: connection.endpoint, usages: [], bindings: [] };
      if (!resource.usages.includes(connection.usage)) resource.usages.push(connection.usage);
      resource.bindings.push({ id: `${project.id}:${connection.locator}`, projectId: project.id, projectName: project.name,
        locator: connection.locator, usage: connection.usage, targetKey: connection.targetKey,
        displayName: connection.targetKey ? project.targets.find(target => target.targetKey === connection.targetKey)?.displayName : null,
        selected: connection.usage === 'runtime' && project.targetKey === connection.targetKey });
      resources.set(id, resource);
    }
    if (config.dynamicBuilder) result.dynamicBuilders.push({ projectId: project.id, projectName: project.name, ...config.dynamicBuilder });
  });
  result.items = [...resources.values()].sort((left, right) => left.endpoint.localeCompare(right.endpoint));
  return result;
}
