// Durable job observation and cooperative cancellation wire contracts.
export const JOB_EVENTS_CAPABILITY = 'jobs-events-v1';
export const JOB_LOG_CURSOR_CAPABILITY = 'jobs-log-cursor-v1';
export const JOB_CANCELLATION_CAPABILITY = 'jobs-cooperative-cancel-v1';
export const GROUP_HISTORY_CAPABILITY = 'group-history-v1';
export const JOB_OPERATION_CAPABILITY = 'jobs-operation-v1';
export type JobType = 'build' | 'push' | 'deploy' | 'rollback' | 'gc' | 'verify' | 'group-deploy' | 'group-rollback';
export type JobStatus = 'queued' | 'running' | 'cancel-requested' | 'cancelled' | 'succeeded' | 'failed';
export type JobPhase = 'queued' | 'source' | 'build' | 'push' | 'prepare' | 'pull' | 'activate' | 'verify' | 'recover' | 'commit' | 'complete';
export interface JobCancellation {
  requestedAt: string;
  reason?: string;
  outcome: 'requested' | 'cancelled' | 'recovery-failed';
}
export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: unknown;
  phase?: JobPhase;
  service?: string;
  cancellable?: boolean;
  cancellation?: JobCancellation;
  operationId?: string;
  requestHash?: string;
}
export interface JobEvent {
  seq: number;
  ts: string;
  phase: JobPhase;
  event: string;
  service?: string;
  detail?: string;
}
export interface JobEventsPage { events: JobEvent[]; nextSeq: number; complete: boolean }
export interface JobLogPage { text: string; nextOffset: number; totalBytes: number; complete: boolean }
export function isTerminalJob(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
