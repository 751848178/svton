import { REPOSITORY_ANALYSIS_WORKER_LEASE_MS } from "./repository-analysis.constants";
import {
  isRepositoryWorkerLeaseLost,
  startRepositoryWorkerLeaseHeartbeat,
} from "./repository-analysis-worker-lease.utils";

describe("repository analysis worker lease heartbeat", () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    ["loses ownership", jest.fn().mockResolvedValue({ count: 0 })],
    ["cannot reach storage", jest.fn().mockRejectedValue(new Error("database unavailable"))],
  ])("aborts and stops when it %s", async (_name, extend) => {
    jest.useFakeTimers();
    const controller = new AbortController();
    startRepositoryWorkerLeaseHeartbeat("run-1", "lease-1", extend, controller);

    await jest.advanceTimersByTimeAsync(REPOSITORY_ANALYSIS_WORKER_LEASE_MS / 3);

    expect(isRepositoryWorkerLeaseLost(controller.signal)).toBe(true);
    expect(extend).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(REPOSITORY_ANALYSIS_WORKER_LEASE_MS);
    expect(extend).toHaveBeenCalledTimes(1);
  });

  it("does not extend after an explicit stop", async () => {
    jest.useFakeTimers();
    const extend = jest.fn().mockResolvedValue({ count: 1 });
    const controller = new AbortController();
    const stop = startRepositoryWorkerLeaseHeartbeat(
      "run-1", "lease-1", extend, controller,
    );

    stop();
    await jest.advanceTimersByTimeAsync(REPOSITORY_ANALYSIS_WORKER_LEASE_MS);

    expect(extend).not.toHaveBeenCalled();
    expect(controller.signal.aborted).toBe(false);
  });
});
