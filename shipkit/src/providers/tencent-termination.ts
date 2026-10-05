// CVM deletion confirmation shared by release, compensation and expired-builder sweeping.
// Only type imports point back to the SDK adapter; this module owns no ledger writes.

import type { CvmClientLike } from './tencent-client.js';

export const TERMINATION_CONFIRM_BUDGET_MS = 3 * 60_000;
export const CANCEL_TERMINATION_BUDGET_MS = 6_000;
const CONFIRM_POLL_MS = 5_000;

/** A missing instance is an accepted deletion request, still confirmed by DescribeInstances. */
export async function terminateQuietly(client: CvmClientLike, instanceId: string): Promise<void> {
  try {
    await client.TerminateInstances({ InstanceIds: [instanceId] });
  } catch (e) {
    if (!/not\s*exist|invalid\s*instance/i.test(String((e as Error).message))) throw e;
  }
}

/** API acceptance is insufficient: callers retain their ledger until absence is confirmed. */
export async function terminateBuilder(client: CvmClientLike, instanceId: string, budgetMs = TERMINATION_CONFIRM_BUDGET_MS): Promise<void> {
  if (!Number.isSafeInteger(budgetMs) || budgetMs <= 0) throw new RangeError('termination budget must be a positive safe integer in milliseconds');
  const deadline = Date.now() + budgetMs;
  const unconfirmed = () => new Error(`termination of ${instanceId} was not confirmed within ${budgetMs}ms — retain the ledger and verify manually`);
  const bounded = async <T>(request: () => Promise<T>): Promise<T> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw unconfirmed();
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unconfirmed()), remaining); }),
        Promise.resolve().then(() => {
          if (Date.now() >= deadline) throw unconfirmed();
          return request();
        }),
      ]);
    } finally { clearTimeout(timer); }
  };
  await bounded(() => terminateQuietly(client, instanceId));
  for (;;) {
    const view = await bounded(() => client.DescribeInstances({ InstanceIds: [instanceId], Limit: 1 }));
    if (Date.now() >= deadline) throw unconfirmed();
    const instances = view.InstanceSet;
    if (Array.isArray(instances) && (instances.length === 0 ||
      (instances.length === 1 && instances[0]?.InstanceId === instanceId && instances[0]?.InstanceState === 'TERMINATED'))) return;
    // Clamp the sleep itself so a short cancellation budget leaves no losing timer
    // alive after timeout; the next SDK call checks the deadline before it is issued.
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(CONFIRM_POLL_MS, Math.max(0, deadline - Date.now()))));
  }
}
