/**
 * Git log range code review tool.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatCommandResult } from '../command-result.utils';
import { resolveCommandRunner } from '../command-runner.utils';
import { readSafeGitRefs, shellQuote } from '../git-review-command.utils';
import { formatUnknownErrorMessage } from './error-message.utils';

export const gitLogRangeDef: ToolDefinition = {
  name: 'git_log_range',
  description:
    'List commits between two git refs. Returns commit hashes, authors, dates, and messages.',
  parameters: {
    type: 'object',
    properties: {
      base: {
        type: 'string',
        description: 'Base ref (branch, SHA, or tag). If omitted, logs from HEAD.',
      },
      head: {
        type: 'string',
        description: 'Head ref. Defaults to HEAD.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of commits to return. Default: 50.',
      },
    },
    required: [],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class GitLogRangeExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { base, head, limit } = call.arguments as {
      base?: string;
      head?: string;
      limit?: number;
    };

    if (
      limit !== undefined &&
      (
        typeof limit !== 'number' ||
        !Number.isFinite(limit) ||
        !Number.isInteger(limit) ||
        limit <= 0
      )
    ) {
      return {
        callId: call.id,
        output: 'Error: "limit" must be a positive integer.',
        isError: true,
      };
    }
    if (base === undefined && head !== undefined) {
      return {
        callId: call.id,
        output: 'Error: "head" requires "base" for git_log_range.',
        isError: true,
      };
    }

    const maxCount = limit ?? 50;
    const parts: string[] = [
      'git',
      'log',
      shellQuote('--format=%H|%an|%ad|%s'),
      '--date=short',
      `-${maxCount}`,
    ];

    const refs = readSafeGitRefs(base, head);
    if (refs.error) return { callId: call.id, output: refs.error, isError: true };

    if (refs.base && refs.head) {
      parts.push(shellQuote(`${refs.base}..${refs.head}`));
    } else if (refs.base) {
      parts.push(shellQuote(`${refs.base}..HEAD`));
    }

    const command = parts.join(' ');

    const runner = resolveCommandRunner(ctx, 'Git log');
    if (runner.kind === 'unavailable') {
      return {
        callId: call.id,
        output: runner.message,
        isError: true,
        metadata: { command },
      };
    }

    try {
      const result = await runner.run(command, {
        cwd: ctx.workingDir,
        timeout: 15_000,
        signal: ctx.signal,
      });

      const formatted = formatCommandResult(result, '(no commits in range)');

      return {
        callId: call.id,
        output: formatted.output,
        isError: formatted.isError,
        metadata: { exitCode: formatted.exitCode, timedOut: formatted.timedOut, command },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error running git log: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: { command },
      };
    }
  }
}
