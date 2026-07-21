import type { ReviewResult } from '../auto-reviewer/types';
import type { ToolResult } from '../tool/types';

export function toAutoReviewMetadata(review: ReviewResult | null): Record<string, unknown> | undefined {
  if (!review) return undefined;

  return {
    autoReviewVerdict: {
      verdict: review.verdict,
      reason: review.reason,
      ruleId: review.ruleId,
    },
  };
}

export function withAutoReviewMetadata(result: ToolResult, review: ReviewResult | null): ToolResult {
  const autoReviewMetadata = toAutoReviewMetadata(review);
  if (!autoReviewMetadata) return result;

  return {
    ...result,
    metadata: {
      ...result.metadata,
      ...autoReviewMetadata,
    },
  };
}
