import type { AgentConfig } from '@svton/agent-core';
import { createAgentConfig } from './create-agent-config';
import type { DefaultSettingsAdapter } from './default-settings-adapter';

type ConfigOptions = Parameters<typeof createAgentConfig>[0];

/** Builds one AgentApp config generation and publishes its settings projection. */
export async function initializeAgentAppConfig(
  options: ConfigOptions,
  adapter: DefaultSettingsAdapter,
  onUpdate: () => void,
): Promise<AgentConfig> {
  const config = await createAgentConfig(options);
  adapter.setAgentData({
    tools: config.toolRegistry.listDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
    skills: (config.capabilities?.skillManager?.list() ?? []).map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    permissionMode: config.capabilities?.permissionManager?.getMode() || 'default',
    hasMemory: !!config.capabilities?.memoryManager,
    memoryText: config.capabilities?.memoryManager?.getAllMemoryText?.() ?? '',
    mcpServers: (config.capabilities?.mcpClients ?? []).map((client) => ({
      name: client.info?.name || 'mcp',
      connected: client.connected,
    })),
    hasSubagent: !!config.capabilities?.subagentManager,
    hasPlanning: !!config.capabilities?.planningManager,
  });
  adapter.onUpdate = onUpdate;
  adapter.setAgentConfig(config);
  return config;
}
