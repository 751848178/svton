import type {
  ITransport,
  JSONRPCRequest,
  JSONRPCResponse,
  MCPToolDefinition,
  MCPResource,
  MCPPrompt,
  MCPServerInfo,
} from './types';
import type { ToolRegistry } from '../tool/registry';
import type { IToolExecutor, ToolCall } from '../tool/types';
import { formatUnknownErrorMessage } from '../utils/error-message.utils';

/**
 * MCP Server - exposes Agent's tools to external MCP clients.
 *
 * Allows external applications to discover and invoke the Agent's tools
 * via the MCP protocol (JSON-RPC).
 */
export class MCPServer {
  private transport: ITransport | null = null;
  private toolRegistry: ToolRegistry | null = null;
  private requestId = 0;
  private running = false;

  private readonly serverInfo: MCPServerInfo = {
    name: 'svton-agent',
    version: '0.1.0',
  };

  /**
   * Start the MCP server with a transport and tool registry.
   */
  async start(transport: ITransport, toolRegistry: ToolRegistry): Promise<void> {
    this.transport = transport;
    this.toolRegistry = toolRegistry;
    this.running = true;

    await transport.connect();

    // Set up request handler if transport supports server mode
    if (transport.onRequest) {
      transport.onRequest(async (request) => {
        if (!this.running) return;
        const response = await this.handleRequest(request);
        if (transport.sendResponse) {
          await transport.sendResponse(response);
        }
      });
    }
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  /**
   * Handle an incoming JSON-RPC request.
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      let result: unknown;

      switch (request.method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: this.serverInfo,
          };
          break;

        case 'tools/list':
          result = { tools: this.listTools() };
          break;

        case 'tools/call':
          result = await this.callTool(request.params);
          break;

        case 'resources/list':
          result = { resources: [] };
          break;

        case 'prompts/list':
          result = { prompts: [] };
          break;

        case 'ping':
          result = {};
          break;

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`,
            },
          };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: formatUnknownErrorMessage(error),
        },
      };
    }
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private listTools(): MCPToolDefinition[] {
    if (!this.toolRegistry) return [];

    return this.toolRegistry.listDefinitions().map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.parameters,
    }));
  }

  private async callTool(
    params?: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    if (!this.toolRegistry || !params) {
      return {
        content: [{ type: 'text', text: 'Missing parameters' }],
        isError: true,
      };
    }

    const name = params.name as string;
    const args = (params.arguments as Record<string, unknown>) || {};

    const call: ToolCall = {
      id: `mcp_server_${++this.requestId}`,
      name,
      arguments: args,
    };

    const result = await this.toolRegistry.execute(call, {
      platform: null as any,
      sessionId: '',
      workingDir: '/',
    });

    return {
      content: [{ type: 'text', text: result.output }],
      isError: result.isError,
    };
  }

}
