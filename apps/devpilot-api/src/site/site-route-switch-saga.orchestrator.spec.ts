import { SiteRouteSwitchSagaOrchestrator } from "./site-route-switch-saga.orchestrator";
import {
  cleared,
  failed,
  memoryRepository,
  observation,
  providerDouble,
  route,
  switched,
} from "./site-route-switch-saga.spec-utils";

describe("SiteRouteSwitchSagaOrchestrator", () => {
  it("freezes the provider-observed current route instead of a stale DB pointer", async () => {
    const repository = memoryRepository("prepared");
    repository.state.previousRoute = { ...route(), routeHash: "stale-db" };
    const provider = providerDouble();
    const external = {
      ...route(),
      operationId: "manual-op",
      routeHash: "manual",
    };
    provider.observeCurrentRoute.mockResolvedValue({
      version: 1,
      providerKey: provider.identity.providerKey,
      status: "observed",
      reasonCode: "site_route_current_observed",
      observedAt: "2026-08-10T10:00:00.000Z",
      observed: observation(external),
      route: external,
    });
    provider.switchRoute.mockImplementation(async (input) =>
      switched(input.operationId, input),
    );
    const saga = new SiteRouteSwitchSagaOrchestrator(
      repository as never,
      provider as never,
    );

    await saga.apply(route());

    expect(repository.state.previousRoute).toEqual(external);
    expect(provider.switchRoute).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCurrent: observation(external) }),
    );
  });

  it("recovers a crash after provider apply but before receipt persistence", async () => {
    const repository = memoryRepository("applying");
    const provider = providerDouble();
    const saga = new SiteRouteSwitchSagaOrchestrator(
      repository as never,
      provider as never,
    );

    expect(await saga.compensate(route().operationId, "crashed")).toBe(
      "compensated",
    );

    expect(provider.observeRoute).toHaveBeenCalledWith(route().operationId);
    expect(provider.compensateRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        originalOperationId: route().operationId,
        expectedCurrent: observation(route()),
        desiredRoute: null,
      }),
    );
    expect(repository.state.status).toBe("compensated");
  });

  it("leaves a failed compensation required and deterministically recovers it", async () => {
    const repository = memoryRepository("switched");
    const provider = providerDouble();
    provider.compensateRoute.mockResolvedValueOnce(failed("compensation"));
    provider.observeRoute
      .mockResolvedValueOnce(switched(route().operationId, route()))
      .mockResolvedValueOnce(failed("compensation"));
    const saga = new SiteRouteSwitchSagaOrchestrator(
      repository as never,
      provider as never,
    );

    expect(await saga.compensate(route().operationId, "probe failed")).toBe(
      "compensation_required",
    );
    expect(repository.state.status).toBe("compensation_required");

    provider.observeRoute.mockResolvedValue(
      switched(route().operationId, route()),
    );
    provider.compensateRoute.mockImplementation(async (input) =>
      cleared(input.operationId),
    );
    expect(await saga.compensate(route().operationId, "retry")).toBe(
      "compensated",
    );
    expect(repository.state.status).toBe("compensated");
    const ids = provider.compensateRoute.mock.calls.map(
      ([input]) => input.operationId,
    );
    expect(new Set(ids).size).toBe(1);
  });

  it("allows only one concurrent recovery claim", async () => {
    const repository = memoryRepository("applying");
    const provider = providerDouble();
    const saga = new SiteRouteSwitchSagaOrchestrator(
      repository as never,
      provider as never,
    );

    const results = await Promise.all([
      saga.compensate(route().operationId, "worker-a"),
      saga.compensate(route().operationId, "worker-b"),
    ]);

    expect(results).toContain("compensated");
    expect(provider.compensateRoute).toHaveBeenCalledTimes(1);
  });

  it("fails closed when recovery resolves a different Provider", async () => {
    const repository = memoryRepository("switched");
    repository.state.providerKey = "retired-provider";
    const provider = providerDouble();
    const saga = new SiteRouteSwitchSagaOrchestrator(
      repository as never,
      provider as never,
    );

    expect(await saga.compensate(route().operationId, "recover")).toBe(
      "compensation_required",
    );
    expect(provider.observeRoute).not.toHaveBeenCalled();
  });

  it.each(["committed", "compensated", "failed"])(
    "never replays a terminal %s saga",
    async (status) => {
      const repository = memoryRepository(status);
      const provider = providerDouble();
      const saga = new SiteRouteSwitchSagaOrchestrator(
        repository as never,
        provider as never,
      );

      expect(await saga.compensate(route().operationId, "ignored")).toBe(
        "terminal",
      );
      expect(provider.observeRoute).not.toHaveBeenCalled();
      expect(provider.compensateRoute).not.toHaveBeenCalled();
    },
  );
});
