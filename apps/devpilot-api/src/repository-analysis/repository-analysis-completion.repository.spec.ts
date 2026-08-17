import { RepositoryAnalysisCompletionRepository } from "./repository-analysis-completion.repository";

const RESULT = {
  repository: { monorepo: false, lockfiles: [], workspacePatterns: [] },
  services: [],
  composeCandidates: [],
  resourceRequirements: [],
  warnings: [],
  evidence: [],
};

function createHarness(auditRejects = false) {
  const run = { status: "running", startedAt: new Date(0) };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "locked" }]),
    project: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ archivedAt: null, onboardingStatus: "analyzing" }),
    },
    repositoryAnalysisRun: {
      findUnique: jest.fn().mockResolvedValue({ teamId: "team-1", projectId: "project-1" }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(run),
      findFirst: jest.fn().mockResolvedValue({ id: "run-1" }),
      update: jest.fn().mockResolvedValue({ id: "run-1", status: "succeeded" }),
    },
    repositoryAnalysisStage: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "stage-cleanup", startedAt: new Date(0) }),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    repositoryAnalysisSuggestion: { createMany: jest.fn() },
    auditEvent: {
      create: auditRejects ? jest.fn().mockRejectedValue(new Error("audit failed")) : jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (handler) => handler(tx)),
  };
  return { tx, repository: new RepositoryAnalysisCompletionRepository(prisma as never) };
}

describe("RepositoryAnalysisCompletionRepository", () => {
  it("locks project, run and stages before committing success and audit", async () => {
    const { tx, repository } = createHarness();
    await repository.succeed({
      runId: "run-1",
      workerLeaseToken: "worker-1",
      result: RESULT,
      drafts: [],
      audit: {
        teamId: "team-1",
        projectId: "project-1",
        action: "repository.analysis.succeed",
        summary: "done",
        metadata: { runId: "run-1" },
      },
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.repositoryAnalysisStage.update).toHaveBeenCalled();
    expect(tx.repositoryAnalysisRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "succeeded", activeKey: null }),
    }));
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("propagates audit failure so the surrounding transaction rolls back", async () => {
    const { repository } = createHarness(true);
    await expect(repository.fail({
      runId: "run-1",
      workerLeaseToken: "worker-1",
      currentStage: "detect",
      status: "failed",
      detail: { code: "FAILED", message: "failed", action: "retry" },
      audit: {
        teamId: "team-1",
        projectId: "project-1",
        action: "repository.analysis.fail",
        status: "failed",
        summary: "failed",
        metadata: { runId: "run-1" },
      },
    })).rejects.toThrow("audit failed");
  });
});
