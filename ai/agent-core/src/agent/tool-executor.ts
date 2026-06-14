import type { ToolCall, ToolResult, ToolContext } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { PermissionManager } from '../permission/manager';
import type { HookManager } from '../hooks/manager';
import type { SkillDefinition } from '../skill/types';
import type { AgentEvent } from './types';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';
import type { ContextManager } from './context';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import { logger } from '../utils/logger';

/**
 * Additional options for tool execution pipeline.
 * These are set post-construction because some managers are wired after runtime creation.
 */
export interface ToolExecOptions {
  autoReviewer?: AutoReviewerManager | null;
  resumeManager?: SessionResumeManager | null;
  sandboxProfile?: SandboxProfile | null;
  sessionId?: string;
}

/**
 * Handles tool execution with permission gating, auto-review, sandbox wrapping,
 * and hook lifecycle.
 */
export class ToolExecutionService {
  /** Skills active in the current run, set by AgentRuntime before tool execution */
  private activeSkills: SkillDefinition[] = [];
  /** Extra options settable post-construction */
  private execOptions: ToolExecOptions = {};

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

  /** Set additional execution options (auto-reviewer, sandbox, session ID) */
  setExecOptions(options: Partial<ToolExecOptions>): void {
    this.execOptions = { ...this.execOptions, ...options };
  }

  /** Set the currently active skills (called by AgentRuntime after skill injection) */
  setActiveSkills(skills: SkillDefinition[]): void {
    this.activeSkills = skills;
  }

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
        // 2a. Auto-reviewer check (if configured)
        if (this.execOptions.autoReviewer) {
          const review = await this.execOptions.autoReviewer.review({
            toolCall: call,
            toolName: call.name,
            args: call.arguments,
            workingDir: this.workingDir,
          });

          if (review.verdict === 'approve') {
            logger.info('Tool', `Auto-approved by rule: ${review.ruleId ?? 'auto'}`, { tool: call.name });
            // Skip user approval — proceed to execution
            // (fall through past the approval block)
          } else if (review.verdict === 'deny') {
            yield {
              type: 'tool_call_end',
              result: {
                callId: call.id,
                output: `Auto-reviewer denied: ${review.reason}`,
                isError: true,
              },
            };
            this.addToolResultToContext(call.id, `Auto-reviewer denied: ${review.reason}`, true);
            return;
          } else {
            // ask_user — fall through to user approval
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
        } else {
          // 3. User approval (no auto-reviewer)
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
    }

    // 2.5 Skill-scoped tool check
    if (this.activeSkills.length > 0) {
      for (const skill of this.activeSkills) {
        // Check disallowedTools
        if (skill.disallowedTools?.includes(call.name)) {
          yield {
            type: 'tool_call_end',
            result: {
              callId: call.id,
              output: `Tool "${call.name}" is disallowed by active skill "${skill.name}"`,
              isError: true,
            },
          };
          this.addToolResultToContext(call.id, `Disallowed by skill "${skill.name}"`, true);
          return;
        }
        // Check allowedTools (whitelist — if defined, tool must be in it)
        if (skill.allowedTools?.length && !skill.allowedTools.includes(call.name)) {
          yield {
            type: 'tool_call_end',
            result: {
              callId: call.id,
              output: `Tool "${call.name}" is not in the allowed list for active skill "${skill.name}"`,
              isError: true,
            },
          };
          this.addToolResultToContext(call.id, `Not allowed by skill "${skill.name}"`, true);
          return;
        }
      }
    }

    // 4. Execute the tool
    const toolCtx: ToolContext = {
      platform: this.platform,
      sessionId: this.execOptions.sessionId ?? '',
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
