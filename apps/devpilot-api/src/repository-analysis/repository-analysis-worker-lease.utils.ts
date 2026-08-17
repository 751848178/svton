import { REPOSITORY_ANALYSIS_WORKER_LEASE_MS } from "./repository-analysis.constants";

const REPOSITORY_WORKER_LEASE_LOST = Symbol("repository worker lease lost");
const REPOSITORY_WORKER_STORAGE_RETRY_MS = 5_000;

export function runRepositoryWorkerDetached(
  runId: string,
  execute: (runId: string) => Promise<void>,
  enqueue: (runId: string) => void,
): void {
  setImmediate(() => void execute(runId).catch(() => {
    scheduleRepositoryWorkerLeaseRetry(
      runId,
      new Date(Date.now() + REPOSITORY_WORKER_STORAGE_RETRY_MS),
      enqueue,
    );
  }));
}

export function scheduleRepositoryWorkerLeaseRetry(
  runId: string,
  retryAt: Date,
  enqueue: (runId: string) => void,
): void {
  const delay = Math.max(0, retryAt.getTime() - Date.now()) + 25;
  const timer = setTimeout(() => enqueue(runId), delay);
  timer.unref?.();
}

export function startRepositoryWorkerLeaseHeartbeat(
  runId: string,
  token: string,
  extend: (runId: string, token: string) => Promise<{ count: number }>,
  controller: AbortController,
): () => void {
  let extending = false;
  let stopped = false;
  let timer: NodeJS.Timeout;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
  const pulse = async () => {
    if (stopped || extending) return;
    extending = true;
    try {
      const result = await extend(runId, token);
      if (!stopped && result.count !== 1) {
        stop();
        controller.abort(REPOSITORY_WORKER_LEASE_LOST);
      }
    } catch {
      if (!stopped) {
        stop();
        controller.abort(REPOSITORY_WORKER_LEASE_LOST);
      }
    } finally {
      extending = false;
    }
  };
  timer = setInterval(() => void pulse(), REPOSITORY_ANALYSIS_WORKER_LEASE_MS / 3);
  timer.unref?.();
  return stop;
}

export function isRepositoryWorkerLeaseLost(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason === REPOSITORY_WORKER_LEASE_LOST;
}

export function isRepositoryWorkerLeaseFailure(
  error: unknown,
  signal: AbortSignal,
): boolean {
  return isRepositoryWorkerLeaseLost(signal) || isRepositoryWorkerOwnershipError(error);
}

export function isRepositoryWorkerOwnershipError(error: unknown): boolean {
  return error instanceof Error && [
    "repository analysis worker lease lost",
    "repository analysis run is already terminal",
  ].includes(error.message);
}
