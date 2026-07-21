import type { ContentBlock, DisplayToolCall } from '../types';

export function backfillAutoReviewBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.type !== 'tool_call') continue;

    const autoReviewBlock = toAutoReviewBlock(block.call);
    if (autoReviewBlock && !hasAutoReviewBlock(blocks, autoReviewBlock)) {
      result.push(autoReviewBlock);
    }
  }
  return result;
}

function toAutoReviewBlock(toolCall: DisplayToolCall): ContentBlock | null {
  const value = toolCall.result?.metadata?.autoReviewVerdict;
  if (!value || typeof value !== 'object') return null;

  const verdict = value as Record<string, unknown>;
  if (!isAutoReviewVerdict(verdict.verdict) || typeof verdict.reason !== 'string') return null;
  return {
    type: 'auto_review',
    toolName: toolCall.name,
    verdict: verdict.verdict,
    reason: verdict.reason,
    ...(typeof verdict.ruleId === 'string' ? { ruleId: verdict.ruleId } : {}),
  };
}

function hasAutoReviewBlock(blocks: ContentBlock[], candidate: ContentBlock): boolean {
  if (candidate.type !== 'auto_review') return false;
  return blocks.some((block) => (
    block.type === 'auto_review' &&
    block.toolName === candidate.toolName &&
    block.verdict === candidate.verdict &&
    block.reason === candidate.reason &&
    block.ruleId === candidate.ruleId
  ));
}

function isAutoReviewVerdict(value: unknown): value is 'approve' | 'deny' | 'ask_user' {
  return value === 'approve' || value === 'deny' || value === 'ask_user';
}
