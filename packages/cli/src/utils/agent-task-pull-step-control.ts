import type {
  AgentTaskPullHttpClient,
  AgentTaskPullIdentity,
} from "./agent-task-pull-types";

export const DEFAULT_STEP_ACK_RENEWAL_MS = 30_000;

type Timer = ReturnType<typeof setInterval>;

export type AgentTaskPullStepAbortControl = {
  signal: AbortSignal;
  abort: (reason?: string) => void;
  cleanup: () => void;
};

export type AgentTaskPullStepAckRenewalOptions = {
  client: AgentTaskPullHttpClient;
  identity: AgentTaskPullIdentity;
  jobId: string;
  stepKey: string;
  message: string;
  percent: number;
  signal: AbortSignal;
  intervalMs?: number;
  abort: (reason: string) => void;
};

export function createLinkedAbortController(
  parent?: AbortSignal,
): AgentTaskPullStepAbortControl {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (parent?.aborted) {
    controller.abort();
  } else {
    parent?.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    abort: (reason?: string) => controller.abort(reason),
    cleanup: () => parent?.removeEventListener("abort", abort),
  };
}

export function startAgentTaskPullStepAckRenewal(
  options: AgentTaskPullStepAckRenewalOptions,
) {
  const intervalMs = normalizeRenewalIntervalMs(options.intervalMs);
  let stopped = false;
  let inFlight = false;

  const renew = () => {
    if (stopped || inFlight || options.signal.aborted) return;
    inFlight = true;
    void options.client
      .ack(options.identity, options.jobId, {
        stepKey: options.stepKey,
        message: options.message,
        percent: options.percent,
      })
      .then((ack) => {
        if (ack.cancellation?.shouldStop) {
          options.abort(ack.cancellation.reason || "server_cancellation");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };

  const timer = setInterval(renew, intervalMs);
  timer.unref?.();
  const stop = () => {
    stopped = true;
    stopRenewal(timer, options.signal, stop);
  };
  options.signal.addEventListener("abort", stop, { once: true });
  return stop;
}

function stopRenewal(timer: Timer, signal: AbortSignal, stop: () => void) {
  signal.removeEventListener("abort", stop);
  clearInterval(timer);
}

function normalizeRenewalIntervalMs(intervalMs?: number) {
  return intervalMs && intervalMs > 0
    ? intervalMs
    : DEFAULT_STEP_ACK_RENEWAL_MS;
}
