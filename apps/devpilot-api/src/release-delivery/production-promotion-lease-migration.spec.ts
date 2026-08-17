import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Production promotion lease additive migration", () => {
  const source = readFileSync(
    resolve(
      __dirname,
      "../../prisma/migrations/20260811160000_production_promotion_lease/migration.sql",
    ),
    "utf8",
  );

  it.each([
    "phase",
    "leaseOwner",
    "leaseTokenHash",
    "leaseExpiresAt",
    "heartbeatAt",
    "attemptCount",
    "preDecisionActionHash",
    "postDecisionActionHash",
    "routeSwitchOperationId",
    "observationRecordedAt",
  ])("adds command field %s", (field) => {
    expect(source).toContain(`ADD COLUMN \`${field}\``);
  });

  it("supports due-command recovery and typed candidate observation lookup", () => {
    expect(source).toContain("ProductionPromotionCommand_status_lease_idx");
    expect(source).toContain("SiteRouteSwitchRun_deployment_candidate_idx");
    expect(source).toContain("`promotionCandidateHash`");
    expect(source).toContain("`promotionObservedAt`");
    expect(source).toContain("`promotionProbeHash`");
    expect(source).toContain("`promotionObservation` JSON");
  });
});
