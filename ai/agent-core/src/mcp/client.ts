import type {
  ITransport,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPToolDefinition,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptMessage,
  MCPCapabilities,
  MCPServerInfo,
} from './types';
import type { ToolDefinition } from '../provider/types';
import type { ToolCall, ToolResult, IToolExecutor } from '../tool/types';

/**
 * MCP Client - connects to external MCP servers to discover and use tools, resources, prompts.
 */
export class MCPClient {
  private transport: ITransport | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (response: JSONRPCResponse) => void;
      reject: (error: Error) => void;
    }
  >();
  private serverInfo: MCPServerInfo | null = null;
  private capabilities: MCPCapabilities | null = null;
  private toolCache: MCPToolDefinition[] | null = null;
  private resourceCache: MCPResource[] | null = null;
  private promptCache: MCPPrompt[] | null = null;

  get connected(): boolean {
    return this.transport !== null;
  }

  get info(): MCPServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Connect to an MCP server via a transport.
   */
  async connect(transport: ITransport): Promise<void> {
    this.transport = transport;

    // Set up message handler
    transport.onMessage((message) => {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message);
        }
      }
    });

    await transport.connect();

    // Initialize
    const initResult = await this.sendRequest<{
      serverInfo: MCPServerInfo;
      capabilities: MCPCapabilities;
    }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'svton-agent', version: '0.1.0' },
    });

    this.serverInfo = initResult.serverInfo;
    this.capabilities = initResult.capabilities;

    // Send initialized notification
    await this.sendNotification('notifications/initialized');
  }

  /**
   * Disconnect from the server.
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.pendingRequests.clear();
    this.toolCache = null;
    this.resourceCache = null;
    this.promptCache = null;
  }

  // ----------------------------------------------------------
  // Tools
  // ----------------------------------------------------------

  /**
   * List available tools from the server.
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    if (this.toolCache) return this.toolCache;

    const result = await this.sendRequest<{ tools: MCPToolDefinition[] }>(
      'tools/list',
    );
    this.toolCache = result.tools;
    return result.tools;
  }

  /**
   * Call a tool on the server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const result = await this.sendRequest<{
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    }>('tools/call', { name, arguments: args });

    const output = result.content
      .map((c) => c.text || '')
      .filter(Boolean)
      .join('\n');

    return {
      callId: `mcp_${Date.now()}`,
      output,
      isError: result.isError,
    };
  }

  // ----------------------------------------------------------
  // Resources
  // ----------------------------------------------------------

  /**
   * List available resources.
   */
  async listResources(): Promise<MCPResource[]> {
    if (this.resourceCache) return this.resourceCache;

    const result = await this.sendRequest<{ resources: MCPResource[] }>(
      'resources/list',
    );
    this.resourceCache = result.resources;
    return result.resources;
  }

  /**
   * Read a resource.
   */
  async readResource(uri: string): Promise<MCPResourceContent[]> {
    const result = await this.sendRequest<{ contents: MCPResourceContent[] }>(
      'resources/read',
      { uri },
    );
    return result.contents;
  }

  // ----------------------------------------------------------
  // Prompts
  // ----------------------------------------------------------

  /**
   * List available prompt templates.
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    if (this.promptCache) return this.promptCache;

    const result = await this.sendRequest<{ prompts: MCPPrompt[] }>(
      'prompts/list',
    );
    this.promptCache = result.prompts;
    return result.prompts;
  }

  /**
   * Get a prompt template.
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<MCPPromptMessage[]> {
    const result = await this.sendRequest<{ messages: MCPPromptMessage[] }>(
      'prompts/get',
      { name, arguments: args },
    );
    return result.messages;
  }

  // ----------------------------------------------------------
  // Tool Bridge - convert MCP tools to ToolRegistry format
  // ----------------------------------------------------------

  /**
   * Convert MCP tools to ToolDefinition format for ToolRegistry.
   */
  toToolDefinitions(tools: MCPToolDefinition[]): ToolDefinition[] {
    return tools.map((tool) => {
      const { type: _, ...schemaRest } = tool.inputSchema as Record<string, unknown>;
      return {
        name: `mcp__${this.serverInfo?.name || 'unknown'}__${tool.name}`,
        description: tool.description || `MCP tool: ${tool.name}`,
        parameters: {
          type: 'object' as const,
          properties: (schemaRest.properties || {}) as Record<string, unknown>,
          required: schemaRest.required as string[] | undefined,
        },
        annotations: {
          openWorldHint: true,
        },
      };
    });
  }

  /**
   * Create an IToolExecutor that delegates to this MCP client.
   */
  createToolExecutor(toolName: string): IToolExecutor {
    return {
      execute: async (call: ToolCall, _context) => {
        return this.callTool(toolName, call.arguments);
      },
    };
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.transport) throw new Error('Not connected');

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = await new Promise<JSONRPCResponse>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport!.send(request).catch(reject);

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });

    return response.result as T;
  }

  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.transport) throw new Error('Not connected');

    await this.transport.send({
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    });
  }
}
