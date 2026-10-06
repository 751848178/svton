import { check, predicate } from "./parity-e2e-evidence.mjs";

export function positiveReleaseFlowProfile(environment = process.env) {
  const profile = environment.DEVPILOT_RELEASE_FLOW_PROFILE || "basic_v1";
  if (profile === "basic_v1" || profile === "governed_v1") return profile;
  throw new Error("PARITY_RELEASE_FLOW_PROFILE_INVALID");
}

export async function exercisePositiveBuildGate(input) {
  const gate = input.catalog.checks?.find((item) => item.id === "C03");
  if (!gate?.evaluationId) {
    throw new Error("C03 independent review evaluation is unavailable");
  }
  if (input.profile === "basic_v1") {
    return resultFor(input, gate, input.catalog, 0);
  }
  const confirmation = await input.confirm(gate);
  const refreshed = await input.refresh();
  return resultFor(
    input,
    gate,
    refreshed,
    confirmation.manualApprovals?.length ?? 0,
  );
}

export function positiveBuildGateChecks(result, reviewerEmail) {
  const governed = result.profile === "governed_v1";
  return [
    check("profile", result.profile, governed ? "governed_v1" : "basic_v1"),
    check("gateId", result.gateId, "C03"),
    predicate(
      "evaluationId",
      Boolean(result.evaluationId),
      result.evaluationId,
    ),
    check(
      "reviewerEmail",
      result.reviewerEmail,
      governed ? reviewerEmail : null,
    ),
    check("approvalCount", result.approvalCount, governed ? 1 : 0),
    check("buildAllowed", result.buildAllowed, true),
    check(
      "manualGateConfirmed",
      result.confirmedManualGateIds.includes("C03"),
      governed,
    ),
  ];
}

function resultFor(input, gate, catalog, approvalCount) {
  return {
    profile: input.profile,
    gateId: gate.id,
    evaluationId: gate.evaluationId,
    reviewerEmail: input.profile === "governed_v1" ? input.reviewerEmail : null,
    approvalCount,
    buildAllowed: catalog.decisions?.build?.allowed,
    confirmedManualGateIds:
      catalog.decisions?.build?.confirmedManualGateIds ?? [],
  };
}
