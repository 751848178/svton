/**
 * Git-based code review tools.
 *
 * Provides structured access to \`git diff\` and \`git log\` ranges so the
 * LLM can analyze changes without crafting raw shell commands.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { resolveCommandRunner } from '../command-runner.utils';
import { readSafeGitRefs, shellQuote } from '../git-review-command.utils';

// ============================================================
// git_diff
// ============================================================

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

    // Build the git diff command
    const parts: string[] = ['git', 'diff'];

    if (stat_only) {
      parts.push('--stat');
    }

    const refs = readSafeGitRefs(base, head);
    if (refs.error) return { callId: call.id, output: refs.error, isError: true };

    // Range: "base...head" when both, "base" compares working tree to base
    if (refs.base && refs.head) {
      parts.push(shellQuote(`${refs.base}...${refs.head}`));
    } else if (refs.base) {
      parts.push(shellQuote(refs.base));
    }
    // No base/head → working tree diff (unstaged)

    // File path filter
    if (paths && Array.isArray(paths) && paths.length > 0) {
      parts.push('--');
      for (const p of paths) {
        if (typeof p === 'string') {
          parts.push(shellQuote(p));
        }
      }
    }

    const command = parts.join(' ');

    const runner = resolveCommandRunner(ctx, 'Git diff');
    if (runner.kind === 'unavailable') {
      return {
        callId: call.id,
        output: runner.message,
        isError: true,
      };
    }

    try {
      const result = await runner.run(command, {
        cwd: ctx.workingDir,
        timeout: 30_000,
        signal: ctx.signal,
      });

      const exitCode = result.exitCode ?? 0;

      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) {
        if (output) output += '\n';
        output += `[stderr] ${result.stderr}`;
      }

      if (!output.trim()) {
        output = '(no changes detected)';
      }

      return {
        callId: call.id,
        output,
        isError: exitCode !== 0,
        metadata: { exitCode, command },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error running git diff: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// git_log_range
// ============================================================

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

    const maxCount = typeof limit === 'number' && limit > 0 ? limit : 50;

    // Build git log command with a readable format
    const parts: string[] = [
      'git',
      'log',
      `--format=%H|%an|%ad|%s`,
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
      };
    }

    try {
      const result = await runner.run(command, {
        cwd: ctx.workingDir,
        timeout: 15_000,
        signal: ctx.signal,
      });

      const exitCode = result.exitCode ?? 0;

      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) {
        if (output) output += '\n';
        output += `[stderr] ${result.stderr}`;
      }

      if (!output.trim()) {
        output = '(no commits in range)';
      }

      return {
        callId: call.id,
        output,
        isError: exitCode !== 0,
        metadata: { exitCode, command },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error running git log: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
