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
    expect(sql.match(/pe\.status = 'active'/g)).toHaveLength(5);
  });

  it("requires an exact approval and exact Production success proof", () => {
    expect(sql).toContain("oa.id = rr.operationApprovalId");
    expect(sql).toContain("oa.category = 'release'");
    expect(sql).toContain("oa.targetType = 'release_run'");
    expect(sql).toContain("oa.targetId = rr.id");
    expect(sql).toContain(
      "(oa.action = 'project.release_order.deploy_production'\n        AND rr.mode = 'standard')",
    );
    expect(sql).toContain(
      "(oa.action = 'project.release_order.deploy_production_recovery'\n        AND rr.mode = 'recovery')",
    );
    expect(sql).toContain("oa.inputHash = rr.inputHash");
    expect(sql).toContain("pdr.releaseRunId = rr.id");
    expect(sql).toContain("pdr.artifactManifestId = rr.artifactManifestId");
    expect(sql).toContain("pdr.environmentId = rr.environmentId");
    expect(sql).toContain("pdr.source = 'release_order'");
    expect(sql).toContain("pdr.dryRun = FALSE");
    expect(sql).toContain("pdr.status = 'completed'");
    expect(sql).toContain(
      "drr.status IN ('running', 'awaiting_validation', 'succeeded')",
    );
    expect(sql).toContain("doa.status = 'approved'");
    expect(sql).toContain("ld.productionEvidenceValid");
    expect(
      sql.indexOf(
        "le.phase = 'production'\n      AND le.productionEvidenceValid = FALSE THEN 'evidence_mismatch'",
      ),
    ).toBeLessThan(
      sql.indexOf(
        "le.sourceType = 'deployment_run' AND le.sourceStatus = 'failed' THEN 'failed'",
      ),
    );
    expect(sql).toContain("THEN 'evidence_mismatch'");
    expect(sql).toContain("le.sourceStatus = 'blocked' THEN 'blocked'");
    expect(sql).toContain("le.sourceStatus = 'canceled' THEN 'canceled'");
  });

  it("keeps lifecycle and F419 execution clocks distinct", () => {
    expect(sql).toContain("THEN oa.requestedAt");
    expect(sql).toContain("THEN oa.reviewedAt");
    expect(sql).toContain("AND oa.reviewedAt IS NOT NULL");
    expect(sql).toContain(
      "COALESCE(rr.finishedAt, rr.startedAt, rr.createdAt)",
    );
    expect(sql).not.toContain("rr.updatedAt");
    expect(sql).toContain("ORDER BY occurredAt DESC, tiePriority DESC");
  });

  it("derives withdrawn from AuditEvent with the legacy updatedAt fallback only", () => {
    expect(sql).toContain("ae.action = 'project.release_order.withdraw'");
    expect(sql).toContain("COALESCE(rw.occurredAt, so.updatedAt)");
    expect(sql).toContain("WHEN so.status = 'canceled' THEN 'withdrawn'");
  });
});
