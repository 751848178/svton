import type { ExecResult } from '@svton/agent-platform';

export interface FormattedCommandResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  isError: boolean;
}

export function formatCommandResult(
  result: ExecResult,
  emptyOutput: string,
): FormattedCommandResult {
  const timedOut = result.timedOut ?? false;
  const exitCode = result.exitCode ?? (timedOut ? null : 0);
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
  if (exitCode !== null && exitCode !== 0) {
    output += `\n[exit code: ${exitCode}]`;
  }

  return {
    output: output.trim() ? output : emptyOutput,
    exitCode,
    timedOut,
    isError: timedOut || (exitCode !== null && exitCode !== 0),
  };
}
