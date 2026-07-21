import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatCommandResult } from '../command-result.utils';
import { resolveCommandRunner } from '../command-runner.utils';
import { formatUnknownErrorMessage } from './error-message.utils';

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

    if (typeof command !== 'string' || command.trim().length === 0) {
      return { callId: call.id, output: 'Error: "command" is required and must be a string.', isError: true };
    }
    if (timeout !== undefined && (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)) {
      return { callId: call.id, output: 'Error: "timeout" must be a positive number.', isError: true };
    }

    const execOptions = {
      cwd: ctx.workingDir,
      timeout: timeout ?? 120000,
      signal: ctx.signal,
    };

    try {
      const runner = resolveCommandRunner(ctx, 'Bash');
      if (runner.kind === 'unavailable') {
        return {
          callId: call.id,
          output: runner.message,
          isError: true,
          metadata: {
            command,
            timeout: execOptions.timeout,
          },
        };
      }
      const result = await runner.run(command, execOptions);
      const formatted = formatCommandResult(result, '(no output)');

      return {
        callId: call.id,
        output: formatted.output,
        isError: formatted.isError,
        metadata: {
          exitCode: formatted.exitCode,
          timedOut: formatted.timedOut,
          command,
          timeout: execOptions.timeout,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error executing command: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          command,
          timeout: execOptions.timeout,
        },
      };
    }
  }
}
