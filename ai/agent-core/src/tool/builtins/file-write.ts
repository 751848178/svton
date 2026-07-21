import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';
import { resolveToolPath } from './path-resolution.utils';

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

    if (typeof path !== 'string' || path.trim().length === 0) {
      return { callId: call.id, output: 'Error: "path" is required and must be a string.', isError: true };
    }
    const resolvedPathArg = path.trim();
    if (typeof content !== 'string') {
      return { callId: call.id, output: 'Error: "content" is required.', isError: true };
    }

    const resolvedPath = resolveToolPath(ctx, resolvedPathArg);

    try {
      await ctx.platform.fs.writeFile(resolvedPath, content);
      return {
        callId: call.id,
        output: `File written successfully: ${resolvedPath}`,
        metadata: {
          path: resolvedPath,
          contentLength: content.length,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error writing file: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          path: resolvedPath,
          contentLength: content.length,
        },
      };
    }
  }
}
