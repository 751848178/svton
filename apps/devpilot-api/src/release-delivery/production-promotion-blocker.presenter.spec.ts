import { presentPromotionBlocker } from "./production-promotion-blocker.presenter";

describe("Production promotion blocker presenter", () => {
  it("projects one exact persisted P03 evaluation for a later independent actor", () => {
    expect(presentPromotionBlocker([{
      id: "command-1",
      errorCode: "RELEASE_GATE_BLOCKED",
      errorMessage: "blocked",
      result: {
        checkpoint: "production_promote_pre_route",
        decisionId: "decision-1",
        manualChecks: [{
          gateId: "P03",
          evaluationId: "evaluation-1",
          reasonCode: "critical_business_validation_required",
          reason: { zh: "需要独立验证", en: "Independent validation required" },
        }],
      },
    }])).toMatchObject({
      commandId: "command-1",
      checkpoint: "production_promote_pre_route",
      decisionId: "decision-1",
      manualChecks: [{ gateId: "P03", evaluationId: "evaluation-1" }],
    });
  });

  it("fails closed for ambiguous or malformed command evidence", () => {
    const malformed = {
      id: "command-1", errorCode: "RELEASE_GATE_BLOCKED",
      errorMessage: "blocked", result: { manualChecks: [{ gateId: "P03" }] },
    };
    expect(presentPromotionBlocker([])).toBeNull();
    expect(presentPromotionBlocker([malformed, malformed])).toBeNull();
    expect(presentPromotionBlocker([malformed])).toMatchObject({ manualChecks: [] });
  });
});
