import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';
import { resolveToolPath } from './path-resolution.utils';
import { formatGlobResults, formatGrepResults, globRequestMetadata, grepRequestMetadata } from './search-result-metadata.utils';

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

    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      return { callId: call.id, output: 'Error: "pattern" is required and must be a string.', isError: true };
    }
    if (typeof path !== 'string' || path.trim().length === 0) {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    if (include !== undefined && typeof include !== 'string') {
      return { callId: call.id, output: 'Error: "include" must be a string.', isError: true };
    }
    const resolvedPattern = pattern.trim();
    const resolvedPathArg = path.trim();
    const resolvedInclude = include?.trim() || undefined;
    if (ignore_case !== undefined && typeof ignore_case !== 'boolean') {
      return { callId: call.id, output: 'Error: "ignore_case" must be a boolean.', isError: true };
    }
    if (max_results !== undefined && (!Number.isInteger(max_results) || max_results < 1)) {
      return { callId: call.id, output: 'Error: "max_results" must be a positive integer.', isError: true };
    }

    const resolvedPath = resolveToolPath(ctx, resolvedPathArg);
    const maxResults = max_results ?? 250;
    const requestMetadata = grepRequestMetadata(resolvedPattern, resolvedPath, resolvedInclude, ignore_case === true, maxResults);

    try {
      const results = await ctx.platform.search.grep(
        resolvedPattern,
        [resolvedPath],
        {
          ignoreCase: ignore_case,
          includePattern: resolvedInclude,
          maxResults,
          contextLines: 2,
        },
      );

      if (results.length === 0) {
        return {
          callId: call.id,
          output: 'No matches found.',
          metadata: { ...requestMetadata, matchCount: 0 },
        };
      }

      const formatted = formatGrepResults(results);

      return {
        callId: call.id,
        output: formatted,
        metadata: { ...requestMetadata, matchCount: results.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error searching: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: requestMetadata,
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

    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      return { callId: call.id, output: 'Error: "pattern" is required and must be a string.', isError: true };
    }

    if (path !== undefined && typeof path !== 'string') {
      return { callId: call.id, output: 'Error: "path" must be a string.', isError: true };
    }
    const resolvedPattern = pattern.trim();
    const resolvedPathArg = path?.trim();

    const searchPath = resolvedPathArg ? resolveToolPath(ctx, resolvedPathArg) : ctx.workingDir;
    const requestMetadata = globRequestMetadata(resolvedPattern, searchPath);

    try {
      const files = await ctx.platform.search.glob(resolvedPattern, searchPath);

      if (files.length === 0) {
        return {
          callId: call.id,
          output: 'No files matched the pattern.',
          metadata: { ...requestMetadata, fileCount: 0 },
        };
      }

      return {
        callId: call.id,
        output: formatGlobResults(files),
        metadata: { ...requestMetadata, fileCount: files.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error searching files: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: requestMetadata,
      };
    }
  }
}
