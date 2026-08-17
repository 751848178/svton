import type { ExecResult } from '@svton/agent-platform';

export interface FormattedCommandResult {
  output: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: string;
  timedOut: boolean;
  durationMs?: number;
  isError: boolean;
}

export function formatCommandResult(
  result: ExecResult,
  emptyOutput: string,
  durationMs?: number,
): FormattedCommandResult {
  const timedOut = result.timedOut ?? false;
  const exitCode = result.exitCode === undefined ? (timedOut ? null : 0) : result.exitCode;
  const signalled = typeof result.signal === 'string' && result.signal.length > 0;
  let output = '';

  if (result.stdout) output += result.stdout;
  if (result.stderr) {
    if (output) output += '\n';
    output += `[stderr] ${result.stderr}`;
  }
  if (timedOut) {
    if (output) output += '\n';
    output += '[timed out]';
  }
  if (signalled) {
    if (output) output += '\n';
    output += `[signal: ${result.signal}]`;
  }
  if (exitCode !== null && exitCode !== 0) {
    output += `\n[exit code: ${exitCode}]`;
  }

  return {
    output: output.trim() ? output : emptyOutput,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode,
    ...(result.signal ? { signal: result.signal } : {}),
    timedOut,
    ...(durationMs !== undefined ? { durationMs } : {}),
    isError: timedOut || signalled || (exitCode !== null && exitCode !== 0),
  };
}
