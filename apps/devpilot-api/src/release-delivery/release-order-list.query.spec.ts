import { releaseOrderListRowsQuery } from "./release-order-list.query";

describe("releaseOrderListRowsQuery", () => {
  const sql = releaseOrderListRowsQuery({
    teamId: "team-1",
    projectId: "project-1",
    take: 50,
  }).strings.join("?");

  it("accepts deployments only through an exact Manifest BuildRun relation", () => {
    expect(sql).toContain("br.id = am.buildRunId");
    expect(sql).toContain("br.releaseOrderId = am.releaseOrderId");
    expect(sql).toContain("br.teamId = am.teamId");
    expect(sql).toContain("br.projectId = am.projectId");
    expect(sql).toContain("br.id AS buildRunId");
    expect(sql).not.toContain("dr.artifactManifestId, am.buildRunId");
  });

  it("accepts ReleaseRun events only through the exact frozen Manifest", () => {
    expect(sql).toContain("am.id = rr.artifactManifestId");
    expect(sql).toContain("am.releaseOrderId = rr.releaseOrderId");
    expect(sql).toContain("am.teamId = rr.teamId");
    expect(sql).toContain("am.projectId = rr.projectId");
    expect(sql).toContain("am.digest = rr.verifiedDigest");
    expect(sql).toContain("pe.baselineRole = 'production'");
  });
});
