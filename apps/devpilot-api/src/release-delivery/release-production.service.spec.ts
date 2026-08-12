import { ReleaseProductionService } from "./release-production.service";

describe("ReleaseProductionService preflight evidence boundary", () => {
  const preview = { inputHash: "input", snapshot: { manifest: { id: "manifest-1" } } };
  const repository = {
    preview: jest.fn().mockResolvedValue(preview),
    list: jest.fn(),
    confirm: jest.fn(),
  };
  const capabilities = { requireExecutable: jest.fn() };
  const preflight = { preview: jest.fn().mockResolvedValue({
    decision: { preApprovalAllowed: true },
  }) };
  const service = new ReleaseProductionService(
    repository as never,
    capabilities as never,
    preflight as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("keeps GET preview evidence collection read-only", async () => {
    await service.preview(
      "team-1", "project-1", "order-1", "manifest-1", "standard", "actor-1",
    );
    expect(preflight.preview.mock.calls[0][0]).not.toHaveProperty("refreshEvidence");
  });

  it("marks only the authorized refresh path as evidence-writing", async () => {
    await service.refreshPreflight(
      "team-1", "project-1", "order-1", "manifest-1", "actor-1", "standard",
    );
    expect(preflight.preview).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "actor-1",
      refreshEvidence: true,
    }));
  });

  it("rejects direct API confirmation when exact fresh preflight is blocked", async () => {
    preflight.preview.mockResolvedValueOnce({
      decision: { preApprovalAllowed: false, blockerGateIds: ["D08"] },
    });
    await expect(service.confirm({
      teamId: "team-1", projectId: "project-1", releaseOrderId: "order-1",
      manifestId: "manifest-1", actorId: "actor-1", expectedInputHash: "input",
      idempotencyKey: "blocked-1",
    })).rejects.toThrow("Production 前置检查未通过");
    expect(repository.confirm).not.toHaveBeenCalled();
  });
});
