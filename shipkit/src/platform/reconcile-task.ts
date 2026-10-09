import { api } from '../shared/http.js';
import { isTerminalJob, type Job } from '../shared/job-protocol.js';
import type { GroupDeployResult } from '../shared/group-protocol.js';
import { loadProject, privateValues } from './project-context.js';
import { EventSink } from './event-sink.js';
import { JobObserver } from './job-observer.js';
import type { ExecutionHooks, ExecutionOutcome, ProjectInput, RemoteJobRef } from './contracts.js';
import { discoverJobs } from './reconcile-jobs.js';
import { assertSnapshotTrust } from './private-fingerprint.js';
import { isRuntimeOnly } from './execution-kind.js';

/** Observe durable mappings after a controller restart; never replay a release. */
export async function reconcileTask(input: ProjectInput, refs: RemoteJobRef[], hooks: ExecutionHooks): Promise<ExecutionOutcome> {
  if (!input.snapshot && !input.privateSnapshot && hooks.privateExecutionSnapshot) input = { ...input, snapshot: await hooks.privateExecutionSnapshot() };
  const c = await loadProject(input);
  if (c.snapshot) await assertSnapshotTrust(c);
  const runtimeOnly = isRuntimeOnly(c.executionKind);
  if (runtimeOnly && refs.some(ref => ref.agentRole !== 'runtime')) throw new Error('Runtime-only task unexpectedly references a Builder job');
  const archived = new Set(refs.filter((ref) => ref.agentRole === 'builder' && ['build', 'push'].includes(ref.stageKey)
    && ref.status && isTerminalJob(ref.status as Job['status'])).map((ref) => ref.jobId));
  const discovery = await discoverJobs(c, refs, hooks.executionId, runtimeOnly ? ['runtime'] : ['runtime', 'builder']);
  refs = discovery.refs;
  const sink = new EventSink(hooks, privateValues(c));
  const observer = new JobObserver(sink, hooks, refs);
  let runtime: Job | undefined;
  for (const ref of refs) {
    // Terminal builder mappings are durable only after archive flush, and the
    // machine may already be destroyed. Do not require it again after restart.
    if (ref.agentRole === 'builder' && archived.has(ref.jobId)) continue;
    const handle = discovery.handles[ref.agentRole];
    if (!handle || handle.url.replace(/\/$/, '') !== ref.urlRef.replace(/\/$/, '')) {
      return { status: 'interrupted', error: 'Remote builder reference is unavailable; inspect resource cleanup before another release',
        cleanupState: 'pending', recoveryState: 'unknown', output: { safeToReleaseGate: false } };
    }
    const job = await api<Job>(handle.url, handle.token, 'GET', `/api/jobs/${ref.jobId}`, undefined, 20_000, handle);
    await observer.observe({ handle, jobId: ref.jobId, label: `${ref.stageKey === 'deploy' ? 'deploy' : ref.stageKey}${ref.serviceKey ? `:${ref.serviceKey}` : ''}`, job, final: isTerminalJob(job.status) });
    if (!isTerminalJob(job.status)) return { status: 'interrupted', error: 'Remote job is still active; reconciliation will continue',
      cleanupState: 'unknown', recoveryState: 'unknown', output: { safeToReleaseGate: false } };
    if (ref.agentRole === 'runtime') runtime = job;
  }
  await sink.flush();
  if (!runtime) return { status: 'interrupted', error: 'Controller stopped before a runtime deployment; generate a fresh plan',
    cleanupState: runtimeOnly ? 'not-needed' : c.config.builder.mode === 'static' ? 'static' : 'pending', recoveryState: 'none', output: { safeToReleaseGate: true } };
  const result = runtime.result as GroupDeployResult | undefined;
  return { status: runtime.status === 'succeeded' ? 'succeeded' : runtime.status === 'cancelled' ? 'cancelled' : 'failed',
    output: result, error: runtime.error, cleanupState: runtimeOnly ? 'not-needed' : c.config.builder.mode === 'static' ? 'static' : 'unknown',
    recoveryState: result?.recovery ? result.recovery.succeeded ? 'succeeded' : 'failed' : 'none',
    remoteReleaseId: result?.releaseId, previousReleaseId: result?.previousReleaseId };
}
