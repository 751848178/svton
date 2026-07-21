/**
 * Shared Chrome DevTools Protocol client.
 */

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

    const resp = await globalThis.fetch(`http://localhost:${this.port}/json`);
    const targets = await resp.json() as any[];
    const page = targets.find((t: any) => t.type === 'page');
    if (!page) throw new Error('No Chrome page target found. Is Chrome running with --remote-debugging-port?');

    const wsUrl = page.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No WebSocket URL found for Chrome target');

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws!.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.id && this.pending.has(data.id)) {
            const { resolve, reject } = this.pending.get(data.id)!;
            this.pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message || 'CDP error'));
            else resolve(data.result);
          }
        } catch {
          // Ignore parse errors for CDP events.
        }
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
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);
    });
  }
}

let cdpClient: CDPClient | null = null;

export function getCdpClient(port?: number): CDPClient {
  if (!cdpClient) cdpClient = new CDPClient(port);
  return cdpClient;
}

export function __setCdpClientForTesting(
  client: { send: (m: string, p?: Record<string, unknown>) => Promise<any> } | null,
): void {
  cdpClient = client as CDPClient | null;
}
