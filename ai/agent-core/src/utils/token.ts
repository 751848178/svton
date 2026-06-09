/**
 * Estimate token count for a text string.
 *
 * Heuristic: ~4 chars per token for English, ~2 chars for CJK.
 * This is intentionally rough — for accurate counts use the provider's API.
 */
export function countTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const rest = text.length - cjk;
  return Math.ceil(cjk / 2 + rest / 4);
}
