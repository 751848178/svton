import { describe, expect, it } from 'vitest';
import { MCPServer } from '../src/mcp/server';

describe('MCPServer error formatting', () => {
  it('normalizes non-Error request handling failures', async () => {
    const registry = {
      listDefinitions: () => [],
    };
    // Security (§7.4): inbound tool calls go through a wired execution service.
    // A non-Error throw inside it must be normalized, not surfaced as [object Object].
    const throwingService = {
      async *execute() {
        throw { code: 'mcp_tool_down' };
      },
    };

    const server = new MCPServer();
    (server as any).toolRegistry = registry;
    server.setToolExecutionService(throwingService as never);

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'explode', arguments: {} },
    });

    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32603);
    expect(response.error?.message).toBe('Unknown error');
    expect(response.error?.message).not.toContain('[object Object]');
  });
});
