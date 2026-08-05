import { ReleaseBuildDetailController } from "./release-build-detail.controller";
import { HEADERS_METADATA } from "@nestjs/common/constants";

describe("ReleaseBuildDetailController", () => {
  it("authorizes and forwards the complete nested BuildRun scope", async () => {
    const builds = { get: jest.fn().mockResolvedValue({ id: "build-1" }) };
    const access = { assertRead: jest.fn() };
    const controller = new ReleaseBuildDetailController(
      builds as never,
      access as never,
    );
    await controller.get(
      { teamId: "team-1", user: { id: "user-1" } },
      "project-1",
      "order-1",
      "build-1",
    );
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(builds.get).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      "build-1",
    );
  });

  it("marks complete BuildRun evidence private and non-reusable", () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      ReleaseBuildDetailController.prototype.get,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
    );
  });
});
