import { releaseOrderLifecycleDetailQuery } from "./release-order-lifecycle.query";
import { releaseOrderResumeStepCte } from "./release-order-resume-step.query";

describe("release order resume step SQL", () => {
  const resumeSql = releaseOrderResumeStepCte().strings.join("?");

  it("takes the furthest structurally accepted lifecycle phase", () => {
    expect(resumeSql).toContain("FROM lifecycle_events");
    expect(resumeSql).toContain("MAX(CASE phase");
    expect(resumeSql).toContain("WHEN 'preflight' THEN 0");
    expect(resumeSql).toContain("WHEN 'build' THEN 1");
    expect(resumeSql).toContain("WHEN 'staging' THEN 2");
    expect(resumeSql).toContain("WHEN 'production' THEN 3");
    expect(resumeSql).toContain("GROUP BY releaseOrderId");
  });

  it("does not derive progress from chronology, lifecycle rank, or status", () => {
    expect(resumeSql).not.toContain("eventRank");
    expect(resumeSql).not.toContain("occurredAt");
    expect(resumeSql).not.toContain("sourceStatus");
    expect(resumeSql).not.toContain("persistedStatus");
  });

  it("joins the canonical aggregate into the detail query", () => {
    const detailSql = releaseOrderLifecycleDetailQuery({
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
    }).strings.join("?");
    expect(detailSql).toContain("furthest_release_phase AS");
    expect(detailSql).toContain("frp.resumeStep");
    expect(detailSql).toContain("frp.releaseOrderId = lo.id");
  });
});
