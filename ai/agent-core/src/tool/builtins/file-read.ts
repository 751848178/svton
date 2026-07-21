import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';
import { resolveToolPath } from './path-resolution.utils';

export const fileReadDef: ToolDefinition = {
  name: 'file_read',
  description:
    'Read the contents of a file at the given path. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to read.',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-based). Optional.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read. Optional.',
      },
    },
    required: ['path'],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class FileReadExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { path, offset, limit } = call.arguments as {
      path?: string;
      offset?: number;
      limit?: number;
    };

    if (typeof path !== 'string' || path.trim().length === 0) {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    const resolvedPathArg = path.trim();
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 1)) {
      return { callId: call.id, output: 'Error: "offset" must be a positive number.', isError: true };
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return { callId: call.id, output: 'Error: "limit" must be a positive number.', isError: true };
    }

    const resolvedPath = resolveToolPath(ctx, resolvedPathArg);
    const startLine = offset ? Math.max(1, offset) : 1;
    const requestedLimit = limit ?? null;

    try {
      const content = await ctx.platform.fs.readFile(resolvedPath);
      const lines = splitFileReadLines(content);
      const startIndex = startLine - 1;
      const selectedLines = lines.slice(startIndex, limit ? startIndex + limit : lines.length);
      const numbered = selectedLines
        .map((line, i) => `${startLine + i}\t${line}`)
        .join('\n');
      const returnedLines = selectedLines.length;
      const endLine = returnedLines > 0 ? startLine + returnedLines - 1 : null;
      const output = numbered || (lines.length === 0 ? '(empty file)' : '(no lines selected)');

      return {
        callId: call.id,
        output,
        metadata: {
          path: resolvedPath,
          startLine,
          endLine,
          totalLines: lines.length,
          returnedLines,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error reading file: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          path: resolvedPath,
          startLine,
          requestedLimit,
        },
      };
    }
  }
}

function splitFileReadLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  if (content.endsWith('\n')) {
    lines.pop();
  }
  return lines;
}
