import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import type { MemoryManager } from '../../memory/manager';
import { formatUnknownErrorMessage } from './error-message.utils';

// ============================================================
// memory_save
// ============================================================

export const memorySaveDef: ToolDefinition = {
  name: 'memory_save',
  description:
    'Save a piece of information to long-term memory. Use this to remember user preferences, important facts, or context that should persist across conversations. Saved memories are automatically included in future conversations.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember. Be concise and specific (e.g. "User prefers TypeScript over JavaScript", "Project uses pnpm for package management").',
      },
      category: {
        type: 'string',
        description: 'Category for the memory entry. Default: "general".',
      },
    },
    required: ['content'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class MemorySaveExecutor implements IToolExecutor {
  constructor(private readonly memoryManager: MemoryManager) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { content, category } = call.arguments as {
      content?: string;
      category?: string;
    };

    if (typeof content !== 'string' || content.trim().length === 0) {
      return { callId: call.id, output: 'Error: "content" is required and must be a string.', isError: true };
    }
    const resolvedContent = content.trim();
    if (category !== undefined && typeof category !== 'string') {
      return { callId: call.id, output: 'Error: "category" must be a string.', isError: true };
    }
    const resolvedCategory = category?.trim() || 'general';

    try {
      await this.memoryManager.saveAutoMemory(
        resolvedContent,
        resolvedCategory,
      );
      return {
        callId: call.id,
        output: `Saved ${resolvedContent.length} characters to memory category "${resolvedCategory}".`,
        metadata: {
          category: resolvedCategory,
          contentLength: resolvedContent.length,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Failed to save memory: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          category: resolvedCategory,
          contentLength: resolvedContent.length,
        },
      };
    }
  }
}

// ============================================================
// memory_recall
// ============================================================

export const memoryRecallDef: ToolDefinition = {
  name: 'memory_recall',
  description:
    'Recall information from long-term memory. Returns all saved memories, optionally filtered by keyword.',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Optional keyword to filter memories. If omitted, returns all memories.',
      },
      query: {
        type: 'string',
        description: 'Alias for keyword, accepted for compatibility with natural tool calls.',
      },
    },
    required: [],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  } satisfies ToolAnnotations,
};

export class MemoryRecallExecutor implements IToolExecutor {
  constructor(private readonly memoryManager: MemoryManager) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { keyword, query } = call.arguments as { keyword?: string; query?: string };

    if (keyword !== undefined && query !== undefined) {
      return { callId: call.id, output: 'Error: use either "keyword" or "query", not both.', isError: true };
    }

    const filter = keyword ?? query;
    const filterName = keyword !== undefined ? 'keyword' : 'query';
    if (filter !== undefined && typeof filter !== 'string') {
      return { callId: call.id, output: `Error: "${filterName}" must be a string.`, isError: true };
    }
    if (filter !== undefined && filter.trim().length === 0) {
      return { callId: call.id, output: `Error: "${filterName}" must be a non-empty string.`, isError: true };
    }
    const resolvedKeyword = filter?.trim();

    try {
      const allText = this.memoryManager.getAllMemoryText();
      if (!allText) {
        return { callId: call.id, output: 'No memories saved yet.' };
      }

      if (resolvedKeyword) {
        const lines = allText.split('\n').filter((l) =>
          l.toLowerCase().includes(resolvedKeyword.toLowerCase()),
        );
        if (lines.length === 0) {
          return { callId: call.id, output: `No memories matching "${resolvedKeyword}".` };
        }
        return { callId: call.id, output: lines.join('\n') };
      }

      return { callId: call.id, output: allText };
    } catch (error) {
      return {
        callId: call.id,
        output: `Failed to recall memory: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          filterName: resolvedKeyword ? filterName : null,
          keyword: resolvedKeyword ?? null,
        },
      };
    }
  }
}
