// Tencent CVM client helpers + expired-builder sweeper (shared by the provider and the CLI).

import { api } from '../shared/http.js';
import type { ProviderLog } from './provider.js';
import { clearState, listStates } from './builder-state.js';
import type { ActionTimerView } from './tencent-lifecycle.js';

export interface CvmClientLike {
  RunInstances(req: Record<string, unknown>): Promise<{ InstanceIdSet?: string[] }>;
  DescribeInstances(req: Record<string, unknown>): Promise<{
    InstanceSet?: Array<{ InstanceStatus?: string; PublicIpAddresses?: string[] }>;
  }>;
  TerminateInstances(req: Record<string, unknown>): Promise<unknown>;
  /** the SDK's real timer-query method (RA07) — required, never optional */
  DescribeInstancesActionTimer(req: { InstanceIds: string[] }): Promise<ActionTimerView>;
}

export function requireCreds(): { secretId: string; secretKey: string } {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY env vars are required for dynamic tencent builders');
  }
  return { secretId, secretKey };
}

/** CJS package under ESM interop: real shape is { default: { cvm: { v20170312: { Client } } } } */
export async function mkCvmClient(secretId: string, secretKey: string, region: string): Promise<CvmClientLike> {
  const imported = (await import('tencentcloud-sdk-nodejs-cvm')) as unknown as {
    default?: { cvm?: Record<string, { Client?: unknown }> };
    cvm?: Record<string, { Client?: unknown }>;
  };
  const lib = imported.default ?? imported;
  const Client = (lib.cvm?.v20170312 ?? {}) as {
    Client?: new (cfg: { credential: { secretId: string; secretKey: string }; region: string }) => CvmClientLike;
  };
  if (!Client.Client) throw new Error('tencentcloud-sdk-nodejs-cvm did not export cvm.v20170312.Client as expected');
  return new Client.Client({ credential: { secretId, secretKey }, region });
}

export async function agentHealthy(url: string): Promise<boolean> {
  try {
    const h = await api<{ ok?: boolean }>(url, undefined, 'GET', '/health', undefined, 5000);
    return Boolean(h?.ok);
  } catch {
    return false;
  }
}

/** terminate; "instance not exist" errors are treated as already released */
export async function terminateQuietly(client: CvmClientLike, instanceId: string): Promise<void> {
  try {
    await client.TerminateInstances({ InstanceIds: [instanceId] });
  } catch (e) {
    if (!/not\s*exist|invalid\s*instance/i.test(String((e as Error).message))) throw e;
  }
}

/** release every builder whose expireAt has passed — called on each CLI invocation (F20 backstop). */
export async function sweepExpiredBuilders(log: ProviderLog): Promise<void> {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) return;
  for (const { file, state } of await listStates()) {
    if (new Date(state.expireAt).getTime() > Date.now()) continue;
    try {
      const client = await mkCvmClient(secretId, secretKey, state.region);
      await terminateQuietly(client, state.instanceId);
      await clearState(file);
      log('swept expired builder instance', { instanceId: state.instanceId, file: file.split('/').pop() });
    } catch (e) {
      log('failed to sweep expired builder — run `ship builder down`', { instanceId: state.instanceId, error: String(e) });
    }
  }
}

/** authenticated builder status used by the provider's status() (RA27/F27) */
export async function authedBuilderStatus(
  kind: string,
  st: { instanceId: string; status: string; createdAt: string; expireAt: string; url?: string; token: string; lease?: unknown },
  leased: boolean,
): Promise<import('./provider.js').BuilderProviderStatus> {
  const brief = { instanceId: st.instanceId, status: st.status, createdAt: st.createdAt, expireAt: st.expireAt, leased };
  if (st.status !== 'ready' || !st.url) return { kind, active: false, detail: brief };
  try {
    const s = await api<{ role?: string; docker?: boolean }>(st.url, st.token, 'GET', '/api/status', undefined, 8000);
    const active = Boolean(s?.docker && (s?.role === 'builder' || s?.role === 'both'));
    return { kind, active, url: st.url, detail: { ...brief, role: s?.role, docker: s?.docker } };
  } catch (e) {
    return { kind, active: false, url: st.url, detail: { ...brief, authedCheckError: (e as Error).message } };
  }
}
