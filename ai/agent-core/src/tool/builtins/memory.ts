import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import type { MemoryManager } from '../../memory/manager';

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

    if (!content || typeof content !== 'string') {
      return { callId: call.id, output: 'Error: "content" is required and must be a string.', isError: true };
    }

    try {
      await this.memoryManager.saveAutoMemory(
        content.trim(),
        category || 'general',
      );
      return {
        callId: call.id,
        output: `Saved to memory: "${content.trim().slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Failed to save memory: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
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
    const { keyword } = call.arguments as { keyword?: string };

    try {
      const allText = this.memoryManager.getAllMemoryText();
      if (!allText) {
        return { callId: call.id, output: 'No memories saved yet.' };
      }

      if (keyword && typeof keyword === 'string') {
        const lines = allText.split('\n').filter((l) =>
          l.toLowerCase().includes(keyword.toLowerCase()),
        );
        if (lines.length === 0) {
          return { callId: call.id, output: `No memories matching "${keyword}".` };
        }
        return { callId: call.id, output: lines.join('\n') };
      }

      return { callId: call.id, output: allText };
    } catch (error) {
      return {
        callId: call.id,
        output: `Failed to recall memory: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
