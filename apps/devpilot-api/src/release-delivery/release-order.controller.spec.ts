import { ReleaseOrderController } from "./release-order.controller";

describe("ReleaseOrderController", () => {
  const orders = { list: jest.fn(), create: jest.fn(), get: jest.fn() };
  const builds = { list: jest.fn(), build: jest.fn() };
  const access = {
    assertRead: jest.fn(),
    assertCreate: jest.fn(),
    assertBuild: jest.fn(),
  };
  const controller = new ReleaseOrderController(
    orders as never,
    builds as never,
    access as never,
  );
  const request = { teamId: "team-1", user: { id: "user-1" } };

  beforeEach(() => jest.clearAllMocks());

  it("authorizes list before reading the project orders", async () => {
    orders.list.mockResolvedValue({ items: [], total: 0 });
    await controller.list(request, "project-1");
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(orders.list).toHaveBeenCalledWith("team-1", "project-1");
  });

  it("authorizes create and forwards only the validated DTO", async () => {
    const dto = { releaseVersion: "2.4.1", note: "First" };
    await controller.create(request, "project-1", dto);
    expect(access.assertCreate).toHaveBeenCalled();
    expect(orders.create).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      dto,
    );
  });

  it("authorizes nested build history reads", async () => {
    builds.list.mockResolvedValue({ items: [], total: 0 });
    await controller.listBuilds(request, "project-1", "order-1");
    expect(access.assertRead).toHaveBeenCalled();
    expect(builds.list).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
    );
  });

  it("authorizes a stable release-order detail read", async () => {
    orders.get.mockResolvedValue({ id: "order-1" });
    await controller.get(request, "project-1", "order-1");
    expect(access.assertRead).toHaveBeenCalled();
    expect(orders.get).toHaveBeenCalledWith("team-1", "project-1", "order-1");
  });

  it("uses the high-risk build access action before execution", async () => {
    await controller.build(request, "project-1", "order-1");
    expect(access.assertBuild).toHaveBeenCalled();
    expect(builds.build).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      "order-1",
    );
  });
});
