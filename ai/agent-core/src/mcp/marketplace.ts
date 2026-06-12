/**
 * Smithery.ai MCP Server Marketplace Client.
 *
 * Browse, search, and install MCP servers from the Smithery registry.
 * API docs: https://smithery.ai/docs
 */

import type { IStorage } from '@svton/agent-platform';

// ============================================================
// Response Types
// ============================================================

export interface McpMarketplaceServer {
  id: string;
  qualifiedName: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  verified: boolean;
  useCount: number;
  remote: boolean | null;
  createdAt: string;
  homepage: string;
}

export interface McpMarketplaceServerDetail {
  qualifiedName: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  remote: boolean;
  connections: McpServerConnection[];
  tools: McpServerToolInfo[] | null;
}

export interface McpServerConnection {
  type: 'stdio' | 'http';
  /** For stdio: bundle download URL */
  bundleUrl?: string;
  /** For stdio: runtime type */
  runtime?: 'node' | 'binary' | 'python' | 'bun';
  /** For http: the MCP endpoint URL */
  deploymentUrl?: string;
  /** Configuration schema for this connection */
  configSchema?: Record<string, unknown>;
}

export interface McpServerToolInfo {
  name: string;
  description: string | null;
  inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
}

export interface McpMarketplaceResult {
  servers: McpMarketplaceServer[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

// ============================================================
// Marketplace Client
// ============================================================

const DEFAULT_BASE_URL = 'https://api.smithery.ai';

export class McpMarketplace {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey?: string, baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
    this.headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  /**
   * Search MCP servers on Smithery.
   */
  async search(query: string, page = 1, pageSize = 20): Promise<McpMarketplaceResult> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
    });
    const data = await this.fetchJson(`/servers?${params}`);

    return {
      servers: (data.servers ?? []).map(mapServerSummary),
      pagination: data.pagination ?? { currentPage: page, pageSize, totalPages: 1, totalCount: 0 },
    };
  }

  /**
   * List/trending MCP servers.
   */
  async list(page = 1, pageSize = 20): Promise<McpMarketplaceResult> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const data = await this.fetchJson(`/servers?${params}`);

    return {
      servers: (data.servers ?? []).map(mapServerSummary),
      pagination: data.pagination ?? { currentPage: page, pageSize, totalPages: 1, totalCount: 0 },
    };
  }

  /**
   * Get detailed info for a specific MCP server.
   */
  async getServer(qualifiedName: string): Promise<McpMarketplaceServerDetail> {
    const encoded = encodeURIComponent(qualifiedName);
    const data = await this.fetchJson(`/servers/${encoded}`);

    return {
      qualifiedName: data.qualifiedName,
      displayName: data.displayName,
      description: data.description,
      iconUrl: data.iconUrl ?? null,
      remote: data.remote ?? false,
      connections: (data.connections ?? []).map(mapConnection),
      tools: Array.isArray(data.tools) ? data.tools.map(mapTool) : null,
    };
  }

  /**
   * Install an MCP server from Smithery into the app's config.
   * Returns an McpServerConfig-like object ready to be added.
   */
  async install(
    qualifiedName: string,
    storage: IStorage,
  ): Promise<{
    name: string;
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    enabled: boolean;
  }> {
    const detail = await this.getServer(qualifiedName);
    if (!detail.connections.length) {
      throw new Error(`No connection info available for ${qualifiedName}`);
    }

    const conn = detail.connections[0];
    const name = detail.displayName || detail.qualifiedName;

    if (conn.type === 'http' && conn.deploymentUrl) {
      const config = {
        name,
        transport: 'http' as const,
        url: conn.deploymentUrl,
        enabled: true,
      };

      // Save to installed MCP servers list
      await this.saveToConfig(config, storage);
      return config;
    }

    if (conn.type === 'stdio') {
      const config = {
        name,
        transport: 'stdio' as const,
        command: conn.runtime === 'python' ? 'python' : 'npx',
        args: conn.runtime === 'python'
          ? ['-m', detail.qualifiedName.split('/')[1] || detail.qualifiedName]
          : ['-y', `@smithery/cli@latest`, 'run', detail.qualifiedName],
        enabled: true,
      };

      await this.saveToConfig(config, storage);
      return config;
    }

    throw new Error(`Unsupported connection type for ${qualifiedName}`);
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async saveToConfig(
    config: { name: string; transport: string; enabled: boolean; url?: string; command?: string; args?: string[] },
    storage: IStorage,
  ): Promise<void> {
    const existing = await storage.get<unknown[]>('agent:mcp_servers');
    const servers = Array.isArray(existing) ? existing : [];
    // Avoid duplicate
    if (servers.some((s: any) => s.name === config.name)) return;
    servers.push(config);
    await storage.set('agent:mcp_servers', servers);
  }

  private async fetchJson(path: string): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const resp = await globalThis.fetch(url, {
      headers: {
        Accept: 'application/json',
        ...this.headers,
      },
    });
    if (!resp.ok) {
      throw new Error(`Smithery API error: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
  }
}

// ----------------------------------------------------------
// Mappers
// ----------------------------------------------------------

function mapServerSummary(raw: any): McpMarketplaceServer {
  return {
    id: raw.id ?? '',
    qualifiedName: raw.qualifiedName ?? '',
    displayName: raw.displayName ?? raw.qualifiedName ?? '',
    description: raw.description ?? '',
    iconUrl: raw.iconUrl ?? null,
    verified: raw.verified ?? false,
    useCount: raw.useCount ?? 0,
    remote: raw.remote ?? null,
    createdAt: raw.createdAt ?? '',
    homepage: raw.homepage ?? '',
  };
}

function mapConnection(raw: any): McpServerConnection {
  return {
    type: raw.type ?? 'stdio',
    bundleUrl: raw.bundleUrl,
    runtime: raw.runtime,
    deploymentUrl: raw.deploymentUrl,
    configSchema: raw.configSchema,
  };
}

function mapTool(raw: any): McpServerToolInfo {
  return {
    name: raw.name ?? '',
    description: raw.description ?? null,
    inputSchema: raw.inputSchema ?? { type: 'object' },
  };
}
