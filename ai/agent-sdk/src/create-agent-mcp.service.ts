import {
  HTTPTransport,
  MCPClient,
  SSETransport,
} from '@svton/agent-core';
import type { McpServerToolConfig } from '@svton/agent-core';
import type { CreateAgentConfig } from './types';

export interface ConnectedMcpServers {
  clients: MCPClient[];
  toolConfigs: Map<string, McpServerToolConfig>;
}

/** Connect configured MCP servers and retain their per-server tool policy. */
export async function connectAgentMcpServers(
  configs: CreateAgentConfig['mcpServers'],
): Promise<ConnectedMcpServers> {
  const clients: MCPClient[] = [];
  const toolConfigs = new Map<string, McpServerToolConfig>();
  for (const serverConfig of configs ?? []) {
    const client = new MCPClient();
    const serverName = serverConfig.name || `mcp-${clients.length + 1}`;
    try {
      const transport = serverConfig.type === 'sse'
        ? new SSETransport({
          url: serverConfig.url,
          headers: serverConfig.headers,
        })
        : new HTTPTransport({
          url: serverConfig.url,
          headers: serverConfig.headers,
        });
      await client.connect(transport);
      clients.push(client);
      if (serverConfig.toolFilter) {
        toolConfigs.set(client.info?.name || serverName, {
          approvalMode: serverConfig.toolFilter.approvalMode,
          enabledTools: serverConfig.toolFilter.enabled,
          disabledTools: serverConfig.toolFilter.disabled,
        });
      }
    } catch (error) {
      console.warn(
        `[agent-sdk] Failed to connect MCP server "${serverName}" at ${serverConfig.url}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return { clients, toolConfigs };
}
