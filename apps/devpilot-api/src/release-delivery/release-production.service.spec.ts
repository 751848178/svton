import { ReleaseProductionService } from "./release-production.service";
import { ReleaseProductionPreflightService } from "./release-production-preflight.service";
import { ReleaseGateProductionApplicabilityProvider } from "./release-gate-production-applicability.provider";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";

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

  it("confirms the first release from exact preflight facts without a ReleaseRun fixture", async () => {
    const exactPreview = productionPreview();
    const exactRepository = {
      preview: jest.fn().mockResolvedValue(exactPreview),
      confirm: jest.fn().mockResolvedValue({ id: "release-1" }),
    };
    const gates = previewGateFromRealApplicability();
    const exactPreflight = new ReleaseProductionPreflightService(
      { prepare: jest.fn().mockResolvedValue(deployment()) } as never,
      { prepare: jest.fn().mockResolvedValue(workload()) } as never,
      gates as never,
      { providerKey: "local-filesystem-v1" } as never,
      { findFresh: jest.fn().mockResolvedValue(null) } as never,
      { findFresh: jest.fn().mockResolvedValue(null) } as never,
    );
    const exactService = new ReleaseProductionService(
      exactRepository as never, capabilities as never, exactPreflight,
    );
    await expect(exactService.confirm({
      teamId: "team-1", projectId: "project-1", releaseOrderId: "order-1",
      manifestId: "manifest-1", actorId: "actor-1",
      expectedInputHash: exactPreview.inputHash, idempotencyKey: "first-1",
    })).resolves.toEqual({ id: "release-1" });
    expect(gates.preview).toHaveBeenCalledWith(expect.objectContaining({
      checkpoint: "production_pre_execution",
      target: expect.objectContaining({ releaseStrategy: "standard",
        previewInputHash: "preview-hash" }),
    }));
    expect(exactRepository.confirm).toHaveBeenCalledWith(expect.objectContaining({
      admissionProof: expect.objectContaining({ preApprovalAllowed: true }),
    }));
  });
});

function previewGateFromRealApplicability() {
  const provider = new ReleaseGateProductionApplicabilityProvider();
  return { preview: jest.fn(async (input: any) => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    const context = { decisionCheckpoint: input.checkpoint,
      decisionTarget: input.target,
      deploy: { environment: { id: "environment-1", serverBindings: [{
        id: "binding-1", updatedAt: now,
      }] } },
      promote: { environment: { id: "environment-1",
        currentEnvironmentVersion: null, environmentVersions: [] },
        releaseRun: null },
    } as any;
    const checks = ["D06", "D19"].map((id) => ({
      ...RELEASE_GATE_DEFINITIONS.find((item) => item.id === id)!,
      providerKey: provider.providerKey,
      ...provider.evaluate(
        RELEASE_GATE_DEFINITIONS.find((item) => item.id === id)!, context, now,
      )!,
    }));
    const allowed = checks.every((check) => check.status === "checked");
    return { checks, decision: { allowed, preApprovalAllowed: allowed,
      preApprovalBlockerGateIds: [], blockerGateIds: [], manualGateIds: [] } };
  }) };
}

function productionPreview() {
  return { inputHash: "preview-hash", snapshot: {
    environment: { id: "environment-1", key: "production" },
    config: { revisionId: "revision-1", routeSnapshot: {} },
    build: { id: "build-1" }, manifest: { id: "manifest-1" },
    releasePolicy: { strategy: "standard", requireProductionApproval: true },
  } } as any;
}

function deployment() {
  return { snapshot: { inputHash: "deployment-hash", configRevision: {
    id: "revision-1" }, target: { bindingId: "binding-1" } } };
}

function workload() {
  return { inputHash: "workload-hash", services: [{ serviceId: "service-1",
    executionMode: "managed-command-v1", statusCommand: "true",
    resources: { cpuMillicores: 100, memoryBytes: 1, diskBytes: 1 } }] };
}
