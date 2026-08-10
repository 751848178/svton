import { ReleaseOrderListService } from "./release-order-list.service";

describe("ReleaseOrderListService", () => {
  const repository = { list: jest.fn() };
  const service = new ReleaseOrderListService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it("normalizes filters and returns the authenticated response scope", async () => {
    repository.list.mockResolvedValue({ items: [], total: 0 });
    await expect(
      service.list("team-1", "actor-1", "project-1", {
        query: "  v2  ",
        status: "building",
        take: 12,
      }),
    ).resolves.toEqual({
      scope: { teamId: "team-1", actorId: "actor-1", projectId: "project-1" },
      items: [],
      total: 0,
    });
    expect(repository.list).toHaveBeenCalledWith({
      teamId: "team-1",
      projectId: "project-1",
      query: "v2",
      status: "building",
      take: 12,
    });
  });

  it("uses a bounded default and drops whitespace-only search", async () => {
    repository.list.mockResolvedValue({ items: [], total: 0 });
    await service.list("team-1", "actor-1", "project-1", {
      query: "   ",
    } as never);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        take: 50,
      }),
    );
  });
});
