import type {
  ITransport,
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
import {
  cloneMcpPrompts,
  cloneMcpResources,
  cloneMcpTools,
  toToolDefinitions,
} from './catalog-snapshot.utils';
import { JsonRpcSession } from './jsonrpc-session.service';

/**
 * MCP Client - connects to external MCP servers to discover and use tools, resources, prompts.
 */
export class MCPClient {
  private readonly session = new JsonRpcSession();
  private serverInfo: MCPServerInfo | null = null;
  private capabilities: MCPCapabilities | null = null;
  private toolCache: MCPToolDefinition[] | null = null;
  private resourceCache: MCPResource[] | null = null;
  private promptCache: MCPPrompt[] | null = null;

  get connected(): boolean {
    return this.session.connected;
  }

  get info(): MCPServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Connect to an MCP server via a transport.
   */
  async connect(transport: ITransport): Promise<void> {
    await this.session.connect(transport);

    // Initialize
    const initResult = await this.session.sendRequest<{
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
    await this.session.sendNotification('notifications/initialized');
  }

  /**
   * Disconnect from the server.
   */
  async disconnect(): Promise<void> {
    await this.session.close();
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
    if (this.toolCache) return cloneMcpTools(this.toolCache);

    const result = await this.session.sendRequest<{ tools: MCPToolDefinition[] }>(
      'tools/list',
    );
    this.toolCache = cloneMcpTools(result.tools);
    return cloneMcpTools(this.toolCache);
  }

  /**
   * Call a tool on the server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const result = await this.session.sendRequest<{
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
    if (this.resourceCache) return cloneMcpResources(this.resourceCache);

    const result = await this.session.sendRequest<{ resources: MCPResource[] }>(
      'resources/list',
    );
    this.resourceCache = cloneMcpResources(result.resources);
    return cloneMcpResources(this.resourceCache);
  }

  /**
   * Read a resource.
   */
  async readResource(uri: string): Promise<MCPResourceContent[]> {
    const result = await this.session.sendRequest<{ contents: MCPResourceContent[] }>(
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
    if (this.promptCache) return cloneMcpPrompts(this.promptCache);

    const result = await this.session.sendRequest<{ prompts: MCPPrompt[] }>(
      'prompts/list',
    );
    this.promptCache = cloneMcpPrompts(result.prompts);
    return cloneMcpPrompts(this.promptCache);
  }

  /**
   * Get a prompt template.
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<MCPPromptMessage[]> {
    const result = await this.session.sendRequest<{ messages: MCPPromptMessage[] }>(
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
    return toToolDefinitions(tools, this.serverInfo?.name);
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
}
