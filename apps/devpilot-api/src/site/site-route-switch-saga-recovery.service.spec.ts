import {
  routeSagaRecoveryBackoff,
  SiteRouteSwitchSagaRecoveryService,
} from "./site-route-switch-saga-recovery.service";

describe("SiteRouteSwitchSagaRecoveryService", () => {
  afterEach(() => jest.useRealTimers());

  it("starts non-blocking, polls periodically and stops its timer", async () => {
    jest.useFakeTimers();
    const repository = repositoryDouble([]);
    const service = new SiteRouteSwitchSagaRecoveryService(
      { compensate: jest.fn() } as never,
      repository as never,
    );

    expect(service.onApplicationBootstrap()).toBeUndefined();
    expect(repository.due).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(0);
    expect(repository.due).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(repository.due).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(repository.due).toHaveBeenCalledTimes(2);
  });

  it("leases and retries compensation_required with bounded backoff", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const item = {
      operationId: "operation-1",
      status: "compensation_required",
      lastError: "first failure",
      recoveryAttemptCount: 2,
    };
    const repository = repositoryDouble([item]);
    const saga = {
      compensate: jest.fn().mockResolvedValue("compensation_required"),
    };
    const service = new SiteRouteSwitchSagaRecoveryService(
      saga as never,
      repository as never,
    );

    await service.runOnce(now);
    await service.runOnce(now);

    expect(saga.compensate).toHaveBeenCalledTimes(2);
    expect(repository.claim).toHaveBeenCalledTimes(2);
    const leaseIds = repository.claim.mock.calls.map((call) => call[1]);
    expect(new Set(leaseIds).size).toBe(2);
    expect(repository.release).toHaveBeenLastCalledWith(
      "operation-1",
      expect.any(String),
      new Date(now.getTime() + routeSagaRecoveryBackoff(3)),
    );
    expect(routeSagaRecoveryBackoff(20)).toBe(300_000);
  });

  it("logs exhausted operation identity, status and last error", async () => {
    const repository = repositoryDouble([]);
    repository.alertExhausted.mockResolvedValue([
      {
        operationId: "operation-prepared",
        status: "prepared",
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "production-1",
        siteId: "site-1",
        deploymentRunId: "deployment-1",
        lastError: "current observation unavailable",
      },
    ]);
    const service = new SiteRouteSwitchSagaRecoveryService(
      { compensate: jest.fn() } as never,
      repository as never,
    );
    const error = jest.spyOn((service as any).logger, "error");

    await service.runOnce(new Date("2026-08-11T00:00:00.000Z"));

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "operationId=operation-prepared status=prepared teamId=team-1 projectId=project-1 environmentId=production-1 siteId=site-1 deploymentRunId=deployment-1 lastError=current observation unavailable",
      ),
    );
  });

  it("does not log when the alert CAS loses to a terminal transition", async () => {
    const repository = repositoryDouble([]);
    repository.alertExhausted.mockResolvedValue([]);
    const service = new SiteRouteSwitchSagaRecoveryService(
      { compensate: jest.fn() } as never,
      repository as never,
    );
    const error = jest.spyOn((service as any).logger, "error");

    await service.runOnce(new Date("2026-08-11T00:00:00.000Z"));

    expect(error).not.toHaveBeenCalled();
  });
});

function repositoryDouble(due: unknown[]) {
  return {
    due: jest.fn().mockResolvedValue(due),
    claim: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(true),
    requeueStaleCompensation: jest.fn().mockResolvedValue({ count: 1 }),
    alertExhausted: jest.fn().mockResolvedValue([]),
  };
}
