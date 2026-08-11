import { ProductionPromotionReconcileService } from "./production-promotion-reconcile.service";

describe("ProductionPromotionReconcileService", () => {
  it.each([
    ["committed", "convergeCommitted"],
    ["not_switched", "terminateNotSwitched"],
  ] as const)("routes exact %s readback to %s", async (state, method) => {
    const fixture = setup(state);
    await fixture.service.reconcile(input());
    expect(fixture.repository[method]).toHaveBeenCalledWith("audit-1",
      expect.objectContaining({ state, operationId: "route-1", providerKey: "route-v1" }));
    expect(fixture.repository.block).not.toHaveBeenCalled();
  });

  it.each(["switched", "recovering", "unknown"] as const)(
    "keeps legacy quarantine blocked for %s readback",
    async (state) => {
      const fixture = setup(state);
      await fixture.service.reconcile(input());
      expect(fixture.repository.block).toHaveBeenCalledWith(
        "audit-1", expect.objectContaining({ state }),
        "LEGACY_PROMOTION_READBACK_INCONCLUSIVE",
      );
      expect(fixture.repository.convergeCommitted).not.toHaveBeenCalled();
      expect(fixture.repository.terminateNotSwitched).not.toHaveBeenCalled();
    },
  );

  it("records missing route identity as blocked without Provider access", async () => {
    const fixture = setup("unknown", { routeSwitchOperationId: null });
    await fixture.service.reconcile(input());
    expect(fixture.readback.inspectExact).not.toHaveBeenCalled();
    expect(fixture.repository.block).toHaveBeenCalledWith(
      "audit-1", expect.objectContaining({ state: "unknown", providerKey: "route-v1" }),
      "LEGACY_PROMOTION_ROUTE_IDENTITY_MISSING",
    );
  });

  it("replays a terminal audit without another Provider readback", async () => {
    const fixture = setup("unknown", { shouldInspect: false });
    await expect(fixture.service.reconcile(input())).resolves.toEqual(
      expect.objectContaining({ id: "audit-1" }),
    );
    expect(fixture.readback.inspectExact).not.toHaveBeenCalled();
  });
});

function setup(state: string, overrides: Record<string, unknown> = {}) {
  const prepared = {
    audit: { id: "audit-1", status: "running", inputHash: "input-hash" },
    candidate: {}, routeSwitchOperationId: "route-1",
    routeProviderKey: "route-v1", shouldInspect: true, ...overrides,
  };
  const repository = {
    prepare: jest.fn().mockResolvedValue(prepared),
    convergeCommitted: jest.fn().mockResolvedValue({ status: "completed" }),
    terminateNotSwitched: jest.fn().mockResolvedValue({ status: "completed" }),
    block: jest.fn().mockResolvedValue({ status: "blocked" }),
  };
  const readback = { inspectExact: jest.fn().mockResolvedValue({
    operationId: "route-1", providerKey: "route-v1", state,
  }) };
  return { repository, readback,
    service: new ProductionPromotionReconcileService(repository as never, readback as never) };
}

function input() {
  return { teamId: "team-1", projectId: "project-1", environmentId: "prod-1",
    actorId: "actor-1", promotionCommandId: "promotion-1", idempotencyKey: "idem-123" };
}
