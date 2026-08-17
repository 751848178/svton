import { ProjectGovernanceBaselineService } from "./project-governance-baseline.service";
import { ProjectGovernanceFinalizationService } from "./project-governance-finalization.service";
import { ProjectGovernanceServiceTopologyService } from "./project-governance-service-topology.service";

describe("ProjectGovernanceFinalizationService", () => {
  it("owns READY transition, baselines and governance audit in one transaction", async () => {
    const tx = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: "project-1",
          onboardingStatus: "draft",
          onboardingRevision: 1,
          onboardingFinalizedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const baselines = {
      ensure: jest.fn().mockResolvedValue([
        {
          id: "staging-1",
          key: "staging",
          baselineRole: "staging",
          configRevisionId: "revision-staging-1",
        },
        {
          id: "production-1",
          key: "production",
          baselineRole: "production",
          configRevisionId: "revision-production-1",
        },
      ]),
    } as unknown as ProjectGovernanceBaselineService;
    const service = new ProjectGovernanceFinalizationService(
      prisma as never,
      baselines,
      { materialize: jest.fn() } as unknown as ProjectGovernanceServiceTopologyService,
    );

    const result = await service.finalize({
      teamId: "team-1",
      projectId: "project-1",
      actorId: "user-1",
      expectedStatus: "draft",
      expectedRevision: 1,
      auditAction: "project.generate.finalize",
      auditSummary: "finalized",
    });

    expect(tx.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ onboardingStatus: "draft" }),
        data: expect.objectContaining({ onboardingStatus: "ready" }),
      }),
    );
    expect(baselines.ensure).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ projectId: "project-1" }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project.generate.finalize",
          metadata: expect.objectContaining({ governance: expect.any(Object) }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        projectId: "project-1",
        onboardingRevision: 2,
        environments: expect.arrayContaining([
          expect.objectContaining({ key: "staging" }),
          expect.objectContaining({ key: "production" }),
        ]),
      }),
    );
  });
});
