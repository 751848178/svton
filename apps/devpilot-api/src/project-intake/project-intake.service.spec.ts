import { PrismaService } from "../prisma/prisma.service";
import { RepositoryAnalysisRunService } from "../repository-analysis/repository-analysis-run.service";
import { RepositoryConnectionService } from "../repository-analysis/repository-connection.service";
import { RepositorySuggestionApplyService } from "../repository-analysis/repository-suggestion-apply.service";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { ProjectIntakeService } from "./project-intake.service";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";

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
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const duplicateGuard = {
    assertAvailable: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectRepositoryDuplicateGuardService;
  const connections = {
    connect: jest.fn().mockResolvedValue({ id: "connection-1" }),
    getState: jest.fn().mockResolvedValue({ connection: null }),
  } as unknown as RepositoryConnectionService;
  const runs = {
    list: jest.fn().mockResolvedValue([]),
    start: jest.fn().mockResolvedValue({ id: "run-1" }),
    retry: jest.fn().mockResolvedValue({ id: "run-2" }),
  } as unknown as RepositoryAnalysisRunService;
  const suggestions = {
    apply: jest.fn().mockResolvedValue({ complete: true }),
  } as unknown as RepositorySuggestionApplyService;
  const finalization = {
    finalize: jest.fn().mockResolvedValue({ projectId: "project-1" }),
  } as unknown as ProjectIntakeFinalizationService;
  return {
    prisma,
    duplicateGuard,
    connections,
    runs,
    suggestions,
    service: new ProjectIntakeService(
      prisma,
      duplicateGuard,
      connections,
      runs,
      suggestions,
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
    const { prisma, suggestions, service } = createService();

    await service.review("team-1", "user-1", "project-1", "run-1", {
      decisions: [],
    });

    expect(suggestions.apply).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      "run-1",
      { decisions: [] },
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
});
