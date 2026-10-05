// CVM deletion confirmation shared by release, compensation and expired-builder sweeping.
// Only type imports point back to the SDK adapter; this module owns no ledger writes.

import type { CvmClientLike } from './tencent-client.js';

/** A missing instance is an accepted deletion request, still confirmed by DescribeInstances. */
export async function terminateQuietly(client: CvmClientLike, instanceId: string): Promise<void> {
  try {
    await client.TerminateInstances({ InstanceIds: [instanceId] });
  } catch (e) {
    if (!/not\s*exist|invalid\s*instance/i.test(String((e as Error).message))) throw e;
  }
}

/** API acceptance is insufficient: callers retain their ledger until absence is confirmed. */
export async function terminateBuilder(client: CvmClientLike, instanceId: string, budgetMs = 6_000): Promise<void> {
  const deadline = Date.now() + budgetMs;
  const bounded = async <T>(request: () => Promise<T>): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        request(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`termination of ${instanceId} was not confirmed within ${budgetMs}ms — retain the ledger and verify manually`)), Math.max(0, deadline - Date.now())); }),
      ]);
    } finally { clearTimeout(timer); }
  };
  await bounded(() => terminateQuietly(client, instanceId));
  for (;;) {
    const view = await bounded(() => client.DescribeInstances({ InstanceIds: [instanceId], Limit: 1 }));
    const instances = view.InstanceSet;
    if (Array.isArray(instances) && (instances.length === 0 ||
      (instances.length === 1 && instances[0]?.InstanceId === instanceId && instances[0]?.InstanceState === 'TERMINATED'))) return;
    await bounded(() => new Promise<void>(resolve => setTimeout(resolve, 200)));
  }
}
