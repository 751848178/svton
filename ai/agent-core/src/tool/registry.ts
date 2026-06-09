import type { ToolDefinition } from '../provider/types';
import type { ToolEntry, ToolCall, ToolResult, ToolContext, IToolExecutor } from './types';
import type { IPlatform } from '@svton/agent-platform';

/**
 * Tool Registry - manages tool definitions and their executors.
 *
 * Tools are registered with a definition (pure data) and an executor
 * (platform-dependent implementation). Built-in tools are conditionally
 * registered based on platform capabilities.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolEntry>();

  /**
   * Register a tool with its executor.
   */
  register(definition: ToolDefinition, executor: IToolExecutor): void {
    if (this.tools.has(definition.name)) {
      console.warn(`Tool "${definition.name}" is already registered. Overwriting.`);
    }
    this.tools.set(definition.name, { definition, executor });
  }

  /**
   * Unregister a tool by name.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool entry by name.
   */
  get(name: string): ToolEntry | null {
    return this.tools.get(name) ?? null;
  }

  /**
   * List all registered tool definitions.
   */
  listDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  /**
   * Check if a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool call.
   */
  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const entry = this.tools.get(call.name);
    if (!entry) {
      return {
        callId: call.id,
        output: `Unknown tool: ${call.name}`,
        isError: true,
      };
    }

    try {
      return await entry.executor.execute(call, context);
    } catch (error) {
      return {
        callId: call.id,
        output: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    }
  }

  /**
   * Register built-in tools based on platform capabilities.
   */
  registerBuiltinTools(_platform: IPlatform): void {
    // Built-in tools are registered via explicit import and registration
    // in the application layer. This method is a convenience for bulk registration.
    // Individual tool registration happens in the builtins/ modules.
  }

  /**
   * Get the number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}
