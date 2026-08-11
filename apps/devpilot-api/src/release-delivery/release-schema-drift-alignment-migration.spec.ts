import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("release schema drift alignment migration", () => {
  const root = process.cwd();
  const sql = readFileSync(join(root,
    "prisma/migrations/20260811200000_release_schema_drift_alignment/migration.sql"), "utf8");
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

  it("aligns SiteRouteSwitchRun defaults without a database updatedAt default", () => {
    expect(sql).toContain("MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'prepared'");
    expect(sql).toContain("MODIFY `updatedAt` DATETIME(3) NOT NULL");
    expect(sql).not.toMatch(/`updatedAt`[^;]*DEFAULT/i);
  });

  it("replaces the attempt foreign key with SET NULL and drops the redundant id unique", () => {
    expect(sql).toContain("DROP FOREIGN KEY `ReleaseEvent_stageAttemptId_fkey`");
    expect(sql).toContain("ON DELETE SET NULL ON UPDATE CASCADE");
    expect(sql).toContain("DROP INDEX `ReleasePlan_id_key` ON `ReleasePlan`");
  });

  it("locks physical index maps and verified commit storage in Prisma", () => {
    for (const name of [
      "ProductionPromotionCommand_status_lease_idx",
      "ProductionPromotionCommand_lease_owner_idx",
      "ProductionPromotionCommand_route_operation_idx",
      "ProductionPromotionCommand_legacy_reconcile_idx",
      "SiteRouteSwitchRun_deployment_candidate_idx",
    ]) expect(schema).toContain(`map: \"${name}\"`);
    expect(schema).toContain("verifiedCommitSha String   @db.VarChar(64)");
    expect(schema).toContain("stageAttempt     ReleaseStageAttempt? @relation(fields: [stageAttemptId], references: [id], onDelete: SetNull)");
    const releasePlan = schema.slice(schema.indexOf("model ReleasePlan"),
      schema.indexOf("model ReleaseStage"));
    expect(releasePlan).not.toContain("@@unique([id])");
  });
});
