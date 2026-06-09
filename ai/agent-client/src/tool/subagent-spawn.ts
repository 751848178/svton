import type { ToolCall, ToolResult, IToolExecutor } from '@svton/agent-core';
import type { SubagentManager } from '@svton/agent-core';

/**
 * Tool executor that spawns a sub-agent for isolated sub-tasks.
 */
export class SubagentSpawnExecutor implements IToolExecutor {
  private manager: SubagentManager | null;
  constructor(manager: SubagentManager) {
    this.manager = manager;
  }
  async execute(call: ToolCall): Promise<ToolResult> {
    const { task, roleDescription } = call.arguments as { task?: string; roleDescription?: string };
    if (!task || typeof task !== 'string') {
      return { callId: call.id, output: 'Error: "task" is required and must be a string.', isError: true };
    }
    if (!this.manager) {
      return { callId: call.id, output: 'SubagentManager not available', isError: true };
    }
    try {
      const result = await this.manager.spawn({ task, roleDescription });
      return {
        callId: call.id,
        output: result.success
          ? result.summary
          : `Subagent failed: ${result.error ?? 'unknown error'}`,
        isError: !result.success,
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Subagent error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

/** Tool definition for subagent_spawn */
export const subagentSpawnDef = {
  name: 'subagent_spawn',
  description: 'Spawn a sub-agent to handle a specific sub-task independently. The sub-agent gets its own context and tools. Use this for parallelizable or isolated tasks.',
  parameters: {
    type: 'object' as const,
    properties: {
      task: { type: 'string', description: 'Clear description of the task for the sub-agent' },
      roleDescription: { type: 'string', description: 'Role/persona for the sub-agent (e.g. "a code reviewer")' },
    },
    required: ['task'],
  },
};
