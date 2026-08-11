import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Production promotion reconcile additive migration", () => {
  it("adds an append-only idempotent audit command without rewriting legacy rows", () => {
    const sql = readFileSync(resolve(__dirname,
      "../../prisma/migrations/20260811190000_production_promotion_reconcile_command/migration.sql"),
    "utf8");
    expect(sql).toContain("CREATE TABLE `ProductionPromotionReconcileCommand`");
    expect(sql).toContain("promotionCommandId_idempotencyKey_key");
    expect(sql).not.toMatch(/UPDATE\s+`?ProductionPromotionCommand/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
