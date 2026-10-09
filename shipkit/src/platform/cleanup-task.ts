import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { api } from '../shared/http.js';
import { isTerminalJob, type Job } from '../shared/job-protocol.js';
import { readState, stateFileFor } from '../providers/builder-state.js';
import { EventSink } from './event-sink.js';
import { JobObserver } from './job-observer.js';
import { discoverJobs } from './reconcile-jobs.js';
import { loadProject, privateValues, publicUrl } from './project-context.js';
import type { ExecutionHooks, ExecutionPlan, ProjectInput, RemoteJobRef } from './contracts.js';
import { assertSnapshotTrust } from './private-fingerprint.js';
import { isRuntimeOnly } from './execution-kind.js';

/** Archive all task-owned builder evidence before any cleanup may destroy it. */
export async function archiveForCleanup(
  input: ProjectInput, refs: RemoteJobRef[], hooks: ExecutionHooks,
  plan?: ExecutionPlan, expectedLeaseRef?: string,
): Promise<{ archivedJobs: number; leaseRef?: string }> {
  if (!hooks.executionId || !/^[A-Za-z0-9._-]{1,80}$/.test(hooks.executionId)) throw new Error('Cleanup requires a durable task execution ID');
  const c = await loadProject(input, plan?.sourceMode);
  if (c.snapshot) await assertSnapshotTrust(c);
  if (isRuntimeOnly(c.executionKind ?? plan?.kind)) return { archivedJobs: 0 };
  if (!c.snapshot && plan?.detail.configDigest && createHash('sha256').update(await readFile(c.configPath)).digest('hex') !== plan.detail.configDigest) {
    throw new Error('Configuration reference changed; refusing cleanup of another builder lease');
  }
  if (c.config.builder.mode === 'static') return { archivedJobs: 0 };
  const cfg = c.config.builder.dynamic?.tencent;
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  if (!cfg || !secretId || !plan?.detail.configDigest) throw new Error('Cleanup requires the original configuration and builder credential reference');
  const state = await readState(stateFileFor(cfg, secretId));
  const builderRefs = refs.filter((ref) => ref.agentRole === 'builder');
  if (!state) {
    if (builderRefs.some((ref) => !ref.status || !isTerminalJob(ref.status as Job['status']))) {
      throw new Error('Builder is unavailable and task evidence is incomplete; refusing cleanup');
    }
    // No current endpoint can supply further evidence. Persisted terminal refs
    // were emitted after complete archive flush, but cloud resource absence is
    // not proven here; retryCleanup must refuse an unverified expected lease.
    return { archivedJobs: 0, leaseRef: expectedLeaseRef };
  }
  if (!expectedLeaseRef || state.instanceId !== expectedLeaseRef) throw new Error('Builder lease ownership changed; refusing cleanup of another task resource');
  if (!state.url) {
    if (builderRefs.length) throw new Error('Builder endpoint is missing while task evidence remains; refusing cleanup');
    return { archivedJobs: 0, leaseRef: state.instanceId };
  }
  if (builderRefs.some((ref) => publicUrl(ref.urlRef) !== publicUrl(state.url!))) {
    throw new Error('Builder endpoint no longer matches the task; refusing cleanup');
  }
  const discovered = await discoverJobs(c, builderRefs, hooks.executionId, ['builder']);
  const handle = discovered.handles.builder;
  if (!handle) throw new Error('Builder is unavailable; refusing destruction before task evidence is archived');
  const sink = new EventSink(hooks, privateValues(c));
  const observer = new JobObserver(sink, hooks, discovered.refs);
  let archivedJobs = 0;
  for (const ref of discovered.refs) {
    if (publicUrl(handle.url) !== publicUrl(ref.urlRef)) throw new Error('Builder endpoint no longer matches the task; refusing cleanup');
    const job = await api<Job>(handle.url, handle.token, 'GET', `/api/jobs/${ref.jobId}`, undefined, 20_000, handle);
    if (!job.operationId?.startsWith(`${hooks.executionId}:`)) throw new Error('Builder job does not belong to this task; refusing cleanup');
    if (!isTerminalJob(job.status)) throw new Error('Builder task is still active; refusing cleanup until remote work is terminal');
    await observer.observe({ handle, jobId: ref.jobId,
      label: `${ref.stageKey}${ref.serviceKey ? `:${ref.serviceKey}` : ''}`, job, final: true });
    archivedJobs++;
  }
  await sink.flush();
  return { archivedJobs, leaseRef: state.instanceId };
}
