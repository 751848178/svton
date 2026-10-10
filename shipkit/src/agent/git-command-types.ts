import type { ExecResult } from '../shared/exec.js';

export interface GitRunOptions { logStdout?: boolean }
export interface GitCommand {
  repo: string;
  run(args: string[], timeoutMs?: number, options?: GitRunOptions): Promise<ExecResult>;
  cleanup(): Promise<void>;
}
