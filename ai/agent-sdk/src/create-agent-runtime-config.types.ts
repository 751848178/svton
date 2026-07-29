import type {
  AgentConfig,
  MCPClient,
  ToolRegistry,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

/** Initialized collaborators required by the SDK composition entrypoint. */
export interface PreparedAgentRuntimeConfig {
  agentConfig: AgentConfig;
  platform: IPlatform;
  toolRegistry: ToolRegistry;
  mcpClients: MCPClient[];
}
