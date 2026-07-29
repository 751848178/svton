import {
  HTTPTransport,
  MCPClient,
  PluginManager,
  SSETransport,
  type AgentCapabilities,
  type McpServerToolConfig,
} from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { FeatureFlags, McpServerEntry } from '../types';

interface ConnectAgentMcpOptions {
  platform: BrowserPlatform;
  features: FeatureFlags;
  servers: McpServerEntry[];
  capabilities: AgentCapabilities;
}

export async function connectAgentMcpCapabilities(
  options: ConnectAgentMcpOptions,
): Promise<void> {
  const { platform, features, servers, capabilities } = options;
  const clients: MCPClient[] = [];
  const serverConfigs = new Map<string, McpServerToolConfig>();
  const connectedKeys = new Set<string>();

  for (const config of servers) {
    if (config.enabled === false || !config.url) continue;
    const key = `${config.type || 'http'}:${config.url}`;
    if (connectedKeys.has(key)) continue;
    try {
      const client = new MCPClient();
      const transport = config.type === 'sse'
        ? new SSETransport({ url: config.url, headers: config.headers })
        : new HTTPTransport({ url: config.url, headers: config.headers });
      await client.connect(transport);
      clients.push(client);
      connectedKeys.add(key);
      const serverName = client.info?.name || config.name;
      if (config.approvalMode
        || config.enabledTools?.length
        || config.disabledTools?.length) {
        serverConfigs.set(serverName, {
          approvalMode: config.approvalMode,
          enabledTools: config.enabledTools,
          disabledTools: config.disabledTools,
        });
      }
    } catch (error) {
      console.error(`[agent-app] MCP server "${config.name}" connection failed:`, error);
    }
  }

  if (features.plugins !== false) {
    const pluginManager = new PluginManager();
    await pluginManager.init(platform.storage);
    capabilities.pluginManager = pluginManager;
    for (const plugin of pluginManager.getEnabledPlugins()) {
      for (const server of plugin.manifest.mcpServers ?? []) {
        if (server.enabled === false
          || server.transport === 'stdio'
          || !server.url) continue;
        const key = `http:${server.url}`;
        if (connectedKeys.has(key)) continue;
        try {
          const client = new MCPClient();
          await client.connect(new HTTPTransport({ url: server.url }));
          clients.push(client);
          connectedKeys.add(key);
          if (server.approvalMode) {
            serverConfigs.set(client.info?.name || server.name, {
              approvalMode: server.approvalMode,
            });
          }
        } catch (error) {
          console.error(
            `[agent-app] Plugin "${plugin.name}" MCP "${server.name}" failed:`,
            error,
          );
        }
      }
    }
  }

  if (clients.length > 0) capabilities.mcpClients = clients;
  if (serverConfigs.size > 0) capabilities.mcpServerConfigs = serverConfigs;
}
