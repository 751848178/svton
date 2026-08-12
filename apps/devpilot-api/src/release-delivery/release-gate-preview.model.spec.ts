import { buildReleaseGatePreviewDecision } from "./release-gate-preview.model";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";

describe("buildReleaseGatePreviewDecision", () => {
  it("allows requesting approval when D13 is the only pending gate", () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    const required = RELEASE_GATE_DEFINITIONS.filter((item) =>
      ["D01", "D02", "D03", "D05", "D06", "D07", "D08", "D09", "D10",
        "D11", "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D19",
        "D20"].includes(item.id));
    const checks = required.map((definition) => ({
      ...definition,
      status: definition.id === "D13" ? "manual" as const : "checked" as const,
      reasonCode: "fixture",
      reason: { zh: "fixture", en: "fixture" },
      providerKey: "fixture-v1",
      checkedAt: now.toISOString(),
      expiresAt: null,
      fresh: true,
      evidenceRef: "fixture:evidence",
    }));
    const decision = buildReleaseGatePreviewDecision({
      checkpoint: "production_pre_execution",
      checks,
      actionIdentity: {
        approvalSubjectHash: "subject",
        actionInputHash: "action",
        requesterActorId: "actor-1",
      },
      now,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.manualGateIds).toEqual(["D13"]);
    expect(decision.preApprovalAllowed).toBe(true);
    expect(decision.preApprovalManualGateIds).toEqual([]);
  });
});
