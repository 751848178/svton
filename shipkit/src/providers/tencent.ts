// Tencent Cloud CVM adapter. Lifecycle contract (F11/F13/F18/F20 + RA03/RA04/RA07):
// - instanceId is persisted the moment it exists; provisioning failures terminate as compensation
// - the cloud terminate timer is VERIFIED (DescribeInstancesActionTimer) before a machine is ready
// - reuse admission requires room for the FULL task budget; mid-task destruction is impossible
//   because tasks hold a lease and idle is anchored at task completion

import { randomUUID } from 'node:crypto';
import type { TencentCvmConfig } from '../shared/types.js';
import { startBundleServer, type BundleServer } from './bundle-server.js';
import type { BuilderHandle, BuilderProvider, BuilderProviderStatus, ProviderLog } from './provider.js';
import {
  acquireLease,
  clearState,
  leaseHeldByOther,
  readState,
  renewLease,
  releaseLease,
  stateFileFor,
  withLock,
  writeState,
} from './builder-state.js';
import { agentHealthy, authedBuilderStatus, mkCvmClient, requireCreds, terminateQuietly } from './tencent-client.js';
import { admissionDecision, verifyActionTimer, waitForPublicIp } from './tencent-lifecycle.js';
import { renderCloudInit } from './tencent-userdata.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_TASK_BUDGET_MS = 90 * 60_000;

export class TencentBuilderProvider implements BuilderProvider {
  readonly kind = 'tencent';

  constructor(
    private readonly cfg: TencentCvmConfig,
    private readonly keepMinutes: number,
    private readonly distDir: string,
    private readonly bootstrapDir: string,
  ) {}

  /** named entry when configured (TLS identity comes from the entry, not the raw IP) */
  private agentUrl(ip: string): string {
    const host = this.cfg.agentHost ?? ip;
    return `${this.cfg.agentScheme ?? 'http'}://${host}:${this.cfg.agentPort ?? 7410}`;
  }

  async ensure(log: ProviderLog, taskBudgetMs = DEFAULT_TASK_BUDGET_MS): Promise<BuilderHandle> {
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    return withLock(file, async () => {
      const st = await readState(file);
      if (st) {
        if (leaseHeldByOther(st)) {
          throw new Error(
            `builder is BUSY: task lease held by pid ${st.lease?.pid} until ${st.lease?.expiresAt} — refusing to touch instance ${st.instanceId}`,
          );
        }
        const decision = admissionDecision({ state: st, keepMinutes: this.keepMinutes, taskBudgetMs });
        if (decision.action === 'reuse' && (await agentHealthy(st.url!))) {
          log('reusing active builder instance', { instanceId: st.instanceId, url: st.url, taskBudgetMin: Math.round(taskBudgetMs / 60_000) });
          return { url: st.url!, token: st.token };
        }
        if (decision.action === 'reuse') log('builder unreachable — replacing', { instanceId: st.instanceId });
        else log(`replacing builder: ${decision.reason}`, { instanceId: st.instanceId });
        const client = await mkCvmClient(creds.secretId, creds.secretKey, st.region);
        await terminateQuietly(client, st.instanceId);
        await clearState(file);
      }
      return this.create(file, creds, log, taskBudgetMs);
    });
  }

  /** build/push tasks run under a RENEWED lease; idle clock starts when the task ends (RA04) */
  async runExclusive<T>(log: ProviderLog, taskBudgetMs: number, fn: (handle: BuilderHandle) => Promise<T>): Promise<T> {
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    const handle = await this.ensure(log, taskBudgetMs);
    await acquireLease(file);
    const renewer = setInterval(() => {
      void renewLease(file).catch(() => {});
    }, 60_000);
    try {
      return await fn(handle);
    } finally {
      clearInterval(renewer);
      await releaseLease(file).catch((e: unknown) => log('lease release failed', { error: String(e) }));
    }
  }

  private async create(file: string, creds: { secretId: string; secretKey: string }, log: ProviderLog, taskBudgetMs: number): Promise<BuilderHandle> {
    const client = await mkCvmClient(creds.secretId, creds.secretKey, this.cfg.region);
    const agentToken = this.cfg.installToken ?? randomUUID();
    const createdAt = new Date().toISOString();
    // lifetime must cover provisioning (IP 15' + install 20') plus the FULL task budget (RA03)
    const provisioningMin = 35;
    const budgetMin = Math.ceil(taskBudgetMs / 60_000);
    const maxLifetimeMin = this.cfg.maxLifetimeMinutes ?? Math.max(this.keepMinutes + 90, 120, budgetMin + provisioningMin);
    if (this.cfg.maxLifetimeMinutes && this.cfg.maxLifetimeMinutes < budgetMin + provisioningMin) {
      throw new Error(
        `maxLifetimeMinutes=${this.cfg.maxLifetimeMinutes} cannot cover the task budget ${budgetMin}min + provisioning ${provisioningMin}min — raise it or shorten --timeout-min`,
      );
    }
    const expireAt = new Date(Date.now() + maxLifetimeMin * 60_000).toISOString();
    const expireCloudIso = expireAt.replace(/\.\d{3}Z$/, 'Z');
    let bundle: BundleServer | null = null;
    let instanceId: string | null = null;
    try {
      let installUrl: string;
      if (this.cfg.installUrl) {
        installUrl = this.cfg.installUrl;
      } else {
        bundle = await startBundleServer({
          distDir: this.distDir,
          bootstrapDir: this.bootstrapDir,
          advertiseHost: this.cfg.advertiseHost ?? '127.0.0.1',
          port: this.cfg.bundlePort,
          minutes: 50,
          agentToken,
          publicBaseUrl: this.cfg.bundleBaseUrl,
        });
        installUrl = bundle.installUrl('builder');
      }
      const userData = Buffer.from(renderCloudInit({ installUrl, preInstall: this.cfg.preInstallScript }), 'utf8').toString('base64');
      log('creating CVM builder instance', { zone: this.cfg.zone, instanceType: this.cfg.instanceType, expireAt: expireCloudIso });
      const run = await client.RunInstances({
        Placement: { Zone: this.cfg.zone },
        InstanceChargeType: 'POSTPAID_BY_HOUR',
        InstanceType: this.cfg.instanceType,
        ImageId: this.cfg.imageId,
        SecurityGroupIds: this.cfg.securityGroupIds,
        VirtualPrivateCloud: { VpcId: this.cfg.vpcId, SubnetId: this.cfg.subnetId },
        InternetAccessible: {
          InternetChargeType: 'TRAFFIC_POSTPAID_BY_HOUR',
          InternetMaxBandwidthOut: this.cfg.internetMaxBandwidthOut ?? 5,
          PublicIpAssigned: true,
        },
        InstanceName: this.cfg.instanceName ?? 'ship-builder',
        ...(this.cfg.loginPassword ? { LoginSettings: { Password: this.cfg.loginPassword } } : {}),
        ActionTimer: { TimerAction: 'TerminateInstances', ActionTime: expireCloudIso },
        UserData: userData,
      });
      instanceId = run.InstanceIdSet?.[0] ?? null;
      if (!instanceId) throw new Error('RunInstances returned no InstanceIdSet');
      // persist the moment the instance exists — it can never become an untracked charge (F11)
      await writeState(file, { instanceId, region: this.cfg.region, token: agentToken, status: 'provisioning', createdAt, expireAt });
      // STRICT timer verification: any failure/mismatch is a provisioning failure → compensation (RA07)
      const view = await client.DescribeInstancesActionTimer({ InstanceIds: [instanceId] });
      const verdict = verifyActionTimer(view, instanceId, expireCloudIso);
      if (!verdict.ok) throw new Error(`cloud terminate timer verification FAILED: ${verdict.reason}`);
      log('cloud terminate timer verified', { instanceId, actionTime: verdict.actionTime });
      const ip = await waitForPublicIp(client, instanceId, log);
      const url = this.agentUrl(ip);
      log('waiting for ship-agent on the new builder', { url, instanceId });
      const deadline = Date.now() + 20 * 60_000;
      for (;;) {
        if (await agentHealthy(url)) break;
        if (Date.now() > deadline) throw new Error(`builder agent not healthy at ${url} within 20 minutes (bootstrap log: /var/log/ship-bootstrap.log)`);
        await sleep(5000);
      }
      await writeState(file, { instanceId, region: this.cfg.region, url, token: agentToken, status: 'ready', createdAt, expireAt });
      return { url, token: agentToken };
    } catch (e) {
      if (instanceId) {
        log('provisioning failed — terminating created instance (compensation)', { instanceId });
        try {
          await terminateQuietly(client, instanceId);
          await clearState(file);
        } catch (term) {
          throw new Error(
            `${(e as Error).message}; COMPENSATION FAILED: instance ${instanceId} is still running (${String(term)}) — run \`ship builder down\` to release it`,
          );
        }
      }
      throw e;
    } finally {
      if (bundle) await bundle.stop();
    }
  }

  async release(): Promise<void> {
    const creds = requireCreds();
    const file = stateFileFor(this.cfg, creds.secretId);
    await withLock(file, async () => {
      const st = await readState(file);
      if (!st) return;
      if (leaseHeldByOther(st)) throw new Error(`builder is BUSY (lease pid ${st.lease?.pid}) — refusing to release a working machine`);
      const client = await mkCvmClient(creds.secretId, creds.secretKey, st.region);
      await terminateQuietly(client, st.instanceId);
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
