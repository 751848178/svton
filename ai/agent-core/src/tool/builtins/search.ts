import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ============================================================
// grep
// ============================================================

export const grepDef: ToolDefinition = {
  name: 'grep',
  description:
    'Search file contents using a regular expression pattern. Returns matching lines with file paths and line numbers.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for.',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in.',
      },
      include: {
        type: 'string',
        description: 'Glob pattern for files to include (e.g. "*.ts").',
      },
      ignore_case: {
        type: 'boolean',
        description: 'Case-insensitive search. Default: false.',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results. Default: 250.',
      },
    },
    required: ['pattern', 'path'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class GrepExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { pattern, path, include, ignore_case, max_results } = call.arguments as {
      pattern?: string;
      path?: string;
      include?: string;
      ignore_case?: boolean;
      max_results?: number;
    };

    if (!pattern || typeof pattern !== 'string') {
      return { callId: call.id, output: 'Error: "pattern" is required and must be a string.', isError: true };
    }
    if (!path || typeof path !== 'string') {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }

    const resolvedPath = ctx.platform.fs.resolve(
      ctx.platform.fs.join(ctx.workingDir, path),
    );

    try {
      const results = await ctx.platform.search.grep(
        pattern,
        [resolvedPath],
        {
          ignoreCase: ignore_case,
          includePattern: include,
          maxResults: max_results ?? 250,
          contextLines: 2,
        },
      );

      if (results.length === 0) {
        return {
          callId: call.id,
          output: 'No matches found.',
        };
      }

      const formatted = results
        .map(
          (r) =>
            `${r.file}:${r.line}: ${r.text}`,
        )
        .join('\n');

      return {
        callId: call.id,
        output: formatted,
        metadata: { matchCount: results.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error searching: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// glob
// ============================================================

export const globDef: ToolDefinition = {
  name: 'glob',
  description:
    'Find files matching a glob pattern. Returns sorted file paths.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.tsx").',
      },
      path: {
        type: 'string',
        description: 'Directory to search in. Default: current working directory.',
      },
    },
    required: ['pattern'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class GlobExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { pattern, path } = call.arguments as {
      pattern?: string;
      path?: string;
    };

    if (!pattern || typeof pattern !== 'string') {
      return { callId: call.id, output: 'Error: "pattern" is required and must be a string.', isError: true };
    }

    const searchPath = path
      ? ctx.platform.fs.resolve(ctx.platform.fs.join(ctx.workingDir, path))
      : ctx.workingDir;

    try {
      const files = await ctx.platform.search.glob(pattern, searchPath);

      if (files.length === 0) {
        return {
          callId: call.id,
          output: 'No files matched the pattern.',
        };
      }

      return {
        callId: call.id,
        output: files.join('\n'),
        metadata: { fileCount: files.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
