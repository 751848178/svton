import { ReleaseOrderController } from "./release-order.controller";

describe("ReleaseOrderController", () => {
  const orders = { list: jest.fn(), create: jest.fn() };
  const access = { assertRead: jest.fn(), assertCreate: jest.fn() };
  const controller = new ReleaseOrderController(
    orders as never,
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
});
