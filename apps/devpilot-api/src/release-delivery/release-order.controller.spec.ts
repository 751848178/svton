import { ReleaseOrderController } from "./release-order.controller";
import { HEADERS_METADATA } from "@nestjs/common/constants";

describe("ReleaseOrderController", () => {
  const orders = { list: jest.fn(), create: jest.fn(), get: jest.fn() };
  const orderList = { list: jest.fn() };
  const builds = { list: jest.fn(), build: jest.fn() };
  const staging = { list: jest.fn(), deploy: jest.fn() };
  const production = {
    list: jest.fn(),
    preview: jest.fn(),
    confirm: jest.fn(),
  };
  const access = {
    assertRead: jest.fn(),
    assertCreate: jest.fn(),
    assertBuild: jest.fn(),
    assertDeployStaging: jest.fn(),
    assertConfirmProduction: jest.fn(),
  };
  const controller = new ReleaseOrderController(
    orders as never,
    orderList as never,
    builds as never,
    staging as never,
    production as never,
    access as never,
  );
  const request = { teamId: "team-1", user: { id: "user-1" } };

  beforeEach(() => jest.clearAllMocks());

  it("authorizes list before reading the project orders", async () => {
    orderList.list.mockResolvedValue({ items: [], total: 0 });
    const query = { query: "v2", status: "building" as const, take: 20 };
    await controller.list(request, "project-1", query);
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(orderList.list).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      query,
    );
  });

  it("does not run the read model when access is rejected", async () => {
    access.assertRead.mockRejectedValueOnce(new Error("denied"));
    await expect(
      controller.list(request, "project-1", { take: 50 }),
    ).rejects.toThrow("denied");
    expect(orderList.list).not.toHaveBeenCalled();
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
    await controller.listBuilds(request, "project-1", "order-1", { take: 50 });
    expect(access.assertRead).toHaveBeenCalled();
    expect(builds.list).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      50,
    );
  });

  it("marks BuildRun history private and non-reusable", () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      ReleaseOrderController.prototype.listBuilds,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
    );
  });

  it.each([
    "get",
    "listStagingDeployments",
    "listProduction",
    "previewProduction",
  ] as const)("marks %s evidence private and non-reusable", (method) => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      ReleaseOrderController.prototype[method],
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
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

  it("authorizes exact-Manifest Staging reads and writes", async () => {
    staging.list.mockResolvedValue({ items: [], total: 0 });
    await controller.listStagingDeployments(request, "project-1", "order-1");
    expect(access.assertRead).toHaveBeenCalled();
    expect(staging.list).toHaveBeenCalledWith("team-1", "project-1", "order-1");

    await controller.deployStaging(request, "project-1", "order-1", {
      manifestId: "manifest-1",
    });
    expect(access.assertDeployStaging).toHaveBeenCalled();
    expect(staging.deploy).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      manifestId: "manifest-1",
    });
  });

  it("authorizes Production preview and confirmation against the nested scope", async () => {
    const previewDto = { manifestId: "manifest-1" };
    await controller.previewProduction(
      request,
      "project-1",
      "order-1",
      previewDto,
    );
    expect(access.assertRead).toHaveBeenCalled();
    expect(production.preview).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      "manifest-1",
      undefined,
    );

    const confirmDto = {
      manifestId: "manifest-1",
      expectedInputHash: "a".repeat(64),
      idempotencyKey: "request-1",
    };
    await controller.confirmProduction(
      request,
      "project-1",
      "order-1",
      confirmDto,
    );
    expect(access.assertConfirmProduction).toHaveBeenCalled();
    expect(production.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        actorId: "user-1",
        projectId: "project-1",
        releaseOrderId: "order-1",
        ...confirmDto,
      }),
    );
  });
});
