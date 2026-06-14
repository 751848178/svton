import type { ToolCall, ToolResult, IToolExecutor } from '@svton/agent-core';
import type { SubagentManager } from '@svton/agent-core';

/**
 * Tool executor that spawns a sub-agent for isolated sub-tasks.
 * Supports dynamic agent creation with custom tools, model, and persona.
 */
export class SubagentSpawnExecutor implements IToolExecutor {
  private manager: SubagentManager | null;
  constructor(manager: SubagentManager) {
    this.manager = manager;
  }
  async execute(call: ToolCall): Promise<ToolResult> {
    const {
      task,
      roleDescription,
      tools,
      excludeTools,
      model,
      maxIterations,
      timeout,
    } = call.arguments as {
      task?: string;
      roleDescription?: string;
      tools?: string[];
      excludeTools?: string[];
      model?: string;
      maxIterations?: number;
      timeout?: number;
    };

    if (!task || typeof task !== 'string') {
      return { callId: call.id, output: 'Error: "task" is required and must be a string.', isError: true };
    }
    if (!this.manager) {
      return { callId: call.id, output: 'SubagentManager not available', isError: true };
    }
    try {
      const result = await this.manager.spawn({
        task,
        roleDescription,
        tools,
        excludeTools,
        model,
        maxIterations,
        timeout,
        isolatedContext: true,
      });
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

/** Tool definition for subagent_spawn — dynamic agent creation */
export const subagentSpawnDef = {
  name: 'subagent_spawn',
  description: [
    'Dynamically create and spawn a sub-agent for a specialized task.',
    'The sub-agent runs in its own isolated context with a customizable tool set.',
    'Use this to delegate work like: code review, research, testing, parallel file analysis.',
    '',
    'You can customize the sub-agent by specifying:',
    '- roleDescription: Define the agent\'s persona/expertise (e.g. "security auditor")',
    '- tools: Whitelist specific tools (e.g. ["file_read", "grep", "glob"])',
    '- excludeTools: Blacklist tools the sub-agent should NOT have',
    '- model: Use a different model for the sub-agent',
    '- maxIterations: Limit how many steps the sub-agent can take',
    '- timeout: Max execution time in milliseconds',
  ].join('\n'),
  parameters: {
    type: 'object' as const,
    properties: {
      task: {
        type: 'string',
        description: 'Clear, detailed description of what the sub-agent should accomplish. Include context, constraints, and expected output format.',
      },
      roleDescription: {
        type: 'string',
        description: 'Define the sub-agent\'s role and expertise. This shapes its behavior and decision-making. Examples: "a meticulous code reviewer who focuses on security vulnerabilities", "a research analyst who provides concise summaries with citations".',
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Whitelist of tool names the sub-agent can use. If omitted, inherits all parent tools. Example: ["file_read", "grep", "glob", "web_search"]',
      },
      excludeTools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tools to exclude from the sub-agent. Useful when inheriting all tools but removing dangerous ones. Example: ["file_write", "file_edit", "bash"]',
      },
      model: {
        type: 'string',
        description: 'Model to use for the sub-agent (e.g. "deepseek-chat", "gpt-4o"). If omitted, uses the parent\'s model.',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum number of reasoning/tool-call iterations. Default: 10.',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 120000 (2 min).',
      },
    },
    required: ['task'],
  },
};
