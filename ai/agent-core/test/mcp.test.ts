import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ITransport,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPToolDefinition,
  MCPServerInfo,
} from '@svton/agent-core';
import { MCPClient, MCPServer } from '@svton/agent-core';
import { ToolRegistry } from '@svton/agent-core';
import type { IToolExecutor, ToolCall, ToolResult } from '@svton/agent-core';

// ============================================================
// Mock Transport
// ============================================================

class MockTransport implements ITransport {
  private messageHandler: ((msg: JSONRPCResponse) => void) | null = null;
  private responseMap = new Map<string, unknown>();
  public connectSpy = vi.fn();
  public closeSpy = vi.fn();
  public sentRequests: JSONRPCRequest[] = [];

  setResponse(method: string, result: unknown) {
    this.responseMap.set(method, result);
  }

  async connect() {
    this.connectSpy();
  }

  async send(request: JSONRPCRequest) {
    this.sentRequests.push(request);
    if (this.messageHandler) {
      const result = this.responseMap.get(request.method);
      this.messageHandler({
        jsonrpc: '2.0',
        id: request.id,
        result,
      });
    }
  }

  onMessage(handler: (msg: JSONRPCResponse) => void) {
    this.messageHandler = handler;
  }

  async close() {
    this.closeSpy();
  }
}

// ============================================================
// MCPClient Tests
// ============================================================

describe('MCPClient', () => {
  let client: MCPClient;
  let transport: MockTransport;

  beforeEach(() => {
    client = new MCPClient();
    transport = new MockTransport();
  });

  it('should not be connected before connect()', () => {
    expect(client.connected).toBe(false);
    expect(client.info).toBeNull();
  });

  it('connect sends initialize and stores serverInfo', async () => {
    const serverInfo: MCPServerInfo = { name: 'test-server', version: '1.0.0' };

    transport.setResponse('initialize', {
      serverInfo,
      capabilities: { tools: { listChanged: false } },
    });
    // The client also sends notifications/initialized after the init request.
    // Provide a default response so it doesn't time out.
    transport.setResponse('notifications/initialized', {});

    await client.connect(transport);

    expect(client.connected).toBe(true);
    expect(client.info).toEqual(serverInfo);
    expect(transport.connectSpy).toHaveBeenCalledTimes(1);

    // First sent request should be initialize
    const initRequest = transport.sentRequests.find((r) => r.method === 'initialize');
    expect(initRequest).toBeDefined();
    expect(initRequest!.params).toMatchObject({
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'svton-agent', version: '0.1.0' },
    });
  });

  it('listTools calls tools/list and caches result', async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
      {
        name: 'write_file',
        description: 'Write a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ];

    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('tools/list', { tools });

    await client.connect(transport);
    const result = await client.listTools();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('read_file');
    expect(result[1].name).toBe('write_file');

    // Verify caching: second call should not send a new request
    const sentBefore = transport.sentRequests.filter((r) => r.method === 'tools/list').length;
    await client.listTools();
    const sentAfter = transport.sentRequests.filter((r) => r.method === 'tools/list').length;
    expect(sentAfter).toBe(sentBefore);
  });

  it('listTools returns cached tool copies so callers cannot mutate the cache', async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
    ];

    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('tools/list', { tools });

    await client.connect(transport);
    const first = await client.listTools();
    first[0].name = 'injected_tool';
    first[0].inputSchema.properties!.path = { type: 'number' };
    first[0].inputSchema.required!.push('extra');
    tools[0].description = 'Injected source description';

    const fresh = await client.listTools();
    expect(fresh[0].name).toBe('read_file');
    expect(fresh[0].description).toBe('Read a file');
    expect(fresh[0].inputSchema.properties!.path).toEqual({ type: 'string' });
    expect(fresh[0].inputSchema.required).toEqual(['path']);
  });

  it('callTool calls tools/call and returns ToolResult', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('tools/call', {
      content: [
        { type: 'text', text: 'Hello from tool' },
        { type: 'text', text: 'Second line' },
      ],
      isError: false,
    });

    await client.connect(transport);
    const result = await client.callTool('greet', { name: 'world' });

    expect(result.output).toBe('Hello from tool\nSecond line');
    expect(result.isError).toBe(false);
    expect(result.callId).toMatch(/^mcp_/);

    // Verify the request was sent with correct params
    const callReq = transport.sentRequests.find((r) => r.method === 'tools/call');
    expect(callReq).toBeDefined();
    expect(callReq!.params).toEqual({ name: 'greet', arguments: { name: 'world' } });
  });

  it('toToolDefinitions converts MCP tools to ToolRegistry format with mcp__<server>__<tool> naming', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'my-server', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});

    await client.connect(transport);

    const mcpTools: MCPToolDefinition[] = [
      {
        name: 'search',
        description: 'Search for things',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const defs = client.toToolDefinitions(mcpTools);

    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('mcp__my-server__search');
    expect(defs[0].description).toBe('Search for things');
    expect(defs[0].parameters.type).toBe('object');
    expect(defs[0].parameters.properties).toEqual({ query: { type: 'string' } });
    expect(defs[0].annotations?.openWorldHint).toBe(true);
  });

  it('toToolDefinitions copies MCP input schemas before bridging to ToolRegistry definitions', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'my-server', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});

    await client.connect(transport);

    const mcpTools: MCPToolDefinition[] = [
      {
        name: 'search',
        description: 'Search for things',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const defs = client.toToolDefinitions(mcpTools);
    mcpTools[0].inputSchema.properties!.query = { type: 'number' };
    mcpTools[0].inputSchema.required!.push('extra');

    expect(defs[0].parameters.properties.query).toEqual({ type: 'string' });
    expect(defs[0].parameters.required).toEqual(['query']);
  });

  it('toToolDefinitions uses fallback when serverInfo is null', () => {
    // Client not connected, serverInfo is null
    const mcpTools: MCPToolDefinition[] = [
      {
        name: 'search',
        description: undefined,
        inputSchema: { type: 'object', properties: {} },
      },
    ];

    const defs = client.toToolDefinitions(mcpTools);

    expect(defs[0].name).toBe('mcp__unknown__search');
    expect(defs[0].description).toBe('MCP tool: search');
  });

  it('createToolExecutor delegates to callTool', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('tools/call', {
      content: [{ type: 'text', text: 'executed' }],
    });

    await client.connect(transport);
    const executor = client.createToolExecutor('my_tool');

    const call: ToolCall = {
      id: 'call_1',
      name: 'my_tool',
      arguments: { arg1: 'value1' },
    };

    const result = await executor.execute(call, {
      platform: null as any,
      sessionId: '',
      workingDir: '/',
    });

    expect(result.output).toBe('executed');
  });

  it('disconnect closes transport and clears connected state', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});

    await client.connect(transport);
    expect(client.connected).toBe(true);

    await client.disconnect();

    expect(client.connected).toBe(false);
    // Note: serverInfo persists after disconnect (only transport is cleared)
    expect(transport.closeSpy).toHaveBeenCalledTimes(1);
  });

  it('listResources calls resources/list and caches', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('resources/list', {
      resources: [
        { uri: 'file:///a.txt', name: 'a' },
        { uri: 'file:///b.txt', name: 'b' },
      ],
    });

    await client.connect(transport);
    const resources = await client.listResources();

    expect(resources).toHaveLength(2);
    expect(resources[0].uri).toBe('file:///a.txt');
  });

  it('listResources returns cached resource copies', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('resources/list', {
      resources: [{ uri: 'file:///a.txt', name: 'a' }],
    });

    await client.connect(transport);
    const first = await client.listResources();
    first[0].name = 'injected';

    const fresh = await client.listResources();
    expect(fresh[0].name).toBe('a');
  });

  it('readResource calls resources/read', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('resources/read', {
      contents: [{ uri: 'file:///a.txt', text: 'hello world' }],
    });

    await client.connect(transport);
    const contents = await client.readResource('file:///a.txt');

    expect(contents).toHaveLength(1);
    expect(contents[0].text).toBe('hello world');
  });

  it('listPrompts calls prompts/list', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('prompts/list', {
      prompts: [
        { name: 'code_review', description: 'Review code' },
      ],
    });

    await client.connect(transport);
    const prompts = await client.listPrompts();

    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('code_review');
  });

  it('listPrompts returns cached prompt copies', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('prompts/list', {
      prompts: [
        { name: 'code_review', description: 'Review code', arguments: [{ name: 'path', required: true }] },
      ],
    });

    await client.connect(transport);
    const first = await client.listPrompts();
    first[0].name = 'injected';
    first[0].arguments![0].required = false;

    const fresh = await client.listPrompts();
    expect(fresh[0].name).toBe('code_review');
    expect(fresh[0].arguments![0].required).toBe(true);
  });

  it('getPrompt calls prompts/get with arguments', async () => {
    transport.setResponse('initialize', {
      serverInfo: { name: 'test', version: '1.0.0' },
      capabilities: {},
    });
    transport.setResponse('notifications/initialized', {});
    transport.setResponse('prompts/get', {
      messages: [
        { role: 'user', content: { type: 'text', text: 'Review this code' } },
      ],
    });

    await client.connect(transport);
    const messages = await client.getPrompt('code_review', { lang: 'ts' });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');

    const req = transport.sentRequests.find((r) => r.method === 'prompts/get');
    expect(req!.params).toEqual({ name: 'code_review', arguments: { lang: 'ts' } });
  });

  it('operations throw when not connected', async () => {
    await expect(client.listTools()).rejects.toThrow('Not connected');
    await expect(client.callTool('x', {})).rejects.toThrow('Not connected');
  });
});

// ============================================================
// MCPServer Tests
// ============================================================

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  it('handleRequest initialize returns capabilities and serverInfo', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.1.0' },
      },
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result).toMatchObject({
      protocolVersion: '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'svton-agent', version: '0.1.0' },
    });
    expect(response.error).toBeUndefined();
  });

  it('handleRequest tools/list returns tools from registry', async () => {
    const registry = new ToolRegistry();
    const mockExecutor: IToolExecutor = {
      execute: async (call: ToolCall) => ({
        callId: call.id,
        output: 'ok',
      }),
    };
    registry.register(
      {
        name: 'bash',
        description: 'Run a command',
        parameters: { type: 'object', properties: { cmd: { type: 'string' } } },
      },
      mockExecutor,
    );

    const transport = new MockTransport();
    await server.start(transport, registry);

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(response.result).toMatchObject({
      tools: [{ name: 'bash', description: 'Run a command' }],
    });
  });

  it('handleRequest tools/call executes tool and returns content', async () => {
    const registry = new ToolRegistry();
    const mockExecutor: IToolExecutor = {
      execute: async (call: ToolCall) => ({
        callId: call.id,
        output: `Result: ${call.arguments.cmd}`,
      }),
    };
    registry.register(
      {
        name: 'bash',
        description: 'Run command',
        parameters: { type: 'object', properties: { cmd: { type: 'string' } } },
      },
      mockExecutor,
    );

    const transport = new MockTransport();
    await server.start(transport, registry);

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'bash', arguments: { cmd: 'echo hi' } },
    });

    expect(response.result).toMatchObject({
      content: [{ type: 'text', text: 'Result: echo hi' }],
    });
    expect(response.error).toBeUndefined();
  });

  it('handleRequest tools/call returns error when params missing', async () => {
    const registry = new ToolRegistry();
    const transport = new MockTransport();
    await server.start(transport, registry);

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: undefined,
    });

    expect(response.result).toMatchObject({
      content: [{ type: 'text', text: 'Missing parameters' }],
      isError: true,
    });
  });

  it('handleRequest ping returns empty result', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'ping',
    });

    expect(response.result).toEqual({});
    expect(response.error).toBeUndefined();
  });

  it('handleRequest unknown method returns error -32601', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'nonexistent/method',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
    expect(response.error!.message).toContain('Method not found');
  });

  it('handleRequest resources/list returns empty array', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/list',
    });

    expect(response.result).toEqual({ resources: [] });
  });

  it('handleRequest prompts/list returns empty array', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 8,
      method: 'prompts/list',
    });

    expect(response.result).toEqual({ prompts: [] });
  });

  it('stop closes the transport', async () => {
    const transport = new MockTransport();
    await server.start(transport, new ToolRegistry());
    await server.stop();
    expect(transport.closeSpy).toHaveBeenCalledTimes(1);
  });

  it('handleRequest tools/list returns empty when no registry', async () => {
    // Server started without calling start(), so toolRegistry is null
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/list',
    });

    expect(response.result).toEqual({ tools: [] });
  });
});
