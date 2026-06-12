import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ============================================================
// file_read
// ============================================================

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

    if (!path || typeof path !== 'string') {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    if (offset !== undefined && (typeof offset !== 'number' || offset < 1)) {
      return { callId: call.id, output: 'Error: "offset" must be a positive number.', isError: true };
    }
    if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
      return { callId: call.id, output: 'Error: "limit" must be a positive number.', isError: true };
    }

    const resolvedPath = ctx.platform.fs.resolve(
      ctx.platform.fs.join(ctx.workingDir, path),
    );

    try {
      const content = await ctx.platform.fs.readFile(resolvedPath);
      const lines = content.split('\n');

      const startLine = offset ? Math.max(1, offset) : 1;
      const endLine = limit ? startLine + limit : lines.length;
      const selectedLines = lines.slice(startLine - 1, endLine);

      // Add line numbers like cat -n
      const numbered = selectedLines
        .map((line, i) => `${startLine + i}\t${line}`)
        .join('\n');

      return {
        callId: call.id,
        output: numbered || '(empty file)',
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// file_write
// ============================================================

export const fileWriteDef: ToolDefinition = {
  name: 'file_write',
  description:
    'Create or overwrite a file with the given content. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to write.',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file.',
      },
    },
    required: ['path', 'content'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  } satisfies ToolAnnotations,
};

export class FileWriteExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { path, content } = call.arguments as {
      path?: string;
      content?: string;
    };

    if (!path || typeof path !== 'string') {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    if (content === undefined || content === null) {
      return { callId: call.id, output: 'Error: "content" is required.', isError: true };
    }

    const resolvedPath = ctx.platform.fs.resolve(
      ctx.platform.fs.join(ctx.workingDir, path),
    );

    try {
      await ctx.platform.fs.writeFile(resolvedPath, content);
      return {
        callId: call.id,
        output: `File written successfully: ${resolvedPath}`,
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// file_edit
// ============================================================

export const fileEditDef: ToolDefinition = {
  name: 'file_edit',
  description:
    'Perform exact string replacement in a file. The old_string must match exactly (including indentation). Returns whether the edit was applied.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit.',
      },
      old_string: {
        type: 'string',
        description: 'The exact text to find and replace.',
      },
      new_string: {
        type: 'string',
        description: 'The text to replace it with.',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all occurrences. Default: false.',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  } satisfies ToolAnnotations,
};

export class FileEditExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { path, old_string, new_string, replace_all } = call.arguments as {
      path?: string;
      old_string?: string;
      new_string?: string;
      replace_all?: boolean;
    };

    if (!path || typeof path !== 'string') {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    if (typeof old_string !== 'string' || old_string === '') {
      return { callId: call.id, output: 'Error: "old_string" is required, must be a non-empty string.', isError: true };
    }
    if (new_string === undefined || new_string === null) {
      return { callId: call.id, output: 'Error: "new_string" is required.', isError: true };
    }

    const resolvedPath = ctx.platform.fs.resolve(
      ctx.platform.fs.join(ctx.workingDir, path),
    );

    try {
      const oldContent = await ctx.platform.fs.readFile(resolvedPath);

      if (replace_all) {
        const count = oldContent.split(old_string).length - 1;
        if (count === 0) {
          return {
            callId: call.id,
            output: `old_string not found in ${resolvedPath}`,
            isError: true,
          };
        }
        const newContent = oldContent.replaceAll(old_string, new_string);
        await ctx.platform.fs.writeFile(resolvedPath, newContent);
        const diff = buildEditDiff(path, oldContent, newContent);
        return {
          callId: call.id,
          output: `Replaced ${count} occurrence(s) in ${resolvedPath}\n${diff}`,
        };
      } else {
        const success = await ctx.platform.fs.editFile(
          resolvedPath,
          old_string,
          new_string,
        );
        if (success) {
          const newContent = oldContent.replace(old_string, new_string);
          const diff = buildEditDiff(path, oldContent, newContent);
          return {
            callId: call.id,
            output: `Edit applied to ${resolvedPath}\n${diff}`,
          };
        } else {
          return {
            callId: call.id,
            output: `old_string not found in ${resolvedPath}`,
            isError: true,
          };
        }
      }
    } catch (error) {
      return {
        callId: call.id,
        output: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

/**
 * Build a minimal unified diff showing what changed.
 * Only includes changed regions with a few context lines.
 */
function buildEditDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Find the first and last differing lines
  let startIdx = 0;
  while (startIdx < oldLines.length && startIdx < newLines.length && oldLines[startIdx] === newLines[startIdx]) {
    startIdx++;
  }

  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd > startIdx && newEnd > startIdx && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  // Add context lines
  const contextLines = 3;
  const ctxStart = Math.max(0, startIdx - contextLines);
  const ctxOldEnd = Math.min(oldLines.length - 1, oldEnd + contextLines);
  const ctxNewEnd = Math.min(newLines.length - 1, newEnd + contextLines);

  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${ctxStart + 1},${ctxOldEnd - ctxStart + 1} +${ctxStart + 1},${ctxNewEnd - ctxStart + 1} @@`,
  ];

  for (let i = ctxStart; i <= Math.max(ctxOldEnd, ctxNewEnd); i++) {
    if (i <= ctxOldEnd && i <= ctxNewEnd) {
      if (oldLines[i] === newLines[i]) {
        lines.push(` ${oldLines[i]}`);
      } else {
        lines.push(`-${oldLines[i]}`);
        lines.push(`+${newLines[i]}`);
      }
    } else if (i <= ctxOldEnd) {
      lines.push(`-${oldLines[i]}`);
    } else {
      lines.push(`+${newLines[i]}`);
    }
  }

  return lines.join('\n');
}
