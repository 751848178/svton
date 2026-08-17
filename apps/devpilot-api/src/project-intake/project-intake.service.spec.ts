import { PrismaService } from "../prisma/prisma.service";
import { RepositoryAnalysisRunService } from "../repository-analysis/repository-analysis-run.service";
import { RepositoryConnectionService } from "../repository-analysis/repository-connection.service";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { ProjectIntakeService } from "./project-intake.service";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";
import { RepositoryIntakeContractService } from "./repository-intake-contract.service";
import { RepositoryIntakeReviewService } from "./repository-intake-review.service";

function createService() {
  const prisma = {
    project: {
      create: jest.fn(({ data }) =>
        Promise.resolve({ id: "project-1", ...data }),
      ),
      findFirst: jest.fn().mockResolvedValue({
        id: "project-1",
        onboardingStatus: "draft",
        onboardingRevision: 1,
        archivedAt: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const duplicateGuard = {
    assertAvailable: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectRepositoryDuplicateGuardService;
  const connections = {
    connect: jest.fn().mockImplementation(async (
      _teamId: string,
      _actorId: string,
      _projectId: string,
      _dto: unknown,
      afterVerified?: (tx: PrismaService) => Promise<void>,
    ) => {
      await afterVerified?.(prisma);
      return { id: "connection-1" };
    }),
    getState: jest.fn().mockResolvedValue({ connection: null }),
  } as unknown as RepositoryConnectionService;
  const runs = {
    list: jest.fn().mockResolvedValue([]),
    start: jest.fn().mockResolvedValue({ id: "run-1" }),
    retry: jest.fn().mockResolvedValue({ id: "run-2" }),
  } as unknown as RepositoryAnalysisRunService;
  const contracts = {
    read: jest.fn(),
  } as unknown as RepositoryIntakeContractService;
  const reviews = {
    review: jest.fn().mockImplementation(async (
      _teamId: string,
      _actorId: string,
      _projectId: string,
      _runId: string,
      _dto: unknown,
      afterApply?: (tx: PrismaService) => Promise<void>,
    ) => {
      await afterApply?.(prisma);
      return { snapshot: { id: "snapshot-1" } };
    }),
  } as unknown as RepositoryIntakeReviewService;
  const finalization = {
    finalize: jest.fn().mockResolvedValue({ projectId: "project-1" }),
  } as unknown as ProjectIntakeFinalizationService;
  return {
    prisma,
    duplicateGuard,
    connections,
    runs,
    reviews,
    finalization,
    service: new ProjectIntakeService(
      prisma,
      duplicateGuard,
      connections,
      runs,
      contracts,
      reviews,
      finalization,
    ),
  };
}

describe("ProjectIntakeService", () => {
  it("creates a draft without implicit environments", async () => {
    const { prisma, service } = createService();

    await service.createDraft("team-1", "user-1", {
      name: " Demo ",
      description: " Service ",
    });

    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: "team-1",
        createdById: "user-1",
        name: "Demo",
        description: "Service",
        onboardingStatus: "draft",
        onboardingRevision: 1,
      }),
    });
    expect(
      JSON.stringify((prisma.project.create as jest.Mock).mock.calls[0][0]),
    ).not.toContain("environments");
  });

  it("checks duplicate identity before connecting and advances to analyzing", async () => {
    const { prisma, duplicateGuard, connections, service } = createService();
    const dto = {
      repositoryUrl: "https://git.example/repo.git",
      visibility: "public" as const,
    };

    await service.connect("team-1", "user-1", "project-1", dto);

    expect(duplicateGuard.assertAvailable).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      dto.repositoryUrl,
    );
    expect(connections.connect).toHaveBeenCalled();
    expect(prisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          onboardingStatus: "analyzing",
          onboardingRevision: { increment: 1 },
        },
      }),
    );
  });

  it("advances to review only after the real suggestion apply service returns", async () => {
    const { prisma, reviews, service } = createService();

    await service.review("team-1", "user-1", "project-1", "run-1", {
      items: [],
    });

    expect(reviews.review).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      "run-1",
      { items: [] },
      expect.any(Function),
    );
    expect(prisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          onboardingStatus: "review",
          onboardingRevision: { increment: 1 },
        },
      }),
    );
  });

  it("delegates retry to repository analysis before returning to analyzing", async () => {
    const { prisma, runs, service } = createService();

    await service.retryAnalysis("team-1", "user-1", "project-1", "run-failed");

    expect(runs.retry).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      "run-failed",
    );
    expect(prisma.project.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          onboardingStatus: "analyzing",
          onboardingRevision: { increment: 1 },
        },
      }),
    );
  });

  it("reports a transition conflict instead of silently accepting a zero-row CAS", async () => {
    const { prisma, service } = createService();
    (prisma.project.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(service.connect("team-1", "user-1", "project-1", {
      repositoryUrl: "https://git.example/repo.git",
      visibility: "public",
    })).rejects.toThrow("PROJECT_INTAKE_STATE_TRANSITION_CONFLICT");
  });

  it.each([
    [
      "connect",
      (service: ProjectIntakeService) =>
        service.connect("team-1", "user-1", "project-1", {
          repositoryUrl: "https://git.example/repo.git",
          visibility: "public",
        }),
    ],
    [
      "start",
      (service: ProjectIntakeService) =>
        service.startAnalysis("team-1", "user-1", "project-1", {
          branch: "main",
          idempotencyKey: "start-1",
        }),
    ],
    [
      "retry",
      (service: ProjectIntakeService) =>
        service.retryAnalysis("team-1", "user-1", "project-1", "run-1"),
    ],
    [
      "review",
      (service: ProjectIntakeService) =>
        service.review("team-1", "user-1", "project-1", "run-1", { items: [] }),
    ],
    [
      "finalize",
      (service: ProjectIntakeService) =>
        service.finalize("team-1", "user-1", "project-1", {
          analysisRunId: "run-1",
          reviewSnapshotId: "review-1",
          reviewSnapshotHash: "a".repeat(64),
          idempotencyKey: "finalize-1",
        }),
    ],
  ])("rejects archived project before %s writes", async (_label, action) => {
    const deps = createService();
    (deps.prisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: "project-1",
      onboardingStatus: "archived",
      onboardingRevision: 2,
      archivedAt: new Date(),
    });

    await expect(action(deps.service)).rejects.toMatchObject({
      response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
    });
    expect(deps.duplicateGuard.assertAvailable).not.toHaveBeenCalled();
    expect(deps.connections.connect).not.toHaveBeenCalled();
    expect(deps.runs.start).not.toHaveBeenCalled();
    expect(deps.runs.retry).not.toHaveBeenCalled();
    expect(deps.reviews.review).not.toHaveBeenCalled();
    expect(deps.finalization.finalize).not.toHaveBeenCalled();
    expect(deps.prisma.project.updateMany).not.toHaveBeenCalled();
  });
});
