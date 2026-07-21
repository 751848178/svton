import type { AgentConfig } from '../agent/types';
import { ToolRegistry } from '../tool/registry';
import type { SubagentConfig } from './types';

export function buildSubagentToolRegistry(
  sourceRegistry: ToolRegistry,
  config: SubagentConfig,
): ToolRegistry {
  const registry = new ToolRegistry();

  for (const def of sourceRegistry.listDefinitions()) {
    if (config.excludeTools?.includes(def.name)) continue;
    if (config.tools && !config.tools.includes(def.name)) continue;

    const entry = sourceRegistry.get(def.name);
    if (entry) {
      registry.register(entry.definition, entry.executor);
    }
  }

  return registry;
}

export function buildSubagentConfig(
  parentConfig: AgentConfig,
  config: SubagentConfig,
  registry: ToolRegistry,
): AgentConfig {
  const subCapabilities = parentConfig.capabilities
    ? { ...parentConfig.capabilities, subagentManager: undefined }
    : undefined;

  return {
    provider: parentConfig.provider,
    model: config.model || parentConfig.model,
    toolRegistry: registry,
    systemPrompt: buildSubagentPrompt(config),
    maxIterations: config.maxIterations ?? parentConfig.maxIterations ?? 20,
    workingDir: parentConfig.workingDir,
    contextConfig: parentConfig.contextConfig,
    capabilities: subCapabilities,
  };
}

function buildSubagentPrompt(config: SubagentConfig): string {
  const role = config.roleDescription || 'a specialized AI assistant';

  return `You are ${role}, working as a subagent.

## Your Task
${config.task}

## Guidelines
- Focus only on the assigned task
- Be concise and efficient
- When done, provide a clear summary of what you accomplished
- If you cannot complete the task, explain why`;
}
