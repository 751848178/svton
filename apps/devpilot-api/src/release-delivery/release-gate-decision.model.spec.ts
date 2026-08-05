import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { buildReleaseGateDecision } from "./release-gate-decision.model";
import type { PersistedReleaseGateEvaluation } from "./release-gate-decision.types";

describe("release gate decision model", () => {
  const now = new Date("2026-08-05T08:00:00.000Z");

  it.each([
    ["build", "commit", 9],
    ["staging", "build", 5],
    ["production", "deploy", 19],
  ] as const)("maps %s to its exact MVP %s gates", (stage, phase, count) => {
    const decision = buildReleaseGateDecision({ stage, checks: checks(), now });
    expect(decision).toMatchObject({ stage, phase, allowed: true });
    expect(decision.snapshot.evaluations).toHaveLength(count);
  });

  it.each(["unchecked", "blocked", "unavailable"] as const)(
    "fails a required technical fact closed for %s",
    (status) => {
      const input = checks();
      Object.assign(input.find((check) => check.id === "C01")!, { status });
      expect(
        buildReleaseGateDecision({ stage: "build", checks: input, now }),
      ).toMatchObject({ allowed: false, blockerGateIds: ["C01"] });
    },
  );

  it("does not treat warnings or business validation evidence as technical pass claims", () => {
    const input = checks();
    Object.assign(input.find((check) => check.id === "B01")!, {
      status: "warning",
    });
    Object.assign(input.find((check) => check.id === "P03")!, {
      status: "manual",
    });
    expect(
      buildReleaseGateDecision({ stage: "staging", checks: input, now }),
    ).toMatchObject({
      allowed: true,
      warningGateIds: ["B01"],
      evidenceOnlyGateIds: ["P03"],
    });
  });

  it("accepts only an input-bound, fresh confirmation on a manual gate", () => {
    const input = checks();
    const manual = input.find((check) => check.id === "C06")!;
    Object.assign(manual, {
      status: "manual",
      waiver: {
        kind: "manual_confirmation",
        actorId: "user-1",
        confirmedAt: now.toISOString(),
        evaluationInputHash: manual.evaluationInputHash,
      },
    });
    expect(
      buildReleaseGateDecision({ stage: "build", checks: input, now }),
    ).toMatchObject({ allowed: true, confirmedManualGateIds: ["C06"] });

    (manual.waiver as { evaluationInputHash: string }).evaluationInputHash =
      "foreign";
    expect(
      buildReleaseGateDecision({ stage: "build", checks: input, now }),
    ).toMatchObject({ allowed: false, manualGateIds: ["C06"] });
  });

  it("fails missing providers, stale facts, duplicates and definition drift closed", () => {
    const missingProvider = checks();
    missingProvider.find((check) => check.id === "C01")!.providerKey = null;
    expect(
      buildReleaseGateDecision({ stage: "build", checks: missingProvider, now })
        .allowed,
    ).toBe(false);

    const stale = checks();
    stale.find((check) => check.id === "C01")!.fresh = false;
    expect(
      buildReleaseGateDecision({ stage: "build", checks: stale, now }).allowed,
    ).toBe(false);

    const unknownFreshness = checks();
    unknownFreshness.find((check) => check.id === "C01")!.fresh = null;
    expect(
      buildReleaseGateDecision({
        stage: "build",
        checks: unknownFreshness,
        now,
      }).allowed,
    ).toBe(false);

    const malformed = checks();
    malformed.push({ ...malformed.find((check) => check.id === "C01")! });
    malformed.find((check) => check.id === "C02")!.capabilityId = "M15";
    expect(
      buildReleaseGateDecision({ stage: "build", checks: malformed, now }),
    ).toMatchObject({
      allowed: false,
      integrityErrors: ["C01:duplicate", "C02:definition_drift"],
    });
  });

  it("defers only the explicit pre-execution D17 missing-deployment fact", () => {
    const input = checks();
    Object.assign(input.find((check) => check.id === "D17")!, {
      status: "unavailable",
      providerKey: null,
      reasonCode: "production_deployment_missing",
    });
    expect(
      buildReleaseGateDecision({
        stage: "production",
        checks: input,
        now,
        deferredReasons: { D17: ["production_deployment_missing"] },
      }),
    ).toMatchObject({ allowed: true, deferredGateIds: ["D17"] });
    expect(
      buildReleaseGateDecision({
        stage: "production",
        checks: input,
        now,
        deferredReasons: { D17: ["health_probe_provider_missing"] },
      }),
    ).toMatchObject({ allowed: false, blockerGateIds: ["D17"] });
  });

  it("defers D20 compatibility only until exact executor evidence exists", () => {
    const input = checks();
    Object.assign(input.find((check) => check.id === "D20")!, {
      status: "unavailable",
      providerKey: "release_recovery_capability",
      reasonCode: "recovery_compatibility_provider_missing",
      fresh: null,
    });
    expect(
      buildReleaseGateDecision({
        stage: "production",
        checks: input,
        now,
        deferredReasons: {
          D20: ["recovery_compatibility_provider_missing"],
        },
      }),
    ).toMatchObject({ allowed: true, deferredGateIds: ["D20"] });
    expect(
      buildReleaseGateDecision({ stage: "production", checks: input, now }),
    ).toMatchObject({ allowed: false, blockerGateIds: ["D20"] });
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
