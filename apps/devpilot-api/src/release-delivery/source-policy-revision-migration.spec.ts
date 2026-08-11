import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("SourcePolicyRevision migration", () => {
  it("creates immutable project revisions and a current pointer", async () => {
    const sql = await readFile(
      resolve(
        __dirname,
        "../../prisma/migrations/20260811130000_source_policy_revision/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE `SourcePolicyRevision`");
    expect(sql).toContain("externalRequiredChecks");
    expect(sql).toContain("requiredIndependentApprovals");
    expect(sql).toContain("Project_currentSourcePolicyRevisionId_fkey");
    expect(sql).toContain(
      "SourcePolicyRevision_projectId_profileId_profileVersion_key",
    );
  });

  it("adds canonical v2 snapshots and additive manual approvals", async () => {
    const sql = await readFile(
      resolve(
        __dirname,
        "../../prisma/migrations/20260811150000_gate_manual_approval/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("ADD COLUMN `snapshotVersion`");
    expect(sql).toContain("ADD COLUMN `snapshot` JSON NULL");
    expect(sql).toContain("WHERE `snapshot` IS NULL");
    expect(sql).toContain("CREATE TABLE `GateManualApproval`");
    expect(sql).toContain(
      "(`gateEvaluationId`, `evaluationInputHash`, `actionInputHash`, `reviewerActorId`)",
    );
    expect(sql).not.toContain("UPDATE `GateEvaluation`");
  });
});
