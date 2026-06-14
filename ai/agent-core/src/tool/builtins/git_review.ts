/**
 * Git-based code review tools.
 *
 * Provides structured access to \`git diff\` and \`git log\` ranges so the
 * LLM can analyze changes without crafting raw shell commands.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

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

    // Range: "base...head" when both, "base" compares working tree to base
    if (base && head) {
      parts.push(`${base}...${head}`);
    } else if (base) {
      parts.push(base);
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

    // Ensure platform.process is available (desktop / Node). On web it is absent.
    if (!ctx.platform.process?.exec) {
      return {
        callId: call.id,
        output:
          'Error: Git diff requires process execution, which is not available in this environment (web). ' +
          'Run in the desktop app or a Node-based runtime.',
        isError: true,
      };
    }

    try {
      const result = await ctx.platform.process.exec(command, {
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

    if (base && head) {
      parts.push(`${base}..${head}`);
    } else if (base) {
      parts.push(`${base}..HEAD`);
    }

    const command = parts.join(' ');

    if (!ctx.platform.process?.exec) {
      return {
        callId: call.id,
        output:
          'Error: Git log requires process execution, which is not available in this environment (web).',
        isError: true,
      };
    }

    try {
      const result = await ctx.platform.process.exec(command, {
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

// ── Helpers ─────────────────────────────────────────────

/**
 * Minimal shell quoting for file paths passed to git.
 * Wraps the value in single quotes and escapes any embedded single quotes.
 */
function shellQuote(value: string): string {
  if (/^[A-Za-z0-9@%+=:,./_-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}
