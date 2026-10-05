// Cloud timer readiness is independent of the later IP/agent readiness waits.
import type { CvmClientLike } from './tencent-client.js';
import { sleepOrAbort, verifyActionTimer, type ActionTimerView, type TimerVerification } from './tencent-lifecycle.js';
import type { ProviderLog } from './provider.js';

export const ACTION_TIMER_TIMEOUT_MS = 3 * 60_000;
export const ACTION_TIMER_POLL_MS = 5_000;

function queryBeforeDeadline(
  client: Pick<CvmClientLike, 'DescribeInstancesActionTimer'>,
  instanceId: string,
  remainingMs: number,
  signal: AbortSignal,
): Promise<ActionTimerView> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const fail = (error: unknown) => { cleanup(); reject(error); };
    const abort = () => fail(new Error('builder provisioning cancelled while verifying the cloud timer'));
    const timer = setTimeout(() => fail(new Error('cloud terminate timer verification FAILED: timer query exceeded verification deadline')), remainingMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    void Promise.resolve().then(() => {
      if (signal.aborted) throw new Error('builder provisioning cancelled while verifying the cloud timer');
      return client.DescribeInstancesActionTimer({ InstanceIds: [instanceId] });
    }).then(view => { cleanup(); resolve(view); }, fail);
  });
}

export async function waitForVerifiedActionTimer(
  client: Pick<CvmClientLike, 'DescribeInstancesActionTimer'>,
  instanceId: string,
  expectedIso: string,
  signal: AbortSignal,
  log: ProviderLog,
): Promise<Extract<TimerVerification, { ok: true }>> {
  const deadline = Date.now() + ACTION_TIMER_TIMEOUT_MS;
  let lastReason = 'cloud returned no action timers for this instance';
  for (;;) {
    if (signal.aborted) throw new Error('builder provisioning cancelled while verifying the cloud timer');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`cloud terminate timer verification FAILED: ${lastReason} within ${ACTION_TIMER_TIMEOUT_MS}ms`);
    const view = await queryBeforeDeadline(client, instanceId, remaining, signal);
    if (signal.aborted) throw new Error('builder provisioning cancelled while verifying the cloud timer');
    if (Date.now() >= deadline) throw new Error('cloud terminate timer verification FAILED: verification deadline expired');
    const verdict = verifyActionTimer(view, instanceId, expectedIso);
    if (verdict.ok) return verdict;
    // Only the official empty-list response is eventually consistent. Never retry a
    // malformed response, wrong instance/action/status/time, or a thrown SDK error.
    if (!Array.isArray(view?.ActionTimers) || view.ActionTimers.length !== 0) {
      throw new Error(`cloud terminate timer verification FAILED: ${verdict.reason}`);
    }
    lastReason = verdict.reason;
    log('waiting for cloud terminate timer visibility', { instanceId });
    await sleepOrAbort(Math.min(ACTION_TIMER_POLL_MS, Math.max(0, deadline - Date.now())), signal);
  }
}
