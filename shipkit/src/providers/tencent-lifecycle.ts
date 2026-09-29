// Pure lifecycle decisions for dynamic builders (RA03 admission, RA07 timer verification).
// Timer verification reuses the OFFICIAL SDK types so the local contract cannot drift from
// tencentcloud-sdk-nodejs-cvm (field: ActionTimers; Status: UNDO|DOING|DONE).

import type {
  ActionTimer,
  DescribeInstancesActionTimerResponse,
} from 'tencentcloud-sdk-nodejs-cvm/tencentcloud/services/cvm/v20170312/cvm_models.js';
import type { BuilderState } from './builder-state.js';

export interface AdmissionInput {
  state: BuilderState;
  keepMinutes: number;
  /** real task budget: build timeout + push timeout + transfer overhead */
  taskBudgetMs: number;
  /** extra safety margin on top of the task budget */
  bufferMs?: number;
}

export type AdmissionDecision = { action: 'reuse' } | { action: 'replace'; reason: string };

/**
 * A machine may only be reused when it is ready, inside the idle window (anchored at the END of
 * the last task) AND its cloud terminate deadline leaves room for the FULL task budget plus
 * buffer — a cloud kill mid-task is never acceptable (RA03).
 */
export function admissionDecision(i: AdmissionInput): AdmissionDecision {
  const buffer = i.bufferMs ?? 10 * 60_000;
  if (i.state.status !== 'ready' || !i.state.url) return { action: 'replace', reason: 'not ready' };
  const idleMs = Date.now() - new Date(i.state.lastUsedAt ?? i.state.createdAt).getTime();
  if (idleMs > i.keepMinutes * 60_000) return { action: 'replace', reason: `idle ${Math.round(idleMs / 60_000)}min exceeds keep window ${i.keepMinutes}min` };
  const remainingMs = new Date(i.state.expireAt).getTime() - Date.now();
  const neededMs = i.taskBudgetMs + buffer;
  if (remainingMs < neededMs) {
    return {
      action: 'replace',
      reason: `remaining ${Math.round(remainingMs / 60_000)}min < task budget ${Math.round(i.taskBudgetMs / 60_000)}min + buffer ${Math.round(buffer / 60_000)}min`,
    };
  }
  return { action: 'reuse' };
}

/** constrained by the official response shape — a hand-rolled mirror is not allowed to drift */
export type ActionTimerView = Pick<DescribeInstancesActionTimerResponse, 'ActionTimers'>;

export type TimerVerification = { ok: true; actionTime: string } | { ok: false; reason: string };

/**
 * Strict verification against the cloud's own timer record (RA07). The response carries
 * `ActionTimers` (official SDK field); an entry passes only when it references OUR instance,
 * is a TerminateInstances action, is still UNDO (scheduled), and its UTC ISO8601 ActionTime
 * matches the expected deadline within tolerance. Anything else FAILS verification.
 */
export function verifyActionTimer(view: ActionTimerView, instanceId: string, expectedIso: string, toleranceMs = 3 * 60_000): TimerVerification {
  const set = view?.ActionTimers;
  if (!Array.isArray(set) || set.length === 0) return { ok: false, reason: 'cloud returned no action timers for this instance' };
  const mine = set.filter((t) => t.InstanceId === instanceId);
  if (mine.length === 0) return { ok: false, reason: `no timer entry references instance ${instanceId}` };
  for (const t of mine) {
    if (t.TimerAction !== 'TerminateInstances') {
      return { ok: false, reason: `timer action is '${t.TimerAction ?? '(none)'}', expected TerminateInstances` };
    }
    if (t.Status !== 'UNDO') {
      // missing status is NOT trusted; DOING means the destroy is executing, DONE means it already ran
      return { ok: false, reason: `timer status is '${t.Status ?? '(missing)'}', only an explicit UNDO (scheduled) admits a builder` };
    }
    const got = Date.parse(t.ActionTime ?? '');
    if (!Number.isFinite(got)) return { ok: false, reason: `timer ActionTime unparsable: '${t.ActionTime}'` };
    const expected = Date.parse(expectedIso);
    if (Math.abs(got - expected) > toleranceMs) {
      return { ok: false, reason: `timer ActionTime ${t.ActionTime} deviates from expected ${expectedIso} by >${Math.round(toleranceMs / 60000)}min` };
    }
  }
  return { ok: true, actionTime: mine[0]?.ActionTime ?? '' };
}

/** helper for building official-shaped sample entries in tests and fakes */
export function sdkTimerEntry(fields: Partial<ActionTimer>): ActionTimer {
  return { TimerAction: 'TerminateInstances', Status: 'UNDO', ...fields };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForPublicIp(
  client: { DescribeInstances(req: Record<string, unknown>): Promise<{ InstanceSet?: Array<{ InstanceStatus?: string; PublicIpAddresses?: string[] }> }> },
  instanceId: string,
  log: (msg: string, meta?: Record<string, unknown>) => void,
): Promise<string> {
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    const res = await client.DescribeInstances({ InstanceIds: [instanceId], Limit: 1 });
    const inst = res.InstanceSet?.[0];
    const ip = inst?.PublicIpAddresses?.[0];
    if (ip) return ip;
    const status = inst?.InstanceStatus ?? 'PENDING';
    if (status === 'LAUNCH_FAILED') throw new Error('CVM instance launch failed');
    if (Date.now() > deadline) throw new Error('timed out waiting for CVM instance public IP');
    log('waiting for instance', { instanceId, status });
    await sleep(5000);
  }
}
