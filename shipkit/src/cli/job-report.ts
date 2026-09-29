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
    job = await waitForJob(handle.url, handle.token, jobId, { timeoutMs, onStatus: (j) => log.info(`${label} ${j.status}`, { jobId }) });
  } catch (e) {
    log.error(`${label} wait failed`, { error: (e as Error).message });
    const tail = await fetchLogTail(handle.url, handle.token, jobId, 40);
    if (tail) log.error(`${label} log tail:\n${tail.trim()}`);
    throw new CliError(`${label} failed: ${(e as Error).message}`, 4);
  }
  if (job.status === 'failed') {
    const tail = await fetchLogTail(handle.url, handle.token, jobId, 40);
    if (tail) log.error(`${label} log tail:\n${tail.trim()}`);
    const recovery = (job.result as { recovery?: Recovery } | undefined)?.recovery;
    let extra = '';
    if (label === 'deploy' && recovery?.attempted) {
      extra = recovery.succeeded
        ? `; recovered to previous version ${recovery.target}`
        : `; recovery to ${recovery.target ?? '(no previous version)'} FAILED — app may be down, inspect the agent job log`;
    }
    throw new CliError(`${label} job failed: ${job.error ?? 'unknown error'}${extra}`, recoveryExitCode(label, recovery));
  }
  return job;
}
