import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { resolveCommandRunner } from '../command-runner.utils';

// ============================================================
// bash
// ============================================================

export const bashDef: ToolDefinition = {
  name: 'bash',
  description:
    'Execute a shell command and return its output. Use with caution - requires approval by default.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 120000 (2 minutes).',
      },
    },
    required: ['command'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class BashExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { command, timeout } = call.arguments as {
      command?: string;
      timeout?: number;
    };

    if (!command || typeof command !== 'string') {
      return { callId: call.id, output: 'Error: "command" is required and must be a string.', isError: true };
    }
    if (timeout !== undefined && (typeof timeout !== 'number' || timeout <= 0)) {
      return { callId: call.id, output: 'Error: "timeout" must be a positive number.', isError: true };
    }

    try {
      const execOptions = {
        cwd: ctx.workingDir,
        timeout: timeout ?? 120000,
        signal: ctx.signal,
      };
      const runner = resolveCommandRunner(ctx, 'Bash');
      if (runner.kind === 'unavailable') {
        return { callId: call.id, output: runner.message, isError: true };
      }
      const result = await runner.run(command, execOptions);

      const exitCode = result.exitCode ?? 0;

      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) {
        if (output) output += '\n';
        output += `[stderr] ${result.stderr}`;
      }

      if (exitCode !== 0) {
        output += `\n[exit code: ${exitCode}]`;
      }

      return {
        callId: call.id,
        output: output || '(no output)',
        isError: exitCode !== 0,
        metadata: {
          exitCode,
          timedOut: result.timedOut ?? false,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
