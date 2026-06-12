/**
 * Chrome browser control tools via Chrome DevTools Protocol (CDP).
 *
 * Connects to a local Chrome instance started with --remote-debugging-port=9222.
 * Provides navigate, screenshot, click, type, evaluate, and get_content capabilities.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ── CDP Client ──────────────────────────────────────────────

class CDPClient {
  private ws: WebSocket | null = null;
  private msgId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private port: number;

  constructor(port = 9222) {
    this.port = port;
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    // Get the first page target's WebSocket URL
    const resp = await globalThis.fetch(`http://localhost:${this.port}/json`);
    const targets = await resp.json() as any[];
    const page = targets.find((t: any) => t.type === 'page');
    if (!page) throw new Error('No Chrome page target found. Is Chrome running with --remote-debugging-port?');

    const wsUrl = page.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No WebSocket URL found for Chrome target');

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = (e) => reject(new Error('WebSocket connection failed'));
      this.ws!.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.id && this.pending.has(data.id)) {
            const { resolve, reject } = this.pending.get(data.id)!;
            this.pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message || 'CDP error'));
            else resolve(data.result);
          }
        } catch { /* ignore parse errors for events */ }
      };
    });
  }

  async send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    const id = ++this.msgId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as any, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      // Timeout after 10s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pending.forEach(({ reject }) => reject(new Error('Disconnected')));
    this.pending.clear();
  }
}

// Shared client instance
let cdpClient: CDPClient | null = null;

function getCdpClient(port?: number): CDPClient {
  if (!cdpClient) cdpClient = new CDPClient(port);
  return cdpClient;
}

// ── Chrome Navigate ─────────────────────────────────────────

export const chromeNavigateDef: ToolDefinition = {
  name: 'chrome_navigate',
  description: 'Navigate Chrome to a URL. Requires Chrome running with --remote-debugging-port=9222.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
    },
    required: ['url'],
  },
  annotations: { destructiveHint: false, openWorldHint: true },
};

export class ChromeNavigateExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { url } = call.arguments as any;
      await client.send('Page.navigate', { url });
      // Wait for load
      await new Promise((r) => setTimeout(r, 1000));
      return { callId: call.id, output: `Navigated to ${url}` };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome navigate failed: ${err.message}`, isError: true };
    }
  }
}

// ── Chrome Screenshot ───────────────────────────────────────

export const chromeScreenshotDef: ToolDefinition = {
  name: 'chrome_screenshot',
  description: 'Capture a screenshot of the current Chrome page. Returns base64 PNG.',
  parameters: {
    type: 'object',
    properties: {
      fullPage: { type: 'boolean', description: 'Capture full page (default: viewport only)' },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export class ChromeScreenshotExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { fullPage } = call.arguments as any;
      const result = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: fullPage ?? false,
      });
      return {
        callId: call.id,
        output: JSON.stringify({ type: 'image', data: result.data, mimeType: 'image/png' }),
      };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome screenshot failed: ${err.message}`, isError: true };
    }
  }
}

// ── Chrome Click ────────────────────────────────────────────

export const chromeClickDef: ToolDefinition = {
  name: 'chrome_click',
  description: 'Click an element in Chrome by CSS selector. Uses CDP DOM.dispatchEvent.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of the element to click' },
    },
    required: ['selector'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { selector } = call.arguments as any;

      // Find the element
      const doc = await client.send('DOM.getDocument');
      const node = await client.send('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector,
      });
      if (!node.nodeId) {
        return { callId: call.id, output: `Element not found: ${selector}`, isError: true };
      }

      // Get box model for coordinates
      const box = await client.send('DOM.getBoxModel', { nodeId: node.nodeId });
      const content = box.model.content;
      const x = (content[0] + content[2]) / 2;
      const y = (content[1] + content[5]) / 2;

      // Dispatch mouse events
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

      return { callId: call.id, output: `Clicked element "${selector}" at (${Math.round(x)}, ${Math.round(y)})` };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome click failed: ${err.message}`, isError: true };
    }
  }
}

// ── Chrome Type ─────────────────────────────────────────────

export const chromeTypeDef: ToolDefinition = {
  name: 'chrome_type',
  description: 'Type text into the currently focused element in Chrome.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['text'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeTypeExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { text } = call.arguments as any;
      // Insert text via Input.insertText (handles unicode properly)
      await client.send('Input.insertText', { text });
      return { callId: call.id, output: `Typed: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"` };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome type failed: ${err.message}`, isError: true };
    }
  }
}

// ── Chrome Evaluate ─────────────────────────────────────────

export const chromeEvaluateDef: ToolDefinition = {
  name: 'chrome_evaluate',
  description: 'Execute JavaScript in the Chrome page and return the result.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'JavaScript expression to evaluate' },
    },
    required: ['expression'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeEvaluateExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { expression } = call.arguments as any;
      const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        return {
          callId: call.id,
          output: `JS error: ${result.exceptionDetails.text || 'Unknown error'}`,
          isError: true,
        };
      }
      const value = result.result?.value;
      return {
        callId: call.id,
        output: typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2),
      };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome evaluate failed: ${err.message}`, isError: true };
    }
  }
}

// ── Chrome Get Content ──────────────────────────────────────

export const chromeGetContentDef: ToolDefinition = {
  name: 'chrome_get_content',
  description: 'Get the text content of the current Chrome page.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector (default: "body")' },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export class ChromeGetContentExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    try {
      const client = getCdpClient();
      const { selector = 'body' } = call.arguments as any;
      const result = await client.send('Runtime.evaluate', {
        expression: `document.querySelector("${selector}")?.innerText || ""`,
        returnByValue: true,
      });
      const text = result.result?.value || '';
      return {
        callId: call.id,
        output: text.substring(0, 10000) + (text.length > 10000 ? '\n... (truncated)' : ''),
      };
    } catch (err: any) {
      return { callId: call.id, output: `Chrome get content failed: ${err.message}`, isError: true };
    }
  }
}
