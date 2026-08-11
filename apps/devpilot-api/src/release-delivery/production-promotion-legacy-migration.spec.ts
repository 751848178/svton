import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Production promotion legacy reconcile additive migration", () => {
  const source = readFileSync(resolve(
    __dirname,
    "../../prisma/migrations/20260811180000_production_promotion_legacy_reconcile/migration.sql",
  ), "utf8");

  it("quarantines only pre-lease running commands and preserves terminal history", () => {
    expect(source).toContain("ADD COLUMN `legacyReconcileRequired`");
    expect(source).toContain("`phase` = 'legacy_reconcile_required'");
    expect(source).toContain("`status` = 'running'");
    expect(source).toContain("`attemptCount` = 0");
    expect(source).toContain("`status` = 'completed'");
    expect(source).not.toMatch(/DELETE FROM|DROP TABLE|TRUNCATE/i);
  });
});
