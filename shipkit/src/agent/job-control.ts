// Cancellation checkpoints only throw between operations; commit/recovery cannot be interrupted.
import type { Job, JobEvent, JobPhase } from '../shared/job-protocol.js';
export class JobCancelled extends Error {
  constructor(message = 'job cancelled at a safe checkpoint', readonly recovery?: unknown) {
    super(message);
    this.name = 'JobCancelled';
  }
}
export interface JobControl {
  checkpoint(): void;
  phase(phase: JobPhase, service?: string): void;
  enterCommit(): void;
  enterRecovery(): void;
  verified?(service: string, status: 'succeeded' | 'skipped' | 'failed'): void;
}
export function jobControl(job: Job, emit: (event: Omit<JobEvent, 'seq' | 'ts'>) => void): JobControl {
  const checkpoint = () => { if (job.cancellation) throw new JobCancelled(); };
  const phase = (next: JobPhase, service?: string) => {
    job.phase = next;
    job.service = service;
    job.updatedAt = new Date().toISOString();
    emit({ phase: next, event: 'phase', ...(service ? { service } : {}) });
  };
  return {
    checkpoint, phase,
    verified(service, status) { emit({ phase: 'verify', event: 'probe', service, detail: status }); },
    enterCommit() { checkpoint(); job.cancellable = false; phase('commit'); },
    enterRecovery() { job.cancellable = false; phase('recover'); },
  };
}
