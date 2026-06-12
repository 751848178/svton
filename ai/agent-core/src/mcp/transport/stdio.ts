import type { ITransport, JSONRPCRequest, JSONRPCResponse } from '../types';
import type { IProcess, IChildProcess } from '@svton/agent-platform';

/**
 * Stdio transport for MCP.
 *
 * Spawns a child process and communicates via stdin/stdout using JSON-RPC.
 * Each message is a single newline-delimited JSON line.
 */
export class StdioTransport implements ITransport {
  private readonly process: IProcess;
  private readonly command: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private readonly cwd?: string;

  private child: IChildProcess | null = null;
  private messageHandler: ((message: JSONRPCResponse) => void) | null = null;
  private lineBuffer = '';
  private _connected = false;

  constructor(
    process: IProcess,
    command: string,
    args: string[],
    env?: Record<string, string>,
    cwd?: string,
  ) {
    this.process = process;
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
  }

  async connect(): Promise<void> {
    if (this._connected) return;

    this.child = this.process.spawn(this.command, this.args, {
      env: this.env,
      cwd: this.cwd,
    });

    this.child.onStdout((data: string) => {
      this.lineBuffer += data;
      const lines = this.lineBuffer.split('\n');
      // Keep the last incomplete line in the buffer
      this.lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (this.messageHandler) {
            this.messageHandler(parsed as JSONRPCResponse);
          }
        } catch {
          // Skip non-JSON lines (e.g. startup logs from the MCP server)
        }
      }
    });

    this.child.onExit((code) => {
      if (this._connected) {
        this._connected = false;
        // Flush remaining buffer
        if (this.lineBuffer.trim()) {
          try {
            const parsed = JSON.parse(this.lineBuffer.trim());
            if (this.messageHandler) {
              this.messageHandler(parsed as JSONRPCResponse);
            }
          } catch {
            // Ignore
          }
        }
        this.lineBuffer = '';
      }
    });

    this._connected = true;
  }

  async send(message: JSONRPCRequest): Promise<void> {
    if (!this.child || !this._connected) {
      throw new Error('StdioTransport not connected');
    }
    await this.child.write(JSON.stringify(message) + '\n');
  }

  onMessage(handler: (message: JSONRPCResponse) => void): void {
    this.messageHandler = handler;
  }

  async close(): Promise<void> {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this._connected = false;
    this.messageHandler = null;
    this.lineBuffer = '';
  }
}
