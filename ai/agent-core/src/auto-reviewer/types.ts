/**
 * Auto-reviewer type definitions.
 *
 * The auto-reviewer evaluates tool calls before execution and produces
 * a verdict (approve / deny / ask_user) based on configurable rules.
 * This enables safe autonomous operation by auto-approving safe operations
 * and blocking dangerous ones.
 */

import type { ToolCall } from '../tool/types';
import type { SandboxMode } from '@svton/agent-platform';

export type ReviewVerdict = 'approve' | 'deny' | 'ask_user';

export type ReviewerMode = 'auto_review' | 'manual';

export interface ReviewContext {
  toolCall: ToolCall;
  toolName: string;
  args: Record<string, unknown>;
  workingDir: string;
  sandboxMode?: SandboxMode;
}

export interface ReviewResult {
  verdict: ReviewVerdict;
  reason: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** ID of the rule that produced this result, if any */
  ruleId?: string;
}

export interface ReviewRule {
  id: string;
  description: string;
  matches(ctx: ReviewContext): boolean;
  verdict: ReviewVerdict;
  reason: string;
}

export interface ReviewerConfig {
  mode: ReviewerMode;
  rules: ReviewRule[];
}
