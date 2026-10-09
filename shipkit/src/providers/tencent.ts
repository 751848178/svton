// Tencent Cloud CVM adapter. Lifecycle contract (F11/F13/F18/F20 + RA03/RA04/RA07):
// - instanceId is persisted the moment it exists; provisioning failures terminate as compensation
// - the cloud terminate timer is VERIFIED (DescribeInstancesActionTimer) before a machine is ready
// - reuse admission requires room for the FULL task budget; mid-task destruction is impossible
//   because tasks hold a lease and idle is anchored at task completion

import type { TencentCvmConfig } from '../shared/types.js';
import { randomUUID } from 'node:crypto';
import { DEFAULT_AGENT_PORT } from './bundle-server.js';
import type { BuilderHandle, BuilderProvider, BuilderProviderStatus, ProviderLog } from './provider.js';
import {
  acquireLeaseLocked,
  clearState,
  leaseHeldByOther,
  readState,
  renewLease,
  releaseLease,
  stateFileFor,
  withLock,
} from './builder-state.js';
import { agentHealthy, authedBuilderStatus, mkCvmClient, requireCreds } from './tencent-client.js';
import { admissionDecision } from './tencent-lifecycle.js';
import { terminateBuilder } from './tencent-termination.js';
import { EnsureCancelled, provisionBuilder } from './tencent-provision.js';

const DEFAULT_TASK_BUDGET_MS = 90 * 60_000;

const CANCEL_SETTLE_BUDGET_MS = 8_000;

export class TencentBuilderProvider implements BuilderProvider {
  readonly kind = 'tencent';
  /** the in-flight ensure (if any) — a user cancel aborts it cooperatively so
   *  release() is never deadlocked on the create lock (S06) */
  private ensureAbort: AbortController | null = null;
  private ensureSettled: Promise<unknown> | null = null;
  private leaseToken: string | null = null;

  constructor(
    private readonly cfg: TencentCvmConfig,
    private readonly keepMinutes: number,
    private readonly distDir: string,
    private readonly bootstrapDir: string,
  ) {}

  /** named entry when configured (TLS identity comes from the entry, not the raw IP) */
  private agentUrl(ip: string): string {
    const host = this.cfg.agentHost ?? ip;
    return `${this.cfg.agentScheme ?? 'http'}://${host}:${this.cfg.agentPort ?? DEFAULT_AGENT_PORT}`;
  }

  async ensure(log: ProviderLog, taskBudgetMs = DEFAULT_TASK_BUDGET_MS): Promise<BuilderHandle> {
    return this.prepare(log, taskBudgetMs);
  }

  private async prepare(log: ProviderLog, taskBudgetMs: number, leaseToken?: string): Promise<BuilderHandle> {
    if (this.ensureAbort) throw new Error('builder is BUSY: preparation already running on this provider');
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    const ac = new AbortController();
    this.ensureAbort = ac;
    const run = (async () => {
      const guard = (where: string) => {
        if (ac.signal.aborted) throw new EnsureCancelled();
        void where;
      };
      guard('entry');
      return withLock(file, async () => {
        guard('lock');
        const admit = async (handle: BuilderHandle) => {
          if (leaseToken) await acquireLeaseLocked(file, leaseToken);
          return handle;
        };
      const st = await readState(file);
      if (st) {
        if (leaseHeldByOther(st, leaseToken)) {
          throw new Error(
            `builder is BUSY: task lease held by pid ${st.lease?.pid} until ${st.lease?.expiresAt} — refusing to touch instance ${st.instanceId}`,
          );
        }
        const decision = admissionDecision({ state: st, keepMinutes: this.keepMinutes, taskBudgetMs });
        if (decision.action === 'reuse') {
          const healthy = await agentHealthy(st.url!);
          guard('reuse-health');
          if (healthy) {
            log('reusing active builder instance', { instanceId: st.instanceId, url: st.url, taskBudgetMin: Math.round(taskBudgetMs / 60_000) });
            return admit({ url: st.url!, token: st.token });
          }
        }
        if (decision.action === 'reuse') log('builder unreachable — replacing', { instanceId: st.instanceId });
        else log(`replacing builder: ${decision.reason}`, { instanceId: st.instanceId });
        const client = await mkCvmClient(creds.secretId, creds.secretKey, st.region);
        await terminateBuilder(client, st.instanceId);
        await clearState(file);
      }
        guard('post-admission');
        return admit(await provisionBuilder({ file, creds, log, taskBudgetMs, signal: ac.signal, cfg: this.cfg, distDir: this.distDir, bootstrapDir: this.bootstrapDir, keepMinutes: this.keepMinutes, agentUrl: (ip) => this.agentUrl(ip) }));
      });
    })();
    this.ensureSettled = run;
    try {
      return await run;
    } finally {
      if (this.ensureAbort === ac) this.ensureAbort = null;
      this.ensureSettled = null;
    }
  }

  /** build/push tasks run under a RENEWED lease; idle clock starts when the task ends (RA04) */
  async runExclusive<T>(log: ProviderLog, taskBudgetMs: number, fn: (handle: BuilderHandle) => Promise<T>): Promise<T> {
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    if (this.leaseToken) throw new Error('builder is BUSY: a task already owns this provider');
    const token = randomUUID();
    this.leaseToken = token;
    let renewer: NodeJS.Timeout | undefined;
    try {
      const handle = await this.prepare(log, taskBudgetMs, token);
      renewer = setInterval(() => {
        void renewLease(file, token).catch((e: unknown) => log('lease renewal failed', { error: String(e) }));
      }, 60_000);
      return await fn(handle);
    } finally {
      clearInterval(renewer);
      await releaseLease(file, token).catch((e: unknown) => log('lease release failed', { error: String(e) }));
      if (this.leaseToken === token) this.leaseToken = null;
    }
  }

  async release(expectedLeaseRef?: string): Promise<void> {
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    // S06: a user cancel while ensure() is still provisioning must not wait on
    // the create lock — abort ensure cooperatively; its compensation path
    // terminates the instance it created and clears the state, THEN the normal
    // locked release below finds nothing (or finishes the sweep)
    const active = this.ensureAbort;
    if (active) {
      active.abort();
      const settled = this.ensureSettled;
      if (settled) {
        const okSettled = await Promise.race([
          settled.then(() => true, () => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), CANCEL_SETTLE_BUDGET_MS).unref()),
        ]);
        if (!okSettled) {
          throw new Error('cancel: builder provisioning did not settle after abort within the budget — the instance may still exist; run `ship builder down` and verify');
        }
      }
    }
    await withLock(file, async () => {
      const st = await readState(file);
      if (!st) return;
      if (expectedLeaseRef && st.instanceId !== expectedLeaseRef) throw new Error('Builder lease changed; refusing to release another task instance');
      if (leaseHeldByOther(st, this.leaseToken ?? undefined)) throw new Error(`builder is BUSY (lease pid ${st.lease?.pid}) — refusing to release a working machine`);
      const client = await mkCvmClient(creds.secretId, creds.secretKey, st.region);
      await terminateBuilder(client, st.instanceId);
      await clearState(file);
    });
  }

  async status(): Promise<BuilderProviderStatus> {
    const secretId = process.env.TENCENTCLOUD_SECRET_ID;
    const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
    const st = secretId && secretKey ? await readState(stateFileFor(this.cfg, secretId)) : null;
    if (!st) return { kind: this.kind, active: false };
    return authedBuilderStatus(this.kind, st, leaseHeldByOther(st));
  }
}
