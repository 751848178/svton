import { ToolRegistry, type AgentConfig } from '@svton/agent-core';

const RUNTIME_BOUND_TOOLS = new Set(['subagent_spawn', 'csv_fanout']);

/** Clone mutable runtime capabilities and tools so one slot cannot rebind another. */
export function cloneRuntimeConfig(
  source: AgentConfig,
  initialMessages = source.initialMessages,
): AgentConfig {
  const toolRegistry = new ToolRegistry();
  for (const definition of source.toolRegistry.listDefinitions()) {
    if (RUNTIME_BOUND_TOOLS.has(definition.name)) continue;
    const entry = source.toolRegistry.get(definition.name);
    if (entry) toolRegistry.register(entry.definition, entry.executor);
  }
  return {
    ...source,
    toolRegistry,
    capabilities: source.capabilities
      ? {
          ...source.capabilities,
          permissionManager: source.capabilities.permissionManager?.forkForRuntime(),
          subagentManager: undefined,
        }
      : undefined,
    initialMessages,
  };
}
