// Bounded child-process runner: captures output with a cap, streams lines, enforces timeouts.

import { spawn } from 'node:child_process';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  /** per-stream capture cap (default 2MB); lines keep streaming to onLine even after cap */
  maxBytes?: number;
  onLine?: (line: string, stream: 'out' | 'err') => void;
  /** written to the child's stdin (used for secrets, keeps them out of argv) */
  stdin?: string;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timedOut: boolean;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export function exec(cmd: string, args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
    });
    const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    const pending: Record<'out' | 'err', string> = { out: '', err: '' };
    const MAX_PENDING = 64 * 1024;

    const feed = (text: string, stream: 'out' | 'err') => {
      if (!opts.onLine) return;
      const merged = pending[stream] + text;
      // bound the partial-line buffer so streams without newlines cannot grow unbounded (F34)
      pending[stream] = merged.length > MAX_PENDING ? merged.slice(-MAX_PENDING) : merged;
      const lines = pending[stream].split('\n');
      pending[stream] = lines.pop() ?? '';
      for (const line of lines) opts.onLine(line, stream);
    };

    const collect = (stream: 'out' | 'err') => (d: Buffer) => {
      const text = d.toString('utf8');
      feed(text, stream);
      if (stream === 'out') stdout += text; else stderr += text;
      if (stdout.length > max) { stdout = stdout.slice(0, max); truncated = true; }
      if (stderr.length > max) { stderr = stderr.slice(0, max); truncated = true; }
    };

    child.stdout?.on('data', collect('out'));
    child.stderr?.on('data', collect('err'));

    if (opts.stdin !== undefined) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(opts.stdin);
    }

    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref();
      }, opts.timeoutMs);
    }

    const finish = (code: number, extraErr?: string) => {
      if (timer) clearTimeout(timer);
      if (opts.onLine) {
        for (const s of ['out', 'err'] as const) if (pending[s]) opts.onLine(pending[s], s);
      }
      resolve({ code, stdout, stderr: extraErr ? `${stderr}\n${extraErr}` : stderr, truncated, timedOut });
    };

    child.on('error', (e) => finish(-1, `spawn error: ${e.message}`));
    child.on('close', (code) => finish(code ?? -1));
  });
}
