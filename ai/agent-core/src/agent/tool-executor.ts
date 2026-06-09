import type { ToolCall, ToolResult, ToolContext } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { PermissionManager } from '../permission/manager';
import type { HookManager } from '../hooks/manager';
import type { AgentEvent } from './types';
import type { IPlatform } from '@svton/agent-platform';
import type { ContextManager } from './context';
import { logger } from '../utils/logger';

/**
 * Handles tool execution with permission gating and hook lifecycle.
 *
 * Extracted from AgentRuntime to isolate the tool execution pipeline
 * and make it independently testable.
 */
export class ToolExecutionService {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly contextManager: ContextManager,
    private readonly platform: IPlatform,
    private readonly workingDir: string,
    private readonly permissionManager: PermissionManager | null,
    private readonly hookManager: HookManager | null,
    private readonly pendingApprovals: Map<string, {
      call: ToolCall;
      resolve: (approved: boolean) => void;
      timestamp: number;
    }>,
  ) {}

  /**
   * Execute a tool call through the full pipeline:
   * 1. Pre-tool hook
   * 2. Permission check
   * 3. User approval (if needed)
   * 4. Tool execution
   * 5. Post-tool hook
   * 6. Context update
   */
  async *execute(call: ToolCall): AsyncGenerator<AgentEvent> {
    logger.info('Tool', `Executing: ${call.name}`, {
      id: call.id,
      args: call.arguments,
    });

    // 1. Pre-tool hook
    if (this.hookManager) {
      const hookResult = await this.hookManager.trigger('pre_tool_use', {
        event: 'pre_tool_use',
        toolName: call.name,
        toolCall: call,
      });

      if (hookResult.action === 'deny') {
        yield {
          type: 'tool_call_end',
          result: {
            callId: call.id,
            output: `Tool call denied by hook: ${hookResult.reason || 'no reason given'}`,
            isError: true,
          },
        };
        this.addToolResultToContext(call.id, 'Tool call denied by hook', true);
        return;
      }
    }

    // 2. Permission check
    if (this.permissionManager) {
      const decision = this.permissionManager.check(call);

      if (!decision.allowed) {
        yield {
          type: 'tool_call_end',
          result: {
            callId: call.id,
            output: `Permission denied: ${decision.reason || 'not allowed'}`,
            isError: true,
          },
        };
        this.addToolResultToContext(call.id, `Permission denied: ${decision.reason}`, true);
        return;
      }

      if (decision.needsApproval) {
        // 3. User approval
        yield { type: 'tool_approval_needed', call };

        const approved = await this.waitForApproval(call);
        if (!approved) {
          yield {
            type: 'tool_call_end',
            result: {
              callId: call.id,
              output: 'Tool call rejected by user',
              isError: true,
            },
          };
          this.addToolResultToContext(call.id, 'Tool call rejected by user', true);
          return;
        }
      }
    }

    // 4. Execute the tool
    const toolCtx: ToolContext = {
      platform: this.platform,
      sessionId: '',
      workingDir: this.workingDir,
    };

    const result = await this.toolRegistry.execute(call, toolCtx);

    logger.info('Tool', `Result: ${call.name}`, {
      isError: result.isError,
      outputLength: result.output?.length ?? 0,
    });

    yield { type: 'tool_call_end', result };

    // 5. Post-tool hook
    if (this.hookManager) {
      await this.hookManager.trigger('post_tool_use', {
        event: 'post_tool_use',
        toolName: call.name,
        toolCall: call,
        toolResult: result,
      });
    }

    // 6. Context update
    this.addToolResultToContext(call.id, result.output, result.isError);
  }

  private waitForApproval(call: ToolCall): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(call.id, {
        call,
        resolve,
        timestamp: Date.now(),
      });
    });
  }

  private addToolResultToContext(callId: string, output: string, isError?: boolean): void {
    this.contextManager.addMessage({
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          toolUseId: callId,
          output,
          isError,
        },
      ],
    });
  }
}
