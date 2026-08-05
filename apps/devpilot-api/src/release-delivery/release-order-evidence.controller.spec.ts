import { HEADERS_METADATA } from "@nestjs/common/constants";
import { ReleaseOrderEvidenceController } from "./release-order-evidence.controller";

describe("ReleaseOrderEvidenceController", () => {
  const evidence = { get: jest.fn() };
  const access = { assertRead: jest.fn() };
  const controller = new ReleaseOrderEvidenceController(
    evidence as never,
    access as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("authorizes the project before reading one bounded release aggregate", async () => {
    await controller.get(
      { teamId: "team-1", user: { id: "actor-1" } },
      "project-1",
      "order-1",
      { take: 20 },
    );
    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
    });
    expect(evidence.get).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "order-1",
      20,
    );
  });

  it("marks the actor and team scoped evidence private and non-reusable", () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      ReleaseOrderEvidenceController.prototype.get,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        { name: "Cache-Control", value: "private, no-store" },
        { name: "Vary", value: "Authorization, X-Team-Id, Cookie" },
      ]),
    );
  });
});
