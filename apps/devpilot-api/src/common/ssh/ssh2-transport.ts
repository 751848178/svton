import { Logger } from '@nestjs/common';
import { Client, ClientChannel } from 'ssh2';
import {
  SshCancellationSignal,
  SshTransport,
  SshTransportCredentials,
  SshTransportExecOptions,
  SshTransportExecResult,
} from './ssh-transport';

/**
 * 基于 `ssh2` 的 SSH 传输实现。
 *
 * 取代 `SshLiveServerExecutorAdapter` 里 695 行 `spawn('ssh', ...)` 的 CLI 方案：
 *  - 不再写临时私钥文件（私钥直接通过 `privateKey` 选项传入 ssh2）
 *  - 不再依赖系统 `ssh` 二进制存在
 *  - stdout/stderr/exitCode 通过 ssh2 channel 事件收集，取消通过 `channel.close()` + `client.end()`
 *
 * 远端进程组治理（setsid + trap + PID marker）仍由 adapter 的包装脚本负责，
 * 这里只提供"把脚本喂进远端 bash 并收集输出"的传输能力。
 */
export class Ssh2Transport implements SshTransport {
  private readonly logger = new Logger(Ssh2Transport.name);
  private readonly client = new Client();
  private connected = false;
  private connecting: Promise<void> | undefined;

  constructor(private readonly credentials: SshTransportCredentials) {}

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    if (!this.connecting) {
      this.connecting = this.connect();
    }
    await this.connecting;
    this.connected = true;
  }

  private connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.client.removeListener('ready', onReady);
        reject(error);
      };
      const onReady = () => {
        this.client.removeListener('error', onError);
        resolve();
      };
      this.client.once('ready', onReady);
      this.client.once('error', onError);
      this.client.connect({
        host: this.credentials.host,
        port: this.credentials.port,
        username: this.credentials.username,
        privateKey: this.credentials.privateKey,
        password: this.credentials.password,
        readyTimeout: 20_000,
        // 与旧 CLI `-o StrictHostKeyChecking=accept-new` 对齐：不校验 host key
        // （控制平面内网场景；生产若需强化可改为 hostVerifier 回调）。
        hostVerifier: () => true,
      });
    });
  }

  async execScript(script: string, options: SshTransportExecOptions): Promise<SshTransportExecResult> {
    await this.ensureConnected();
    return new Promise<SshTransportExecResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      let cancelled = options.signal?.aborted ?? false;

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribeCancel?.();
        resolve({
          exitCode,
          stdout,
          stderr,
          timedOut,
          cancelled,
        });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          channel?.close();
        } catch {
          // channel may already be closed
        }
      }, options.timeoutMs);

      const unsubscribeCancel = options.signal?.onAbort(() => {
        cancelled = true;
        try {
          channel?.close();
        } catch {
          // ignore
        }
      });

      let channel: ClientChannel | undefined;

      this.client.exec('bash -se', (error, stream) => {
        if (error) {
          clearTimeout(timer);
          unsubscribeCancel?.();
          reject(error);
          return;
        }
        channel = stream;
        stream.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          stdout += text;
          options.onData?.({ stdout: text });
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          stderr += text;
          options.onData?.({ stderr: text });
        });
        stream.on('close', (code: number | null, signal?: string) => {
          // ssh2 在 channel 关闭后需要结束子流；这里直接结算。
          const exit = code === undefined || code === null ? null : code;
          if (signal) {
            // 被信号终止（如 SIGTERM from cancel/timeout）——exit 视为非 0
            finish(exit ?? 143); // 143 = 128 + 15 (SIGTERM)
          } else {
            finish(exit);
          }
        });
        // 写入脚本并关闭 stdin
        stream.write(script);
        stream.end();
      });
    });
  }

  async execCommand(
    command: string,
    options: { timeoutMs: number },
  ): Promise<{ exitCode: number | null; stderr: string }> {
    await this.ensureConnected();
    return new Promise((resolve, reject) => {
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          this.client.end();
        } catch {
          // ignore
        }
        reject(new Error(`remote command timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);

      this.client.exec(command, (error, stream) => {
        if (error) {
          clearTimeout(timer);
          reject(error);
          return;
        }
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        stream.on('close', (code: number | null) => {
          clearTimeout(timer);
          resolve({ exitCode: code ?? null, stderr });
        });
        // 非交互命令无需 stdin
        stream.end();
      });
    });
  }

  dispose(): void {
    try {
      this.connected = false;
      this.client.end();
    } catch (error) {
      this.logger.debug?.(error instanceof Error ? error.message : String(error));
    }
  }
}
