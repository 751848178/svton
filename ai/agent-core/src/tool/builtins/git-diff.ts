/**
 * Git diff code review tool.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatCommandResult } from '../command-result.utils';
import { resolveCommandRunner } from '../command-runner.utils';
import { readSafeGitRefs, shellQuote } from '../git-review-command.utils';
import { formatUnknownErrorMessage } from './error-message.utils';

export const gitDiffDef: ToolDefinition = {
  name: 'git_diff',
  description:
    'Get the git diff between two refs, or the working tree if no refs are given. ' +
    'Use for code review and change analysis.',
  parameters: {
    type: 'object',
    properties: {
      base: {
        type: 'string',
        description:
          'Base ref (branch name, commit SHA, or tag). If omitted, diffs the working tree.',
      },
      head: {
        type: 'string',
        description:
          'Head ref (branch name, commit SHA, or tag). Defaults to HEAD.',
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Limit the diff to these file paths.',
      },
      stat_only: {
        type: 'boolean',
        description:
          'If true, return only the diffstat (file names and change counts) instead of the full diff.',
      },
    },
    required: [],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class GitDiffExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { base, head, paths, stat_only } = call.arguments as {
      base?: string;
      head?: string;
      paths?: string[];
      stat_only?: boolean;
    };

    if (stat_only !== undefined && typeof stat_only !== 'boolean') {
      return {
        callId: call.id,
        output: 'Error: "stat_only" must be a boolean.',
        isError: true,
      };
    }
    if (
      paths !== undefined &&
      (
        !Array.isArray(paths) ||
        paths.some((path) => typeof path !== 'string')
      )
    ) {
      return {
        callId: call.id,
        output: 'Error: "paths" must be an array of strings.',
        isError: true,
      };
    }
    const resolvedPaths = paths?.map((path) => path.trim());
    if (resolvedPaths?.some((path) => path.length === 0)) {
      return {
        callId: call.id,
        output: 'Error: "paths" must not contain blank entries.',
        isError: true,
      };
    }
    if (base === undefined && head !== undefined) {
      return {
        callId: call.id,
        output: 'Error: "head" requires "base" for git_diff.',
        isError: true,
      };
    }

    const parts: string[] = ['git', 'diff'];

    if (stat_only) {
      parts.push('--stat');
    }

    const refs = readSafeGitRefs(base, head);
    if (refs.error) return { callId: call.id, output: refs.error, isError: true };

    if (refs.base && refs.head) {
      parts.push(shellQuote(`${refs.base}...${refs.head}`));
    } else if (refs.base) {
      parts.push(shellQuote(refs.base));
    }

    if (resolvedPaths && resolvedPaths.length > 0) {
      parts.push('--');
      for (const p of resolvedPaths) {
        parts.push(shellQuote(p));
      }
    }

    const command = parts.join(' ');

    const runner = resolveCommandRunner(ctx, 'Git diff');
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
        timeout: 30_000,
        signal: ctx.signal,
      });

      const formatted = formatCommandResult(result, '(no changes detected)');

      return {
        callId: call.id,
        output: formatted.output,
        isError: formatted.isError,
        metadata: { exitCode: formatted.exitCode, timedOut: formatted.timedOut, command },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error running git diff: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: { command },
      };
    }
  }
}
