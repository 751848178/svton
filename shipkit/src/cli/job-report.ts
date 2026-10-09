// Shared failure reporting for agent jobs (F04/F28): recovery-aware exit codes + bounded log tails.

import { fetchLogTail, waitForJob } from '../shared/http.js';
import type { Job } from '../shared/types.js';
import type { Logger } from '../shared/log.js';
import type { BuilderHandle } from '../providers/provider.js';
import { CliError } from './errors.js';

export interface Recovery {
  attempted: boolean;
  succeeded: boolean;
  target: string | null;
}

export function recoveryExitCode(label: string, recovery: Recovery | undefined): number {
  if (label === 'deploy' && recovery?.attempted) return recovery.succeeded ? 5 : 6;
  return 4;
}

export async function waitAndReport(handle: BuilderHandle, jobId: string, label: string, log: Logger, timeoutMs: number): Promise<Job> {
  let job: Job;
  try {
    await log.observeJob?.({ handle, jobId, label });
    job = await waitForJob(handle.url, handle.token, jobId, { timeoutMs,
      onPoll: async (j) => { await log.observeJob?.({ handle, jobId, label, job: j }); },
      onStatus: (j) => log.info(`${label} ${j.status}`, { jobId }), ...(handle.caFile ? { caFile: handle.caFile } : {}) });
    await log.observeJob?.({ handle, jobId, label, job, final: true });
  } catch (e) {
    log.error(`${label} wait failed`, { error: (e as Error).message });
    const tail = await fetchLogTail(handle.url, handle.token, jobId, 40, handle.caFile ? { caFile: handle.caFile } : {});
    if (tail) log.error(`${label} log tail:\n${tail.trim()}`);
    const error = e as Error & { archiveIncomplete?: boolean };
    throw Object.assign(new CliError(`${label} failed: ${error.message}`, 4),
      { ...(error.archiveIncomplete ? { archiveIncomplete: true } : {}), cause: e });
  }
  if (job.status === 'cancelled') {
    const error = new Error(`${label} job cancelled`);
    Object.assign(error, { cancelled: true, job });
    throw error;
  }
  if (job.status === 'failed') {
    const tail = await fetchLogTail(handle.url, handle.token, jobId, 40, handle.caFile ? { caFile: handle.caFile } : {});
    if (tail) log.error(`${label} log tail:\n${tail.trim()}`);
    const recovery = (job.result as { recovery?: Recovery } | undefined)?.recovery;
    let extra = '';
    if (label === 'deploy' && recovery?.attempted) {
      extra = recovery.succeeded
        ? `; recovered to previous version ${recovery.target}`
        : `; recovery to ${recovery.target ?? '(no previous version)'} FAILED — app may be down, inspect the agent job log`;
    }
    throw Object.assign(new CliError(`${label} job failed: ${job.error ?? 'unknown error'}${extra}`, recoveryExitCode(label, recovery)), { job });
  }
  return job;
}
