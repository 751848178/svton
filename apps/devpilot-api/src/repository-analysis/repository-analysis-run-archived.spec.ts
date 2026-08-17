import { archivedProjectWriteError } from "../project/project-archived-write.error";
import { RepositoryAnalysisRunRepository } from "./repository-analysis-run.repository";

function harness(project: { archivedAt: Date | null; onboardingStatus: string }) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "project-1" }]),
    project: { findUniqueOrThrow: jest.fn().mockResolvedValue(project) },
    repositoryAnalysisRun: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "run-1", teamId: "team-1", projectId: "project-1", status: "queued",
      }),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    repositoryAnalysisRun: tx.repositoryAnalysisRun,
    $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
  };
  return { repository: new RepositoryAnalysisRunRepository(prisma as never), tx };
}

describe("RepositoryAnalysisRunRepository archived project boundary", () => {
  it("rejects worker start before locking or updating the run", async () => {
    const { repository, tx } = harness({
      archivedAt: new Date(), onboardingStatus: "archived",
    });

    await expect(repository.start("run-1", "worker-token")).rejects.toMatchObject({
      response: archivedProjectWriteError().getResponse(),
    });
    expect(tx.repositoryAnalysisRun.update).not.toHaveBeenCalled();
  });

  it("rejects direct cancel before updating an archived run", async () => {
    const { repository, tx } = harness({
      archivedAt: new Date(), onboardingStatus: "archived",
    });

    await expect(repository.requestCancel(
      "team-1", "project-1", "run-1",
    )).rejects.toMatchObject({
      response: archivedProjectWriteError().getResponse(),
    });
    expect(tx.repositoryAnalysisRun.updateMany).not.toHaveBeenCalled();
  });

  it("does not replace an unexpired running worker lease", async () => {
    const { repository, tx } = harness({
      archivedAt: null, onboardingStatus: "analyzing",
    });
    tx.repositoryAnalysisRun.findUniqueOrThrow.mockResolvedValue({
      status: "running",
      workerLeaseToken: "owner",
      workerLeaseExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(repository.start("run-1", "competitor")).resolves.toEqual({
      state: "leased",
      retryAt: expect.any(Date),
    });
    expect(tx.repositoryAnalysisRun.updateMany).not.toHaveBeenCalled();
  });
});
