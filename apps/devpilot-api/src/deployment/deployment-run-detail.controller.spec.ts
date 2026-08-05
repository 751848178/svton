import { HEADERS_METADATA } from "@nestjs/common/constants";
import { DeploymentRunDetailController } from "./deployment-run-detail.controller";

describe("DeploymentRunDetailController", () => {
  const service = { get: jest.fn() };
  const controller = new DeploymentRunDetailController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it("binds an exact run read to the route project when provided", () => {
    controller.get(
      { teamId: "team-1", user: { id: "actor-1" } },
      "run-1",
      "project-1",
    );
    expect(service.get).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "actor-1",
      runId: "run-1",
      projectId: "project-1",
    });
  });

  it("marks the professional evidence response private and non-reusable", () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      DeploymentRunDetailController.prototype.get,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
    );
  });
});
