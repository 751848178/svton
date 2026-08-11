import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { buildReleaseGateDecision } from "./release-gate-decision.model";
import type { PersistedReleaseGateEvaluation } from "./release-gate-decision.types";

describe("release gate checkpoint decision model", () => {
  const now = new Date("2026-08-05T08:00:00.000Z");

  it.each([
    ["build_pre_execution", "build", "commit", 6],
    ["build_post_execution", "build", "commit", 3],
    ["staging_pre_execution", "staging", "build", 5],
    ["production_pre_execution", "production", "deploy", 19],
    ["production_post_deploy", "production", "promote", 4],
    ["production_promote", "production", "promote", 7],
    ["production_promote_pre_route", "production", "promote", 7],
    ["production_post_route", "production", "promote", 1],
  ] as const)("selects exact %s gate set", (checkpoint, stage, phase, count) => {
    const decision = buildReleaseGateDecision({
      checkpoint,
      checks: checks(),
      now,
    });
    expect(decision).toMatchObject({ checkpoint, stage, phase, allowed: true });
    expect(decision.snapshot).toMatchObject({ version: 2, checkpoint });
    expect(decision.snapshot.requiredGateIds).toHaveLength(count);
    expect(decision.snapshot.evaluations).toHaveLength(count);
  });

  it("does not require future build evidence at pre-execution", () => {
    const input = checks();
    for (const id of ["C07", "C09", "C10"]) {
      Object.assign(input.find((check) => check.id === id)!, {
        status: "unavailable",
        providerKey: null,
        fresh: null,
      });
    }
    expect(
      buildReleaseGateDecision({
        checkpoint: "build_pre_execution",
        checks: input,
        now,
      }),
    ).toMatchObject({ allowed: true, blockerGateIds: [] });
    expect(
      buildReleaseGateDecision({
        checkpoint: "build_post_execution",
        checks: input,
        now,
      }),
    ).toMatchObject({ allowed: false, blockerGateIds: ["C07", "C09", "C10"] });
  });

  it("fails required unavailable, stale, duplicate, or drifted facts closed", () => {
    const input = checks();
    input.find((check) => check.id === "C01")!.fresh = false;
    input.push({ ...input.find((check) => check.id === "C02")! });
    input.find((check) => check.id === "C03")!.capabilityId = "M15";
    expect(
      buildReleaseGateDecision({
        checkpoint: "build_pre_execution",
        checks: input,
        now,
      }),
    ).toMatchObject({
      allowed: false,
      blockerGateIds: ["C01"],
      integrityErrors: ["C02:duplicate", "C03:definition_drift"],
    });
  });

  it("never accepts generic production deferral", () => {
    const input = checks();
    Object.assign(input.find((check) => check.id === "D17")!, {
      status: "unavailable",
      providerKey: null,
      fresh: null,
      reasonCode: "production_deployment_missing",
    });
    expect(
      buildReleaseGateDecision({
        checkpoint: "production_pre_execution",
        checks: input,
        now,
      }),
    ).toMatchObject({ allowed: false, blockerGateIds: ["D17"] });
  });

  it("does not let the C03 confirmer execute the same candidate", () => {
    const input = checks();
    const c03 = input.find((check) => check.id === "C03")!;
    c03.status = "manual";
    c03.persistedStatus = "needs_human";
    c03.waiver = {
      kind: "manual_confirmation",
      actorId: "reviewer-1",
      confirmedAt: now.toISOString(),
      evaluationInputHash: c03.evaluationInputHash,
    };
    expect(buildReleaseGateDecision({
      checkpoint: "build_pre_execution",
      checks: input,
      actorId: "reviewer-1",
      now,
    })).toMatchObject({ allowed: false, manualGateIds: ["C03"] });
    expect(buildReleaseGateDecision({
      checkpoint: "build_pre_execution",
      checks: input,
      actorId: "requester-1",
      now,
    })).toMatchObject({ allowed: true, confirmedManualGateIds: ["C03"] });
  });
});

function checks(): PersistedReleaseGateEvaluation[] {
  return RELEASE_GATE_DEFINITIONS.map((definition) => ({
    ...definition,
    status: "checked",
    providerKey: `provider.${definition.capabilityId ?? "target"}`,
    reasonCode: "passed",
    reason: { zh: "通过", en: "Passed" },
    evidenceRef: `evidence:${definition.id}`,
    checkedAt: "2026-08-05T07:00:00.000Z",
    expiresAt: "2026-08-06T07:00:00.000Z",
    fresh: true,
    evaluationId: `evaluation-${definition.id}`,
    evaluationInputHash: `input-${definition.id}`,
    definitionVersion: "v13:test",
    persistedStatus: "passed",
    persistedAt: "2026-08-05T07:00:00.000Z",
    waiver: null,
    waiverExpiresAt: null,
  }));
}
