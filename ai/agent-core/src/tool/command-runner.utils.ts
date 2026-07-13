import type { ExecOptions, ExecResult, SandboxProfile } from '@svton/agent-platform';
import type { ToolContext } from './types';

type CommandRunner = (command: string, options: ExecOptions) => Promise<ExecResult>;

export type CommandRunnerResolution =
  | { kind: 'ready'; run: CommandRunner }
  | { kind: 'unavailable'; message: string };

export function resolveCommandRunner(ctx: ToolContext, label: string): CommandRunnerResolution {
  if (ctx.platform.sandbox && ctx.sandboxProfile) {
    return {
      kind: 'ready',
      run: (command, options) => ctx.platform.sandbox!.exec(
        command,
        options,
        ctx.sandboxProfile as SandboxProfile,
      ),
    };
  }

  const sandboxRequired = ctx.sandboxRequired ?? ctx.platform.capabilities?.sandboxing ?? false;
  if (sandboxRequired) {
    return {
      kind: 'unavailable',
      message: `Error: ${label} requires sandbox execution, but sandbox is not available for this run.`,
    };
  }

  const processExec = ctx.platform.process?.exec?.bind(ctx.platform.process);
  if (!processExec) {
    return {
      kind: 'unavailable',
      message:
        `Error: ${label} requires process execution, which is not available in this environment (web).`,
    };
  }

  return { kind: 'ready', run: processExec };
}
