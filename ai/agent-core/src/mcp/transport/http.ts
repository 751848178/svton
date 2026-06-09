import type { ITransport, JSONRPCRequest, JSONRPCResponse } from '../types';

/**
 * Streamable HTTP transport for MCP.
 * Uses HTTP POST for requests, SSE for streaming responses.
 */
export class HTTPTransport implements ITransport {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private messageHandler: ((message: JSONRPCResponse) => void) | null = null;
  private requestId = 0;
  private sessionUrl: string | null = null;

  constructor(config: { url: string; headers?: Record<string, string> }) {
    this.url = config.url;
    this.headers = config.headers || {};
  }

  async connect(): Promise<void> {
    // Send initialize request
    // The server may return a session URL via Mcp-Session-Id header
  }

  async send(message: JSONRPCRequest): Promise<void> {
    const url = this.sessionUrl || this.url;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...this.headers,
      },
      body: JSON.stringify(message),
    });

    // Capture session URL if provided
    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) {
      this.sessionUrl = sessionId;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Parse SSE response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);

            try {
              const parsed = JSON.parse(data);
              if (this.messageHandler) {
                this.messageHandler(parsed as JSONRPCResponse);
              }
            } catch {
              // Skip non-JSON data
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // JSON response
      const data = await response.json();
      if (this.messageHandler) {
        this.messageHandler(data as JSONRPCResponse);
      }
    }
  }

  onMessage(handler: (message: JSONRPCResponse) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    this.messageHandler = null;
    this.sessionUrl = null;
  }
}

/**
 * SSE transport for MCP (legacy).
 */
export class SSETransport implements ITransport {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private eventSource: EventSource | null = null;
  private messageHandler: ((message: JSONRPCResponse) => void) | null = null;
  private messageEndpoint: string | null = null;

  constructor(config: { url: string; headers?: Record<string, string> }) {
    this.url = config.url;
    this.headers = config.headers || {};
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => resolve();

      this.eventSource.onerror = () => {
        if (!this.messageEndpoint) {
          reject(new Error('Failed to connect to MCP server'));
        }
      };

      // Listen for the endpoint event
      this.eventSource.addEventListener('endpoint', (e) => {
        this.messageEndpoint = new URL(
          (e as MessageEvent).data,
          this.url,
        ).toString();
      });

      // Listen for messages
      this.eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (this.messageHandler) {
            this.messageHandler(parsed as JSONRPCResponse);
          }
        } catch {
          // skip
        }
      };
    });
  }

  async send(message: JSONRPCRequest): Promise<void> {
    const endpoint = this.messageEndpoint || this.url;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`MCP send failed: ${response.status}`);
    }

    // Response may come back via SSE, or as direct JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (this.messageHandler) {
        this.messageHandler(data as JSONRPCResponse);
      }
    }
  }

  onMessage(handler: (message: JSONRPCResponse) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.messageHandler = null;
  }
}
