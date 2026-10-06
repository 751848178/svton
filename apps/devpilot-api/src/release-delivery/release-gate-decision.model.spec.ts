import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { buildReleaseGateDecision } from "./release-gate-decision.model";
import {
  releaseFlowProfileFromEnvironment,
  releaseGateCheckpointPolicy,
} from "./release-gate-checkpoint.policy";
import type { PersistedReleaseGateEvaluation } from "./release-gate-decision.types";

describe("release gate checkpoint decision model", () => {
  const now = new Date("2026-08-05T08:00:00.000Z");
  const actionIdentity = {
    approvalSubjectHash: "subject-hash",
    actionInputHash: "action-hash",
    requesterActorId: "requester-1",
  };

  it.each([
    ["build_pre_execution", "build", "commit", 1],
    ["build_post_execution", "build", "commit", 0],
    ["staging_pre_execution", "staging", "build", 2],
    ["production_pre_execution", "production", "deploy", 3],
    ["production_post_deploy", "production", "promote", 0],
    ["production_promote", "production", "promote", 0],
    ["production_promote_pre_route", "production", "promote", 0],
    ["production_post_route", "production", "promote", 0],
  ] as const)(
    "selects exact %s gate set",
    (checkpoint, stage, phase, count) => {
      const decision = buildReleaseGateDecision({
        checkpoint,
        checks: checks(),
        actionIdentity,
        now,
      });
      expect(decision).toMatchObject({
        checkpoint,
        stage,
        phase,
        allowed: true,
      });
      expect(decision.snapshot).toMatchObject({ version: 4, checkpoint });
      expect(decision.snapshot.requiredGateIds).toHaveLength(count);
      expect(decision.snapshot.evaluations).toHaveLength(count);
    },
  );

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
        actionIdentity,
        now,
      }),
    ).toMatchObject({ allowed: true, blockerGateIds: [] });
    expect(
      buildReleaseGateDecision({
        checkpoint: "build_post_execution",
        checks: input,
        actionIdentity,
        now,
      }),
    ).toMatchObject({ allowed: true, blockerGateIds: [] });
  });

  it("fails the required source-resolution fact closed when stale", () => {
    const input = checks();
    input.find((check) => check.id === "C01")!.fresh = false;
    expect(
      buildReleaseGateDecision({
        checkpoint: "build_pre_execution",
        checks: input,
        actionIdentity,
        now,
      }),
    ).toMatchObject({
      allowed: false,
      blockerGateIds: ["C01"],
      integrityErrors: [],
    });
  });

  it("retains the complete governed profile for later reactivation", () => {
    expect(
      releaseGateCheckpointPolicy("build_pre_execution", "governed_v1")
        .requiredGateIds,
    ).toEqual(["C01", "C02", "C03", "C05", "C06", "C08"]);
    expect(
      releaseGateCheckpointPolicy("staging_pre_execution", "governed_v1")
        .requiredGateIds,
    ).toEqual(["B01", "B02", "B03", "B06", "B09"]);
  });

  it("keeps the basic profile by default and permits explicit governed recovery", () => {
    expect(releaseFlowProfileFromEnvironment({})).toBe("basic_v1");
    expect(
      releaseFlowProfileFromEnvironment({
        DEVPILOT_RELEASE_FLOW_PROFILE: "governed_v1",
      }),
    ).toBe("governed_v1");
    expect(() =>
      releaseFlowProfileFromEnvironment({
        DEVPILOT_RELEASE_FLOW_PROFILE: "unknown",
      }),
    ).toThrow("DEVPILOT_RELEASE_FLOW_PROFILE_INVALID");
  });

  it("never accepts deferral for a required basic production gate", () => {
    const input = checks();
    Object.assign(input.find((check) => check.id === "D01")!, {
      status: "unavailable",
      providerKey: null,
      fresh: null,
      reasonCode: "environment_target_missing",
    });
    expect(
      buildReleaseGateDecision({
        checkpoint: "production_pre_execution",
        checks: input,
        actionIdentity,
        now,
      }),
    ).toMatchObject({ allowed: false, blockerGateIds: ["D01"] });
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
    manualApprovals: [],
  }));
}
