import type { AgentDefinition } from './types';

export function snapshotAgentDefinition(definition: AgentDefinition): AgentDefinition {
  const snapshot: AgentDefinition = { ...definition };

  if (definition.tools) snapshot.tools = [...definition.tools];
  if (definition.excludeTools) snapshot.excludeTools = [...definition.excludeTools];
  if (definition.mcpServers) {
    snapshot.mcpServers = definition.mcpServers.map((server) => ({ ...server }));
  }
  if (definition.skills) snapshot.skills = [...definition.skills];

  return snapshot;
}

export function snapshotAgentDefinitions(
  definitions: Iterable<AgentDefinition>,
): AgentDefinition[] {
  return Array.from(definitions, snapshotAgentDefinition);
}
