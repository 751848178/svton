import type {
  ReviewerConfig,
  ReviewerMode,
  ReviewRule,
  ReviewContext,
  ReviewResult,
} from './types';

/**
 * Manages automatic tool call review.
 *
 * In **auto_review** mode, each rule is evaluated in order.
 * The first matching rule determines the verdict.
 * If no rule matches, the tool call is escalated to the user.
 *
 * In **manual** mode, every tool call is escalated to the user.
 */
export class AutoReviewerManager {
  private mode: ReviewerMode;
  private rules: ReviewRule[];

  constructor(config: ReviewerConfig) {
    this.mode = config.mode;
    this.rules = [...config.rules];
  }

  /**
   * Set the review mode.
   */
  setMode(mode: ReviewerMode): void {
    this.mode = mode;
  }

  /**
   * Get the current review mode.
   */
  getMode(): ReviewerMode {
    return this.mode;
  }

  /**
   * Add a rule to the reviewer.
   */
  addRule(rule: ReviewRule): void {
    // Remove any existing rule with the same id
    this.rules = this.rules.filter((r) => r.id !== rule.id);
    this.rules.push(rule);
  }

  /**
   * Remove a rule by its id.
   */
  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }

  /**
   * List all configured rules.
   */
  listRules(): ReviewRule[] {
    return [...this.rules];
  }

  /**
   * Review a tool call and produce a verdict.
   *
   * Evaluation order:
   * 1. In manual mode, always ask the user.
   * 2. Run all rules; the first match wins.
   * 3. If no rule matches, ask the user.
   */
  async review(ctx: ReviewContext): Promise<ReviewResult> {
    // Manual mode: always escalate
    if (this.mode === 'manual') {
      return {
        verdict: 'ask_user',
        reason: 'Manual mode',
        confidence: 0,
      };
    }

    // Evaluate rules in order
    for (const rule of this.rules) {
      try {
        if (rule.matches(ctx)) {
          return {
            verdict: rule.verdict,
            reason: rule.reason,
            confidence: 1,
            ruleId: rule.id,
          };
        }
      } catch {
        // A faulty rule should not break the review loop.
        // Skip and continue to the next rule.
      }
    }

    // No rule matched — escalate to user
    return {
      verdict: 'ask_user',
      reason: 'No matching rule',
      confidence: 0,
    };
  }
}
