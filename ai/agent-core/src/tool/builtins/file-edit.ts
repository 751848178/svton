import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';
import { buildEditDiff } from './file-edit-diff.utils';
import { resolveToolPath } from './path-resolution.utils';

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

    if (typeof path !== 'string' || path.trim().length === 0) {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    const resolvedPathArg = path.trim();
    if (typeof old_string !== 'string' || old_string === '') {
      return { callId: call.id, output: 'Error: "old_string" is required, must be a non-empty string.', isError: true };
    }
    if (typeof new_string !== 'string') {
      return { callId: call.id, output: 'Error: "new_string" is required.', isError: true };
    }
    if (replace_all !== undefined && typeof replace_all !== 'boolean') {
      return { callId: call.id, output: 'Error: "replace_all" must be a boolean.', isError: true };
    }

    const resolvedPath = resolveToolPath(ctx, resolvedPathArg);

    try {
      const oldContent = await ctx.platform.fs.readFile(resolvedPath);

      if (replace_all) {
        return await this.replaceAll(call, ctx, resolvedPathArg, resolvedPath, oldContent, old_string, new_string);
      }
      return await this.replaceOne(call, ctx, resolvedPathArg, resolvedPath, oldContent, old_string, new_string);
    } catch (error) {
      return {
        callId: call.id,
        output: `Error editing file: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          path: resolvedPath,
          replaceAll: replace_all === true,
        },
      };
    }
  }

  private async replaceAll(
    call: ToolCall,
    ctx: ToolContext,
    path: string,
    resolvedPath: string,
    oldContent: string,
    oldString: string,
    newString: string,
  ): Promise<ToolResult> {
    const count = oldContent.split(oldString).length - 1;
    if (count === 0) {
      return {
        callId: call.id,
        output: `old_string not found in ${resolvedPath}`,
        isError: true,
        metadata: {
          path: resolvedPath,
          replaceAll: true,
          replacementCount: 0,
        },
      };
    }

    const newContent = oldContent.replaceAll(oldString, newString);
    await ctx.platform.fs.writeFile(resolvedPath, newContent);
    const diff = buildEditDiff(path, oldContent, newContent);
    return {
      callId: call.id,
      output: `Replaced ${count} occurrence(s) in ${resolvedPath}\n${diff}`,
      metadata: {
        path: resolvedPath,
        replaceAll: true,
        replacementCount: count,
      },
    };
  }

  private async replaceOne(
    call: ToolCall,
    ctx: ToolContext,
    path: string,
    resolvedPath: string,
    oldContent: string,
    oldString: string,
    newString: string,
  ): Promise<ToolResult> {
    const success = await ctx.platform.fs.editFile(resolvedPath, oldString, newString);
    if (!success) {
      return {
        callId: call.id,
        output: `old_string not found in ${resolvedPath}`,
        isError: true,
        metadata: {
          path: resolvedPath,
          replaceAll: false,
          replacementCount: 0,
        },
      };
    }

    const newContent = oldContent.replace(oldString, newString);
    const diff = buildEditDiff(path, oldContent, newContent);
    return {
      callId: call.id,
      output: `Edit applied to ${resolvedPath}\n${diff}`,
      metadata: {
        path: resolvedPath,
        replaceAll: false,
        replacementCount: 1,
      },
    };
  }
}
