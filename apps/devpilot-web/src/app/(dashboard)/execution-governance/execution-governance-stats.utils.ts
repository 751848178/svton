import type { ServerExecutionJob, ServerExecutionLease } from './types';
import type { JobStats, LeaseStats } from './execution-governance-stats.types';
import { isStaleRunning } from './utils';

export function buildJobStats(jobs: ServerExecutionJob[]): JobStats {
  return {
    total: jobs.length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    running: jobs.filter((j) => j.status === 'running').length,
    stale: jobs.filter((j) => isStaleRunning(j)).length,
    blocked: jobs.filter((j) => j.status === 'blocked').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    cancelled: jobs.filter((j) => j.status === 'cancelled').length,
  };
}

export function buildLeaseStats(leases: ServerExecutionLease[]): LeaseStats {
  return {
    total: leases.length,
    running: leases.filter((l) => l.status === 'running').length,
    blocked: leases.filter((l) => l.status === 'blocked').length,
    expired: leases.filter((l) => l.status === 'expired').length,
    failed: leases.filter((l) => l.status === 'failed').length,
  };
}
