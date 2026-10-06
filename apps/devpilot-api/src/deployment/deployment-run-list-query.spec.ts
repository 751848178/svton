import { buildDeploymentRunListQuery } from "./deployment-run-list-query";

describe("buildDeploymentRunListQuery", () => {
  it("builds project filters and look-ahead pagination", () => {
    expect(
      buildDeploymentRunListQuery("team-1", {
        projectId: "project-1",
        environmentId: "env-prod",
        status: "failed",
        startedFrom: "2026-08-01T00:00:00.000Z",
        startedTo: "2026-08-27T23:59:59.999Z",
        skip: 20,
        take: 21,
      }),
    ).toEqual({
      where: {
        teamId: "team-1",
        projectId: "project-1",
        environmentId: "env-prod",
        status: "failed",
        startedAt: {
          gte: new Date("2026-08-01T00:00:00.000Z"),
          lte: new Date("2026-08-27T23:59:59.999Z"),
        },
      },
      skip: 20,
      take: 21,
    });
  });

  it("keeps both release ownership chains", () => {
    const result = buildDeploymentRunListQuery("team-1", {
      releaseOrderId: "release-1",
    });
    expect(result.where.OR).toHaveLength(2);
  });
});
