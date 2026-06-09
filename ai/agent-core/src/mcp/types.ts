/**
 * MCP (Model Context Protocol) types.
 * Based on the MCP specification - JSON-RPC based protocol.
 */

// ============================================================
// JSON-RPC
// ============================================================

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse;

// ============================================================
// MCP Protocol Types
// ============================================================

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;  // base64
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  };
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

// ============================================================
// Transport
// ============================================================

export interface ITransport {
  connect(): Promise<void>;
  send(message: JSONRPCRequest): Promise<void>;
  onMessage(handler: (message: JSONRPCResponse) => void): void;
  close(): Promise<void>;
  /**
   * Register a handler for incoming requests (server-side).
   * Not all transports support server mode.
   */
  onRequest?(handler: (request: JSONRPCRequest) => void): void;
  /**
   * Send a response back to the client (server-side).
   */
  sendResponse?(response: JSONRPCResponse): Promise<void>;
}
