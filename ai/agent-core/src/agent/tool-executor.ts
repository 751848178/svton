import type { ToolCall, ToolResult, ToolContext } from '../tool/types';
import type { ToolRegistry } from '../tool/registry';
import type { PermissionManager } from '../permission/manager';
import type { HookManager } from '../hooks/manager';
import type { SkillDefinition } from '../skill/types';
import type { SvtonCapabilityEvent } from './types';
import type { IPlatform, SandboxProfile } from '@svton/agent-platform';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { PendingApprovalMap } from './approval-gate';
import { logger } from '../utils/logger';
import { withAutoReviewMetadata } from './tool-auto-review-result.utils';
import { readRunAbortResult } from './tool-execution-approval.utils';
import { enforceActiveSkillToolGate } from './tool-skill-gate.utils';
import { noopToolResultSink, type ToolResultSink } from './tool-context-result.utils';
import { runPostToolUseHook, runPreToolUseHook } from './tool-hook-lifecycle.utils';
import { runPermissionAndApprovalGate } from './tool-policy-gates';
import { createSecretRedactor } from './secret-redactor.utils';

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
 * Optional result redactor (Architecture §5.3 svton-owned: "result redaction
 * and audit metadata"). Invoked after the tool executes and before the result
 * is yielded/recorded. The default scrubs common secrets (see
 * `secret-redactor.utils`); callers may install a stricter or identity redactor.
 *
 * The hook receives the call + executed result and must return a `ToolResult`
 * (possibly a redacted copy). It MUST NOT throw; failures should return the
 * input unchanged. The executor also writes an audit-log line around the call
 * (see `auditToolResult`) so the redaction decision is observable.
 */
export type Redactor = (call: ToolCall, result: ToolResult) => ToolResult;

/**
 * Handles tool execution with permission gating, auto-review, sandbox wrapping,
 * hook lifecycle, and the redaction/audit seam.
 *
 * Pipeline order (Architecture §5.3, §7.4):
 *   abort → pre-hook → skill-gate → permission → auto-review → approval
 *   → abort → sandbox+platform exec → REDACT/audit → post-hook → record.
 *
 * Pi Agent owns scheduling/batch/progress; this service owns the policy path.
 * The only entry to product execution is `execute()` — every tool the LLM
 * requests flows through here via the `AgentTool` wrapper in `pi-tool-adapter`.
 */
export class ToolExecutionService {
  private activeSkills: SkillDefinition[] = [];
  private execOptions: ToolExecOptions = {};
  // Default to the real secret-scrubbing redactor (Architecture §5.3). Callers
  // can still override with `setRedactor` (e.g. tests, or a stricter pipeline).
  private redactor: Redactor = createSecretRedactor();
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly platform: IPlatform,
    private readonly workingDir: string,
    private readonly permissionManager: PermissionManager | null,
    private readonly hookManager: HookManager | null,
    private readonly pendingApprovals: PendingApprovalMap,
    private readonly toolResultSink: ToolResultSink = noopToolResultSink,
  ) {}

  /** Set additional execution options (auto-reviewer, sandbox, session ID). */
  setExecOptions(options: Partial<ToolExecOptions>): void {
    this.execOptions = { ...this.execOptions, ...options };
  }

  /** Set the currently active skills (called by SvtonAgentRuntime after skill injection). */
  setActiveSkills(skills: SkillDefinition[]): void {
    this.activeSkills = skills;
  }

  /**
   * Override the result redactor (Architecture §5.3). The default scrubs common
   * secret shapes (API keys, bearer tokens, AWS/GitHub/Stripe keys, PEM blocks,
   * JWTs) — see `secret-redactor.utils`. Tests or stricter pipelines may install
   * their own; pass the identity redactor `(c, r) => r` to disable scrubbing.
   */
  setRedactor(redactor: Redactor): void {
    this.redactor = redactor;
  }

  /**
   * Execute a tool call through the full policy pipeline.
   *
   * @param signal optional abort signal (overrides `execOptions.signal`; Pi
   *   Agent forwards its per-run signal so aborts halt in-flight execution).
   * @param onProgress optional streaming-progress callback bridged into the
   *   tool's `ToolContext.onProgress` so a tool that emits partial output
   *   surfaces it through Pi as `tool_execution_update` (mapped by the runtime
   *   native Pi `tool_execution_update` lifecycle). PI005 plumbing.
   */
  async *execute(
    call: ToolCall,
    signal?: AbortSignal,
    onProgress?: (message: string) => void,
  ): AsyncGenerator<SvtonCapabilityEvent, ToolResult> {
    if (signal) this.execOptions = { ...this.execOptions, signal };
    logger.info('Tool', `Executing: ${call.name}`, { id: call.id, args: call.arguments });

    const initialAbort = readRunAbortResult(call, this.execOptions.signal);
    if (initialAbort) {
      this.toolResultSink(call.id, initialAbort.output, true);
      return initialAbort;
    }

    const preToolHook = await runPreToolUseHook(this.hookManager, call);
    call = preToolHook.toolCall;
    if (preToolHook.deniedResult) {
      const denied = preToolHook.deniedResult;
      this.toolResultSink(call.id, denied.output, true);
      return denied;
    }

    const skillGateResult = enforceActiveSkillToolGate(call, this.activeSkills);
    if (skillGateResult) {
      this.toolResultSink(call.id, skillGateResult.output, true);
      return skillGateResult;
    }

    const outcome = yield* runPermissionAndApprovalGate({
      call, workingDir: this.workingDir, permissionManager: this.permissionManager,
      autoReviewer: this.execOptions.autoReviewer ?? null,
      pendingApprovals: this.pendingApprovals, execOptions: this.execOptions,
    });
    if (outcome.kind === 'blocked') {
      this.toolResultSink(call.id, outcome.result.output, true);
      return outcome.result;
    }

    const beforeExecAbort = readRunAbortResult(call, this.execOptions.signal);
    if (beforeExecAbort) {
      this.toolResultSink(call.id, beforeExecAbort.output, true);
      return beforeExecAbort;
    }

    const toolCtx: ToolContext = {
      platform: this.platform,
      sessionId: this.execOptions.sessionId ?? '',
      workingDir: this.workingDir,
      sandboxProfile: this.execOptions.sandboxProfile,
      sandboxRequired: this.execOptions.sandboxRequired,
      signal: this.execOptions.signal,
      onProgress,
    };

    const executed = withAutoReviewMetadata(
      await this.toolRegistry.execute(call, toolCtx),
      outcome.autoReviewResult,
    );

    // SEAM (Architecture §5.3): redact + audit before yielding/recording.
    const result = auditAndRedact(this.redactor, call, executed);

    logger.info('Tool', `Result: ${call.name}`, {
      isError: result.isError, outputLength: result.output?.length ?? 0,
    });

    await runPostToolUseHook(this.hookManager, call, result);

    // Pi Agent records the tool result from the AgentToolResult the wrapper
    // returns; the sink is a no-op for the normal path but kept for callers
    // that observe results outside Pi (denied/blocked calls above).
    this.toolResultSink(call.id, result.output, result.isError);
    return result;
  }
}

/**
 * Apply the redactor and emit an audit-log line. Redaction is best-effort: if
 * the hook throws, the original result is preserved and the failure is logged.
 */
function auditAndRedact(redactor: Redactor, call: ToolCall, result: ToolResult): ToolResult {
  let redacted = result;
  try {
    redacted = redactor(call, result);
  } catch (err) {
    logger.warn('Tool', `Redactor threw for ${call.name}; using unredacted result`, { error: String(err) });
    redacted = result;
  }
  logger.info('Tool', `Audit: ${call.name}`, {
    callId: call.id, isError: redacted.isError, redacted: redacted !== result,
  });
  return redacted;
}
