import { NotFoundException } from "@nestjs/common";
import { ReleaseGateCatalogController } from "./release-gate-catalog.controller";
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { RELEASE_GATE_STATUSES } from "./release-gate-catalog.types";

describe("ReleaseGateCatalogService", () => {
  const order = {
    id: "order-1",
    releaseVersion: "2.4.1",
    project: { repositoryConnection: null, repositoryAnalysisRuns: [] },
    buildRuns: [],
  };
  it("publishes the versioned 10/11/20/10 canonical catalog", async () => {
    const checks = RELEASE_GATE_DEFINITIONS.map((definition) => ({
      ...definition,
      status: "unavailable" as const,
      providerKey: null,
      reasonCode: "provider_unavailable",
      evidenceRef: null,
      checkedAt: null,
      expiresAt: null,
      fresh: null,
      evaluationId: `evaluation-${definition.id}`,
      evaluationInputHash: `input-${definition.id}`,
      definitionVersion: "test",
      persistedStatus: "unavailable",
      persistedAt: new Date(0).toISOString(),
      waiver: null,
      waiverExpiresAt: null,
    }));
    const capabilities = Array.from({ length: 15 }, (_, index) => ({
      id: `capability-${index}`,
      available: false,
    }));
    const decisions = {
      build: { allowed: false },
      staging: { allowed: false },
      production: { allowed: false },
    };
    const decisionPolicy = {
      catalog: jest.fn().mockResolvedValue({
        evaluation: { order, checks, capabilities },
        decisions,
      }),
    };
    const sources = {
      resolve: jest.fn().mockRejectedValue(new Error("source unavailable")),
    };
    const service = new ReleaseGateCatalogService(
      decisionPolicy as never,
      sources as never,
      { get: jest.fn().mockResolvedValue({ reasonCode: "TARGET_MISSING" }) } as never,
    );
    const result = await service.get(
      "team-1",
      "project-1",
      "order-1",
      "user-1",
    );
    expect(result.catalogVersion).toMatch(/^v13\./);
    expect(result.capabilityVersion).toMatch(/^mvp15\./);
    expect(result.summary).toMatchObject({
      total: 51,
      phaseCounts: { commit: 10, build: 11, deploy: 20, promote: 10 },
      statusCounts: { unavailable: 51 },
    });
    expect(result.capabilities).toHaveLength(15);
    expect(
      result.capabilities.every((capability) => !capability.available),
    ).toBe(true);
    expect(result.checks.every((check) => check.status === "unavailable")).toBe(
      true,
    );
    expect(result.checks.every((check) => check.evaluationId)).toBe(true);
    expect(result.decisions).toBe(decisions);
    expect(result.targetReadiness).toEqual({ reasonCode: "TARGET_MISSING" });
    expect(decisionPolicy.catalog).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        projectId: "project-1",
        releaseOrderId: "order-1",
        actorId: "user-1",
      }),
      {
        target: { sourceResolution: "unavailable" },
        actionInput: { sourceResolution: "unavailable" },
      },
    );
  });

  it("keeps every check id unique and every status inside the unified contract", () => {
    expect(new Set(RELEASE_GATE_DEFINITIONS.map((item) => item.id)).size).toBe(
      51,
    );
    expect(RELEASE_GATE_STATUSES).toEqual([
      "checked",
      "unchecked",
      "blocked",
      "warning",
      "manual",
      "unavailable",
    ]);
  });

  it("does not expose a catalog for a cross-project or unknown release order", async () => {
    const service = new ReleaseGateCatalogService(
      {
        catalog: jest.fn().mockRejectedValue(new NotFoundException()),
      } as never,
      {
        resolve: jest.fn().mockRejectedValue(new Error("source unavailable")),
      } as never,
      { get: jest.fn().mockResolvedValue({ reasonCode: "TARGET_MISSING" }) } as never,
    );
    await expect(
      service.get("team-1", "project-1", "other-order", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("checks release read access before serving the catalog", async () => {
    const catalog = { get: jest.fn().mockResolvedValue({ checks: [] }) };
    const access = { assertRead: jest.fn().mockResolvedValue(undefined) };
    const controller = new ReleaseGateCatalogController(
      catalog as never,
      access as never,
      { confirm: jest.fn() } as never,
    );
    const request = { teamId: "team-1", user: { id: "user-1" } };
    await controller.get(request, "project-1", "order-1");
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(catalog.get).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      "user-1",
    );
  });
});
