import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ITransport,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@svton/agent-core';
import { MCPServer, ToolRegistry } from '@svton/agent-core';
import type { IToolExecutor, ToolCall, ToolResult } from '@svton/agent-core';

// ============================================================
// Mock Transport (server-aware)
// ============================================================

class MockTransport implements ITransport {
  public connectSpy = vi.fn();
  public closeSpy = vi.fn();
  public sentRequests: JSONRPCRequest[] = [];
  private messageHandler: ((msg: JSONRPCResponse) => void) | null = null;
  private requestHandler: ((req: JSONRPCRequest) => void) | null = null;
  public sendResponseSpy = vi.fn();

  async connect() {
    this.connectSpy();
  }

  async send(request: JSONRPCRequest) {
    this.sentRequests.push(request);
  }

  onMessage(handler: (msg: JSONRPCResponse) => void) {
    this.messageHandler = handler;
  }

  onRequest(handler: (request: JSONRPCRequest) => void) {
    this.requestHandler = handler;
  }

  async sendResponse(response: JSONRPCResponse) {
    this.sendResponseSpy(response);
  }

  async close() {
    this.closeSpy();
  }

  /** Simulate an incoming request as if a client sent it */
  simulateRequest(request: JSONRPCRequest) {
    if (this.requestHandler) {
      this.requestHandler(request);
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function makeToolDef(name: string, description = `Description for ${name}`) {
  return {
    name,
    description,
    parameters: {
      type: 'object' as const,
      properties: { input: { type: 'string', description: 'Input value' } },
      required: ['input'],
    },
  };
}

function makeExecutor(output: string): IToolExecutor {
  return {
    execute: vi.fn(async (call: ToolCall): Promise<ToolResult> => ({
      callId: call.id,
      output,
    })),
  };
}

function makeRequest(
  method: string,
  params?: Record<string, unknown>,
  id: string | number = 1,
): JSONRPCRequest {
  return { jsonrpc: '2.0', id, method, params };
}

// ============================================================
// Tests
// ============================================================

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  // ----------------------------------------------------------
  // handleRequest — initialize
  // ----------------------------------------------------------

  describe('handleRequest — initialize', () => {
    it('returns correct protocolVersion, capabilities, and serverInfo', async () => {
      const response = await server.handleRequest(makeRequest('initialize'));

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'svton-agent', version: '0.1.0' },
      });
    });
  });

  // ----------------------------------------------------------
  // handleRequest — tools/list
  // ----------------------------------------------------------

  describe('handleRequest — tools/list', () => {
    it('returns tools from registry', async () => {
      const registry = new ToolRegistry();
      registry.register(makeToolDef('read_file', 'Read a file'), makeExecutor('file content'));
      registry.register(makeToolDef('write_file', 'Write a file'), makeExecutor('written'));

      const transport = new MockTransport();
      await server.start(transport, registry);

      const response = await server.handleRequest(makeRequest('tools/list'));

      expect(response.result).toEqual({
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object',
              properties: { input: { type: 'string', description: 'Input value' } },
              required: ['input'],
            },
          },
          {
            name: 'write_file',
            description: 'Write a file',
            inputSchema: {
              type: 'object',
              properties: { input: { type: 'string', description: 'Input value' } },
              required: ['input'],
            },
          },
        ],
      });
    });
  });

  // ----------------------------------------------------------
  // handleRequest — tools/call
  // ----------------------------------------------------------

  describe('handleRequest — tools/call', () => {
    it('invokes tool from registry and returns content', async () => {
      const registry = new ToolRegistry();
      const executor = makeExecutor('hello world');
      registry.register(makeToolDef('greet'), executor);

      const transport = new MockTransport();
      await server.start(transport, registry);

      const response = await server.handleRequest(
        makeRequest('tools/call', { name: 'greet', arguments: { input: 'test' } }),
      );

      expect(response.error).toBeUndefined();
      expect(response.result).toMatchObject({
        content: [{ type: 'text', text: 'hello world' }],
      });
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });

    it('with missing params returns error result', async () => {
      const registry = new ToolRegistry();
      const transport = new MockTransport();
      await server.start(transport, registry);

      const response = await server.handleRequest(makeRequest('tools/call'));

      expect(response.result).toMatchObject({
        content: [{ type: 'text', text: 'Missing parameters' }],
        isError: true,
      });
    });

    it('with no registry returns error result', async () => {
      // Do not call start() — toolRegistry remains null
      const response = await server.handleRequest(
        makeRequest('tools/call', { name: 'some_tool', arguments: {} }),
      );

      expect(response.result).toMatchObject({
        content: [{ type: 'text', text: 'Missing parameters' }],
        isError: true,
      });
    });
  });

  // ----------------------------------------------------------
  // handleRequest — resources/list
  // ----------------------------------------------------------

  describe('handleRequest — resources/list', () => {
    it('returns empty resources array', async () => {
      const response = await server.handleRequest(makeRequest('resources/list'));

      expect(response.result).toEqual({ resources: [] });
      expect(response.error).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // handleRequest — prompts/list
  // ----------------------------------------------------------

  describe('handleRequest — prompts/list', () => {
    it('returns empty prompts array', async () => {
      const response = await server.handleRequest(makeRequest('prompts/list'));

      expect(response.result).toEqual({ prompts: [] });
      expect(response.error).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // handleRequest — ping
  // ----------------------------------------------------------

  describe('handleRequest — ping', () => {
    it('returns empty result', async () => {
      const response = await server.handleRequest(makeRequest('ping'));

      expect(response.result).toEqual({});
      expect(response.error).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // handleRequest — unknown method
  // ----------------------------------------------------------

  describe('handleRequest — unknown method', () => {
    it('returns -32601 error', async () => {
      const response = await server.handleRequest(makeRequest('custom/method'));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toContain('Method not found');
      expect(response.error!.message).toContain('custom/method');
      expect(response.result).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // handleRequest — exception → -32603
  // ----------------------------------------------------------

  describe('handleRequest — exception', () => {
    it('returns -32603 error when listDefinitions throws', async () => {
      // Create a registry whose listDefinitions throws
      const registry = new ToolRegistry();
      // Sabotage by overriding the method
      registry.listDefinitions = () => {
        throw new Error('Registry exploded');
      };

      const transport = new MockTransport();
      await server.start(transport, registry);

      const response = await server.handleRequest(makeRequest('tools/list'));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toContain('Registry exploded');
    });
  });

  // ----------------------------------------------------------
  // start
  // ----------------------------------------------------------

  describe('start', () => {
    it('connects transport and sets onRequest handler', async () => {
      const transport = new MockTransport();
      const registry = new ToolRegistry();

      await server.start(transport, registry);

      expect(transport.connectSpy).toHaveBeenCalledTimes(1);
      expect(transport.requestHandler).not.toBeNull();
    });

    it('forwards incoming requests and sends responses back', async () => {
      const transport = new MockTransport();
      const registry = new ToolRegistry();
      registry.register(makeToolDef('ping_tool'), makeExecutor('pong'));

      await server.start(transport, registry);

      // Simulate a client sending a request
      await new Promise<void>((resolve) => {
        transport.simulateRequest(makeRequest('tools/list', undefined, 42));
        // The onRequest handler is async; let it run
        setTimeout(resolve, 0);
      });

      expect(transport.sendResponseSpy).toHaveBeenCalledTimes(1);
      const sentResponse = transport.sendResponseSpy.mock.calls[0][0] as JSONRPCResponse;
      expect(sentResponse.id).toBe(42);
      expect(sentResponse.result).toMatchObject({
        tools: [{ name: 'ping_tool' }],
      });
    });
  });

  // ----------------------------------------------------------
  // stop
  // ----------------------------------------------------------

  describe('stop', () => {
    it('closes transport and clears state', async () => {
      const transport = new MockTransport();
      const registry = new ToolRegistry();

      await server.start(transport, registry);
      await server.stop();

      expect(transport.closeSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throw when called without start', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
