import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import {
  McpMarketplace,
} from '@svton/agent-core';

// ============================================================
// MockStorage
// ============================================================

class MockStorage implements IStorage {
  private data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ============================================================
// Fetch Mock
// ============================================================

const originalFetch = globalThis.fetch;

function mockFetchResponse(data: unknown, status = 200, statusText = 'OK') {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => data,
  }));
}

let fetchMock: ReturnType<typeof mockFetchResponse>;

beforeEach(() => {
  fetchMock = mockFetchResponse({});
  globalThis.fetch = fetchMock as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ============================================================
// Sample Data
// ============================================================

const sampleServerSummary = {
  id: 'srv-1',
  qualifiedName: '@acme/search',
  displayName: 'Acme Search',
  description: 'A search MCP server',
  iconUrl: 'https://example.com/icon.png',
  verified: true,
  useCount: 1234,
  remote: true,
  createdAt: '2025-01-01T00:00:00Z',
  homepage: 'https://acme.com',
};

const samplePagination = {
  currentPage: 1,
  pageSize: 20,
  totalPages: 3,
  totalCount: 55,
};

const sampleConnection = (overrides: Record<string, unknown> = {}) => ({
  type: 'stdio',
  runtime: 'node',
  ...overrides,
});

const sampleTool = {
  name: 'search',
  description: 'Search the web',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
};

const sampleServerDetail = {
  qualifiedName: '@acme/search',
  displayName: 'Acme Search',
  description: 'A search MCP server',
  iconUrl: 'https://example.com/icon.png',
  remote: true,
  connections: [sampleConnection()],
  tools: [sampleTool],
};

// ============================================================
// Tests
// ============================================================

describe('McpMarketplace', () => {
  // ----------------------------------------------------------
  // search
  // ----------------------------------------------------------

  describe('search', () => {
    it('maps response correctly', async () => {
      fetchMock = mockFetchResponse({
        servers: [sampleServerSummary],
        pagination: samplePagination,
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const result = await mp.search('acme');

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]).toEqual({
        id: 'srv-1',
        qualifiedName: '@acme/search',
        displayName: 'Acme Search',
        description: 'A search MCP server',
        iconUrl: 'https://example.com/icon.png',
        verified: true,
        useCount: 1234,
        remote: true,
        createdAt: '2025-01-01T00:00:00Z',
        homepage: 'https://acme.com',
      });
      expect(result.pagination).toEqual(samplePagination);

      // Verify correct URL was called
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/servers?');
      expect(calledUrl).toContain('q=acme');
    });

    it('uses default pagination when API omits it', async () => {
      fetchMock = mockFetchResponse({
        servers: [sampleServerSummary],
        // no pagination field
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const result = await mp.search('test', 2, 10);

      expect(result.pagination).toEqual({
        currentPage: 2,
        pageSize: 10,
        totalPages: 1,
        totalCount: 0,
      });
    });
  });

  // ----------------------------------------------------------
  // list
  // ----------------------------------------------------------

  describe('list', () => {
    it('fetches servers', async () => {
      fetchMock = mockFetchResponse({
        servers: [sampleServerSummary],
        pagination: samplePagination,
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const result = await mp.list();

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].qualifiedName).toBe('@acme/search');

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/servers?');
      expect(calledUrl).not.toContain('q=');
    });
  });

  // ----------------------------------------------------------
  // getServer
  // ----------------------------------------------------------

  describe('getServer', () => {
    it('returns detail with connections and tools', async () => {
      fetchMock = mockFetchResponse(sampleServerDetail);
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const detail = await mp.getServer('@acme/search');

      expect(detail.qualifiedName).toBe('@acme/search');
      expect(detail.displayName).toBe('Acme Search');
      expect(detail.connections).toHaveLength(1);
      expect(detail.connections[0].type).toBe('stdio');
      expect(detail.connections[0].runtime).toBe('node');
      expect(detail.tools).toHaveLength(1);
      expect(detail.tools![0].name).toBe('search');

      // Verify URL encoding
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/servers/%40acme%2Fsearch');
    });
  });

  // ----------------------------------------------------------
  // install
  // ----------------------------------------------------------

  describe('install', () => {
    it('HTTP server — saves http config', async () => {
      fetchMock = mockFetchResponse({
        ...sampleServerDetail,
        connections: [sampleConnection({ type: 'http', deploymentUrl: 'https://mcp.acme.com/sse' })],
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const storage = new MockStorage();
      const config = await mp.install('@acme/search', storage);

      expect(config).toEqual({
        name: 'Acme Search',
        transport: 'http',
        url: 'https://mcp.acme.com/sse',
        enabled: true,
      });

      // Verify saved in storage
      const saved = await storage.get<unknown[]>('agent:mcp_servers');
      expect(saved).toHaveLength(1);
      expect((saved![0] as any).url).toBe('https://mcp.acme.com/sse');
    });

    it('stdio server — saves stdio config with npx', async () => {
      fetchMock = mockFetchResponse({
        ...sampleServerDetail,
        connections: [sampleConnection({ type: 'stdio', runtime: 'node' })],
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const storage = new MockStorage();
      const config = await mp.install('@acme/search', storage);

      expect(config).toEqual({
        name: 'Acme Search',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@smithery/cli@latest', 'run', '@acme/search'],
        enabled: true,
      });

      const saved = await storage.get<unknown[]>('agent:mcp_servers');
      expect(saved).toHaveLength(1);
    });

    it('python runtime — saves with python command', async () => {
      fetchMock = mockFetchResponse({
        ...sampleServerDetail,
        connections: [sampleConnection({ type: 'stdio', runtime: 'python' })],
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const storage = new MockStorage();
      const config = await mp.install('@acme/search', storage);

      expect(config).toEqual({
        name: 'Acme Search',
        transport: 'stdio',
        command: 'python',
        args: ['-m', 'search'],
        enabled: true,
      });
    });

    it('no connections — throws', async () => {
      fetchMock = mockFetchResponse({
        ...sampleServerDetail,
        connections: [],
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const storage = new MockStorage();

      await expect(mp.install('@acme/search', storage)).rejects.toThrow(
        'No connection info available for @acme/search',
      );
    });

    it('duplicate name — skips saving', async () => {
      fetchMock = mockFetchResponse({
        ...sampleServerDetail,
        connections: [sampleConnection({ type: 'http', deploymentUrl: 'https://mcp.acme.com/sse' })],
      });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      const storage = new MockStorage();

      // Pre-populate storage with a server that has the same name
      await storage.set('agent:mcp_servers', [
        { name: 'Acme Search', transport: 'http', url: 'https://old.example.com', enabled: true },
      ]);

      const config = await mp.install('@acme/search', storage);

      // Config is still returned
      expect(config.name).toBe('Acme Search');
      expect(config.url).toBe('https://mcp.acme.com/sse');

      // But storage should NOT have been updated (duplicate skipped)
      const saved = await storage.get<unknown[]>('agent:mcp_servers');
      expect(saved).toHaveLength(1);
      expect((saved![0] as any).url).toBe('https://old.example.com');
    });
  });

  // ----------------------------------------------------------
  // constructor
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('uses custom baseUrl', async () => {
      fetchMock = mockFetchResponse({ servers: [], pagination: null });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace(undefined, 'https://custom.api.com');
      await mp.list();

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://custom.api.com');
    });

    it('sets auth header when apiKey provided', async () => {
      fetchMock = mockFetchResponse({ servers: [], pagination: null });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace('my-secret-key');
      await mp.list();

      const fetchOptions = fetchMock.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.headers).toMatchObject({
        Authorization: 'Bearer my-secret-key',
      });
    });

    it('uses default baseUrl when none provided', async () => {
      fetchMock = mockFetchResponse({ servers: [], pagination: null });
      globalThis.fetch = fetchMock as any;

      const mp = new McpMarketplace();
      await mp.list();

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.smithery.ai');
    });
  });
});
