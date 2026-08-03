import { NotFoundException } from "@nestjs/common";
import { ReleaseGateCatalogController } from "./release-gate-catalog.controller";
import { ReleaseGateCatalogService } from "./release-gate-catalog.service";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import {
  RELEASE_GATE_STATUSES,
  type ReleaseGateEvaluation,
} from "./release-gate-catalog.types";
import { createReleaseGateRegistry } from "./release-gate-test-registry.spec-utils";

describe("ReleaseGateCatalogService", () => {
  const order = {
    id: "order-1",
    releaseVersion: "2.4.1",
    project: { repositoryConnection: null, repositoryAnalysisRuns: [] },
    buildRuns: [],
  };
  it("publishes the versioned 10/11/20/10 canonical catalog", async () => {
    const evidence = { load: jest.fn().mockResolvedValue(order) };
    const evaluations = {
      persist: jest.fn(async (_scope: unknown, checks: ReleaseGateEvaluation[]) => checks.map((check) => ({
        ...check,
        evaluationId: `evaluation-${check.id}`,
      }))),
    };
    const service = new ReleaseGateCatalogService(
      evidence as never,
      { load: jest.fn().mockResolvedValue(undefined) } as never,
      { load: jest.fn().mockResolvedValue(undefined) } as never,
      createReleaseGateRegistry(),
      evaluations as never,
    );
    const result = await service.get("team-1", "project-1", "order-1", "user-1");
    expect(result.catalogVersion).toMatch(/^v13\./);
    expect(result.capabilityVersion).toMatch(/^mvp15\./);
    expect(result.summary).toMatchObject({
      total: 51,
      phaseCounts: { commit: 10, build: 11, deploy: 20, promote: 10 },
      statusCounts: { unavailable: 51 },
    });
    expect(result.capabilities).toHaveLength(15);
    expect(result.capabilities.every((capability) => !capability.available)).toBe(true);
    expect(result.checks.every((check) => check.status === "unavailable")).toBe(true);
    expect(result.checks.every((check) => check.evaluationId)).toBe(true);
    expect(evaluations.persist).toHaveBeenCalledWith(expect.objectContaining({
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      actorId: "user-1",
    }), expect.any(Array));
  });

  it("keeps every check id unique and every status inside the unified contract", () => {
    expect(new Set(RELEASE_GATE_DEFINITIONS.map((item) => item.id)).size).toBe(51);
    expect(RELEASE_GATE_STATUSES).toEqual([
      "checked", "unchecked", "blocked", "warning", "manual", "unavailable",
    ]);
  });

  it("does not expose a catalog for a cross-project or unknown release order", async () => {
    const service = new ReleaseGateCatalogService(
      { load: jest.fn().mockResolvedValue(null) } as never,
      { load: jest.fn() } as never,
      { load: jest.fn() } as never,
      createReleaseGateRegistry(),
      { persist: jest.fn() } as never,
    );
    await expect(service.get("team-1", "project-1", "other-order", "user-1"))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("checks release read access before serving the catalog", async () => {
    const catalog = { get: jest.fn().mockResolvedValue({ checks: [] }) };
    const access = { assertRead: jest.fn().mockResolvedValue(undefined) };
    const controller = new ReleaseGateCatalogController(catalog as never, access as never);
    const request = { teamId: "team-1", user: { id: "user-1" } };
    await controller.get(request, "project-1", "order-1");
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1", actorId: "user-1", projectId: "project-1",
    });
    expect(catalog.get).toHaveBeenCalledWith(
      "team-1", "project-1", "order-1", "user-1",
    );
  });
});
