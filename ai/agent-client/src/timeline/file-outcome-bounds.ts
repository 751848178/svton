import { redactSecrets } from '@svton/agent-core';
import type { FileTimelineChange } from './types';
import { boundTimelineText } from './bounds';

export const MAX_FILE_CHANGES = 50;
export const MAX_FILE_PATH = 4_096;
export const MAX_FILE_DIFF_TOTAL = 65_536;

export function boundFileChanges(changes: FileTimelineChange[]): FileTimelineChange[] {
  let remaining = MAX_FILE_DIFF_TOTAL;
  return changes.slice(-MAX_FILE_CHANGES).map((change) => {
    const diff = change.diff ? boundDiff(change.diff, remaining) : undefined;
    remaining -= diff?.length ?? 0;
    return {
      sourceCallId: change.sourceCallId,
      path: boundTimelineText(change.path, MAX_FILE_PATH),
      changeType: change.changeType,
      status: change.status,
      ...(diff ? { diff } : {}),
    };
  });
}

function boundDiff(value: string, budget: number): string | undefined {
  if (budget <= 0) return undefined;
  const safe = redactSecrets(value);
  if (safe.length <= budget) return safe;
  if (budget <= 14) return safe.slice(0, budget);
  return `${safe.slice(0, budget - 14)}\n[truncated]`;
}
