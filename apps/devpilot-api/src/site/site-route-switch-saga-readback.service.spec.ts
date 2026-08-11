import { SiteRouteSwitchSagaReadbackService } from "./site-route-switch-saga-readback.service";

describe("SiteRouteSwitchSagaReadbackService", () => {
  it("turns a crashed applying saga into switched only after provider readback", async () => {
    const desired = {
      operationId: "operation-1", siteId: "site-1",
      deploymentRunId: "deployment-1", targetRef: "server-1",
      routeHash: "route-hash",
    };
    const receipt = {
      version: 1, providerKey: "provider-v1", operationId: "operation-1",
      status: "switched", reasonCode: "observed", observedAt: "2026-08-11T00:00:00Z",
      observed: { siteId: "site-1", deploymentRunId: "deployment-1",
        targetRef: "server-1", routeHash: "route-hash" },
    };
    const repository = {
      get: jest.fn().mockResolvedValue({
        status: "applying", providerKey: "provider-v1", desiredRoute: desired,
      }),
      markSwitched: jest.fn().mockResolvedValue(true),
    };
    const provider = {
      identity: { providerKey: "provider-v1", receiptVersion: 1 },
      verifyProductionCapability: jest.fn().mockResolvedValue(undefined),
      observeRoute: jest.fn().mockResolvedValue(receipt),
    };
    const service = new SiteRouteSwitchSagaReadbackService(
      repository as never,
      provider as never,
    );
    await expect(service.inspect("operation-1")).resolves.toBe("switched");
    expect(repository.markSwitched).toHaveBeenCalledWith("operation-1", receipt);
  });

  it("does not infer success from an unverified provider observation", async () => {
    const repository = {
      get: jest.fn().mockResolvedValue({
        status: "applying", providerKey: "provider-v1",
        desiredRoute: { operationId: "operation-1" },
      }),
      markSwitched: jest.fn(),
    };
    const provider = {
      identity: { providerKey: "provider-v1", receiptVersion: 1 },
      verifyProductionCapability: jest.fn().mockResolvedValue(undefined),
      observeRoute: jest.fn().mockResolvedValue({ status: "failed" }),
    };
    const service = new SiteRouteSwitchSagaReadbackService(
      repository as never,
      provider as never,
    );
    await expect(service.inspect("operation-1")).resolves.toBe("unknown");
    expect(repository.markSwitched).not.toHaveBeenCalled();
  });
});
