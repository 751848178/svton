import type { ToolCall, ToolResult, ToolContext } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { PermissionManager } from '../permission/manager';
import type { HookManager } from '../hooks/manager';
import type { SkillDefinition } from '../skill/types';
import type { AgentEvent } from './types';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';
import type { ContextManager } from './context';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { ReviewResult } from '../auto-reviewer/types';
import type { SessionResumeManager } from '../checkpoint/manager';
import { logger } from '../utils/logger';
import { toAutoReviewMetadata, withAutoReviewMetadata } from './tool-auto-review-result.utils';
import { createPermissionDeniedResult, requestUserApproval, stopIfRunAborted } from './tool-execution-approval.utils';
import { enforceActiveSkillToolGate } from './tool-skill-gate.utils';
import { addToolResultToContext } from './tool-context-result.utils';
import { runPostToolUseHook, runPreToolUseHook } from './tool-hook-lifecycle.utils';

/**
 * Additional options for tool execution pipeline.
 * These are set post-construction because some managers are wired after runtime creation.
 */
export interface ToolExecOptions {
  autoReviewer?: AutoReviewerManager | null;
  resumeManager?: SessionResumeManager | null;
  sandboxProfile?: SandboxProfile | null;
  sandboxRequired?: boolean;
  sessionId?: string;
  signal?: AbortSignal;
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
   * 2. Active skill tool gate
   * 3. Permission and user approval (if needed)
   * 4. Tool execution
   * 5. Post-tool hook and context update
   */
  async *execute(call: ToolCall): AsyncGenerator<AgentEvent> {
    logger.info('Tool', `Executing: ${call.name}`, {
      id: call.id,
      args: call.arguments,
    });

    const initialAbort = yield* stopIfRunAborted(call, this.execOptions.signal);
    if (initialAbort) {
      addToolResultToContext(this.contextManager, call.id, initialAbort.output, true);
      return;
    }

    const preToolHook = await runPreToolUseHook(this.hookManager, call);
    call = preToolHook.toolCall;
    if (preToolHook.deniedResult) {
      const hookDeniedResult = preToolHook.deniedResult;
      yield { type: 'tool_call_end', result: hookDeniedResult };
      addToolResultToContext(this.contextManager, call.id, hookDeniedResult.output, true);
      return;
    }

    const skillGateResult = enforceActiveSkillToolGate(call, this.activeSkills);
    if (skillGateResult) {
      yield { type: 'tool_call_end', result: skillGateResult };
      addToolResultToContext(this.contextManager, call.id, skillGateResult.output, true);
      return;
    }

    let autoReviewResult: ReviewResult | null = null;

    // 2. Permission check
    if (this.permissionManager) {
      const decision = this.permissionManager.check(call);

      if (!decision.allowed) {
        const result = createPermissionDeniedResult(call.id, decision.reason);
        yield {
          type: 'tool_call_end',
          result,
        };
        addToolResultToContext(this.contextManager, call.id, result.output, true);
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
            autoReviewResult = review;
            logger.info('Tool', `Auto-approved by rule: ${review.ruleId ?? 'auto'}`, { tool: call.name });
          } else if (review.verdict === 'deny') {
            yield {
              type: 'tool_call_end',
              result: withAutoReviewMetadata({
                callId: call.id,
                output: `Auto-reviewer denied: ${review.reason}`,
                isError: true,
              }, review),
            };
            addToolResultToContext(this.contextManager, call.id, `Auto-reviewer denied: ${review.reason}`, true);
            return;
          } else {
            // ask_user — fall through to user approval
            const rejection = yield* requestUserApproval(
              this.pendingApprovals,
              call,
              this.execOptions.signal,
              (result) => withAutoReviewMetadata(result, review),
              toAutoReviewMetadata(review),
            );
            if (rejection) {
              addToolResultToContext(this.contextManager, call.id, rejection.output, true);
              return;
            }
            autoReviewResult = review;
          }
        } else {
          const rejection = yield* requestUserApproval(this.pendingApprovals, call, this.execOptions.signal);
          if (rejection) {
            addToolResultToContext(this.contextManager, call.id, rejection.output, true);
            return;
          }
        }
      }
    }

    const beforeExecuteAbort = yield* stopIfRunAborted(call, this.execOptions.signal);
    if (beforeExecuteAbort) {
      addToolResultToContext(this.contextManager, call.id, beforeExecuteAbort.output, true);
      return;
    }

    // 4. Execute the tool
    const toolCtx: ToolContext = {
      platform: this.platform,
      sessionId: this.execOptions.sessionId ?? '',
      workingDir: this.workingDir,
      sandboxProfile: this.execOptions.sandboxProfile,
      sandboxRequired: this.execOptions.sandboxRequired,
      signal: this.execOptions.signal,
    };

    const result = withAutoReviewMetadata(
      await this.toolRegistry.execute(call, toolCtx),
      autoReviewResult,
    );

    logger.info('Tool', `Result: ${call.name}`, {
      isError: result.isError,
      outputLength: result.output?.length ?? 0,
    });

    yield { type: 'tool_call_end', result };

    await runPostToolUseHook(this.hookManager, call, result);

    // 6. Context update
    addToolResultToContext(this.contextManager, call.id, result.output, result.isError);
  }
}
