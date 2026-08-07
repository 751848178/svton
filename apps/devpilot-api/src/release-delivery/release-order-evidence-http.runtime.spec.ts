import "reflect-metadata";
import type { ReleaseBuildHttpRuntimeFixture } from "./release-build-http-runtime.fixture";
import { seedReleaseOrderEvidence } from "./release-order-evidence-http.fixture";

const describeRuntime =
  process.env.RUN_F429_HTTP_RUNTIME === "1" ? describe : describe.skip;

jest.setTimeout(30_000);

describeRuntime("F429 authenticated release evidence HTTP runtime", () => {
  let fixture: ReleaseBuildHttpRuntimeFixture;
  let stagingRunId = "";

  beforeAll(async () => {
    const { ReleaseBuildHttpRuntimeFixture } =
      await import("./release-build-http-runtime.fixture");
    fixture = new ReleaseBuildHttpRuntimeFixture();
    await fixture.start();
    stagingRunId = await seedReleaseOrderEvidence(fixture);
  });
  afterAll(async () => {
    if (!fixture) return;
    await fixture.git.prisma.releaseRun.deleteMany({
      where: { teamId: fixture.git.teamId },
    });
    await fixture.stop();
  });

  it("returns one private scoped aggregate with append-only histories", async () => {
    const path = `${fixture.buildsPath().replace(/\/builds$/, "")}/evidence?take=50`;
    const response = await fixture.request(path);
    expect(response.ok).toBe(true);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toContain("X-Team-Id");
    const body = (await response.json()) as { data: Evidence };
    expect(body.data).toMatchObject({
      projectId: fixture.git.projectId,
      releaseOrderId: fixture.git.orderId,
      buildRuns: { total: 1 },
      stagingDeploymentRuns: { total: 2 },
      productionReleaseRuns: { total: 1 },
    });
    expect(body.data.buildRuns.items[0].manifest.items).toEqual([
      expect.objectContaining({ componentKey: "project-bundle" }),
    ]);
    expect(
      body.data.stagingDeploymentRuns.items.map(({ id }) => id),
    ).toHaveLength(2);
    expect(body.data.productionReleaseRuns.items[0]).toMatchObject({
      deploymentRuns: [{ id: expect.any(String) }],
      stagingProof: { deploymentRunId: expect.any(String) },
    });
  });

  it("returns redacted logs and structured result for production deployment runs", async () => {
    const path = `${fixture.buildsPath().replace(/\/builds$/, "")}/evidence?take=50`;
    const response = await fixture.request(path);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as { data: Evidence };
    const deployment =
      body.data.productionReleaseRuns.items[0].deploymentRuns[0];
    expect(deployment.logs).toEqual([
      "production exact Manifest started",
      "health passed",
    ]);
    expect(deployment.result).toMatchObject({
      workloadReady: { status: "passed" },
      healthProbe: { status: "passed" },
    });
  });

  it("binds the professional exact run read to the route project", async () => {
    const exact = await fixture.request(
      `/deployments/runs/${stagingRunId}?projectId=${fixture.git.projectId}`,
    );
    expect(exact.ok).toBe(true);
    expect(exact.headers.get("cache-control")).toBe("private, no-store");
    const foreign = await fixture.request(
      `/deployments/runs/${stagingRunId}?projectId=foreign-project`,
    );
    expect(foreign.status).toBe(404);
  });

  it("rejects unauthenticated and cross-project aggregate reads", async () => {
    const releasePath = fixture.buildsPath().replace(/\/builds$/, "");
    const unauthorized = await fetch(
      `${fixture.baseUrl}/api${releasePath}/evidence?take=50`,
    );
    expect(unauthorized.status).toBe(401);
    const foreign = await fixture.request(
      `${releasePath.replace(fixture.git.projectId, "foreign-project")}/evidence?take=50`,
    );
    expect(foreign.ok).toBe(false);
  });
});

interface Evidence {
  projectId: string;
  releaseOrderId: string;
  buildRuns: {
    total: number;
    items: Array<{ manifest: { items: unknown[] } }>;
  };
  stagingDeploymentRuns: { total: number; items: Array<{ id: string }> };
  productionReleaseRuns: {
    total: number;
    items: Array<{
      deploymentRuns: Array<{
        logs?: string[];
        result?: Record<string, unknown>;
      }>;
    }>;
  };
}
