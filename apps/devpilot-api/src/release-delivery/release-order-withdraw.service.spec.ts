import { NotFoundException } from "@nestjs/common";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { ReleaseOrderWithdrawRepository } from "./release-order-withdraw.repository";
import { ReleaseOrderWithdrawService } from "./release-order-withdraw.service";

describe("ReleaseOrderWithdrawService", () => {
  const repository = {
    withdraw: jest.fn(),
  } as unknown as ReleaseOrderWithdrawRepository;
  const details = {
    find: jest.fn(),
  } as unknown as ReleaseOrderDetailRepository;
  const service = new ReleaseOrderWithdrawService(repository, details);
  const input = {
    teamId: "team-1",
    actorId: "actor-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns only the refreshed public detail contract", async () => {
    jest.mocked(repository.withdraw).mockResolvedValue({ changed: true });
    jest.mocked(details.find).mockResolvedValue({
      order: {
        id: "order-1",
        teamId: "team-1",
        projectId: "project-1",
        createdById: "actor-1",
        releaseVersion: "2.4.1",
        note: null,
        status: "canceled",
        createdAt: new Date("2026-08-04T01:00:00.000Z"),
        updatedAt: new Date("2026-08-04T02:00:00.000Z"),
        _count: { buildRuns: 1, manifests: 1, releaseRuns: 1 },
        project: {
          repositoryConnection: null,
          repositoryIdentity: null,
          environments: [],
        },
      },
      persistedStatus: "canceled",
      lifecycle: {
        status: "withdrawn",
        phase: "production",
        sourceType: "withdrawal",
        sourceId: "audit-1",
        sourceStatus: "canceled",
        occurredAt: "2026-08-04T02:00:00.000Z",
      },
      resumeStep: "production",
    });

    const first = await service.withdraw(input);
    jest.mocked(repository.withdraw).mockResolvedValue({ changed: false });
    const replay = await service.withdraw(input);
    expect(first).toMatchObject({
      id: "order-1",
      persistedStatus: "canceled",
      lifecycle: { status: "withdrawn" },
    });
    expect(replay).toEqual(first);
    expect(first).not.toHaveProperty("withdrawalChanged");
    expect(first).not.toHaveProperty("status");
    expect(first).not.toHaveProperty("teamId");
    expect(first).not.toHaveProperty("createdById");
    expect(first).not.toHaveProperty("project");
  });

  it("fails closed when the scoped order is absent", async () => {
    jest.mocked(repository.withdraw).mockResolvedValue(null);
    await expect(service.withdraw(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(details.find).not.toHaveBeenCalled();
  });
});
