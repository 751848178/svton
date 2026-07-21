import type { ITransport, JSONRPCRequest, JSONRPCResponse } from './types';

export class JsonRpcSession {
  private transport: ITransport | null = null;
  private requestId = 0;
  private readonly pendingRequests = new Map<
    string | number,
    {
      resolve: (response: JSONRPCResponse) => void;
      reject: (error: Error) => void;
    }
  >();

  get connected(): boolean {
    return this.transport !== null;
  }

  async connect(transport: ITransport): Promise<void> {
    this.transport = transport;
    transport.onMessage((message) => this.handleMessage(message));
    await transport.connect();
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.pendingRequests.clear();
  }

  async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
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

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });

    return response.result as T;
  }

  async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.transport) throw new Error('Not connected');

    await this.transport.send({
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    });
  }

  private handleMessage(message: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }
    pending.resolve(message);
  }
}
