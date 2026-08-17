import { redactSecrets } from '@svton/agent-core';

export const MAX_PUBLIC_MODEL_SWITCH_ERROR = 500;

export function toPublicModelSwitchError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '模型切换失败。');
  const safe = redactSecrets(raw).replace(/\s+/g, ' ').trim() || '模型切换失败。';
  if (safe.length <= MAX_PUBLIC_MODEL_SWITCH_ERROR) return safe;
  return `${safe.slice(0, MAX_PUBLIC_MODEL_SWITCH_ERROR - 14)}… [truncated]`;
}
