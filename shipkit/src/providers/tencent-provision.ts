// Tencent CVM provisioning (extracted from TencentBuilderProvider for the
// 200-line ceiling): RunInstances → persist → strict timer verification →
// public IP → agent health wait, with cooperative-cancel checkpoints (S06).
// Any failure after the instance exists runs the compensation path (terminate
// + clearState), including cancellation.

import { randomUUID } from 'node:crypto';
import type { TencentCvmConfig } from '../shared/types.js';
import { DEFAULT_AGENT_PORT, startBundleServer, type BundleServer } from './bundle-server.js';
import type { BuilderHandle, ProviderLog } from './provider.js';
import { clearState, writeState } from './builder-state.js';
import { agentHealthy, mkCvmClient } from './tencent-client.js';
import { sleepOrAbort, waitForPublicIp } from './tencent-lifecycle.js';
import { ACTION_TIMER_TIMEOUT_MS, waitForVerifiedActionTimer } from './tencent-timer-ready.js';
import { terminateBuilder } from './tencent-termination.js';
import { renderCloudInit } from './tencent-userdata.js';

/** provisioning aborted by a user signal: stops at the next checkpoint and
 *  compensates (terminate + clear) exactly like any provisioning failure */
export class EnsureCancelled extends Error {
  constructor() {
    super('builder provisioning cancelled by user signal');
  }
}

/** Keep SDK error identity, subclass and metadata; its getMessage/toString read message. */
function redactLoginPassword(error: unknown, password?: string): unknown {
  if (!password) return error;
  const clean = (text: string) => text.split(password).join('[REDACTED]');
  if (error instanceof Error) {
    error.message = clean(error.message);
    if (error.stack) error.stack = clean(error.stack);
    return error;
  }
  return typeof error === 'string' ? clean(error) : error;
}

export async function provisionBuilder(
o: {
  file: string;
  creds: { secretId: string; secretKey: string };
  log: ProviderLog;
  taskBudgetMs: number;
  signal: AbortSignal;
  cfg: TencentCvmConfig;
  distDir: string;
  bootstrapDir: string;
  /** idle keep window from the provider config */
  keepMinutes: number;
  agentUrl: (ip: string) => string;
},
): Promise<BuilderHandle> {
  const { file, creds, log, taskBudgetMs, signal, cfg } = o;
  if (signal.aborted) throw new EnsureCancelled();
  const { keepMinutes } = o;
  const client = await mkCvmClient(creds.secretId, creds.secretKey, cfg.region);
  const agentToken = cfg.installToken ?? randomUUID();
  const createdAt = new Date().toISOString();
  // Cover timer visibility (3'), IP (15'), installation (20') and the FULL task budget.
  const provisioningMin = 35 + ACTION_TIMER_TIMEOUT_MS / 60_000;
  const budgetMin = Math.ceil(taskBudgetMs / 60_000);
  const maxLifetimeMin = cfg.maxLifetimeMinutes ?? Math.max(keepMinutes + 90, 120, budgetMin + provisioningMin);
  if (cfg.maxLifetimeMinutes && cfg.maxLifetimeMinutes < budgetMin + provisioningMin) {
    throw new Error(
      `maxLifetimeMinutes=${cfg.maxLifetimeMinutes} cannot cover the task budget ${budgetMin}min + provisioning ${provisioningMin}min — raise it or shorten --timeout-min`,
    );
  }
  const expireAt = new Date(Date.now() + maxLifetimeMin * 60_000).toISOString();
  const expireCloudIso = expireAt.replace(/\.\d{3}Z$/, 'Z');
  let bundle: BundleServer | null = null;
  let instanceId: string | null = null;
  try {
    let installUrl: string;
    if (cfg.installUrl) {
      installUrl = cfg.installUrl;
    } else {
      bundle = await startBundleServer({
        distDir: o.distDir,
        bootstrapDir: o.bootstrapDir,
        advertiseHost: cfg.advertiseHost ?? '127.0.0.1',
        port: cfg.bundlePort,
        // HTTPS terminates at a proxy; its external port is not the agent's listener.
        agentPort: cfg.agentScheme === 'https' ? DEFAULT_AGENT_PORT : cfg.agentPort ?? DEFAULT_AGENT_PORT,
        minutes: 50,
        agentToken,
        publicBaseUrl: cfg.bundleBaseUrl,
      });
      installUrl = bundle.installUrl('builder');
    }
    const userData = Buffer.from(renderCloudInit({ installUrl, preInstall: cfg.preInstallScript }), 'utf8').toString('base64');
    if (signal.aborted) throw new EnsureCancelled();
    log('creating CVM builder instance', { zone: cfg.zone, instanceType: cfg.instanceType, expireAt: expireCloudIso });
    const run = await client.RunInstances({
      Placement: { Zone: cfg.zone },
      InstanceChargeType: 'POSTPAID_BY_HOUR',
      InstanceType: cfg.instanceType,
      ImageId: cfg.imageId,
      ...(cfg.systemDisk ? { SystemDisk: { DiskType: cfg.systemDisk.diskType, DiskSize: cfg.systemDisk.diskSize } } : {}),
      SecurityGroupIds: cfg.securityGroupIds,
      VirtualPrivateCloud: { VpcId: cfg.vpcId, SubnetId: cfg.subnetId },
      InternetAccessible: {
        InternetChargeType: 'TRAFFIC_POSTPAID_BY_HOUR',
        InternetMaxBandwidthOut: cfg.internetMaxBandwidthOut ?? 5,
        PublicIpAssigned: true,
      },
      InstanceName: cfg.instanceName ?? 'ship-builder',
      ...(cfg.loginPassword ? { LoginSettings: { Password: cfg.loginPassword } } : {}),
      ActionTimer: { TimerAction: 'TerminateInstances', ActionTime: expireCloudIso },
      UserData: userData,
    });
    // capture FIRST: a cancel landing after the API answered must NOT
    // discard the id — the catch below terminates what was actually created
    instanceId = run.InstanceIdSet?.[0] ?? null;
    if (!instanceId) throw new Error('RunInstances returned no InstanceIdSet');
    // persist the moment the instance exists — it can never become an untracked charge (F11)
    await writeState(file, { instanceId, region: cfg.region, token: agentToken, status: 'provisioning', createdAt, expireAt });
    if (signal.aborted) throw new EnsureCancelled(); // compensate only AFTER the id is durable
    // STRICT timer verification: any failure/mismatch is a provisioning failure → compensation (RA07)
    const verdict = await waitForVerifiedActionTimer(client, instanceId, expireCloudIso, signal, log);
    log('cloud terminate timer verified', { instanceId, actionTime: verdict.actionTime });
    const ip = await waitForPublicIp(client, instanceId, log, signal);
    const url = o.agentUrl(ip);
    log('waiting for ship-agent on the new builder', { url, instanceId });
    const deadline = Date.now() + 20 * 60_000;
    for (;;) {
      if (signal.aborted) throw new EnsureCancelled();
      if (await agentHealthy(url)) break;
      // re-check right after the (up to 5s) probe so a cancel is noticed
      // inside the release settle budget, not after the 5s sleep
      if (signal.aborted) throw new EnsureCancelled();
      if (Date.now() > deadline) throw new Error(`builder agent not healthy at ${url} within 20 minutes (bootstrap log: /var/log/ship-bootstrap.log)`);
      await sleepOrAbort(5000, signal);
    }
    await writeState(file, { instanceId, region: cfg.region, url, token: agentToken, status: 'ready', createdAt, expireAt });
    return { url, token: agentToken };
  } catch (e) {
    const safeError = redactLoginPassword(e, cfg.loginPassword);
    if (instanceId) {
      log('provisioning failed — terminating created instance (compensation)', { instanceId });
      try {
        await terminateBuilder(client, instanceId);
        await clearState(file);
      } catch (term) {
        const safeTerm = redactLoginPassword(term, cfg.loginPassword);
        throw new Error(
          `${safeError instanceof Error ? safeError.message : String(safeError)}; COMPENSATION FAILED: instance ${instanceId} is still running (${String(safeTerm)}) — run \`ship builder down\` to release it`,
        );
      }
    }
    throw safeError;
  } finally {
    if (bundle) await bundle.stop();
  }
}
