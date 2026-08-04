import { ConflictException, NotFoundException } from "@nestjs/common";
import { ReleaseOrderService } from "./release-order.service";

describe("ReleaseOrderService", () => {
  const repository = {
    findProject: jest.fn(),
    findByVersion: jest.fn(),
    create: jest.fn(),
  };
  const details = { find: jest.fn() };
  const service = new ReleaseOrderService(
    repository as never,
    details as never,
  );
  const record = {
    id: "order-1",
    teamId: "team-1",
    projectId: "project-1",
    releaseVersion: "2.4.1",
    note: "First release",
    status: "draft",
    createdAt: new Date("2026-08-03T00:00:00Z"),
    updatedAt: new Date("2026-08-03T00:00:00Z"),
    _count: { buildRuns: 0, manifests: 0, releaseRuns: 0 },
  };
  const detail = {
    order: {
      ...record,
      project: {
        repositoryConnection: null,
        repositoryIdentity: null,
        environments: [],
      },
    },
    persistedStatus: "draft",
    lifecycle: {
      status: "draft",
      phase: "preflight",
      sourceType: "order_created",
      sourceId: "order-1",
      sourceStatus: "created",
      occurredAt: "2026-08-03T00:00:00.000Z",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findProject.mockResolvedValue({ id: "project-1" });
    details.find.mockResolvedValue(detail);
  });

  it("creates only a draft order and exposes zero execution records", async () => {
    repository.findByVersion.mockResolvedValue(null);
    repository.create.mockResolvedValue(record);
    await expect(
      service.create("team-1", "user-1", "project-1", {
        releaseVersion: " 2.4.1 ",
        note: " First release ",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        counts: record._count,
        persistedStatus: "draft",
        lifecycle: expect.objectContaining({ status: "draft" }),
      }),
    );
    expect(repository.create).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      releaseVersion: "2.4.1",
      note: "First release",
    });
    const created = await service.create("team-1", "user-1", "project-1", {
      releaseVersion: "2.4.1",
      note: "First release",
    });
    expect(created).not.toHaveProperty("status");
  });

  it("replays an identical project/version request", async () => {
    repository.findByVersion.mockResolvedValue(record);
    const result = await service.create("team-1", "user-1", "project-1", {
      releaseVersion: "2.4.1",
      note: "First release",
    });
    expect(result).toEqual(await service.get("team-1", "project-1", "order-1"));
    expect(result).not.toHaveProperty("status");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a version with a different note", async () => {
    repository.findByVersion.mockResolvedValue(record);
    await expect(
      service.create("team-1", "user-1", "project-1", {
        releaseVersion: "2.4.1",
        note: "Different",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not reveal a project outside the team scope", async () => {
    repository.findProject.mockResolvedValue(null);
    await expect(
      service.create("team-2", "user-1", "project-1", {
        releaseVersion: "2.4.2",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns server-derived preflight and resume state for detail", async () => {
    details.find.mockResolvedValue({
      order: {
        ...record,
        _count: { buildRuns: 2, manifests: 1, releaseRuns: 0 },
        project: {
          repositoryConnection: {
            repositoryUrl: "https://example.com/repo.git",
            provider: "generic",
            status: "connected",
            defaultBranch: "main",
            selectedBranch: "main",
          },
          repositoryIdentity: {
            id: "identity-1",
            projectId: "project-1",
            provider: "generic",
            canonicalKey: "example.com/repo",
            canonicalUrl: "https://example.com/repo",
            lockedAt: new Date(),
            currentRevision: {
              id: "revision-1",
              revision: 1,
              defaultBranch: "main",
              reason: "initial",
              createdAt: new Date(),
              identityId: "identity-1",
              projectId: "project-1",
            },
          },
          environments: [
            { id: "staging", baselineRole: "staging" },
            { id: "production", baselineRole: "production" },
          ],
        },
      },
      persistedStatus: "active",
      lifecycle: {
        status: "staging",
        phase: "staging",
        sourceType: "build_run",
        sourceId: "build-2",
        sourceStatus: "succeeded",
        occurredAt: "2026-08-03T01:00:00.000Z",
      },
    });
    await expect(
      service.get("team-1", "project-1", "order-1"),
    ).resolves.toEqual(
      expect.objectContaining({
        resumeStep: "build",
        preflight: expect.objectContaining({ ready: true }),
      }),
    );
  });
});
