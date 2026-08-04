import { HEADERS_METADATA } from "@nestjs/common/constants";
import { ProjectDeliverySummaryController } from "./project-delivery-summary.controller";

describe("ProjectDeliverySummaryController", () => {
  const summary = { get: jest.fn() };
  const access = { assertRead: jest.fn() };
  const controller = new ProjectDeliverySummaryController(
    summary as never,
    access as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("authorizes and passes the exact actor/team/project scope", async () => {
    const request = { teamId: "team-1", user: { id: "actor-1" } };
    summary.get.mockResolvedValue({ scope: {} });

    await controller.get(request, "project-1");

    const scope = {
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
    };
    expect(access.assertRead).toHaveBeenCalledWith(scope);
    expect(summary.get).toHaveBeenCalledWith("team-1", "actor-1", "project-1");
    expect(access.assertRead.mock.invocationCallOrder[0]).toBeLessThan(
      summary.get.mock.invocationCallOrder[0],
    );
  });

  it("marks actor/team scoped responses private and non-reusable", () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      ProjectDeliverySummaryController.prototype.get,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
    );
  });
});
